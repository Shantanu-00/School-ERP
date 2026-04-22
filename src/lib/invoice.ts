export type DiscountMode = 'Percentage' | 'Fixed'

type BuildInvoiceTitleParams = {
  academicYearName?: string | null
  gradeLevel?: string | null
  section?: string | null
  courseStream?: string | null
  invoiceType?: string
}

export function applyDiscount(baseFee: number, discountMode: string | null | undefined, discountValue: number) {
  if (!Number.isFinite(baseFee)) return 0

  const normalizedDiscount = Number.isFinite(discountValue) ? discountValue : 0
  if (normalizedDiscount <= 0) return Math.max(0, baseFee)

  let finalFee = baseFee
  if (discountMode === 'Percentage') {
    finalFee = finalFee - (finalFee * (normalizedDiscount / 100))
  } else {
    finalFee = finalFee - normalizedDiscount
  }

  return Math.max(0, finalFee)
}

export function buildInvoiceTitle({
  academicYearName,
  gradeLevel,
  section,
  courseStream,
  invoiceType = 'Tuition Fee'
}: BuildInvoiceTitleParams) {
  const parts: string[] = [invoiceType]

  const className = [gradeLevel, section].filter(Boolean).join('-').trim()
  if (className) {
    parts.push(className)
  }

  if (academicYearName) {
    parts.push(`AY ${academicYearName}`)
  }

  if (courseStream && courseStream !== 'General') {
    parts.push(courseStream)
  }

  return parts.join(' | ')
}

export function selectFeeConfigurationByGender<T extends { gender?: string | null }>(
  configs: T[],
  studentGender?: string | null
) {
  const gender = studentGender || 'All'
  return configs.find((config) => config.gender === gender) || configs.find((config) => config.gender === 'All') || null
}
