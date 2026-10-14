---
id: "DOC-EVIDENCE-CLAUDE-LINKEDIN"
title: "Claude Handoff for the Simulated AGV Project and Benchmark"
summary: "Source-backed project and writing brief covering the simulated AGV architecture, evidence boundaries, benchmark history, and safe LinkedIn claims."
version: "1.1.0"
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
  - "src/client-edge/src/app/dashboard/"
  - "src/cloud-orchestrator/embodied_brain/benchmark.py"
  - "src/cloud-orchestrator/embodied_brain/benchmark_scenarios.py"
  - "src/cloud-orchestrator/embodied_brain/brain.py"
  - "src/cloud-orchestrator/edge-simulator/device_mock.py"
test_refs:
  - "tests/test_benchmark_archives.py"
  - "tests/test_benchmark_scenarios.py"
---
# Claude Handoff for the Simulated AGV Project and Benchmark

## Instructions to Claude

Read this entire file before rewriting the LinkedIn post. Treat it as the writing contract for both the project description and benchmark claims.

The goal is not to make the project sound more dramatic. The goal is to tell a technically honest story that survives review by an interviewer who asks for the raw data.

Do not merge numbers from different runs. Do not describe a Router disagreement as an unsafe final action. Do not name a model for the 60-scenario run. Do not imply that the current v3 protocol has already been executed.

## Project in one sentence

OmniGuard is a research and engineering demonstrator for one question: where may an AI-agent pipeline participate when its output can affect a moving machine, and where must deterministic local controls take over?

The machine is a simulated automated guided vehicle (AGV). The repository contains browser motion simulations, a cloud-hostable three-agent decision pipeline, a software device simulator, Azure infrastructure templates, and preserved benchmark evidence. It does not contain a physical robot deployment or a certified safety controller.

## The research question

An AGV continues moving while a remote model is receiving telemetry, routing intent, checking policy, and producing an action. That turns software latency into physical distance:

    distance travelled while waiting = vehicle speed × decision latency

The project explores three connected questions:

1. How much distance can a moving machine cover while waiting for a cloud decision?
2. Which decisions can safely be stopped early or handled by deterministic/local logic?
3. How should a multi-agent pipeline be evaluated when classification accuracy, final action, latency, and policy thresholds can disagree?

The formula is a simplified design model. It is not a new physical theorem and does not include full braking dynamics, sensor uncertainty, vehicle mass, surface conditions, actuator failure, or certification requirements.

## What the project actually contains

### 1. Browser-side AGV motion simulation

The routes `/dashboard`, `/dashboard/theorem`, and `/dashboard/compare` use browser animation and configured values to visualize an AGV moving toward a wall or clearance boundary.

They compare:

- a cloud-only control interval;
- a cloud-plus-edge interval;
- a token-heavy cloud interval whose delay is calculated from network latency, prompt and completion tokens, and token throughput.

The shared model calculates cloud delay as network round-trip time plus token generation time. It calculates distance travelled during an unchecked interval as speed multiplied by latency. The values such as 20 ms edge latency, 15 ms brake delay, or a 5,000 ms cloud spike are scenario inputs. They are not benchmark observations or hardware measurements.

This layer is useful for explaining why latency matters physically. It does not call the benchmark and does not prove the safety of any real vehicle.

### 2. Three-stage embodied-brain pipeline

The Python backend implements this decision path:

    telemetry
       |
       v
    deterministic physical pre-check
       |
       v
    Router Agent ---- sensor error ----> stop
       |
       v
    Safety Agent ---- policy block ----> stop / safety override
       |
       v
    Action Compiler -------------------> structured action array

The roles are deliberately separated:

- **Physical pre-check:** deterministic conditions such as zero HP or critically low battery halt before model calls.
- **Router:** classifies the telemetry into the configured tenant vocabulary.
- **Safety:** compares telemetry and Router intent against tenant policy. A block short-circuits the Compiler.
- **Action Compiler:** returns a structured action only after the earlier gates pass.

Early exit is therefore an architectural behavior, not a separate model: invalid hardware state, sensor error, or a safety block can avoid the final and most expensive agent call.

The pipeline currently invokes its LLM stages serially. That makes the measured long tail especially important: a slow Compiler is added after the Router and Safety calls rather than hidden behind parallel work.

### 3. Live dashboard and HTTP experiment path

The `/dashboard/live` route is different from the pure browser simulations. It posts a telemetry snapshot and optional prompt/rule/schema overrides to `/api/simulate_agent`, then displays:

- the Router, Safety, and Compiler trace;
- the final structured action;
- backend-reported stage timing and total latency;
- a software physical-twin visualization.

