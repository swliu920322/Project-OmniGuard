# 1. 强行切入到 Serverless 安全大脑的物理子领地
cd src/cloud-orchestrator

# 2. 物理隔离：在子领地内部创建属于自己的虚拟环境
python3 -m venv .venv

# 3. 激活控制链（Mac / Linux 环境）
source .vnv/bin/activate
# 如果你是 Windows 环境请执行： .\.venv\Scripts\activate

# 4. 在隔离环境内安装我们昨天配置的依赖控制链
pip install -r requirements.txt