import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { productsAPI } from '../services/api';
import './Home.css';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFeaturedProducts = async () => {
      try {
        const response = await productsAPI.getAll();
        setFeaturedProducts(response.data.slice(0, 8));
      } catch (err) {
        setError('Failed to load products');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFeaturedProducts();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="home">
      <section 
        className="hero"
        style={{
          backgroundImage: `linear-gradient(rgba(44, 85, 48, 0.8), rgba(44, 85, 48, 0.8)), url(${process.env.PUBLIC_URL}/hero_bgg.webp)`
        }}
      >
        <div className="hero-content">
          <h1>Welcome to GovindJi Dry Fruits</h1>
          <p>Your one-stop destination for premium dry fruits and nuts</p>
          <Link to="/products" className="cta-button">
            Shop Now
          </Link>
        </div>
      </section>

      <section className="featured-section">
        <div className="container">
          <h2>Featured Products</h2>
          
          {error ? (
            <div className="error-message">{error}</div>
          ) : (
            <div className="products-grid">
              {featuredProducts.map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
          
          <div className="view-all">
            <Link to="/products" className="view-all-link">
              View All Products
            </Link>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="container">
          <h2>Why Choose GovindJi Dry Fruits?</h2>
          <div className="features-grid">
            <div className="feature">
              <h3>Premium Quality</h3>
              <p>Hand-picked, finest quality dry fruits and nuts</p>
            </div>
            <div className="feature">
              <h3>Fresh & Natural</h3>
              <p>Sourced directly from trusted farms</p>
            </div>
            <div className="feature">
              <h3>Fast Delivery</h3>
              <p>Quick and reliable delivery to your doorstep</p>
            </div>
            <div className="feature">
              <h3>Secure Shopping</h3>
              <p>Safe and secure online shopping experience</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;