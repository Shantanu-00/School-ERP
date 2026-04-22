const fs = require('fs');
const actionsFile = 'src/actions/student.actions.ts';
const content = \

export async function addFormerStudent(formData: FormData): Promise<void> {
  const normalizeOptional = (value: FormDataEntryValue | null): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  };

  const fail = (message: string): never => {
    import('next/navigation').then((m) => m.redirect('/students/former-students/new?error=' + encodeURIComponent(message)));
    throw new Error(message);
  };

  // Core Student Fields
  const status = normalizeOptional(formData.get('status')) || 'Alumni';
  const first_name = normalizeOptional(formData.get('first_name'));
  const last_name = normalizeOptional(formData.get('last_name'));
  const admission_number = normalizeOptional(formData.get('admission_number'));
  const dob = normalizeOptional(formData.get('dob'));
  const gender = normalizeOptional(formData.get('gender'));
  const date_of_admission = normalizeOptional(formData.get('date_of_admission'));
  const primary_contact_number = normalizeOptional(formData.get('primary_contact_number'));

  // Enrollment fields
  const academic_year_id = normalizeOptional(formData.get('academic_year_id'));
  const class_id = normalizeOptional(formData.get('class_id'));
  const roll_number = parseInt(formData.get('roll_number') as string, 10) || 0;

  // Financial fields
  const pending_arrears = parseFloat(formData.get('pending_arrears') as string) || 0.00;
  const pocket_money_amount = parseFloat(formData.get('pocket_money_amount') as string) || 0.00;
  const pocket_money_type = formData.get('pocket_money_type') as string || 'CREDIT';

  if (!first_name || !last_name || !admission_number || !dob) {
    fail('First name, Last name, Admission number, and Date of Birth are required.');
  }

  if (!academic_year_id || !class_id) {
    fail('Last Academic Year and Class are required.');
  }

  const { createClient } = require('@/lib/supabase/server');
  // Wait we can't require like this easily inside a server action string. 
  // Let's use the createClient that is already imported at the top of the file!
  // Supabase is already imported as \import { createClient } from '@/lib/supabase/server'\

  const supabase = await createClient();

  // Validate permission (Admin or Accountant)
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.id) return fail('Please login and try again.');

  const { data: staffData } = await supabase
    .from('staff')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle();

  if (staffData?.role !== 'Admin' && staffData?.role !== 'Accountant') {
    fail('Unauthorized to add former students.');
  }

  // DUPLICATE CHECK: Name + DOB combination OR Admission number
  const { data: existingStudent } = await supabase
    .from('students')
    .select('id')
    .or(\\\dmission_number.eq.\,and(first_name.ilike.\,last_name.ilike.\,dob.eq.\)\\\)
    .maybeSingle();

  if (existingStudent) {
    fail('A student with the same admission number or exact name/DOB already exists.');
  }

  // 1. Insert Student Record 
  const { data: studentRecord, error: studentError } = await supabase
    .from('students')
    .insert([
      {
        admission_number,
        first_name,
        last_name,
        dob,
        status,
        gender,
        date_of_admission,
        primary_contact_number
      }
    ])
    .select()
    .single();

  if (studentError) {
    console.error("Student insert failed:", studentError);
    fail(studentError.message);
  }

  // 2. Insert corresponding Student Enrollment Profile
  const { data: enrollmentRecord, error: enrollmentError } = await supabase
    .from('student_enrollments')
    .insert([
      {
        student_id: studentRecord.id,
        academic_year_id,
        class_id,
        roll_number,
        discount_type: 'None',
        discount_mode: 'Percentage',
        discount_value: 0
      }
    ])
    .select()
    .single();

  if (enrollmentError) {
    console.error("Enrollment failed. Rolling back profile creation:", enrollmentError.message);
    await supabase.from('students').delete().eq('id', studentRecord.id);
    fail(\\\Enrollment initialization failed: \\\\);
  }

  // 3. Generate Previous Year Arrears Invoice
  if (pending_arrears > 0) {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    const { error: arrearsError } = await supabase
      .from('fee_invoices')
      .insert({
        student_id: studentRecord.id,
        enrollment_id: enrollmentRecord.id,
        invoice_title: 'Past Arrears',
        total_amount: pending_arrears,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'Unpaid',
        created_by: staffData ? staffData.id : null
      });

    if (arrearsError) {
      console.error("Arrears invoice generation failed:", arrearsError.message);
    }
  }

  // 4. Generate Pocket Money Transactions
  if (pocket_money_amount > 0) {
    const { error: pocketMoneyError } = await supabase
      .from('pocket_money_transactions')
      .insert({
        student_id: studentRecord.id,
        transaction_type: pocket_money_type,
        amount: pocket_money_amount,
        description: pocket_money_type === 'CREDIT' ? 'Pending Pocket Money to be returned' : 'Pending Pocket Money owed by student',
        logged_by: staffData ? staffData.id : null
      });

    if (pocketMoneyError) {
      console.error("Pocket money deposit failed:", pocketMoneyError.message);
    }
  }

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/students/former-students');
  
  const { redirect } = await import('next/navigation');
  redirect('/students/former-students');
}
\;

fs.appendFileSync(actionsFile, content, 'utf8');
console.log('Appended successfully.');
