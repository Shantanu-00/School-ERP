import { NextRequest, NextResponse } from 'next/server'
import { getExpenses, getOtherIncome, getExpenseAuditLogs } from '@/actions/expenses.actions'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const yearId = searchParams.get('yearId')
  const type = searchParams.get('type')

  if (!yearId) return NextResponse.json({ error: 'yearId required' }, { status: 400 })

  if (type === 'expenses') {
    const result = await getExpenses(yearId)
    return NextResponse.json(result)
  }
  if (type === 'income') {
    const result = await getOtherIncome(yearId)
    return NextResponse.json(result)
  }
  if (type === 'audit') {
    const result = await getExpenseAuditLogs(yearId)
    return NextResponse.json(result)
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
