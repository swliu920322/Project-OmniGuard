'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  User, 
  Layers, 
  Settings, 
  Activity, 
  Truck, 
  TrendingUp, 
  ChevronLeft, 
  ChevronRight,
  Terminal,
  Compass
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number | string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Read collapsed state from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem('sidebar_collapsed');
    if (saved) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem('sidebar_collapsed', String(nextState));
  };

  if (!mounted) return null;

  const navGroups: NavGroup[] = [
    {
      title: '个人主页',
      items: [
        { label: '个人求职履历', href: '/', icon: User },
      ]
    },
    {
      title: '云原生 IaC 军火库',
      items: [
        { label: 'IaC 架构看板', href: '/iac', icon: Layers },
        { label: '可视化配置台', href: '/iac/configurator', icon: Settings },
      ]
    },
    {
      title: '边缘仿真与计算',
      items: [
        { label: '车队动力学仿真', href: '/dashboard', icon: Truck },
      ]
    },
    {
      title: 'AI 智能体投研',
      items: [
        { label: '大 V 投研分析仪', href: '/prediction', icon: TrendingUp },
      ]
    }
  ];

  return (
    <aside 
      className={`min-h-screen bg-[#0b0f19] border-r border-slate-900/80 flex flex-col justify-between transition-all duration-300 ease-in-out relative z-30 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Upper Section */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Sidebar Header Brand */}
        <div className="p-4 border-b border-slate-900/60 flex items-center justify-between h-16 min-h-16">
          {!isCollapsed ? (
            <Link href="/" className="flex items-center gap-2 group hover:opacity-85 transition-opacity">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 group-hover:border-cyan-500/40 group-hover:text-cyan-300 transition-colors">
                <Compass size={18} />
              </div>
              <div>
                <div className="text-xs font-black tracking-widest text-slate-100 uppercase group-hover:text-[#00f2fe] transition-colors">OMNIGUARD</div>
                <div className="text-[9px] font-mono text-cyan-500/80 uppercase">PORTFOLIO HUB</div>
              </div>
            </Link>
          ) : (
            <Link href="/" className="mx-auto p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors">
              <Compass size={18} />
            </Link>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="p-3 space-y-6 flex-1">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              {/* Group Title */}
              {!isCollapsed ? (
                <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase mb-2 block px-2 font-semibold">
                  {group.title}
                </div>
              ) : (
                <div className="border-t border-slate-900/50 my-4 block mx-1" />
              )}

              {/* Group Items */}
              <div className="space-y-1.5">
                {group.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  // Handle active path matching (normalizing trailing slashes from next.config.mjs trailingSlash: true)
                  const normalizePath = (p: string) => p.replace(/\/$/, '') || '/';
                  const isActive = normalizePath(pathname) === normalizePath(item.href);
                  
                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-mono font-medium transition-all group relative ${
                        isActive 
                          ? 'bg-[#00f2fe]/10 text-cyan-300 border-l-2 border-[#00f2fe] pl-2.5 shadow-[inset_0_0_15px_rgba(0,242,254,0.05)]' 
                          : 'text-slate-300 hover:text-white hover:bg-slate-900/40'
                      }`}
                    >
                      <Icon className={`shrink-0 ${isActive ? 'text-[#00f2fe]' : 'text-slate-300 group-hover:text-slate-200'}`} size={16} />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      
                      {/* Tooltip for Collapsed Sidebar */}
                      {isCollapsed && (
                        <div className="absolute left-20 bg-slate-950 border border-slate-800 text-slate-100 px-3 py-2 rounded-xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 whitespace-nowrap z-50 text-xs font-mono shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
                          {item.label}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer / Collapse Trigger */}
      <div className="p-4 border-t border-slate-900/60 flex items-center justify-between h-16 min-h-16 bg-slate-950/20">
        {!isCollapsed ? (
          <div className="text-xs font-mono text-slate-300 uppercase flex items-center gap-1.5 pl-1 font-semibold tracking-wider">
            <Terminal size={12} className="text-cyan-500" /> SYS_V2.6_OK
          </div>
        ) : null}
        <button 
          onClick={toggleCollapse}
          className={`p-2 rounded-xl border border-slate-800 bg-slate-950/80 text-slate-300 hover:text-[#00f2fe] hover:border-cyan-500/30 transition-all shadow ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? "展开导航" : "折叠导航"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>
    </aside>
  );
}
