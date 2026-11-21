# Reproducing the evaluation

> 第二轮备注对照的最终原题及逐条回复已另行整理入仓，免费复算入口见 [第二轮原件说明](experiments/note_vs_rules_v2/evidence/README.md)。下文关于旧300条私有原件缺失的边界继续适用，不因第二轮交付而恢复。

**现在能做什么（2026-11-21）：**

| | 第一轮（300 条） | 第二轮（180 条） |
|---|---|---|
| 第 1 级：免费离线 | 可以 | 可以 |
| 第 2 级：公开开发集真实运行 | 可以（自备密钥，几美分） | 不适用 |
| 第 3 级：用原题重跑 | **做不到**：原题和逐条记录已丢失（[LIMITATIONS](LIMITATIONS.md) 第 22 条） | 可以：题目和回复已公开，免费复算见[原件说明](experiments/note_vs_rules_v2/evidence/README.md)；付费重跑需要你自己的预算 |

Read this before claiming that anything "reproduces". There are three levels, and only the first needs no private data and no money.

| Level | Needs | What it proves |
|---|---|---|
| 1. Offline walkthrough (free) | a checkout, Python | the code, the tests, the specification and the pipeline behave as documented, with a fake model; the published result files match their hashes |
| 2. Public-data real run (a few cents) | level 1 + provider credentials | the evaluation pipeline works against a real model on the **public dev set** (not the formal numbers) |
| 3. Formal reproduction | level 2 + the **private** frozen test files from their custodian + the owner's budget | the formal numbers in [report.md](report.md) |

**A checkout of the public repository alone does not reproduce the formal result.** The 300-record test set and the 55 stress cases are not published (only their hashes and counts are, in [acceptance/FROZEN_MANIFEST.json](acceptance/FROZEN_MANIFEST.json)). Nothing below asks anyone to read, copy or regenerate them.

## Requirements

- Python 3.10 or newer (the recorded runs used 3.11.9 and `openai` 2.41.1 on macOS); `git`.
- A virtual environment with the backend requirements: `python3 -m venv .venv && .venv/bin/pip install -r src/cloud-orchestrator/requirements.txt pytest`.
- A POSIX shell with `sh` and `shasum` (macOS or Linux). The commands were run on macOS only; Windows is untested (use WSL).
- For levels 2 and 3 only: an OpenAI-compatible endpoint. The recorded runs used `LLM_PROVIDER=deepseek`, `OPENAI_BASE_URL=https://api.deepseek.com`, `OPENAI_API_KEY=<yours>`, `OPENAI_MODEL_NAME=deepseek-v4-flash`. The provider answers with an alias (`deepseek-flash`) and may have changed the model since; state the model identity you believe you are using with `--model-identity` and treat it as unverified. Never commit or paste the key.

## Level 1: offline walkthrough (free)

Run these on `main`, **from the repository root** (the paths are relative). The published results (`eval/formal/results/`) and this guide were added after the tag. The frozen code is unchanged since the tag, which the first command checks. `OUT` below is a scratch directory of your choice; `mktemp -d` makes a private one.

```bash
OUT=$(mktemp -d)
```

```bash
git diff --stat eval-formal-v1 HEAD -- src eval/formal/run_formal.py eval/formal/CODE_FREEZE.json eval/baseline_b eval/spec eval/acceptance eval/dev   # prints nothing: code, prompt, specification and data manifests are the frozen ones
.venv/bin/python -m pytest tests -q  # 395 passed at commit 3db72fa (the tag itself has fewer: later tests check the documents), no network, no key
sh eval/baseline_v1/verify.sh        # the archived original implementation matches its hashes
(cd eval/formal/results && shasum -a 256 -c SHA256SUMS)     # the published formal results are intact
.venv/bin/python eval/formal/run_formal.py plan             # requests, token and cost bounds, from the manifest alone
.venv/bin/python eval/baseline_b/run_dev_eval.py --mode dry-run --fault-plan none --out-root "$OUT/dryrun"   # fake client, sockets blocked, metrics withheld on purpose
.venv/bin/python eval/formal/run_formal.py run --suite main --mode dry-run --skip-freeze-check \
    --data eval/dev/dev_set.jsonl --expect-sha256 "$(shasum -a 256 eval/dev/dev_set.jsonl | cut -d' ' -f1)" \
    --private-out "$OUT/private" --public-out "$OUT/public" --max-calls 180
```
The last command runs the formal runner end to end on the public dev set with a fake model: it checks the hash first, scores with the frozen scorer, writes the private run directory and the aggregate-only public summary. A fake model proves the pipeline, never a model.

