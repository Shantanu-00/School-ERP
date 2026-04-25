'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X, Wallet, FileText, Loader2, Trash2 } from 'lucide-react'
import { addPocketMoneyTransaction, getStudentPendingInvoices, recordFeePayments } from '@/actions/finance.actions'
import { getUploadUrl } from '@/actions/storage.actions'

type PocketPaymentMode = 'Cash' | 'Bank Transfer' | 'UPI' | 'Cheque' | 'Internal Adjustment'

function RecordPaymentModalContent({ studentId, variant = 'default' }: { studentId: string, variant?: 'default' | 'small' }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState<'select' | 'pocket' | 'fees'>('select')
  const [pocketType, setPocketType] = useState<'CREDIT' | 'DEBIT'>('CREDIT')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [totalPaymentAmount, setTotalPaymentAmount] = useState('')
  const [bills, setBills] = useState<FileList | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('Cash')
  const [transactionReference, setTransactionReference] = useState('')
  const [pocketPaymentMethod, setPocketPaymentMethod] = useState<PocketPaymentMode>('Cash')
  const [pocketTransactionReference, setPocketTransactionReference] = useState('')
  
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]
  const [paymentDate, setPaymentDate] = useState(today)

  const [allocations, setAllocations] = useState<{ id: string, invoiceId: string, amount: string }[]>([
    { id: crypto.randomUUID(), invoiceId: '', amount: '' }
  ])

  useEffect(() => {
    if (mode === 'fees' && isOpen) {
      const fetchInvoices = async () => {
        setLoadingInvoices(true)
        const res = await getStudentPendingInvoices(studentId)
        if (res.invoices) setInvoices(res.invoices)
        setLoadingInvoices(false)
      }
      fetchInvoices()
    }
  }, [mode, isOpen, studentId])

  const handlePocketTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setErrorMsg('Please enter a valid amount')
      return
    }
    if (pocketType === 'CREDIT' && pocketPaymentMethod !== 'Cash' && !pocketTransactionReference.trim()) {
      setErrorMsg('Please provide a transaction reference for non-cash credits')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    
    try {
      const fileKeys: string[] = []
      if (bills && bills.length > 0) {
        for (let i = 0; i < bills.length; i++) {
          const file = bills[i]
          const { signedUrl, fileKey } = await getUploadUrl(file.type)
          const uploadRes = await fetch(signedUrl, { method: 'PUT', body: file })
          if (!uploadRes.ok) throw new Error('Failed to upload bill')
          fileKeys.push(fileKey)
        }
      }

      const typedDescription = description || (pocketType === 'CREDIT' ? 'Parent Deposit' : 'Misc Expense')
      const result = await addPocketMoneyTransaction(
        studentId,
        Number(amount),
        typedDescription,
        pocketType,
        fileKeys,
        pocketPaymentMethod,
        pocketTransactionReference.trim() || undefined
      )
      
      if (result.error) {
        setErrorMsg(result.error)
      } else {
        closeAndReset()
        router.refresh()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during upload')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFeePayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!totalPaymentAmount || isNaN(Number(totalPaymentAmount)) || Number(totalPaymentAmount) <= 0) {
      setErrorMsg('Please enter a valid amount received')
      return
    }

    const totalExpected = Number(totalPaymentAmount)
    let allocatedTotal = 0
    const paymentsToRecord: { invoice_id: string, amount_paid: number }[] = []

    for (const alloc of allocations) {
      if (alloc.invoiceId && alloc.amount) {
        const amt = Number(alloc.amount)
        if (amt <= 0) {
          setErrorMsg('Allocated amounts must be greater than zero')
          return
        }
        
        const invoice = invoices.find(inv => inv.id === alloc.invoiceId)
        if (!invoice) {
          setErrorMsg('Selected invoice not found')
          return
        }
        if (amt > invoice.pending_amount) {
          setErrorMsg(`Amount for ${invoice.title} exceeds its pending balance of ${invoice.pending_amount}`)
          return
        }
        
        allocatedTotal += amt
        paymentsToRecord.push({ invoice_id: alloc.invoiceId, amount_paid: amt })
      }
    }

    if (paymentsToRecord.length === 0) {
      setErrorMsg('Please allocate the payment to at least one invoice')
      return
    }
    if (allocatedTotal !== totalExpected) {
      setErrorMsg(`Allocated total (₹${allocatedTotal}) must equal Amount Received (₹${totalExpected})`)
      return
    }
    if (paymentMethod !== 'Cash' && !transactionReference.trim()) {
      setErrorMsg('Please provide a UTR or Transaction Reference number')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')

    try {
      const fileKeys: string[] = []
      if (bills && bills.length > 0) {
        for (let i = 0; i < bills.length; i++) {
          const file = bills[i]
          const { signedUrl, fileKey } = await getUploadUrl(file.type)
          const uploadRes = await fetch(signedUrl, { method: 'PUT', body: file })
          if (!uploadRes.ok) throw new Error('Failed to upload bill')
          fileKeys.push(fileKey)
        }
      }

      const result = await recordFeePayments(paymentsToRecord, paymentMethod, paymentDate, transactionReference, fileKeys)
      
      if (result.error) {
        setErrorMsg(result.error)
      } else {
        closeAndReset()
        router.refresh()
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during upload')
    } finally {
      setIsSubmitting(false)
    }
  }

  const closeAndReset = () => {
    setIsOpen(false)
    setMode('select')
    setPocketType('CREDIT')
    setAmount('')
    setDescription('')
    setBills(null)
    setErrorMsg('')
    setTotalPaymentAmount('')
    setPaymentDate(today)
    setPaymentMethod('Cash')
    setTransactionReference('')
    setPocketPaymentMethod('Cash')
    setPocketTransactionReference('')
    setAllocations([{ id: crypto.randomUUID(), invoiceId: '', amount: '' }])
  }

  const handleAddAllocation = () => {
    setAllocations(prev => [...prev, { id: crypto.randomUUID(), invoiceId: '', amount: '' }])
  }

  const handleRemoveAllocation = (id: string) => {
    setAllocations(prev => prev.filter(a => a.id !== id))
  }

  const handleAllocationInvoiceChange = (id: string, invoiceId: string) => {
    const totalGiven = Number(totalPaymentAmount) || 0
    const otherAllocated = allocations.reduce((acc, a) => {
      if (a.id !== id) return acc + (Number(a.amount) || 0)
      return acc
    }, 0)
    
    let remainingToAllocate = totalGiven - otherAllocated
    if (remainingToAllocate < 0) remainingToAllocate = 0

    const invoice = invoices.find(inv => inv.id === invoiceId)
    const autoAmount = invoice ? Math.min(remainingToAllocate, invoice.pending_amount) : ''

    setAllocations(prev => prev.map(alloc => {
      if (alloc.id === id) {
        return { ...alloc, invoiceId, amount: autoAmount ? autoAmount.toString() : '' }
      }
      return alloc
    }))
  }

  const handleAllocationAmountChange = (id: string, newAmount: string) => {
    setAllocations(prev => prev.map(alloc => {
      if (alloc.id === id) {
        return { ...alloc, amount: newAmount }
      }
      return alloc
    }))
  }

  return (
    <>
      {variant === 'small' ? (
        <button 
          onClick={() => setIsOpen(true)}
          className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-md font-semibold tracking-wide transition-colors shadow-sm"
        >
          Record Payment
        </button>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} /> Record Payment
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 sm:p-6">
          <div className={`bg-white rounded-2xl shadow-xl w-full flex flex-col max-h-[90vh] ${mode === 'fees' ? 'max-w-3xl' : 'max-w-md'} animate-in fade-in zoom-in-95 duration-200`}>
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 shrink-0">
              <h2 className="text-xl font-bold text-slate-800">Record Payment</h2>
              <button 
                onClick={closeAndReset} 
                className="text-slate-400 hover:bg-slate-100 p-2 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-5 sm:p-6 overflow-y-auto overflow-x-hidden">
              {mode === 'select' && (
                <>
                  <p className="text-slate-600 text-sm mb-6 text-center">What type of transaction would you like to record?</p>
                  <div className="grid grid-cols-1 gap-3">
                    <button 
                      onClick={() => setMode('fees')}
                      className="flex items-center p-4 border-2 border-blue-100 bg-blue-50/50 hover:bg-blue-50 text-left hover:border-blue-300 rounded-xl transition-all gap-4 cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                        <FileText size={24} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 block">Fee Payment</span>
                        <span className="text-xs text-slate-500">Record an installment or full invoice payment</span>
                      </div>
                    </button>

                    <button 
                      onClick={() => setMode('pocket')}
                      className="flex items-center p-4 border-2 border-emerald-100 bg-emerald-50/50 text-left hover:bg-emerald-50 hover:border-emerald-300 rounded-xl transition-all gap-4 cursor-pointer"
                    >
                      <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
                        <Wallet size={24} />
                      </div>
                      <div>
                        <span className="font-semibold text-slate-800 block">Pocket Money</span>
                        <span className="text-xs text-slate-500">Manage student wallet balance (Credit/Debit)</span>
                      </div>
                    </button>
                  </div>
                </>
              )}

              {mode === 'fees' && (
                <form onSubmit={handleFeePayment} className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b pb-4">
                    <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Fee Payment</h3>
                      <p className="text-xs text-slate-500">Pay against active invoices</p>
                    </div>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                      {errorMsg}
                    </div>
                  )}

                  {loadingInvoices ? (
                    <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
                  ) : invoices.length === 0 ? (
                    <p className="text-center text-slate-500 text-sm py-4">No pending invoices found for this student.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Top Context: Date, Amount, Method */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-slate-700 mb-1">Amount Received (₹)</label>
                          <input
                            type="number"
                            name="totalPaymentAmount"
                            value={totalPaymentAmount}
                            onChange={(e) => setTotalPaymentAmount(e.target.value)}
                            onWheel={e => e.currentTarget.blur()}
                            placeholder="e.g. 30000"
                            className="w-full border-slate-200 rounded-md p-3 border focus:ring-2 focus:ring-blue-500 outline-none text-lg font-semibold [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none shadow-sm"
                            min="1"
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                          <select
                            name="paymentMethod"
                            className="w-full border-slate-200 rounded-md p-2.5 border outline-none shadow-sm"
                            value={paymentMethod}
                            onChange={(e) => {
                              setPaymentMethod(e.target.value)
                              if (e.target.value === 'Cash') setTransactionReference('')
                            }}
                          >
                            <option value="Cash">Cash</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="UPI">UPI</option>
                            <option value="Cheque">Cheque</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Payment Date</label>
                          <input
                            type="date"
                            name="paymentDate"
                            className="w-full border-slate-200 rounded-md p-2.5 border outline-none shadow-sm"
                            value={paymentDate}
                            min={thirtyDaysAgo}
                            max={today}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      {paymentMethod !== 'Cash' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Transaction Reference / UTR</label>
                          <input 
                            type="text" 
                            name="transactionReference"
                            value={transactionReference}
                            onChange={(e) => setTransactionReference(e.target.value)}
                            placeholder="e.g. UTR123456789"
                            className="w-full border-slate-200 rounded-md p-2.5 border focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
                            required={paymentMethod !== 'Cash'}
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Attach Bill(s) / Receipt(s) (Optional)</label>
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*,application/pdf"
                          onChange={(e) => setBills(e.target.files)}
                          className="w-full border-slate-200 rounded-md p-2 border outline-none shadow-sm text-sm"
                        />
                      </div>

                      {/* Allocations */}
                      <div className="pt-4 border-t mt-6">
                        <div className="flex justify-between items-center mb-3">
                          <label className="block text-sm font-semibold text-slate-800">Map Invoices</label>
                          <button
                            type="button"
                            onClick={handleAddAllocation}
                            className="text-xs text-blue-700 hover:text-blue-800 flex items-center gap-1 font-medium bg-blue-50 hover:bg-blue-100 transition px-3 py-1.5 rounded-md"
                          >
                            <Plus size={16} /> Add Row
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          {allocations.map((alloc, idx) => (
                            <div key={alloc.id} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-slate-50/50 p-2 sm:p-3 rounded-lg border border-slate-200">
                              <div className="flex-1 w-full">
                                <select
                                  className="w-full border-slate-200 rounded-md p-2.5 border outline-none text-sm bg-white shadow-sm"
                                  value={alloc.invoiceId}
                                  onChange={(e) => handleAllocationInvoiceChange(alloc.id, e.target.value)}
                                  required
                                >
                                  <option value="" disabled>-- Select Invoice --</option>
                                  {invoices.map(inv => {
                                    // if already selected in another row, disabled
                                    const disabled = allocations.some(a => a.id !== alloc.id && a.invoiceId === inv.id)
                                    return (
                                      <option key={inv.id} value={inv.id} disabled={disabled}>
                                        {inv.academic_year}  {inv.title} (Pending: {inv.pending_amount})
                                      </option>
                                    )
                                  })}
                                </select>
                              </div>
                              <div className="w-full sm:w-40 relative shrink-0 flex gap-2">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium"></span>
                                <input
                                  type="number"
                                  value={alloc.amount}
                                  onChange={(e) => handleAllocationAmountChange(alloc.id, e.target.value)}
                                  onWheel={e => e.currentTarget.blur()}
                                  className="w-full pl-8 border-slate-200 rounded-md p-2.5 border focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                  placeholder="Amount"
                                  min="1"
                                  required
                                />
                                {allocations.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAllocation(alloc.id)}
                                    className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition shrink-0 bg-white border border-slate-200"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setMode('select')}
                      className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 font-medium transition"
                    >
                      Back
                    </button>
                    {invoices.length > 0 && (
                      <button 
                        type="submit"
                        disabled={isSubmitting || allocations.every(a => !a.invoiceId)}
                        className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Processing</> : 'Confirm Payment'}
                      </button>
                    )}
                  </div>
                </form>
              )}

              {(mode === 'pocket') && (
                <form onSubmit={handlePocketTransaction} className="space-y-4">
                  <div className="flex items-center gap-2 mb-4 border-b pb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pocketType === 'CREDIT' ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'}`}>
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">
                        Pocket Money
                      </h3>
                      <p className="text-xs text-slate-500">Wallet Transaction</p>
                    </div>
                  </div>

                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setPocketType('CREDIT')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${pocketType === 'CREDIT' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Add (Credit)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPocketType('DEBIT')}
                      className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${pocketType === 'DEBIT' ? 'bg-white text-orange-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Deduct (Debit)
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                      {errorMsg}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount ()</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onWheel={e => e.currentTarget.blur()}
                      className={`w-full border-slate-200 rounded-md p-2.5 border outline-none focus:ring-2 shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${pocketType === 'CREDIT' ? 'focus:ring-emerald-500' : 'focus:ring-orange-500'}`}
                      placeholder="e.g. 500"
                      min="1"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                    <input 
                      type="text" 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={`w-full border-slate-200 rounded-md p-2.5 border outline-none focus:ring-2 shadow-sm ${pocketType === 'CREDIT' ? 'focus:ring-emerald-500' : 'focus:ring-orange-500'}`}
                      placeholder={pocketType === 'CREDIT' ? 'Parent Deposit' : 'Canteen expense'}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                      <select
                        className="w-full border-slate-200 rounded-md p-2.5 border outline-none shadow-sm"
                        value={pocketPaymentMethod}
                        onChange={(e) => {
                          const next = e.target.value as PocketPaymentMode
                          setPocketPaymentMethod(next)
                          if (next === 'Cash') setPocketTransactionReference('')
                        }}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Internal Adjustment">Internal Adjustment</option>
                      </select>
                    </div>

                    {pocketPaymentMethod !== 'Cash' && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">
                          Transaction Reference{pocketType === 'CREDIT' ? ' *' : ' (Optional)'}
                        </label>
                        <input
                          type="text"
                          value={pocketTransactionReference}
                          onChange={(e) => setPocketTransactionReference(e.target.value)}
                          placeholder="e.g. UTR123456789"
                          className={`w-full border-slate-200 rounded-md p-2.5 border outline-none focus:ring-2 shadow-sm ${pocketType === 'CREDIT' ? 'focus:ring-emerald-500' : 'focus:ring-orange-500'}`}
                          required={pocketType === 'CREDIT'}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Attach Bill(s) / Receipt(s) (Optional)</label>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*,application/pdf"
                      onChange={(e) => setBills(e.target.files)}
                      className="w-full border-slate-200 rounded-md p-2 border outline-none shadow-sm text-sm"
                    />
                  </div>

                  <div className="pt-4 flex gap-3">
                    <button 
                      type="button"
                      onClick={() => {
                        setMode('select')
                        setAmount('')
                        setDescription('')
                      }}
                      className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-md hover:bg-slate-50 font-medium transition"
                    >
                      Back
                    </button>
                    <button 
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex-1 px-4 py-2 text-white rounded-md font-medium transition flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed ${pocketType === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                      {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> Processing</> : 'Confirm'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export function RecordPaymentModal({ studentId, variant }: { studentId: string, variant?: 'default' | 'small' }) {
  return (
    <Suspense fallback={
      variant === 'small' ? (
        <button className="text-sm bg-green-600 text-white px-3 py-1 rounded opacity-50 cursor-not-allowed">Record Payment</button>
      ) : (
        <button className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium text-sm flex items-center gap-2 shadow-sm opacity-50 cursor-not-allowed">
          <Plus size={18} /> Record Payment
        </button>
      )
    }>
      <RecordPaymentModalContent studentId={studentId} variant={variant} />
    </Suspense>
  )
}
