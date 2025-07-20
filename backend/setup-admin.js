// Quick script to set up admin user
// Run this with: node setup-admin.js

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function setupAdmin() {
    try {
        const userId = '132f564b-cdcf-4554-88df-0984564290f5'; // Your user ID from the JWT token
        const email = 'ayushd03+admin@gmail.com';
        const name = 'Ayush';

        // Check if user exists
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (existingUser) {
            // Update existing user to be admin
            const { data, error } = await supabase
                .from('users')
                .update({ is_admin: true, role: 'admin' })
                .eq('id', userId)
                .select()
                .single();

            if (error) {
                console.error('Error updating user:', error);
                return;
            }
            console.log('User updated to admin:', data);
        } else {
            // Create new admin user record
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    id: userId,
                    name: name,
                    email: email,
                    password: 'managed_by_supabase_auth', // Dummy password since we use Supabase Auth
                    role: 'admin',
                    is_admin: true
                }])
                .select()
                .single();

            if (error) {
                console.error('Error creating admin user:', error);
                return;
            }
            console.log('Admin user created:', data);
        }
    } catch (error) {
        console.error('Setup admin error:', error);
    }
}

setupAdmin();