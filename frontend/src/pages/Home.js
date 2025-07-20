import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star, Shield, Truck, Heart, Award, Leaf, CheckCircle } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { productsAPI } from '../services/api';

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

  const categories = [
    { name: 'Almonds', image: '🌰', color: 'from-amber-400 to-orange-500' },
    { name: 'Cashews', image: '🥜', color: 'from-yellow-400 to-amber-500' },
    { name: 'Pistachios', image: '🌰', color: 'from-green-400 to-emerald-500' },
    { name: 'Walnuts', image: '🌰', color: 'from-brown-400 to-amber-600' },
    { name: 'Dates', image: '🫐', color: 'from-red-400 to-pink-500' },
    { name: 'Raisins', image: '🍇', color: 'from-purple-400 to-indigo-500' },
  ];

  const features = [
    {
      icon: Award,
      title: 'Premium Quality',
      description: 'Hand-picked, finest quality dry fruits and nuts sourced from the best farms',
      color: 'text-primary-accent'
    },
    {
      icon: Leaf,
      title: 'Fresh & Natural',
      description: 'No artificial preservatives, 100% natural and fresh products',
      color: 'text-green-500'
    },
    {
      icon: Truck,
      title: 'Fast Delivery',
      description: 'Quick and reliable delivery to your doorstep nationwide',
      color: 'text-blue-500'
    },
    {
      icon: Shield,
      title: 'Secure Shopping',
      description: 'Safe and secure online shopping with encrypted payment',
      color: 'text-purple-500'
    }
  ];

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease: "easeOut" }
  };

  const slideInFromRight = {
    initial: { opacity: 0, x: 100 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.8, ease: "easeOut" }
  };

  const stagger = {
    animate: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-primary-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <motion.section 
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/hero_bgg.webp)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <div className="absolute inset-0 bg-black/30" />
        
        {/* Floating decorative elements */}
        <motion.div
          className="absolute top-20 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl"
          animate={{ y: [-20, 20, -20] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-32 right-16 w-32 h-32 bg-white/5 rounded-full blur-2xl"
          animate={{ y: [20, -20, 20] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="relative z-10 container mx-auto px-4 text-center text-white">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <motion.h1 
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              Welcome to{' '}
              <span className="bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
                GovindJi
              </span>
              <br />
              Dry Fruits
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              Your premium destination for the finest dry fruits and nuts, 
              handpicked for quality and freshness
            </motion.p>
            
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <Link to="/products">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="bg-white text-primary-accent px-8 py-4 rounded-full font-semibold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 flex items-center space-x-2"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </Link>
              
              <motion.div
                className="flex items-center space-x-2 text-white/90"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="ml-2">Trusted by 10,000+ customers</span>
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </motion.section>

      {/* Shop by Category Section */}
      <motion.section 
        className="section-padding bg-gradient-to-br from-light-gray to-white"
        {...fadeInUp}
      >
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-text mb-4">
              Shop by Category
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore our premium collection of handpicked dry fruits and nuts
            </p>
          </motion.div>
          
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6"
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {categories.map((category, index) => (
              <motion.div
                key={category.name}
                variants={fadeInUp}
                whileHover={{ scale: 1.05, y: -5 }}
                className="group cursor-pointer"
              >
                <div className={`relative bg-gradient-to-br ${category.color} rounded-2xl p-8 text-center shadow-lg group-hover:shadow-xl transition-all duration-300`}>
                  <div className="text-4xl mb-4">{category.image}</div>
                  <h3 className="text-white font-semibold text-lg">{category.name}</h3>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-2xl transition-all duration-300" />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      {/* Featured Products Section */}
      <motion.section className="section-padding bg-white" {...fadeInUp}>
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-text mb-4">
              Featured Products
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Discover our most popular and premium quality dry fruits
            </p>
          </motion.div>
          
          {error ? (
            <motion.div 
              className="text-center py-16"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="text-red-500 text-lg font-medium">{error}</div>
            </motion.div>
          ) : (
            <>
              <motion.div 
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12"
                variants={stagger}
                initial="initial"
                whileInView="animate"
                viewport={{ once: true }}
              >
                {featuredProducts.map((product, index) => (
                  <motion.div key={product.id} variants={slideInFromRight}>
                    <ProductCard product={product} />
                  </motion.div>
                ))}
              </motion.div>
              
              <motion.div className="text-center" {...fadeInUp}>
                <Link to="/products">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="btn-secondary inline-flex items-center space-x-2"
                  >
                    <span>View All Products</span>
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </Link>
              </motion.div>
            </>
          )}
        </div>
      </motion.section>

      {/* Why Choose Us Section */}
      <motion.section 
        className="section-padding bg-gradient-to-br from-primary-accent/5 to-secondary-accent/5"
        {...fadeInUp}
      >
        <div className="container mx-auto px-4">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-text mb-4">
              Why Choose GovindJi Dry Fruits?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              We're committed to providing you with the finest quality dry fruits 
              and an exceptional shopping experience
            </p>
          </motion.div>
          
          <motion.div 
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8"
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {features.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={fadeInUp}
                  whileHover={{ y: -10 }}
                  className="card text-center group hover:shadow-2xl"
                >
                  <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                    <IconComponent className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-semibold text-primary-text mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      {/* Call to Action Section */}
      <motion.section 
        className="section-padding bg-gradient-to-r from-primary-accent to-secondary-accent text-white"
        {...fadeInUp}
      >
        <div className="container mx-auto px-4 text-center">
          <motion.div {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Experience Premium Quality?
            </h2>
            <p className="text-xl mb-8 max-w-2xl mx-auto opacity-90">
              Join thousands of satisfied customers who trust GovindJi Dry Fruits 
              for their daily nutrition needs
            </p>
            <Link to="/products">
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="bg-white text-primary-accent px-8 py-4 rounded-full font-semibold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 inline-flex items-center space-x-2"
              >
                <span>Start Shopping</span>
                <ArrowRight className="w-5 h-5" />
              </motion.button>
            </Link>
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
};

export default Home;