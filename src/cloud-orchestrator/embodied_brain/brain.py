# file: src/cloud-orchestrator/embodied_brain/brain.py
import os
import json
import logging
import azure.functions as func
from openai import AzureOpenAI

bp = func.Blueprint()

def get_brain_client():
    """Fetch client configuration from environment and initialize AzureOpenAI."""
    return AzureOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT", ""),
        api_version="2024-02-15-preview",
        api_key=os.getenv("AZURE_OPENAI_API_KEY", "")
    )

@bp.event_hub_message_trigger(
    arg_name="azeventhub",
    event_hub_name="messages/events",
    connection="IotHubEventHubConnectionString"
)
def iot_telemetry_processor(azeventhub: func.EventHubEvent):
    """Handle incoming event hub telemetry stream and trigger agent decision."""
    raw_data = azeventhub.get_body().decode('utf-8')
    device_id = azeventhub.iothub_metadata.get('connection-device-id', 'Unknown-Device')

    try:
        # Parse payload from raw device data
        payload = json.loads(raw_data)
        obstacle = payload.get("obstacle_distance_cm", 100)
        tenant_id = payload.get("tenant_id", "Unknown-Tenant")

        # Trigger agent decision when obstacle is close (< 15cm)
        if obstacle < 15:
            logging.warning(f"[⚠️ 警报触发] 探针 {device_id} 遭遇障碍阻挡 ({obstacle}cm)！唤醒云端 Agent 大脑...")

            client = get_brain_client()
            deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4")

            # Force strict JSON format output
            system_prompt = (
                "You are the Embodied AI Cloud Brain. You must parse the current telemetry and issue a precise, "
                "structured action sequence. You must output a raw valid JSON array matching the schema, "
                "with absolutely NO markdown formatting, NO ```json blocks, and NO explanations."
            )

            user_input = f"Tenant: {tenant_id}, Device: {device_id}, Status: Obstacle encountered at {obstacle}cm. Issue navigation actions."

            # Query Azure OpenAI for navigation actions
            response = client.chat.completions.create(
                model=deployment,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_input}
                ],
                max_completion_tokens=150,
                temperature=0.0
            )

            action_json = response.choices[0].message.content.strip()
            # Log decision result
            logging.info(f"[🧠 大脑决策生成] 下发强类型动作序列: {action_json}")

            # TODO: Send command back to physical device via IoT Hub RegistryManager (C2D)

        else:
            # Report state if obstacle is far away (heartbeat only)
            logging.info(f"[📊 状态平稳] 设备 {device_id} 平稳运行中... 阻距: {obstacle}cm")

    except Exception as e:
        logging.error(f"[FATAL] 大脑神经元破裂: {str(e)}")
