#!/usr/bin/env python3
"""
OmniGuard Shadow Environment E2E Test Suite
--------------------------------------------
在隔离的影子环境中执行端到端部署测试，验证 Private Endpoint 及 DNS 内网连通性，
测试完成后自动自愈销毁资源组，防止费用泄露。
"""

import os
import sys
import json
import signal
import shutil
import time
import subprocess
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
AZURE_DIR = os.path.join(PROJECT_ROOT, '.azure')
PARAM_FILE = os.path.join(AZURE_DIR, 'main.parameters.json')
BICEP_FILE = os.path.join(AZURE_DIR, 'main.bicep')
SHADOW_PARAM_FILE = os.path.join(AZURE_DIR, 'shadow-test.parameters.json')
SHADOW_RG = 'omnitest-guard-infra-sea-rg'

test_results = []
start_time = None
deploy_success = False
cleanup_done = False


def red(text):
    return f"\033[91m{text}\033[0m"

def yellow(text):
    return f"\033[93m{text}\033[0m"

def green(text):
    return f"\033[92m{text}\033[0m"

def cyan(text):
    return f"\033[96m{text}\033[0m"

def record(assertion, passed, detail=''):
    status = green('PASS') if passed else red('FAIL')
    test_results.append((assertion, passed, detail))
    print(f"  [{status}] {assertion}")
    if detail:
        print(f"       {detail}")


def signal_handler(sig, frame):
    print(yellow(f"\n[!] 检测到中断信号 (Ctrl+C)，立即执行自愈销毁..."))
    teardown()
    sys.exit(1)

signal.signal(signal.SIGINT, signal_handler)


def run_cmd(cmd, timeout=300):
    result = subprocess.run(
        cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, timeout=timeout, shell=isinstance(cmd, str)
    )
    return result


def check_prerequisites():
    print(cyan("[*] 步骤 1: 前置条件检查"))
    if not os.path.exists(BICEP_FILE):
        print(red(f"[!] Bicep 模板文件不存在: {BICEP_FILE}"))
        print("    请先在配置台中保存 IaC 配置后再运行影子测试。")
        sys.exit(1)
    print(green(f"  [✔] Bicep 模板: {BICEP_FILE}"))

    if not os.path.exists(PARAM_FILE):
        print(red(f"[!] 参数文件不存在: {PARAM_FILE}"))
        print("    请先在配置台中保存 IaC 配置。")
        sys.exit(1)
    print(green(f"  [✔] 参数文件: {PARAM_FILE}"))

    result = run_cmd(['az', 'account', 'show'])
    if result.returncode != 0:
        print(red("[!] 未检测到活跃的 Azure 登录会话"))
        print("    请先执行 az login 登录。")
        sys.exit(1)
    account_info = json.loads(result.stdout)
    print(green(f"  [✔] Azure 已登录 - 订阅: {account_info.get('name', 'N/A')} ({account_info.get('id', 'N/A')})"))


