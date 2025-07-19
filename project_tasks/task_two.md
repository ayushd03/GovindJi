# Task Two: Backend Development (API Endpoints)

This task involves implementing all the necessary API endpoints for products, user authentication, and orders, and integrating a payment gateway.

## Sub-tasks:

1.  **Products API Endpoints:**
    *   `GET /api/products`: Fetch all products.
    *   `GET /api/products/:id`: Fetch a single product by its ID.
    *   `GET /api/products/category/:category_name`: Fetch products by category.
2.  **User Authentication API Endpoints:**
    *   `POST /api/auth/signup`: Register a new user.
    *   `POST /api/auth/login`: Log in a user.
    *   Implement user authentication using Supabase Auth.
3.  **Orders API Endpoints:**
    *   `POST /api/orders`: Create a new order.
    *   `GET /api/orders/:user_id`: Fetch all orders for a specific user.
4.  **Middleware Implementation:**
    *   Implement middleware for authentication to protect routes that require a logged-in user. 