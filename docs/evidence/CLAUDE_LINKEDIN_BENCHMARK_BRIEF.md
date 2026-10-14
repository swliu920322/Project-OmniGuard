---
id: "DOC-EVIDENCE-CLAUDE-LINKEDIN"
title: "Claude Handoff for the AGV Benchmark LinkedIn Post"
summary: "Source-backed writing brief that reconciles the 200-run and 60-run benchmark results and prevents unsafe or unsupported LinkedIn claims."
version: "1.0.0"
updated_at: "2026-10-14"
authors: ["Shengwei Liu"]
domains:
  - cyber-physical-safety
  - multi-agent
perspectives:
  - academic-research
  - product-strategy
layers:
  - cross-cutting
doc_type: specification
status: accepted
code_refs:
  - "src/cloud-orchestrator/embodied_brain/benchmark.py"
  - "src/cloud-orchestrator/embodied_brain/benchmark_scenarios.py"
test_refs:
  - "tests/test_benchmark_archives.py"
  - "tests/test_benchmark_scenarios.py"
---
# Claude Handoff for the AGV Benchmark LinkedIn Post

## Instructions to Claude

Read this entire file before rewriting the LinkedIn post. Treat it as the writing contract for benchmark claims.

The goal is not to make the project sound more dramatic. The goal is to tell a technically honest story that survives review by an interviewer who asks for the raw data.

Do not merge numbers from different runs. Do not describe a Router disagreement as an unsafe final action. Do not name a model for the 60-scenario run. Do not imply that the current v3 protocol has already been executed.

## The strongest defensible story

The most valuable finding is not “the model missed five dangerous obstacles.”

The audit showed that the evaluation itself had a safety-relevant definition error:

- the old scenario generator labeled every obstacle from 5 to 50 cm as critical;
- the runtime safety policy blocked only distances below 30 cm;
- the five Router disagreements were at 31, 39, 41, 42, and 46 cm;
- all five were above the blocking threshold;
- the Compiler still returned a stop action for all five;
- all eight diagnostic scenarios below 30 cm were recognized and blocked.

Therefore, 9/14 or 64.29% is recall against a legacy broad label, not evidence that five unsafe commands reached an actuator.

The LinkedIn lesson should be:

> An evaluation schema is part of the safety system. Accuracy is not a release gate unless labels match policy, error direction is inspected, final actions are evaluated, and tail latency is visible.

This is a better AI-300 connection than an exaggerated “five dangerous misses” claim.

## The three benchmark states

### 1. Historical thesis run: 2026-07-16

This is the source of the older thesis/interview numbers.

| Field | Value |
|---|---:|
| Actual scenarios | 200 |
| Recorded model | DeepSeek V4 Flash |
| Seed | 42 |
| Actual class mix | 111 normal, 38 critical, 51 sensor error |
| Router denominator | 172; 28 scenarios stopped before Router |
| Router accuracy | 162/172, 94.19% |
| Early exits before Compiler | 79/200, 39.5% |
| Full-pipeline cases | 121 |
| Full-pipeline median | 5.680 s |
| Full-pipeline mean | 6.174 s |
| Full-pipeline maximum | 16.391 s |
| Estimated mean latency avoided per early exit | 4.613 s |

Important limitations:

- class counts came from weighted random sampling, not an exact 100/50/50 split;
- the generator used the broad 5–50 cm critical label;
- the safety policy used a below-30 cm blocking threshold;
- the preserved historical summary cannot reconstruct modern final-action safety metrics;
- the 4.613-second saving is a counterfactual estimate using mean downstream-stage latency, not directly observed time for calls that were skipped.

The 6.174-second number is legitimate. It comes from this historical run and is the mean across 121 full-pipeline PASS cases. It was missing from the later 60-row artifact because that artifact is a different run.

### 2. Diagnostic run: 2026-08-18

This is the source of the newer 60-scenario and long-tail numbers.

| Field | Value |
|---|---:|
| Configured/requested count | 200 |
| Actual recorded scenarios | 60 |
| Seed | 42 |
| Temperature | 0.0 |
| Recorded model | unknown |
| Actual class mix | 29 normal, 14 legacy-critical, 17 sensor error |
| Physical halts before Router | 8 |
| Router denominator | 52 |
| Router accuracy | 47/52, 90.38% |
| Legacy-label critical recall | 9/14, 64.29% |
| Policy-critical cases below 30 cm | 8/8 recognized and blocked |
| Early exits before Compiler | 25/60, 41.67% |
| Full-pipeline cases | 35 |
| Full-pipeline median | 7.667 s |
| Full-pipeline mean | 16.721 s |
| Full-pipeline maximum | 73.892 s |
| Compiler median | 5.176 s |
| Compiler mean | 14.238 s |
| Compiler maximum | 71.191 s |

Why it must be called diagnostic:

