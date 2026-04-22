'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function setGlobalAcademicYear(yearId: string) {
  const cookieStore = await cookies()
  
  cookieStore.set('academic_year_id', yearId, { 
    maxAge: 30 * 24 * 60 * 60,
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production'
  })
  
  revalidatePath('/', 'layout') 
}

export async function addAcademicYear(formData: FormData) {
  const name = formData.get('name') as string
  const start_date = formData.get('start_date') as string
  const end_date = formData.get('end_date') as string

  if (!name || !start_date || !end_date) {
    return { error: 'All fields are required.' }
  }

  const supabase = await createClient()

  // Must ensure only Admins can create it
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (staffData?.role !== 'Admin') {
    return { error: 'Only Admins can perform this action' }
  }

  // DUPLICATE CHECK
  const { data: existingYear } = await supabase
    .from('academic_years')
    .select('id')
    .ilike('name', name.trim())
    .maybeSingle()

  if (existingYear) {
    return { error: 'An academic year with this name already exists.' }
  }

  const { error } = await supabase
    .from('academic_years')
    .insert([{
      name: name.trim(),
      start_date,
      end_date,
      is_active: true // New ones default to active for convenience
    }])

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/', 'layout')

  return { success: true }
}

export async function toggleAcademicYearStatus(yearId: string, newStatus: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffData } = await supabase.from('staff').select('role').eq('auth_id', user.id).single()
  if (staffData?.role !== 'Admin') return { error: 'Only Admins can perform this action' }

  const { error } = await supabase
    .from('academic_years')
    .update({ is_active: newStatus })
    .eq('id', yearId)

  if (error) return { error: error.message }

  revalidatePath('/settings/academic-years')
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function addClass(formData: FormData) {
  const grade_level = formData.get('grade_level') as string
  const section = formData.get('section') as string

  if (!grade_level || !section) {
    return { error: 'Grade level and section are required.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffData } = await supabase
    .from('staff')
    .select('role')
    .eq('auth_id', user.id)
    .single()

  if (staffData?.role !== 'Admin') {
    return { error: 'Only Admins can perform this action' }
  }

  // DUPLICATE CHECK
  const { data: existingClass } = await supabase
    .from('classes')
    .select('id')
    .ilike('grade_level', grade_level.trim())
    .ilike('section', section.trim())
    .maybeSingle()

  if (existingClass) {
    return { error: 'This class and section combination already exists.' }
  }

  const { error } = await supabase
    .from('classes')
    .insert([{
      grade_level: grade_level.trim(),
      section: section.trim()
    }])

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function addFeeConfiguration(formData: FormData) {
  const academic_year_id = formData.get('academic_year_id') as string
  const class_id = formData.get('class_id') as string
  const gender = formData.get('gender') as string || 'All'
  const course_stream = formData.get('course_stream') as string || 'General'
  const base_fee_amount = parseFloat(formData.get('base_fee_amount') as string)

  if (!academic_year_id || !class_id || isNaN(base_fee_amount)) {
    return { error: 'Academic year, class, and valid fee amount are required.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (staffData?.role !== 'Admin') {
    return { error: 'Only Admins can perform this action' }
  }

  // DUPLICATE CHECK
  const { data: existingConfig } = await supabase
    .from('fee_configurations')
    .select('id')
    .eq('academic_year_id', academic_year_id)
    .eq('class_id', class_id)
    .eq('gender', gender)
    .eq('course_stream', course_stream)
    .maybeSingle()

  if (existingConfig) {
    return { error: 'A fee configuration for this combination already exists.' }
  }

  const { error } = await supabase
    .from('fee_configurations')
    .insert([{
      academic_year_id,
      class_id,
      gender,
      course_stream,
      base_fee_amount,
      logged_by: staffData.id
    }])

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}