'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

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