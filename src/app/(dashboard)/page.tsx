import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { logout } from '@/actions/auth.actions'
import { LogOut, Users, FileText, Wallet, BookOpen } from 'lucide-react'

export default async function DashboardHome() {
  const supabase = await createClient()

  // 1. Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect('/login')
  }

  // 2. Fetch their role from the staff table
  const { data: staffData, error } = await supabase
    .from('staff')
    .select('name, role')
    .eq('auth_id', user.id)
    .single()

  if (error || !staffData) {
    return <div>Error loading user profile. Please contact IT.</div>
  }

  const { name, role } = staffData

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Header Area */}
      <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Welcome, {name}</h1>
          <p className="text-gray-500 font-medium mt-1">Logged in as: <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">{role}</span></p>
        </div>
        <form action={logout}>
          <button className="flex items-center gap-2 text-gray-600 hover:text-red-600 transition font-medium">
            <LogOut size={18} /> Logout
          </button>
        </form>
      </div>

      {/* Role-Based Rendering */}
      {role === 'Admin' && <AdminView />}
      {role === 'Accountant' && <AccountantView />}
      {role === 'Teacher' && <TeacherView />}
    </div>
  )
}

// --- SUB-COMPONENTS FOR DIFFERENT ROLES ---

function AdminView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <DashboardCard title="Total Students" value="1,248" icon={<Users size={24} className="text-blue-600" />} />
      <DashboardCard title="Active Staff" value="84" icon={<BookOpen size={24} className="text-purple-600" />} />
      <DashboardCard title="System Settings" value="Config" icon={<FileText size={24} className="text-gray-600" />} />
    </div>
  )
}

function AccountantView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <DashboardCard title="Outstanding Fees" value="₹4,50,000" icon={<Wallet size={24} className="text-red-600" />} />
      <DashboardCard title="Collected Today" value="₹25,000" icon={<Wallet size={24} className="text-green-600" />} />
      <DashboardCard title="Pending Invoices" value="42" icon={<FileText size={24} className="text-orange-600" />} />
    </div>
  )
}

function TeacherView() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <DashboardCard title="My Classes" value="Grade 10A, 9B" icon={<BookOpen size={24} className="text-blue-600" />} />
      <DashboardCard title="My Next Payroll" value="Pending" icon={<Wallet size={24} className="text-emerald-600" />} />
    </div>
  )
}

// Reusable UI Component for the dashboard cards
function DashboardCard({ title, value, icon }: { title: string, value: string, icon: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 hover:shadow-md transition">
      <div className="p-4 bg-gray-50 rounded-lg">
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500 font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  )
}