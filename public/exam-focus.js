(function (global) {
  'use strict';
  // Browser fullscreen is a focus aid. Windows shortcuts and browser escape controls remain available.
  class ExamFocusController {
    constructor(callbacks = {}) {
      this.callbacks = callbacks;
      this.id = null; this.locked = false; this.pending = null; this.pauseConfirmed = false; this.revision = 0;
      this.overlay = document.getElementById('exam-focus-overlay');
      this.bar = document.getElementById('exam-focus-bar');
      document.addEventListener('fullscreenchange', () => {
        if (this.id && !document.fullscreenElement) this.interrupt('fullscreen');
      });
      document.addEventListener('visibilitychange', () => {
        if (this.id && document.hidden) this.interrupt('hidden');
      });
      window.addEventListener('blur', () => { if (this.id) this.interrupt('blur'); });
      document.addEventListener('keydown', event => {
        if (!this.id) return;
        if (event.key === 'F11' || (event.key === 'Escape' && !document.querySelector('dialog[open]')) ||
          (event.altKey && ['ArrowLeft','ArrowRight'].includes(event.key)) ||
          ((event.ctrlKey || event.metaKey) && ['r','w','l'].includes(event.key.toLowerCase()))) event.preventDefault();
      }, true);
    }
    async enterFullscreen() {
      if (!document.fullscreenElement) {
        if (!document.fullscreenEnabled || !document.documentElement.requestFullscreen) throw new Error('当前窗口不支持全屏考试，请使用随程序启动的 Edge 窗口。');
        try { await document.documentElement.requestFullscreen({navigationUI:'hide'}); }
        catch { throw new Error('未能进入全屏，请点击开始考试重试。'); }
      }
    }
    isFocused() { return !!document.fullscreenElement && !document.hidden && document.hasFocus(); }
    configure(session) {
      if (session?.mode !== 'exam' || session.status !== 'active') { this.release(); return; }
      if (this.id !== session.id) {
        this.id = session.id; this.locked = false; this.pauseConfirmed = false; this.reason = ''; this.error = ''; this.revision++;
      }
      document.body.classList.add('exam-focus-mode');
      if (session.focus?.paused) {
        this.locked = true; this.pauseConfirmed = true; this.reason ||= session.focus.reason;
      }
      if (!this.isFocused()) this.interrupt(document.hidden ? 'hidden' : !document.fullscreenElement ? 'fullscreen' : 'blur');
      this.paint();
    }
    paint() {
      this.bar.hidden = !this.id;
      this.overlay.hidden = !this.id || !this.locked;
      document.querySelector('.app-shell').inert = !!this.id && this.locked;
      if (!this.id) return;
      const messages = {fullscreen:'检测到退出全屏', hidden:'检测到切换页面', blur:'检测到切换窗口', navigation:'考试中不能离开考场', refresh:'考试页面已重新打开'};
      document.getElementById('exam-focus-reason').textContent = messages[this.reason] || '请恢复全屏考场';
      document.getElementById('exam-focus-status').textContent = this.error || (this.pending ? '正在保存暂停位置…' : this.pauseConfirmed ? '计时与听力已暂停，已答内容已保存。' : '正在连接本地服务，恢复后将校准考试进度。');
      document.getElementById('exam-focus-resume').disabled = !!this.restoring;
    }
    interrupt(reason = 'fullscreen') {
      if (!this.id) return Promise.resolve();
      if (!this.locked || this.restoring) this.revision++;
      const first = !this.locked;
      this.locked = true; this.reason = reason;
      if (first) this.callbacks.onFreeze?.();
      if (!this.pending && !this.pauseConfirmed) {
        const id = this.id;
        this.pending = Promise.resolve().then(() => this.callbacks.onInterrupt(id, reason))
          .then(() => { if (this.id === id) { this.pauseConfirmed = true; this.error = ''; } })
          .catch(error => { if (this.id === id) this.error = '暂停保存未完成：' + error.message + '。请点击恢复重试。'; })
          .finally(() => { if (this.id === id) { this.pending = null; this.paint(); } });
      }
      this.paint();
      return this.pending || Promise.resolve();
    }
    async resume() {
      if (!this.id || this.restoring) return;
      this.restoring = true; this.error = ''; this.paint();
      const id = this.id;
      try {
        // Must run in the original click handler to retain browser user activation.
        await this.enterFullscreen();
        if (!this.isFocused()) throw new Error('请将考试窗口置于前台后重试。');
        await this.interrupt(this.reason || 'fullscreen');
        if (!this.pauseConfirmed) throw new Error('尚未保存暂停状态，请检查本地服务后重试。');
        const revision = this.revision;
        const session = await this.callbacks.onResume(id);
        if (id !== this.id) return;
        if (revision !== this.revision || !this.isFocused()) {
          this.pauseConfirmed = false;
          await this.interrupt(document.hidden ? 'hidden' : 'blur');
          return;
        }
        this.locked = false; this.pauseConfirmed = false; this.reason = ''; this.paint();
        this.callbacks.onRestored(session);
      } catch (error) { this.error = error.message; }
      finally { this.restoring = false; this.paint(); }
    }
    release(force = false) {
      const active = !!this.id;
      this.id = null; this.locked = false; this.pauseConfirmed = false; this.pending = null; this.revision++;
      document.body.classList.remove('exam-focus-mode'); this.paint();
      if ((active || force) && document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
  }
  global.ExamFocusController = ExamFocusController;
})(window);
