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

// User Authentication Routes
app.post('/api/auth/signup', async (req, res) => {
    const { email, password, name } = req.body;
    const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
            data: { name: name },
        },
    });
    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
});

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
    });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
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