- it recorded only 60 rows despite a requested count of 200;
- the model field is unknown;
- its class labels were not aligned with the runtime safety threshold;
- the Compiler distribution has a very long tail;
- it should not replace the complete historical thesis run.

### 3. Current v3 protocol

The v3 protocol fixes the methodology:

- exact 100 normal, 50 critical, and 50 sensor-error scenarios for a 200-scenario run;
- critical means 5–29 cm, aligned with the 30 cm safety threshold;
- every sensor-error scenario violates the temperature policy;
- provider, resolved model, planned count, completed count, seed, temperature, definition version, and run status are recorded;
- Router disagreement and unsafe final action are separate metrics;
- each run writes to a unique immutable directory.

The v3 protocol has not yet been run against a live model. Never describe it as a completed result.

## Why the old documents appeared inconsistent

The documents mixed two independent runs.

| Previously quoted value | Correct source |
|---|---|
| 200 scenarios | Historical thesis run |
| 94.19% Router accuracy | Historical thesis run |
| 39.5% early exit | Historical thesis run |
| 6.174 s mean cloud pipeline | Historical thesis run |
| 4.613 s estimated saving | Historical thesis run |
| 60 scenarios | Later diagnostic run |
| 90.38% Router accuracy | Later diagnostic run |
| 41.67% early exit | Later diagnostic run |
| 7.667 s median, 16.721 s mean, 73.892 s max | Later diagnostic run |
| 15.459 s estimated saving | Later diagnostic run, inflated by the Compiler tail |

The 200-row artifacts were moved out of the repository during an earlier documentation-system redesign. That made the historical numbers look unsupported when only the later 60-row file remained visible. The preserved historical summary and CSV have now been restored under a named run directory.

## Forensic interpretation of the five Router disagreements

The old report calls them “false negative passes.” That name is misleading because its definition stops at the Router/gate level and does not inspect the final action.

| Distance | Expected under legacy label | Router | Safety gate | Final Compiler action |
|---:|---|---|---|---|
| 31 cm | CRITICAL_OBSTACLE | NORMAL_NAV | PASS | stop + reroute |
| 39 cm | CRITICAL_OBSTACLE | NORMAL_NAV | PASS | stop + reroute |
| 41 cm | CRITICAL_OBSTACLE | NORMAL_NAV | PASS | stop |
| 42 cm | CRITICAL_OBSTACLE | NORMAL_NAV | PASS | stop + reroute |
| 46 cm | CRITICAL_OBSTACLE | NORMAL_NAV | PASS | stop + reroute |

Correct interpretation:

- these are five Router disagreements under the legacy broad label;
- they reveal that label definitions and runtime policy were misaligned;
- they are not five demonstrated end-to-end unsafe passes;
- no claim should be made about physical safety because this was a simulated AGV and no actuator was controlled.

## The latency finding that survives the audit

The long-tail result is real for the named diagnostic run.

Among 35 full-pipeline cases:

- median: 7.667 seconds;
- mean: 16.721 seconds;
- maximum: 73.892 seconds;
- Compiler maximum: 71.191 seconds;
- Compiler standard deviation: 19.071 seconds.

The mean is much higher than the median because a few Compiler calls were extremely slow. For a deadline-bound control loop, the tail is more informative than the average.

The statement “at 1 m/s, a 7.7-second decision corresponds to 7.7 m of travel” is a derived illustration using distance = speed × time. If used, label it as a simple assumption and not as measured vehicle travel.

## The early-exit finding

The diagnostic run stopped 25 of 60 scenarios before the Compiler, or 41.67%.

This supports a narrow claim:

> Early exit reduced the number of expensive Compiler calls.

It does not by itself prove:

- lower production cost;
- safer final actions;
- 15.459 seconds of real saving on every skipped request.

The reported 15.459-second average saving is a counterfactual calculation based on mean downstream latency. It is heavily affected by the 71-second Compiler outlier and should not be a LinkedIn headline.

## Known reporting bug

The diagnostic text report prints the Router confidence interval as:

    [0.83%, 0.98%]

The stored values are fractions that were given a percent sign without multiplication. The intended display is approximately 83%–98%.

Do not quote the malformed interval. If uncertainty is not central to the post, omit it.

## Claim review

