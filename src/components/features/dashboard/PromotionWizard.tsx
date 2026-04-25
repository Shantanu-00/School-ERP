'use client'

import { Fragment, useMemo, useState, useTransition } from 'react'
import { ChevronsUpDown, Lock, ChevronRight, ChevronLeft } from 'lucide-react'
import { fetchPromotionStudents, promoteStudents, PromotionInstruction } from '@/actions/promotions.actions'

type Year = { id: string; name: string }
type ClassData = { id: string; grade_level: string; section: string }

type StudentTargetState = {
  actionType: 'promote' | 'alumni' | 'dropout' | 'fail' | 'none'
  targetClassId: string
  roll_number: string
  discount_type: string
  discount_mode: 'Percentage' | 'Fixed'
  discount_value: number
}

type PromotionStudent = {
  student_id: string
  enrollment_id: string
  admission_number: string | null
  first_name: string
  last_name: string
  roll_number: number | null
  current_status: 'Active' | 'Alumni' | 'Dropout' | string
  discount_type: string
  discount_mode: 'Percentage' | 'Fixed'
  discount_value: number
  pending_fees: number
  status: 'Pending' | 'Processed (In Next Year)' | 'Alumni' | 'Dropout' | string
}

const PAGE_SIZE = 10

export default function PromotionWizard({ academicYears, classes }: { academicYears: Year[], classes: ClassData[] }) {
  const [fromYearId, setFromYearId] = useState('')
  const [toYearId, setToYearId] = useState('')
  const [isLocked, setIsLocked] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [generateInvoices, setGenerateInvoices] = useState(false)

  const [selectedClassId, setSelectedClassId] = useState('')
  const [students, setStudents] = useState<PromotionStudent[]>([])
  
  const [studentTargets, setStudentTargets] = useState<Record<string, StudentTargetState>>({})
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([])
  const [expandedDiscountRows, setExpandedDiscountRows] = useState<string[]>([])

  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'admission' | 'roll'>('roll')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [viewFilter, setViewFilter] = useState<'all' | 'pending' | 'processed' | 'alumni' | 'dropout'>('all')
  const [page, setPage] = useState(1)

  // Bulk edit state
  const [bulkActionType, setBulkActionType] = useState<'promote' | 'alumni' | 'dropout' | 'fail'>('promote')
  const [bulkTargetClassId, setBulkTargetClassId] = useState('')
  const [bulkDiscountType, setBulkDiscountType] = useState('keep') // 'keep' or 'None', 'RTE', etc.
  const [bulkDiscountMode, setBulkDiscountMode] = useState<'Percentage' | 'Fixed'>('Percentage')
  const [bulkDiscountValue, setBulkDiscountValue] = useState<number>(0)

  const [isPending, startTransition] = useTransition()

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean, 
    type: 'error' | 'confirm' | 'success', 
    title: string, 
    message: string | React.ReactNode, 
    onConfirm?: () => void
  }>({ isOpen: false, type: 'error', title: '', message: '' })

  const showError = (msg: string) => setModalConfig({ isOpen: true, type: 'error', title: 'Action Required', message: msg })

  const selectedClass = useMemo(
    () => classes.find(c => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  )

  const getClassNumber = (gradeLevel: string) => {
    const match = gradeLevel.match(/\d+/)
    return match ? Number(match[0]) : null
  }

  const classLabelById = (classId: string) => {
    const found = classes.find(c => c.id === classId)
    return found ? `${found.grade_level}-${found.section}` : 'Not Set'
  }

  const getBatchName = (yearId: string) => {
    const year = academicYears.find(y => y.id === yearId)
    return year ? `Batch ${year.name}` : 'Not Set'
  }

  const yearBadgeText = () => {
    if (!fromYearId || !toYearId) return null
    const from = academicYears.find(y => y.id === fromYearId)?.name
    const to = academicYears.find(y => y.id === toYearId)?.name
    return from && to ? `${from} → ${to}` : null
  }

  const suggestedNextClassId = (currentClassId: string) => {
    const current = classes.find(c => c.id === currentClassId)
    if (!current) return ''

    const currentGradeNumber = getClassNumber(current.grade_level)
    if (currentGradeNumber === null) return ''

    const nextGrade = currentGradeNumber + 1
    const nextSameSection = classes.find(c => {
      const n = getClassNumber(c.grade_level)
      return n === nextGrade && c.section === current.section
    })

    return nextSameSection?.id || ''
  }

  const actionTypeToNewStatus = (actionType: StudentTargetState['actionType'], oldStatus: string) => {
    if (actionType === 'alumni') return 'Alumni'
    if (actionType === 'dropout') return 'Dropout'
    if (actionType === 'promote' || actionType === 'fail') return 'Active'
    return oldStatus
  }

  const handleLock = () => {
    if (!fromYearId || !toYearId) return showError('Please select both years first.')
    if (fromYearId === toYearId) return showError('From Year and To Year must be different.')
    
    // Check if the To Year is actually active
    const toYear = academicYears.find(y => y.id === toYearId)
    // Optional: Warn if promoting to an inactive year
    
    setIsLocked(true)

    const gradeEightClass = classes.find(c => /\b8\b/.test(c.grade_level))
    const defaultClass = gradeEightClass || classes[0]
    if (defaultClass) {
      void loadStudents(defaultClass.id)
    }
  }

  const handleUnlock = () => {
    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Unlock Years?',
      message: 'Are you sure? This will reset the current view.',
      onConfirm: () => {
        setIsLocked(false)
        setSelectedClassId('')
        setStudents([])
        setStudentTargets({})
        setSelectedStudentIds([])
        setExpandedDiscountRows([])
        setSearchQuery('')
        setPage(1)
        setModalConfig({ ...modalConfig, isOpen: false })
      }
    })
  }

  const loadStudents = async (cId: string) => {
    setSelectedClassId(cId)
    setStudentTargets({})
    setSelectedStudentIds([])
    setExpandedDiscountRows([])
    setPage(1)
    if (!cId) {
      setStudents([])
      return
    }
    
    startTransition(async () => {
      try {
        const data = (await fetchPromotionStudents(fromYearId, toYearId, cId)) as PromotionStudent[]
        setStudents(data)
        
        // Initialize state for pending students
        const initialTargets: Record<string, StudentTargetState> = {}
        const nextClassSuggestion = suggestedNextClassId(cId)

        data.forEach(s => {
          if (s.status === 'Pending') {
            initialTargets[s.student_id] = {
              actionType: 'promote',
              targetClassId: nextClassSuggestion,
              roll_number: s.roll_number ? String(s.roll_number) : '',
              discount_type: s.discount_type || 'None',
              discount_mode: s.discount_mode || 'Percentage',
              discount_value: s.discount_value || 0
            }
          }
        })
        setStudentTargets(initialTargets)
      } catch (err: unknown) {
        showError((err as Error).message)
      }
    })
  }

  const summary = useMemo(() => {
    const processed = students.filter(s => s.status === 'Processed (In Next Year)').length
    const pending = students.filter(s => s.status === 'Pending').length
    const alumni = students.filter(s => s.status === 'Alumni').length
    const dropout = students.filter(s => s.status === 'Dropout').length

    return {
      total: students.length,
      processed,
      pending,
      alumni,
      dropout,
      selected: selectedStudentIds.length,
    }
  }, [students, selectedStudentIds.length])

  const filteredAndSortedStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const filtered = students.filter(s => {
      const normalizedStatus = s.status === 'Processed (In Next Year)' ? 'processed' : String(s.status || '').toLowerCase()

      if (viewFilter !== 'all') {
        if (viewFilter === 'pending' && normalizedStatus !== 'pending') return false
        if (viewFilter === 'processed' && normalizedStatus !== 'processed') return false
        if (viewFilter === 'alumni' && normalizedStatus !== 'alumni') return false
        if (viewFilter === 'dropout' && normalizedStatus !== 'dropout') return false
      }

      if (!q) return true

      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase()
      const admission = String(s.admission_number || '').toLowerCase()
      const roll = String(s.roll_number || '').toLowerCase()
      return fullName.includes(q) || admission.includes(q) || roll.includes(q)
    })

    const sorted = [...filtered].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1
      if (sortBy === 'name') {
        const aName = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
        const bName = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
        return aName.localeCompare(bName) * multiplier
      }

      if (sortBy === 'admission') {
        return String(a.admission_number || '').localeCompare(String(b.admission_number || '')) * multiplier
      }

      return ((a.roll_number || 0) - (b.roll_number || 0)) * multiplier
    })

    return sorted
  }, [searchQuery, sortBy, sortDirection, students, viewFilter])

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedStudents.length / PAGE_SIZE))
  const paginatedStudents = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filteredAndSortedStudents.slice(start, start + PAGE_SIZE)
  }, [filteredAndSortedStudents, page])

  const pendingVisibleIds = useMemo(
    () => paginatedStudents.filter(s => s.status === 'Pending').map(s => s.student_id),
    [paginatedStudents]
  )

  const allVisiblePendingSelected = pendingVisibleIds.length > 0 && pendingVisibleIds.every(id => selectedStudentIds.includes(id))

  const toggleSelectAllVisiblePending = () => {
    if (pendingVisibleIds.length === 0) return

    setSelectedStudentIds(prev => {
      if (allVisiblePendingSelected) {
        return prev.filter(id => !pendingVisibleIds.includes(id))
      }

      const next = new Set([...prev, ...pendingVisibleIds])
      return Array.from(next)
    })
  }

  const toggleSingleSelection = (studentId: string) => {
    setSelectedStudentIds(prev => {
      if (prev.includes(studentId)) return prev.filter(id => id !== studentId)
      return [...prev, studentId]
    })
  }

  const handleBulkApply = () => {
    if (selectedStudentIds.length === 0) return showError('Select at least one pending student row first.')
    if ((bulkActionType === 'promote') && !bulkTargetClassId) return showError('Select a destination class for bulk apply.')
    
    setStudentTargets(prev => {
      const next = { ...prev }
      selectedStudentIds.forEach(id => {
        if (!next[id]) return
        const current = next[id]

        next[id] = {
          ...current,
          actionType: bulkActionType,
          targetClassId: bulkActionType === 'promote' ? bulkTargetClassId : bulkActionType === 'fail' ? selectedClassId : '',
        }

        if (bulkActionType !== 'alumni' && bulkActionType !== 'dropout' && bulkDiscountType !== 'keep') {
          next[id].discount_type = bulkDiscountType
          next[id].discount_mode = bulkDiscountMode
          next[id].discount_value = bulkDiscountType === 'None' ? 0 : Number(bulkDiscountValue || 0)
        }
      })
      return next
    })
  }

  const handleTargetChange = (id: string, field: keyof StudentTargetState, value: string | number) => {
    setStudentTargets(prev => {
      const updated = { ...prev, [id]: { ...prev[id], [field]: value } }

      if (field === 'actionType') {
        if (value === 'alumni' || value === 'dropout' || value === 'none') {
          updated[id].targetClassId = ''
        } else if (value === 'fail') {
          updated[id].targetClassId = selectedClassId
        } else if (value === 'promote') {
          updated[id].targetClassId = suggestedNextClassId(selectedClassId) || ''
        }
      }

      return updated
    })
  }

  const executeSave = () => {
    startTransition(async () => {
      try {
        const instructions: PromotionInstruction[] = []
        for (const [student_id, target] of Object.entries(studentTargets)) {
          if (target.actionType !== 'none') {
            instructions.push({
              student_id,
              actionType: target.actionType,
              targetClassId: target.targetClassId || null,
              roll_number: target.roll_number ? Number(target.roll_number) : undefined,
              discount_type: target.discount_type || 'None',
              discount_mode: target.discount_mode || 'Percentage',
              discount_value: Number(target.discount_value || 0)
            })
          }
        }
        
        if (instructions.length === 0) return showError('No changes to save.')

        const result = await promoteStudents(fromYearId, toYearId, instructions, generateInvoices)
        setModalConfig({ 
          isOpen: true, 
          type: 'success', 
          title: 'Success', 
          message: result?.message || 'Operation completed successfully!',
          onConfirm: undefined 
        })
        void loadStudents(selectedClassId)
      } catch (err: unknown) {
        showError((err as Error).message)
      }
    })
  }

  const handleSaveClick = () => {
    const activeTargets = Object.values(studentTargets).filter(t => t.actionType !== 'none')
    if (activeTargets.length === 0) return showError('No specific actions set for any student. Edit inline or use bulk apply.')

    setModalConfig({
      isOpen: true,
      type: 'confirm',
      title: 'Confirm Promotion',
      message: (
        <div className="space-y-4 text-sm text-slate-600">
          <p>You are about to process <span className="font-bold text-slate-800">{activeTargets.length}</span> student(s). Are you sure you want to proceed?</p>
          <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <input 
              type="checkbox" 
              id="generateInvoices" 
              className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-600 cursor-pointer"
              checked={generateInvoices}
              onChange={(e) => setGenerateInvoices(e.target.checked)}
            />
            <div>
              <label htmlFor="generateInvoices" className="font-semibold text-blue-900 cursor-pointer block mb-1">
                Generate fee invoices immediately
              </label>
              <p className="text-xs text-blue-700 leading-relaxed">
                If checked, the system will apply any selected discounts and immediately lock them by generating the initial invoice. If unchecked, students will be promoted without invoices, allowing you to edit their fees and discounts later from their profile.
              </p>
            </div>
          </div>
        </div>
      ),
      onConfirm: () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }))
        executeSave()
      }
    })
  }

  // Same logic for years
  const selectedFromIndex = academicYears.findIndex(y => y.id === fromYearId)
  const validToYears = fromYearId ? academicYears.slice(0, selectedFromIndex) : academicYears

  return (
    <div className="space-y-5 relative">
      {!isLocked && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Promote From Year</label>
            <select
              value={fromYearId}
              onChange={e => {
                setFromYearId(e.target.value)
                setToYearId('')
              }}
              disabled={isLocked}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">-- Select --</option>
              {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Promote To Year</label>
            <select
              value={toYearId}
              onChange={e => setToYearId(e.target.value)}
              disabled={isLocked}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg"
            >
              <option value="">-- Select --</option>
              {validToYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </div>
        </div>

          <div className="mt-4 flex justify-end">
            <button onClick={handleLock} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium shadow hover:bg-blue-700 transition">Lock & Start</button>
          </div>
        </div>
      )}

      {isLocked && yearBadgeText() && (
        <button
          onClick={handleUnlock}
          title="Click to unlock years"
          className="fixed top-4 right-4 z-40 bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-4 py-2 rounded-lg shadow-lg text-xs font-semibold flex items-center gap-2 transition"
        >
          <Lock size={14} className="opacity-80" />
          {yearBadgeText()}
        </button>
      )}

      {isLocked && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
              <div className="lg:col-span-3">
                <label className="block text-xs font-medium mb-1 text-slate-600">Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => void loadStudents(e.target.value)}
                  className="w-full p-2 border rounded-lg bg-white outline-none"
                >
                  <option value="">Select Class</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.grade_level} - {c.section}</option>)}
                </select>
              </div>
              <div className="lg:col-span-9 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">Page Records</div>
                  <div className="text-sm font-semibold text-slate-800">
                    {Math.min(PAGE_SIZE, filteredAndSortedStudents.length)} shown
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">In Batch</div>
                  <div className="text-sm font-semibold text-slate-800">{summary.total} total</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{fromYearId ? academicYears.find(y => y.id === fromYearId)?.name : 'Current'}</div>
                  <div className="text-sm font-semibold text-slate-800">{summary.total - summary.processed}</div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{toYearId ? academicYears.find(y => y.id === toYearId)?.name : 'Next'}</div>
                  <div className="text-sm font-semibold text-slate-800">{summary.processed}</div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                  <div className="text-[11px] text-amber-700">Awaiting Action</div>
                  <div className="text-sm font-semibold text-amber-800">{summary.pending}</div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <div className="text-[11px] text-blue-700">Selected Rows</div>
                  <div className="text-sm font-semibold text-blue-800">{summary.selected}</div>
                </div>
              </div>
            </div>
          </div>

          {selectedClassId && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium mb-1">Bulk Status</label>
                    <select value={bulkActionType} onChange={(e) => setBulkActionType(e.target.value as 'promote' | 'alumni' | 'dropout' | 'fail')} className="w-full p-2 border rounded-lg bg-white outline-none text-sm">
                      <option value="promote">Active: Promote</option>
                      <option value="fail">Active: Repeat</option>
                      <option value="alumni">Alumni</option>
                      <option value="dropout">Dropout</option>
                    </select>
                  </div>

                  {bulkActionType === 'promote' && (
                    <>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium mb-1">Destination Class</label>
                        <select value={bulkTargetClassId} onChange={e => setBulkTargetClassId(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none text-sm">
                          <option value="">Select Class</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.grade_level} {c.section}</option>)}
                        </select>
                      </div>
                      <div className="lg:col-span-2">
                        <label className="block text-xs font-medium mb-1">Discount Type</label>
                        <select value={bulkDiscountType} onChange={e => setBulkDiscountType(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none text-sm">
                          <option value="keep">Keep Existing</option>
                          <option value="None">None</option>
                          <option value="RTE">RTE</option>
                          <option value="Staff Child">Staff Child</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Management Discount">Management Discount</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {bulkDiscountType !== 'keep' && bulkDiscountType !== 'None' && (
                        <>
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-medium mb-1">Mode</label>
                            <select value={bulkDiscountMode} onChange={e => setBulkDiscountMode(e.target.value as 'Percentage' | 'Fixed')} className="w-full p-2 border rounded-lg bg-white outline-none text-sm">
                              <option value="Percentage">Percentage (%)</option>
                              <option value="Fixed">Fixed (INR)</option>
                            </select>
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-medium mb-1">Value</label>
                            <input type="number" value={bulkDiscountValue === 0 ? '' : bulkDiscountValue} onChange={e => setBulkDiscountValue(Number(e.target.value || 0))} onWheel={e => e.currentTarget.blur()} className="w-full p-2 border rounded-lg bg-white outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  {bulkActionType === 'fail' && (
                    <>
                      <div className="lg:col-span-4">
                        <label className="block text-xs font-medium mb-1">Discount Type</label>
                        <select value={bulkDiscountType} onChange={e => setBulkDiscountType(e.target.value)} className="w-full p-2 border rounded-lg bg-white outline-none text-sm">
                          <option value="keep">Keep Existing</option>
                          <option value="None">None</option>
                          <option value="RTE">RTE</option>
                          <option value="Staff Child">Staff Child</option>
                          <option value="Sibling">Sibling</option>
                          <option value="Management Discount">Management Discount</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>

                      {bulkDiscountType !== 'keep' && bulkDiscountType !== 'None' && (
                        <>
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-medium mb-1">Mode</label>
                            <select value={bulkDiscountMode} onChange={e => setBulkDiscountMode(e.target.value as 'Percentage' | 'Fixed')} className="w-full p-2 border rounded-lg bg-white outline-none text-sm">
                              <option value="Percentage">Percentage (%)</option>
                              <option value="Fixed">Fixed (INR)</option>
                            </select>
                          </div>
                          <div className="lg:col-span-2">
                            <label className="block text-xs font-medium mb-1">Value</label>
                            <input type="number" value={bulkDiscountValue === 0 ? '' : bulkDiscountValue} onChange={e => setBulkDiscountValue(Number(e.target.value || 0))} onWheel={e => e.currentTarget.blur()} className="w-full p-2 border rounded-lg bg-white outline-none text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="0" />
                          </div>
                        </>
                      )}
                    </>
                  )}

                  <div className="lg:col-span-2">
                    <button onClick={handleBulkApply} className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition text-sm">Apply To Selected</button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 bg-slate-50 border-b space-y-3">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <h3 className="font-semibold text-sm">
                      Students: {filteredAndSortedStudents.length} / {students.length}
                    </h3>
                    <button onClick={handleSaveClick} disabled={isPending} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition">Save & Make Changes</button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 items-end">
                    <div className="lg:col-span-4">
                      <label className="block text-xs font-medium mb-1">Search</label>
                      <input
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value)
                          setPage(1)
                        }}
                        className="w-full p-2 border rounded-lg outline-none"
                        placeholder="Name, admission no, roll no"
                      />
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium mb-1">Show</label>
                      <select value={viewFilter} onChange={(e) => { setViewFilter(e.target.value as 'all' | 'pending' | 'processed' | 'alumni' | 'dropout'); setPage(1) }} className="w-full p-2 border rounded-lg bg-white outline-none">
                        <option value="all">All Students</option>
                        <option value="pending">Pending</option>
                        <option value="processed">Processed</option>
                        <option value="alumni">Alumni</option>
                        <option value="dropout">Dropout</option>
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium mb-1">Sort By</label>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'name' | 'admission' | 'roll')} className="w-full p-2 border rounded-lg bg-white outline-none">
                        <option value="name">Name</option>
                        <option value="admission">Admission</option>
                        <option value="roll">Roll Number</option>
                      </select>
                    </div>
                    <div className="lg:col-span-2">
                      <label className="block text-xs font-medium mb-1">Direction</label>
                      <button
                        onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                        className="w-full p-2 border rounded-lg bg-white outline-none text-sm flex items-center justify-center gap-1"
                      >
                        {sortDirection === 'asc' ? 'Ascending' : 'Descending'} <ChevronsUpDown size={14} />
                      </button>
                    </div>
                    <div className="lg:col-span-2 text-xs text-slate-500">
                      Processed: {summary.processed} | Pending: {summary.pending}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 border-b text-[11px] uppercase text-slate-500 whitespace-nowrap">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox" checked={allVisiblePendingSelected} onChange={toggleSelectAllVisiblePending} />
                        </th>
                        <th className="px-4 py-3">Adm No.</th>
                        <th className="px-4 py-3">Student Name</th>
                        <th className="px-4 py-3">Status (Old → New)</th>
                        <th className="px-4 py-3">Class (Old → New)</th>
                        <th className="px-4 py-3">Roll No. (Old → New)</th>
                        <th className="px-4 py-3">Discount (Old → New)</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y">
                      {isPending && <tr><td colSpan={7} className="text-center p-8 text-slate-500">Loading...</td></tr>}

                      {!isPending && paginatedStudents.map((s) => {
                        const isPendingRow = s.status === 'Pending'
                        const target = studentTargets[s.student_id]
                        const isSelected = selectedStudentIds.includes(s.student_id)
                        const isDiscountExpanded = expandedDiscountRows.includes(s.student_id)
                        const currentClassLabel = selectedClass ? `${selectedClass.grade_level}-${selectedClass.section}` : '-'
                        const newStatus = target ? actionTypeToNewStatus(target.actionType, s.current_status || 'Active') : s.current_status

                        const classText = () => {
                          if (!target || target.actionType === 'none') return '-'
                          if (target.actionType === 'alumni') return 'Not Applicable (Alumni)'
                          if (target.actionType === 'dropout') return 'Not Applicable (Dropout)'
                          return classLabelById(target.targetClassId)
                        }

                        return (
                          <Fragment key={s.student_id}>
                            <tr key={s.student_id} className={`${!isPendingRow ? 'opacity-65 bg-slate-50' : ''} ${isSelected ? 'bg-blue-50/40' : ''}`}>
                              <td className="px-4 py-3 align-top">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={!isPendingRow}
                                  onChange={() => toggleSingleSelection(s.student_id)}
                                />
                              </td>
                              <td className="px-4 py-3 align-top font-medium text-slate-800">{s.admission_number || 'N/A'}</td>
                              <td className="px-4 py-3 align-top">
                                <div className="font-medium text-slate-800">{s.first_name} {s.last_name}</div>
                                {s.pending_fees > 0 && <div className="mt-1 text-[11px] text-red-700">Pending Dues: INR {s.pending_fees}</div>}
                              </td>
                              <td className="px-4 py-3 align-top min-w-55">
                                <div className="text-xs text-slate-600">{s.current_status || 'Active'} → {newStatus}</div>
                                {isPendingRow ? (
                                  <select
                                    value={target?.actionType || 'promote'}
                                    onChange={e => handleTargetChange(s.student_id, 'actionType', e.target.value)}
                                    className="mt-1 w-full text-xs p-2 border rounded-md bg-white outline-none"
                                  >
                                    <option value="promote">Active: Promote</option>
                                    <option value="fail">Active: Repeat</option>
                                    <option value="alumni">Alumni</option>
                                    <option value="dropout">Dropout</option>
                                  </select>
                                ) : (
                                  <div className="mt-1 text-[11px] text-slate-500">{s.status}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top min-w-60">
                                <div className="text-xs text-slate-600">{currentClassLabel} → {classText()}</div>
                                {isPendingRow && target?.actionType === 'promote' && (
                                  <select
                                    value={target.targetClassId || ''}
                                    onChange={e => handleTargetChange(s.student_id, 'targetClassId', e.target.value)}
                                    className="mt-1 w-full text-xs p-2 border rounded-md bg-white outline-none"
                                  >
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.grade_level} {c.section}</option>)}
                                  </select>
                                )}
                              </td>
                              <td className="px-4 py-3 align-top min-w-47.5">
                                <div className="text-xs text-slate-600">{s.roll_number || '-'} → {target?.roll_number || '-'}</div>
                                {isPendingRow && target?.actionType !== 'none' && (
                                  <input
                                    type="number"
                                    value={target.roll_number || ''}
                                    onChange={e => handleTargetChange(s.student_id, 'roll_number', e.target.value)}
                                    onWheel={e => e.currentTarget.blur()}
                                    className="mt-1 w-full text-xs p-2 border rounded-md bg-white outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="New Roll Number"
                                  />
                                )}
                              </td>
                              <td className="px-4 py-3 align-top min-w-60">
                                <div className="text-xs text-slate-600">
                                  {s.discount_type} ({s.discount_mode === 'Percentage' ? `${s.discount_value}%` : `INR ${s.discount_value}`})
                                  {' → '}
                                  {target?.discount_type || 'None'}
                                  {target?.discount_type && target.discount_type !== 'None' ? ` (${target.discount_mode === 'Percentage' ? `${target.discount_value}%` : `INR ${target.discount_value}`})` : ''}
                                </div>
                                {isPendingRow && target?.actionType !== 'alumni' && target?.actionType !== 'dropout' && target?.actionType !== 'none' && (
                                  <button
                                    onClick={() => setExpandedDiscountRows(prev => prev.includes(s.student_id) ? prev.filter(id => id !== s.student_id) : [...prev, s.student_id])}
                                    className="mt-1 text-xs px-2 py-1 border rounded-md bg-white hover:bg-slate-50"
                                  >
                                    {isDiscountExpanded ? 'Hide Discount Editor' : 'Edit Discount'}
                                  </button>
                                )}
                              </td>
                            </tr>

                            {isPendingRow && isDiscountExpanded && target?.actionType !== 'alumni' && target?.actionType !== 'dropout' && target?.actionType !== 'none' && (
                              <tr>
                                <td colSpan={7} className="px-4 pb-4 pt-0">
                                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 grid grid-cols-1 md:grid-cols-4 gap-2">
                                    <div>
                                      <label className="block text-[11px] font-medium mb-1">Discount Type</label>
                                      <select
                                        value={target.discount_type}
                                        onChange={e => handleTargetChange(s.student_id, 'discount_type', e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white text-xs outline-none"
                                      >
                                        <option value="None">None</option>
                                        <option value="RTE">RTE</option>
                                        <option value="Staff Child">Staff Child</option>
                                        <option value="Sibling">Sibling</option>
                                        <option value="Management Discount">Management Discount</option>
                          <option value="Other">Other</option>
                                      </select>
                                    </div>
                                    
                                    <div>
                                      <label className="block text-[11px] font-medium mb-1">Mode</label>
                                      <select
                                        disabled={target.discount_type === 'None'}
                                        value={target.discount_mode}
                                        onChange={e => handleTargetChange(s.student_id, 'discount_mode', e.target.value)}
                                        className="w-full p-2 border rounded-md bg-white text-xs outline-none disabled:bg-slate-100"
                                      >
                                        <option value="Percentage">Percentage (%)</option>
                                        <option value="Fixed">Fixed (INR)</option>
                                      </select>
                                    </div>
                                    <div>
                                      <label className="block text-[11px] font-medium mb-1">Value</label>
                                      <input
                                        disabled={target.discount_type === 'None'}
                                        type="number"
                                        value={target.discount_value === 0 ? '' : target.discount_value}
                                        onChange={e => handleTargetChange(s.student_id, 'discount_value', Number(e.target.value || 0))}
                                        onWheel={e => e.currentTarget.blur()}
                                        placeholder="0"
                                        className="w-full p-2 border rounded-md bg-white text-xs outline-none disabled:bg-slate-100 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      />
                                    </div>
                                    
                                    <div className="text-[11px] text-slate-600 flex items-end">
                                      Edit settings for this enrollment year.
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="p-3 border-t bg-slate-50 flex items-center justify-between text-xs text-slate-600">
                  <div>Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredAndSortedStudents.length)} of {filteredAndSortedStudents.length}</div>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
                    >
                      Previous
                    </button>
                    <span>Page {page} / {totalPages}</span>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Handling */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold mb-2">{modalConfig.title}</h2>
            <div className="text-sm text-slate-600 mb-6">{modalConfig.message}</div>
            <div className="flex gap-3 justify-end">
              {modalConfig.type === 'confirm' ? (
                <>
                  <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="px-4 py-2 hover:bg-slate-100 rounded-lg text-sm font-medium transition">Cancel</button>
                  <button onClick={modalConfig.onConfirm} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">Confirm</button>
                </>
              ) : (
                <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">OK</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
