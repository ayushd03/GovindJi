require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = process.env.PORT || 3001;

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

app.use(cors());
app.use(express.json());

// Middleware for authentication
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) return res.sendStatus(403); // Invalid token

    req.user = user;
    next();
};

// Middleware for admin authentication
const authenticateAdmin = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error) return res.sendStatus(403);

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_admin, role')
        .eq('id', user.id)
        .single();

    if (userError || !userData || !userData.is_admin) {
        return res.status(403).json({ message: 'Admin access required' });
    }

    req.user = user;
    req.userRole = userData;
    next();
};

// Admin Routes
// Admin Dashboard Analytics
app.get('/api/admin/dashboard', authenticateAdmin, async (req, res) => {
    try {
        // Get order statistics
        const { data: orders, error: ordersError } = await supabase
            .from('orders')
            .select('*');

        // Get products count
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('*');

        // Get low stock products
        const { data: lowStock, error: lowStockError } = await supabase
            .from('products')
            .select('*')
            .lt('stock_quantity', 'min_stock_level');

        // Calculate today's revenue
        const today = new Date().toISOString().split('T')[0];
        const { data: todaysOrders, error: todaysError } = await supabase
            .from('orders')
            .select('total_amount')
            .gte('created_at', today)
            .eq('status', 'completed');

        const todaysRevenue = todaysOrders?.reduce((sum, order) => sum + parseFloat(order.total_amount), 0) || 0;

        res.json({
            totalOrders: orders?.length || 0,
            totalProducts: products?.length || 0,
            lowStockItems: lowStock?.length || 0,
            todaysRevenue,
            recentOrders: orders?.slice(-5) || [],
            lowStockProducts: lowStock || []
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Admin Product Management
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
    const { name, description, price, image_url, category_id, stock_quantity, min_stock_level, sku, weight, unit } = req.body;
    
    const { data, error } = await supabase
        .from('products')
        .insert([{
            name,
            description,
            price,
            image_url,
            category_id,
            stock_quantity: stock_quantity || 0,
            min_stock_level: min_stock_level || 10,
            sku,
            weight,
            unit: unit || 'kg'
        }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'CREATE_PRODUCT',
        entity_type: 'product',
        entity_id: data.id,
        details: { product_name: name }
    }]);

    res.status(201).json(data);
});

app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_PRODUCT',
        entity_type: 'product',
        entity_id: id,
        details: updates
    }]);

    res.json(data);
});

app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
    const { id } = req.params;

    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'DELETE_PRODUCT',
        entity_type: 'product',
        entity_id: id
    }]);

    res.json({ message: 'Product deleted successfully' });
});

