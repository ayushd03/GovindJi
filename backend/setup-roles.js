// Script to set up different user roles for testing
// Run this with: node setup-roles.js <user_id> <role>
// Example: node setup-roles.js 123e4567-e89b-12d3-a456-426614174000 manager

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const validRoles = ['admin', 'manager', 'customer'];

async function setupUserRole() {
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('Usage: node setup-roles.js <user_id> <role>');
        console.log('Valid roles: admin, manager, customer');
        console.log('Example: node setup-roles.js 123e4567-e89b-12d3-a456-426614174000 manager');
        process.exit(1);
    }
    
    const [userId, role] = args;
    
    if (!validRoles.includes(role)) {
        console.error(`Invalid role: ${role}`);
        console.log('Valid roles: admin, manager, customer');
        process.exit(1);
    }
    
    try {
        // Check if user exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (!existingUser) {
            console.error('User not found. Please provide a valid user ID.');
            console.log('You can find user IDs in the Supabase dashboard or by checking auth.users table.');
            process.exit(1);
        }

        // Update user role
        const { data, error } = await supabase
            .from('users')
            .update({ 
                role: role,
                is_admin: role === 'admin' || role === 'manager'
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            console.error('Error updating user role:', error);
            process.exit(1);
        }

        console.log('✅ User role updated successfully:');
        console.log(`   User ID: ${data.id}`);
        console.log(`   Name: ${data.name}`);
        console.log(`   Email: ${data.email}`);
        console.log(`   Role: ${data.role}`);
        console.log(`   Is Admin: ${data.is_admin}`);
        
        // Show what permissions this role has
        const rolePermissions = {
            admin: [
                'view_dashboard', 'view_categories', 'manage_categories',
                'view_products', 'manage_products', 'view_orders', 'manage_orders',
                'view_inventory', 'manage_inventory', 'view_customers', 'manage_customers',
                'view_analytics'
            ],
            manager: [
                'view_dashboard', 'view_orders', 'manage_orders',
                'view_inventory', 'manage_inventory'
            ],
            customer: []
        };
        
        console.log('\n📋 Role Permissions:');
        const permissions = rolePermissions[role];
        if (permissions.length > 0) {
            permissions.forEach(permission => {
                console.log(`   ✓ ${permission}`);
            });
        } else {
            console.log('   No admin panel permissions');
        }
        
        console.log('\n🎯 Admin Panel Access:');
        if (role === 'admin') {
            console.log('   ✓ Full access to all admin panel features');
        } else if (role === 'manager') {
            console.log('   ✓ Access to Dashboard, Orders, and Inventory tabs only');
        } else {
            console.log('   ✗ No admin panel access');
        }
        
    } catch (error) {
        console.error('Setup role error:', error);
        process.exit(1);
    }
}

setupUserRole();