# Safety 和 Compiler 的运行

对应设计：[DESIGN_SAFETY_COMPILER_EVAL.md](../DESIGN_SAFETY_COMPILER_EVAL.md)。运行器：[run_safety_compiler.py](run_safety_compiler.py)。

**状态（2026-11-21）：** 运行器和假客户端演练已完成。所有者执行的第一次健康检查（`runs/20261121T134755Z_real_b0c7fc4b`）在第一个请求后**按设计停下**：Safety 的回复正常（`PASS`），但报告的用量是 213 个输入加 80 个输出（其中 77 个是推理 token），超过了预留的输出上限 50，触发预留突破并停止运行。Compiler 没有被请求。这次只用了 1 次请求、293 token、约 US$0.0002。原因和处理见 [LIMITATIONS](../LIMITATIONS.md) 第 25 条。运行器已改：预算按每个请求最多 2048 个输出 token 预留（提供商不遵守 `max_completion_tokens`），之前所有真实运行用掉的额度都算进同一个总额，被运行自己的停止中断的记录会标注。**这次失败的健康检查用的是旧代码，不能用于完整运行；需要重新做一次 2 条的健康检查。完整运行尚未执行。**

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

## 它做什么，不做什么

- Router **不重新请求**：按已封存的第二轮回复重放，所以进入 Safety 的 84 条与第二轮一致。
- Safety 和 Compiler 走真实的扩展流程（`bounded_agent.py`）；每个请求在发出前先按最坏情况预留额度，用量超过预留立即停止。
- 不重试；任何一个上限或预留被突破就停下，并写入运行目录。
- 结果是**可用性和稳定性**：空回复多少、无故拦截多少、被代码拒绝多少、耗时多少。不是安全性测量。
- 运行目录带哈希清单，可用 `measure_lib.verify_run_dir` 核对。
