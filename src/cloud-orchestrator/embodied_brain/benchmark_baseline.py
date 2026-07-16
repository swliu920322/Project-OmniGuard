"""
benchmark_baseline.py — Single-Agent Baseline (no Router/Safety/Compiler gates)
Generates the SAME 200 scenarios as benchmark.py, but runs a single LLM call
that does all jobs at once (classify + safety + action).

Purpose: Ablation comparison — measure latency & accuracy without circuit-breaking.
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
        "temperature_range": (25, 45), "weight": 0.5,
        "expected_label": "NORMAL_NAV",
    },
    "critical": {
        "obstacle_range": (5, 50), "velocity_range": (0.5, 2.5),
        "battery_range": (20, 100), "hp_range": (50, 100),
        "temperature_range": (25, 45), "weight": 0.25,
        "expected_label": "CRITICAL_OBSTACLE",
    },
    "sensor_error": {
        "obstacle_range": (50, 300), "velocity_range": (0.5, 2.0),
        "battery_range": (0, 10), "hp_range": (0, 20),
        "temperature_range": (60, 100), "weight": 0.25,
        "expected_label": "SENSOR_ERROR",
    },
}

SINGLE_AGENT_PROMPT = """You are an AGV controller. Analyze the telemetry and output a JSON action.
Rules:
- If obstacle distance < 50cm: output {"action": "emergency_stop", "reason": "obstacle_too_close"}
- If obstacle distance >= 50cm and < 200cm: output {"action": "slow_down", "reason": "obstacle_ahead"}
- If battery < 5% or HP <= 0: output {"action": "halt", "reason": "critical_sensor_error"}
- Otherwise: output {"action": "continue", "reason": "normal_navigation"}

