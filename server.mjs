import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { StudyEngine, AppError } from './lib/engine.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp3': 'audio/mpeg', '.mp4': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const MEDIA_MIMES = new Set(['image/png', 'image/webp', 'image/jpeg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg']);

function json(res, status, value, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value));
}

async function body(req) {
  if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) throw new AppError('请使用 JSON 格式提交', 415);
  const max = 100 * 1024 * 1024, chunks = []; let count = 0;
  for await (const chunk of req) { count += chunk.length; if (count > max) throw new AppError('导入文件不能超过 100 MiB', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new AppError('JSON 格式无效'); }
}

async function serveFile(req, res, file, contentType) {
  let stat;
  try { stat = await fs.promises.stat(file); } catch (e) { if (e.code === 'ENOENT') throw new AppError('文件不存在', 404); throw e; }
  if (!stat.isFile()) throw new AppError('文件不存在', 404);
  let start = 0, end = stat.size - 1, status = 200;
  const headers = { 'Content-Type': contentType || MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-cache' };
  if (req.headers.range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
    if (!match || (!match[1] && !match[2])) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
    if (!match[1]) { const suffix = Number(match[2]); start = Math.max(0, stat.size - suffix); }
    else { start = Number(match[1]); if (match[2]) end = Math.min(end, Number(match[2])); }
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size || end < 0) { res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }); res.end(); return; }
    status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
  }
  headers['Content-Length'] = Math.max(0, end - start + 1);
  res.writeHead(status, headers);
  if (req.method === 'HEAD' || stat.size === 0) { res.end(); return; }
  await pipeline(fs.createReadStream(file, { start, end }), res);
}

async function safeStatic(root, relative) {
  const resolvedRoot = path.resolve(root), target = path.resolve(resolvedRoot, relative);
  if (!target.startsWith(resolvedRoot + path.sep)) throw new AppError('路径无效', 403);
  let realRoot, real;
  try { [realRoot, real] = await Promise.all([fs.promises.realpath(resolvedRoot), fs.promises.realpath(target)]); }
  catch (e) { if (e.code === 'ENOENT') throw new AppError('文件不存在', 404); throw e; }
  if (!real.startsWith(realRoot + path.sep)) throw new AppError('路径无效', 403);
  return real;
}

function publicCdn(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'image.xiangzi.tech' && !u.username && !u.password && (!u.port || u.port === '443'); }
  catch { return false; }
}

