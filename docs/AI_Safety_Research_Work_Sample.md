# Project-OmniGuard: Cyber-Physical AI Safety via Zero-Trust Isolation and Hybrid Edge-Cloud Orchestration

**Technical Project Report & AI Safety Work Sample**  
**Author:** Shengwei Liu  
**Affiliation:** MSc in Applied Computing (AI Specialization), Taylor's University  
**Contact:** lsw19920322@gmail.com | +6011-1121-6759  

---

## Abstract

As Large Language Models (LLMs) are increasingly integrated into cyber-physical systems (CPS) and autonomous robotics, ensuring physical safety under network volatility and inference latency becomes a critical challenge. This report presents **Project-OmniGuard**, an enterprise-grade cloud-edge collaborative security decision-making platform. We formulate the **Kinematic-Token Theorem**, proving mathematically that cloud-only LLM control loops fail to guarantee physical safety for fast-moving autonomous systems. To mitigate this, we implement a hybrid defense-in-depth architecture combining:
1. **Low-Latency Edge Reflexes**: Local WebGPU-accelerated Small Language Models (SLMs) providing 15ms safety-critical overrides.
2. **Multi-Agent Alignment & Safety Firewalls**: A 3-agent orchestration pipeline with early circuit-breaking and real-time policy enforcement.
3. **Zero-Trust Network Isolation**: A strictly private Azure Singapore network perimeter verified by self-healing Shadow E2E infrastructure testing.

---

## 1. Introduction & The AI Safety Problem in CPS

Integrating generative AI into physical actuators (e.g., Automated Guided Vehicles (AGVs) in smart warehouses, robotic arms) introduces non-deterministic latency. Unlike software-only applications where latency merely degrades user experience, in cyber-physical systems, **latency translates directly into physical collision and damage**.

If an autonomous AGV relies entirely on a cloud-hosted LLM to interpret sensor telemetry and decide whether to steer, stop, or accelerate, the safety of the vehicle is bottlenecked by the cloud control loop. This architecture exposes the system to:
* **Network jitter and disconnects** (dark warehouse zones, signal interference).
* **Variable LLM generation times** (token queue delays, prompt processing overhead).
* **Lack of physical safety constraints** in raw LLM outputs.

---

## 2. Theoretical Formulation: The Kinematic-Token Theorem

We propose the **Kinematic-Token Theorem** to mathematically define the physical boundaries within which cloud-based LLM control is safe.

### 2.1 Variables & Constants
Let:
* $v$ be the current operational speed of the AGV ($m/s$).
* $d_{\text{obstacle}}$ be the distance to the detected obstacle ($m$).
* $d_{\text{brake}}$ be the physical braking distance of the AGV at speed $v$ under maximum deceleration ($m$).
* $L_{\text{network\_rtt}}$ be the round-trip network latency between the edge device and the cloud ($s$).
* $S_{\text{token\_rate}}$ be the generation throughput of the LLM ($\text{tokens}/s$).
* $N_{\text{prompt}}$ be the number of prompt tokens.
* $N_{\text{completion}}$ be the number of generated tokens required to output a control decision.
* $T_{\text{cloud}}$ be the total response time of the cloud AI control loop ($s$).

### 2.2 Mathematical Model
The total latency of the cloud loop is modeled as:
$$T_{\text{cloud}} = L_{\text{network\_rtt}} + T_{\text{processing}} + \frac{N_{\text{completion}}}{S_{\text{token\_rate}}}$$

To prevent a physical collision, the distance traveled by the AGV during the decision-making cycle plus its physical braking distance must not exceed the distance to the obstacle:
$$v \cdot T_{\text{cloud}} + d_{\text{brake}} \le d_{\text{obstacle}}$$

Substituting $T_{\text{cloud}}$:
$$v \cdot \left( L_{\text{network\_rtt}} + T_{\text{processing}} + \frac{N_{\text{completion}}}{S_{\text{token\_rate}}} \right) + d_{\text{brake}} \le d_{\text{obstacle}}$$

Solving for the maximum safe velocity $v_{\text{safe}}$:
$$v_{\text{safe}} \le \frac{d_{\text{obstacle}} - d_{\text{brake}}}{L_{\text{network\_rtt}} + T_{\text{processing}} + \frac{N_{\text{completion}}}{S_{\text{token\_rate}}}}$$

### 2.3 Empirical Analysis (The Safety Deadlock)
In typical cloud environments:
* $L_{\text{network\_rtt}} \approx 100\text{ms} - 500\text{ms}$ (mobile networks, VPNs).
* $T_{\text{processing}} \approx 200\text{ms}$ (prompt evaluation).
* $S_{\text{token\_rate}} \approx 50\text{ tokens}/s$.
* For a standard JSON action response, $N_{\text{completion}} \approx 100\text{ tokens}$ (leading to $2.0\text{s}$ generation time).
* This yields $T_{\text{cloud}} \approx 2.3\text{s} - 2.7\text{s}$.

If an AGV travels at $1.5\text{ m/s}$ with a $0.5\text{m}$ physical braking distance, and detects an obstacle at $3.0\text{m}$:
$$v \cdot T_{\text{cloud}} + d_{\text{brake}} = (1.5 \cdot 2.5) + 0.5 = 4.25\text{m} > 3.0\text{m} \quad \mathbf{(COLLISION)}$$

This proves that **cloud-only LLM inference cannot guarantee physical safety** for dynamic real-time controls, establishing the necessity of the OmniGuard hybrid edge-cloud pipeline.

---

## 3. The OmniGuard Hybrid Safety Architecture

