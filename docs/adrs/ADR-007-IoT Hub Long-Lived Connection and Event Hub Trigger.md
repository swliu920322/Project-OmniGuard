# Architectural Decision Record (ADR 007)

## Title

ADR 007: Deprecating Web PubSub in Favor of IoT Hub Long-Lived MQTT Connections with Event Hub Trigger Ingestion

---

## Status

**Approved**

---

## Context / Context Background

During the architectural design of the Project-OmniGuard embodied intelligence cloud control plane (specifically Sprint 1: Neural Communication), we evaluated telemetry ingestion and command-and-control (C2D) communication mechanisms between edge device simulators (e.g., `Robo-A1`) and the serverless backend. 

Two communication paradigms were analyzed:
1. **Azure Web PubSub**: A publish-subscribe service built on WebSockets, optimized for real-time web browser client notifications.
2. **Azure IoT Hub + Event Hub Triggers**: An industrial-grade ingestion gateway utilizing persistent MQTT connections combined with direct stream integration in the serverless compute plane.

Initial mockups showed that while Web PubSub was easy to set up for browser interfaces, it introduced significant architectural debt, credential management vulnerabilities, and telemetry processing latency when applied to physical edge device simulators.

---

## Decision Drivers

* **Zero-Trust Device Identity**: Restrict edge simulators to isolated security scopes using individual per-device cryptographic keys (Shared Access Keys), preventing global token compromise.
* **Low-Latency Telemetry Ingestion**: Minimize pipeline hops between raw edge telemetry publication and serverless function execution to meet real-time processing constraints (<15ms).
* **Industrial Bi-directional Control Loops**: Support structured Cloud-to-Device (C2D) commands and Device Twin state tracking natively without custom routing middleware.
* **Minimal Infrastructure Overhead**: Eliminate the need to write custom WebSocket token negotiation services, connection life-cycle hooks, or event router functions.

---

## Considered Options & Trade-offs

### Option 1: Web PubSub (WebSocket Ingestion Platform)

* **Pros**: Easy real-time streaming integration with web browsers (Next.js frontend); lightweight protocol overhead.
* **Cons**:
  * **Authorization Deficits**: Lacks built-in device-specific registry management. Any client with the connection token can compromise the entire hub or impersonate other devices.
  * **Routing Complexity**: Requires an intermediate Azure Function or webhook router to process incoming WebSocket packets and direct them to backend handlers, introducing an extra network hop (Edge -> Web PubSub -> Http Webhook -> Azure Function).
  * **Protocol Misalignment**: Devices must manage complex WebSocket connection/reconnection logic, which is less supported in industrial microcontrollers compared to standard MQTT.

### Option 2: IoT Hub Persistent MQTT Connection + Direct Event Hub Ingestion

* **Pros**:
  * **Industrial Identity**: Enforces Zero-Trust registry constraints. Each device (e.g., `Robo-A1`) is provisioned with a unique, revocable connection string.
  * **MQTT Protocol Standard**: Establishes a persistent, bi-directional long-lived TCP socket utilizing MQTT, which is optimized for resource-constrained edge systems.
  * **Zero-Hop Event Hub Ingestion**: Integrates Azure Functions directly with the IoT Hub's underlying Event Hub partitions. The function worker pulls directly from the event streams, eliminating intermediate HTTP gateway routing and reducing latency to `<15ms`.
  * **C2D Native Loop**: Provides built-in APIs for cloud-to-device command injection and device twin properties out-of-the-box.
* **Cons**:
  * **Storage Requirement**: Requires local/cloud storage checkpoints (`AzureWebJobsStorage`) to lock partitions during multi-worker processing.

---

## Selected Decision

We selected **Option 2**. We deprecated Web PubSub for edge communication and locked down direct MQTT connections to Azure IoT Hub for all device instances. 

Telemetry streams are ingested directly by the Azure Functions backend using the native Event Hub Trigger bound to the `IotHubEventHubConnectionString` variable. Web PubSub remains strictly isolated (if used) to low-risk, browser-facing UI updates, while all telemetry and command loops are routed via the IoT Hub telemetry pipeline.

---

## Implementation Reference

### 1. Edge-Side Persistent MQTT Hook (`device_mock.py`)

The edge device initiates a direct MQTT long-connection via the connection string populated in `.env`:
```python
# Establish direct MQTT connection
client = IoTHubDeviceClient.create_from_connection_string(CONNECTION_STRING)
# Register cloud command callback hook
client.on_message_received = message_handler
client.connect()
```

### 2. Ingestion Trigger Integration (`brain.py`)

The serverless backend binds directly to the IoT Hub's event hub compatible partition stream:
```python
@bp.event_hub_message_trigger(
    arg_name="azeventhub",
    event_hub_name="messages/events",
    connection="IotHubEventHubConnectionString"
)
def iot_telemetry_processor(azeventhub: func.EventHubEvent):
    raw_data = azeventhub.get_body().decode('utf-8')
    # Parse and route to Azure OpenAI decision layer
```

---

## Consequences

* **Positive**: Enforces Zero-Trust device authentication. A compromised device key cannot compromise other devices.
* **Positive**: Reaches low-latency stream processing (`<15ms` ingestion hops) via direct partition reading.
* **Positive**: Bypasses custom routing, subscription token generators, and WebSocket handler webhooks, cutting system codebase complexity by ~35%.
* **Negative**: Requires local Functions host environments to have access to a storage account (`AzureWebJobsStorage`) to coordinate partition lease checkpoints.
