'use client'

import { useEffect } from 'react'

type Props = {
  data: {
    receipt_number: string
    receipt_date: string
    student_name: string
    student_id: string
    student_class: string
    academic_year: string
    transaction_type: 'CREDIT' | 'DEBIT'
    amount: number
    description: string
    balance_after: number | null
    payment_mode: string
    bank_name: string
    reference: string
    amount_in_words: string
    received_by: string
  }
}

export function PmReceiptDocument({ data }: Props) {
  useEffect(() => {
    document.title = `PM Receipt ${data.receipt_number} - ${data.student_name}`
  }, [data.receipt_number, data.student_name])

  const INR = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const isCredit = data.transaction_type === 'CREDIT'

  return (
    <>
      <style>{`
        @page { size: 148mm 210mm; margin: 8mm; }
        @media print {
          html, body { margin: 0; padding: 0; background: #fff; }
          .no-print { display: none !important; }
          .receipt-page { padding: 0; background: #fff; min-height: auto; }
        }
      `}</style>

      <div className="receipt-page" style={{ minHeight: '100vh', background: '#e2e8f0', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div className="no-print" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
          <button
            onClick={() => window.print()}
            style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', background: '#2563eb', color: '#fff' }}
          >
            Print / Save as PDF
          </button>
          <button
            onClick={() => window.close()}
            style={{ padding: '10px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: '1px solid #e2e8f0', background: '#fff', color: '#334155' }}
          >
            Close
          </button>
        </div>

        <div style={{ width: '148mm', maxWidth: '100%', border: '2px solid #000', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '9pt', lineHeight: 1.3, color: '#000', background: '#fff' }}>
          {/* Header */}
          <div style={{ borderBottom: '2px solid #000', padding: '10px', textAlign: 'center' }}>
            <div style={{ fontSize: '14pt', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Royal Officer&apos;s Preparatory Academy
            </div>
            <div style={{ fontSize: '8pt' }}>Jr. College | Dandoba Hills Khanderajuri, Tal-Miraj, Sangli</div>
          </div>

          <div style={{ borderBottom: '1px solid #000', padding: '4px', fontSize: '7.5pt', textAlign: 'center' }}>
            Ph: +91 9689028835 | +91 9860277924
          </div>

          {/* Receipt No / Title / Date */}
          <div style={{ borderBottom: '1px solid #000', display: 'flex' }}>
            <div style={{ flex: 1, padding: '5px 10px', fontWeight: 'bold' }}>Receipt No: {data.receipt_number}</div>
            <div style={{ flex: 1, padding: '5px 10px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>
              POCKET MONEY {isCredit ? 'DEPOSIT' : 'WITHDRAWAL'}
            </div>
            <div style={{ flex: 1, padding: '5px 10px', fontWeight: 'bold', textAlign: 'right' }}>Date: {data.receipt_date}</div>
          </div>

          {/* Student Info */}
          <div style={{ borderBottom: '1px solid #000', display: 'flex' }}>
            <div style={{ flex: 3, padding: '5px 10px', borderRight: '1px solid #000' }}><strong>Name:</strong> {data.student_name}</div>
            <div style={{ flex: 2, padding: '5px 10px' }}><strong>Class/Batch:</strong> {data.student_class}</div>
          </div>
          <div style={{ borderBottom: '1px solid #000', display: 'flex' }}>
            <div style={{ flex: 3, padding: '5px 10px', borderRight: '1px solid #000' }}><strong>Student ID:</strong> {data.student_id}</div>
            <div style={{ flex: 2, padding: '5px 10px' }}><strong>Academic Year:</strong> {data.academic_year}</div>
          </div>

          {/* Transaction Table */}
          <div style={{ borderBottom: '1px solid #000' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid #000', background: '#f2f2f2', fontSize: '8.5pt', fontWeight: 'bold' }}>
              <div style={{ width: '15%', padding: '6px 10px', borderRight: '1px solid #000', textAlign: 'center' }}>Type</div>
              <div style={{ width: '50%', padding: '6px 10px', borderRight: '1px solid #000' }}>Description</div>
              <div style={{ width: '35%', padding: '6px 10px', textAlign: 'right' }}>Amount (Rs)</div>
            </div>
            <div style={{ display: 'flex' }}>
              <div style={{ width: '15%', padding: '6px 10px', borderRight: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>
                {isCredit ? 'CR' : 'DR'}
              </div>
              <div style={{ width: '50%', padding: '6px 10px', borderRight: '1px solid #000' }}>{data.description}</div>
              <div style={{ width: '35%', padding: '6px 10px', textAlign: 'right', fontWeight: 'bold' }}>
                {isCredit ? '+' : '-'} {INR(data.amount)}
              </div>
            </div>
          </div>

          {/* Balance After */}
          <div style={{ borderBottom: '1px solid #000', padding: '8px 10px', display: 'flex', justifyContent: 'space-between', background: '#f2f2f2' }}>
            <strong>Wallet Balance After Transaction:</strong>
            <strong>Rs {data.balance_after != null ? INR(data.balance_after) : 'N/A'}</strong>
          </div>

          {/* Payment Details */}
          <div style={{ borderBottom: '1px solid #000', padding: '8px 10px' }}>
            <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Amount in Words: Rupees {data.amount_in_words} Only</div>
            <div>
              <strong>Payment Mode:</strong> {data.payment_mode} &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Bank:</strong> {data.bank_name} &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Ref/UTR:</strong> {data.reference}
            </div>
          </div>

          {/* Received By */}
          <div style={{ borderBottom: '1px solid #000', padding: '4px 10px', fontSize: '7.5pt' }}>
            <strong>Received By:</strong> {data.received_by}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', padding: '10px' }}>
            <div style={{ flex: 1, fontSize: '6.5pt', color: '#333' }}>
              <strong>Terms &amp; Conditions:</strong><br/>
              1. Pocket money is held in trust.<br/>
              2. Withdrawals only via authorized staff.<br/>
              3. System generated receipt.
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <div style={{ borderTop: '1px dashed #000', width: '80%', margin: '0 auto 3px auto' }}></div>
                <span style={{ fontSize: '8pt' }}>Cashier / Clerk</span>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ textAlign: 'center', marginTop: '40px' }}>
                <div style={{ borderTop: '1px dashed #000', width: '80%', margin: '0 auto 3px auto' }}></div>
                <span style={{ fontSize: '8pt' }}>Authorized Signatory</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
