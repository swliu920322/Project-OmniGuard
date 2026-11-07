# Baseline A archive (`eval-baseline-v1`)

Status: **archived at D0, verified, not yet measured.** Nothing in this archive changes behaviour, and no model was called to produce it.

## Identity

| Item | Value |
|---|---|
| Baseline commit (original implementation) | `a58b1258280567d3061973197151a0c917276fd8` (`a58b125`, branch `docs/consolidate-source-of-truth`) |
| Tag | `eval-baseline-v1`, annotated tag object `abd84e0451a49af1e49e454aba51cf66bd9b70c5` |
| Tag points to | commit `a58b1258280567d3061973197151a0c917276fd8` |
| Working tree when tagged | clean (`git status --short` empty) |
| D0 (start of the 7-day window) | 2026-11-07 11:58:03 +0800 (2026-11-07T03:58:03Z) |
| Deadline | 2026-11-14 11:58:03 +0800 |

The tag marks the original implementation. This archive is added in the commit **after** the tag, so the archive commit hash is not stored here; it is reported separately.

## What is archived

24 files, each a byte-identical copy of the same path at the tag (`git show eval-baseline-v1:<path>`), under `original/`. Full SHA-256 hashes: `SHA256SUMS`. Check everything with `sh eval/baseline_v1/verify.sh` (no network, no model).

| Path | Kind | SHA-256 (first 16) |
|---|---|---|
| `docs/evidence/README.md` | evidence doc | `83b89babb379c845…` |
| `src/client-edge/src/app/dashboard/live/config/scenarios.ts` | live-page config | `5ac2a0141b280b0d…` |
| `src/client-edge/src/app/dashboard/live/config/simulation.ts` | live-page config | `0c00e505a9a2e5ad…` |
| `src/cloud-orchestrator/embodied_brain/benchmark.py` | source / config | `a61177f18101cb70…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_baseline.py` | source / config | `17e3dfb55790852e…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_no_safety.py` | source / config | `092612854f8edb9c…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_results/README.md` | historical result | `63c5fbd610992d10…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/results.csv` | historical result | `e55866dc792ed6f8…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/summary.json` | historical result | `c02fe0654b6f3066…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/report.txt` | historical result | `a695055fb6aebf2f…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/results.csv` | historical result | `bdbfee9c875612b7…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/results.json` | historical result | `350f45fc5436f567…` |
| `src/cloud-orchestrator/embodied_brain/benchmark_scenarios.py` | source / config | `32331c0918fbab13…` |
| `src/cloud-orchestrator/embodied_brain/brain.py` | source / config | `ab1052f0496bb49d…` |
| `src/cloud-orchestrator/embodied_brain/utils.py` | source / config | `8e84e0746a3e8df5…` |
| `src/cloud-orchestrator/function_app.py` | source / config | `f5818a606535e227…` |
| `src/cloud-orchestrator/llm_provider.py` | source / config | `1d93cbf0f2991f57…` |
| `src/cloud-orchestrator/local.settings.example.json` | source / config | `55380e0585df9254…` |
| `src/cloud-orchestrator/openai_config.py` | source / config | `d0eacf8cb585db01…` |
| `src/cloud-orchestrator/requirements.txt` | source / config | `e1b61ba2f1a498c6…` |
| `src/cloud-orchestrator/scenario_registry.json` | source / config | `e8bd83acbb8e50e2…` |
| `tests/test_benchmark_archives.py` | test | `6dd2907e7a2c81f6…` |
| `tests/test_benchmark_scenarios.py` | test | `4f3d884712f4dd5f…` |
| `tests/test_brain.py` | test | `a925ff6aa486325e…` |

## Where the prompts live (all verbatim in the archived files)

See `PROMPT_LOCATIONS.md`. The production router uses the terse prompts in `scenario_registry.json`; the historical benchmarks used a different, more descriptive prompt defined inside `benchmark.py`. So the historical accuracies were **not** measured with the production prompt.

## What this archive does not contain, on purpose

- **No fresh measurement of baseline A.** D0 forbids model calls. Baseline A can still be measured later from the tagged code in a clean worktree (`git worktree add ../baseline-a eval-baseline-v1`), with the same model and settings. Until then, baseline A is **"not measured"**, not zero and not the historical number.
- **No test set, no labels, no new code.** Those start after D0.

## Historical results: provenance only

| Run | Model recorded | Seed | Scenarios | Note |
|---|---|---|---|---|
| `2026-07-16-thesis-200` | "DeepSeek V4 Flash" (free text in `summary.json`) | 42 | 200 | legacy v2 labels (critical = 5–50 cm); 162/172 router-parseable |
| `2026-08-18-diagnostic-60` | **"unknown"** (`report.txt`) | 42 | 60 | partial run; 47/52 router-parseable |

They use legacy 3-class labels, a label policy that disagrees with the 30 cm safety rule, and different scenario sets. **They are not a starting point for any before/after claim.** `benchmark_results/README.md` (archived) states the same limits.

## Observations by the implementer (not archived as artifacts)

1. The router's "sensor error" decision is a **substring test** on the model's reply: `brain.py` lines 109 and 305 and `benchmark.py` line 125 (archived copies). A reply that merely contains the words triggers the short-circuit.
2. The archived `local.settings.example.json` defaults to Azure OpenAI; the machine used for the work runs DeepSeek (below).
3. On 2026-11-06 the implementer regenerated the 200 scenarios with `random.seed(42)` and the generator from commit `a5bf9c7`; only 1 of 200 matched `results.csv`. No artifact was kept, so treat this as an unverified note that the acceptance reviewer may re-check.

## Environment at D0 (no secrets)

| Item | Value |
|---|---|
| OS / Python / git | macOS 15.7.3 / Python 3.13.7 / git 2.50.1 (Apple Git-155) |
| LLM provider setting | `deepseek` |
| Base URL | `https://api.deepseek.com` |
| Model name | `deepseek-v4-flash` |
| Source | the untracked, git-ignored `local.settings.json` on this machine; the API key is deliberately not recorded |

The model name above is the configuration found on the machine at D0. It is not proof of which model produced the historical results.

## Files added by D0

`eval/baseline_v1/` only: `original/` (copies), `SHA256SUMS`, `MANIFEST.md`, `PROMPT_LOCATIONS.md`, `verify.sh`. No file outside `eval/` was changed.
