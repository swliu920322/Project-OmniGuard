# Claude Code：指令文件、skill 和上下文，官方怎么说

用来参考和优化本项目的 `CLAUDE.md`。写于 2026-11-21。

**可信度说明：** 下面"官方说法"一栏由一个助手读取 code.claude.com 的官方文档后摘录，原话和页面名都附上了；我没有逐页重新核对。引用前请以原页面为准。"我们的数字"来自你在会话里运行的 `/context`，是实测。

## 一、官方怎么说

页面都在 https://code.claude.com/docs/en/ 下：`memory.md`、`skills.md`、`best-practices.md`、`context-window.md`、`costs.md`、`prompt-caching.md`。

| 问题 | 官方说法 | 页面 |
|---|---|---|
| 根目录和上级的 `CLAUDE.md` | 启动时整份读入；"Claude reads them at the start of every session"；每次请求都随项目上下文重发 | memory、prompt-caching |
| 对它的成本的说法 | "...those tokens are present even when you're doing unrelated work"（指放了只和某个流程有关的细节） | costs："Move instructions from CLAUDE.md to skills" |
| 长度 | "target under 200 lines per CLAUDE.md file. Longer files consume more context and reduce adherence"；没有文档化的字节上限，也没有每行多少 token 的数字 | memory、costs |
| 放什么 | "Only write down what Claude couldn't work out from the code itself"；表格里：描述架构和文件布局 → "Claude reads the repo itself. Only write down what isn't in there" | best-practices |
| 什么该搬走 | "If an entry is a multi-step procedure or only matters for one part of the codebase, move it to a skill or a path-scoped rule" | memory |
| 子目录里的 `CLAUDE.md` | **按需**："Instead of loading them at launch, Claude Code loads each one once Claude reads, writes, or edits another file in that subdirectory" | memory |
| `@path` 导入 | **不省上下文**："imported files load with the CLAUDE.md importing them"；最多四层 | memory |
| skill | 描述常驻，正文触发才读："skill descriptions are loaded into context ... but full skill content only loads when invoked"；"Every skill in the skill listing adds to your context on every turn"；描述加 `when_to_use` 在列表里最多 1536 字符；列表预算是上下文窗口的 1% | skills |
| 缓存 | 项目上下文是缓存层，后续轮次按缓存读取价计费；会话中途改 `CLAUDE.md` **不会生效**，要 `/clear`、`/compact` 或重启 | prompt-caching |
| 注释 | HTML 注释 `<!-- -->` 在注入前被去掉，不占 token，可以给维护者留说明 | memory |
| 怎么测 | `/context all`、`/memory`、`/doctor`；`InstructionsLoaded` 钩子能记录哪些文件何时加载 | context-window、memory、skills |

**文档没说的：** 多个 `CLAUDE.md` 合计的大小上限；skill 数量上限（只有 1% 的列表预算）；每行或每个文件多少 token。

## 二、我们的数字（2026-11-21 的 `/context`，这个会话读的是旧版）

| 类别 | tokens | 占比 |
|---|---|---|
| `CLAUDE.md`（旧版 8111 字节） | 约 3k | 0.3% |
| `MEMORY.md` | 327 | 0.03% |
| 31 个 skill 的描述 | 5.9k | 0.6% |
| 系统提示加工具 | 约 21k | 2.1% |
| 对话消息 | 875k | 87.5% |
| 其中 Bash 命令输出 | 179.8k | 18% |

推算：旧版约 0.37 token 每字节；新版 6128 字节约 **2.3k tokens**（待在新会话里用 `/context` 验证）。

## 三、从这些数字得出的结论

1. **`CLAUDE.md` 不是 token 的主要来源，对话才是。** 优化 `CLAUDE.md` 最多省一两千 token；少打印大段命令输出（本会话 18%）省得多得多。
2. **保持 `CLAUDE.md` 短的主要理由是遵守度，不是费用。**
3. **"按需"只有两种真正的机制：** skill 正文、子目录的 `CLAUDE.md`。在 `CLAUDE.md` 里写"当 X 时做 Y"只是写法，触发语句本身也计入 token。
4. **skill 的描述也不免费：** 31 个描述共 5.9k，是我们 `CLAUDE.md` 的两倍。
5. **改了指令文件要开新会话才生效。**

## 四、优化 `CLAUDE.md` 的检查清单

每一行问四个问题，全是"是"才放：
- 读代码读不出来吗？
- 不告诉 AI，它会做错吗？
- 几乎每次对话都用得上吗？
- 相对稳定吗？（结果、状态、进展会变，放别处）

写法：
- 规则写成"当 X 时：做 Y。由什么检查"，没有自动检查就写明。
- 给人看的维护说明放 `<!-- ... -->`，不占 token。
- 架构、文件布局、流程这类读代码能得到的，不要写。

什么时候拆：
- 超过官方建议的 200 行，或规则只在某个目录下才有用 → 子目录 `CLAUDE.md`。
- 多步骤、很少用的流程（例如"做一次真实模型运行"）→ skill。
- 用 `@path` 导入拆文件**没有用**，不省上下文。

怎么衡量：改完在新会话里跑 `/context all`，看 Memory files 一栏。

## 五、我们现在的状态

45 行、约 6.1 KB（约 2.3k tokens，估算），远在官方的 200 行建议之内；测试里的 7 KB 上限比官方建议严格，是我们有意选的绊线，不是官方要求。
