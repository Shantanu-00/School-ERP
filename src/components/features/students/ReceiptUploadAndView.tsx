"use client"

import { useState, useRef } from "react"
import { Loader2, UploadCloud, Eye, Paperclip, X } from "lucide-react"
import { getUploadUrl, getViewUrls } from "@/actions/storage.actions"
import { addFeePaymentReceipt, addPocketMoneyReceipt } from "@/actions/finance.actions"

type Props = {
  transactionId: string
  existingKeys: string[]
  type: "FEE" | "POCKET"
  onUploadSuccess?: () => void
}

export function ReceiptUploadAndView({ transactionId, existingKeys, type, onUploadSuccess }: Props) {
  const [isUploading, setIsUploading] = useState(false)
  const [isViewing, setIsViewing] = useState(false)
  const [bills, setBills] = useState<File[]>([])
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const selected = Array.from(e.target.files)
    
    // Validate size (5MB max) and type
    const validFiles = selected.filter(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(`${file.name} is larger than the 5MB size limit.`)
        return false
      }
      if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        alert(`${file.name} is not a valid image or PDF file.`)
        return false
      }
      return true
    })

    setBills(prev => [...prev, ...validFiles])

    // Reset input so the exact same file can be chosen again if removed
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const removeFile = (index: number) => {
    setBills(prev => prev.filter((_, i) => i !== index))
  }
  
  const handleUpload = async () => {
    if (!bills || bills.length === 0) return
    setIsUploading(true)
    try {
      const fileKeys: string[] = []
      for (let i = 0; i < bills.length; i++) {
        const file = bills[i]
        const { signedUrl, fileKey } = await getUploadUrl(file.type)
        const uploadRes = await fetch(signedUrl, { method: 'PUT', body: file })
        if (!uploadRes.ok) throw new Error('Failed to upload bill')
        fileKeys.push(fileKey)
      }

      if (type === "FEE") {
        await addFeePaymentReceipt(transactionId, fileKeys)
      } else {
        await addPocketMoneyReceipt(transactionId, fileKeys)
      }
      
      setBills([])
      if (onUploadSuccess) {
        onUploadSuccess()
      } else {
        window.location.reload()
      }

    } catch (err) {
      console.error(err)
      alert("Failed to upload receipt.")
    } finally {
      setIsUploading(false)
    }
  }

  const handleView = async () => {
    if (!existingKeys || existingKeys.length === 0) return
    setIsViewing(true)
    try {
      const results = await getViewUrls(existingKeys)
      results.forEach(res => {
        window.open(res.url, "_blank")
      })
    } catch (error) {
      console.error("View bills error:", error)
      alert("Failed to fetch bill urls.")
    } finally {
      setIsViewing(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 w-max">
      {existingKeys && existingKeys.length > 0 ? (
        <button 
          onClick={handleView}
          disabled={isViewing}
          className="text-xs flex items-center justify-center gap-1.5 text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors font-bold shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          {isViewing ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
          View {existingKeys.length} Bill{existingKeys.length !== 1 ? 's' : ''}
        </button>
      ) : (
        <div className="flex flex-col items-center gap-2 w-full">
          {bills.length === 0 ? (
            <label className="text-xs flex items-center justify-center gap-1.5 text-slate-600 hover:text-slate-800 bg-white border border-dashed border-slate-300 hover:border-slate-400 px-3 py-1.5 rounded-lg cursor-pointer transition-all font-bold shadow-sm whitespace-nowrap outline-none focus-within:ring-2 focus-within:ring-emerald-500/20">
              <Paperclip size={14} className="text-slate-400" />
              Attach Bill
              <input 
                ref={fileInputRef}
                type="file" 
                multiple 
                accept="image/*,application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          ) : (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 p-1.5 rounded-lg shadow-sm">
              <div className="flex flex-col gap-1 px-1 max-h-32 overflow-y-auto custom-scrollbar min-w-35">
                {bills.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 bg-white border border-slate-200 px-2 py-1 rounded text-[10px] text-slate-600 group">
                    <span className="truncate max-w-30 font-medium" title={file.name}>{file.name}</span>
                    <button 
                      onClick={() => removeFile(idx)} 
                      className="text-slate-400 hover:text-rose-500 transition-colors focus:outline-none"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <label className="text-[9px] text-indigo-600 font-bold px-1 mt-0.5 hover:underline cursor-pointer block w-max">
                  + Add another
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    multiple 
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>

              <button 
                onClick={handleUpload}
                disabled={isUploading}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-md disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5 shrink-0 font-bold whitespace-nowrap self-stretch shadow-sm outline-none focus:ring-2 focus:ring-emerald-500/50"
              >
                {isUploading ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                {isUploading ? 'Saving...' : 'Upload'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}