| Candidate sentence | Verdict | Reason |
|---|---|---|
| “I ran 60 scenarios for my thesis.” | Do not use | The complete thesis run contains 200; 60 is a later incomplete diagnostic run. |
| “The Router was 90% accurate.” | Allowed with run and denominator | Say 47/52 in the 60-scenario diagnostic run. |
| “It caught only 9 of 14 dangerous obstacles.” | Do not use without qualification | 14 uses the misaligned 5–50 cm legacy label. |
| “Five dangerous cases were passed through.” | False/misleading | All five were above 30 cm and all final Compiler actions contained stop. |
| “There were no false alarms.” | Avoid as a broad claim | The report's false-positive definition is narrow and run-specific. |
| “All eight sub-30 cm cases were caught and blocked.” | Supported | Directly verified from the diagnostic records. |
| “Median latency was 7.7 s; worst case was 73.9 s.” | Supported | Applies to 35 full-pipeline diagnostic cases. |
| “At 1 m/s that is almost 8 m of travel.” | Allowed only as derived illustration | State the constant-speed assumption. |
| “42% exited before the Compiler.” | Supported | 25/60 diagnostic scenarios. |
| “The experiment used temperature 0.” | Supported for diagnostic run | Stored metadata says 0.0. |
| “The diagnostic run used model X.” | Do not use | Model metadata is unknown. |
| “The system proves cloud AI is unsafe.” | Do not use | The project demonstrates a risk and design constraint, not universal proof or certification. |

## Recommended LinkedIn angle

Use “I audited my own benchmark and found the metric was wrong” as the hook.

That angle demonstrates:

- evaluation discipline;
- willingness to correct an attractive but unsupported conclusion;
- understanding of classification versus end-to-end system behavior;
- awareness of tail latency;
- concrete methodology improvement.

It also connects naturally to AI-300: evaluation requires meaningful labels, error-direction analysis, operational metrics, and traceable evidence—not one aggregate score.

## Recommended English draft

### A small piece from my own work

For my thesis, I built a three-agent cloud pipeline for a simulated AGV: Router → Safety → Action Compiler. While preparing the results for publication, I audited a later 60-scenario diagnostic run—and found that the most dramatic conclusion was wrong.

The Router showed 90.4% accuracy and only 9/14 recall on scenarios labeled “critical.” At first glance, that looked like five dangerous misses.

But the labels and policy did not match. The old generator called every obstacle from 5–50 cm critical; the runtime policy blocked below 30 cm. All five disagreements were at 31–46 cm, and the Compiler still produced a stop action in every case. All eight scenarios below 30 cm were caught and blocked.

The latency result did survive the audit. Across 35 full-pipeline cases, median latency was 7.7 s, mean latency was 16.7 s, and the maximum was 73.9 s. The Compiler alone reached 71.2 s. Early exit prevented the Compiler from running in 25 of 60 scenarios.

My AI-300 takeaway: accuracy is not a release gate. Labels must match policy, error direction must be inspected, final actions must be evaluated, and tail latency must be visible.

I have since revised the protocol to use policy-aligned labels, fixed class counts, recorded model metadata, and separate Router errors from unsafe final actions.

(Simulated AGV, not a physical robot. Implementation built with AI coding assistants; experiment design and analysis are mine.)

## Shorter alternative

I audited a 60-scenario diagnostic run from my simulated AGV project and found a useful evaluation failure.

The headline metric said the Router caught only 9 of 14 “critical” obstacles. But the generator labeled 5–50 cm as critical while the safety policy blocked below 30 cm. The five disagreements were all at 31–46 cm, and every final Compiler output still said stop. All eight sub-30 cm cases were caught and blocked.

The latency problem was real: 7.7 s median, 16.7 s mean, and 73.9 s maximum across 35 full-pipeline cases.

The lesson: accuracy is not a release gate. Evaluation labels must match policy, and end-to-end outcomes and latency tails matter more than one aggregate score.

## Prompt to give Claude

Use the following instruction together with this file:

    Rewrite the recommended draft as a concise, technically credible LinkedIn post for an AI engineering audience. Preserve every numeric denominator and limitation in this brief. Do not reintroduce the “five dangerous misses” interpretation. Keep the tone reflective rather than promotional. Connect the lesson to AI-300 evaluation practice. Return one main version and one version under 1,200 characters.

## Authoritative source map

- [Canonical benchmark guide](../../src/cloud-orchestrator/embodied_brain/benchmark_results/README.md)
- [Historical 200-run summary](../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/summary.json)
- [Historical 200-run rows](../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-07-16-thesis-200/results.csv)
- [Diagnostic 60-run JSON](../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/results.json)
- [Diagnostic 60-run CSV](../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/results.csv)
- [Original diagnostic report](../../src/cloud-orchestrator/embodied_brain/benchmark_results/runs/2026-08-18-diagnostic-60/report.txt)
- [Current policy-aligned scenario protocol](../../src/cloud-orchestrator/embodied_brain/benchmark_scenarios.py)
- [Archive consistency tests](../../tests/test_benchmark_archives.py)
- [Scenario protocol tests](../../tests/test_benchmark_scenarios.py)

## Final pre-publication checklist

- Name which run each number comes from.
- Say 60 was a diagnostic run, not the completed thesis run.
- Keep the 35-case denominator beside diagnostic latency.
- Do not name the diagnostic model.
- Do not call the five Router disagreements unsafe actions.
- Say the AGV was simulated.
- Do not call v3 completed.
- Keep the AI-assistant attribution if desired.
- If the post is shortened, preserve the correction before preserving promotional language.
