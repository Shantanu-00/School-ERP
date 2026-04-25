'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Edit2, X, Loader2 } from 'lucide-react'
import { updateStaffMember } from '@/actions/payroll.actions'
import { Toaster } from 'react-hot-toast'

type Teacher = {
  id: string
  first_name: string
  last_name: string
  base_salary: number
  status: string
  hire_date: string
  phone_number: string | null
  email: string | null
  designation: string | null
  pan_card_number: string | null
  aadhaar_number: string | null
  bank_account_name: string | null
  bank_account_number: string | null
  bank_ifsc_code: string | null
  bank_name: string | null
  profile_picture_url: string | null
}

function Field({
  label, name, type = 'text', required, defaultValue, placeholder,
}: {
  label: string; name: string; type?: string; required?: boolean
  defaultValue?: string | number | null; placeholder?: string
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}{required && ' *'}</label>
      <input
        name={name} type={type} required={required}
        defaultValue={defaultValue ?? ''}
        placeholder={placeholder}
        onWheel={type === 'number' ? e => e.currentTarget.blur() : undefined}
        className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  )
}

export function StaffEditModal({ teacher }: { teacher: Teacher }) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formRef.current) return
    setSaving(true)
    setErr('')
    const result = await updateStaffMember(teacher.id, new FormData(formRef.current))
    setSaving(false)
    if (result.error) { setErr(result.error); return }
    toast.success('Profile updated.')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Toaster position="top-right" />
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-700 transition"
      >
        <Edit2 size={14} /> Edit Profile
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b shrink-0">
              <h2 className="text-lg font-bold text-slate-800">Edit Staff Profile</h2>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-slate-100 transition">
                <X size={18} />
              </button>
            </div>

            <form ref={formRef} onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
              {err && <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">{err}</div>}

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Basic Info</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" name="first_name" required defaultValue={teacher.first_name} />
                  <Field label="Last Name" name="last_name" required defaultValue={teacher.last_name} />
                  <Field label="Designation" name="designation" defaultValue={teacher.designation} placeholder="e.g. PGT Math" />
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
                    <select name="status" defaultValue={teacher.status}
                      className="w-full border border-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                      <option value="Active">Active</option>
                      <option value="Resigned">Resigned</option>
                      <option value="Terminated">Terminated</option>
                    </select>
                  </div>
                  <Field label="Base Salary (₹)" name="base_salary" type="number" required defaultValue={teacher.base_salary} />
                  <Field label="Hire Date" name="hire_date" type="date" required defaultValue={teacher.hire_date} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Number" name="phone_number" defaultValue={teacher.phone_number} placeholder="9876543210" />
                  <Field label="Email" name="email" type="email" defaultValue={teacher.email} />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Government IDs</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="PAN Card Number" name="pan_card_number" defaultValue={teacher.pan_card_number} placeholder="ABCDE1234F" />
                  <Field label="Aadhaar Number" name="aadhaar_number" defaultValue={teacher.aadhaar_number} placeholder="12 digits" />
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Banking Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Account Holder Name" name="bank_account_name" defaultValue={teacher.bank_account_name} />
                  <Field label="Account Number" name="bank_account_number" defaultValue={teacher.bank_account_number} />
                  <Field label="IFSC Code" name="bank_ifsc_code" defaultValue={teacher.bank_ifsc_code} placeholder="SBIN0001234" />
                  <Field label="Bank Name" name="bank_name" defaultValue={teacher.bank_name} placeholder="e.g. SBI" />
                </div>
              </div>

              <div className="flex gap-3 pt-2 pb-1">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 border border-slate-200 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-50 transition">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-70">
                  {saving ? <><Loader2 size={15} className="animate-spin" /> Saving</> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
