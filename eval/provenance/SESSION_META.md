# 会话元数据摘录

由 `extract_session_meta.py` 从私有的会话导出文件**只抽取元数据**生成：模型字段、推理档位、时间范围、`git commit` 调用的时间、对指定文件的调用时间。
**不包含对话文字、命令或工具参数。** 导出原文在仓库之外（`~/.omniguard_custody/provenance_exports/`），含疑似密钥的行，不提交。哈希是原文的 SHA-256。

## 1. 各文件

| 文件 | 工具 | 起止（UTC） | 模型字段（来源：值×次数） | 推理档位 | SHA-256 |
|---|---|---|---|---|---|
| `1a90b852-9f2f-4ce6-a641-7d7b4fa19705.jsonl` | claude | 2026-11-04T03:49:16Z 至 2026-11-04T03:50:09Z | message.model: <synthetic>×1 | 未记录 | `0f2268ea965d…` |
| `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl` | claude | 2026-11-05T14:31:17Z 至 2026-11-21T10:42:45Z | message.model: claude-sonnet-5-5×2437、<synthetic>×2 | effort: medium×2437 | `745d1f614687…` |
| `6c9e41e0-2fcc-4415-b42d-258558b32c3b.jsonl` | claude | 2026-11-16T15:56:39Z 至 2026-11-17T03:40:19Z | message.model: claude-sonnet-5-5×241、claude-fable-5-2×89 | effort: medium×330 | `1b17ede4811f…` |
| `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl` | claude | 2026-11-21T05:57:45Z 至 2026-11-21T14:13:38Z | message.model: claude-sonnet-5-5×551 | effort: medium×551 | `bd7cdc7d1483…` |
| `transcript.jsonl` | antigravity | 2026-11-07T12:37:53Z 至 2026-11-21T07:03:15Z | model: gemini-3.8-flash-high×391 | 未记录 | `9f01e28bda73…` |
| `transcript_full.jsonl` | antigravity | 2026-11-07T12:37:53Z 至 2026-11-21T07:03:15Z | model: gemini-3.8-flash-high×391 | 未记录 | `f415e58d9474…` |
| `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b03-8310-040b17a3112a.jsonl` | codex | 2026-11-07T03:30:11Z 至 2026-11-21T10:49:31Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×168 | turn_context.effort: medium×160、high×8 | `f11bb164570f…` |
| `rollout-2026-11-07T18-55-23-01a1b5a6-1601-7a33-87f2-6c54cd4b80e4.jsonl` | codex | 2026-11-07T10:55:23Z 至 2026-11-07T11:08:38Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×5 | turn_context.effort: medium×5 | `b2af8f822d9a…` |
| `rollout-2026-11-07T18-55-54-01a1b5a6-9020-7ac0-b609-8354a976e6b7.jsonl` | codex | 2026-11-07T10:55:54Z 至 2026-11-07T11:07:04Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×3 | turn_context.effort: medium×3 | `b6d678f4418b…` |
| `rollout-2026-11-07T19-07-15-01a1b5b0-f633-71c3-8380-f0cbb5f4d53b.jsonl` | codex | 2026-11-07T11:07:15Z 至 2026-11-07T11:09:32Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×2 | turn_context.effort: medium×2 | `60aae7923366…` |
| `rollout-2026-11-15T13-57-18-01a1ddc8-1054-7c93-825b-61def4c4bd7b.jsonl` | codex | 2026-11-15T05:57:18Z 至 2026-11-15T06:56:40Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×3 | turn_context.effort: medium×3 | `1b9ae6779653…` |
| `rollout-2026-11-15T15-40-24-01a1de26-75cb-7ad1-890f-ee3abd927354.jsonl` | codex | 2026-11-15T07:40:25Z 至 2026-11-15T08:56:53Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×8 | turn_context.effort: medium×8 | `11d0548cdd4c…` |
| `rollout-2026-11-15T17-18-34-01a1de80-54cd-7900-b9f8-1f2f4251ed0a.jsonl` | codex | 2026-11-15T09:18:34Z 至 2026-11-15T09:31:05Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×2 | turn_context.effort: medium×2 | `bdc553950c89…` |
| `rollout-2026-11-15T18-37-35-01a1dec8-aa9a-75b0-86a4-ad7188452128.jsonl` | codex | 2026-11-15T10:37:35Z 至 2026-11-15T11:04:05Z | session_meta.provenance.model: gpt-6-astra×1；turn_context.model: gpt-6.1-sol×2 | turn_context.effort: medium×2 | `35f5a75dcb1a…` |