function mediaCache(root) {
  const mediaDir = path.join(root, 'media'), indexPath = path.join(root, 'data', 'media-index.json');
  let index = {};
  if (fs.existsSync(indexPath)) index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  const offlineFile = path.join(root, 'data', 'offline-audio.json');
  const offlineAudio = fs.existsSync(offlineFile) && JSON.parse(fs.readFileSync(offlineFile, 'utf8')).complete === true;
  const verified = new Set();
  const pending = new Map();
  return async function resolveMedia(id) {
    if (!Object.hasOwn(index, id)) return { file: await safeStatic(mediaDir, id), mime: undefined };
    const entry = index[id];
    if (!entry || !publicCdn(entry.url) || !MEDIA_MIMES.has(entry.mime)) throw new AppError('媒体索引无效', 400);
    const file = path.join(mediaDir, `${createHash('sha256').update(id).digest('hex')}.cache`);
    if (fs.existsSync(file) && entry.sha256 && !verified.has(id)) {
      const bytes = await fs.promises.readFile(file);
      if ((entry.fileSize && bytes.length !== entry.fileSize) || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new AppError('离线媒体校验失败，请运行下载工具补齐后重试。', 422);
      verified.add(id);
    }
    if (!fs.existsSync(file)) {
      if (offlineAudio && entry.mime.startsWith('audio/')) throw new AppError('这段离线音频缺失，请运行“下载听力音频.cmd”补齐后重试。', 404);
      if (!pending.has(id)) {
        pending.set(id, (async () => {
          await fs.promises.mkdir(mediaDir, { recursive: true });
          let url = entry.url, response;
          const signal = AbortSignal.timeout(45000);
          for (let redirects = 0; redirects < 3; redirects++) {
            response = await fetch(url, { redirect: 'manual', signal });
            if (![301, 302, 303, 307, 308].includes(response.status)) break;
            const location = new URL(response.headers.get('location') || '', url).href;
            await response.body?.cancel();
            if (!publicCdn(location)) throw new AppError('媒体下载重定向不受支持', 502);
            url = location;
          }
          if (!response?.ok || !response.body) { await response?.body?.cancel(); throw new AppError('原题媒体暂时无法获取，请检查网络后重试', 502); }
          const max = 100 * 1024 * 1024;
          if (Number(response.headers.get('content-length')) > max) { await response.body.cancel(); throw new AppError('媒体文件过大', 502); }
          const tmp = `${file}.${randomUUID()}.tmp`, hash = createHash('sha256'); let count = 0;
          try {
            const meter = new Transform({ transform(chunk, encoding, callback) { count += chunk.length; if (count > max) { callback(new AppError('媒体文件过大', 502)); return; } hash.update(chunk); callback(null, chunk); } });
            await pipeline(Readable.fromWeb(response.body), meter, fs.createWriteStream(tmp, { flags: 'wx' }), { signal });
            const digest = hash.digest('hex');
            if (entry.sha256 && entry.sha256.toLowerCase() !== digest) throw new AppError('媒体校验未通过，请重试', 502);
            await fs.promises.rename(tmp, file);
          } finally { if (fs.existsSync(tmp)) await fs.promises.unlink(tmp); }
        })().finally(() => pending.delete(id)));
      }
      try { await pending.get(id); }
      catch (e) {
        if (e instanceof AppError) throw e;
        const code = e.cause?.code || e.code;
        if (code === 'EACCES' || code === 'EPERM') throw new AppError('本地服务的联网权限受限，请退出托盘中的学习服务，再双击程序重新启动。', 502);
        throw new AppError('原题媒体暂时无法获取，请检查网络后重试', 502);
      }
    }
    return { file, mime: entry.mime };
  };
}

export function createApp({ root = HERE, port = 47321, engine } = {}) {
  const study = engine || new StudyEngine({ bankPath: path.join(root, 'data', 'bank.json'), statePath: path.join(root, 'data', 'progress.json') });
  const resolveMedia = mediaCache(root);
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; media-src 'self' https:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    const boundPort = server.address()?.port || port;
    const hosts = new Set([`127.0.0.1:${boundPort}`, `localhost:${boundPort}`]);
    const origins = new Set([`http://127.0.0.1:${boundPort}`, `http://localhost:${boundPort}`]);
    try {
      if (!hosts.has(req.headers.host)) throw new AppError('仅支持本机访问', 403);
      if (req.headers.origin && !origins.has(req.headers.origin)) throw new AppError('请求来源无效', 403);
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('请求来源无效', 403);
      let url;
      try { url = new URL(req.url, `http://127.0.0.1:${boundPort}`); } catch { throw new AppError('请求地址无效'); }
      const pathname = decodeURIComponent(url.pathname), method = req.method;
      if (!['GET', 'HEAD', 'POST'].includes(method)) throw new AppError('请求方法不受支持', 405);
      if (pathname === '/api/health' && method === 'GET') { json(res, 200, { ok: true, app: 'jlpt-desk', questions: study.bank.questions.length, version: '1.2.2' }); return; }
      if (pathname === '/api/offline-status' && method === 'GET') {
        const file = path.join(root, 'data', 'offline-audio.json');
        json(res, 200, fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { complete: false }); return;
      }
      if (pathname === '/api/catalog' && method === 'GET') { json(res, 200, study.catalog(url.searchParams.get('level') || 'N2')); return; }
      if (pathname === '/api/sessions' && method === 'POST') { json(res, 201, study.createSession(await body(req))); return; }
      const sessionRoute = /^\/api\/sessions\/([^/]+)(?:\/(answer|checkpoint|finish|next-section|start-listening|pause-listening|resume-listening|pause-focus|resume-focus))?$/.exec(pathname);
      if (sessionRoute) {
        const [, id, action] = sessionRoute;
        if (!action && method === 'GET') { json(res, 200, study.getSession(id)); return; }
        if (method !== 'POST') throw new AppError('请求方法不受支持', 405);
        if (action === 'answer') json(res, 200, study.answer(id, await body(req)));
        else if (action === 'checkpoint') json(res, 200, study.checkpoint(id, await body(req)));
        else if (action === 'finish') { await body(req); json(res, 200, study.finish(id)); }
        else if (action === 'next-section') { await body(req); json(res, 200, study.nextSection(id)); }
        else if (action === 'start-listening') { await body(req); json(res, 200, study.startListening(id)); }
        else if (action === 'pause-listening') { await body(req); json(res, 200, study.pauseListening(id)); }
        else if (action === 'resume-listening') { await body(req); json(res, 200, study.resumeListening(id)); }
        else if (action === 'pause-focus') json(res, 200, study.pauseExamFocus(id, await body(req)));
        else if (action === 'resume-focus') { await body(req); json(res, 200, study.resumeExamFocus(id)); }
        else throw new AppError('接口不存在', 404);
        return;
      }
      if (pathname === '/api/favorites' && method === 'POST') { const input = await body(req); json(res, 200, study.favorite(input.questionId)); return; }
      if (pathname === '/api/review' && method === 'GET') { json(res, 200, study.review(url.searchParams.get('kind') || 'wrong', url.searchParams.get('level') || 'N2')); return; }
      if (pathname === '/api/history' && method === 'GET') { json(res, 200, study.history(url.searchParams.get('level') || 'N2')); return; }
      if (pathname === '/api/export' && method === 'GET') { json(res, 200, study.exportState(), { 'Content-Disposition': 'attachment; filename="jlpt-desk-backup.json"' }); return; }
      if (pathname === '/api/reset-progress') {
        if (method !== 'POST') throw new AppError('请求方法不受支持', 405);
        json(res, 200, study.resetProgress(await body(req))); return;
      }
      if (pathname === '/api/import' && method === 'POST') { json(res, 200, study.importBank(await body(req))); return; }
      if (pathname === '/api/restore' && method === 'POST') { json(res, 200, study.restore(await body(req))); return; }
      if (pathname.startsWith('/api/')) throw new AppError('接口不存在', 404);
      if (!['GET', 'HEAD'].includes(method)) throw new AppError('请求方法不受支持', 405);
      if (pathname.startsWith('/media/')) {
        const id = pathname.slice(7);
        if (!id || id.includes('..') || id.includes('\\') || id.startsWith('/')) throw new AppError('媒体路径无效');
        const media = await resolveMedia(id); await serveFile(req, res, media.file, media.mime); return;
      }
      const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
      if (!relative || relative.includes('\\') || relative.split('/').some(p => p.startsWith('.') || p === '..')) throw new AppError('路径无效', 403);
      const file = await safeStatic(path.join(root, 'public'), relative);
      await serveFile(req, res, file);
    } catch (e) {
      if (res.headersSent) { if (!res.writableEnded) res.destroy(); return; }
      const status = e instanceof AppError ? e.status : e instanceof URIError ? 400 : 500;
      if (status === 500) console.error(e);
      json(res, status, { error: status === 500 ? '本地服务处理失败，请重试或查看日志' : e instanceof URIError ? '请求地址编码无效' : e.message });
    }
  });
  return { server, engine: study };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.JLPT_PORT || 47321);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('JLPT_PORT 无效');
  const { server } = createApp({ port });
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被使用，请关闭旧窗口或使用已启动的应用。` : error); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => console.log(`JLPT Desk ready: http://127.0.0.1:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
