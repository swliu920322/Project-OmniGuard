# What Is the Kinematic-Token Theorem Page?

> Route: `/kinematic`

## In one sentence

This page is an interactive sandbox that proves why a **cloud-only AI brain is too slow to safely stop a fast-moving robot**.

## The everyday story

Imagine you are driving a car. Up ahead, a wall suddenly appears. You have two ways to decide what to do:

1. **Cloud-only control**: You send a photo of the road to a remote data center, wait for a super-smart AI to write back "brake", and only then hit the brakes.
2. **Edge fallback**: A simple local sensor in your bumper notices the wall and slams the brakes immediately.

The first option sounds fancy, but if the car is moving fast, it will crash before the answer comes back. The second option is "dumber" but fast enough to save your life.

This page turns that idea into a live animation. You move sliders, hit **Run Simulation**, and watch a small robot drive toward a wall. The page calculates — in real time — whether the robot has enough distance to stop safely.

## Why it matters

In real warehouses and factories, companies want to use large AI models (like GPT-4) to control robots. Those models are powerful, but they live in the cloud. The time it takes to send data up and get a command back is often longer than the time the robot has before it hits something.

This sandbox makes that invisible problem **visible**.

## What you see on the page

- **Header**: Switch between *Cloud-Only* mode and *Edge Fallback* mode, or reset everything.
- **Formula Card**: The math that defines the safety speed limit.
- **Parameter Panel**: Seven sliders that let you change speed, network delay, token rate, prompt/completion length, obstacle distance, and edge reaction time.
- **Simulation Stage**: A moving robot, a wall, colored safety zones, and crash/safe-stop animations.
- **Audit Log**: A scrolling terminal that records every event with a timestamp.

## Who is this for?

- **Interviewers / examiners** who want a one-glance proof of why edge computing matters.
- **Engineers** designing robot safety systems.
- **Non-technical stakeholders** who need to understand why "more cloud AI" is not always the right answer.

---

# 这个"运动学-Token 定理"页面是什么？

> 路由：`/kinematic`

## 一句话概括

这个页面是一个交互式沙箱，用来证明：**只靠云端 AI 大脑，反应速度不足以安全刹住一台快速移动的机器人**。

## 一个生活化的故事

想象你正在开车，前方突然出现一堵墙。你有两种方式来决定怎么应对：

1. **纯云端控制**：你把路的照片发到远程数据中心，等一个超级聪明的 AI 回信说"刹车"，然后你才踩刹车。
2. **边缘 fallback**：保险杠上一个简单的本地传感器发现墙壁，立刻帮你刹停。

第一种听起来很高级，但如果车开得很快，可能在答案回来之前你就已经撞上去了。第二种看起来"笨"，但足够快，能救命。

这个页面把这个想法做成了实时动画。你拖动滑块、点击 **Run Simulation**，看着一个小机器人朝墙驶去。页面会实时计算：机器人有没有足够的距离安全停下。

## 为什么重要？

在真实的仓库和工厂里，很多公司想用大模型（比如 GPT-4）来控制机器人。这些模型很强，但它们在云端。把数据传上去、再把指令传回来，这段时间往往比机器人撞到东西之前的可用时间还要长。

这个沙箱把这个**看不见的问题变得可见**。

## 页面上有什么？

- **顶部栏**：切换 *Cloud-Only* 和 *Edge Fallback* 模式，或重置所有参数。
- **公式卡片**：定义安全速度上限的数学公式。
- **参数面板**：七个滑块，可调整速度、网络延迟、token 速率、prompt/completion 长度、障碍物距离、以及边缘反应时间。
- **模拟舞台**：移动的机器人、墙壁、彩色安全区、撞击/安全停下动画。
- **审计日志**：带时间戳的滚动终端，记录每一次事件。

## 适合谁看？

- 想一眼看出"为什么边缘计算重要"的**面试官 / 答辩老师**。
- 设计机器人安全系统的**工程师**。
- 需要理解"为什么不是云端 AI 越多越好"的**非技术决策者**。
