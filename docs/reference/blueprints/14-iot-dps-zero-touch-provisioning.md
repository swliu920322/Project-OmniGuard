# 蓝图 14: IoT 设备零接触自动注册 (IoT DPS & Zero-Touch Provisioning)

> **领域**: 物联网与安全 | **优先级**: P2 | **复杂度**: 高 | **预估工时**: 3~5天
> 
> 本蓝图阐述如何引入 Azure IoT Hub Device Provisioning Service (DPS)，实现物联网设备在大规模场景下的零接触自动注册与证书身份认证 (X.509)，替换不安全的静态主密钥连接字符串模式。

---

## 1. 现状与痛点

### 当前设计
- 设备连接使用 IoT Hub 级别的共享访问策略 (Shared Access Policy) 连接字符串，或者为每个设备手动在 Azure Portal 注册并拷贝设备密钥。
- 在真实工厂/车间部署时，手动拷贝密钥不仅工作量巨大，且极易泄露，一旦主密钥泄露，攻击者可以伪造任意设备发送遥测数据。

### 优化方向
- 设备出厂时只写入唯一的设备证书 (X.509) 以及 DPS 终结点。
- 联网时，设备向 DPS 注册并校验 X.509 证书。DPS 验证成功后，动态为该设备在 IoT Hub 中创建 Identity，并指引设备连接正确的 IoT Hub。

---

## 2. 目标架构与工作流

```
┌────────────┐          ┌──────────────┐          ┌─────────────┐
│ IoT Device │          │   IoT DPS    │          │   IoT Hub   │
└─────┬──────┘          └──────┬───────┘          └──────┬──────┘
      │                        │                         │
      │ 1. 提交凭据/X.509 证书    │                         │
      ├───────────────────────►│                         │
      │                        │ 2. 验证证书 & 规则匹配     │
      │                        ├─────────┐               │
      │                        │         │               │
      │                        │◄────────┘               │
      │                        │                         │
      │                        │ 3. 动态创建设备 Identity  │
      │                        ├────────────────────────►│
      │                        │◄────────────────────────┤
      │                        │                         │
      │ 4. 返回分配的 IoT Hub 域名│                         │
      │◄───────────────────────┤                         │
      │                        │                         │
      │ 5. 使用 X.509 直接连接                           │
      ├─────────────────────────────────────────────────►│
```

---

## 3. Bicep 实施步骤

### Step 1: 部署 DPS 资源并链接到 IoT Hub

```bicep
// 1. 创建 DPS 实例
resource dps 'Microsoft.Devices/provisioningServices@2022-12-15' = {
  name: '${prefix}-iot-dps'
  location: location
  sku: { name: 'S1', capacity: 1 }
  properties: {
    // 链接的 IoT Hub 列表
    iotHubs: [
      {
        connectionString: 'HostName=${iotHub.properties.hostName};SharedAccessKeyName=iothubowner;SharedAccessKey=${listKeys(iotHub.id, iotHub.apiVersion).primaryKey}'
        location: location
      }
    ]
  }
}
```

### Step 2: 定义设备注册组 (Enrollment Group)

注册组允许任何持有特定 Root/Intermediate CA 证书签发的设备进行注册，无需为单个设备预先配置信息。

```bicep
// 创建 X.509 验证组
resource dpsEnrollmentGroup 'Microsoft.Devices/provisioningServices/enrollmentGroups@2022-12-15' = {
  name: 'omniguard-x509-group'
  parent: dps
  properties: {
    attestation: {
      type: 'x509'
      x509: {
        signingCertificates: {
          primary: {
            // 需要上传已经验证过的 CA 证书
            certificate: loadTextContent('./certs/rootCA.pem')
          }
        }
      }
    }
    provisioningStatus: 'Enabled'
    allocationPolicy: 'Hashed' // 散列分配，支持多 IoT Hub 负载均衡
  }
}
```

---

## 4. Python 设备注册客户端实现

设备端代码通过 DPS 注册并取得 IoT Hub 连接凭据：

```python
import os
import asyncio
from azure.iot.device.aio import ProvisioningDeviceClient
from azure.iot.device.aio import IoTHubDeviceClient
from azure.iot.device import X509

# 设备证书与私钥
x509 = X509(
    cert_file="device-cert.pem",
    key_file="device-key.pem",
    passphrase="cert-password"
)

async def main():
    # 从 DPS 注册
    provisioning_client = ProvisioningDeviceClient.create_from_x509(
        provisioning_host="global.azure-devices-provisioning.net",
        registration_id="device-001",
        id_scope=os.getenv("DPS_ID_SCOPE"),
        x509=x509
    )
    
    # 获取分配的 IoT Hub 结果
    registration_result = await provisioning_client.register()
    print(f"Registration status: {registration_result.status}")
    print(f"Assigned hub: {registration_result.assigned_hub}")
    print(f"Device ID: {registration_result.device_id}")
    
    if registration_result.status == "assigned":
        # 使用动态分配的 IoT Hub 直接连接
        device_client = IoTHubDeviceClient.create_from_x509(
            x509=x509,
            hostname=registration_result.assigned_hub,
            device_id=registration_result.device_id
        )
        
        await device_client.connect()
        print("Successfully connected to assigned IoT Hub via X.509!")
        
        # 发送心跳遥测
        await device_client.send_message("{\"status\": \"online\"}")
        await device_client.shutdown()

if __name__ == "__main__":
    asyncio.run(main())
```

---

## 5. 验收标准与验证

- [ ] 在 Azure Portal DPS 下的 `Manage Enrollments` 能看到 `omniguard-x509-group` 组状态为 `Enabled`。
- [ ] 运行模拟器客户端，控制台输出 `Registration status: assigned`。
- [ ] 在 IoT Hub 的 `Devices` 面板中，验证已自动新增名为 `device-001` 的设备，且认证类型为 `X.509 CA Signed`。
