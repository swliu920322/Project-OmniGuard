#!/bin/bash
# file: scripts/add-device.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

DEVICE_ID=$1
HUB_NAME="iot-omni-2ldbii7jgilfq"
RG="omni-guard-infra-sea-rg"

if [ -z "$DEVICE_ID" ]; then
  echo "[FATAL] 必须提供设备 ID。用法: sh add-device.sh <DeviceID>"
  exit 1
fi

echo "[INFO] 正在 IoT Hub 中强制注册物理探针: $DEVICE_ID ..."
az iot hub device-identity create -g "$RG" --hub-name "$HUB_NAME" --device-id "$DEVICE_ID" > /dev/null 2>&1 || true

echo "[INFO] 提取设备专属连接串并写入边缘模拟器配置..."
CONN_STR=$(az iot hub device-identity connection-string show -g "$RG" --hub-name "$HUB_NAME" --device-id "$DEVICE_ID" --query connectionString -o tsv)

ENV_FILE="$SCRIPT_DIR/../src/cloud-orchestrator/edge-simulator/.env"
echo "IOTHUB_DEVICE_CONNECTION_STRING=\"$CONN_STR\"" > "$ENV_FILE"

echo "[SUCCESS] 凭证自动写入完成！文件路径: $ENV_FILE"
echo "连接串: $CONN_STR"


echo "[INFO] 正在提取 Event Hub 兼容连接串并同步至 local.settings.json ..."
EVENTHUB_CONN_STR=$(az iot hub connection-string show -g "$RG" --hub-name "$HUB_NAME" --default-eventhub --query connectionString -o tsv)

python3 -c "
import json, os
path = '$SCRIPT_DIR/../src/cloud-orchestrator/local.settings.json'
if os.path.exists(path):
    with open(path, 'r') as f:
        data = json.load(f)
    data.setdefault('Values', {})['IotHubEventHubConnectionString'] = '$EVENTHUB_CONN_STR'
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print('[SUCCESS] 已自动更新 local.settings.json 中的 IotHubEventHubConnectionString。')
else:
    print('[WARNING] 未找到 local.settings.json，跳过自动配置。')
"