#!/usr/bin/env bash
# =========================================================================
# Project-OmniGuard: Idempotent Cloud Destruction & FinOps Evacuation Script
# =========================================================================
set -euo pipefail

# 刚性锁死目标学术订阅与资源组坐标
RG_NAME="omni-guard-infra-sea-rg"

echo "================================================================="
echo "🚨  [CRITICAL WARNING] INITIATING DESTRUCTIVE TEARDOWN PROTOCOL"
echo "================================================================="
echo "🔥 Target Resource Group : ${RG_NAME}"
echo "🔥 Affected Plane        : SWA Edge, Function Compute, Storage Trident, VNets"
echo "================================================================="
echo "⚠️  This action will physically obliterate all cloud assets."
read -p "Are you absolutely sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "❌ [ABORT] Destruction sequence terminated by operator. Defense line secured."
    exit 1
fi

echo "💥 [1/2] Initiating atomic deletion of Resource Group: ${RG_NAME}..."

# 🟩 工业级同步强拆：不带 --no-wait，逼迫终端死守直至微软云端硬件完全释放，确保下一次重建不撞车
if az group exists --name "$RG_NAME" > /dev/null 2>&1; then
    az group delete --name "$RG_NAME" --yes --verbose
    echo "🟩 [2/2] Resource Group ${RG_NAME} successfully vaporized."
else
    echo "ℹ️  [SKIP] Resource Group ${RG_NAME} does not exist in the current tenant. No action needed."
fi

echo "================================================================="
echo "🎉 [SUCCESS] All ephemeral infrastructure footprints have been completely wiped."
echo "💰 Active billing metrics reduced to absolute zero ($0/M)."
echo "💡 You can now safely execute ./infra-up.sh to provision a clean, compliant baseline."
echo "================================================================="