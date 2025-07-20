import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import './Header.css';

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { getCartItemsCount } = useCart();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchTerm)}`);
    }
  };

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <img src="/Govindji_Logo.webp" alt="GovindJi Dry Fruits" className="logo-image" />
        </Link>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search for dry fruits..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>

        <nav className="nav">
          <Link to="/products" className="nav-link">Products</Link>
          
          {isAuthenticated ? (
            <>
              <span className="user-greeting">Hi, {user?.user_metadata?.name || user?.email}</span>
              <Link to="/orders" className="nav-link">My Orders</Link>
              {(user?.email?.includes('admin') || user?.user_metadata?.role === 'admin') && (
                <Link to="/admin" className="nav-link admin-link">Admin Panel</Link>
              )}
              <button onClick={handleLogout} className="nav-button">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/signup" className="nav-link">Sign Up</Link>
            </>
          )}
          
          <Link to="/cart" className="cart-link">
            Cart ({getCartItemsCount()})
          </Link>
        </nav>
      </div>
    </header>
  );
};

export default Header;