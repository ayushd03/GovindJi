# Task One: Project Setup and Database Schema

This task focuses on initializing the frontend and backend projects and setting up the database schema in Supabase.

## Sub-tasks:

1.  **Initialize React Frontend Project:**
    *   Set up a new React project using Create React App.
2.  **Initialize Node.js Backend Project:**
    *   Set up a new Node.js project with Express.js for the backend.
3.  **Supabase Project Setup:**
    *   Create a new project in Supabase to obtain API keys and database URL.
4.  **Database Schema Creation in Supabase:**
    *   Create the following tables in your Supabase database:
        *   `users`: (id, name, email, password, etc.)
        *   `products`: (id, name, description, price, image_url, category, etc.)
        *   `categories`: (id, name)
        *   `orders`: (id, user_id, total_amount, status, etc.)
        *   `order_items`: (id, order_id, product_id, quantity, price)
        *   `reviews`: (id, product_id, user_id, rating, comment) 