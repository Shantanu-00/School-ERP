import { Sidebar } from '@/components/layout/SidebarItem'
import { SidebarProvider, SidebarWrapper, MainContent } from '@/components/layout/SidebarLayout'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-gray-50 text-gray-900 overflow-hidden w-full">
        <SidebarWrapper>
          <Sidebar />
        </SidebarWrapper>
        <MainContent>
          {children}
        </MainContent>
      </div>
    </SidebarProvider>
  )
}