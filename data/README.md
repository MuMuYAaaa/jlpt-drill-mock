# 本地数据目录

运行 `npm run setup-data`，即可从仓库的 `resources/` 初始化完整题库与媒体索引。已有文件会保留。

- `bank.json`：运行时题库，默认被 `.gitignore` 排除；可从仓库的压缩资源恢复。
- `media-index.json`：题图/音频资源索引，默认被 `.gitignore` 排除；可从仓库资源复制。
- `offline-audio.json`：本地音频校验状态，默认被 `.gitignore` 排除。
- `progress.json`：本机学习记录，永远不应提交到公共仓库。

题库最小格式见 [`bank.sample.json`](./bank.sample.json)。来源与许可范围见 [`THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md)。