## 2. 对指定文件的调用（只列次数与首末时间）

| 文件 | 会话 | 写入类工具 | 命令中提到 |
|---|---|---|---|
| `validate_rationales.py` | `529ff251-f2a2-4725-b429-02cf281f1f46.jso` | 2 次，2026-11-15T10:45:33Z 至 2026-11-15T10:46:07Z | 8 次，2026-11-15T10:46:08Z 至 2026-11-21T06:54:28Z |
| `router_v2/rules.py` | `529ff251-f2a2-4725-b429-02cf281f1f46.jso` | — | 19 次，2026-11-07T09:39:27Z 至 2026-11-16T02:26:28Z |
| `router_v2/pipeline.py` | `529ff251-f2a2-4725-b429-02cf281f1f46.jso` | — | 24 次，2026-11-07T09:39:36Z 至 2026-11-16T02:26:28Z |
| `router_v2/prompt.py` | `529ff251-f2a2-4725-b429-02cf281f1f46.jso` | — | 14 次，2026-11-07T09:38:48Z 至 2026-11-16T02:26:28Z |
| `r3.py` | `529ff251-f2a2-4725-b429-02cf281f1f46.jso` | — | 23 次，2026-11-09T01:27:14Z 至 2026-11-21T07:03:08Z |
| `validate_rationales.py` | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jso` | — | 5 次，2026-11-21T06:51:00Z 至 2026-11-21T13:12:21Z |
| `router_v2/rules.py` | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jso` | — | 5 次，2026-11-21T11:34:18Z 至 2026-11-21T13:23:10Z |
| `router_v2/pipeline.py` | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jso` | — | 3 次，2026-11-21T13:02:19Z 至 2026-11-21T13:22:57Z |
| `r3.py` | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jso` | — | 3 次，2026-11-21T12:06:07Z 至 2026-11-21T13:12:21Z |
| `validate_rationales.py` | `transcript.jsonl` | — | 9 次，2026-11-15T10:46:17Z 至 2026-11-21T06:53:18Z |
| `router_v2/rules.py` | `transcript.jsonl` | — | 3 次，2026-11-09T05:41:58Z 至 2026-11-09T14:16:02Z |
| `router_v2/pipeline.py` | `transcript.jsonl` | — | 1 次，2026-11-09T12:00:36Z 至 2026-11-09T12:00:36Z |
| `r3.py` | `transcript.jsonl` | — | 1 次，2026-11-15T07:11:37Z 至 2026-11-15T07:11:37Z |
| `validate_rationales.py` | `transcript_full.jsonl` | — | 9 次，2026-11-15T10:46:17Z 至 2026-11-21T06:53:18Z |
| `router_v2/rules.py` | `transcript_full.jsonl` | — | 4 次，2026-11-09T05:41:58Z 至 2026-11-09T14:16:02Z |
| `router_v2/pipeline.py` | `transcript_full.jsonl` | — | 1 次，2026-11-09T12:00:36Z 至 2026-11-09T12:00:36Z |
| `r3.py` | `transcript_full.jsonl` | — | 1 次，2026-11-15T07:11:37Z 至 2026-11-15T07:11:37Z |
| `validate_rationales.py` | `rollout-2026-11-07T11-27-44-01a1b40c-345` | — | 15 次，2026-11-15T10:42:24Z 至 2026-11-21T10:47:54Z |
| `router_v2/rules.py` | `rollout-2026-11-07T11-27-44-01a1b40c-345` | — | 27 次，2026-11-08T09:59:32Z 至 2026-11-16T06:29:40Z |
| `router_v2/pipeline.py` | `rollout-2026-11-07T11-27-44-01a1b40c-345` | — | 23 次，2026-11-07T09:42:57Z 至 2026-11-17T05:33:21Z |
| `router_v2/prompt.py` | `rollout-2026-11-07T11-27-44-01a1b40c-345` | — | 11 次，2026-11-08T09:59:32Z 至 2026-11-10T08:29:02Z |
| `r3.py` | `rollout-2026-11-07T11-27-44-01a1b40c-345` | — | 6 次，2026-11-15T16:03:34Z 至 2026-11-21T06:40:33Z |

