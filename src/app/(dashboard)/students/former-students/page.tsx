import { getFormerStudents } from '@/actions/student.actions'
import { SearchInput } from '@/components/ui/SearchInput'
import Link from 'next/link'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { FilterForm } from './FilterForm'
import { createClient } from '@/lib/supabase/server'

export default async function FormerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    query?: string
    page?: string
    status?: string
    sortBy?: string
    sortOrder?: string
    limit?: string
    feesStatus?: string
  }>
}) {
  const resolvedParams = await searchParams
  const query = resolvedParams?.query || ''
  const currentPage = Number(resolvedParams?.page) || 1
  const limit = Number(resolvedParams?.limit) || 20
  const status = resolvedParams?.status || 'Both'
  const feesStatus = resolvedParams?.feesStatus || 'All'
  const sortBy = resolvedParams?.sortBy || 'name'
  const sortOrder = (resolvedParams?.sortOrder as 'asc' | 'desc') || 'asc'

  const { students, totalPages, totalCount, error } = await getFormerStudents({
    query,
    status,
    page: currentPage,
    limit,
    sortBy,
    sortOrder,
    feesStatus,
  })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let canAdd = false
  if (user) {
    const { data: staff } = await supabase.from('staff').select('role').eq('auth_id', user.id).maybeSingle()
    canAdd = staff?.role === 'Admin' || staff?.role === 'Accountant'
  }

  const getSortLink = (col: string) => {
    const isCurrentSort = sortBy === col
    const newOrder = isCurrentSort && sortOrder === 'asc' ? 'desc' : 'asc'
    const sp = new URLSearchParams()
    if (query) sp.set('query', query)
    if (status !== 'Both') sp.set('status', status)
    if (feesStatus !== 'All') sp.set('feesStatus', feesStatus)
    if (limit !== 20) sp.set('limit', limit.toString())
    sp.set('sortBy', col)
    sp.set('sortOrder', newOrder)
    return `/students/former-students?${sp.toString()}`
  }

  const getSortIcon = (col: string) => {
    if (sortBy !== col) return null
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3.5 h-3.5 inline-block" />
      : <ChevronDown className="w-3.5 h-3.5 inline-block" />
  }

  const pageUrl = (p: number) =>
    `/students/former-students?page=${p}&query=${query}&status=${status}&feesStatus=${feesStatus}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Former Students</h1>
          <p className="text-sm text-gray-500">Historical records of Alumni and Dropouts.</p>
        </div>
        {canAdd && (
          <Link
            href="/students/former-students/new"
            className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-blue-700 transition"
          >
            + Add Former Student
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="w-75">
          <SearchInput placeholder="Search by name or admission no..." />
        </div>
        <FilterForm
          status={status}
          limit={limit}
          query={query}
          sortBy={sortBy}
          sortOrder={sortOrder}
          feesStatus={feesStatus}
        />
      </div>

      {error && (
        <div className="p-4 rounded-md bg-red-50 text-red-600 text-sm">
          Failed to load students: {error}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">
                <Link href={getSortLink('name')} className="flex items-center gap-1 hover:text-gray-800">
                  Student {getSortIcon('name')}
                </Link>
              </th>
              <th className="p-4 font-medium text-gray-500">Last Known Class</th>
              <th className="p-4 font-medium text-gray-500">
                <Link href={getSortLink('passout_year')} className="flex items-center gap-1 hover:text-gray-800">
                  Passout Year {getSortIcon('passout_year')}
                </Link>
              </th>
              <th className="p-4 font-medium text-gray-500">
                <Link href={getSortLink('dues')} className="flex items-center gap-1 hover:text-gray-800">
                  Pending Dues {getSortIcon('dues')}
                </Link>
              </th>
              <th className="p-4 font-medium text-gray-500 whitespace-nowrap">Wallet</th>
              <th className="p-4 font-medium text-gray-500 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!students || students.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No former students found matching your criteria.
                </td>
              </tr>
            ) : (
              students.map((student: any) => (
                <tr key={student.id} className="border-b hover:bg-gray-50 transition">
                  {/* Student cell — name + admission no + status badge, mirrors active students */}
                  <td className="p-4 align-middle w-1/4">
                    <div className="flex flex-col items-start gap-0.5">
                      <Link
                        href={`/students/${student.id}`}
                        className="font-bold text-[16px] leading-tight text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {student.first_name} {student.last_name}
                      </Link>
                      {student.admission_number && (
                        <span className="text-[10px] text-gray-500 font-medium tracking-wider uppercase">
                          #{student.admission_number}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.5 mt-0.5 rounded text-[9px] font-bold shadow-sm uppercase tracking-wider border w-max ${
                          student.status === 'Alumni'
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-orange-50 text-orange-700 border-orange-200'
                        }`}
                      >
                        {student.status}
                      </span>
                    </div>
                  </td>

                  {/* Last known class */}
                  <td className="p-4 text-gray-600 align-middle font-medium">
                    {student.lastKnownClass}
                  </td>

                  {/* Passout year */}
                  <td className="p-4 align-middle">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-semibold">
                      {student.passoutYear}
                    </span>
                  </td>

                  {/* Pending dues */}
                  <td className="p-4 align-middle">
                    <Link
                      href={`/students/${student.id}/fees`}
                      className="hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors flex flex-col justify-center gap-1 border border-transparent hover:border-gray-200"
                    >
                      {student.pendingDues > 0 ? (
                        <span className="text-[11px] flex items-center gap-1.5 text-red-600 font-semibold tracking-wide bg-red-50 px-2 py-0.5 rounded-md w-max border border-red-100">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                          ₹{Number(student.pendingDues).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-md text-[10px] w-max font-bold tracking-widest uppercase shadow-sm">
                          CLEARED
                        </span>
                      )}
                    </Link>
                  </td>

                  {/* Wallet */}
                  <td className="p-4 align-middle">
                    <Link
                      href={`/students/${student.id}/pocket-money`}
                      className="hover:bg-gray-50 p-2 -ml-2 rounded-lg transition-colors flex flex-col justify-center gap-1 border border-transparent hover:border-gray-200"
                    >
                      <span
                        className={`font-bold tracking-tight text-[15px] ${
                          student.walletBalance > 0
                            ? 'text-emerald-600'
                            : student.walletBalance < 0
                            ? 'text-red-600'
                            : 'text-gray-400'
                        }`}
                      >
                        ₹{Number(student.walletBalance).toLocaleString('en-IN')}
                      </span>
                    </Link>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-center align-middle">
                    <Link
                      href={`/students/${student.id}`}
                      className="text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-50 font-medium text-gray-700 transition"
                    >
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50">
            <span className="text-sm text-gray-500">
              Showing{' '}
              <span className="font-medium">{(currentPage - 1) * limit + 1}</span>–
              <span className="font-medium">{Math.min(currentPage * limit, totalCount || 0)}</span> of{' '}
              <span className="font-medium">{totalCount}</span> results
            </span>
            <div className="flex items-center gap-2">
              <Link
                href={pageUrl(Math.max(1, currentPage - 1))}
                className={`px-3 py-1.5 rounded text-sm font-medium border ${
                  currentPage === 1
                    ? 'pointer-events-none opacity-50 bg-gray-100 text-gray-400'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Previous
              </Link>
              <div className="flex items-center">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let p = currentPage
                  if (currentPage <= 3) p = i + 1
                  else if (currentPage >= totalPages - 2) p = totalPages - 4 + i
                  else p = currentPage - 2 + i
                  if (p < 1 || p > totalPages) return null
                  return (
                    <Link
                      key={p}
                      href={pageUrl(p)}
                      className={`px-3 py-1.5 text-sm font-medium ${
                        currentPage === p
                          ? 'bg-blue-50 text-blue-700 border-blue-200 border rounded-md'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {p}
                    </Link>
                  )
                })}
              </div>
              <Link
                href={pageUrl(Math.min(totalPages, currentPage + 1))}
                className={`px-3 py-1.5 rounded text-sm font-medium border ${
                  currentPage === totalPages
                    ? 'pointer-events-none opacity-50 bg-gray-100 text-gray-400'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Next
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
