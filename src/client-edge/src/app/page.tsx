'use client';

import React from 'react';
import { useI18n } from '@/components/I18nProvider';
import { Terminal, MapPin, Mail, Phone, Linkedin } from 'lucide-react';

export default function RootResumePage() {
  const { t } = useI18n();

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
              {t('resume.role')}
            </div>
          </div>
          <div className="flex flex-wrap md:flex-col items-start md:items-end gap-3 text-xs text-gray-300 font-mono">
            <span className="flex items-center gap-1.5"><MapPin size={13} /> {t('resume.location')}</span>
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
            <Section title={t('resume.summary_title')}>
              <p className="text-gray-300 text-sm leading-relaxed">
                {t('resume.summary_content')}
              </p>
            </Section>

            <Section title={t('resume.project_title')}>
              <div className="mb-6">
                <div className="flex justify-between font-bold text-white text-sm md:text-base">
                  <span>{t('resume.exp.omniguard.company')}</span>
                  <span className="text-[#00f2fe] text-xs font-mono">{t('resume.period_current')}</span>
                </div>
                <div className="text-[#00f2fe] text-xs font-mono mt-1">{t('resume.exp.omniguard.title')}</div>
                <ul className="mt-3 space-y-2 text-gray-300 text-sm leading-relaxed font-mono">
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    {t('resume.exp.omniguard.bullet1')}
                  </li>
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    {t('resume.exp.omniguard.bullet2')}
                  </li>
                  <li className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
                    {t('resume.exp.omniguard.bullet3')}
                  </li>
                </ul>
              </div>
            </Section>

            <Section title={t('resume.experience_title')}>
              <Experience
                company={t('resume.exp.accenture.company')}
                period="2021 – 2023"
                title={t('resume.exp.accenture.title')}
                bullets={[
                  t('resume.exp.accenture.bullet1'),
                  t('resume.exp.accenture.bullet2'),
                  t('resume.exp.accenture.bullet3'),
                ]}
              />
              <Experience
                company={t('resume.exp.scania.company')}
                period="2023.7 - 2024.1"
                title={t('resume.exp.scania.title')}
                bullets={[
                  t('resume.exp.scania.bullet1'),
                  t('resume.exp.scania.bullet2'),
                ]}
              />
              <Experience
                company={t('resume.exp.aosheng.company')}
                period="2020.5 – 2021.9"
                title={t('resume.exp.aosheng.title')}
                bullets={[
                  t('resume.exp.aosheng.bullet1'),
                  t('resume.exp.aosheng.bullet2'),
                ]}
              />
            </Section>
          </div>

          <div className="space-y-8">
            <Section title={t('resume.certs_title')}>
              <div className="flex flex-col gap-3">
                <CertBadge title="AZ-305" desc="Azure Solutions Architect Expert" status={t('resume.status_achieved')} />
                <CertBadge title="AZ-104" desc="Azure Administrator Associate" status={t('resume.status_achieved')} />
                <CertBadge title="AI-102" desc="Azure AI Engineer Associate" status={t('resume.status_achieved')} />
                <CertBadge title="SC-300" desc="Microsoft Identity and Access Administrator Associate" status={t('resume.status_achieved')} />
                <CertBadge title="AB-100" desc="Agentic AI Business Architect" status={t('resume.status_achieved')} />
              </div>
            </Section>

            <Section title={t('resume.education_title')}>
              <div className="mb-4">
                <div className="font-bold text-sm text-white">Taylor’s University</div>
                <div className="text-xs text-[#00f2fe] mt-0.5">{t('resume.deg_taylors')}</div>
                <div className="text-xs text-gray-500 mt-0.5">2025.9 – 2026.8</div>
              </div>
              <div>
                <div className="font-bold text-sm text-white">Taiyuan University of Technology</div>
                <div className="text-xs text-gray-300 mt-0.5">{t('resume.deg_tyut')}</div>
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
      <div className="text-gray-300 text-xs mt-1 font-mono">{title}</div>
      <ul className="mt-3 space-y-2 text-gray-300 text-sm">
        {bullets.map((bullet) => (
          <li key={bullet} className="relative pl-5 before:content-['↪'] before:absolute before:left-0 before:text-[#00f2fe]">
            {bullet}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CertBadge({ title, desc, status }: { title: string; desc: string; status: string }) {
  return (
    <div className="bg-[#00f2fe]/5 border border-slate-900 p-3.5 rounded-xl flex flex-col gap-1.5 border-l-4 border-l-[#00f2fe] shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-xs text-white font-mono">{title}</span>
        <span className="text-[9px] font-mono text-[#00f2fe] bg-[#00f2fe]/10 px-1.5 py-0.5 rounded shrink-0">
          {status}
        </span>
      </div>
      <div className="text-[10px] text-gray-500 leading-snug">{desc}</div>
    </div>
  );
}
