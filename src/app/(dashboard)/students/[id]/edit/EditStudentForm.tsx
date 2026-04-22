'use client'

import { useState } from 'react'
import { GraduationCap, Loader2, BadgeAlert, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function EditStudentForm({
  activeYears,
  classes,
  student,
  activeEnrollment,
  updateStudentAction
}: {
  activeYears: { id: string; name: string }[]
  classes: { id: string; grade_level: string; section: string }[]
  student: any
  activeEnrollment: any
  updateStudentAction: (formData: FormData) => void
}) {
  const [sameAsCurrent, setSameAsCurrent] = useState(student?.is_permanent_same_as_current || true)

  return (
    <form action={updateStudentAction} className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      <input type="hidden" name="student_id" value={student.id} />

      {/* Section 1: Permanent Record */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/30">
        <h2 className="text-lg font-semibold text-slate-800">1. Permanent Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
            <input type="text" name="first_name" defaultValue={student.first_name} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Rahul" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
            <input type="text" name="last_name" defaultValue={student.last_name} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Sharma" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admission Number *</label>
            <input type="text" name="admission_number" defaultValue={student.admission_number} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. ADM-2026-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth *</label>
            <input type="date" name="dob" defaultValue={student.dob} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial Status</label>
            <select name="status" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm bg-slate-50" defaultValue="Active">
              <option value="Active">Active</option>
              <option value="Alumni">Alumni</option>
              <option value="Dropout">Dropout</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
            <select name="gender" defaultValue={student.gender || ""} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm">
              <option value="" disabled>Select Gender...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Transgender">Transgender</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
            <select name="blood_group" defaultValue={student.blood_group} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm">
              <option value="">Unknown</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mother Tongue</label>
            <input type="text" name="mother_tongue" defaultValue={student.mother_tongue} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Hindi, English" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Social Category</label>
            <select name="social_category" defaultValue={student.social_category || "General"} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm">
              <option value="General">General</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="OBC">OBC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Minority Status</label>
            <select name="minority_status" defaultValue={student.minority_status || "None"} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm">
              <option value="None">None</option>
              <option value="Muslim">Muslim</option>
              <option value="Christian">Christian</option>
              <option value="Sikh">Sikh</option>
              <option value="Buddhist">Buddhist</option>
              <option value="Jain">Jain</option>
              <option value="Parsi">Parsi</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Aadhaar Number</label>
            <input type="text" name="aadhaar_number" defaultValue={student.aadhaar_number} maxLength={12} pattern="\d{12}" title="Aadhaar must be 12 digits" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="12 digit number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name on Aadhaar</label>
            <input type="text" name="name_on_aadhaar" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Name as per Aadhaar" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">APAAR ID</label>
            <input type="text" name="apaar_id" maxLength={12} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="12 digit APAAR ID" />
          </div>
        </div>
      </div>

      {/* Section: Parent / Guardian Details */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-800">2. Parent & Guardian Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Mother&apos;s Full Name</label>
            <input type="text" name="mother_full_name" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Mother's name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Father&apos;s Full Name</label>
            <input type="text" name="father_full_name" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Father's name" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Guardian Name & Relation</label>
            <input type="text" name="guardian_name_and_relation" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Uncle / Raj" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Parent Aadhaar Number</label>
            <input type="text" name="parent_aadhaar_number" maxLength={12} pattern="\d{12}" title="Aadhaar must be 12 digits" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="12 digit number" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Primary Contact (Phone)</label>
            <input type="tel" name="primary_contact_number" pattern="\+?[0-9\s\-\(\)]+" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="+91 9999999999" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Contact</label>
            <input type="tel" name="secondary_contact_number" pattern="\+?[0-9\s\-\(\)]+" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="+91 8888888888" />
          </div>
        </div>
      </div>

      {/* Section: Contact & Address */}
      <div className="p-6 sm:p-8 space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">3. Contact & Address</h2>

        
        {/* Toggle State */}
        <input type="hidden" name="is_permanent_same_as_current" value={sameAsCurrent.toString()} />
        
        {/* Current Address */}
        <div className="space-y-4">
           <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-widest">Current/Temporary Address</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                 <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1 *</label>
                 <input type="text" name="current_address_line1" defaultValue={student.current_address_line1} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="House/Flat No., Street, Area" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
                 <input type="text" name="current_address_landmark" defaultValue={student.current_address_landmark} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Near..." />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">City/District *</label>
                 <input type="text" name="current_city_district" defaultValue={student.current_city_district} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Jaipur" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
                 <input type="text" name="current_state" defaultValue={student.current_state} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Rajasthan" />
              </div>
              <div>
                 <label className="block text-sm font-medium text-slate-700 mb-1">Pincode *</label>
                 <input type="text" name="current_pincode" defaultValue={student.current_pincode} required pattern="\d{6}" title="6 digit pincode" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. 302001" />
              </div>
           </div>
        </div>

        {/* Toggle */}
        <div className="pt-4 border-t border-slate-100">
           <label className="flex items-center gap-3 cursor-pointer">
              <input 
                 type="checkbox" 
                 checked={sameAsCurrent}
                 onChange={(e) => setSameAsCurrent(e.target.checked)}
                 className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
              />
              <span className="text-sm font-medium text-slate-700">Permanent Address is same as Current Address</span>
           </label>
        </div>

        {/* Permanent Address */}
        {!sameAsCurrent && (
           <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-top-4 duration-300">
              <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-widest">Permanent/Home Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1 *</label>
                    <input type="text" name="permanent_address_line1" defaultValue={student.permanent_address_line1} required={!sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="House/Flat No., Street, Area" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
                    <input type="text" name="permanent_address_landmark" defaultValue={student.permanent_address_landmark} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Near..." />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City/District *</label>
                    <input type="text" name="permanent_city_district" defaultValue={student.permanent_city_district} required={!sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Jaipur" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">State *</label>
                    <input type="text" name="permanent_state" defaultValue={student.permanent_state} required={!sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Rajasthan" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Pincode *</label>
                    <input type="text" name="permanent_pincode" defaultValue={student.permanent_pincode} required={!sameAsCurrent} pattern="\d{6}" title="6 digit pincode" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. 302001" />
                 </div>
              </div>
           </div>
        )}
      </div>

      {/* Section 4: Current Enrollment */}
      {activeEnrollment && (
        <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-800">4. Current Enrollment</h2>
            {activeEnrollment.fee_invoices && activeEnrollment.fee_invoices.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full font-medium border border-amber-200">
                <BadgeAlert className="w-4 h-4" />
                <span>Invoice Generated - Discounts Locked</span>
              </div>
            )}
          </div>
          
          <input type="hidden" name="enrollment_id" value={activeEnrollment.id} />
          <input type="hidden" name="academic_year_id" value={activeEnrollment.academic_year_id} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Class *</label>
              <select name="class_id" defaultValue={activeEnrollment.class_id} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm bg-white">
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.grade_level} {cls.section}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number *</label>
              <input type="number" name="roll_number" defaultValue={activeEnrollment.roll_number} required min="1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm bg-white" placeholder="e.g. 1" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type</label>
              <select name="discount_type" defaultValue={activeEnrollment.discount_type || 'None'} disabled={activeEnrollment.fee_invoices && activeEnrollment.fee_invoices.length > 0} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm disabled:bg-slate-100 disabled:text-slate-500 bg-white">
                <option value="None">None</option>
                <option value="RTE">RTE (Right to Education)</option>
                <option value="Staff Child">Staff Child</option>
                <option value="Sibling">Sibling</option>
                <option value="Management Discount">Management Discount</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Mode</label>
              <select name="discount_mode" defaultValue={activeEnrollment.discount_mode || 'Percentage'} disabled={activeEnrollment.fee_invoices && activeEnrollment.fee_invoices.length > 0} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm disabled:bg-slate-100 disabled:text-slate-500 bg-white">
                <option value="Percentage">Percentage (%)</option>
                <option value="Fixed">Fixed Amount (₹)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Discount Value</label>
              <input type="number" name="discount_value" defaultValue={activeEnrollment.discount_value || 0} disabled={activeEnrollment.fee_invoices && activeEnrollment.fee_invoices.length > 0} min="0" step="0.01" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm disabled:bg-slate-100 disabled:text-slate-500 bg-white" placeholder="0" />
            </div>
          </div>
        </div>
      )}

      {/* Footer / Submit */}
      <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3 flex-wrap">
        <Link href={`/students/${student.id}`} className="px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
          Cancel
        </Link>
        <SubmitButton />
      </div>
    </form>
  )
}

function SubmitButton() {
  return (
    <button 
      type="submit" 
      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg shadow-sm shadow-blue-600/20 transition-all active:scale-[0.98] flex items-center gap-2"
    >
      <CheckCircle2 className="w-4 h-4" />
      Save Changes
    </button>
  )
}
