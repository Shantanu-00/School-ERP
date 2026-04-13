import { getStudents } from '@/actions/student.actions'
import { SearchInput } from '@/components/ui/SearchInput'
import Link from 'next/link'

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string; status?: string }
}) {
  const query = searchParams?.query || ''
  const currentPage = Number(searchParams?.page) || 1
  const status = searchParams?.status || 'Active'

  const { students, totalPages, error } = await getStudents({ 
    query, 
    page: currentPage, 
    status 
  })

  // Simulated RBAC check - replace with your actual `get_user_role()` context
  const userRole = 'Admin'; 
  const canViewFees = ['Admin', 'Accountant'].includes(userRole);

  if (error) {
    return (
      <div className="p-6 text-center text-red-500">
        <h2 className="text-lg font-semibold">Please select an Academic Year from the Sidebar.</h2>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Active Students</h1>
          <p className="text-sm text-gray-500">Manage currently enrolled students.</p>
        </div>
        <Link 
          href="/students/new" 
          className="bg-blue-600 text-white px-4 py-2 text-sm font-medium rounded-md hover:bg-blue-700 transition"
        >
          + Add Student
        </Link>
      </div>

      <div className="flex gap-4 items-center">
        <SearchInput placeholder="Search name, admission no..." />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">Roll No</th>
              <th className="p-4 font-medium text-gray-500">Name</th>
              <th className="p-4 font-medium text-gray-500">Class</th>
              <th className="p-4 font-medium text-gray-500">Status</th>
              {canViewFees && <th className="p-4 font-medium text-gray-500">Fees</th>}
            </tr>
          </thead>
          <tbody>
            {students?.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">No students found.</td>
              </tr>
            ) : (
              students?.map((student: any) => {
                const enrollment = student.student_enrollments[0];
                const grade = enrollment?.classes?.grade_level;
                const section = enrollment?.classes?.section;

                return (
                  <tr key={student.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-600">{enrollment?.roll_number}</td>
                    <td className="p-4 font-medium text-blue-600">
                      <Link href={`/students/${student.id}`}>
                        {student.first_name} {student.last_name}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-600">{grade} - {section}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
                        {student.status}
                      </span>
                    </td>
                    {canViewFees && (
                      <td className="p-4">
                        <Link href={`/finance/invoices?student_id=${student.id}`} className="text-sm text-blue-500 hover:underline">
                          Ledger
                        </Link>
                      </td>
                    )}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}