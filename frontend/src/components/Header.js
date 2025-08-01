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
          ? 'bg-white/95 backdrop-blur-md shadow-lg' 
          : 'bg-white/85 backdrop-blur-xl shadow-sm'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative"
          >
            <Link to="/" className="flex items-center relative">
              <div className="absolute inset-0 bg-white/20 backdrop-blur-sm rounded-lg -m-2 shadow-sm"></div>
              <img 
                src="/Govindji_Logo.webp" 
                alt="GovindJi Dry Fruits" 
                className="h-16 w-auto transition-transform duration-300 relative z-10"
              />
            </Link>
          </motion.div>

          {/* Desktop Search Bar */}
          <div className="hidden md:flex flex-1 max-w-xl mx-8">
            <form onSubmit={handleSearch} className="relative w-full">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search for premium dry fruits..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-light-gray/50 border border-transparent rounded-full text-primary-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-accent focus:bg-white transition-all duration-300"
                />
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              </div>
            </form>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-8">
            <Link 
              to="/products" 
              className="text-primary-text hover:text-primary-accent transition-colors duration-300 font-medium"
            >
              Products
            </Link>
            
            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="flex items-center space-x-2 text-primary-text hover:text-primary-accent transition-colors duration-300"
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
                      className="absolute right-0 mt-2 w-48 bg-white/95 backdrop-blur-md rounded-lg shadow-lg border border-gray-100/50 py-2"
                    >
                      <Link
                        to="/orders"
                        className="block px-4 py-2 text-sm text-primary-text hover:bg-light-gray transition-colors duration-200"
                        onClick={() => setIsUserMenuOpen(false)}
                      >
                        My Orders
                      </Link>
                      {(user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') && (
                        <Link
                          to="/admin"
                          className="block px-4 py-2 text-sm text-primary-text hover:bg-light-gray transition-colors duration-200"
                          onClick={() => setIsUserMenuOpen(false)}
                        >
                          Admin Panel
                        </Link>
                      )}
                      <hr className="my-2" />
                      <button
                        onClick={handleLogout}
                        className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
                      >
                        Logout
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="flex items-center">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center space-x-2 text-primary-text hover:text-primary-accent transition-all duration-300 font-medium px-4 py-2 rounded-full hover:bg-gray-100/50"
                >
                  <User className="w-5 h-5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}
            
            {/* Cart Button */}
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={openCartPopup}
                className="flex items-center space-x-2 bg-primary-accent text-white px-4 py-2 rounded-full hover:bg-secondary-accent transition-all duration-300 shadow-md hover:shadow-lg"
              >
                <ShoppingCart className="w-5 h-5" data-cart-icon />
                <span className="font-medium">Cart</span>
                {cartItemsCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold"
                  >
                    {cartItemsCount}
                  </motion.span>
                )}
              </motion.button>
            </div>
          </nav>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="lg:hidden p-2 text-primary-text hover:text-primary-accent transition-colors duration-300"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-4">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Search for premium dry fruits..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-light-gray/50 border border-transparent rounded-full text-primary-text placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-accent focus:bg-white transition-all duration-300"
            />
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          </form>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white/95 backdrop-blur-md border-t border-gray-100/50"
          >
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-4">
              <Link 
                to="/products" 
                className="block text-primary-text hover:text-primary-accent transition-colors duration-300 font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                Products
              </Link>
              
              {isAuthenticated ? (
                <>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm text-gray-600 mb-2">
                      Hi, {user?.user_metadata?.name || user?.email?.split('@')[0]}
                    </p>
                    <Link
                      to="/orders"
                      className="block text-primary-text hover:text-primary-accent transition-colors duration-300 py-2"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      My Orders
                    </Link>
                    {(user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') && (
                      <Link
                        to="/admin"
                        className="block text-primary-text hover:text-primary-accent transition-colors duration-300 py-2"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Admin Panel
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="block text-red-600 hover:text-red-700 transition-colors duration-300 py-2"
                    >
                      Logout
                    </button>
                  </div>
                </>
              ) : (
                <div className="border-t border-gray-100 pt-4">
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="flex items-center space-x-2 text-primary-text hover:text-primary-accent transition-all duration-300 py-3 rounded-lg hover:bg-gray-100/50 w-full"
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
                className="flex items-center space-x-2 bg-primary-accent text-white py-3 px-4 rounded-full hover:bg-secondary-accent transition-all duration-300 shadow-md w-full mb-4"
              >
                <ShoppingCart className="w-5 h-5" data-cart-icon />
                <span className="font-medium">Cart ({cartItemsCount})</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
      />
    </motion.header>
  );
};

export default Header;