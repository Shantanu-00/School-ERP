'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

interface GetStudentsParams {
  query?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export async function getStudents({
  query = '',
  status = 'Active',
  page = 1,
  limit = 10
}: GetStudentsParams) {
  // Await the client if your server.ts implementation requires it, otherwise just call it.
  const supabase = await createClient() 
  const cookieStore = await cookies()
  const yearId = cookieStore.get('academic_year_id')?.value

  if (!yearId) {
    return { students: [], totalPages: 0, error: "No Academic Year Selected" }
  }

  const from = (page - 1) * limit
  const to = from + limit - 1

  let dbQuery = supabase
    .from('students')
    .select(`
      id, admission_number, first_name, last_name, dob, status,
      student_enrollments!inner (
        roll_number,
        academic_year_id,
        classes (grade_level, section)
      )
    `, { count: 'exact' })
    .eq('student_enrollments.academic_year_id', yearId)
    .eq('status', status)

  if (query) {
    dbQuery = dbQuery.or(
      `first_name.ilike.%${query}%,last_name.ilike.%${query}%,admission_number.ilike.%${query}%`
    )
  }

  const { data, count, error } = await dbQuery
    .order('first_name', { ascending: true })
    .range(from, to)

  if (error) {
    console.error('Error fetching students:', error.message)
    throw new Error('Failed to fetch students')
  }

  return { students: data, totalPages: Math.ceil((count || 0) / limit) }
}