def generate_shadow_params():
    print(cyan("\n[*] 步骤 2: 生成影子测试参数集 (Prefix Overwrite)"))
    with open(PARAM_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    params = data.get('parameters', {})

    if 'prefix' in params and 'value' in params['prefix']:
        old_prefix = params['prefix']['value']
        params['prefix']['value'] = 'omnitest'
        print(f"  [~] prefix: {old_prefix} → omnitest")
    else:
        params['prefix'] = {'value': 'omnitest'}
        print(f"  [~] prefix: (未设置) → omnitest")

    if 'customResourceGroupName' in params and 'value' in params['customResourceGroupName']:
        old_rg = params['customResourceGroupName']['value']
        params['customResourceGroupName']['value'] = SHADOW_RG
        print(f"  [~] customResourceGroupName: {old_rg} → {SHADOW_RG}")
    else:
        params['customResourceGroupName'] = {'value': SHADOW_RG}
        print(f"  [~] customResourceGroupName: (未设置) → {SHADOW_RG}")

    open_ai = params.get('openAiKey', {}).get('value', '')
    if not open_ai:
        print(yellow("  [~] 警告: openAiKey 为空，经典密钥降级轨将继续测试"))

    data['parameters'] = params
    with open(SHADOW_PARAM_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(green(f"  [✔] 影子参数已写入: {SHADOW_PARAM_FILE}"))

    location = params.get('location', {}).get('value', 'southeastasia')
    return location


def deploy_shadow(location):
    global deploy_success
    print(cyan(f"\n[*] 步骤 3: 影子环境部署拉起 (区域: {location})"))
    print(f"     资源组: {SHADOW_RG}")
    print(f"     命令: az deployment sub create --name omnitest-shadow-deployment "
          f"--location {location} --template-file {BICEP_FILE} --parameters @{SHADOW_PARAM_FILE}")

    result = run_cmd([
        'az', 'deployment', 'sub', 'create',
        '--name', 'omnitest-shadow-deployment',
        '--location', location,
        '--template-file', BICEP_FILE,
        '--parameters', f'@{SHADOW_PARAM_FILE}'
    ], timeout=600)

    if result.returncode == 0:
        deploy_success = True
        print(green("  [✔] 影子环境部署成功！"))
        return True
    else:
        print(red("  [✘] 影子环境部署失败"))
        print(result.stderr)
        record('影子环境部署', False, result.stderr)
        return False


def audit_network():
    print(cyan("\n[*] 步骤 4: 云端网络连通性深度审计"))

    # 4.1 Cosmos DB Private DNS A Record
    print(yellow("\n  --- 4.1 Cosmos DB 私网 A 记录 ---"))
    result = run_cmd([
        'az', 'network', 'private-dns', 'record-set', 'a', 'list',
        '-g', SHADOW_RG, '-z', 'privatelink.documents.azure.net'
    ])
    if result.returncode == 0 and result.stdout.strip():
        records = json.loads(result.stdout)
        cosmos_ips = []
        for r in records:
            for a in r.get('aRecords', []):
                ip = a.get('ipv4Address', '')
                cosmos_ips.append(ip)
        passed = any(ip.startswith('10.1.2.') for ip in cosmos_ips)
        record(f'Cosmos DB A 记录指向 StorageSubnet (10.1.2.x)',
               passed, f'IPs: {cosmos_ips}')
    else:
        record('Cosmos DB 私有 DNS 查询', False, result.stderr)

    # 4.2 Key Vault Private DNS A Record
    print(yellow("\n  --- 4.2 Key Vault 私网 A 记录 ---"))
    result = run_cmd([
        'az', 'network', 'private-dns', 'record-set', 'a', 'list',
        '-g', SHADOW_RG, '-z', 'privatelink.vaultcore.azure.net'
    ])
    if result.returncode == 0 and result.stdout.strip():
        records = json.loads(result.stdout)
        kv_ips = []
        for r in records:
            for a in r.get('aRecords', []):
                ip = a.get('ipv4Address', '')
                kv_ips.append(ip)
        passed = any(ip.startswith('10.1.2.') for ip in kv_ips)
        record(f'Key Vault A 记录指向 StorageSubnet (10.1.2.x)',
               passed, f'IPs: {kv_ips}')
    else:
        record('Key Vault 私有 DNS 查询', False, result.stderr)

    # 4.3 ACA Container Health
    print(yellow("\n  --- 4.3 ACA 容器健康状态 ---"))
    result = run_cmd([
        'az', 'containerapp', 'show',
        '-g', SHADOW_RG, '-n', 'omnitest-backend',
        '--query', 'properties.provisioningState', '-o', 'tsv'
    ])
    if result.returncode == 0:
        state = result.stdout.strip()
        passed = state == 'Succeeded'
        record(f'ACA omnitest-backend 预配状态为 Succeeded',
               passed, f'实际状态: {state}')
    else:
        record('ACA omnitest-backend 查询', False, result.stderr)


def teardown():
    global cleanup_done
    if cleanup_done:
        return
    cleanup_done = True
    print(cyan(f"\n[*] 步骤 5: 自愈销毁与资源清退"))

    # Delete resource group (async, no-wait)
    print(f"  [*] 正在删除影子资源组 '{SHADOW_RG}' ...")
    result = run_cmd(['az', 'group', 'delete', '--name', SHADOW_RG, '--yes', '--no-wait'])
    if result.returncode == 0:
        print(green(f"  [✔] 资源组 '{SHADOW_RG}' 删除指令已提交 (异步)"))
    else:
        print(red(f"  [✘] 资源组删除失败: {result.stderr}"))

    # Clean up temp shadow param file
    if os.path.exists(SHADOW_PARAM_FILE):
        os.remove(SHADOW_PARAM_FILE)
        print(green(f"  [✔] 临时参数文件已清理: {SHADOW_PARAM_FILE}"))


def print_report():
    elapsed = time.time() - start_time
    print(cyan("\n" + "=" * 60))
    print("  OmniGuard Shadow E2E Test Report")
    print("=" * 60)
    print(f"\n  总耗时: {elapsed:.1f} 秒")
    print(f"  部署状态: {'成功' if deploy_success else '失败'}")
    print(f"  资源组: {SHADOW_RG}")

    total = len(test_results)
    passed = sum(1 for _, p, _ in test_results if p)
    failed = total - passed

    print(f"\n  测试断言: {passed}/{total} 通过")
    for assertion, p, detail in test_results:
        icon = green('✔') if p else red('✘')
        print(f"    {icon} {assertion}")

    print(f"\n  资源组状态: 已提交异步销毁 (--no-wait)")
    print("=" * 60)

    if failed > 0:
        print(red(f"\n[!] 测试未完全通过 ({failed} 项失败)"))
    else:
        print(green(f"\n[✔] 全部测试通过！"))
    print(yellow("注意: 资源组删除为异步操作，请稍后通过以下命令确认:"))
    print(f"  az group show -n {SHADOW_RG} --query properties.provisioningState")


if __name__ == '__main__':
    start_time = time.time()
    print("=" * 60)
    print("  OmniGuard Shadow Environment E2E Test Suite")
    print("  " + datetime.now().strftime('%Y-%m-%d %H:%M:%S'))
    print("=" * 60)

    exit_code = 0
    try:
        check_prerequisites()
        location = generate_shadow_params()

        if deploy_shadow(location):
            audit_network()
        else:
            print(yellow("[~] 部署失败，跳过网络审计，直接进入资源清理"))

    except subprocess.TimeoutExpired:
        print(red("[!] 命令执行超时"))
        exit_code = 1
    except Exception as e:
        print(red(f"[!] 脚本异常: {e}"))
        exit_code = 1
    finally:
        teardown()
        print_report()
        sys.exit(exit_code if test_results and not all(p for _, p, _ in test_results) else 0)
