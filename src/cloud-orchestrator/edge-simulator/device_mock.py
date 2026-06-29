
import os
import time
import json
from azure.iot.device import IoTHubDeviceClient, Message

from dotenv import load_dotenv
load_dotenv() # 强行加载同目录下的 .env

# 强制从环境变量读取，锁死安全边界，禁止硬编码
CONNECTION_STRING = os.getenv("IOTHUB_DEVICE_CONNECTION_STRING")


def message_handler(message):
  """拦截云端大脑 (Azure OpenAI) 经由网关下发的物理动作 (C2D)"""
  print(f"\n[⚠️ 云端指令下达] 拦截到大模型 Action: {message.data.decode('utf-8')}")


def run_telemetry_loop():
  if not CONNECTION_STRING:
    raise ValueError("[FATAL] 物理连接串缺失！请设置环境变量 IOTHUB_DEVICE_CONNECTION_STRING")

  print("[INFO] 正在打通 MQTT 全双工长连接...")
  # 建立底层神经丛连接
  client = IoTHubDeviceClient.create_from_connection_string(CONNECTION_STRING)

  # 挂载云端指令回调钩子
  client.on_message_received = message_handler

  client.connect()
  print("[SUCCESS] 神经链路贯通。开始高频压测物理环境数据 (1 msg/sec)...")

  try:
    x_coord = 0
    while True:
      # 组装具身智能设备的物理状态 (Device Twin)
      payload = {
        "tenant_id": "Tenant-Alpha",
        "device_id": "Robo-A1",
        "location": {"x": x_coord, "y": 15},
        "status": "idle",
        "obstacle_distance_cm": 42
      }
      msg = Message(json.dumps(payload))
      msg.message_id = f"msg-{x_coord}"
      msg.content_encoding = "utf-8"
      msg.content_type = "application/json"

      # 强行推入 IoT Hub
      client.send_message(msg)
      print(f"[PUSH] 已上报设备状态 -> X坐标: {payload['location']['x']}")

      x_coord += 1
      time.sleep(1)  # 1Hz 频率

  except KeyboardInterrupt:
    print("\n[INFO] 拔除物理探针，切断 MQTT 连接。")
    client.disconnect()


if __name__ == '__main__':
  run_telemetry_loop()