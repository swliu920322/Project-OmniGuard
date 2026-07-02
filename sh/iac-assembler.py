#!/usr/bin/env python3
"""
OmniGuard IaC Scenarios Assembler & Compiler (File-Copier Edition)
-------------------------------------------------------------
根据选择的架构场景（Sandbox, Secure IoT），从 .azure/templates/<scenario>/ 目录拷贝模板到 .azure/ 目录，
并在重写前自动进行本地备份，最后运行 Bicep 编译器预检，确保代码 100% 编译通过。
"""

import os
import sys
import shutil
import time
import argparse
import subprocess

# Paths definition
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
AZURE_DIR = os.path.join(PROJECT_ROOT, '.azure')
TEMPLATES_DIR = os.path.join(AZURE_DIR, 'templates')
BACKUP_DIR = os.path.join(AZURE_DIR, 'backups')

import json
import filecmp

def rotate_backups(max_keep=5):
    if not os.path.exists(BACKUP_DIR):
        return
    
    # 获取 backups 目录下的所有备份文件夹
    all_backups = []
    for item in os.listdir(BACKUP_DIR):
        item_path = os.path.join(BACKUP_DIR, item)
        if os.path.isdir(item_path) and item.startswith('backup-'):
            all_backups.append((item_path, os.path.getmtime(item_path)))
            
    # 按修改时间从新到旧排序
    all_backups.sort(key=lambda x: x[1], reverse=True)
    
    # 超过限制的文件夹进行物理删除
    if len(all_backups) > max_keep:
        print(f"[*] 检测到备份文件夹数量超过限制 ({max_keep}个)，开始执行轮转清理...")
        for backup_path, _ in all_backups[max_keep:]:
            try:
                shutil.rmtree(backup_path)
                print(f"    - 已清理旧备份: {os.path.basename(backup_path)}")
            except Exception as e:
                print(f"    - 清理失败: {os.path.basename(backup_path)}: {e}")

def backup_existing(target_scenario):
    if not os.path.exists(AZURE_DIR):
        return False
        
    # 检查当前活动代码与目标模板是否已经一致。如果一致，直接跳过备份与重新覆盖
    target_tpl_dir = os.path.join(TEMPLATES_DIR, target_scenario)
    bicep_files = ['main.bicep', 'nested-infra.bicep', 'compute-module.bicep', 'network-rules.json']
    
    if os.path.exists(target_tpl_dir):
        all_identical = True
        for f in bicep_files:
            active_f = os.path.join(AZURE_DIR, f)
            tpl_f = os.path.join(target_tpl_dir, f)
            if not os.path.exists(active_f) or not os.path.exists(tpl_f):
                all_identical = False
                break
            if not filecmp.cmp(active_f, tpl_f, shallow=False):
                all_identical = False
                break
        
        if all_identical:
            print(f"[~] 检测到当前活动代码与目标场景 '{target_scenario}' 模板 100% 一致，跳过冗余备份与重写。")
            return True # 返回 True 表示代码已对齐，不需要后续重新写入和组装

    # 读取当前活跃场景以提供清晰的备份上下文
    source_scenario = 'unknown'
    ui_state_path = os.path.join(AZURE_DIR, 'configurator-ui-state.json')
    if os.path.exists(ui_state_path):
        try:
            with open(ui_state_path, 'r', encoding='utf-8') as f:
                state = json.load(f)
                source_scenario = state.get('uiState', {}).get('activeScenario', 'unknown')
        except Exception:
            pass
            
    timestamp = time.strftime('%Y%m%d-%H%M%S')
    backup_name = f'backup-from-{source_scenario}-before-{target_scenario}-{timestamp}'
    target_backup_dir = os.path.join(BACKUP_DIR, backup_name)
    
    print(f"[*] 正在建立具有场景上下文的物理备份: {backup_name} ...")
    os.makedirs(target_backup_dir, exist_ok=True)
    
    copied_count = 0
    for filename in os.listdir(AZURE_DIR):
        file_path = os.path.join(AZURE_DIR, filename)
        # 仅备份活动的 Bicep 文件与变量描述文件
        if os.path.isfile(file_path) and (filename.endswith('.bicep') or filename.endswith('.json')):
            shutil.copy2(file_path, target_backup_dir)
            print(f"    - 已备份: {filename}")
            copied_count += 1
            
    if copied_count == 0:
        print("    - 根目录下无活动的 Bicep 文件，跳过备份。")
        
    # 执行旧备份轮转清理
    rotate_backups(max_keep=5)
    return False

def assemble_scenario(scenario):
    scenario_src_dir = os.path.join(TEMPLATES_DIR, scenario)
    if not os.path.exists(scenario_src_dir):
        print(f"[!] 错误: 场景模板目录 '{scenario_src_dir}' 未找到！", file=sys.stderr)
        sys.exit(1)
        
    print(f"[*] 开始从模板源动态组装场景: {scenario.upper()}")
    
    # Copy all bicep files from the template scenario directory to the active .azure directory
    copied_files = []
    for filename in os.listdir(scenario_src_dir):
        if filename.endswith('.bicep') or filename.endswith('.json'):
            src_file = os.path.join(scenario_src_dir, filename)
            dst_file = os.path.join(AZURE_DIR, filename)
            shutil.copy2(src_file, dst_file)
            copied_files.append(filename)
            print(f"    - 已组装: {filename}")
            
    if not copied_files:
        print(f"[!] 警告: 源模板目录中未找到任何 Bicep 文件！", file=sys.stderr)
        sys.exit(1)
        
    print("[+] 拓扑文件组装完成！")

def run_preflight_check():
    main_path = os.path.join(AZURE_DIR, 'main.bicep')
    print("[*] 开始运行 Bicep 预检编译测试 (az bicep build)...")
    
    try:
        # Check if az CLI is available and bicep is installed
        result = subprocess.run(
            ["az", "bicep", "build", "--file", main_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        if result.returncode == 0:
            print("[+] Bicep 编译预检通过！生成的 ARM 模板语法 100% 正确！")
            # Delete generated json files to keep .azure/ clean
            compiled_json = os.path.join(AZURE_DIR, 'main.json')
            if os.path.exists(compiled_json):
                os.remove(compiled_json)
        else:
            print(f"[!] Bicep 编译预检失败！详细错误如下：\n{result.stderr}", file=sys.stderr)
            sys.exit(1)
    except FileNotFoundError:
        print("[!] 未检测到 'az' CLI 命令，跳过本地编译校验。请在部署环境进行预检。", file=sys.stderr)

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="OmniGuard IaC Scenarios Assembler")
    parser.add_argument(
        "--scenario", 
        choices=["sandbox", "secure-iot"], 
        default="sandbox",
        help="指定编译的云架构集成场景"
    )
    args = parser.parse_args()
    location = 'southeastasia'
    
    # 1. Backup current Bicep scripts and check alignment
    already_aligned = backup_existing(args.scenario)
    
    if not already_aligned:
        # 2. Assemble new templates
        assemble_scenario(args.scenario)
        
        # 3. Test & Compile Check
        run_preflight_check()
    else:
        print(f"[~] 目标场景 '{args.scenario.upper()}' 已是当前活动配置，跳过组装与预检构建。")
        
    print(f"\n[✔] 场景 {args.scenario.upper()} 编译预检对齐就绪！")
    print(f"    您可以直接运行以下终端指令进行部署:")
    print(f"    az deployment sub create --location {location} --template-file .azure/main.bicep --parameters @.azure/main.parameters.json")
