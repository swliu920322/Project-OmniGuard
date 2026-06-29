# Embodied AI Fleet Control Plane: System Integration & Operations Guide

This guide details the architecture, dual-mode data pipeline, and pre-deployment analysis for the **Project-OmniGuard Fleet Control Plane**.

---

## 1. Architectural Vision & Core Concepts

Project-OmniGuard is an enterprise-grade Embodied AI Zero-Trust firewall. The system operates on a dual-mode telemetry processing model that connects physical edge device constraints with real-time cloud-native orchestration.

```mermaid
graph TD
    subgraph "1. Edge Control Mode (Asynchronous Event Loop)"
        EdgeDevice["Edge Simulator (device_mock.py)"]
        IoTHub["Azure IoT Hub (MQTT)"]
        EventHubTrigger["Event Hub Trigger (iot_telemetry_processor)"]
        CosmosDB["Azure Cosmos DB"]
        OpenAI["Azure OpenAI (gpt-5.4-mini)"]
        
        EdgeDevice -->|1. MQTT Telemetry| IoTHub
        IoTHub -->|2. Event Router| EventHubTrigger
        EventHubTrigger -->|3. Read/Write State| CosmosDB
        EventHubTrigger -->|4. Orchestrate Agents| OpenAI
        EventHubTrigger -->|5. C2D Command (REST)| IoTHub
        IoTHub -->|6. Immediate Stop/Move| EdgeDevice
    end

    subgraph "2. Digital Twin Mode (Synchronous Audit Loop)"
        Dashboard["Next.js Control Plane (/dashboard)"]
        SimulateRoute["HTTP POST (/simulate_agent)"]
        
        Dashboard -->|1. Telemetry State & Speed Cap| SimulateRoute
        SimulateRoute -->|2. Multi-Agent Pipeline| OpenAI
        SimulateRoute -->|3. Query Last State| CosmosDB
        SimulateRoute -->|4. Sync Response (Trace & Latency)| Dashboard
    end
```

---

## 2. Dual-Mode Operational Architecture

The system resolves the conflict between black-box physical operations and interactive verification by running two parallel, unified pathways:

### Mode A: Physical Hardware Loop (物理闭环模式)
* **Goal**: Real-time control of physical or simulated hardware devices.
* **Pipeline**:
  1. **Edge Telemetry**: [device_mock.py](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/device_mock.py) acts as a physical robot, moving forward at a baseline speed, reading sensor gaps, and reporting payload telemetry via MQTT on port 8883 to **Azure IoT Hub**.
  2. **Event Extraction**: Azure Function's `iot_telemetry_processor` is triggered via the Event Hub Compatible endpoint.
  3. **Memory Update**: High-frequency telemetry states are persisted into **Azure Cosmos DB** (`DeviceTwins` container).
  4. **Brain Orchestration**: If distance $< 15$cm, the Function wakes up the 3-Agent pipeline (Router $\rightarrow$ Safety $\rightarrow$ Compiler) to resolve pathing.
  5. **C2D Feedback**: The compiled action is signed with a generated SAS Token and pushed back to the device via **IoT Hub REST API** (`devicebound` message). The robot's wheels parse the instruction and adjust speed or stop immediately.

### Mode B: Digital Twin Control Plane Simulation (数字孪生模拟器模式)
* **Goal**: Visual verification of multi-tenant safety rules, agent traces, and network latency.
* **Pipeline**:
  1. **User Action**: User chooses a tenant, configures speed limits and distance, and starts autopilot.
  2. **Synchronous Call**: React sends an HTTP POST to `/simulate_agent` on port 7071.
  3. **Zero-Trust Logic**: The Function runs the exact same 3-Agent pipeline, queries historical states from Cosmos DB, and packages the results.
  4. **Telemetry Trace**: Instead of sending a C2D message, the response synchronously delivers the `pipeline_trace`, `final_action`, and `cloud_metrics` (Cosmos RU charge, latency) to the client.
  5. **UI Rendering**: The Dashboard draws the visual twin and updates the orchestration nodes.

---

## 3. Module Breakdown & File Responsibilities

### Edge Simulator (`device_mock.py`)
* **Role**: Simulate physical hardware telemetry loops.
* **Behavior**: Connects to the cloud using MQTT over TLS. Runs a background loop updating and sending `obstacle_distance_cm` and `location`.

### Cloud Orchestrator (`embodied_brain/`)
* **Role**: Serverless Compute & Core Orchestration.
* **Key files**:
  * [brain.py](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/cloud-orchestrator/embodied_brain/brain.py): Main entrypoint. Describes the execution logic of the EventHub trigger and the FastAPI POST router `/simulate_agent`.
  * [utils.py](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/cloud-orchestrator/embodied_brain/utils.py): Submodule helper. Handles Azure Cosmos DB connection pool, IoT Hub SAS token generation, Azure OpenAI clients, and C2D REST requests.
  * [scenario_registry.json](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/cloud-orchestrator/scenario_registry.json): Scenario configuration registry storing prompt profiles, safety rules, and JSON schemas for each tenant.

### Client Edge (`client-edge/`)
* **Role**: Visual Digital Twin Dashboard.
* **Key files**:
  * [page.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/dashboard/page.tsx): Main state coordinator. Manages inputs, error bounds, and recursive `setTimeout` sequential loops.
  * [PhysicalTwinVisualizer.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/dashboard/components/PhysicalTwinVisualizer.tsx): Renders the 2D SVG track, laser beam, and emergency shields.
  * [CloudTopologyFlowchart.tsx](file:///Users/liushengwei/project/PythonProject/Project-OmniGuard/src/client-edge/src/app/dashboard/components/CloudTopologyFlowchart.tsx): Renders the cloud flowchart annotated with Bicep origin parameters.

---

## 4. Pre-Deployment Configuration & Latency Analysis

### Latency Profiles: Local vs. Cloud Deployed

| Parameter | Local Host Run (`func start`) | Deployed to Azure Functions | Rationale |
|---|---|---|---|
| **Average End-to-End Latency** | $3.5\text{s} \sim 4.5\text{s}$ | $1.5\text{s} \sim 2.5\text{s}$ | Local run suffers cross-region roundtrip networks (Local $\leftrightarrow$ Azure Southeast Asia Datacenter). Cloud runs are in-datacenter. |
| **Cosmos DB Latency** | $50\text{ms} \sim 150\text{ms}$ | $2\text{ms} \sim 8\text{ms}$ | Deployed app integrates directly via Private Endpoints in the same region. |
| **OpenAI Inference Latency** | $1.5\text{s} \sim 3.0\text{s}$ | $1.2\text{s} \sim 2.2\text{s}$ | Eliminated TLS negotiation overhead from home network. |

### Pre-Deployment Environment Keys Alignment
A full inspection has been performed to ensure the cloud resource deployment config matches the application code perfectly.

> [!IMPORTANT]
> The following environment variables **MUST** be present in the Azure Function App's Application Settings (synced via `infra-up.sh` or Portal):
>
> 1. `COSMOS_ENDPOINT`: Points to the Cosmos DB URI (e.g. `https://omni-mem-*.documents.azure.com:443/`).
> 2. `COSMOS_KEY`: Access token for the Cosmos DB resource.
> 3. `AZURE_OPENAI_ENDPOINT`: Target API Endpoint.
> 4. `AZURE_OPENAI_API_KEY`: Azure Cognitive Services key.
> 5. `AZURE_OPENAI_DEPLOYMENT_NAME`: OpenAI deployment model name (e.g., `gpt-5.4-mini`).
> 6. `IotHubServiceConnectionString`: Standard Service connection string used to push C2D actions.
