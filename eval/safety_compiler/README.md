# Safety 和 Compiler 的运行

对应设计：[DESIGN_SAFETY_COMPILER_EVAL.md](../DESIGN_SAFETY_COMPILER_EVAL.md)。运行器：[run_safety_compiler.py](run_safety_compiler.py)。

**状态（2026-11-21）：** 运行器和假客户端演练已完成，真实运行**尚未执行**（需要所有者在自己的环境里设置密钥）。

## 授权

所有者 2026-11-21 对 Claude 提出的建议上限回复"确认"：**最多 180 次请求、250,000 token、US$0.10，健康检查包含在内，不重试。** 超限即停。运行器把这三个数写成常量，超过就拒绝；完整运行的上限是总额减去健康检查已用的部分。

## 怎么做

1. **先看计划（离线，不需要密钥）：**
   `src/cloud-orchestrator/.venv/bin/python -I eval/safety_compiler/run_safety_compiler.py plan`
   应该看到 84 条进入 Safety、168 次请求、最坏情况预留约 12.5 万 token 和 US$0.054，都在上限之内。
2. **健康检查（2 条，4 次请求）。** 在你自己的终端里设置环境变量，**不要把密钥贴到聊天里**：
   ```
   export OPENAI_API_KEY=...        # 你的密钥
   export OPENAI_BASE_URL=...
   export OPENAI_MODEL_NAME=deepseek-flash
   export SAFETY_COMPILER_AUTHORIZED=yes
   src/cloud-orchestrator/.venv/bin/python -I eval/safety_compiler/run_safety_compiler.py real --limit 2
   ```
   通过标准事先写在代码里：每个请求都返回非空文字并报告用量，没有记录停在 TIMEOUT / RATE_LIMIT / API_ERROR / BAD_REPLY。
3. **完整运行**（健康检查通过之后）：
   `... real --after-health eval/safety_compiler/runs/<健康检查目录>`
4. **报告：** `... report --run-dir eval/safety_compiler/runs/<目录>`

**运行前不要再提交任何文件**：预检要求运行依赖的文件与 HEAD 一致，并且 HEAD 上有 `eval-safety-compiler-*` 标签；提交了新的内容，标签就不在 HEAD 了。

## 它做什么，不做什么

- Router **不重新请求**：按已封存的第二轮回复重放，所以进入 Safety 的 84 条与第二轮一致。
- Safety 和 Compiler 走真实的扩展流程（`bounded_agent.py`）；每个请求在发出前先按最坏情况预留额度，用量超过预留立即停止。
- 不重试；任何一个上限或预留被突破就停下，并写入运行目录。
- 结果是**可用性和稳定性**：空回复多少、无故拦截多少、被代码拒绝多少、耗时多少。不是安全性测量。
- 运行目录带哈希清单，可用 `measure_lib.verify_run_dir` 核对。
