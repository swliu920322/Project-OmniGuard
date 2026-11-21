# 打分链路的对照检查

[CONTROL_CHECK.md](CONTROL_CHECK.md) 和 `control_check.json` 由 `../control_check.py` 生成：

```sh
python3 -I eval/experiments/note_vs_rules_v2/control_check.py
```

- 用项目自己的打分函数（`note_analysis.correctness`、`evaluate.note_outcome`），在已公开的 180 条上做完美答案、反向答案、固定答案、打乱标签四种对照，并核对模型能否重现已发布的 173/180、R3 能否重现 77/180。
- 不调用模型，不联网，不修改 `evidence/`；测试核对运行前后输入哈希不变，并用一个"全部判对"和一个"全部判错"的坏打分函数，确认对照会报错。
- 对照失败说明打分链路或它的输入方式有问题，**与模型好坏无关**。
- 打乱标签的范围只是读分数的参照，不是显著性检验。
- 设计来源：[DESIGN_CANARY_UNKNOWN.md](../../../archive/designs/DESIGN_CANARY_UNKNOWN.md) 的 A 部分。B 部分（新一轮题）不做。
