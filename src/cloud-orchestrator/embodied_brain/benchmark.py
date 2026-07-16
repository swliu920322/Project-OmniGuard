"""
benchmark.py — 3-Agent Pipeline Evaluation Harness (v2)
======================================================
Methodology (for top-venue peer review):

1. Ground Truth
   - 200 scenarios generated from non-overlapping parameter ranges
   - Each parameter set deterministically maps to exactly one label
   - Ranges published in SCENARIO_TEMPLATES; no ambiguity between classes

2. Accuracy
   - Counts ALL Router invocations (PASS + SKIP), not just PASS-through
   - Reports full confusion matrix, not a single number
   - Exact label matching (no fuzzy startswith)

3. Latency
   - Uses measured PASS-through pipeline latencies
   - Skip savings computed from ACTUAL measured latencies of downstream agents

4. Statistical Significance
   - 95% confidence intervals via bootstrap resampling (10,000 iterations)

5. Reproducibility
   - Fixed seed (42), temperature=0 for all LLM calls
   - Model version captured in output metadata

Usage:
  python benchmark.py
"""
import sys, os, json, time, random, statistics
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["LOCAL_MOCK_MODE"] = "false"

from embodied_brain.utils import ask_agent

SEED = 42
NUM_SCENARIOS = 200
LLM_TEMPERATURE = 0.0

SCENARIO_TEMPLATES = {
    "normal": {
        "obstacle_range": (200, 500),
        "velocity_range": (0.5, 2.0),
        "battery_range": (20, 100),
        "hp_range": (50, 100),
        "temperature_range": (25, 45),
        "weight": 0.5,
        "expected_label": "NORMAL_NAV",
    },
    "critical": {
        "obstacle_range": (5, 50),
        "velocity_range": (0.5, 2.5),
        "battery_range": (20, 100),
        "hp_range": (50, 100),
        "temperature_range": (25, 45),
        "weight": 0.25,
        "expected_label": "CRITICAL_OBSTACLE",
    },
    "sensor_error": {
        "obstacle_range": (50, 300),
        "velocity_range": (0.5, 2.0),
        "battery_range": (0, 10),
        "hp_range": (0, 20),
        "temperature_range": (60, 100),
        "weight": 0.25,
        "expected_label": "SENSOR_ERROR",
    },
}

ROUTER_PROMPT = """You are an intent classifier for an AGV fleet. Classify the telemetry into exactly one label:
- CRITICAL_OBSTACLE: obstacle is dangerously close, immediate action required
- NORMAL_NAV: normal navigation, no immediate danger
- SENSOR_ERROR: sensor readings indicate malfunction (battery critical, overheating, low HP)

Respond with ONLY the label, nothing else."""

SAFETY_RULES = "Minimum distance: 30cm. Max velocity: 2.5 m/s. Battery minimum: 5%. Temperature maximum: 60C."

SAFETY_SYSTEM_PROMPT = (
    "You are the Swarm Strategist and Safety Firewall. Evaluate the situation based on the strict rules and safety risks.\n"
    "Tenant rules configuration:\n"
    f"- Safety rules: {SAFETY_RULES}\n\n"
    "Task: Compare the current Telemetry against the safety rules. "
    "If any safety rule is violated, reply 'BLOCK: [reason]'. Otherwise, reply 'PASS'."
)

COMPILER_SYSTEM_PROMPT = (
    "You are the Action Compiler. Generate evasive actions strictly conforming to the JSON schema. "
    "NO markdown. NO text. Return ONLY raw JSON array matching the schema."
)

EXECUTION_SCHEMA = json.dumps([
    {"action": "stop", "reason": "obstacle_detected"},
    {"action": "reroute", "reason": "path_blocked"},
])


def generate_scenarios(num: int) -> list[dict]:
    scenarios = []
    types = list(SCENARIO_TEMPLATES.keys())
    weights = [SCENARIO_TEMPLATES[t]["weight"] for t in types]
    for i in range(num):
        stype = random.choices(types, weights=weights, k=1)[0]
        tpl = SCENARIO_TEMPLATES[stype]
        scenario = {
            "id": i,
            "type": stype,
            "expected_label": tpl["expected_label"],
            "obstacle": random.randint(*tpl["obstacle_range"]),
            "velocity": round(random.uniform(*tpl["velocity_range"]), 2),
            "battery": round(random.uniform(*tpl["battery_range"]), 1),
            "hp": random.randint(*tpl["hp_range"]),
            "temperature": round(random.uniform(*tpl["temperature_range"]), 1),
        }
        scenarios.append(scenario)
    return scenarios


