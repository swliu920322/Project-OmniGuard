"""
benchmark_no_safety.py — Ablation: 3-Agent Pipeline WITHOUT Safety Gate
Router → Compiler (no Safety agent, no Safety BLOCK).
Same 200 scenarios as benchmark.py, temperature=0.

Purpose: Isolate the Safety gate's contribution.
"""
import sys, os, json, time, random, statistics
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
os.environ["LOCAL_MOCK_MODE"] = "false"

from embodied_brain.utils import ask_agent

SEED = 42
NUM_SCENARIOS = 200

SCENARIO_TEMPLATES = {
    "normal": {
        "obstacle_range": (200, 500), "velocity_range": (0.5, 2.0),
        "battery_range": (20, 100), "hp_range": (50, 100),
        "temperature_range": (25, 45), "weight": 0.5, "expected_label": "NORMAL_NAV",
    },
    "critical": {
        "obstacle_range": (5, 50), "velocity_range": (0.5, 2.5),
        "battery_range": (20, 100), "hp_range": (50, 100),
        "temperature_range": (25, 45), "weight": 0.25, "expected_label": "CRITICAL_OBSTACLE",
    },
    "sensor_error": {
        "obstacle_range": (50, 300), "velocity_range": (0.5, 2.0),
        "battery_range": (0, 10), "hp_range": (0, 20),
        "temperature_range": (60, 100), "weight": 0.25, "expected_label": "SENSOR_ERROR",
    },
}

ROUTER_PROMPT = """You are an intent classifier for an AGV fleet. Classify the telemetry into exactly one label:
- CRITICAL_OBSTACLE: obstacle is dangerously close, immediate action required
- NORMAL_NAV: normal navigation, no immediate danger
- SENSOR_ERROR: sensor readings indicate malfunction (battery critical, overheating, low HP)

Respond with ONLY the label, nothing else."""

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
        scenarios.append({
            "id": i, "type": stype, "expected_label": tpl["expected_label"],
            "obstacle": random.randint(*tpl["obstacle_range"]),
            "velocity": round(random.uniform(*tpl["velocity_range"]), 2),
            "battery": round(random.uniform(*tpl["battery_range"]), 1),
            "hp": random.randint(*tpl["hp_range"]),
            "temperature": round(random.uniform(*tpl["temperature_range"]), 1),
        })
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

    # Physical-Layer Gate (same as full pipeline)
    t0 = time.time()
    gate_halt = hp <= 0 or battery < 5
    physical_gate_latency = (time.time() - t0) * 1000

    if gate_halt:
        return {
            "scenario_id": scenario["id"], "type": scenario["type"],
            "expected_label": scenario["expected_label"],
            "obstacle": obstacle, "velocity": velocity, "battery": battery, "hp": hp, "temperature": temperature,
            "gate_stage": "PHYSICAL", "gate_decision": "HALT",
            "router_label": None, "compiler_output": None,
            "physical_gate_latency_ms": round(physical_gate_latency, 2),
            "router_latency_ms": None, "compiler_latency_ms": None,
        }

    # Router Agent
    t1 = time.time()
    router_label = ask_agent(ROUTER_PROMPT, telemetry, max_completion_tokens=20, temperature=0.0)
    router_label = router_label.strip().upper()
    router_latency = (time.time() - t1) * 1000

    if "SENSOR_ERROR" in router_label:
        return {
            "scenario_id": scenario["id"], "type": scenario["type"],
            "expected_label": scenario["expected_label"],
            "obstacle": obstacle, "velocity": velocity, "battery": battery, "hp": hp, "temperature": temperature,
            "gate_stage": "ROUTER", "gate_decision": "SKIP",
            "router_label": router_label, "compiler_output": None,
            "physical_gate_latency_ms": round(physical_gate_latency, 2),
            "router_latency_ms": round(router_latency, 2), "compiler_latency_ms": None,
        }

    # Compiler Agent (NO Safety gate — straight through)
    t2 = time.time()
    compiler_input = (
        f"Schema: {EXECUTION_SCHEMA}\n"
        f"Intent: {router_label}\n"
        f"Telemetry: Distance: {obstacle}cm, Velocity: {velocity}m/s"
    )
    compiler_output = ask_agent(COMPILER_SYSTEM_PROMPT, compiler_input, max_completion_tokens=100, temperature=0.0)
    compiler_latency = (time.time() - t2) * 1000

    return {
        "scenario_id": scenario["id"], "type": scenario["type"],
        "expected_label": scenario["expected_label"],
        "obstacle": obstacle, "velocity": velocity, "battery": battery, "hp": hp, "temperature": temperature,
        "gate_stage": "COMPILER", "gate_decision": "PASS",
        "router_label": router_label, "compiler_output": compiler_output.strip(),
        "physical_gate_latency_ms": round(physical_gate_latency, 2),
        "router_latency_ms": round(router_latency, 2), "compiler_latency_ms": round(compiler_latency, 2),
    }


