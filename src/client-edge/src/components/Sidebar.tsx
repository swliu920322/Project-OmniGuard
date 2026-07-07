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
  icon: React.ComponentType<{ className?: string; size?: number }>;
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
        { label: '拓扑仿真画布', href: '/iac/canvas', icon: Activity },
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
      className={`min-h-screen bg-slate-900/40 border-r border-slate-900 flex flex-col justify-between transition-all duration-300 ease-in-out relative z-30 select-none ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Upper Section */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Sidebar Header Brand */}
        <div className="p-4 border-b border-slate-900/60 flex items-center justify-between h-16 min-h-16">
          {!isCollapsed ? (
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Compass size={18} />
              </div>
              <div>
                <div className="text-xs font-black tracking-widest text-slate-100 uppercase">OMNIGUARD</div>
                <div className="text-[9px] font-mono text-cyan-500/80 uppercase">PORTFOLIO HUB</div>
              </div>
            </div>
          ) : (
            <div className="mx-auto p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Compass size={18} />
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <div className="p-3 space-y-6 flex-1">
          {navGroups.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              {/* Group Title */}
              {!isCollapsed ? (
                <div className="text-[10px] font-mono text-slate-500 tracking-wider uppercase mb-2 block px-2">
                  {group.title}
                </div>
              ) : (
                <div className="border-t border-slate-900/80 my-3 block mx-1" />
              )}

              {/* Group Items */}
              <div className="space-y-1">
                {group.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  // Handle active path matching
                  const isActive = pathname === item.href;
                  
                  return (
                    <Link
                      key={iIdx}
                      href={item.href}
                      title={isCollapsed ? item.label : undefined}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-mono transition-all group relative ${
                        isActive 
                          ? 'bg-[#00f2fe]/10 text-cyan-400 border-l-2 border-[#00f2fe] pl-2.5' 
                          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/30'
                      }`}
                    >
                      <Icon className={`shrink-0 ${isActive ? 'text-[#00f2fe]' : 'text-slate-500 group-hover:text-slate-300'}`} size={16} />
                      {!isCollapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                      
                      {/* Tooltip for Collapsed Sidebar */}
                      {isCollapsed && (
                        <div className="absolute left-16 bg-slate-900 border border-slate-800 text-slate-200 px-3 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity whitespace-nowrap z-50 text-[11px] font-mono shadow-2xl">
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
      <div className="p-3 border-t border-slate-900/60 flex items-center justify-between">
        {!isCollapsed && (
          <div className="text-[10px] font-mono text-slate-600 uppercase flex items-center gap-1 pl-2">
            <Terminal size={10} /> SYS_V2.6_OK
          </div>
        )}
        <button 
          onClick={toggleCollapse}
          className={`p-1.5 rounded-lg border border-slate-800 bg-slate-950/80 text-slate-500 hover:text-slate-200 hover:border-slate-700 transition-colors ${
            isCollapsed ? 'mx-auto' : ''
          }`}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