When a configured backend and model provider are reachable, this path can make real model calls. The vehicle state and movement remain software simulation. A successful request demonstrates that named runtime path only; it does not prove that the displayed Azure topology is currently deployed or that a physical actuator received the result.

### 4. IoT/Azure reference path

The repository also includes a software device simulator and Azure-oriented code for this flow:

    Python device simulator
       -> MQTT / Azure IoT Hub
       -> Event Hub-compatible stream
       -> Azure Functions trigger
       -> Cosmos DB device-state record
       -> Router / Safety / Compiler when awakened
       -> cloud-to-device message
       -> device simulator prints the returned action

The Python device simulator emits synthetic telemetry once per second and logs cloud-to-device messages. It is not a physical AGV or motor controller. Bicep files describe deployment options, but source code alone is not evidence that a live Azure environment exists at publication time.

### 5. Multi-tenant policy demonstration

The scenario registry includes different tenant vocabularies, rules, and action schemas, for example a data-center patrol scenario and a hospital-delivery scenario. This demonstrates configuration separation. It should not be described as production fleet tenancy, formal policy enforcement, or a validated hospital deployment.

### 6. Reproducible benchmark layer

The benchmark sends seeded telemetry scenarios through the agent path and preserves per-stage outcomes. Its purpose is to evaluate:

- Router classification against a named label definition;
- early exits and which stage caused them;
- final action safety separately from Router accuracy;
- per-stage and end-to-end latency;
- run metadata such as seed, model, temperature, requested count, and completed count.

The benchmark and browser dashboard answer different questions. Dashboard milliseconds are configured simulation inputs; benchmark seconds are observations from a named model run.

## Three evidence levels Claude must keep separate

| Evidence level | Examples in this project | Safe wording |
|---|---|---|
| Implemented | Router/Safety/Compiler code, short circuits, HTTP endpoint, device simulator, Bicep templates | “The repository implements…” |
| Simulated or configured | Browser motion, 20 ms edge interval, 15 ms brake delay, cloud-spike presets | “The simulation assumes/shows…” |
| Measured | The named 200-run and 60-run benchmark artifacts | “The named run measured…” |

Planned work, including the current v3 benchmark protocol before a live execution, needs a fourth phrase: “the protocol is designed to…”

## What this project does and does not establish

It does establish that:

- latency can be translated into a visible distance budget under explicit assumptions;
- a serial cloud-agent pipeline can exhibit a severe latency tail;
- deterministic pre-checks and agent short circuits can avoid downstream model calls;
- aggregate Router accuracy can conceal definition and system-outcome problems;
- preserving run metadata and raw rows is necessary for credible evaluation.

It does not establish that:

- a physical AGV was controlled;
- the system is safe for deployment;
- the simulated edge interval was measured on edge hardware;
- every Azure component is currently live;
- cloud AI is universally unsuitable for robotics;
- the LLM should be the final hard real-time safety controller.

The defensible design conclusion is narrower: cloud agents may help with interpretation, policy, planning, and audit, but hard real-time stopping needs a bounded deterministic/local safety path.

## Important implementation boundary discovered during review

The repository has several experimental paths rather than one production-identical path. In particular, the Event Hub trigger currently wakes the model pipeline only when obstacle distance is below 15 cm, while the Tenant-Alpha Safety prompt describes a below-30 cm blocking rule. The HTTP experiment and benchmark have their own invocation semantics.

This mismatch does not invalidate the archived benchmark, but it means Claude must not write that every dashboard, benchmark, and IoT route is one identical end-to-end production control loop. A useful project description is “a set of linked experiments around the same cloud-edge safety question.” Aligning these thresholds is future engineering work.

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

Do not force the full architecture and the full benchmark correction into one crowded post. The cleanest structure is a two-post sequence:

1. **Project post:** introduce the simulated AGV, the physical meaning of latency, the cloud/edge split, and the three-stage agent design.
2. **Evaluation post:** use “I audited my own benchmark and found the metric was wrong” as the hook.

If only one post will be published, use the evaluation post and keep the project overview to two or three sentences. It has a clearer personal lesson and stronger evidence than a feature inventory.

### Project-post message

The project post should make this architecture decision explicit:

> The AI agents are not presented as a certified emergency-stop controller. They explore semantic routing, policy review, planning, and audit around a simulated moving system; bounded local logic remains the appropriate place for hard real-time stopping.

Avoid turning the post into a list of Azure services. Mention IoT Hub, Event Hub, Functions, Cosmos DB, and cloud-to-device messaging only to explain the reference data path. The human story is the change in perspective: latency stopped being an API metric and became distance travelled by a machine.