def main():
    import csv

    random.seed(SEED)
    print("=" * 60)
    print("  Ablation: NO Safety Gate (Router → Compiler)")
    print(f"  Seed: {SEED}, Scenarios: {NUM_SCENARIOS}")
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
            results.append(run_pipeline(sc))
        except Exception as e:
            print(f"  ERROR scenario {sc['id']}: {e}")
            results.append({"scenario_id": sc["id"], "gate_stage": "ERROR", "error": str(e), **sc})

    print("=" * 60)
    print("  Computing metrics...")

    total = len(results)
    gates = {"PHYSICAL_HALT": 0, "ROUTER_SKIP": 0, "COMPILER_PASS": 0}
    for r in results:
        s = r.get("gate_stage", "ERROR")
        if s == "PHYSICAL": gates["PHYSICAL_HALT"] += 1
        elif s == "ROUTER": gates["ROUTER_SKIP"] += 1
        elif s == "COMPILER": gates["COMPILER_PASS"] += 1

    # Router accuracy (all 172 that weren't HALTed)
    router_correct = sum(1 for r in results if r.get("router_label") and r["router_label"] == r["expected_label"])
    router_total = sum(1 for r in results if r.get("router_label"))
    accuracy = router_correct / router_total if router_total else 0

    # Bootstrap CI
    router_data = [r for r in results if r.get("router_label")]
    acc_ests = []
    for _ in range(10000):
        s = [random.choice(router_data) for _ in range(len(router_data))]
        ok = sum(1 for r in s if r["router_label"] == r["expected_label"])
        acc_ests.append(ok / len(s))
    acc_ests.sort()
    acc_ci = (round(acc_ests[250] * 100, 2), round(acc_ests[9749] * 100, 2))

    # Confusion matrix
    cm = {e: {} for e in ["CRITICAL_OBSTACLE", "NORMAL_NAV", "SENSOR_ERROR"]}
    for r in results:
        if r.get("router_label"):
            e, p = r["expected_label"], r["router_label"]
            cm[e][p] = cm[e].get(p, 0) + 1
    for e in cm:
        for p in ["CRITICAL_OBSTACLE", "NORMAL_NAV", "SENSOR_ERROR"]:
            cm[e][p] = cm[e].get(p, 0)

    # Latency (PASS scenarios)
    pass_r = [r for r in results if r["gate_decision"] == "PASS"]
    if pass_r:
        r_lat = [r["router_latency_ms"] for r in pass_r]
        c_lat = [r["compiler_latency_ms"] for r in pass_r]
        t_lat = [r["router_latency_ms"] + r["compiler_latency_ms"] for r in pass_r]
        def desc(vals):
            ci = []
            for _ in range(10000):
                s = [random.choice(vals) for _ in range(len(vals))]
                ci.append(statistics.mean(s))
            ci.sort()
            return {
                "mean_ms": round(statistics.mean(vals), 1),
                "median_ms": round(statistics.median(vals), 1),
                "stdev_ms": round(statistics.stdev(vals), 1),
                "min_ms": round(min(vals), 1),
                "max_ms": round(max(vals), 1),
                "ci95_lower_ms": round(ci[250], 1),
                "ci95_upper_ms": round(ci[9749], 1),
            }
        router_s = desc(r_lat)
        compiler_s = desc(c_lat)
        total_s = desc(t_lat)
    else:
        empty = {"mean_ms": 0, "median_ms": 0, "stdev_ms": 0, "min_ms": 0, "max_ms": 0, "ci95_lower_ms": 0, "ci95_upper_ms": 0}
        router_s = compiler_s = total_s = empty

    # Critical obstacle detection
    critical_all = [r for r in results if r["type"] == "critical"]
    critical_missed = sum(
        1 for r in critical_all
        if r.get("gate_decision") == "PASS" and r.get("router_label") != "CRITICAL_OBSTACLE"
    )
    critical_detected = len(critical_all) - critical_missed

    # False positive = normal scenario that was HALTed or SKIPped
    fp = sum(1 for r in results if r["gate_decision"] in ("HALT", "SKIP") and r["expected_label"] == "NORMAL_NAV")

    metrics = {
        "metadata": {"seed": SEED, "num_scenarios": total, "model": "DeepSeek V4 Flash",
                      "ablation": "no_safety_gate"},
        "total_scenarios": total,
        "by_type": type_counts,
        "gate_counts": gates,
        "router_accuracy": {
            "correct": router_correct, "total": router_total,
            "accuracy_pct": round(accuracy * 100, 2),
            "ci95_lower_pct": acc_ci[0], "ci95_upper_pct": acc_ci[1],
            "confusion_matrix": cm,
        },
        "latency_ms": {
            "router": router_s, "compiler": compiler_s, "total": total_s,
        },
        "safety": {
            "critical_scenarios": len(critical_all),
            "critical_detected": critical_detected,
            "critical_missed": critical_missed,
            "critical_detection_pct": round(critical_detected / len(critical_all) * 100, 1) if critical_all else 0,
        },
        "errors": {"false_positive_skips": fp},
    }

    out_dir = Path(__file__).parent / "benchmark_results"
    out_dir.mkdir(exist_ok=True)
    with open(out_dir / "no_safety_results.json", "w") as f:
        json.dump({"metrics": metrics, "results": results}, f, indent=2)

    fields = ["scenario_id", "type", "expected_label", "gate_stage", "gate_decision",
              "router_label", "compiler_output",
              "physical_gate_latency_ms", "router_latency_ms", "compiler_latency_ms",
              "obstacle", "velocity", "battery", "hp", "temperature"]
    with open(out_dir / "no_safety_results.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{'─' * 50}")
    print(f"  Total Scenarios:      {total}")
    print(f"  Router Accuracy:      {accuracy*100:.2f}% [{acc_ci[0]}%, {acc_ci[1]}%]")
    print(f"  Latency (PASS only):  Router={router_s['mean_ms']:.1f}  Compiler={compiler_s['mean_ms']:.1f}  Total={total_s['mean_ms']:.1f} ms")
    print(f"  Critical detected:    {critical_detected}/{len(critical_all)} ({metrics['safety']['critical_detection_pct']}%)")
    print(f"  Critical missed:      {critical_missed}")
    print(f"  FP skips:             {fp}")
    print(f"  Gate counts:          PHYSICAL={gates['PHYSICAL_HALT']}  ROUTER={gates['ROUTER_SKIP']}  PASS={gates['COMPILER_PASS']}")
    print(f"{'─' * 50}")
    print(f"  Saved to {out_dir}/no_safety_results.json")


if __name__ == "__main__":
    main()
