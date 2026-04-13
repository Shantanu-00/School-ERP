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
