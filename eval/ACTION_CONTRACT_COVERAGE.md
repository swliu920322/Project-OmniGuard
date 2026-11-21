# 动作合约：代码层能挡住哪几类坏输出

由 `action_contract_coverage.py` 生成，**离线，没有调用模型**。Compiler 是模型，可能写出任何东西；`validate_actions` 是把它的动作列表对照 Router 的决定和动作合约的代码。
这张表列出每一类坏输出的一个例子和代码的反应，**不说明真实模型多常写出它们**。

## 应当被挡住的（19/19 被挡住）

| 类别 | 被挡住 | 代码的说法 |
|---|---|---|
| not a list: None | 是 | the action list is missing, empty or not a list |
| not a list: an object | 是 | the action list is missing, empty or not a list |
| empty list | 是 | the action list is missing, empty or not a list |
| an item that is not an object | 是 | action 0: 'stop' is not an allowed action ['stop', 'turn', 'move'] |
| an unknown action | 是 | action 0: {'action': 'fly', 'speed': 10} is not an allowed action ['stop', 'turn', 'move'] |
| an action the tenant does not allow | 是 | action 0: {'action': 'move', 'speed': 10} is not an allowed action ['stop'] |
| any action but stop while the decision is HALT | 是 | action 0: 'move' while the decision is HALT |
| stop with a positive speed | 是 | action 0: stop with speed 30 (must have none or 0) |
| stop with a non-numeric speed | 是 | action 0: stop with speed '0' (must have none or 0) |
| move without a speed | 是 | action 0: move needs a numeric speed |
| move with a negative speed | 是 | action 0: speed -5 outside 0..100 |
| move above the request's target speed | 是 | action 0: speed 101 outside 0..100 |
| move above 250 cm/s while the decision caps speed | 是 | action 0: speed 251 outside 0..100 |
| move with a boolean speed | 是 | action 0: speed True outside 0..100 |
| move with a NaN speed | 是 | action 0: speed nan outside 0..100 |
| turn without a degree | 是 | action 0: turn needs an integer degree in -180..180, got None |
| turn with a degree outside -180..180 | 是 | action 0: turn needs an integer degree in -180..180, got 181 |
| turn with a non-integer degree | 是 | action 0: turn needs an integer degree in -180..180, got 12.5 |
| turn without a speed | 是 | action 0: turn needs a numeric speed |

## 应当被接受的（5/5 被接受）

| 类别 | 被接受 |
|---|---|
| a valid stop | 是 |
| a valid stop under HALT | 是 |
| a valid move inside the target speed | 是 |
| a valid move exactly at the target speed | 是 |
| a valid turn | 是 |

## 局限
- 每类只有一个例子，不是穷尽；合约本身是仿真约定（见 `validate_actions` 的文档字符串）。
- 被挡住的结果是停车（`REJECTED_BY_CODE`），所以最坏情况是多停，不是放行。
- Safety 的回复只看是否以 `BLOCK` 开头；任何别的文字都当作通过，这一点没有在这里覆盖。
