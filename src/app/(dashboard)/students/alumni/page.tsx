import { getStudents } from '@/actions/student.actions'
import { SearchInput } from '@/components/ui/SearchInput'
import Link from 'next/link'

export default async function AlumniPage({
  searchParams,
}: {
  searchParams: { query?: string; page?: string }
}) {
  const query = searchParams?.query || ''
  const currentPage = Number(searchParams?.page) || 1

  // Force the status to 'Alumni'
  const { students, totalPages, error } = await getStudents({ 
    query, 
    page: currentPage, 
    status: 'Alumni' 
  })

  if (error) {
    return <div className="p-6 text-center text-red-500">Please select an Academic Year.</div>
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Alumni Directory</h1>
          <p className="text-sm text-gray-500">Historical records of past students.</p>
        </div>
      </div>

      <div className="flex gap-4 items-center">
        <SearchInput placeholder="Search alumni by name..." />
      </div>

      <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="p-4 font-medium text-gray-500">Admission No</th>
              <th className="p-4 font-medium text-gray-500">Name</th>
              <th className="p-4 font-medium text-gray-500">Last Known Class</th>
              <th className="p-4 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {students?.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">No alumni found.</td>
              </tr>
            ) : (
              students?.map((student: any) => {
                const enrollment = student.student_enrollments[0];
                return (
                  <tr key={student.id} className="border-b hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-600">{student.admission_number}</td>
                    <td className="p-4 font-medium text-gray-900">
                      <Link href={`/students/${student.id}`} className="hover:text-blue-600 transition">
                        {student.first_name} {student.last_name}
                      </Link>
                    </td>
                    <td className="p-4 text-gray-600">
                      {enrollment?.classes?.grade_level} - {enrollment?.classes?.section}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                        Alumni
                      </span>
                    </td>
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