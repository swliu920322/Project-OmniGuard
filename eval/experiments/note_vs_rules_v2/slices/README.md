# 分片对照报告

[SLICE_REPORT.md](SLICE_REPORT.md) 和 `slice_report.json` 由 `../slice_report.py` 生成：

```sh
python3 -I eval/experiments/note_vs_rules_v2/slice_report.py            # 重新生成
python3 -I eval/experiments/note_vs_rules_v2/slice_report.py --check-only
```

- 输入：[record_audit.jsonl](../evidence/review/record_audit.jsonl)、[test_set.jsonl](../evidence/data/test_set.jsonl)、[families.json](../evidence/data/families.json)。哈希写在报告末尾。
- 脚本先核对账本能否复现公开总数（模型 173/180、R3 77/180、配对 75/98/2/5），对不上就报错退出，不写文件。
- 不调用模型，不联网，不修改 `evidence/`；测试有一项核对运行前后输入哈希不变。
- 账本是保管者的测后整理，不是本脚本独立算出。脚本只重新切分，不是新评测，也不是优化前后的对比。
- 每片的条数都小，且每个家族的三条是同一情境的三种语言写法，不能当独立样本。
- 本目录不在 `evidence/` 的 `SHA256SUMS` 里，因为那份清单对应已封存的原件；重新生成会得到相同内容（输入不变时）。