Respond with ONLY the JSON object, nothing else."""


def generate_scenarios(num: int) -> list[dict]:
    random.seed(SEED)
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


def run_single_agent(scenario: dict) -> dict:
    telemetry = (
        f"Distance: {scenario['obstacle']}cm, "
        f"Velocity: {scenario['velocity']}m/s, HP: {scenario['hp']}, "
        f"Battery: {scenario['battery']}%, Temp: {scenario['temperature']}C."
    )

    t0 = time.time()
    output = ask_agent(SINGLE_AGENT_PROMPT, telemetry, max_completion_tokens=100, temperature=0.0)
    latency = (time.time() - t0) * 1000

    return {
        "scenario_id": scenario["id"],
        "type": scenario["type"],
        "expected_label": scenario["expected_label"],
        "obstacle": scenario["obstacle"],
        "velocity": scenario["velocity"],
        "battery": scenario["battery"],
        "hp": scenario["hp"],
        "temperature": scenario["temperature"],
        "latency_ms": round(latency, 2),
        "raw_output": output.strip(),
    }


def classify_output(output: str) -> str:
    upper = output.upper()
    if "EMERGENCY_STOP" in upper:
        return "CRITICAL_OBSTACLE"
    if "HALT" in upper or "CRITICAL_SENSOR" in upper:
        return "SENSOR_ERROR"
    if "SLOW_DOWN" in upper or "CONTINUE" in upper:
        return "NORMAL_NAV"
    return "UNKNOWN"


def main():
    import csv

    random.seed(SEED)
    print("=" * 60)
    print("  Baseline (Single Agent) Benchmark")
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
            r = run_single_agent(sc)
            results.append(r)
        except Exception as e:
            print(f"  ERROR scenario {sc['id']}: {e}")
            results.append({"scenario_id": sc["id"], "error": str(e), **sc})

    print("=" * 60)
    print("  Computing metrics...")

    total = len(results)
    latencies = [r["latency_ms"] for r in results if "latency_ms" in r]
    avg_lat = statistics.mean(latencies) if latencies else 0
    med_lat = statistics.median(latencies) if latencies else 0
    max_lat = max(latencies) if latencies else 0
    min_lat = min(latencies) if latencies else 0
    std_lat = statistics.stdev(latencies) if len(latencies) > 1 else 0

    lat_ci_ests = []
    for _ in range(10000):
        s = [random.choice(latencies) for _ in range(len(latencies))]
        lat_ci_ests.append(statistics.mean(s))
    lat_ci_ests.sort()
    lat_ci = (round(lat_ci_ests[250], 1), round(lat_ci_ests[9749], 1))

    correct = 0
    total_pred = 0
    confusion = {"NORMAL_NAV": {}, "CRITICAL_OBSTACLE": {}, "SENSOR_ERROR": {}}
    for e in confusion:
        for p in confusion:
            confusion[e][p] = 0
    correct_by_type = {"normal": 0, "critical": 0, "sensor_error": 0}
    total_by_type = {"normal": 0, "critical": 0, "sensor_error": 0}

    for r in results:
        expected = r["expected_label"]
        predicted = classify_output(r.get("raw_output", ""))
        total_pred += 1
        if expected == predicted:
            correct += 1
            correct_by_type[r["type"]] += 1
        total_by_type[r["type"]] += 1
        confusion[expected][predicted] = confusion[expected].get(predicted, 0) + 1

    accuracy = correct / total_pred if total_pred else 0

    acc_ests = []
    for _ in range(10000):
        s = [random.choice(results) for _ in range(len(results))]
        ok = sum(1 for r in s if classify_output(r.get("raw_output", "")) == r["expected_label"])
        acc_ests.append(ok / len(s))
    acc_ests.sort()
    acc_ci = (round(acc_ests[250] * 100, 2), round(acc_ests[9749] * 100, 2))

    safety_failures = sum(
        1 for r in results
        if r["type"] == "critical"
        and "EMERGENCY_STOP" not in (r.get("raw_output", "") or "").upper()
    )
    obstacle_close = sum(1 for r in results if r["type"] == "critical")
    safety_rate = (obstacle_close - safety_failures) / obstacle_close * 100 if obstacle_close else 0

    metrics = {
        "metadata": {"seed": SEED, "num_scenarios": total, "model": "DeepSeek V4 Flash"},
        "total_scenarios": total,
        "by_type": type_counts,
        "latency_ms": {
            "mean": round(avg_lat, 1), "median": round(med_lat, 1),
            "stdev": round(std_lat, 1), "min": round(min_lat, 1), "max": round(max_lat, 1),
            "ci95_lower": lat_ci[0], "ci95_upper": lat_ci[1],
        },
        "accuracy": {
            "correct": correct, "total": total_pred,
            "accuracy_pct": round(accuracy * 100, 2),
            "ci95_lower_pct": acc_ci[0], "ci95_upper_pct": acc_ci[1],
            "by_type": {t: {
                "correct": correct_by_type[t],
                "total": total_by_type[t],
                "pct": round(correct_by_type[t] / total_by_type[t] * 100, 1) if total_by_type[t] else 0
            } for t in ["normal", "critical", "sensor_error"]},
            "confusion_matrix": confusion,
        },
        "safety": {
            "critical_scenarios": obstacle_close,
            "emergency_stop_rate_pct": round(safety_rate, 1),
            "missed_emergency_stops": safety_failures,
        },
    }

    out_dir = Path(__file__).parent / "benchmark_results"
    out_dir.mkdir(exist_ok=True)
    with open(out_dir / "baseline_results.json", "w") as f:
        json.dump({"metrics": metrics, "results": results}, f, indent=2)

    fields = ["scenario_id", "type", "expected_label", "latency_ms", "raw_output",
              "obstacle", "velocity", "battery", "hp", "temperature"]
    with open(out_dir / "baseline_results.csv", "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(results)

    print(f"\n{'─' * 50}")
    print(f"  Total Scenarios:        {total}")
    print(f"  Single-Agent Latency:   {avg_lat:.1f} ms (95%CI [{lat_ci[0]},{lat_ci[1]}])")
    print(f"  Accuracy:               {accuracy*100:.2f}% (95%CI [{acc_ci[0]}%,{acc_ci[1]}%])")
    print(f"  Critical → Emergency:   {safety_rate:.1f}%  ({obstacle_close - safety_failures}/{obstacle_close})")
    print(f"  Missed Stops:           {safety_failures}")
    print(f"{'─' * 50}")
    print(f"  Results saved to {out_dir}/baseline_results.json")
    print("=" * 60)


if __name__ == "__main__":
    main()
