import { getFormerStudents } from '@/actions/student.actions'
import { SearchInput } from '@/components/ui/SearchInput'
import Link from 'next/link'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { FilterForm } from './FilterForm'

export default async function FormerStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ 
    query?: string; 
    page?: string; 
    status?: string; 
    sortBy?: string; 
    sortOrder?: string; 
    limit?: string;
    feesStatus?: string;
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
    feesStatus
  })

  // We should also pass feesStatus to pagination URLs
  const getSortLink = (col: string) => {
    const isCurrentSort = sortBy === col
    const newOrder = isCurrentSort && sortOrder === 'asc' ? 'desc' : 'asc'
    const searchParams = new URLSearchParams()
    if (query) searchParams.set('query', query)
    if (status !== 'Both') searchParams.set('status', status)
    if (feesStatus !== 'All') searchParams.set('feesStatus', feesStatus)
    if (limit !== 20) searchParams.set('limit', limit.toString())
    searchParams.set('sortBy', col)
    searchParams.set('sortOrder', newOrder)
    return `/students/former-students?${searchParams.toString()}`
  }

  const getSortIcon = (col: string) => {
    if (sortBy !== col) return null
    return sortOrder === 'asc' ? <ChevronUp className="w-4 h-4 inline-block" /> : <ChevronDown className="w-4 h-4 inline-block" />
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Former Students</h1>
          <p className="text-sm text-gray-500">Historical records of Alumni and Dropouts.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center flex-wrap">
        <div className="w-75">
          <SearchInput placeholder="Search by name or admission no..." />
        </div>

        {/* Status Filter */}
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

      <div className="border rounded-lg overflow-x-auto bg-white shadow-sm">
        <table className="w-full text-left text-sm whitespace-nowrap min-w-20">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-600 hover:text-gray-900">
                <Link href={getSortLink('admission_number')} className="flex items-center gap-1">
                  Admission No {getSortIcon('admission_number')}
                </Link>
              </th>
              <th className="p-4 font-medium text-gray-600 hover:text-gray-900">
                <Link href={getSortLink('name')} className="flex items-center gap-1">
                  Name {getSortIcon('name')}
                </Link>
              </th>
              <th className="p-4 font-medium text-gray-600">Last Known Class</th>
              <th className="p-4 font-medium text-gray-600 hover:text-gray-900">
                <Link href={getSortLink('passout_year')} className="flex items-center gap-1">
                  Passout Year <span className="font-normal text-xs text-gray-400 block">(Last Enrolled Year)</span> {getSortIcon('passout_year')}
                </Link>
              </th>
              <th className="p-4 font-medium text-gray-600">Status</th>
              <th className="p-4 font-medium text-gray-600 hover:text-gray-900">
                <Link href={getSortLink('dues')} className="flex items-center gap-1">
                  Pending Dues {getSortIcon('dues')}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {!students || students.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">No former students found matching your criteria.</td>
              </tr>
            ) : (
              students.map((student: any) => (
                <tr key={student.id} className="border-b hover:bg-gray-50 transition">
                  <td className="p-4 text-gray-600 font-medium">{student.admission_number}</td>
                  <td className="p-4 font-medium text-gray-900">
                    <Link href={`/students/${student.id}`} className="hover:text-blue-600 transition underline underline-offset-2">
                      {student.first_name} {student.last_name}
                    </Link>
                  </td>
                  <td className="p-4 text-gray-600">
                    {student.lastKnownClass}
                  </td>
                  <td className="p-4 text-gray-600">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded-sm text-xs font-semibold">
                      {student.passoutYear}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${student.status === 'Alumni' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                      {student.status}
                    </span>
                  </td>
                  <td className="p-4">
                    {student.pendingDues > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-red-600 font-semibold">Yes / ₹{student.pendingDues.toLocaleString('en-IN')}</span>
                      </div>
                    ) : (
                      <span className="text-emerald-600 font-medium">No / Cleared</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50">
            <span className="text-sm text-gray-500">
              Showing <span className="font-medium">{(currentPage - 1) * limit + 1}</span> to <span className="font-medium">{Math.min(currentPage * limit, totalCount || 0)}</span> of <span className="font-medium">{totalCount}</span> results
            </span>
            <div className="flex items-center gap-2">
              <Link 
                href={`/students/former-students?page=${Math.max(1, currentPage - 1)}&query=${query}&status=${status}&feesStatus=${feesStatus}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`}
                className={`px-3 py-1.5 rounded text-sm font-medium border ${currentPage === 1 ? 'pointer-events-none opacity-50 bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                Previous
              </Link>
              
              <div className="flex items-center">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = currentPage;
                  if (currentPage <= 3) pageNum = i + 1;
                  else if (currentPage >= totalPages - 2) pageNum = totalPages - 4 + i;
                  else pageNum = currentPage - 2 + i;
                  
                  if (pageNum < 1 || pageNum > totalPages) return null;

                  return (
                    <Link
                      key={pageNum}
                      href={`/students/former-students?page=${pageNum}&query=${query}&status=${status}&feesStatus=${feesStatus}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`}
                      className={`px-3 py-1.5 text-sm font-medium ${currentPage === pageNum ? 'bg-blue-50 text-blue-700 border-blue-200 border rounded-md' : 'text-gray-600 hover:text-gray-900 px-3'}`}
                    >
                      {pageNum}
                    </Link>
                  );
                })}
              </div>

              <Link 
                href={`/students/former-students?page=${Math.min(totalPages, currentPage + 1)}&query=${query}&status=${status}&feesStatus=${feesStatus}&limit=${limit}&sortBy=${sortBy}&sortOrder=${sortOrder}`}
                className={`px-3 py-1.5 rounded text-sm font-medium border ${currentPage === totalPages ? 'pointer-events-none opacity-50 bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
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
