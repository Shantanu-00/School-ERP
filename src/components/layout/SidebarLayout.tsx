'use client'

import React, { createContext, useContext, useState } from 'react'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

// 1. Create a Context
const SidebarContext = createContext({
  collapsed: false,
  toggleCollapsed: () => {}
})

// 2. The Provider component wraps the entire layout
export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed: () => setCollapsed(prev => !prev) }}>
      <div className="flex min-h-screen bg-gray-50 text-gray-900">
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

// 3. The Sidebar wrapper manages the width and adds the toggle button
export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const { collapsed, toggleCollapsed } = useContext(SidebarContext)

  return (
    <>
      <aside 
        className={`fixed left-0 top-0 h-screen bg-white border-r z-40 transition-all duration-300 flex flex-col group ${
          collapsed ? 'w-16' : 'w-64'
        }`}
        data-state={collapsed ? 'collapsed' : 'expanded'}
      >
        <div className={`flex flex-col h-full overflow-hidden`}>
          {children}
        </div>
        
        {/* Toggle Button */}
        <button
          onClick={toggleCollapsed}
          className={`absolute top-4 -right-4 z-50 bg-white border border-slate-200 text-slate-600 rounded-full p-1.5 shadow-sm hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500`}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </aside>
      
      {/* Invisible spacer to push main content right */}
      <div className={`shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'}`} />
    </>
  )
}

// 4. Main content wrapper applies the dynamic margin
export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 p-8 min-w-0 transition-all duration-300">
      {children}
    </main>
  )
}