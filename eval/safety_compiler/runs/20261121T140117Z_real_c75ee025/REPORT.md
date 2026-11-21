# Safety 和 Compiler：real 运行报告

运行 `20261121T140117Z_real_c75ee025`，标签 `eval-safety-compiler-v1`，状态 **completed**（completed all planned records）。
Router 是按已封存的第二轮回复重放的，没有新的 Router 请求；Safety 和 Compiler 走真实的扩展流程（`bounded_agent.py`）。费用是估算，不是账单。

## 1. 主张

测的是 Safety 和 Compiler 两个模型角色的**可用性和稳定性**：会不会无故拦截、回复是否可用、输出能否通过代码层合约、耗时多少。**不是**安全性测量：Router 判停的请求根本不进入它们，它们只能让结果更严。

## 2. 证据

- 进入 Safety 的记录：84（计划 84），请求 168 次，预算 168/171 次、约 63238 token、约 US$0.049281（上限 US$0.097609）。
- Safety：{'PASS': 84}
- Compiler：{'COMPILED': 84}
- 最终动作：{'move': 84}；停车原因：{}
- 空或不可用回复（BAD_REPLY）：0（这是新路径与旧路径行为不同的地方，见 LIMITATIONS 第 24 条）
- 耗时（毫秒，端点指标）：Safety {'median': 1219, 'p95': 2193}，Compiler {'median': 1745, 'p95': 3563}
- 返回的模型别名：['deepseek-flash']
- Compiler 被代码拒绝的违规类别：无

## 3. 推理

每条记录各问一次 Safety 和一次 Compiler，关闭重试，失败留在分母里；回复为空算 BAD_REPLY，不算通过。把耗时和停车比例与第二轮的 Router 数字并排看，才知道这两个角色增加了多少等待、多少额外停车。

## 4. 局限

- 数据是合成的，同一情境三种语言写法，条数不是独立样本。
- 只有一个模型、一次运行；模型别名不等于验证过的版本。
- 超时 60 秒是占位值；这里量到的耗时是后续定值的依据，不是结论。
- 本次不评价 Safety 是否「该拦」：没有金标说明哪些记录应当被拦。