// Admin Order Management
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
        .from('orders')
        .select(`
            *,
            users (name, email),
            order_items (
                *,
                products (name, price)
            )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    if (status) {
        query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.put('/api/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const { data, error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Log admin action
    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'UPDATE_ORDER_STATUS',
        entity_type: 'order',
        entity_id: id,
        details: { new_status: status }
    }]);

    res.json(data);
});

// Admin Stock Management
app.put('/api/admin/products/:id/stock', authenticateAdmin, async (req, res) => {
    const { id } = req.params;
    const { quantity, movement_type, reason } = req.body;

    // Get current stock
    const { data: product, error: productError } = await supabase
        .from('products')
        .select('stock_quantity')
        .eq('id', id)
        .single();

    if (productError) return res.status(500).json({ error: productError.message });

    let newStock;
    if (movement_type === 'in') {
        newStock = product.stock_quantity + quantity;
    } else if (movement_type === 'out') {
        newStock = product.stock_quantity - quantity;
    } else {
        newStock = quantity; // direct adjustment
    }

    // Update product stock
    const { data, error } = await supabase
        .from('products')
        .update({ stock_quantity: newStock, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    // Record stock movement
    await supabase.from('stock_movements').insert([{
        product_id: id,
        movement_type,
        quantity,
        reason,
        created_by: req.user.id
    }]);

    res.json(data);
});

// Categories Routes
app.get('/api/categories', async (req, res) => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/admin/categories', authenticateAdmin, async (req, res) => {
    const { name } = req.body;
    
    const { data, error } = await supabase
        .from('categories')
        .insert([{ name }])
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });

    await supabase.from('admin_logs').insert([{
        admin_id: req.user.id,
        action: 'CREATE_CATEGORY',
        entity_type: 'category',
        entity_id: data.id,
        details: { category_name: name }
    }]);

    res.status(201).json(data);
});

// Initialize default categories if none exist
app.post('/api/admin/init-categories', authenticateAdmin, async (req, res) => {
    try {
        // Check if categories already exist
        const { data: existingCategories, error: checkError } = await supabase
            .from('categories')
            .select('*');

        if (checkError) return res.status(500).json({ error: checkError.message });

        if (existingCategories.length === 0) {
            const defaultCategories = [
                { name: 'Nuts' },
                { name: 'Dried Fruits' },
                { name: 'Seeds' },
                { name: 'Spices' },
                { name: 'Traditional Sweets' }
            ];

            const { data, error } = await supabase
                .from('categories')
                .insert(defaultCategories)
                .select();

            if (error) return res.status(500).json({ error: error.message });

            await supabase.from('admin_logs').insert([{
                admin_id: req.user.id,
                action: 'INIT_CATEGORIES',
                entity_type: 'category',
                details: { categories_created: data.length }
            }]);

            res.status(201).json({ message: 'Default categories created', categories: data });
        } else {
            res.json({ message: 'Categories already exist', categories: existingCategories });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Product Routes
app.get('/api/products', async (req, res) => {
    const { data, error } = await supabase
        .from('products')
        .select('*');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/api/products/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
    if (error) return res.status(500).json({ error: error.message });
    if (!data) return res.status(404).json({ message: 'Product not found' });
    res.json(data);
});

app.get('/api/products/category/:category_name', async (req, res) => {
    const { category_name } = req.params;
    const { data: categoryData, error: categoryError } = await supabase
        .from('categories')
        .select('id')
        .eq('name', category_name)
        .single();

    if (categoryError) return res.status(500).json({ error: categoryError.message });
    if (!categoryData) return res.status(404).json({ message: 'Category not found' });

    const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryData.id);
    
    if (productsError) return res.status(500).json({ error: productsError.message });
    res.json(productsData);
});

// Admin user creation route
app.post('/api/admin/create-admin', async (req, res) => {
    const { user_id, email, name } = req.body;
    
    try {
        // Check if user already exists in users table
        const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('*')
            .eq('id', user_id)
            .single();

        if (existingUser) {
            // Update existing user to be admin
            const { data, error } = await supabase
                .from('users')
                .update({ is_admin: true, role: 'admin' })
                .eq('id', user_id)
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.json({ message: 'User updated to admin', user: data });
        } else {
            // Create new admin user record
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    id: user_id,
                    name: name,
                    email: email,
                    password: 'managed_by_supabase_auth', // Dummy password since we use Supabase Auth
                    role: 'admin',
                    is_admin: true
                }])
                .select()
                .single();

            if (error) return res.status(500).json({ error: error.message });
            return res.status(201).json({ message: 'Admin user created', user: data });
        }
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// User Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    
    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
            options: {
                data: { name: name },
                emailRedirectTo: undefined
            },
        });
        
        if (error) {
            console.error('Signup error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        // Check if user needs email confirmation
        if (data.user && !data.session) {
            return res.status(201).json({ 
                message: 'Please check your email to confirm your account',
                user: data.user,
                confirmationRequired: true 
            });
        }

        // If user is created successfully, also create record in users table
        if (data.user) {
            const isAdmin = email.includes('admin'); // Users with 'admin' in email become admin
            
            try {
                await supabase
                    .from('users')
                    .insert([{
                        id: data.user.id,
                        name: name,
                        email: email,
                        password: 'managed_by_supabase_auth', // Dummy password since we use Supabase Auth
                        role: isAdmin ? 'admin' : 'customer',
                        is_admin: isAdmin
                    }]);
            } catch (insertError) {
                console.log('User record creation failed (user might already exist):', insertError);
            }
        }
        
        res.status(201).json(data);
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });
        
        if (error) {
            console.error('Login error:', error);
            return res.status(400).json({ error: error.message });
        }
        
        res.json(data);
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Order Routes (protected by authentication middleware)
app.post('/api/orders', authenticateToken, async (req, res) => {
    const { total_amount, status, items } = req.body;
    const { user } = req;

    const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{ user_id: user.id, total_amount, status }])
        .select()
        .single();

    if (orderError) return res.status(500).json({ error: orderError.message });

    const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
    }));

    const { data: newOrderItems, error: orderItemsError } = await supabase
        .from('order_items')
        .insert(orderItems)
        .select();

    if (orderItemsError) return res.status(500).json({ error: orderItemsError.message });

    res.status(201).json({ order, newOrderItems });
});

app.get('/api/orders/:user_id', authenticateToken, async (req, res) => {
    const { user_id } = req.params;
    if (req.user.id !== user_id) {
        return res.status(403).json({ message: 'Unauthorized' });
    }

    const { data, error } = await supabase
        .from('orders')
        .select(`
            *,
            order_items (
                *,
                products (*)
            )
        `)
        .eq('user_id', user_id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

// Payment Gateway Integration (Stripe Placeholder)
app.post('/api/create-checkout-session', authenticateToken, async (req, res) => {
    const { items } = req.body;

    // Here you would integrate with your chosen payment gateway (e.g., Stripe, Razorpay)
    // For Stripe, it would look something like this:
    // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    // const session = await stripe.checkout.sessions.create({
    //     "payment_method_types": ["card"],
    //     line_items: items.map(item => {
    //         return {
    //             price_data: {
    //                 currency: 'usd',
    //                 product_data: {
    //                     name: item.name,
    //                 },
    //                 unit_amount: item.price * 100, // Price in cents
    //             },
    //             quantity: item.quantity,
    //         };
    //     }),
    //     mode: 'payment',
    //     success_url: `${process.env.CLIENT_URL}/success`,
    //     cancel_url: `${process.env.CLIENT_URL}/cancel`,
    // });

    // res.json({ url: session.url });

    res.status(501).json({ message: "Payment gateway not yet implemented. Cash on Delivery is assumed." });
});

// Review Routes
app.get('/api/products/:id/reviews', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('reviews')
        .select(`
            *,
            users (name)
        `)
        .eq('product_id', id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.post('/api/products/:id/reviews', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const { user } = req;

    const { data, error } = await supabase
        .from('reviews')
        .insert([{
            product_id: id,
            user_id: user.id,
            rating,
            comment
        }])
        .select(`
            *,
            users (name)
        `)
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

app.listen(port, () => {
    console.log(`Backend server listening at http://localhost:${port}`);
}); 