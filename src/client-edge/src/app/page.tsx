'use client';

import React from 'react';
import { Terminal, MapPin, Mail, Phone, Linkedin } from 'lucide-react';

export default function RootResumePage() {
  return (
    <div className="relative min-h-screen text-gray-100 font-sans p-6 md:p-12 animate-in fade-in duration-200 select-none">
      <div
        className="fixed inset-0 pointer-events-none z-[-1] opacity-15"
        style={{
          backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="max-w-5xl mx-auto">
        <header className="border-b-2 border-[#00f2fe] pb-6 mb-10 relative flex flex-col md:flex-row md:justify-between md:items-end gap-4">
          <div>
            <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1">
              <Terminal size={12} /> IDENTITY_VERIFICATION_SUCCESS
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_0_10px_rgba(0,242,254,0.3)]">
              LIU SHENGWEI
            </h1>
            <div className="text-[#00f2fe] text-lg mt-1 uppercase tracking-widest font-semibold font-mono">
              Solutions Architect (AI & Cloud Transformation)
            </div>
          </div>
          <div className="flex flex-wrap md:flex-col items-start md:items-end gap-3 text-xs text-gray-400 font-mono">
            <span className="flex items-center gap-1.5"><MapPin size={13} /> Singapore</span>
            <span className="flex items-center gap-1.5"><Mail size={13} /> lsw19920322@gmail.com</span>
            <span className="flex items-center gap-1.5"><Phone size={13} /> +6011-1121-6759</span>
            <a 
              href="https://linkedin.com/in/shengwei-liu" 
              target="_blank" 
              rel="noreferrer" 
              className="flex items-center gap-1.5 hover:text-[#00f2fe] transition-colors"
            >
              <Linkedin size={13} /> linkedin.com/in/shengwei-liu
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Section title="PROFESSIONAL SUMMARY">
              <p className="text-gray-400 text-sm leading-relaxed">
                拥有 10 年以上核心开发与系统架构经验，擅长将前端模块化微应用过渡到高可用 Microsoft Azure 云端架构与大模型 AI Agent 智能体工作流。
                在财富 500 强级跨国团队中具备卓越的系统设计交付背景，能将复杂的业务流程解耦并物化为高质量的 DevOps CI/CD 与 FinOps 降本指标。
              </p>
            </Section>

            <Section title="SIGNATURE PROJECT (本平台)">
              <div className="mb-6">
                <div className="flex justify-between font-bold text-white text-sm md:text-base">
                  <span>Azure-Based Multi-Agent Orchestration Platform</span>
                  <span className="text-[#00f2fe] text-xs font-mono">2025 - Present</span>
                </div>
                <div className="text-[#00f2fe] text-xs font-mono mt-1">Lead Architect</div>
                <ul className="mt-3 space-y-2 text-gray-400 text-sm leading-relaxed">
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    <strong className="text-gray-200">可视化配置与打包：</strong> 设计并实现了一键组装 Sandbox / Secure IoT Hub Bicep 预设的编译器前端与 API，支持用户定制 CIDR、托管标识及物理 SKU 并支持 IaC zip 打包下载。
                  </li>
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    <strong className="text-gray-200">零信任安全闭环：</strong> 物理组装 Hub-Spoke 拓扑及 Private Endpoints / Private DNS Zones，完成受控 Identities 的 RBAC 验证并屏蔽所有公网路由，仅允许合规算力在私网内闭环访问 Key Vault 与 Cosmos DB。
                  </li>
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    <strong className="text-gray-200">大智能体网络：</strong> 抽象统一了 Azure OpenAI 客户端实例化逻辑，支持多服务别名环境变量重写，完成基于 live API 的 Tweet 增量双语翻译与投研时序归档。
                  </li>
                </ul>
              </div>
            </Section>

            <Section title="WORK EXPERIENCE">
              <Experience
                company="Accenture"
                period="2021 – 2023"
                title="Associate Manager (Technical Lead / Architect)"
                bullets={[
                  '主持了金融科技系统高内聚、模块化微前端的基础架构搭建。',
                  '设计多工程 Isomorphic 构件共用策略，将打包编译效能提升 40% 以上。',
                  '开发出通用运行时状态机组件，用于统一治理跨页会话生命周期与安全审计令牌。',
                ]}
              />
              <Experience
                company="Scania Group"
                period="2023.7 - 2024.1"
                title="Software Engineer"
                bullets={[
                  '与欧洲/亚洲跨国工程团队协作，评估并构建轻量化工业 MES/MOM 生产线数据采集控制层。',
                  '在严苛的工业信息安全与合规审计标准下，处理前端大规模模块化与异构系统 API 交互难题。',
                ]}
              />
              <Experience
                company="Aosheng Information Technology"
                period="2020.5 – 2021.9"
                title="Lead Systems Architect (Migration)"
                bullets={[
                  '带领团队将陈旧的大型企业网上银行系统从手写硬编码架构重构为模块化拼装模式。',
                  '引入代码级静态审计与预检机制，实现银行核心资产安全迁移。',
                ]}
              />
            </Section>
          </div>

          <div className="space-y-8">
            <Section title="AZURE CERTIFICATIONS">
              <div className="flex flex-col gap-3">
                <CertBadge title="AZ-305" desc="Azure Solutions Architect Expert (云架构师专家)" status="Achieved" />
                <CertBadge title="AZ-104" desc="Azure Administrator Associate (云系统管理员)" status="Achieved" />
                <CertBadge title="AI-102" desc="Azure AI Engineer Associate (云 AI 工程师)" status="Achieved" />
                <CertBadge title="AB-100" desc="Agentic AI Business Architect (智能体业务架构)" status="Pending" time="June 2026" />
              </div>
            </Section>

            <Section title="EDUCATION">
              <div className="mb-4">
                <div className="font-bold text-sm text-white">Taylor’s University (泰莱大学)</div>
                <div className="text-xs text-[#00f2fe] mt-0.5">MSc in Applied Computing (AI 方向)</div>
                <div className="text-xs text-gray-500 mt-0.5">2025.9 – 2026.8</div>
              </div>
              <div>
                <div className="font-bold text-sm text-white">Taiyuan University of Technology (太原理工大学)</div>
                <div className="text-xs text-gray-400 mt-0.5 font-sans">B.Eng in Mechanical Engineering (机械工程学士)</div>
                <div className="text-xs text-gray-500 mt-0.5">2010.9 – 2014.9</div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-900/40 border border-slate-900 rounded-2xl p-6 relative">
      <div className="absolute top-[-1px] left-[-1px] w-2.5 h-2.5 border-t-2 border-l-2 border-[#00f2fe]"></div>
      <h2 className="text-sm font-bold text-white mb-5 flex items-center border-b border-slate-900 pb-2 tracking-wider font-mono">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Experience({ company, period, title, bullets }: { company: string; period: string; title: string; bullets: string[] }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex justify-between font-bold text-white text-sm md:text-base">
        <span>{company}</span>
        <span className="text-[#00f2fe] text-xs font-mono">{period}</span>
      </div>
      <div className="text-gray-400 text-xs mt-1 font-mono">{title}</div>
      <ul className="mt-3 space-y-2 text-gray-400 text-sm">
        {bullets.map((bullet) => (
          <li key={bullet} className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CertBadge({ title, desc, status, time }: { title: string; desc: string; status: 'Achieved' | 'Pending'; time?: string }) {
  const isAchieved = status === 'Achieved';
  return (
    <div className={`bg-[#00f2fe]/5 border border-slate-900 p-3 rounded-xl flex justify-between items-center ${isAchieved ? 'border-l-4 border-l-[#00f2fe]' : 'border-l-4 border-l-amber-500'}`}>
      <div>
        <div className="font-bold text-xs text-white font-mono">{title}</div>
        <div className="text-[10px] text-gray-500">{desc}</div>
      </div>
      <span className={`text-[10px] font-mono ${isAchieved ? 'text-[#00f2fe]' : 'text-amber-500'}`}>
        {isAchieved ? '● Achieved' : `⏳ ${time}`}
      </span>
    </div>
  );
}