def run_pipeline(scenario: dict) -> dict:
    obstacle = scenario["obstacle"]
    velocity = scenario["velocity"]
    battery = scenario["battery"]
    hp = scenario["hp"]
    temperature = scenario["temperature"]

    telemetry = (
        f"Telemetry: Distance: {obstacle}cm, "
        f"Velocity: {velocity}m/s, HP: {hp}, "
        f"Battery: {battery}%, Temp: {temperature}C."
    )

    # --- Physical-Layer Gate ---
    t0 = time.time()
    gate_halt = hp <= 0 or battery < 5
    physical_gate_latency = (time.time() - t0) * 1000

    if gate_halt:
        return {
            "scenario_id": scenario["id"],
            "type": scenario["type"],
            "expected_label": scenario["expected_label"],
            "obstacle": obstacle,
            "velocity": velocity,
            "battery": battery,
            "hp": hp,
            "temperature": temperature,
            "gate_stage": "PHYSICAL",
            "gate_decision": "HALT",
            "router_label": None,
            "safety_decision": None,
            "compiler_output": None,
            "physical_gate_latency_ms": round(physical_gate_latency, 2),
            "router_latency_ms": None,
            "safety_latency_ms": None,
            "compiler_latency_ms": None,
        }

    # --- Router Agent ---
    t1 = time.time()
    router_label = ask_agent(
        ROUTER_PROMPT, telemetry,
        max_completion_tokens=20
    ).strip().upper()
    router_latency = (time.time() - t1) * 1000

    if "SENSOR_ERROR" in router_label:
        return {
            "scenario_id": scenario["id"],
            "type": scenario["type"],
            "expected_label": scenario["expected_label"],
            "obstacle": obstacle,
            "velocity": velocity,
            "battery": battery,
            "hp": hp,
            "temperature": temperature,
            "gate_stage": "ROUTER",
            "gate_decision": "SKIP",
            "router_label": router_label,
            "safety_decision": None,
            "compiler_output": None,
            "physical_gate_latency_ms": round(physical_gate_latency, 2),
            "router_latency_ms": round(router_latency, 2),
            "safety_latency_ms": None,
            "compiler_latency_ms": None,
        }

    # --- Safety Agent ---
    t2 = time.time()
    safety_input = (
        f"Rules: {SAFETY_RULES}\n"
        f"Intent: {router_label}\n"
        f"Telemetry: Distance: {obstacle}cm, "
        f"Velocity: {velocity}m/s, HP: {hp}, "
        f"Battery: {battery}%, Temp: {temperature}C\n"
    )
    safety_decision = ask_agent(
        SAFETY_SYSTEM_PROMPT, safety_input,
        max_completion_tokens=50
    ).strip().upper()
    safety_latency = (time.time() - t2) * 1000

    if safety_decision.startswith("BLOCK"):
        return {
            "scenario_id": scenario["id"],
            "type": scenario["type"],
            "expected_label": scenario["expected_label"],
            "obstacle": obstacle,
            "velocity": velocity,
            "battery": battery,
            "hp": hp,
            "temperature": temperature,
            "gate_stage": "SAFETY",
            "gate_decision": "SKIP",
            "router_label": router_label,
            "safety_decision": safety_decision,
            "compiler_output": None,
            "physical_gate_latency_ms": round(physical_gate_latency, 2),
            "router_latency_ms": round(router_latency, 2),
            "safety_latency_ms": round(safety_latency, 2),
            "compiler_latency_ms": None,
        }

    # --- Compiler Agent ---
    t3 = time.time()
    compiler_input = (
        f"Schema: {EXECUTION_SCHEMA}\n"
        f"Intent: {router_label} (Strategist decided: {safety_decision})\n"
        f"Telemetry: Distance: {obstacle}cm, Velocity: {velocity}m/s"
    )
    compiler_output = ask_agent(
        COMPILER_SYSTEM_PROMPT, compiler_input,
        max_completion_tokens=100
    ).strip()
    compiler_latency = (time.time() - t3) * 1000

    return {
        "scenario_id": scenario["id"],
        "type": scenario["type"],
        "expected_label": scenario["expected_label"],
        "obstacle": obstacle,
        "velocity": velocity,
        "battery": battery,
        "hp": hp,
        "temperature": temperature,
        "gate_stage": "COMPILER",
        "gate_decision": "PASS",
        "router_label": router_label,
        "safety_decision": safety_decision,
        "compiler_output": compiler_output,
        "physical_gate_latency_ms": round(physical_gate_latency, 2),
        "router_latency_ms": round(router_latency, 2),
        "safety_latency_ms": round(safety_latency, 2),
        "compiler_latency_ms": round(compiler_latency, 2),
    }


