<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
-- 1. Staff / Users (Used for Audit Trails & Digital Proof)
-- In Supabase, you often link this to the built-in auth.users, but having a dedicated staff table is best practice.
CREATE TABLE staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID UNIQUE, -- Link to Supabase Auth if needed
    name TEXT NOT NULL,
    role TEXT CHECK (role IN ('Admin', 'Accountant', 'Teacher')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Academic Years (The "Long Term Memory" backbone)
CREATE TABLE academic_years (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL, -- e.g., "2024-2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Classes
CREATE TABLE classes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    grade_level TEXT NOT NULL, -- e.g., "Grade 10"
    section TEXT NOT NULL,     -- e.g., "A"
    UNIQUE (grade_level, section)
);

-- 4. Students (Permanent Record)
CREATE TABLE students (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admission_number TEXT UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    dob DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Alumni', 'Dropout')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Student Enrollments (Year-specific data, Rollover, and Discounts)
CREATE TABLE student_enrollments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE RESTRICT,
    class_id UUID REFERENCES classes(id) ON DELETE RESTRICT,
    roll_number INTEGER NOT NULL,
    discount_type TEXT DEFAULT 'None' CHECK (discount_type IN ('None', 'RTE', 'Staff Child', 'Sibling')),
    discount_percentage NUMERIC(5,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- CRITICAL: A student can only have ONE enrollment per academic year
    UNIQUE (student_id, academic_year_id) 
);
-- 6. Fee Invoices (What is owed, tied to an enrollment year)
CREATE TABLE fee_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    enrollment_id UUID REFERENCES student_enrollments(id) ON DELETE CASCADE,
    total_amount NUMERIC(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT DEFAULT 'Unpaid' CHECK (status IN ('Unpaid', 'Partial', 'Paid', 'Cancelled')),
    invoice_file_url TEXT, -- Cloudflare Link
    created_by UUID REFERENCES staff(id), -- Digital Proof
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Fee Payments (What was actually paid)
CREATE TABLE fee_payments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES fee_invoices(id) ON DELETE CASCADE,
    amount_paid NUMERIC(10,2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method TEXT CHECK (payment_method IN ('Cash', 'Bank Transfer', 'UPI', 'Cheque')),
    logged_by UUID REFERENCES staff(id), -- Digital Proof
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Student Pocket Money Ledger (Strict transaction log, no manual overwrites)
CREATE TABLE pocket_money_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    transaction_type TEXT CHECK (transaction_type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL, -- e.g., "Canteen Lunch", "Parent Deposit"
    logged_by UUID REFERENCES staff(id), -- Digital Proof
    created_at TIMESTAMPTZ DEFAULT NOW()
);
-- 9. Teachers
CREATE TABLE teachers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    contact_info TEXT,
    base_salary NUMERIC(10,2) NOT NULL,
    hire_date DATE NOT NULL,
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Resigned', 'Terminated')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Teacher Payroll (Add-ons and Deductions)
CREATE TABLE teacher_payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    teacher_id UUID REFERENCES teachers(id) ON DELETE RESTRICT,
    month_year TEXT NOT NULL, -- e.g., "Oct-2024"
    base_amount NUMERIC(10,2) NOT NULL,
    bonus_amount NUMERIC(10,2) DEFAULT 0.00,
    deduction_amount NUMERIC(10,2) DEFAULT 0.00,
    net_paid NUMERIC(10,2) NOT NULL, -- (base + bonus) - deduction
    payment_date DATE NOT NULL,
    remarks TEXT, -- e.g., "Diwali Bonus", "2 Days Unpaid Leave"
    logged_by UUID REFERENCES staff(id), -- Digital Proof
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. General Expenses (With Cloudflare Receipts)
CREATE TABLE general_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE RESTRICT,
    category TEXT NOT NULL, -- e.g., "Maintenance", "Electricity"
    amount NUMERIC(10,2) NOT NULL,
    date_incurred DATE NOT NULL,
    description TEXT,
    receipt_file_url TEXT, -- Cloudflare Link
    logged_by UUID REFERENCES staff(id), -- Digital Proof
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE VIEW dashboard_fee_summary AS
SELECT 
    ay.name AS academic_year,
    SUM(fi.total_amount) AS total_expected,
    COALESCE(SUM(fp.amount_paid), 0) AS total_collected,
    SUM(fi.total_amount) - COALESCE(SUM(fp.amount_paid), 0) AS total_outstanding
FROM fee_invoices fi
JOIN student_enrollments se ON fi.enrollment_id = se.id
JOIN academic_years ay ON se.academic_year_id = ay.id
LEFT JOIN fee_payments fp ON fi.id = fp.invoice_id
WHERE ay.is_active = TRUE
GROUP BY ay.name;

CREATE VIEW pocket_money_balances AS
SELECT 
    student_id,
    SUM(CASE WHEN transaction_type = 'CREDIT' THEN amount ELSE 0 END) - 
    SUM(CASE WHEN transaction_type = 'DEBIT' THEN amount ELSE 0 END) AS current_balance
FROM pocket_money_transactions
GROUP BY student_id;

-- Update the staff table we created earlier
ALTER TABLE staff 
ADD COLUMN auth_id UUID REFERENCES auth.users(id) UNIQUE; 
-- auth_id is automatically generated when you create a user in Supabase Auth

CREATE OR REPLACE FUNCTION get_user_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.staff WHERE auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Enable RLS on the financial tables
ALTER TABLE fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;

-- Policy 1: Only Admins and Accountants can view or manage Invoices
CREATE POLICY "Admins and Accountants manage invoices"
ON fee_invoices
FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
USING (get_user_role() IN ('Admin', 'Accountant'));

-- Policy 2: Teachers can view their own payroll, but not others
ALTER TABLE teacher_payroll ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own payroll, Admins manage all"
ON teacher_payroll
FOR SELECT
USING (
    get_user_role() = 'Admin' 
    OR 
    teacher_id = (SELECT id FROM staff WHERE auth_id = auth.uid())
);

-- 12. Base Fee Configurations
CREATE TABLE fee_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    academic_year_id UUID REFERENCES academic_years(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    
    -- "All" is default, but allows you to set specific fees for girls vs boys if required by state rules
    gender TEXT DEFAULT 'All' CHECK (gender IN ('All', 'Male', 'Female')), 
    
    -- Handles different streams like "Science", "Commerce", or just "General"
    course_stream TEXT DEFAULT 'General', 
    
    base_fee_amount NUMERIC(10,2) NOT NULL,
    
    logged_by UUID REFERENCES staff(id), -- Audit trail for who changed the fees
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- CRITICAL: Prevent duplicate configurations for the exact same criteria
    UNIQUE(academic_year_id, class_id, gender, course_stream)
);

-- 1. Ensure the get_user_role function works bypassing table restrictions
CREATE OR REPLACE FUNCTION public.get_user_role() 
RETURNS TEXT AS $$
  SELECT role FROM public.staff WHERE auth_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Turn on RLS for every single table 
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pocket_money_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.general_expenses ENABLE ROW LEVEL SECURITY;

-- 3. STAFF / CORE AUTH POLICY
-- Let everybody read their OWN role so the frontend works
CREATE POLICY "Staff can view own role" ON public.staff FOR SELECT USING (auth_id = auth.uid());
-- Only Admins can edit or manage system staff
CREATE POLICY "Admins manage staff" ON public.staff FOR ALL USING (public.get_user_role() = 'Admin');

-- 4. SYSTEM CONFIG (Classes, Academic Years, Fee Configurations)
-- Read: Admin, Accountant, Teacher
-- Write: Admin Only
CREATE POLICY "All can read system config" ON public.classes FOR SELECT USING (true);
CREATE POLICY "Admins manage classes" ON public.classes FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "All can read academic years" ON public.academic_years FOR SELECT USING (true);
CREATE POLICY "Admins manage academic years" ON public.academic_years FOR ALL USING (public.get_user_role() = 'Admin');

CREATE POLICY "All can read fee configurations" ON public.fee_configurations FOR SELECT USING (true);
CREATE POLICY "Admins manage fee configurations" ON public.fee_configurations FOR ALL USING (public.get_user_role() = 'Admin');

-- 5. STUDENTS AND ENROLLMENTS
-- Read: Admin, Accountant, Teacher
-- Write: Admin & Accountant Only
CREATE POLICY "All can read students" ON public.students FOR SELECT USING (true);
CREATE POLICY "Admins & Accountants manage students" ON public.students FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));

CREATE POLICY "All can read student enrollments" ON public.student_enrollments FOR SELECT USING (true);
CREATE POLICY "Admins & Accountants manage enrollments" ON public.student_enrollments FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));

