# Contributing

感谢你参与日语研习室。这个仓库发布的是本地学习工具的源码；题库文本、题图、音频和运行时二进制不属于公开源码仓库的默认内容。

## 开发环境

- Windows 10/11 x64
- Node.js 24 或仓库随附的 `runtime/node.exe`
- Microsoft Edge（用于独立应用窗口和全屏模考验收）

复制 `data/bank.sample.json` 为你自己的题库文件，或在应用的数据页导入兼容 JSON。完整题库和音频请只使用你拥有发布权的资源。

运行检查：

```powershell
node --test test/engine.test.mjs test/exam-listening.test.mjs test/exam-focus.test.mjs test/reset-progress.test.mjs
```

涉及浏览器行为的验收脚本需要本机 Edge 和完整的本地题库/媒体资源；缺少这些资源时，运行引擎测试和导入格式测试即可。

提交代码时请不要加入 `data/progress.json`、`media/`、`evidence/`、`runtime/node.exe`、安装包或个人备份。