## 3. 提交与会话的对应

对每个 git 提交，找出在它之前 60 秒内发起 `git commit` 调用的会话。多个会话同时匹配时都列出，不替你选。

| 提交 | 提交时间 UTC | 匹配的会话文件 | 调用时间 | 间隔秒 |
|---|---|---|---|---|
| `5278e51` | 2026-11-06T13:56:40Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-06T13:56:39Z | 1 |
| `e1dbc5b` | 2026-11-07T03:18:28Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T03:18:28Z | 0 |
| `a58b125` | 2026-11-07T03:31:26Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T03:31:26Z | 0 |
| `d5ffbcb` | 2026-11-07T04:00:29Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:00:26Z | 3 |
| `dff902d` | 2026-11-07T04:16:54Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:16:52Z | 2 |
| `90e7138` | 2026-11-07T04:26:12Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:26:11Z | 1 |
| `588231e` | 2026-11-07T04:34:02Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:34:02Z | 0 |
| `6c0e976` | 2026-11-07T04:39:33Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:39:30Z | 3 |
| `fef3833` | 2026-11-07T04:43:21Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:43:18Z | 3 |
| `f5e0763` | 2026-11-07T04:47:29Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:47:27Z | 2 |
| `9cdad69` | 2026-11-07T04:56:34Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T04:56:33Z | 1 |
| `78906f0` | 2026-11-07T05:08:17Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T05:08:15Z | 2 |
| `bdb4738` | 2026-11-07T05:14:41Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T05:14:40Z | 1 |
| `c6852ca` | 2026-11-07T06:15:20Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:15:19Z | 1 |
| `ae539a6` | 2026-11-07T06:15:27Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:15:19Z | 8 |
| `ae539a6` | 2026-11-07T06:15:27Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:15:27Z | 0 |
| `6858b1f` | 2026-11-07T06:28:53Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:28:25Z | 28 |
| `1b6e09c` | 2026-11-07T06:36:33Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:36:32Z | 1 |
| `2ac27c6` | 2026-11-07T06:40:04Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:40:04Z | 0 |
| `35914f2` | 2026-11-07T06:46:16Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:46:14Z | 2 |
| `1fff109` | 2026-11-07T06:53:52Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T06:53:50Z | 2 |
| `a15c870` | 2026-11-07T07:09:47Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:09:45Z | 2 |
| `8cbe4d7` | 2026-11-07T07:18:34Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:18:32Z | 2 |
| `cecf8b4` | 2026-11-07T07:27:56Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:27:56Z | 0 |
| `993a0b0` | 2026-11-07T07:37:10Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:36:39Z | 31 |
| `acfdb5b` | 2026-11-07T07:43:20Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:42:49Z | 31 |
| `9848ac3` | 2026-11-07T07:50:53Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:50:52Z | 1 |
| `cf7345f` | 2026-11-07T07:53:50Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T07:53:48Z | 2 |
| `1accbd6` | 2026-11-07T08:01:09Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T08:01:07Z | 2 |
| `63a5ea8` | 2026-11-07T09:37:13Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T09:37:12Z | 1 |
| `01d4ce4` | 2026-11-07T09:41:50Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T09:41:47Z | 3 |
| `c6f85a2` | 2026-11-07T10:31:25Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T10:31:23Z | 2 |
| `6aa7824` | 2026-11-07T10:34:36Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T10:33:59Z | 37 |
| `2243bee` | 2026-11-07T10:40:01Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T10:39:23Z | 38 |
| `6181f27` | 2026-11-07T10:49:50Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T10:49:10Z | 40 |
| `4386a13` | 2026-11-07T10:56:34Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T10:56:34Z | 0 |
| `22eed2c` | 2026-11-07T10:59:15Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T10:59:04Z | 11 |
| `22eed2c` | 2026-11-07T10:59:15Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T10:59:15Z | 0 |
| `18528ca` | 2026-11-07T11:00:52Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:00:51Z | 1 |
| `3a06ebe` | 2026-11-07T11:02:07Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:02:07Z | 0 |
| `e6b2003` | 2026-11-07T11:04:07Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:04:07Z | 0 |
| `5e6d121` | 2026-11-07T11:07:09Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:07:08Z | 1 |
| `2bb0b9e` | 2026-11-07T11:08:13Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:08:13Z | 0 |
| `186049d` | 2026-11-07T11:10:53Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:10:53Z | 0 |
| `3fbf1ca` | 2026-11-07T11:22:53Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T11:22:51Z | 2 |
| `72f8793` | 2026-11-07T11:32:54Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T11:32:09Z | 45 |
| `fec6acf` | 2026-11-07T11:35:30Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T11:35:30Z | 0 |
| `e5a0b0e` | 2026-11-07T12:02:36Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-07T12:02:35Z | 1 |
| `509f4be` | 2026-11-07T12:13:42Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T12:13:40Z | 2 |
| `b59596a` | 2026-11-07T12:28:23Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T12:28:22Z | 1 |
| `3db72fa` | 2026-11-07T12:35:47Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T12:35:05Z | 42 |
| `5806966` | 2026-11-07T12:45:30Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T12:44:53Z | 37 |
| `4604b67` | 2026-11-07T12:47:04Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T12:46:19Z | 45 |
| `16e4b6c` | 2026-11-07T12:51:56Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T12:51:13Z | 43 |
| `bd46117` | 2026-11-07T14:37:26Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T14:37:25Z | 1 |
| `d0d536f` | 2026-11-07T15:07:34Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T15:07:32Z | 2 |
| `4fb4cde` | 2026-11-07T15:10:22Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T15:09:47Z | 35 |
| `a09fdd5` | 2026-11-07T15:12:34Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-07T15:11:59Z | 35 |
| `c765f79` | 2026-11-08T09:33:33Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-08T09:32:57Z | 36 |
| `b61ffc5` | 2026-11-08T10:11:25Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-08T10:11:25Z | 0 |
| `1ec769a` | 2026-11-09T01:29:53Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-09T01:29:53Z | 0 |
| `dbb6b90` | 2026-11-09T01:30:49Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-09T01:29:53Z | 56 |
| `dbb6b90` | 2026-11-09T01:30:49Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-09T01:30:47Z | 2 |
| `d5e20ec` | 2026-11-09T01:31:19Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-09T01:30:47Z | 32 |
| `d5e20ec` | 2026-11-09T01:31:19Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-09T01:31:17Z | 2 |
| `6866782` | 2026-11-09T01:38:11Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-09T01:38:09Z | 2 |
| `c823421` | 2026-11-09T16:49:53Z | `transcript.jsonl`（antigravity） | 2026-11-09T16:49:49Z | 4 |
| `c823421` | 2026-11-09T16:49:53Z | `transcript_full.jsonl`（antigravity） | 2026-11-09T16:49:49Z | 4 |
| `46e19dd` | 2026-11-10T04:23:11Z | `transcript.jsonl`（antigravity） | 2026-11-10T04:23:05Z | 6 |
| `46e19dd` | 2026-11-10T04:23:11Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T04:23:05Z | 6 |
| `3895efb` | 2026-11-10T04:29:57Z | `transcript.jsonl`（antigravity） | 2026-11-10T04:29:38Z | 19 |
| `3895efb` | 2026-11-10T04:29:57Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T04:29:38Z | 19 |
| `d99c46b` | 2026-11-10T06:10:50Z | `transcript.jsonl`（antigravity） | 2026-11-10T06:10:44Z | 6 |
| `d99c46b` | 2026-11-10T06:10:50Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T06:10:44Z | 6 |
| `d76c349` | 2026-11-10T10:07:59Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:07:44Z | 15 |
| `d76c349` | 2026-11-10T10:07:59Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:07:51Z | 8 |
| `d76c349` | 2026-11-10T10:07:59Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:07:44Z | 15 |
| `d76c349` | 2026-11-10T10:07:59Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:07:51Z | 8 |
| `a406d8e` | 2026-11-10T10:25:33Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:25:23Z | 10 |
| `a406d8e` | 2026-11-10T10:25:33Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:25:29Z | 4 |
| `a406d8e` | 2026-11-10T10:25:33Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:25:23Z | 10 |
| `a406d8e` | 2026-11-10T10:25:33Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:25:29Z | 4 |
| `9a9e1e4` | 2026-11-10T10:36:35Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:36:20Z | 15 |
| `9a9e1e4` | 2026-11-10T10:36:35Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:36:28Z | 7 |
| `9a9e1e4` | 2026-11-10T10:36:35Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:36:20Z | 15 |
| `9a9e1e4` | 2026-11-10T10:36:35Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:36:28Z | 7 |
| `2750930` | 2026-11-10T10:49:18Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:48:54Z | 24 |
| `2750930` | 2026-11-10T10:49:18Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:49:08Z | 10 |
| `2750930` | 2026-11-10T10:49:18Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:48:54Z | 24 |
| `2750930` | 2026-11-10T10:49:18Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:49:08Z | 10 |
| `43c6aca` | 2026-11-10T10:59:43Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:59:22Z | 21 |
| `43c6aca` | 2026-11-10T10:59:43Z | `transcript.jsonl`（antigravity） | 2026-11-10T10:59:32Z | 11 |
| `43c6aca` | 2026-11-10T10:59:43Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:59:22Z | 21 |
| `43c6aca` | 2026-11-10T10:59:43Z | `transcript_full.jsonl`（antigravity） | 2026-11-10T10:59:32Z | 11 |
| `879f969` | 2026-11-11T08:39:46Z | `transcript.jsonl`（antigravity） | 2026-11-11T08:39:22Z | 24 |
| `879f969` | 2026-11-11T08:39:46Z | `transcript.jsonl`（antigravity） | 2026-11-11T08:39:39Z | 7 |
| `879f969` | 2026-11-11T08:39:46Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T08:39:22Z | 24 |
| `879f969` | 2026-11-11T08:39:46Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T08:39:39Z | 7 |
| `c6dfc66` | 2026-11-11T08:56:09Z | `transcript.jsonl`（antigravity） | 2026-11-11T08:55:50Z | 19 |
| `c6dfc66` | 2026-11-11T08:56:09Z | `transcript.jsonl`（antigravity） | 2026-11-11T08:55:58Z | 11 |
| `c6dfc66` | 2026-11-11T08:56:09Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T08:55:50Z | 19 |
| `c6dfc66` | 2026-11-11T08:56:09Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T08:55:58Z | 11 |
| `0251bd5` | 2026-11-11T08:57:15Z | `transcript.jsonl`（antigravity） | 2026-11-11T08:56:49Z | 26 |
| `0251bd5` | 2026-11-11T08:57:15Z | `transcript.jsonl`（antigravity） | 2026-11-11T08:56:54Z | 21 |
| `0251bd5` | 2026-11-11T08:57:15Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T08:56:49Z | 26 |
| `0251bd5` | 2026-11-11T08:57:15Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T08:56:54Z | 21 |
| `a218eb1` | 2026-11-11T09:07:17Z | `transcript.jsonl`（antigravity） | 2026-11-11T09:07:02Z | 15 |
| `a218eb1` | 2026-11-11T09:07:17Z | `transcript.jsonl`（antigravity） | 2026-11-11T09:07:11Z | 6 |
| `a218eb1` | 2026-11-11T09:07:17Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T09:07:02Z | 15 |
| `a218eb1` | 2026-11-11T09:07:17Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T09:07:11Z | 6 |
| `57211b8` | 2026-11-11T13:10:59Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-11T13:10:58Z | 1 |
| `820d2b3` | 2026-11-11T13:40:52Z | `transcript.jsonl`（antigravity） | 2026-11-11T13:40:18Z | 34 |
| `820d2b3` | 2026-11-11T13:40:52Z | `transcript.jsonl`（antigravity） | 2026-11-11T13:40:47Z | 5 |
| `820d2b3` | 2026-11-11T13:40:52Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T13:40:18Z | 34 |
| `820d2b3` | 2026-11-11T13:40:52Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T13:40:47Z | 5 |
| `b45da92` | 2026-11-11T14:41:38Z | `transcript.jsonl`（antigravity） | 2026-11-11T14:41:12Z | 26 |
| `b45da92` | 2026-11-11T14:41:38Z | `transcript.jsonl`（antigravity） | 2026-11-11T14:41:25Z | 13 |
| `b45da92` | 2026-11-11T14:41:38Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T14:41:12Z | 26 |
| `b45da92` | 2026-11-11T14:41:38Z | `transcript_full.jsonl`（antigravity） | 2026-11-11T14:41:25Z | 13 |
| `02c5653` | 2026-11-15T03:31:37Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T03:31:37Z | 0 |
| `6682bdb` | 2026-11-15T03:32:28Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T03:31:37Z | 51 |
| `6682bdb` | 2026-11-15T03:32:28Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T03:32:26Z | 2 |
| `ea525e4` | 2026-11-15T03:35:49Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T03:35:48Z | 1 |
| `b8d3c59` | 2026-11-15T03:39:56Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T03:39:55Z | 1 |
| `2d30b0e` | 2026-11-15T04:10:12Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:10:11Z | 1 |
| `28dfaa7` | 2026-11-15T04:20:11Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:19:51Z | 20 |
| `75e8bf4` | 2026-11-15T04:21:19Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:21:18Z | 1 |
| `b95bffb` | 2026-11-15T04:22:56Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:22:56Z | 0 |
| `8476cb8` | 2026-11-15T04:40:04Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:39:18Z | 46 |
| `f6d0e56` | 2026-11-15T04:42:40Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:42:40Z | 0 |
| `a35bbb4` | 2026-11-15T04:46:45Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:46:04Z | 41 |
| `9a7c739` | 2026-11-15T04:50:13Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T04:50:12Z | 1 |
| `7c0a751` | 2026-11-15T05:27:07Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T05:27:06Z | 1 |
| `c7eb5b3` | 2026-11-15T05:37:31Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T05:37:31Z | 0 |
| `b537c67` | 2026-11-15T05:45:30Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T05:44:47Z | 43 |
| `510538a` | 2026-11-15T05:55:11Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T05:54:30Z | 41 |
| `69b8a07` | 2026-11-15T06:04:15Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T06:03:33Z | 42 |
| `b6d6413` | 2026-11-15T06:24:35Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T06:23:53Z | 42 |
| `d55fc1e` | 2026-11-15T06:34:46Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T06:34:04Z | 42 |
| `a6ba4aa` | 2026-11-15T07:12:30Z | `transcript.jsonl`（antigravity） | 2026-11-15T07:11:55Z | 35 |
| `a6ba4aa` | 2026-11-15T07:12:30Z | `transcript.jsonl`（antigravity） | 2026-11-15T07:12:23Z | 7 |
| `a6ba4aa` | 2026-11-15T07:12:30Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T07:11:55Z | 35 |
| `a6ba4aa` | 2026-11-15T07:12:30Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T07:12:23Z | 7 |
| `494c9c4` | 2026-11-15T07:35:38Z | `transcript.jsonl`（antigravity） | 2026-11-15T07:35:29Z | 9 |
| `494c9c4` | 2026-11-15T07:35:38Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T07:35:29Z | 9 |
| `ae418af` | 2026-11-15T08:22:11Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T08:21:50Z | 21 |
| `cc36590` | 2026-11-15T08:22:11Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T08:21:50Z | 21 |
| `0512192` | 2026-11-15T08:38:47Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T08:38:25Z | 22 |
| `f0b8104` | 2026-11-15T08:47:39Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T08:47:18Z | 21 |
| `e40a8e5` | 2026-11-15T09:00:46Z | `transcript.jsonl`（antigravity） | 2026-11-15T09:00:37Z | 9 |
| `e40a8e5` | 2026-11-15T09:00:46Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T09:00:37Z | 9 |
| `ad8e5f8` | 2026-11-15T09:05:48Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T09:05:47Z | 1 |
| `7196512` | 2026-11-15T09:15:38Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T09:15:17Z | 21 |
| `5312610` | 2026-11-15T09:24:07Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T09:23:25Z | 42 |
| `ee853c0` | 2026-11-15T09:50:11Z | `transcript.jsonl`（antigravity） | 2026-11-15T09:49:55Z | 16 |
| `ee853c0` | 2026-11-15T09:50:11Z | `transcript.jsonl`（antigravity） | 2026-11-15T09:50:01Z | 10 |
| `ee853c0` | 2026-11-15T09:50:11Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T09:49:55Z | 16 |
| `ee853c0` | 2026-11-15T09:50:11Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T09:50:01Z | 10 |
| `887f606` | 2026-11-15T10:07:46Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T10:07:23Z | 23 |
| `887f606` | 2026-11-15T10:07:46Z | `transcript.jsonl`（antigravity） | 2026-11-15T10:07:42Z | 4 |
| `887f606` | 2026-11-15T10:07:46Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T10:07:42Z | 4 |
| `567219a` | 2026-11-15T10:36:32Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T10:35:50Z | 42 |
| `b8a49cb` | 2026-11-15T10:45:13Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T10:44:30Z | 43 |
| `b8a49cb` | 2026-11-15T10:45:13Z | `transcript.jsonl`（antigravity） | 2026-11-15T10:44:59Z | 14 |
| `b8a49cb` | 2026-11-15T10:45:13Z | `transcript_full.jsonl`（antigravity） | 2026-11-15T10:44:59Z | 14 |
| `98403f7` | 2026-11-15T10:47:16Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T10:47:15Z | 1 |
| `a65eb62` | 2026-11-15T11:44:15Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T11:44:13Z | 2 |
| `1a702a2` | 2026-11-15T11:44:15Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T11:44:13Z | 2 |
| `1eddd79` | 2026-11-15T11:49:44Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T11:49:03Z | 41 |
| `1b6106e` | 2026-11-15T15:38:40Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-15T15:38:40Z | 0 |
| `4a41818` | 2026-11-15T15:51:59Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T15:51:13Z | 46 |
| `230c5a3` | 2026-11-15T16:12:25Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-15T16:12:25Z | 0 |
| `9c24661` | 2026-11-15T16:18:03Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-15T16:18:02Z | 1 |
| `bc896ef` | 2026-11-15T16:29:47Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-15T16:29:47Z | 0 |
| `df3cb3e` | 2026-11-15T16:33:57Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-15T16:33:57Z | 0 |
| `fc1bc58` | 2026-11-15T16:48:20Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-15T16:48:19Z | 1 |
| `8c3737f` | 2026-11-15T16:56:05Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-15T16:56:05Z | 0 |
| `b03b8b0` | 2026-11-16T02:29:05Z | `rollout-2026-11-07T11-27-44-01a1b40c-345f-7b`（codex） | 2026-11-16T02:29:05Z | 0 |
| `691c6ca` | 2026-11-16T05:53:28Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-16T05:53:27Z | 1 |
| `a03b415` | 2026-11-16T05:53:28Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-16T05:53:27Z | 1 |
| `b34f0e3` | 2026-11-16T05:53:28Z | `529ff251-f2a2-4725-b429-02cf281f1f46.jsonl`（claude） | 2026-11-16T05:53:27Z | 1 |
| `3159198` | 2026-11-21T11:36:57Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T11:36:57Z | 0 |
| `af48d9a` | 2026-11-21T11:46:45Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T11:46:44Z | 1 |
| `53d4b4f` | 2026-11-21T12:07:18Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T12:07:17Z | 1 |
| `31f902e` | 2026-11-21T12:34:20Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T12:34:18Z | 2 |
| `880d75a` | 2026-11-21T12:45:49Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T12:45:49Z | 0 |
| `9103401` | 2026-11-21T12:48:39Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T12:48:39Z | 0 |
| `ba81a7f` | 2026-11-21T13:00:34Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:00:14Z | 20 |
| `0569eae` | 2026-11-21T13:04:01Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:03:40Z | 21 |
| `2eb5959` | 2026-11-21T13:13:13Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:12:21Z | 52 |
| `2eb5959` | 2026-11-21T13:13:13Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:12:53Z | 20 |
| `7970ca0` | 2026-11-21T13:16:43Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:16:43Z | 0 |
| `e48c612` | 2026-11-21T13:19:18Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:19:18Z | 0 |
| `6ae5cbd` | 2026-11-21T13:19:18Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:19:18Z | 0 |
| `82d00cb` | 2026-11-21T13:19:54Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:19:18Z | 36 |
| `82d00cb` | 2026-11-21T13:19:54Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:19:53Z | 1 |
| `664c15e` | 2026-11-21T13:26:39Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:26:39Z | 0 |
| `0daa059` | 2026-11-21T13:28:13Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:27:52Z | 21 |
| `05042f0` | 2026-11-21T13:28:21Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:27:52Z | 29 |
| `05042f0` | 2026-11-21T13:28:21Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:28:20Z | 1 |
| `3e6e1d0` | 2026-11-21T13:33:59Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:33:38Z | 21 |
| `b632a3b` | 2026-11-21T13:34:47Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:34:46Z | 1 |
| `93b28e0` | 2026-11-21T13:39:00Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:38:58Z | 2 |
| `b3f3c73` | 2026-11-21T13:50:16Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:50:13Z | 3 |
| `64e4965` | 2026-11-21T13:53:11Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:53:10Z | 1 |
| `a6416a5` | 2026-11-21T13:55:14Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T13:54:31Z | 43 |
| `706be1e` | 2026-11-21T14:04:42Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T14:04:40Z | 2 |
| `d60be7b` | 2026-11-21T14:06:23Z | `d031520a-ea9e-48ce-ac7e-3805c09b1044.jsonl`（claude） | 2026-11-21T14:05:39Z | 44 |

## 4. 局限

- 模型字符串是工具自己的记录，不是对底层权重的验证。
- 调用时间是会话里发出调用的时间，提交时间是 git 记录的时间，两者相差几秒到几十秒；窗口是约定值。
- 没有匹配到会话的提交，可能由其他窗口、其他工具或你本人发起，也可能该会话文件不在导出范围内。
- 「写入类工具」只看工具的路径参数，不看写入的内容；「命令中提到」只说明命令文本里出现过该文件名，不说明写入。
- Claude 的本会话文件仍在增长，摘录的是复制时刻的快照。
