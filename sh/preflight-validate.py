#!/usr/bin/env python3
"""
OmniGuard Preflight Deployment Validator
-----------------------------------------
对合并后的参数包执行 Azure 云端预飞行验证（az deployment sub validate），
在真正部署前捕获权限、注册、合规性等问题。
"""

import os
import sys
import json
import subprocess

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
AZURE_DIR = os.path.join(PROJECT_ROOT, '.azure')
PARAM_FILE = os.path.join(AZURE_DIR, 'main.parameters.json')
BICEP_FILE = os.path.join(AZURE_DIR, 'main.bicep')

def red(text):
    return f"\033[91m{text}\033[0m"

def yellow(text):
    return f"\033[93m{text}\033[0m"

def green(text):
    return f"\033[92m{text}\033[0m"

def check_prerequisites():
    if not os.path.exists(PARAM_FILE):
        print(red(f"[!] 参数文件不存在: {PARAM_FILE}"))
        print("    请先在配置台中保存 IaC 配置后再运行预飞行校验。")
        sys.exit(1)
    if not os.path.exists(BICEP_FILE):
        print(red(f"[!] Bicep 模板文件不存在: {BICEP_FILE}"))
        sys.exit(1)
    print(green(f"[✔] 参数文件: {PARAM_FILE}"))
    print(green(f"[✔] Bicep 模板: {BICEP_FILE}"))

def extract_location():
    with open(PARAM_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    params = data.get('parameters', {})
    location = None
    for candidate in ['location', 'Location', 'LOCATION']:
        val = params.get(candidate)
        if val and isinstance(val, dict) and 'value' in val:
            location = val['value']
            break
        if val and isinstance(val, str):
            location = val
            break
    if not location:
        print(yellow("[~] 未从 parameters 中提取到 location，将使用默认值 'southeastasia'"))
        location = 'southeastasia'
    else:
        print(green(f"[✔] 目标区域: {location}"))
    return location

def run_preflight_validation(location):
    print(yellow(f"\n[*] 正在向 Azure 提交预飞行校验请求 (区域: {location})..."))
    print(f"    命令: az deployment sub validate --location {location} "
          f"--template-file {BICEP_FILE} --parameters @{PARAM_FILE}\n")

    try:
        result = subprocess.run(
            ["az", "deployment", "sub", "validate",
             "--location", location,
             "--template-file", BICEP_FILE,
             "--parameters", f"@{PARAM_FILE}"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=300
        )
    except FileNotFoundError:
        print(red("[!] 未检测到 'az' CLI 命令"))
        print(yellow("    请确保已安装 Azure CLI (https://aka.ms/installazurecli)"))
        sys.exit(1)
    except subprocess.TimeoutExpired:
        print(red("[!] 预飞行校验超时（5分钟）"))
        print(yellow("    请检查网络连接或 Azure 服务状态"))
        sys.exit(1)

    combined_output = result.stdout + "\n" + result.stderr

    if result.returncode == 0:
        print(green("[✔] 预飞行校验通过！模板与参数在 Azure 端验证 100% 合法。"))
        print("\n--- 校验输出 ---")
        print(result.stdout)
        return True
    else:
        print(red("[!] 预飞行校验失败。错误详情如下："))
        print(result.stderr)

        if 'SubscriptionNotRegistered' in combined_output:
            print(red("\n[!] 错误类型: SubscriptionNotRegistered"))
            print(yellow("    当前订阅尚未注册所需的资源提供程序。"))
            print("    请执行: az provider register --namespace <命名空间>")
        elif 'RoleAssignmentCreationFailed' in combined_output or 'AuthorizationFailed' in combined_output:
            print(red("\n[!] 错误类型: 权限不足 (RoleAssignmentCreationFailed / AuthorizationFailed)"))
            print(yellow("    当前登录账号在订阅级别缺乏分配 Managed Identity 权限"))
            print(yellow("    请在配置台中切换为【经典密钥（受限账号）】模式"))
        else:
            print(yellow("\n[~] 未知错误，请检查上述输出或联系管理员。"))

        return False


if __name__ == '__main__':
    print("=" * 60)
    print("  OmniGuard Preflight Deployment Validator")
    print("=" * 60)

    check_prerequisites()
    location = extract_location()
    success = run_preflight_validation(location)

    if success:
        print(f"\n{green('[✔]')} 校验全部通过，可以安全部署！")
        print(f"    部署命令: az deployment sub create --location {location} "
              f"--template-file {BICEP_FILE} --parameters @{PARAM_FILE}")
    else:
        print(f"\n{red('[!]')} 校验未通过，请修正问题后重新运行。")

    sys.exit(0 if success else 1)
