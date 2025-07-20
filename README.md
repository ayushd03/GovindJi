# GovindJiDryFruits - E-commerce Platform for Dry Fruits

A full-stack e-commerce application built with React.js (frontend) and Node.js/Express.js (backend), using Supabase for database and authentication.

## Features

### Completed ✅
- **User Authentication**: Sign up, login, logout with Supabase Auth
- **Product Management**: Browse products, view details, search functionality
- **Shopping Cart**: Add/remove items, update quantities, persistent cart storage
- **Checkout Process**: Complete order flow with Cash on Delivery support
- **Order Management**: Create and view orders
- **Review System**: Add and view product reviews
- **Responsive Design**: Mobile-friendly interface
- **Component Architecture**: Reusable React components with clean structure

### Future Enhancements 🚧
- **Payment Gateway Integration**: Stripe/Razorpay for online payments
- **Product Categories**: Category-based filtering and navigation
- **User Dashboard**: Enhanced order history and profile management
- **Admin Panel**: Product and order management for administrators
- **Advanced Search**: Filters by price, category, ratings
- **Product Images**: Upload and manage product images

## Tech Stack

### Frontend
- **React.js** with functional components and hooks
- **React Router** for navigation
- **React Context** for state management
- **Axios** for API calls
- **CSS3** with responsive design

### Backend
- **Node.js** with Express.js
- **Supabase** for database and authentication
- **CORS** for cross-origin requests
- **dotenv** for environment configuration

### Database
- **PostgreSQL** (via Supabase)
- Tables: users, products, categories, orders, order_items, reviews

## Project Structure

```
├── backend/
│   ├── server.js              # Express server and API routes
│   ├── schema.sql             # Database schema
│   ├── package.json           # Backend dependencies
│   └── .env                   # Environment variables
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Header.js
│   │   │   ├── Footer.js
│   │   │   └── ProductCard.js
│   │   ├── pages/             # Page components
│   │   │   ├── Home.js
│   │   │   ├── Products.js
│   │   │   ├── Login.js
│   │   │   ├── Signup.js
│   │   │   ├── Cart.js
│   │   │   ├── Checkout.js
│   │   │   └── OrderSuccess.js
│   │   ├── context/           # React context for state management
│   │   │   ├── AuthContext.js
│   │   │   └── CartContext.js
│   │   ├── services/          # API service functions
│   │   │   └── api.js
│   │   ├── App.js             # Main app component with routing
│   │   └── index.js           # React entry point
│   ├── package.json           # Frontend dependencies
│   └── .env                   # Environment variables
└── project_tasks/             # Task documentation
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Supabase account

### Backend Setup

1. **Navigate to backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up Supabase**:
   - Create a new project at [supabase.com](https://supabase.com)
   - Get your Project URL and API Key from Settings > API
   - Execute the SQL schema from `schema.sql` in your Supabase SQL editor

4. **Configure environment variables**:
   ```bash
   # Update backend/.env with your Supabase credentials
   SUPABASE_URL=your_supabase_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   PORT=3001
   CLIENT_URL=http://localhost:3000
   ```

5. **Start the backend server**:
   ```bash
   npm run dev    # For development with nodemon
   # or
   npm start      # For production
   ```

### Frontend Setup

1. **Navigate to frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   # frontend/.env
   REACT_APP_API_URL=http://localhost:3001
   ```

4. **Start the development server**:
   ```bash
   npm start
   ```

5. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

## API Endpoints

### Products
- `GET /api/products` - Get all products
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/category/:category_name` - Get products by category

### Authentication
- `POST /api/auth/signup` - Register new user
- `POST /api/auth/login` - User login

### Orders (Protected Routes)
- `POST /api/orders` - Create new order
- `GET /api/orders/:user_id` - Get user orders

### Reviews
- `GET /api/products/:id/reviews` - Get product reviews
- `POST /api/products/:id/reviews` - Add product review (protected)

### Payment (Future)
- `POST /api/create-checkout-session` - Create payment session

## Database Schema

### Tables
- **users**: User account information
- **categories**: Product categories
- **products**: Product catalog with details
- **orders**: Order information
- **order_items**: Individual items in orders
- **reviews**: Product reviews and ratings

## Usage

1. **Browse Products**: Visit the homepage or products page to browse available items
2. **User Registration**: Create an account or login with existing credentials
3. **Shopping**: Add items to cart, adjust quantities, and proceed to checkout
4. **Checkout**: Fill in shipping details and place order with Cash on Delivery
5. **Order Tracking**: View order history in the user dashboard

## Development Notes

- **State Management**: Uses React Context for both authentication and cart state
- **Authentication**: Protected routes require user authentication
- **Error Handling**: Comprehensive error handling on both frontend and backend
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox
- **Data Persistence**: Cart items persist in localStorage, orders in database

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is for educational purposes. Please ensure you comply with all third-party service terms when deploying.