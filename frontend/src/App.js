import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider } from './context/PermissionContext';
import { CartProvider, useCart } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AdminLayout from './components/AdminLayout';
import CartNotification from './components/CartNotification';
import CartPopup from './components/CartPopup';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Checkout from './pages/Checkout';
import OrderSuccess from './pages/OrderSuccess';
import Orders from './pages/Orders';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductManagement from './pages/admin/ProductManagement';
import OrderManagement from './pages/admin/OrderManagement';
import CategoryManagement from './pages/admin/CategoryManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import CustomerManagement from './pages/admin/CustomerManagement';
import AnalyticsManagement from './pages/admin/AnalyticsManagement';
import EnhancedAnalyticsManagement from './pages/admin/EnhancedAnalyticsManagement';
import PartyManagement from './pages/admin/PartyManagement';
import PurchaseOrderManagement from './pages/admin/PurchaseOrderManagement';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import ExpenseManagement from './pages/admin/ExpenseManagement';
import ExpenseHistory from './pages/admin/ExpenseHistory';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  // The actual permission check is now handled by AdminPanelGuard in AdminLayout
  return children;
};

const AppContent = () => {
  const { isCartPopupOpen, closeCartPopup } = useCart();

  return (
    <div className="App">
      <CartNotification />
      <CartPopup isOpen={isCartPopupOpen} onClose={closeCartPopup} />
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/*" element={
          <AdminRoute>
            <AdminLayout>
              <Routes>
                <Route path="/" element={<AdminDashboard />} />
                <Route path="/products" element={<ProductManagement />} />
                <Route path="/orders" element={<OrderManagement />} />
                <Route path="/categories" element={<CategoryManagement />} />
                <Route path="/inventory" element={<InventoryManagement />} />
                <Route path="/customers" element={<CustomerManagement />} />
                <Route path="/analytics" element={<EnhancedAnalyticsManagement />} />
                <Route path="/parties" element={<PartyManagement />} />
                <Route path="/purchase-orders" element={<PurchaseOrderManagement />} />
                <Route path="/employees" element={<EmployeeManagement />} />
                <Route path="/expenses" element={<ExpenseManagement />} />
                <Route path="/expenses/history" element={<ExpenseHistory />} />
              </Routes>
            </AdminLayout>
          </AdminRoute>
        } />
        
        {/* Public Routes */}
        <Route path="/*" element={
          <>
            <Header />
            <main className="main-content pt-20">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route 
                  path="/checkout" 
                  element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  } 
                />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route 
                  path="/orders" 
                  element={
                    <ProtectedRoute>
                      <Orders />
                    </ProtectedRoute>
                  } 
                />
              </Routes>
            </main>
            <Footer />
          </>
        } />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <PermissionProvider>
        <CartProvider>
          <Router>
            <AppContent />
          </Router>
        </CartProvider>
      </PermissionProvider>
    </AuthProvider>
  );
}

export default App;
