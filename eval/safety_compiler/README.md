# Safety 和 Compiler 的运行

对应设计：[DESIGN_SAFETY_COMPILER_EVAL.md](../DESIGN_SAFETY_COMPILER_EVAL.md)。运行器：[run_safety_compiler.py](run_safety_compiler.py)。

**状态（2026-11-21）：已完成一次真实运行。** 代码：标签 `eval-safety-compiler-v1`（实际运行的 6 个文件与该提交逐个哈希相同）。

| 运行 | 目录（`runs/` 下） | 结果 |
|---|---|---|
| 第一次健康检查 | `20261121T134755Z_real_b0c7fc4b` | 第一个请求后**按设计停下**：Safety 回复正常，但用量 80 个输出超过预留的 50（提供商不遵守 `max_completion_tokens`，见 LIMITATIONS 第 25 条）；1 次请求 |
| 健康检查两次 | `20261121T135603Z_real_11a91792`、`20261121T135623Z_real_04bae6a8` | 都通过，各 4 次请求 |
| **完整运行** | `20261121T140117Z_real_c75ee025` | 84 条、168 次请求，全部完成，见下 |

**完整运行的结果**（详见 [LIMITATIONS](../LIMITATIONS.md) 第 26 条和该目录的 `REPORT.md`）：
- 每个请求都返回了可用文字；Safety 84/84 通过、**没有拦截**；Compiler 的动作 84/84 通过代码层合约、无违规；无空回复、无故障。
- 耗时（端点指标，毫秒）：Safety 中位 1219、P95 2193；Compiler 中位 1745、P95 3563。
- 用量：约 63,000 token、约 US$0.049；连同健康检查共 177 次请求，约 66,000 token，约 US$0.052（确认的总额是 180 次、250,000 token、US$0.10）。**剩余只有 3 次请求，再跑需要新的授权。**
- 提供商没有遵守请求的输出上限：Safety 在 81/84 个请求里超过 50 个输出 token（中位 86、最大 500），Compiler 在 84/84 个里超过 100（中位 198、最大 596）。

**怎么读：** 这是**可用性和耗时**的测量，**不是安全性评测**。Safety 全部通过只说明它在这 84 条上没拦；没有金标说明哪些该拦。真实 Compiler 一次也没有产生过需要代码层拒绝的输出，所以代码层没有被真实失败检验过。数据是合成的，同一情境三种写法，一个模型、一次运行；60 秒超时仍是占位。记录里的 `started_at` 是文件写入时间，不是开始时间。

## 授权

所有者 2026-11-21 对 Claude 提出的建议上限回复"确认"：**最多 180 次请求、250,000 token、US$0.10，健康检查包含在内，不重试。** 超限即停。运行器把这三个数写成常量，超过就拒绝；完整运行的上限是总额减去健康检查已用的部分。

## 怎么做

1. **先看计划（离线，不需要密钥）：**
   `src/cloud-orchestrator/.venv/bin/python -I eval/safety_compiler/run_safety_compiler.py plan`
   应该看到 84 条进入 Safety、168 次请求、每个请求预留约 2700 token，以及已经用掉的额度（第一次失败的健康检查：1 次、293 token）。"所有请求都用满预留"的总和（约 45 万）超过了上限，但那不是预测：守卫每次加上真实用量，并在下一个请求可能突破上限之前停止。粗略预期（估计，不是承诺）：每条记录约 1000 至 1500 token，84 条约 10 万至 13 万 token、约 US$0.05 至 0.07。
2. **健康检查（2 条，4 次请求）。** 在你自己的终端里设置环境变量，**不要把密钥贴到聊天里**：
   ```
   export OPENAI_API_KEY=...        # 你的密钥
   export OPENAI_BASE_URL=...
   export OPENAI_MODEL_NAME=deepseek-flash
   export SAFETY_COMPILER_AUTHORIZED=yes
   src/cloud-orchestrator/.venv/bin/python -I eval/safety_compiler/run_safety_compiler.py real --limit 2
   ```
   通过标准事先写在代码里：每个请求都返回非空文字并报告用量，没有记录停在 TIMEOUT / RATE_LIMIT / API_ERROR / BAD_REPLY。
3. **完整运行**（健康检查通过之后）。目录不用你找，写 `latest`，运行器自己挑最新的、封存完整并且通过了健康检查的那次真实运行：
   `src/cloud-orchestrator/.venv/bin/python -I eval/safety_compiler/run_safety_compiler.py real --after-health latest`
4. **报告：** 同样不用找目录，默认就是最新的一次：
   `src/cloud-orchestrator/.venv/bin/python -I eval/safety_compiler/run_safety_compiler.py report`
   （要指定某一次，写 `--run-dir eval/safety_compiler/runs/<目录名>`；目录名是运行器在第 2、3 步结束时打印的 `wrote ...` 那一行里的路径，形如 `20261121T…Z_real_xxxxxxxx`。）

**运行依赖的六个文件（见 `code_hashes()`）在打标签之后不要改**：预检要求它们与最新的 `eval-safety-compiler-*` 标签一致，健康检查和完整运行也必须用同样的代码。其他文件（笔记、文档）可以照常提交。

## 运行器的改进（2026-11-21，完整运行之后）

第一次完整运行暴露了三个不足，之后改了（没有改动已封存的运行）：运行目录和 `config.json` 在**第一个请求之前**就写好，并记录真实开始时间；每条记录和它的请求**边跑边追加**到 `results.jsonl` 和 `calls.jsonl`；被 Ctrl-C 或崩溃中断时会**封存已有的部分**，摘要写 `status: interrupted`，并记下"已预订但没有记录的请求数"（其预算仍算占用）。上面那次完整运行用的是改进前的代码（标签 `eval-safety-compiler-v1`），所以它的 `started_at` 是写文件的时间。改进后的代码用标签 `eval-safety-compiler-v2`。

## 它做什么，不做什么

- Router **不重新请求**：按已封存的第二轮回复重放，所以进入 Safety 的 84 条与第二轮一致。
- Safety 和 Compiler 走真实的扩展流程（`bounded_agent.py`）；每个请求在发出前先按最坏情况预留额度，用量超过预留立即停止。
- 不重试；任何一个上限或预留被突破就停下，并写入运行目录。
- 结果是**可用性和稳定性**：空回复多少、无故拦截多少、被代码拒绝多少、耗时多少。不是安全性测量。
- 运行目录带哈希清单，可用 `measure_lib.verify_run_dir` 核对。
