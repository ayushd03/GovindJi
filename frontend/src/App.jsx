import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionProvider, usePermissions } from './context/PermissionContext';
import { CartProvider, useCart } from './context/CartContext';
import Header from './components/Header';
import Footer from './components/Footer';
import AdminLayout from './components/AdminLayout';
import CartNotification from './components/CartNotification';
import CartPopup from './components/CartPopup';
import { Toaster } from './components/ui/toaster';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Auth from './pages/Auth';
import Checkout from './pages/Checkout';
import PaymentVerify from './pages/PaymentVerify';
import OrderSuccess from './pages/OrderSuccess';
import Orders from './pages/Orders';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsConditions from './pages/TermsConditions';
import ShippingReturns from './pages/ShippingReturns';
import AdminDashboard from './pages/admin/AdminDashboard';
import ProductManagement from './pages/admin/ProductManagement';
import OrderManagement from './pages/admin/OrderManagement';
import CategoryManagement from './pages/admin/CategoryManagement';
import InventoryManagement from './pages/admin/InventoryManagement';
import CustomerManagement from './pages/admin/CustomerManagement';
import PartyManagement from './pages/admin/PartyManagement';
import PurchaseOrderManagement from './pages/admin/PurchaseOrderManagement';
import EmployeeManagement from './pages/admin/EmployeeManagement';
import ExpenseManagement from './pages/admin/ExpenseManagement';
import { buildAuthPath } from './utils/authRouting';
import './App.css';

const AppLoadingScreen = () => (
  <div className="page-shell-soft">
    <div className="page-container flex min-h-[60vh] items-center justify-center">
      <div className="surface-card px-8 py-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-[3px] border-[#23442a]/15 border-t-[#23442a]" />
        <p className="mt-4 text-sm font-medium text-muted-foreground">Loading your storefront…</p>
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <AppLoadingScreen />;
  }
  
  return isAuthenticated ? (
    children
  ) : (
    <Navigate
      to={buildAuthPath({
        mode: 'sign-in',
        next: `${location.pathname}${location.search}${location.hash}`,
      })}
      replace
    />
  );
};

const AdminRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const { canAccessAdminPanel } = usePermissions();
  const location = useLocation();

  if (loading) {
    return <AppLoadingScreen />;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={buildAuthPath({
          mode: 'sign-in',
          next: `${location.pathname}${location.search}${location.hash}`,
        })}
        replace
      />
    );
  }

  // Check admin/manager permissions before rendering
  if (!canAccessAdminPanel()) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const LegacyAuthRedirect = ({ mode }) => {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  return (
    <Navigate
      to={buildAuthPath({
        mode,
        next: searchParams.get('next') || location.state?.from?.pathname || '',
      })}
      replace
    />
  );
};

const AppContent = () => {
  const { isCartPopupOpen, closeCartPopup } = useCart();
  const location = useLocation();

  // Close cart when route changes
  useEffect(() => {
    closeCartPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Close cart when clicking anywhere outside the popup or the cart button
  useEffect(() => {
    if (!isCartPopupOpen) return;
    const handleGlobalClick = (event) => {
      const target = event.target;
      const isInsideCart = target.closest('.cart-popup');
      const isCartButton = target.closest('.premium-cart-btn');
      if (isInsideCart || isCartButton) return;
      closeCartPopup();
    };
    document.addEventListener('pointerdown', handleGlobalClick, true);
    return () => {
      document.removeEventListener('pointerdown', handleGlobalClick, true);
    };
  }, [isCartPopupOpen, closeCartPopup]);

  return (
    <div className="App">
      <CartNotification />
      <Toaster />
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
                <Route path="/delhivery" element={<Navigate to="/admin/orders?panel=delivery" replace />} />
                <Route path="/categories" element={<CategoryManagement />} />
                <Route path="/inventory" element={<InventoryManagement />} />
                <Route path="/customers" element={<CustomerManagement />} />
                <Route path="/parties" element={<PartyManagement />} />
                <Route path="/purchase-orders" element={<PurchaseOrderManagement />} />
                <Route path="/employees" element={<EmployeeManagement />} />
                <Route path="/expenses" element={<ExpenseManagement />} />
              </Routes>
            </AdminLayout>
          </AdminRoute>
        } />
        
        {/* Public Routes */}
        <Route path="/*" element={
          <>
            <Header />
            <main className="main-content pt-[74px]">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/login" element={<LegacyAuthRedirect mode="sign-in" />} />
                <Route path="/signup" element={<LegacyAuthRedirect mode="sign-up" />} />
                <Route path="/forgot-password" element={<LegacyAuthRedirect mode="forgot-password" />} />
                <Route
                  path="/checkout"
                  element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  }
                />
                <Route path="/payment/verify" element={<PaymentVerify />} />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route
                  path="/orders"
                  element={
                    <ProtectedRoute>
                      <Orders />
                    </ProtectedRoute>
                  }
                />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsConditions />} />
                <Route path="/shipping" element={<ShippingReturns />} />
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
