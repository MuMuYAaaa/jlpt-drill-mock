# 功能重建记录

分析日期：2026-11-13（Asia/Shanghai）。目标来自用户明确指定的本机雷电模拟器，并由已配置的 mt MCP 服务器确认。

## 身份与证据边界

- MT `mt_apk_list_installed_apps` 返回唯一目标：无痛日语，`tech.xiangzi.painlessjp`，版本 2.2.0 / versionCode 29；base APK 284,129,240 bytes，无 split。
- MT 已打开可复用只读分析工作区 `7fptcnm2`；未修改或重新安装原 APK。
- `mt_apk_list_entries` 返回 Flutter assets、本地 N1–N5 SQLite 题库、听力索引；`lib/arm64-v8a/libapp.so` 为 Dart AOT 业务层。普通 DEX 的 exam 搜索仅触及插件，未把它误当业务实现。
- 原始数据库文件大小和 SHA-256 在 evidence/import-report.json。界面证据为 evidence 内原应用截图和 uiautomator XML。MT 导出到允许的 Home 路径，再经本机 ADB 拉取到分析目录。

本次使用 MT 工具的原始结构化返回和本地文件作为证据，未产生 REA Evidence ID，不虚构静态函数调用轨迹。native 字符串只作为调查线索，实际操作才作为运行时行为证据。

## 已观察并实现

| 原功能 | 证据 | PC 实现 |
| --- | --- | --- |
| N1–N5 等级与专项入口 | jlpt-home.png / jlpt-lower.png / mock-options.png | 顶部等级切换、专项练习 |
| 文字词汇、语法、阅读、听力细分 | 同上；question.question_type 列 | 按题型数量和类别筛选 |
| 点击专项直接练习 | practice-settings.png / .xml | 可配置数量、随机或顺序 |
| 选择立即显示对错、正确答案 | practice-result.png / .xml | 反馈、中文解析、错题记录 |
| 收藏和错题入口 | mock-options.png | 收藏夹、错题本与针对复习 |
| 按年份试卷模考列表 | mock-list.png / .xml；exam_paper 表 | 115 套本地试卷列表 |
| 模考分科时间与答题卡 | mock-intro.png / .xml；exam_section.duration_seconds | 服务器计时、切科、标记、答题卡、交卷 |
| 本地会话、作答、进度和错题记录 | libapp.so 的 jlpt_exam_session / jlpt_practice_attempt / savePracticeCheckpoint 等静态字符串，仅证明结构线索 | 独立 progress.json 原子保存、断点续做和备份 |

本地题目数据的规范化导入未复制原业务源代码、界面图标、品牌或字体。PC 程序界面和逻辑为独立实现，数据仅取自用户指定安装包中已有的本地资源；媒体仅按已有索引请求公开 CDN。

## 数据内容

`exam_paper → exam_section → question_group → question` 是试卷和题组关系；`question_group.material_id` 连接阅读材料，instruction_material_id 连接说明。question 的答案为 JSON answer_index（零基），PC 规范化为字符串选项 1–4。素材文档为 paragraphs / containers / tables / images；保留下划线和注音，去掉词法检索元数据以减小体积。

听力通过 section.audio_plan_json 中的 question_ids 对应 audio_id。全量核对表明 3,485 道听力全部有明确计划项，无需 group_id 备用匹配；PC 与原库对应 3,485/3,485 一致。全部 3,396 个独立音频已下载，大小共 1,797,858,448 字节，逐个与原库 SHA-256 和 file_size 一致；MP3 帧解析时长也全部与 duration_ms 相符。完整离线模式只读本机 /media/:id 并支持 HTTP Range，缺失或损坏时明确报错，不再自动向 CDN 请求听力。原文和译文放在交卷/答题后解析中，避免考试前泄露。

31,016 条题目和素材的压缩载荷全部通过 gzip CRC 和 JSON 结构校验；256,584 个段落的文本 SHA-256 与原记录 text_hash 逐一重算，零不匹配。AES-GCM 本地 key/nonce 的内容解码成功，附加认证数据 AAD 尚未完全恢复，因此不声称通过 GCM tag 校验；独立核验记录在 evidence/format-report.json。安装包数据内容中的 AI 解析质量标记是原数据元信息，未被当作答案正确性保证。

## 差异和未知

- 模考和练习结果提供参考总分、文字词汇（含语法）/阅读/听力三项分数及正确率；按使用者提供的 N2 表格权重计算并应用到 N1–N5，各项按实际题量换算为 60 分，旧记录自动补算。规则见 docs/SCORING.md；本版未把练习参考分当官方 JLPT 等化分，也未实现全国排名。
- 专项练习按题播放；模考已按原应用 audio_plan 连续播放，含听力前 10 分钟休息、原音轨间隔、暂停恢复和末尾作答时间后交卷。原计划明确部分间隔属于推算，未将其称为官方考试时间。证据和验收见 EXAM_LISTENING_SPEC.md。
- 未实现原应用账号/云同步、付费、背单词、词典、桌面卡片等本次需求以外的功能。
- 全部听力的文件身份、题目映射、大小、SHA-256 与 MP3 时长已核验；未进行全部录音的独立语音识别或逐段人工试听。89组共享录音中64组是同题组多题，25组是原库跨试卷复用；后者原文相同或近似。发现一组原库答案分歧，涉及两题，已标记待核，详见 evidence/audio-answer-conflicts.json。没有擅自改写原答案。

## 校验

后端核心测试覆盖：即时判题与重复请求幂等、错题复习、收藏、考试答案隐藏、分科截止/跨科限制、关闭页面后时间追赶、漏答/交卷统计、持久化/备份、题库导入事务和旧会话快照、本机同源/文件边界/音频 Range。端到端界面验证和媒体实测结果另见 evidence/verification.json。
