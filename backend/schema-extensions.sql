-- Schema extensions for Vendor Management, Employee Management, and Expense Management
-- These tables will be added to the existing schema.sql

-- Vendors table for supplier management
CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone_number VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    category VARCHAR(100) NOT NULL, -- 'Raw Materials', 'Packaging', 'Dairy', 'Services', 'Equipment', 'Miscellaneous'
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Employees table for staff management
CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) NOT NULL, -- 'Store Manager', 'Cashier', 'Stocking Staff', 'Sales Associate', 'Driver', 'Cleaner'
    contact_number VARCHAR(20),
    email VARCHAR(255),
    start_date DATE NOT NULL,
    salary NUMERIC(10, 2),
    address TEXT,
    emergency_contact VARCHAR(255),
    emergency_phone VARCHAR(20),
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses table for financial tracking
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount NUMERIC(10, 2) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'Vendor Payment', 'Employee Payout', 'Store Utilities', 'Marketing', 'Maintenance', 'Miscellaneous'
    vendor_id UUID REFERENCES vendors(id), -- Only for vendor payments
    employee_id UUID REFERENCES employees(id), -- Only for employee payouts
    payment_mode VARCHAR(50) NOT NULL, -- 'Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit'
    expense_date DATE NOT NULL,
    receipt_url TEXT, -- For storing receipt images
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_vendors_category ON vendors(category, is_active);
CREATE INDEX idx_vendors_name ON vendors(name);
CREATE INDEX idx_employees_role ON employees(role, is_active);
CREATE INDEX idx_employees_name ON employees(name);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_vendor ON expenses(vendor_id);
CREATE INDEX idx_expenses_employee ON expenses(employee_id);
CREATE INDEX idx_expenses_created_by ON expenses(created_by);

-- Insert default vendor categories
INSERT INTO vendors (name, contact_person, phone_number, email, category, notes, is_active) VALUES
('Sample Nuts Supplier', 'Raj Kumar', '+91-9876543210', 'raj@samplenutsupplier.com', 'Raw Materials', 'Trusted supplier for almonds and cashews', true),
('PackagingPro Ltd', 'Priya Sharma', '+91-9876543211', 'priya@packagingpro.com', 'Packaging', 'Quality packaging materials supplier', true),
('Local Dairy Farm', 'Suresh Patel', '+91-9876543212', 'suresh@localdairy.com', 'Dairy', 'Fresh milk and dairy products', true)
ON CONFLICT DO NOTHING;

-- Insert default employee roles (sample data)
INSERT INTO employees (name, role, contact_number, email, start_date, salary, is_active) VALUES
('Ramesh Kumar', 'Store Manager', '+91-9876543220', 'ramesh@govindji.com', '2023-01-01', 25000.00, true),
('Sunita Devi', 'Cashier', '+91-9876543221', 'sunita@govindji.com', '2023-02-15', 18000.00, true),
('Mohan Singh', 'Stocking Staff', '+91-9876543222', 'mohan@govindji.com', '2023-03-01', 15000.00, true)
ON CONFLICT DO NOTHING;