To resolve this safety deadlock, Project-OmniGuard implements a dual-path cognitive control loop resembling Daniel Kahneman's **System 1 (Fast/Reflexive)** and **System 2 (Slow/Deliberative)** cognitive framework.

```
       Telemetry Data
             │
             ├─── [System 1: Edge WebGPU] (15ms) ───► Collision Risk? ──► [EMERGENCY BRAKE]
             │
             └─── [System 2: Cloud VNet] (2.6s) ───► AI Safety Firewall ─► Route & Schedule Planning
```

### 3.1 System 1: In-Browser WebGPU Edge Reflexes (Low Latency)
When network latency spikes or a critical obstacle is within the immediate braking zone, the system bypasses the cloud entirely:
* **Local SLM**: We load a quantized `Qwen2.5-0.5B-Instruct` model and `all-MiniLM-L6-v2` embeddings directly into the browser client, executing via **WebGPU hardware acceleration**.
* **Zero-Cost Local RAG**: Telemetry prompts are compared against a local vector knowledge base using cosine similarity (threshold $\ge 0.72$).
* **Reflex Execution**: If a collision vector is predicted, a local interrupt is fired within **15ms**, executing a physical brake command before the cloud pipeline even completes its network handshake.

### 3.2 System 2: Zero-Trust Cloud Orchestration (High Intelligence)
When the vehicle is operating within normal safety limits, strategic task routing, scheduling, and multi-robot coordination are delegated to the cloud backend.

---

## 4. Multi-Agent Alignment & Safety Firewalls

In the cloud layer, raw telemetry is processed through a deterministic multi-agent pipeline designed to enforce safety constraints before commands are dispatched to the IoT actuator.

```
Telemetry Payload ──► [Router Agent] ──► SENSOR_ERROR? ──► (Abort & Halt)
                            │
                            ▼
                      [Safety Agent] ──► Rule Violation? ──► [BLOCK & Override]
                            │
                            ▼
                     [Compiler Agent] ──► Executable JSON Action
```

1. **Physical Pre-Filter**: Prior to calling any LLMs, telemetry metrics are audited against hardcoded physical limits. If battery levels are $<5\%$ or structural damage ($HP \le 0$) is detected, the pipeline immediately triggers an offline lock, bypassing LLM processing entirely.
2. **Router Agent (Intent Classification)**: Processes telemetry to classify intent (e.g., `NORMAL_NAV`, `CRITICAL_OBSTACLE`, `SENSOR_ERROR`). If classified as `SENSOR_ERROR`, it immediately halts the device, short-circuiting the remaining agents to save tokens and eliminate delay.
3. **Safety Agent (Policy Firewall)**: Evaluates the proposed system state against tenant-specific safety constraints (e.g., *"Maintain 30cm minimum clearance"*, *"Do not forward payload if tilt exceeds 15 degrees"*). If a violation is predicted, it outputs `BLOCK` with a safety override command.
4. **Compiler Agent (Action Synthesis)**: Transforms the audited plan into schema-validated JSON actions ready for physical device execution.

---

## 5. Enterprise-Grade Security and Zero-Trust Isolation

AI safety is not only about mathematical alignment; it is also about infrastructure security. If the control signals or telemetry are tampered with (Man-in-the-Middle attack), the system's safety guarantees fail. Project-OmniGuard implements a hardened **Zero-Trust network architecture** on Azure Singapore:

* **No Public Ingress**: The Next.js frontend acts as a secure API Gateway (BFF pattern). The FastAPI backend is configured as private (`external: false`) and runs inside an isolated subnet with no public IP.
* **Private Links & Subnet Micro-segmentation**: Databases (Cosmos DB), credentials (Key Vault), storage (Blob Store), and AI assets (Azure OpenAI) communicate strictly via Private Endpoints on a private subnet. Bidirectional NSG rules deny internet inbound access.
* **Credential-less IAM**: No database passwords or keys are stored in the application code. Identity authentication is governed strictly via Azure User-Assigned Managed Identity and Role-Based Access Control (RBAC).
* **HMAC-SHA256 C2D Handshakes**: Cloud-to-Device (C2D) control commands are hand-signed using custom HMAC-SHA256 signatures derived from IoT Hub SAS tokens, preventing replay and injection attacks.

---

## 6. Verification: The Self-Healing Shadow E2E Test Suite

To guarantee the integrity of the safety boundaries, we developed an automated **Shadow E2E Test Suite** in Python (`tests/shadow-e2e-test.py`):
1. **Isolated Provisioning**: Automatically spins up a temporary "shadow" duplicate of the entire production resource group using Bicep IaC.
2. **DNS & Resolution Auditing**: Performs deep network queries to verify that Private DNS A records correctly map internal endpoints (e.g., Key Vault, Cosmos DB) to private subnet IPs (`10.1.2.x`), ensuring no traffic accidentally routes over the public internet.
3. **Container Health Audits**: Exercises the API gateways and telemetry endpoints to verify latency metrics.
4. **Guaranteed Teardown**: Automatically tears down the shadow environment upon completion (handling Ctrl+C interrupts gracefully) to prevent cost leaks, proving the robustness of the system's operational lifecycle.

---

## 7. Conclusion

Project-OmniGuard demonstrates that physical AI safety cannot rely solely on the cognitive capacity of cloud models. By formulating the **Kinematic-Token Theorem**, we prove the physical limitations of cloud inference loops. Through the implementation of WebGPU edge fallbacks, multi-agent policy firewalls, and strict Zero-Trust isolation, OmniGuard provides a blueprint for deploying safe, secure, and resilient autonomous systems in industrial environments.