Expected output: `hash verification: OK` from each command; a private run directory under `$OUT/private` and an aggregate-only public summary with `metrics_withheld`. (Without `--fault-plan none` the baseline-B dry run deliberately stops at its call 51 on a scripted bound violation, to rehearse the guard; it exits with code 3 and still ends with `hash verification: OK`, so a script that treats any non-zero exit as failure will flag it.)

## Level 2: real run on the public dev set (a few cents)

Costs money; run it only with your own key and your own cap. Two calls are enough to see the pipeline work end to end:

```bash
export BASELINE_B_AUTHORIZED=yes LLM_PROVIDER=deepseek OPENAI_BASE_URL=https://api.deepseek.com OPENAI_API_KEY=... OPENAI_MODEL_NAME=deepseek-v4-flash
.venv/bin/python eval/baseline_b/run_dev_eval.py --mode real --limit 2 --authorized-by "<you>" \
  --model-identity "<the model you believe you call; unverified>" --usd-cap 0.05 \
  --price-input-per-mtok 0.3333334 --price-output-per-mtok 1.3333334 --price-source "<your price page and date>" \
  --max-calls 2 --max-tokens 20000
```
The run needs a clean tracked working tree and writes a sealed directory under `eval/baseline_b/runs/`. The full dev run (180 calls) costs roughly US$0.08 to 0.10 at those rates; its recorded result (175/180, five provider errors) is in [baseline_b/runs/INDEX.md](baseline_b/runs/INDEX.md). A dev-set figure is a development figure, never the formal one.

## Level 3: formal reproduction (private data, budget)

**Status (2026-11-21): not possible for round 1, because the private files can no longer be found (LIMITATIONS item 22).** The steps below are kept to show how it was designed to work; the file hashes remain the check if the originals ever turn up. Round 2 does not need this level: see its [evidence README](experiments/note_vs_rules_v2/evidence/README.md).

Only possible with the files `test_set.jsonl` and `stress_cases.jsonl` whose SHA-256 equal the ones in the manifest (`68e08ed9…` and `dc888af0…`), obtained from their custodian. The custodian holds them outside the repository; do not ask the tuning side for them.

1. Check out the tag in its own worktree: `git worktree add ../omniguard-formal eval-formal-v1` and work there (commit `fec6acf`). A real run requires `HEAD` to be the tagged commit, so it cannot be started from `main`; it also refuses a dirty tree and a changed frozen file. The published `eval/formal/results/` does not exist at the tag: give `--public-out` a directory of your own.
2. `run_formal.py check-format --acceptance-dir <private dir>` (counts and hashes only, prints no record), then `plan --acceptance-dir <private dir>` for exact numbers.
3. Set the credentials as above and `BASELINE_B_AUTHORIZED=yes`; choose your own caps. The programme used: 2 health-canary calls, 2 x 300 main calls, at most 40 stress calls; caps US$0.57, 642 calls, 1,320,000 tokens in total; it cost about **US$0.285** (634 API requests, 630,792 tokens) at the configured conservative rates, an estimate and not a bill.
4. `run_formal.py run --suite main --twice --mode real --acceptance-dir <dir> --frozen-tag eval-formal-v1 --private-out <dir outside the repo> --public-out eval/formal/results ...` (money options as in [formal/FORMAL_PLAN.md](formal/FORMAL_PLAN.md) section 5), then `--suite stress` the same way. Outputs: the **private** run directories (full inputs and replies; keep them out of git) and, in `--public-out`, aggregate-only summaries and `reproducibility_*.json`.
5. Compare with [report.md](report.md): two independent runs must agree on at least 98 % of predictions with an accuracy difference of at most 2 points; a different model, version or day may legitimately differ, and then the honest statement is the new numbers with their own caveats, not "reproduced".

## If the frozen data should be published (decision for the owner, not taken here)

| Option | Effect |
|---|---|
| A. Keep private (current) | the repository shows hashes, aggregates and the verification record; outsiders can check integrity but cannot rerun the formal numbers without the custodian |
| B. Publish the frozen files | anyone can rerun, but the set becomes a public, "exposed" set: it can no longer serve as an untouched test for any later prompt change, and any future optimisation needs a new independent set. The files also carry the 34-family and AI-label limits |
| C. Share under a request process | a named third party receives the files from the custodian with the hashes; reproduction by a stranger is possible but not "clone and run" |

Until the owner chooses, nothing here copies, republishes or regenerates private samples.
