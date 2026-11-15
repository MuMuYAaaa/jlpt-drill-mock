# Contributing

感谢你参与日语研习室。仓库包含应用源码、压缩题库和媒体索引；完整听力与 Windows 运行环境通过 Release 提供。

## 开发环境

- Windows 10/11 x64
- Node.js 24.15 或更高版本；运行时可执行文件不在 Git 仓库中
- Microsoft Edge（用于独立应用窗口和全屏模考验收）

运行 `npm run setup-data` 初始化完整题库；也可在应用的数据页导入兼容 JSON。资源来源说明见 `THIRD_PARTY_NOTICES.md`。

运行检查：

```powershell
npm test
```

涉及浏览器行为的验收脚本需要本机 Edge、Playwright 和本地听力。运行 `npm install --no-save playwright` 准备浏览器测试依赖；从 Release 的完整 ZIP 复制 `media/`，或运行 `npm run download-audio`。

提交代码时请不要加入 `data/progress.json`、`media/`、`evidence/`、`runtime/node.exe`、安装包或个人备份。
