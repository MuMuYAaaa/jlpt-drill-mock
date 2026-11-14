# 本地数据目录

源码仓库只保留数据格式说明和最小示例。

- `bank.json`：运行时题库，默认被 `.gitignore` 排除。请导入你有权使用的题库。
- `media-index.json`：题图/音频资源索引，默认被 `.gitignore` 排除；可由本地导入或下载流程生成。
- `offline-audio.json`：本地音频校验状态，默认被 `.gitignore` 排除。
- `progress.json`：本机学习记录，永远不应提交到公共仓库。

题库最小格式见 [`bank.sample.json`](./bank.sample.json)。完整题库、题图和音频可能受到原应用或内容提供方的权利限制，请先确认授权再分发。
