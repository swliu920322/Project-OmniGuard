# The Kinematic-Token Theorem Explained

## The formula

```
V_max ≤ D_clearance / ( L_network_rtt + (T_prompt + T_completion) / S_token_rate )
```

Do not be scared. Each letter is just a real-world number.

## What each part means

| Symbol | Plain English | Example |
|--------|---------------|---------|
| `V_max` | The fastest speed the robot can safely move. | 0.5 m/s |
| `D_clearance` | How much empty space is in front of the robot. | 2.0 m |
| `L_network_rtt` | Time for a signal to go to the cloud and come back. | 0.8 s |
| `T_prompt` | Number of input tokens sent to the AI. | 500 tokens |
| `T_completion` | Number of output tokens the AI writes back. | 100 tokens |
| `S_token_rate` | How fast the AI can generate tokens. | 50 tokens/s |

## The intuition

The bottom of the fraction is the **total thinking time** of the cloud AI:

```
total delay = network round-trip + token generation time
```

Token generation time is simply:

```
(T_prompt + T_completion) / S_token_rate
```

For example, if the AI must read 500 tokens and write 100 tokens at 50 tokens per second, it needs:

```
(500 + 100) / 50 = 12 seconds
```

If the network round-trip is another 0.8 seconds, the total delay is **12.8 seconds**.

Now, if the robot is 2 meters from the wall, the fastest it can safely go is:

```
V_max = 2.0 / 12.8 ≈ 0.16 m/s
```

That is slower than a walking human. If the robot moves at 1 m/s, it will crash.

## Why the theorem is not about being smart

The cloud AI may be the smartest model in the world. It does not matter. The crash happens because **physics does not wait for the answer**. Distance, speed, and time are tied together by nature. No amount of intelligence can break that link.

## What changes the outcome?

You have four levers:

1. **Shorter distance to obstacle** → lower `V_max` (more dangerous).
2. **Higher speed** → more likely to exceed `V_max`.
3. **Longer network delay or slower token rate** → lower `V_max`.
4. **Shorter prompts/completions** → higher `V_max`.

The sandbox lets you play with all of them.

---

# 运动学-Token 定理通俗解释

## 公式

```
V_max ≤ D_clearance / ( L_network_rtt + (T_prompt + T_completion) / S_token_rate )
```

别被吓到，每个字母都对应一个真实世界的数字。

## 每个符号的意思

| 符号 | 通俗解释 | 示例 |
|--------|---------------|---------|
| `V_max` | 机器人能安全移动的最快速度 | 0.5 m/s |
| `D_clearance` | 机器人前方有多少空地 | 2.0 m |
| `L_network_rtt` | 信号去云端再回来的时间 | 0.8 s |
| `T_prompt` | 发给 AI 的输入 token 数量 | 500 tokens |
| `T_completion` | AI 回复的输出 token 数量 | 100 tokens |
| `S_token_rate` | AI 生成 token 的速度 | 50 tokens/s |

## 直觉理解

公式分母是云端 AI 的**总思考时间**：

```
总延迟 = 网络往返 + token 生成时间
```

token 生成时间很简单：

```
(T_prompt + T_completion) / S_token_rate
```

举个例子，如果 AI 要读 500 个 token、写 100 个 token，速度是每秒 50 个 token，那它需要：

```
(500 + 100) / 50 = 12 秒
```

如果网络往返还要 0.8 秒，总延迟就是 **12.8 秒**。

现在，如果机器人离墙只有 2 米，它能安全移动的最快速度是：

```
V_max = 2.0 / 12.8 ≈ 0.16 m/s
```

这比人走路还慢。如果机器人以 1 m/s 前进，它就会撞墙。

## 为什么这个定理和"聪明不聪明"无关？

云端 AI 可能是世界上最聪明的模型，但这不重要。撞墙是因为**物理不会等答案回来**。距离、速度、时间被自然规律绑在一起，再高的智能也打破不了这个联系。

## 什么会改变结果？

你有四个杠杆可以调：

1. **障碍物距离更短** → `V_max` 更低（更危险）。
2. **速度更高** → 更容易超过 `V_max`。
3. **网络延迟更长、token 速率更慢** → `V_max` 更低。
4. **prompt/completion 更短** → `V_max` 更高。

沙箱让你可以玩转所有这些变量。
