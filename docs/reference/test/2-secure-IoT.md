# 2: 内网隔离 (Secure-IoT) 验收文档

## 1. 托管身份验证
```
PREFIX="omni2"
RG="${PREFIX}-guard-infra-sea-rg"
BACKEND_APP="${PREFIX}-backend"

az identity list \
  -g "$RG" \
  --query "[].{Name:name, Principal:principalId}" -o table

# 输出
没有输出

```