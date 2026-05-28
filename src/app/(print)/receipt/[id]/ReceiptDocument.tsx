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
    fee_particular: string
    amount_paid: number
    pending_fee_balance: number
    pocket_money_balance: number
    payment_mode: string
    bank_name: string
    utr_number: string
    amount_in_words: string
    received_by: string
    is_pending_clearance: boolean
  }
}

export function ReceiptDocument({ data }: Props) {
  useEffect(() => {
    document.title = `Receipt ${data.receipt_number} - ${data.student_name}`
  }, [data.receipt_number, data.student_name])

  const INR = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 2 })

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
        {/* Print toolbar */}
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

        {/* A5 Receipt */}
        <div style={{ width: '148mm', maxWidth: '100%', border: '2px solid #000', fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", fontSize: '9pt', lineHeight: 1.3, color: '#000', background: '#fff' }}>
          {/* School Header */}
          <div style={{ borderBottom: '2px solid #000', padding: '10px', textAlign: 'center' }}>
            <div style={{ margin: '0 0 3px 0', fontSize: '14pt', letterSpacing: '0.5px', textTransform: 'uppercase', fontWeight: 'bold' }}>
              Royal Officer&apos;s Preparatory Academy
            </div>
            <div style={{ fontSize: '8pt' }}>Jr. College | Dandoba Hills Khanderajuri, Tal-Miraj, Sangli</div>
          </div>

          {/* Contact */}
          <div style={{ borderBottom: '1px solid #000', padding: '4px', fontSize: '7.5pt', textAlign: 'center' }}>
            Ph: +91 9689028835 | +91 9860277924
          </div>

          {/* Receipt No / Title / Date */}
          <div style={{ borderBottom: '1px solid #000', display: 'flex' }}>
            <div style={{ flex: 1, padding: '5px 10px', fontWeight: 'bold' }}>Receipt No: {data.receipt_number}</div>
            <div style={{ flex: 1, padding: '5px 10px', fontWeight: 'bold', textAlign: 'center', textTransform: 'uppercase' }}>FEE RECEIPT</div>
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

          {/* Fee Table */}
          <div style={{ borderBottom: '1px solid #000' }}>
            {/* Header */}
            <div style={{ display: 'flex', borderBottom: '1px solid #000', background: '#f2f2f2', fontSize: '8.5pt', fontWeight: 'bold' }}>
              <div style={{ width: '10%', padding: '6px 10px', borderRight: '1px solid #000', textAlign: 'center' }}>S.No.</div>
              <div style={{ width: '65%', padding: '6px 10px', borderRight: '1px solid #000' }}>Particulars</div>
              <div style={{ width: '25%', padding: '6px 10px', textAlign: 'right' }}>Amount (Rs)</div>
            </div>
            {/* Row */}
            <div style={{ display: 'flex' }}>
              <div style={{ width: '10%', padding: '6px 10px', borderRight: '1px solid #000', textAlign: 'center' }}>1</div>
              <div style={{ width: '65%', padding: '6px 10px', borderRight: '1px solid #000' }}>{data.fee_particular}</div>
              <div style={{ width: '25%', padding: '6px 10px', textAlign: 'right' }}>{INR(data.amount_paid)}</div>
            </div>
            {/* Total */}
            <div style={{ display: 'flex', borderTop: '1px solid #000', background: '#f2f2f2', fontWeight: 'bold' }}>
              <div style={{ width: '75%', padding: '6px 10px', borderRight: '1px solid #000', textAlign: 'right' }}>Grand Total Paid</div>
              <div style={{ width: '25%', padding: '6px 10px', textAlign: 'right' }}>{INR(data.amount_paid)}</div>
            </div>
          </div>

          {/* Balance Row */}
          <div style={{ borderBottom: '1px solid #000', display: 'flex' }}>
            <div style={{ flex: 1, padding: '6px 10px', borderRight: '1px solid #000', display: 'flex', justifyContent: 'space-between' }}>
              <strong>Pending Fees (Due):</strong>
              <strong>Rs {INR(data.pending_fee_balance)}</strong>
            </div>
            <div style={{ flex: 1, padding: '6px 10px', display: 'flex', justifyContent: 'space-between' }}>
              <strong>Pocket Money A/c Bal:</strong>
              <strong>Rs {INR(data.pocket_money_balance)}</strong>
            </div>
          </div>

          {/* Clearance Note */}
          {data.is_pending_clearance && (
            <div style={{ borderBottom: '1px solid #000', padding: '4px 10px', fontSize: '7.5pt', fontStyle: 'italic', textAlign: 'center' }}>
              * Subject to clearance of cheque / bank transfer. Pending dues shown after deduction.
            </div>
          )}

          {/* Payment Details */}
          <div style={{ borderBottom: '1px solid #000', padding: '8px 10px' }}>
            <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Amount in Words: Rupees {data.amount_in_words} Only</div>
            <div>
              <strong>Payment Mode:</strong> {data.payment_mode} &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Bank:</strong> {data.bank_name} &nbsp;&nbsp;|&nbsp;&nbsp;
              <strong>Ref/UTR No:</strong> {data.utr_number}
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
              1. Valid subject to cheque clearance.<br/>
              2. Fees once paid are non-refundable.<br/>
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