-- 6. STRICT FINANCIAL DATA (Invoices, Payments, Pocket Money, General Expenses)
-- Read & Write: Admin & Accountant Only (Teachers cannot even SELECT these rows)
CREATE POLICY "Strict Admin Accountant Invoices" ON public.fee_invoices FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));
CREATE POLICY "Strict Admin Accountant Payments" ON public.fee_payments FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));
CREATE POLICY "Strict Admin Accountant Pocket Money" ON public.pocket_money_transactions FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));
CREATE POLICY "Strict Admin Accountant Expenses" ON public.general_expenses FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));

-- 7. HR & PAYROLL DATA
-- Read & Write: Admin & Accountant Only
CREATE POLICY "Strict Admin Accountant Teachers" ON public.teachers FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));
CREATE POLICY "Strict Admin Accountant Payroll" ON public.teacher_payroll FOR ALL USING (public.get_user_role() IN ('Admin', 'Accountant'));


-- Add Government & School IDs
ALTER TABLE public.students
ADD COLUMN aadhaar_number VARCHAR(12) UNIQUE,
ADD COLUMN name_on_aadhaar TEXT,
ADD COLUMN apaar_id VARCHAR(12) UNIQUE;

-- Add Core Demographics & UDISE+ Fields
ALTER TABLE public.students
ADD COLUMN blood_group TEXT,
ADD COLUMN gender TEXT CHECK (gender IN ('Male', 'Female', 'Transgender')),
ADD COLUMN mother_tongue TEXT,
ADD COLUMN social_category TEXT CHECK (social_category IN ('General', 'SC', 'ST', 'OBC')),
ADD COLUMN minority_status TEXT; -- e.g., 'None', 'Muslim', 'Christian', 'Sikh'

