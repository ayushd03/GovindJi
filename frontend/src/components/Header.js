import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ShoppingCart, User, Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import AuthModal from './AuthModal';

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { getCartItemsCount, openCartPopup } = useCart();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsUserMenuOpen(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  const cartItemsCount = getCartItemsCount();

  return (
    <motion.header 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'bg-background/95 backdrop-blur-md shadow-lg' 
          : 'bg-background/85 backdrop-blur-xl shadow-sm'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Link to="/" className="flex items-center">
              <img 
                src="/Govindji_Logo.webp" 
                alt="GovindJi Dry Fruits" 
                className="h-16 w-auto transition-transform duration-300"
              />
            </Link>
          </motion.div>

          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <input
                type="text"
                placeholder="Search for premium dry fruits..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full pl-12 pr-4 py-3 rounded-full bg-muted/50 border-transparent"
              />
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
            </form>
          </div>

          <nav className="hidden lg:flex items-center space-x-8">
            <Link 
              to="/products" 
              className="text-foreground hover:text-primary transition-colors duration-300 font-medium"
            >
              Products
            </Link>
            
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 text-foreground hover:text-primary transition-colors duration-300"
                >
                  <User className="w-5 h-5" />
                  <span className="font-medium">
                    {user?.user_metadata?.name || user?.email?.split('@')[0]}
                  </span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                <AnimatePresence>
                  {isUserMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-48 bg-card/95 backdrop-blur-md rounded-lg shadow-lg border py-2"
                    >
                      <Link
                        to="/orders"
                        className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors duration-200"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        My Orders
                      </Link>
                      {(user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') && (
                        <Link
                          to="/admin"
                          className="block px-4 py-2 text-sm text-foreground hover:bg-muted transition-colors duration-200"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Admin Panel
                        </Link>
                      )}
                      <hr className="my-2" />
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors duration-200"
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="btn-secondary flex items-center space-x-2"
              >
                <User className="w-5 h-5" />
                <span>Sign In</span>
              </button>
            )}
            
            <div className="relative">
              <motion.button
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 20px 40px rgba(44, 85, 48, 0.35)"
                }}
                whileTap={{ scale: 0.95 }}
                onClick={openCartPopup}
                className="premium-cart-btn flex items-center space-x-2 px-4 py-2 rounded-full font-medium text-white shadow-lg transition-all duration-300 relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #2c5530 0%, #4a7856 100%)',
                  boxShadow: '0 10px 25px rgba(44, 85, 48, 0.25)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ShoppingCart className="w-5 h-5 relative z-10" data-cart-icon />
                <span className="font-medium relative z-10">Cart</span>
                {cartItemsCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-gradient-to-br from-red-500 to-red-600 text-white text-xs rounded-full w-7 h-7 flex items-center justify-center font-bold shadow-lg border-2 border-white"
                    style={{
                      boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
                    }}
                  >
                    {cartItemsCount}
                  </motion.span>
                )}
              </motion.button>
            </div>
          </nav>

          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-foreground hover:text-primary transition-colors duration-300"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <div className="md:hidden pb-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search for premium dry fruits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full pl-12 pr-4 py-3 rounded-full bg-muted/50 border-transparent"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
          </form>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-card/95 backdrop-blur-md border-t"
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
              <Link 
                to="/products" 
                className="block text-foreground hover:text-primary transition-colors duration-300 font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Products
              </Link>
              
              {isAuthenticated ? (
                <>
                  <div className="border-t pt-4">
                    <p className="text-sm text-muted-foreground mb-2">
                      Hi, {user?.user_metadata?.name || user?.email?.split('@')[0]}
                    </p>
                    <Link
                      to="/orders"
                      className="block text-foreground hover:text-primary transition-colors duration-300 py-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      My Orders
                    </Link>
                    {(user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') && (
                      <Link
                        to="/admin"
                        className="block text-foreground hover:text-primary transition-colors duration-300 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block text-destructive hover:opacity-80 transition-colors duration-300 py-2"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-t pt-4">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="btn-secondary flex items-center space-x-2 w-full"
                  >
                    <User className="w-5 h-5" />
                    <span className="font-medium">Sign In</span>
                  </button>
                </div>
              )}
              
              <button 
                onClick={() => {
                  setIsMenuOpen(false);
                  openCartPopup();
                }}
                className="premium-cart-btn flex items-center justify-center space-x-2 w-full px-4 py-3 rounded-full font-medium text-white shadow-lg transition-all duration-300 relative overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #2c5530 0%, #4a7856 100%)',
                  boxShadow: '0 10px 25px rgba(44, 85, 48, 0.25)'
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <ShoppingCart className="w-5 h-5 relative z-10" data-cart-icon />
                <span className="font-medium relative z-10">Cart ({cartItemsCount})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </motion.header>
  );
};

export default Header;
