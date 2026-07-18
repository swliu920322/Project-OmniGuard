export const translations = {
  zh: {
    sidebar: {
      title_profile: "个人空间",
      title_iac: "云原生 IaC 军火库",
      title_simulation: "分布式仿真沙箱",
      resume: "个人求职履历",
      iacDashboard: "IaC 架构看板",
      configurator: "可视化配置台",
      fleet: "车队动力学仿真",
      prediction: "大 V 投研分析仪",
      systemOk: "系统就绪",
      collapse: "折叠导航",
      expand: "展开导航"
    },
    resume: {
      role: "解决方案架构师 (AI & 云转型)",
      location: "新加坡",
      summary_title: "专业总结",
      project_title: "旗舰项目 (本平台)",
      experience_title: "职业生涯",
      education_title: "教育背景",
      certs_title: "微软 & AI 认证",
      status_achieved: "已取得",
      status_learning: "在学中",
      summary_content: "10 年以上工程卓越经验，将稳健的软件系统与 AI 原生解决方案深度融合。擅长将复杂的前端模块化设计转化为高水准的 Azure 云架构与智能体工作流（Agentic Workflows）。在世界 500 强企业中拥有丰富经验，致力于交付标准 SOP 和高可扩展的工程最佳实践。",
      deg_taylors: "应用计算理学硕士 (AI 专业)",
      deg_tyut: "机械工程工学学士",
      period_current: "2025 - 至今",
      exp: {
        omniguard: {
          company: "基于 Azure 的多智能体编排平台",
          title: "首席架构师",
          bullet1: "可视化配置与包组装器：设计并实现编译器前端及 API，动态组装 Sandbox 和 Secure IoT Hub Bicep 模板，支持自定义 VNet CIDR、托管身份与物理 SKU 规格调整，支持打包下载。",
          bullet2: "零信任安全边界：构建了带 Private Endpoint 和 Private DNS Zone 的 Hub-Spoke 虚拟网络拓扑，实施严格的 Entra ID RBAC 并阻断公网访问，保障 Key Vault 与 Cosmos DB 的内网私密安全连接。",
          bullet3: "智能体工作流：设计并统一了 Azure OpenAI 客户端加载与配置重载机制，实现 live API 双语推文翻译、投研报告自动生成与单步仿真回溯。"
        },
        accenture: {
          company: "埃森哲 (Accenture)",
          title: "高级技术顾问 / 架构师",
          bullet1: "主导金融科技平台 0 到 1 的基础架构搭建，采用模块化的微前端实现业务隔离。",
          bullet2: "规划多项目同构构建与静态打包优化方案，使本地及流水线编译效率提升达 40%。",
          bullet3: "构建了通用运行时状态机组件，用于对话流程控制与审计凭证生命周期管理。"
        },
        scania: {
          company: "斯堪尼亚 (Scania Group)",
          title: "软件开发工程师",
          bullet1: "与欧洲及亚洲跨国团队合作，评估并构建 MES/MOM 生产线数据采集控制层。",
          bullet2: "解决严格工业合规与安全审计标准下的前端扩展性与系统集成技术难题。"
        },
        aosheng: {
          company: "奥盛信息科技",
          title: "主导系统架构师 (系统迁移)",
          bullet1: "主导传统网银平台的前端架构重构，将遗留的手工拼装模式重塑为模块化装配模型。",
          bullet2: "引入静态代码审计与 Dry-Run 预飞行校验机制，保障银行核心资产迁移的安全性。"
        }
      }
    },
    iac: {
      title: "IaC 拓扑与编排看板",
      subtitle: "读取本地编译状态，将全局云参数与 Bicep 模块依赖链（ VFS ）整合进行双维度直观呈现。",
      btn_configurator: "⚙️ 进入配置台调优",
      btn_download: "📥 打包下载 IaC 包",
      empty_title: "尚未保存任何本地架构配置",
      empty_desc: "您的本地工作区中目前没有有效的配置文件。请点击下方按钮进入可视化配置中心，微调您的云端算力网络与托管凭证。",
      empty_btn: "立即开始配置第一套拓扑",
      card_scenario: "当前场景",
      card_scenario_desc: "当前激活场景",
      card_vnet: "网络拓扑",
      card_vnet_desc: "骨干 CIDR 网段",
      card_scope: "物理范围",
      card_scope_desc: "前缀 / 物理区域",
      card_sku: "服务规格",
      card_sku_desc: "已激活服务计费项",
      card_sku_active: "个服务已激活",
      tab_topology: "🖼️ 物理拓扑依赖关系图 (Topology Diagram)",
      tab_parameters: "💻 parameters.json 变量预览 (Variables Preview)",
      canvas_perspective: "拓扑视角",
      canvas_reset: "重置主视角 [main.bicep]",
      json_copied: "已复制",
      json_copy: "复制 JSON"
    }
  },
  en: {
    sidebar: {
      title_profile: "PROFILE",
      title_iac: "IAC ARMORY",
      title_simulation: "SIMULATION SANDBOX",
      resume: "Personal Resume",
      iacDashboard: "IaC Dashboard",
      configurator: "Configurator Studio",
      fleet: "Fleet Dynamics",
      prediction: "KOL Prediction",
      systemOk: "SYS_ACTIVE",
      collapse: "Collapse",
      expand: "Expand"
    },
    resume: {
      role: "Solutions Architect (AI & Cloud Transformation)",
      location: "Singapore",
      summary_title: "PROFESSIONAL SUMMARY",
      project_title: "SIGNATURE PROJECT (THIS PLATFORM)",
      experience_title: "WORK EXPERIENCE",
      education_title: "EDUCATION",
      certs_title: "MICROSOFT & AI CERTIFICATIONS",
      status_achieved: "Achieved",
      status_learning: "In Progress",
      summary_content: "10+ years of engineering excellence, bridging robust software systems with AI-native solutions. Expert in transitioning complex front-end modularity into high-level Azure Cloud Architectures and Agentic Workflows. Proven track record in Fortune 500 environments delivering standardized SOPs and measurable ROI.",
      deg_taylors: "MSc in Applied Computing (AI Specialization)",
      deg_tyut: "B.Eng in Mechanical Engineering",
      period_current: "2025 - Present",
      exp: {
        omniguard: {
          company: "Azure-Based Multi-Agent Orchestration Platform",
          title: "Lead Architect",
          bullet1: "Visual configuration & package assembler: Designed and implemented the compiler frontend and API to dynamically assemble Sandbox and Secure IoT Hub Bicep templates. Enables custom VNet CIDRs, managed identity, and physical SKU configuration with zip download.",
          bullet2: "Zero-Trust security envelope: Architected VNet Hub-Spoke network topology with Private Endpoints and Private DNS Zones. Enforces strict Entra ID RBAC and blocks public access, ensuring secure private network database connectivity (Key Vault & Cosmos DB).",
          bullet3: "Agentic workflows: Abstracted and unified client initialization for Azure OpenAI. Supports aliases for service-specific overrides, implementing live API bilingual tweet translation and investment archives.",
        },
        accenture: {
          company: "Accenture",
          title: "Associate Manager (Technical Lead / Architect)",
          bullet1: "Led the 0-to-1 foundational architecture for FinTech platforms with modular micro-frontend isolation.",
          bullet2: "Devised isomorphic multi-project builds and optimized asset bundling strategies, improving compile efficiency by 40%.",
          bullet3: "Developed a generic runtime intelligent state machine for centralized dialog controls and audit token life-cycle management."
        },
        scania: {
          company: "Scania Group",
          title: "Software Engineer",
          bullet1: "Collaborated with cross-functional European and Asian teams to evaluate and build MES/MOM production line data acquisition control layers.",
          bullet2: "Addressed frontend scalability and system integration challenges under strict industrial compliance and security audit standards."
        },
        aosheng: {
          company: "Aosheng Information Technology",
          title: "Lead Systems Architect (Migration)",
          bullet1: "Orchestrated frontend architecture refactoring for legacy corporate banking platforms from legacy manual patterns to a modular assembly model.",
          bullet2: "Introduced static code review and dry-run preflight check mechanisms to secure critical banking asset migrations."
        }
      }
    },
    iac: {
      title: "IaC Topology & Orchestration Dashboard",
      subtitle: "Reads local compile states, integrating global cloud parameters and Bicep module dependency chains (VFS) for dual-dimensional visualization.",
      btn_configurator: "⚙️ Go to Configurator Studio",
      btn_download: "📥 Download IaC Package",
      empty_title: "No Local Architecture Configuration Saved Yet",
      empty_desc: "There are no active configuration files in your workspace. Click the button below to configure your network segmentations, computing nodes, and security credentials.",
      empty_btn: "Start Configuring First Topology",
      card_scenario: "Scenario",
      card_scenario_desc: "Active Scenario",
      card_vnet: "Network VNet",
      card_vnet_desc: "Backbone CIDR Block",
      card_scope: "Global Scope",
      card_scope_desc: "Prefix / Location",
      card_sku: "SKU Pricing",
      card_sku_desc: "Activated Billing Nodes",
      card_sku_active: "billing items active",
      tab_topology: "🖼️ Module Dependency Diagram",
      tab_parameters: "💻 parameters.json Variables Preview",
      canvas_perspective: "Perspective",
      canvas_reset: "Reset View [main.bicep]",
      json_copied: "Copied",
      json_copy: "Copy JSON"
    }
  }
};
