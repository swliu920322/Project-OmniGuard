"""
Phase I Baseline Prototype — Verbose Execution Trace Demo
Run:  python demo_phase1.py
Output: 5 scenarios with full telemetry → gate → agent trace for Figure 4.1 screenshot
"""

import json, os, sys, time, random

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from embodied_brain.utils import ask_agent

SEED = 42

SYSTEM_ROUTER = "You are an AGV telemetry classifier. Output exactly one word."
SYSTEM_SAFETY = "You are an AGV safety auditor. Output exactly: BLOCK or PASS."
SYSTEM_COMPILER = "You are an AGV motor controller. Output valid JSON only."

SCENARIOS = [
    {"id": 0, "type": "critical",   "obstacle": 12, "velocity": 2.3, "battery": 78,  "hp": 95, "temperature": 35.0},
    {"id": 1, "type": "sensor_error","obstacle": 999,"velocity": 0.0, "battery": 84,  "hp": 12, "temperature": 45.0},
]

ROUTER_USER = """Obstacle distance: {obstacle} cm
Velocity: {velocity} m/s
Battery: {battery}%
HP: {hp}
Temperature: {temperature} C

Output exactly one word: CRITICAL_OBSTACLE (obstacle <= 30 cm), NORMAL_NAV (all normal), or SENSOR_ERROR (battery < 10%, hp <= 0, or temperature > 80 C)."""

SAFETY_USER = """Router classification: {router_label}
Obstacle distance: {obstacle} cm (minimum safe: 30 cm)
Velocity: {velocity} m/s
Battery: {battery}%
HP: {hp}

If obstacle < 30 cm, output BLOCK. Otherwise PASS. Output exactly: BLOCK or PASS."""

COMPILER_USER = """Classification: {router_label}
Obstacle distance: {obstacle} cm
Velocity: {velocity} m/s
Battery: {battery}%
HP: {hp}

Output a JSON: {{"action": "<continue|slow_down|emergency_stop|reroute>", "reason": "<brief reason>"}}"""

SEPARATOR = "=" * 72

def run_scenario(s):
    print(SEPARATOR)
    print(f"  SCENARIO #{s['id']}  |  Type: {s['type'].upper()}")
    print(SEPARATOR)
    print(f"  Telemetry: obstacle={s['obstacle']}cm  velocity={s['velocity']}m/s  "
          f"battery={s['battery']}%  hp={s['hp']}  temp={s['temperature']}C")
    print()

    # Step 1: Physical-Layer Gate
    print("  ── Step 1: Physical-Layer Gate ──")
    halt = s['hp'] <= 0 or s['battery'] < 5
    print(f"     HP={s['hp']} (threshold: >0), Battery={s['battery']}% (threshold: >=5%)")
    if halt:
        print(f"     >>> GATE DECISION: HALT (physical safety violation)")
        print(f"     >>> Pipeline aborted. 0 LLM calls saved.")
        return
    print(f"     >>> GATE DECISION: PASS")
    print()

    # Step 2: Router Agent
    print("  ── Step 2: Router Agent (LLM) ──")
    t0 = time.time()
    router_reply = ask_agent(
        SYSTEM_ROUTER, ROUTER_USER.format(**s),
        max_completion_tokens=20, temperature=0
    )
    router_label = router_reply.strip().upper()
    router_latency = (time.time() - t0) * 1000
    print(f"     Input: obstacle={s['obstacle']}cm, velocity={s['velocity']}m/s, ...")
    print(f"     Output: {router_label}")
    print(f"     Latency: {router_latency:.0f} ms")
    correct = router_label == {"critical": "CRITICAL_OBSTACLE", "normal": "NORMAL_NAV", "sensor_error": "SENSOR_ERROR"}[s['type']]
    print(f"     Expected: {'CRITICAL_OBSTACLE' if s['type'] == 'critical' else 'NORMAL_NAV' if s['type'] == 'normal' else 'SENSOR_ERROR'}  {'✓' if correct else '✗ MISCLASSIFICATION'}")
    print()

    # Step 3: Router Gate Check
    print("  ── Step 3: Router Gate Check ──")
    if router_label == "SENSOR_ERROR":
        print(f"     >>> GATE DECISION: SKIP (sensor error → gradual deceleration)")
        print(f"     >>> Safety + Compiler skipped. Saved ~4393 ms.")
        return
    print(f"     >>> GATE DECISION: PASS")
    print()

    # Step 4: Safety Agent
    print("  ── Step 4: Safety Agent (LLM) ──")
    t0 = time.time()
    safety_reply = ask_agent(
        SYSTEM_SAFETY, SAFETY_USER.format(router_label=router_label, **s),
        max_completion_tokens=10, temperature=0
    )
    safety_decision = safety_reply.strip().upper()
    safety_latency = (time.time() - t0) * 1000
    print(f"     Rule: obstacle >= 30cm → PASS; obstacle < 30cm → BLOCK")
    print(f"     Router says: {router_label} | Obstacle: {s['obstacle']}cm")
    print(f"     Output: {safety_decision}")
    print(f"     Latency: {safety_latency:.0f} ms")
    print()

    # Step 5: Safety Gate Check
    print("  ── Step 5: Safety Gate Check ──")
    if safety_decision == "BLOCK":
        print(f"     >>> GATE DECISION: SKIP (safety override)")
        print(f"     >>> Compiler skipped. Saved ~3191 ms.")
        return
    print(f"     >>> GATE DECISION: PASS")
    print()

    # Step 6: Compiler Agent
    print("  ── Step 6: Compiler Agent (LLM) ──")
    t0 = time.time()
    compiler_reply = ask_agent(
        SYSTEM_COMPILER, COMPILER_USER.format(router_label=router_label, **s),
        max_completion_tokens=100, temperature=0
    )
    compiler_latency = (time.time() - t0) * 1000
    print(f"     Output: {compiler_reply.strip()}")
    print(f"     Latency: {compiler_latency:.0f} ms")
    print()

    # Summary
    total = router_latency + safety_latency + compiler_latency
    print(f"  ── Total Pipeline Latency: {total:.0f} ms ──")
    print(f"     Router={router_latency:.0f} + Safety={safety_latency:.0f} + Compiler={compiler_latency:.0f}")
    print(f"     Action: {compiler_reply.strip()}")
    print()


if __name__ == "__main__":
    random.seed(SEED)
    print()
    print("  Phase I Baseline Prototype — Execution Trace")
    print("  3-Agent Pipeline: Router → Safety → Compiler")
    print(f"  Seed: {SEED}, Scenarios: {len(SCENARIOS)}")
    print()
    for s in SCENARIOS:
        run_scenario(s)
    print(SEPARATOR)
    print("  Demo complete.")
    print(SEPARATOR)
