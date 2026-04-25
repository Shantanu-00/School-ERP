'use client'

import { useState, useEffect } from 'react'
import { calculateFeeAction } from '@/actions/finance.actions'

export function NewStudentForm({
  activeYears,
  classes,
  addStudentAction
}: {
  activeYears: { id: string; name: string }[]
  classes: { id: string; grade_level: string; section: string }[]
  addStudentAction: (formData: FormData) => void
}) {
  const [sameAsCurrent, setSameAsCurrent] = useState(true)
  const [isExistingStudent, setIsExistingStudent] = useState(false)
  const [openingBalance, setOpeningBalance] = useState<number>(0)

  // Fee calculation state
  const [academicYearId, setAcademicYearId] = useState(activeYears?.[0]?.id || '')
  const [classId, setClassId] = useState('')
  const [gender, setGender] = useState('')
  const [discountType, setDiscountType] = useState('None')
  const [discountMode, setDiscountMode] = useState('Percentage')
  const [discountValue, setDiscountValue] = useState<string | number>('')

  const [feeData, setFeeData] = useState<{ baseFee?: number; finalFee?: number; error?: string } | null>(null)
  const [isLoadingFee, setIsLoadingFee] = useState(false)

  useEffect(() => {
    async function fetchFee() {
      if (!academicYearId || !classId) {
        setFeeData(null)
        return
      }

      setIsLoadingFee(true)
      try {
        const res = await calculateFeeAction({
          academic_year_id: academicYearId,
          class_id: classId,
          gender: gender || 'All',
          discount_mode: discountMode,
          discount_value: Number(discountValue) || 0
        })
        setFeeData(res)
      } catch (err) {
        console.error(err)
        setFeeData({ error: 'Failed to calculate fee.' })
      } finally {
        setIsLoadingFee(false)
      }
    }

    // Debounce the call slightly
    const timer = setTimeout(() => {
      fetchFee()
    }, 300)

    return () => clearTimeout(timer)
  }, [academicYearId, classId, gender, discountType, discountMode, discountValue])

  const isFeeCalculated = feeData && feeData.finalFee !== undefined && !feeData.error

  return (
    <form action={addStudentAction} className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden">
      {/* Admission Type Selection */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/30">
        <h2 className="text-lg font-semibold text-slate-800">Registration Type</h2>
        <div className="flex items-center space-x-6">
          <label className="flex items-center space-x-2">
            <input 
              type="radio" 
              name="registration_type" 
              value="new" 
              checked={!isExistingStudent} 
              onChange={() => setIsExistingStudent(false)}
              className="text-blue-600 focus:ring-blue-500" 
            />
            <span className="text-sm font-medium text-slate-700">Add New Student</span>
          </label>
          <label className="flex items-center space-x-2">
            <input 
              type="radio" 
              name="registration_type" 
              value="existing" 
              checked={isExistingStudent} 
              onChange={() => setIsExistingStudent(true)}
              className="text-blue-600 focus:ring-blue-500" 
            />
            <span className="text-sm font-medium text-slate-700">Add Existing Student</span>
          </label>
        </div>

        {isExistingStudent && (
          <div className="mt-4 max-w-sm">
            <label className="block text-sm font-medium text-slate-700 mb-1">Opening Balance (Arrears) *</label>
            <input
              type="number"
              name="opening_balance"
              value={openingBalance === 0 ? '' : openingBalance}
              onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
              onWheel={e => e.currentTarget.blur()}
              step="0.01"
              min="0"
              placeholder="0.00"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <p className="text-xs text-slate-500 mt-1">Previous year pending dues</p>
          </div>
        )}
      </div>

      {/* Section 1: Permanent Record */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/30">
        <h2 className="text-lg font-semibold text-slate-800">1. Permanent Details</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">First Name *</label>
            <input type="text" name="first_name" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Rahul" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Last Name *</label>
            <input type="text" name="last_name" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Sharma" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Admission Number *</label>
            <input type="text" name="admission_number" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. ADM-2026-001" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth *</label>
            <input type="date" name="dob" required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" />
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
            <select name="gender" value={gender} onChange={e => setGender(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm">
              <option value="" disabled>Select Gender...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Transgender">Transgender</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
            <select name="blood_group" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" defaultValue="">
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
            <input type="text" name="mother_tongue" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Hindi, English" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Social Category</label>
            <select name="social_category" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" defaultValue="General">
              <option value="General">General</option>
              <option value="SC">SC</option>
              <option value="ST">ST</option>
              <option value="OBC">OBC</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Minority Status</label>
            <select name="minority_status" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" defaultValue="None">
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
            <input type="text" name="aadhaar_number" maxLength={12} pattern="\d{12}" title="Aadhaar must be 12 digits" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="12 digit number" />
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

      {/* Section: Address Details */}
      <div className="p-6 sm:p-8 space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 mb-4">3. Contact & Address</h2>
          
          <h3 className="text-sm font-medium text-slate-600 mb-3 border-b pb-2">Current Address</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1</label>
              <input type="text" name="current_address_line1" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Flat / House No. / Building / Street" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
              <input type="text" name="current_address_landmark" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Near XYZ Temple" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City / District</label>
              <input type="text" name="current_city_district" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Select City" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input type="text" name="current_state" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Maharashtra" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
              <input type="text" name="current_pincode" maxLength={6} pattern="\d{6}" title="Pincode must be exactly 6 digits" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="6 Digits" />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3 border-b pb-2">
            <h3 className="text-sm font-medium text-slate-600">Permanent Address</h3>
            <label className="flex items-center text-sm text-slate-600 font-medium cursor-pointer">
              <input 
                type="checkbox" 
                name="is_permanent_same_as_current"
                checked={sameAsCurrent} 
                onChange={(e) => setSameAsCurrent(e.target.checked)}
                className="mr-2 rounded text-blue-600 focus:ring-blue-500" 
              />
              Same as Current Address
            </label>
          </div>
          
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300 ease-in-out origin-top ${sameAsCurrent ? 'hidden opacity-0 h-0 overflow-hidden' : 'opacity-100 h-auto'}`}>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address Line 1</label>
              <input type="text" name="permanent_address_line1" disabled={sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Flat / House No. / Building / Street" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Landmark</label>
              <input type="text" name="permanent_address_landmark" disabled={sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Near XYZ Temple" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">City / District</label>
              <input type="text" name="permanent_city_district" disabled={sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Select City" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
              <input type="text" name="permanent_state" disabled={sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="e.g. Maharashtra" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>
              <input type="text" name="permanent_pincode" maxLength={6} pattern="\d{6}" title="Pincode must be exactly 6 digits" disabled={sameAsCurrent} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="6 Digits" />
            </div>
          </div>
        </div>
      </div>

      {/* Section: Admission History */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800">4. Admission History</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Date of Admission</label>
            <input type="date" name="date_of_admission" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Previous School</label>
            <input type="text" name="previous_school_attended" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Name of previous school" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">TC Number</label>
            <input type="text" name="tc_number" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm" placeholder="Transfer Certificate No" />
          </div>
        </div>
      </div>

      {/* Section: Enrollment */}
      <div className="p-6 sm:p-8 space-y-6">
        <h2 className="text-lg font-semibold text-slate-800">5. Academic Enrollment</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Academic Year *</label>
            <select
              name="academic_year_id"
              required
              value={academicYearId}
              onChange={e => setAcademicYearId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm"
            >
              {activeYears?.map((year) => (
                <option key={year.id} value={year.id}>{year.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Class *</label>
            <select
              name="class_id"
              required
              value={classId}
              onChange={e => setClassId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm"
            >
              <option value="">Select a Class...</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.grade_level} - {c.section}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number *</label>
            <input
              type="number"
              name="roll_number"
              required
              min="1"
              onWheel={e => e.currentTarget.blur()}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="e.g. 1"
            />
          </div>
        </div>
      </div>

      {/* Section: Financial configuration */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/50">
        <h2 className="text-lg font-semibold text-slate-800">6. Fee Discount Configuration</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Type</label>
            <select
              name="discount_type"
              value={discountType}
              onChange={(e) => {
                setDiscountType(e.target.value)
                if(e.target.value === 'None') setDiscountValue('')
              }}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm transition-colors"
            >
              <option value="None">None</option>
              <option value="RTE">RTE (Right to Education)</option>
              <option value="Staff Child">Staff Child</option>
              <option value="Sibling">Sibling Discount</option>                <option value="Management Discount">Management Discount</option>              <option value="Other">Other</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Mode</label>
            <select
              name="discount_mode"
              value={discountMode}
              disabled={discountType === 'None'}
              onChange={e => setDiscountMode(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            >
              <option value="Percentage">Percentage (%)</option>
              <option value="Fixed">Fixed Amount</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Value</label>
            <input
              type="number"
              name="discount_value"
              step="0.01"
              min="0"
              max={discountMode === 'Percentage' ? 100 : undefined}
              value={discountValue}
              onChange={e => setDiscountValue(e.target.value)}
              onWheel={e => e.currentTarget.blur()}
              disabled={discountType === 'None'}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm transition-colors disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed placeholder:disabled:text-slate-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="Value depending on mode"
            />
          </div>
        </div>
      </div>

      {/* Section: Pocket Money Configuration */}
      <div className="p-6 sm:p-8 space-y-6 bg-slate-50/30">
        <h2 className="text-lg font-semibold text-slate-800">7. Pocket Money Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Initial Pocket Money Amount</label>
            <input
              type="number"
              name="pocket_money_initial_amount"
              step="0.01"
              min="0"
              defaultValue=""
              onWheel={e => e.currentTarget.blur()}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="e.g. 0.00"
            />
          </div>
        </div>
      </div>
      
      {classId && (
        <div className="bg-slate-50 border-t border-slate-200">
          <div className="p-6 sm:p-8 max-w-4xl mx-auto">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">Fee Breakdown</h2>
            {isLoadingFee ? (
              <div className="text-sm font-medium text-blue-600 animate-pulse bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-center">Calculating optimized fees...</div>
            ) : feeData?.error ? (
              <div className="text-sm font-medium text-red-600 bg-red-50 p-4 rounded-xl border border-red-200 text-center">
                {feeData.error}
              </div>
            ) : feeData ? (
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6 transition-all duration-300 hover:shadow-md">
                 <div className="text-center sm:text-left">
                   <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Base Fee</p>
                   <p className="text-2xl font-bold text-slate-800">&#8377;{feeData.baseFee?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                 </div>
                 
                 <div className="hidden sm:flex text-slate-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                 </div>
                 
                 <div className="text-center sm:text-left">
                   <p className="text-xs font-semibold uppercase tracking-wider text-emerald-500 mb-1">Total Discount</p>
                   <p className="text-2xl font-bold text-emerald-600">
                     {discountType === 'None' ? 'None' : discountMode === 'Percentage' ? `${discountValue || 0}%` : `₹${Number(discountValue || 0).toLocaleString('en-IN', {minimumFractionDigits: 2})}`}
                   </p>
                 </div>
                 
                 <div className="hidden sm:flex text-slate-300">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                 </div>
                 
                 <div className="bg-linear-to-br from-blue-600 to-indigo-700 text-white px-8 py-4 rounded-xl text-center min-w-55 shadow-lg shadow-blue-600/30">
                   <p className="text-[10px] uppercase tracking-widest font-bold text-blue-100 mb-1 opacity-90">Final Due</p>
                   <p className="text-3xl font-extrabold">&#8377;{feeData.finalFee?.toLocaleString('en-IN', {minimumFractionDigits: 2})}</p>
                 </div>
               </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="p-6 sm:p-8 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-4 rounded-b-xl border-t border-slate-200">
        <button
          type="submit"
          name="action_type"
          value="enroll_only"
          className="w-full sm:w-auto bg-white text-slate-700 border border-slate-300 font-semibold px-8 py-3 rounded-xl hover:bg-slate-50 hover:border-slate-400 focus:ring-4 focus:ring-slate-100 transition-all shadow-sm"
        >
          Save Profile & Enroll
        </button>
        <div className="relative w-full sm:w-auto group">
          <button
            type="submit"
            name="action_type"
            value="enroll_and_invoice"
            disabled={!isFeeCalculated}
            className="w-full sm:w-auto bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed"
          >
            Generate Invoice & Enroll
          </button>
          {!isFeeCalculated && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-slate-800 text-slate-100 text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-10 pointer-events-none">
              Requires valid fee selection
            </div>
          )}
        </div>
      </div>
    </form>
  )
}