-- Add Parent / Guardian Details
ALTER TABLE public.students
ADD COLUMN mother_full_name TEXT,
ADD COLUMN father_full_name TEXT,
ADD COLUMN guardian_name_and_relation TEXT,
ADD COLUMN parent_aadhaar_number VARCHAR(12),
ADD COLUMN primary_contact_number TEXT,
ADD COLUMN secondary_contact_number TEXT;

-- Add Admission History
ALTER TABLE public.students
ADD COLUMN date_of_admission DATE,
ADD COLUMN previous_school_attended TEXT,
ADD COLUMN tc_number TEXT;

-- Step 1: Add the toggle for Percentage vs Fixed amount
ALTER TABLE public.student_enrollments 
ADD COLUMN discount_mode TEXT DEFAULT 'Percentage' CHECK (discount_mode IN ('Percentage', 'Fixed'));

-- Step 2: Rename the existing percentage column to a generic 'value' column
ALTER TABLE public.student_enrollments 
RENAME COLUMN discount_percentage TO discount_value;

-- Step 3: Update the discount_type constraint to include 'Other'
-- Note: Supabase auto-generates constraint names if not specified. 
-- The standard naming convention is usually table_column_check.
ALTER TABLE public.student_enrollments 
DROP CONSTRAINT IF EXISTS student_enrollments_discount_type_check;

ALTER TABLE public.student_enrollments 
ADD CONSTRAINT student_enrollments_discount_type_check 
CHECK (discount_type IN ('None', 'RTE', 'Staff Child', 'Sibling', 'Management Discount', 'Other'));


-- 1. Add Current Address Fields
ALTER TABLE public.students
ADD COLUMN current_address_line1 TEXT,
ADD COLUMN current_address_landmark TEXT, -- highly recommended for India
ADD COLUMN current_city_district TEXT,
ADD COLUMN current_state TEXT,
ADD COLUMN current_pincode VARCHAR(6) CHECK (current_pincode ~ '^[0-9]{6}$'); -- Ensures exactly 6 numbers

-- 2. Add the UX Toggle
ALTER TABLE public.students
ADD COLUMN is_permanent_same_as_current BOOLEAN DEFAULT TRUE;

-- 3. Add Permanent Address Fields
ALTER TABLE public.students
ADD COLUMN permanent_address_line1 TEXT,
ADD COLUMN permanent_address_landmark TEXT,
ADD COLUMN permanent_city_district TEXT,
ADD COLUMN permanent_state TEXT,
ADD COLUMN permanent_pincode VARCHAR(6) CHECK (permanent_pincode ~ '^[0-9]{6}$');

ALTER TABLE public.fee_invoices
ADD COLUMN invoice_title TEXT NOT NULL DEFAULT 'Tuition Fee';

ALTER TABLE public.fee_payments
ADD COLUMN receipt_object_key TEXT;

ALTER TABLE public.fee_payments
ADD COLUMN transaction_reference TEXT;
ALTER TABLE public.pocket_money_transactions
ADD COLUMN receipt_object_key TEXT;

-- ==========================================
-- 1. Update 'fee_payments' table
-- ==========================================

-- Rename the singular column to plural
ALTER TABLE public.fee_payments 
RENAME COLUMN receipt_object_key TO receipt_object_keys;

-- Convert the column to an array of text, preserving existing data
ALTER TABLE public.fee_payments 
ALTER COLUMN receipt_object_keys TYPE TEXT[] 
USING CASE 
    WHEN receipt_object_keys IS NOT NULL THEN ARRAY[receipt_object_keys] 
    ELSE NULL 
END;


-- ==========================================
-- 2. Update 'pocket_money_transactions' table
-- ==========================================

-- Rename the recently added singular column to plural
ALTER TABLE public.pocket_money_transactions 
RENAME COLUMN receipt_object_key TO receipt_object_keys;

-- Convert the column to an array of text, preserving existing data
ALTER TABLE public.pocket_money_transactions 
ALTER COLUMN receipt_object_keys TYPE TEXT[] 
USING CASE 
    WHEN receipt_object_keys IS NOT NULL THEN ARRAY[receipt_object_keys] 
    ELSE NULL 
END;


-- 1. Add student_id directly to the invoice
ALTER TABLE public.fee_invoices ADD COLUMN student_id UUID REFERENCES students(id);

-- 2. Make enrollment_id optional (nullable)
ALTER TABLE public.fee_invoices ALTER COLUMN enrollment_id DROP NOT NULL;