### Evaluation-post message

Use “I audited my own benchmark and found the metric was wrong” as the hook.

That angle demonstrates:

- evaluation discipline;
- willingness to correct an attractive but unsupported conclusion;
- understanding of classification versus end-to-end system behavior;
- awareness of tail latency;
- concrete methodology improvement.

It also connects naturally to AI-300: evaluation requires meaningful labels, error-direction analysis, operational metrics, and traceable evidence—not one aggregate score.

## Recommended project-overview English draft

### When AI latency becomes physical distance

For my thesis, I have been exploring a practical embodied-AI question: where can an AI-agent pipeline sit when its output may affect a moving machine?

I built OmniGuard around a simulated AGV—not a physical robot. A browser simulation turns decision delay into distance travelled. A three-stage cloud pipeline routes telemetry, checks tenant safety policy, and compiles a structured action. Deterministic pre-checks and early exits can halt the path before the most expensive agent runs.

I also built a reference Azure flow around it: a Python device simulator sends synthetic telemetry through IoT Hub and an Event Hub-compatible trigger; the backend can persist device state in Cosmos DB and send a cloud-to-device action back to the simulator. The live dashboard exposes the agent trace and timing, while separate browser views compare cloud-only, cloud-plus-edge, and token-heavy control intervals.

The most useful shift in my thinking was simple: latency is not only an API number. At constant speed, distance travelled while waiting is speed × latency. Once a machine is moving, the tail of the latency distribution matters more than a comfortable average.

That does not mean an LLM should become an emergency-stop controller. My design conclusion is the opposite: use cloud agents for interpretation, policy, planning, and audit; keep hard real-time stopping in a bounded deterministic or local path.

The project also taught me to be stricter about evidence. Browser timings are simulation inputs. Benchmark timings belong to named model runs. Infrastructure templates show an intended topology, not proof of a currently deployed production system.

(Research demonstrator; no physical robot or safety certification. Implementation built with AI coding assistants; experiment design and analysis are mine.)

## Short project-overview alternative

For my thesis, I built a research demonstrator around a simulated AGV to ask where AI agents can—and cannot—sit in a moving-machine control loop.

The project combines a browser motion simulation, a Router → Safety → Action Compiler pipeline, deterministic early exits, and an Azure reference path using synthetic IoT telemetry. Its central model is simple: at constant speed, decision latency becomes distance travelled.

The conclusion is not “put an LLM in charge of emergency stopping.” Cloud agents can help with interpretation, policy, planning, and audit, while hard real-time stopping needs bounded local logic.

I am also treating evidence more carefully: dashboard values are simulated, benchmark latency comes from named runs, and infrastructure code is not proof of a live production deployment.

(Simulated AGV; no physical robot or safety certification.)

## Recommended benchmark-audit English draft

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

    First decide whether the requested LinkedIn post is a project overview or a benchmark-audit post; do not combine every detail into one feature list. Rewrite the corresponding recommended draft for an AI engineering audience. Preserve the boundaries between implemented, simulated, measured, and planned claims. For a benchmark post, preserve every numeric denominator and limitation and do not reintroduce the “five dangerous misses” interpretation. Keep the tone reflective rather than promotional. Connect the evaluation lesson to AI-300 where natural. Return one main version and one version under 1,200 characters.

## Authoritative source map

- [Project overview and boundaries](../../README.md)
- [Current architecture](../../ARCHITECTURE.md)
- [Dashboard semantics](../dashboard/00-overview.md)
- [Browser physics kernel](../../src/client-edge/src/app/shared/physics/kinematic-token.ts)
- [Embodied-brain implementation](../../src/cloud-orchestrator/embodied_brain/brain.py)
- [Tenant scenario registry](../../src/cloud-orchestrator/scenario_registry.json)
- [Software device simulator](../../src/cloud-orchestrator/edge-simulator/device_mock.py)
- [Azure reference templates](../../.azure/main.bicep)
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

- Describe the AGV as simulated and the project as a research demonstrator.
- Separate browser simulation inputs from measured benchmark values.
- Do not treat Bicep templates as proof of a currently live deployment.
- Do not imply that a cloud LLM is the certified hard real-time safety controller.
- If describing all execution paths, acknowledge that they are linked experiments, not identical production flows.
- Name which run each number comes from.
- Say 60 was a diagnostic run, not the completed thesis run.
- Keep the 35-case denominator beside diagnostic latency.
- Do not name the diagnostic model.
- Do not call the five Router disagreements unsafe actions.
- Do not call v3 completed.
- Keep the AI-assistant attribution if desired.
- If the post is shortened, preserve the correction before preserving promotional language.
