'use client';

import Link from 'next/link';
import { Layers, Terminal, MapPin, Mail, Phone, Linkedin } from 'lucide-react';

export default function ResumePage() {
  return (
    <div className="relative min-h-screen text-gray-100 font-sans">
      <div
        className="fixed inset-0 pointer-events-none z-[-1] opacity-15"
        style={{
          backgroundImage: 'linear-gradient(#1f2937 1px, transparent 1px), linear-gradient(90deg, #1f2937 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }}
      />

      <div className="max-w-[1100px] mx-auto px-5 py-10">
        <header className="border-b-2 border-[#00f2fe] pb-6 mb-10 relative">
          <div className="absolute right-0 top-0 flex items-center gap-2">
            <Link href="/" className="text-sm bg-slate-900 hover:bg-slate-800 text-[#00f2fe] px-3 py-1.5 rounded border border-[#00f2fe]/30 transition-all">
              返回启动台
            </Link>
            <Link href="/iac" className="flex items-center gap-1 text-sm bg-blue-900/30 hover:bg-blue-800/50 text-[#00f2fe] px-3 py-1.5 rounded border border-[#00f2fe]/30 transition-all">
              <Layers size={16} />
              <span>进入 IaC Hub</span>
            </Link>
          </div>
          <div className="text-cyan-400 font-mono text-xs tracking-widest uppercase mb-1 flex items-center gap-1">
            <Terminal size={12} /> RESUME_VIEW_ACTIVE
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_0_10px_rgba(0,242,254,0.3)]">
            LIU SHENGWEI
          </h1>
          <div className="text-[#00f2fe] text-lg mt-1 uppercase tracking-widest font-semibold">
            Solutions Architect (AI & Cloud Transformation)
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-400 font-mono">
            <span className="flex items-center gap-1"><MapPin size={14} /> Singapore</span>
            <span className="flex items-center gap-1"><Mail size={14} /> lsw19920322@gmail.com</span>
            <span className="flex items-center gap-1"><Phone size={14} /> +6011-1121-6759</span>
            <a href="https://linkedin.com/in/shengwei-liu" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-[#00f2fe] transition-colors">
              <Linkedin size={14} /> linkedin.com/in/shengwei-liu
            </a>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <Section title="PROFESSIONAL SUMMARY">
              <p className="text-gray-400 text-sm leading-relaxed">
                10+ years of engineering excellence, bridging robust software systems with AI-native solutions.
                Expert in transitioning complex front-end modularity into high-level Azure Cloud Architectures and
                Agentic Workflows. Proven track record in Fortune 500 environments delivering standardized SOPs and
                measurable ROI.
              </p>
            </Section>

            <Section title="SIGNATURE PROJECT">
              <div className="mb-6">
                <div className="flex justify-between font-bold text-white text-base">
                  <span>Azure-Based Multi-Agent Orchestration Platform</span>
                  <span className="text-[#00f2fe] text-sm">2025 - Present</span>
                </div>
                <div className="text-[#00f2fe] text-sm mt-1">Lead Architect</div>
                <ul className="mt-3 space-y-2 text-gray-400 text-sm">
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    <strong className="text-gray-200">Architectural Vision:</strong> Designed a serverless agentic workflow using Azure Functions and Semantic Kernel to replace rigid, hard-coded legacy business logic.
                  </li>
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    <strong className="text-gray-200">Key Innovation:</strong> Implemented a vendor-agnostic abstraction layer for seamless LLM switching while maintaining compliance within Azure VNet.
                  </li>
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    <strong className="text-gray-200">Impact:</strong> Reduced manual audit costs and delivered a scalable MVP for automated complex business processes.
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
                  'Led the 0-to-1 foundational architecture for FinTech platforms with modular isolation.',
                  'Devised isomorphic multi-project builds and optimized asset bundling strategies.',
                  'Developed a generic runtime intelligent state machine for centralized dialog controls.',
                ]}
              />
              <Experience
                company="Scania Group"
                period="2023.7 - 2024.1"
                title="Software Engineer"
                bullets={[
                  'Collaborated with cross-functional European and Asian teams to evaluate low-code MES platforms.',
                  'Addressed front-end scalability and system integration challenges under industrial compliance standards.',
                ]}
              />
              <Experience
                company="Aosheng Information Technology"
                period="2020.5 – 2021.9"
                title="Lead Systems Architect (Migration)"
                bullets={[
                  'Orchestrated a shift from manual coding to a modular assembly model.',
                  'Spearheaded frontend architecture refactoring for legacy corporate banking platforms.',
                ]}
              />
            </Section>
          </div>

          <div className="space-y-8">
            <Section title="CERTIFICATIONS">
              <div className="flex flex-col gap-3">
                <CertBadge title="AZ-305" desc="Azure Solutions Architect Expert" status="Achieved" />
                <CertBadge title="AZ-104" desc="Azure Administrator Associate" status="Achieved" />
                <CertBadge title="AI-102" desc="Azure AI Engineer Associate" status="Achieved" />
                <CertBadge title="AB-100" desc="Agentic AI Business Architect" status="Pending" time="June 2026" />
              </div>
            </Section>

            <Section title="EDUCATION">
              <div className="mb-4">
                <div className="font-bold text-sm text-white">Taylor’s University</div>
                <div className="text-xs text-[#00f2fe] mt-0.5">MSc in Applied Computing (AI)</div>
                <div className="text-xs text-gray-500 mt-0.5">2025.9 – 2026.8</div>
              </div>
              <div>
                <div className="font-bold text-sm text-white">Taiyuan University of Technology</div>
                <div className="text-xs text-gray-400 mt-0.5">B.Eng in Mechanical Engineering</div>
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
    <section className="bg-gray-900 border border-gray-800 rounded p-6 relative">
      <div className="absolute top-[-1px] left-[-1px] w-2.5 h-2.5 border-t-2 border-l-2 border-[#00f2fe]"></div>
      <h2 className="text-lg text-white mb-5 flex items-center border-b border-gray-800 pb-2 font-bold uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Experience({ company, period, title, bullets }: { company: string; period: string; title: string; bullets: string[] }) {
  return (
    <div className="mb-6 last:mb-0">
      <div className="flex justify-between font-bold text-white text-base">
        <span>{company}</span>
        <span className="text-[#00f2fe] text-sm">{period}</span>
      </div>
      <div className="text-gray-400 text-sm mt-1">{title}</div>
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
    <div className={`bg-[#00f2fe]/5 border border-gray-800 p-3 rounded flex justify-between items-center ${isAchieved ? 'border-l-4 border-l-[#00f2fe]' : 'border-l-4 border-l-amber-500'}`}>
      <div>
        <div className="font-bold text-sm text-white">{title}</div>
        <div className="text-[0.7rem] text-gray-400">{desc}</div>
      </div>
      <span className={`text-[0.7rem] ${isAchieved ? 'text-[#00f2fe]' : 'text-amber-500'}`}>
        {isAchieved ? '● Achieved' : `⏳ ${time}`}
      </span>
    </div>
  );
}

