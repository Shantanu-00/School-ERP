import { NextRequest, NextResponse } from 'next/server'
import { getPayrollForMonth, getAllTeachers } from '@/actions/payroll.actions'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const month = searchParams.get('month')
  const list = searchParams.get('list')

  if (list === 'teachers') {
    const result = await getAllTeachers()
    return NextResponse.json(result)
  }

  if (!month) {
    return NextResponse.json({ error: 'month parameter is required' }, { status: 400 })
  }

  const result = await getPayrollForMonth(month)
  return NextResponse.json(result)
}