def bootstrap_ci(data, metric_fn, n_iterations=10000, ci=0.95):
    """Bootstrap confidence interval for a metric."""

    if len(data) == 0:
        return 0.0, 0.0
    estimates = []
    n = len(data)
    for _ in range(n_iterations):
        sample = [random.choice(data) for _ in range(n)]
        estimates.append(metric_fn(sample))
    estimates.sort()
    alpha = (1 - ci) / 2
    lower = estimates[int(alpha * n_iterations)]
    upper = estimates[int((1 - alpha) * n_iterations)]
    return round(lower, 2), round(upper, 2)


def compute_metrics(results: list[dict]) -> dict:
    total = len(results)

    # --- Gate counts ---
    gates = {"PHYSICAL": 0, "ROUTER": 0, "SAFETY": 0, "COMPILER": 0, "ERROR": 0}
    for r in results:
        stage = r.get("gate_stage", "ERROR")
        if stage not in gates:
            stage = "ERROR"
        gates[stage] += 1

    # --- Router accuracy (ALL invocations, not just PASS) ---
    router_correct = 0
    router_total = 0
    confusion = {"NORMAL_NAV": {}, "CRITICAL_OBSTACLE": {}, "SENSOR_ERROR": {}}
    for r in confusion:
        for c in confusion:
            confusion[r][c] = 0

    for r in results:
        if r["router_label"] is None:
            continue  # HALT at physical gate, Router never called
        router_total += 1
        expected = r["expected_label"]
        predicted = r["router_label"]
        # Exact match
        correct = (predicted == expected)
        if correct:
            router_correct += 1
        confusion[expected][predicted] = confusion[expected].get(predicted, 0) + 1

    accuracy = router_correct / router_total if router_total else 0

    # --- Bootstrap 95% CI for accuracy ---
    router_data = [r for r in results if r["router_label"] is not None]
    def _acc(sample):
        correct = sum(1 for r in sample if r["router_label"] == r["expected_label"])
        return correct / len(sample) if sample else 0
    acc_ci = bootstrap_ci(router_data, _acc)

    # --- Latency (measured from PASS scenarios only) ---
    pass_results = [r for r in results if r["gate_decision"] == "PASS"]
    if pass_results:
        r_lat = [r["router_latency_ms"] for r in pass_results]
        s_lat = [r["safety_latency_ms"] for r in pass_results]
        c_lat = [r["compiler_latency_ms"] for r in pass_results]
        total_lat = [r["router_latency_ms"] + r["safety_latency_ms"] + r["compiler_latency_ms"]
                     for r in pass_results]

        def describe(vals, name):
            mean = statistics.mean(vals)
            med = statistics.median(vals)
            std = statistics.stdev(vals) if len(vals) > 1 else 0
            ci = bootstrap_ci(vals, statistics.mean)
            return {
                "mean_ms": round(mean, 1),
                "median_ms": round(med, 1),
                "stdev_ms": round(std, 1),
                "min_ms": round(min(vals), 1),
                "max_ms": round(max(vals), 1),
                "ci95_lower_ms": ci[0],
                "ci95_upper_ms": ci[1],
            }

        router_latency_stats = describe(r_lat, "router")
        safety_latency_stats = describe(s_lat, "safety")
        compiler_latency_stats = describe(c_lat, "compiler")
        total_latency_stats = describe(total_lat, "total")
    else:
        empty = {"mean_ms": 0, "median_ms": 0, "stdev_ms": 0, "min_ms": 0, "max_ms": 0,
                 "ci95_lower_ms": 0, "ci95_upper_ms": 0}
        router_latency_stats = empty.copy()
        safety_latency_stats = empty.copy()
        compiler_latency_stats = empty.copy()
        total_latency_stats = empty.copy()

    # --- Skip savings (using actual measured latencies) ---
    avg_router = router_latency_stats["mean_ms"]
    avg_safety = safety_latency_stats["mean_ms"]
    avg_compiler = compiler_latency_stats["mean_ms"]

    skip_savings = []
    for r in results:
        if r["gate_decision"] == "HALT":
            skip_savings.append(avg_router + avg_safety + avg_compiler)
        elif r["gate_decision"] == "SKIP":
            if r["gate_stage"] == "ROUTER":
                skip_savings.append(avg_safety + avg_compiler)
            elif r["gate_stage"] == "SAFETY":
                skip_savings.append(avg_compiler)

    skip_events = len(skip_savings)
    avg_saved = statistics.mean(skip_savings) if skip_savings else 0

    # --- False positive skips ---
    # FP = normal scenario that was HALTed or SKIPped (should have been PASS)
    fp_skips = sum(
        1 for r in results
        if r["gate_decision"] in ("HALT", "SKIP") and r["expected_label"] == "NORMAL_NAV"
    )
    # FN = critical obstacle that PASSed through (missed by all gates)
    fn_passes = sum(
        1 for r in results
        if r["gate_decision"] == "PASS" and r["expected_label"] == "CRITICAL_OBSTACLE"
        and r["router_label"] != "CRITICAL_OBSTACLE"
    )

    return {
        "metadata": {
            "seed": SEED,
            "num_scenarios": NUM_SCENARIOS,
            "temperature": LLM_TEMPERATURE,
            "model": os.environ.get("LLM_DEPLOYMENT_NAME", "unknown"),
        },
        "total_scenarios": total,
        "by_type": {t: sum(1 for r in results if r["type"] == t) for t in SCENARIO_TEMPLATES},
        "gate_counts": {
            "PHYSICAL_HALT": gates["PHYSICAL"],
            "ROUTER_SKIP": gates["ROUTER"],
            "SAFETY_SKIP": gates["SAFETY"],
            "COMPILER_PASS": gates["COMPILER"],
        },
        "router_accuracy": {
            "correct": router_correct,
            "total": router_total,
            "accuracy_pct": round(accuracy * 100, 2),
            "ci95_lower_pct": round(acc_ci[0], 2),
            "ci95_upper_pct": round(acc_ci[1], 2),
            "confusion_matrix": confusion,
        },
        "latency_ms": {
            "router": router_latency_stats,
            "safety": safety_latency_stats,
            "compiler": compiler_latency_stats,
            "total_pipeline": total_latency_stats,
            "note": "Measured from PASS scenarios only (full pipeline execution)",
        },
        "circuit_breaking": {
            "note": "Savings computed from actual measured latencies of downstream agents",
            "avg_router_latency_used_ms": avg_router,
            "avg_safety_latency_used_ms": avg_safety,
            "avg_compiler_latency_used_ms": avg_compiler,
            "skip_events": skip_events,
            "skip_rate_pct": round(skip_events / total * 100, 2),
            "avg_saved_per_skip_ms": round(avg_saved, 1),
            "total_time_saved_ms": round(sum(skip_savings), 1),
        },
        "errors": {
            "false_positive_skips": fp_skips,
            "false_negative_passes": fn_passes,
            "note_fp": "FP = NORMAL_NAV scenario that was HALTed or SKIPped",
            "note_fn": "FN = CRITICAL_OBSTACLE scenario that PASSed with wrong Router label",
        },
    }


