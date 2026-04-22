'use client'

import { useState } from 'react'

type DbYear = { id: string; name: string; start_date: string; end_date: string; is_active: boolean }
type ClassData = { id: string; grade_level: string; section: string }

// Historic years use a sentinel prefix so the action knows to auto-create the DB row
const HISTORIC_PREFIX = '__historic__'

export function AddFormerStudentForm({
  dbYears,
  historicYearNames,
  classes,
  addFormerStudentAction,
}: {
  dbYears: DbYear[]
  historicYearNames: string[]
  classes: ClassData[]
  addFormerStudentAction: (formData: FormData) => void
}) {
  const [status, setStatus] = useState<'Alumni' | 'Dropout'>('Alumni')
  const [pendingArrears, setPendingArrears] = useState<string>('')
  const [pocketMoneyAmount, setPocketMoneyAmount] = useState<string>('')
  const [pocketMoneyType, setPocketMoneyType] = useState<'CREDIT' | 'DEBIT'>('CREDIT')

  const hasPendingArrears = parseFloat(pendingArrears) > 0
  const hasPocketMoney = parseFloat(pocketMoneyAmount) > 0

  const inputCls =
    'w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm bg-white'
  const labelCls = 'block text-sm font-medium text-slate-700 mb-1'
  const sectionCls = 'p-6 sm:p-8 space-y-6'

  return (
    <form
      action={addFormerStudentAction}
      className="bg-white rounded-xl shadow-sm border border-slate-200 divide-y divide-slate-100 overflow-hidden"
    >
      {/* ── Section 1: Core Identity ─────────────────────────────── */}
      <div className={`${sectionCls} bg-slate-50/30`}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">1. Student Identity</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 font-medium">Final Status:</span>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setStatus('Alumni')}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
                  status === 'Alumni'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Alumni
              </button>
              <button
                type="button"
                onClick={() => setStatus('Dropout')}
                className={`px-4 py-1.5 text-sm font-semibold transition-colors border-l border-slate-300 ${
                  status === 'Dropout'
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Dropout
              </button>
            </div>
            <input type="hidden" name="status" value={status} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>First Name *</label>
            <input type="text" name="first_name" required className={inputCls} placeholder="e.g. Rahul" />
          </div>
          <div>
            <label className={labelCls}>Last Name *</label>
            <input type="text" name="last_name" required className={inputCls} placeholder="e.g. Sharma" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Admission Number *</label>
            <input
              type="text"
              name="admission_number"
              required
              className={inputCls}
              placeholder="e.g. ADM-2020-045"
            />
          </div>
          <div>
            <label className={labelCls}>Date of Birth *</label>
            <input type="date" name="dob" required className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select name="gender" className={inputCls} defaultValue="">
              <option value="" disabled>Select...</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Transgender">Transgender</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Primary Contact</label>
            <input
              type="tel"
              name="primary_contact_number"
              pattern="\+?[0-9\s\-\(\)]+"
              className={inputCls}
              placeholder="+91 9999999999"
            />
          </div>
          <div>
            <label className={labelCls}>Date of Admission</label>
            <input type="date" name="date_of_admission" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>TC Number</label>
            <input
              type="text"
              name="tc_number"
              className={inputCls}
              placeholder="Transfer Certificate No"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Previous School Attended</label>
            <input
              type="text"
              name="previous_school_attended"
              className={inputCls}
              placeholder="Name of school"
            />
          </div>
          <div>
            <label className={labelCls}>Aadhaar Number</label>
            <input
              type="text"
              name="aadhaar_number"
              maxLength={12}
              pattern="\d{12}"
              title="Must be 12 digits"
              className={inputCls}
              placeholder="12 digit number"
            />
          </div>
          <div>
            <label className={labelCls}>APAAR ID</label>
            <input
              type="text"
              name="apaar_id"
              maxLength={12}
              className={inputCls}
              placeholder="12 digit APAAR ID"
            />
          </div>
        </div>
      </div>

      {/* ── Section 2: Parent / Guardian ─────────────────────────── */}
      <div className={`${sectionCls} bg-slate-50/50`}>
        <h2 className="text-lg font-semibold text-slate-800">2. Parent &amp; Guardian Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Mother&apos;s Full Name</label>
            <input type="text" name="mother_full_name" className={inputCls} placeholder="Mother's name" />
          </div>
          <div>
            <label className={labelCls}>Father&apos;s Full Name</label>
            <input type="text" name="father_full_name" className={inputCls} placeholder="Father's name" />
          </div>
          <div>
            <label className={labelCls}>Guardian Name &amp; Relation</label>
            <input
              type="text"
              name="guardian_name_and_relation"
              className={inputCls}
              placeholder="e.g. Uncle / Raj"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Parent Aadhaar Number</label>
            <input
              type="text"
              name="parent_aadhaar_number"
              maxLength={12}
              pattern="\d{12}"
              title="Must be 12 digits"
              className={inputCls}
              placeholder="12 digit number"
            />
          </div>
          <div>
            <label className={labelCls}>Secondary Contact</label>
            <input
              type="tel"
              name="secondary_contact_number"
              pattern="\+?[0-9\s\-\(\)]+"
              className={inputCls}
              placeholder="+91 8888888888"
            />
          </div>
        </div>
      </div>

      {/* ── Section 3: Last Known Enrollment ─────────────────────── */}
      <div className={sectionCls}>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">3. Last Known Enrollment</h2>
          <p className="text-sm text-slate-500 mt-1">
            The academic year and class the student was enrolled in when they left the school.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className={labelCls}>Passout / Last Year *</label>
            <select name="academic_year_id" required className={inputCls} defaultValue="">
              <option value="" disabled>Select Year...</option>
              {dbYears.length > 0 && (
                <optgroup label="── In System ──">
                  {dbYears.map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}{y.is_active ? ' (Current)' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {historicYearNames.length > 0 && (
                <optgroup label="── Pre-System / Historical ──">
                  {historicYearNames.map((name) => (
                    <option key={name} value={`${HISTORIC_PREFIX}${name}`}>
                      {name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            <p className="text-xs text-slate-400 mt-1">
              Can&apos;t find the year? Historical years (2008 onwards) are listed under &ldquo;Pre-System&rdquo;.
            </p>
          </div>
          <div>
            <label className={labelCls}>Last Known Class *</label>
            <select name="class_id" required className={inputCls} defaultValue="">
              <option value="" disabled>Select Class...</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.grade_level} – {c.section}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Roll Number</label>
            <input
              type="number"
              name="roll_number"
              min="0"
              defaultValue={0}
              className={inputCls}
              placeholder="e.g. 12"
            />
          </div>
        </div>
      </div>

      {/* ── Section 4: Pending Fees / Arrears ────────────────────── */}
      <div className={`${sectionCls} bg-slate-50/50`}>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">4. Pending Fees (Arrears)</h2>
          <p className="text-sm text-slate-500 mt-1">
            If this student still owes money to the school, enter the outstanding amount. An
            &ldquo;Past Arrears&rdquo; invoice will be automatically created and linked to their
            enrollment record.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Pending Dues Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                ₹
              </span>
              <input
                type="number"
                name="pending_arrears"
                step="0.01"
                min="0"
                value={pendingArrears}
                onChange={(e) => setPendingArrears(e.target.value)}
                className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm bg-white"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Leave 0 if all fees were cleared before leaving.
            </p>
          </div>

          {hasPendingArrears && (
            <div className="flex items-end">
              <div className="w-full p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-semibold text-amber-800">Invoice will be created</p>
                <p className="text-xs text-amber-700 mt-1">
                  A &ldquo;Past Arrears&rdquo; invoice for{' '}
                  <span className="font-bold">
                    ₹{parseFloat(pendingArrears).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>{' '}
                  will be attached to this enrollment record. Status: <span className="font-semibold">Unpaid</span>.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 5: Pocket Money ───────────────────────────────── */}
      <div className={sectionCls}>
        <div>
          <h2 className="text-lg font-semibold text-slate-800">5. Pocket Money Balance</h2>
          <p className="text-sm text-slate-500 mt-1">
            If there is an outstanding pocket money balance at the time of leaving, log it here. This
            creates an opening entry in the wallet ledger.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={labelCls}>Balance Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                ₹
              </span>
              <input
                type="number"
                name="pocket_money_amount"
                step="0.01"
                min="0"
                value={pocketMoneyAmount}
                onChange={(e) => setPocketMoneyAmount(e.target.value)}
                className="w-full pl-7 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-600 outline-none text-slate-900 text-sm bg-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Balance Type</label>
            <div className="flex rounded-lg border border-slate-300 overflow-hidden mt-0">
              <button
                type="button"
                onClick={() => setPocketMoneyType('CREDIT')}
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                  pocketMoneyType === 'CREDIT'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Credit (School owes student)
              </button>
              <button
                type="button"
                onClick={() => setPocketMoneyType('DEBIT')}
                className={`flex-1 py-2 text-sm font-semibold border-l border-slate-300 transition-colors ${
                  pocketMoneyType === 'DEBIT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Debit (Student owes school)
              </button>
            </div>
            <input type="hidden" name="pocket_money_type" value={pocketMoneyType} />
            {hasPocketMoney && (
              <p className="text-xs mt-2 text-slate-500">
                {pocketMoneyType === 'CREDIT'
                  ? 'The school needs to return this amount to the student / family.'
                  : 'The student owes this amount to the school from pocket money account.'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Submit ────────────────────────────────────────────────── */}
      <div className="p-6 sm:p-8 bg-slate-50 border-t border-slate-200">
        {/* Summary card if there's anything to note */}
        {(hasPendingArrears || hasPocketMoney) && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 space-y-1">
            <p className="font-semibold text-blue-900 mb-2">Summary of financial records to be created:</p>
            {hasPendingArrears && (
              <p>
                • Invoice &ldquo;Past Arrears&rdquo; for{' '}
                <span className="font-bold">
                  ₹{parseFloat(pendingArrears).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>{' '}
                — Status: Unpaid
              </p>
            )}
            {hasPocketMoney && (
              <p>
                • Pocket money {pocketMoneyType === 'CREDIT' ? 'credit' : 'debit'} entry for{' '}
                <span className="font-bold">
                  ₹{parseFloat(pocketMoneyAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-end gap-4">
          <a
            href="/students/former-students"
            className="w-full sm:w-auto text-center bg-white text-slate-700 border border-slate-300 font-semibold px-8 py-3 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
          >
            Cancel
          </a>
          <button
            type="submit"
            className="w-full sm:w-auto bg-blue-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-blue-700 focus:ring-4 focus:ring-blue-100 transition-all shadow-md"
          >
            {status === 'Alumni' ? 'Save Alumni Record' : 'Save Dropout Record'}
          </button>
        </div>
      </div>
    </form>
  )
}