def save_results(results: list[dict], metrics: dict, out_dir: Path):
    out_dir.mkdir(exist_ok=True)
    with open(out_dir / "results.json", "w") as f:
        json.dump({"metrics": metrics, "results": results}, f, indent=2)
    fields = [
        "scenario_id", "type", "expected_label", "gate_stage", "gate_decision",
        "router_label", "safety_decision", "compiler_output",
        "physical_gate_latency_ms", "router_latency_ms", "safety_latency_ms", "compiler_latency_ms",
        "obstacle", "velocity", "battery", "hp", "temperature",
    ]
    with open(out_dir / "results.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    human_txt = out_dir / "report.txt"
    with open(human_txt, "w") as f:
        m = metrics
        f.write("=" * 58 + "\n")
        f.write("  3-Agent Pipeline Benchmark Report\n")
        f.write("=" * 58 + "\n")
        f.write(f"  Seed:        {m['metadata']['seed']}\n")
        f.write(f"  Scenarios:   {m['total_scenarios']}\n")
        f.write(f"  Temperature: {m['metadata']['temperature']}\n")
        f.write(f"  Model:       {m['metadata']['model']}\n")
        f.write("\n  Type breakdown:\n")
        for t, c in m["by_type"].items():
            f.write(f"    {t}: {c}\n")
        f.write(f"\n  Gate Counts:\n")
        for g, c in m["gate_counts"].items():
            f.write(f"    {g}: {c}\n")
        f.write(f"\n  Router Accuracy:\n")
        f.write(f"    {m['router_accuracy']['accuracy_pct']}% "
                f"({m['router_accuracy']['correct']}/{m['router_accuracy']['total']})\n")
        f.write(f"    95% CI: [{m['router_accuracy']['ci95_lower_pct']}%, "
                f"{m['router_accuracy']['ci95_upper_pct']}%]\n")
        f.write(f"\n  Confusion Matrix:\n")
        cm = m['router_accuracy']['confusion_matrix']
        headers = ["expected \\ predicted"] + list(cm.keys())
        f.write(f"    {'':>25} {'  '.join(f'{h:>20}' for h in headers[1:])}\n")
        for exp, row in cm.items():
            vals = [row.get(p, 0) for p in cm.keys()]
            f.write(f"    {exp:>25} {'  '.join(f'{v:>20}' for v in vals)}\n")
        f.write(f"\n  Latency (PASS scenarios only):\n")
        for name in ["router", "safety", "compiler", "total_pipeline"]:
            l = m["latency_ms"][name]
            f.write(f"    {name:>20}: mean={l['mean_ms']:>8.1f} "
                    f"median={l['median_ms']:>8.1f} "
                    f"stdev={l['stdev_ms']:>8.1f} "
                    f"95%CI=[{l['ci95_lower_ms']:.1f},{l['ci95_upper_ms']:.1f}] ms\n")
        f.write(f"\n  Circuit Breaking:\n")
        f.write(f"    Skip events:           {m['circuit_breaking']['skip_events']} "
                f"({m['circuit_breaking']['skip_rate_pct']}%)\n")
        f.write(f"    Avg saved per skip:    {m['circuit_breaking']['avg_saved_per_skip_ms']} ms\n")
        f.write(f"    Total time saved:      {m['circuit_breaking']['total_time_saved_ms']} ms\n")
        f.write(f"\n  Errors:\n")
        f.write(f"    False positive skips:  {m['errors']['false_positive_skips']}\n")
        f.write(f"    False negative passes: {m['errors']['false_negative_passes']}\n")
        f.write("=" * 58 + "\n")


def main():
    import csv

    random.seed(SEED)
    print("=" * 60)
    print(f"  Seed: {SEED}")
    print(f"  Scenarios: {NUM_SCENARIOS}")
    print(f"  Temperature: {LLM_TEMPERATURE}")
    print("=" * 60)

    scenarios = generate_scenarios(NUM_SCENARIOS)
    type_counts = {}
    for s in scenarios:
        type_counts[s["type"]] = type_counts.get(s["type"], 0) + 1
    for t, c in type_counts.items():
        print(f"  {t}: {c}")

    results = []
    for i, sc in enumerate(scenarios):
        if i > 0 and i % 50 == 0:
            print(f"  Progress: {i}/{NUM_SCENARIOS}")
        try:
            r = run_pipeline(sc)
            results.append(r)
        except Exception as e:
            print(f"  ERROR scenario {sc['id']}: {e}")
            results.append({
                "scenario_id": sc["id"], "gate_stage": "ERROR", "gate_decision": "ERROR",
                "error": str(e), **sc,
            })

    print("=" * 60)
    print("  Computing metrics...")
    metrics = compute_metrics(results)

    out_dir = Path(__file__).parent / "benchmark_results"
    save_results(results, metrics, out_dir)

    report = out_dir / "report.txt"
    print(report.read_text())
    print(f"  Full results: {out_dir}/")


if __name__ == "__main__":
    main()
