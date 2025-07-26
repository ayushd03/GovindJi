import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { ArrowRight, Star, Shield, Truck, Heart, Award, Leaf, CheckCircle } from 'lucide-react';
import ProductCardNew from '../components/ProductCardNew';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { productsAPI, categoriesAPI } from '../services/api';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isHovered, setIsHovered] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(-320);
  const controls = useAnimation();

  // Animation function to start from current position
  const startAnimation = async (fromPosition = -320) => {
    if (featuredProducts.length === 0) return;
    
    const endPosition = -320 * (featuredProducts.length + 1);
    const distance = Math.abs(endPosition - fromPosition);
    const totalDistance = Math.abs(endPosition - (-320));
    const remainingDuration = (distance / totalDistance) * featuredProducts.length * 6;
    
    await controls.start({
      x: endPosition,
      transition: {
        duration: remainingDuration,
        ease: "linear"
      }
    });
    
    // Restart from beginning after reaching end
    if (!isHovered) {
      controls.set({ x: -320 });
      setCurrentPosition(-320);
      startAnimation(-320);
    }
  };

  // Start animation when products are loaded
  useEffect(() => {
    if (featuredProducts.length > 0 && !isHovered) {
      startAnimation(currentPosition);
    }
  }, [featuredProducts]);

  // Handle hover state
  useEffect(() => {
    if (isHovered) {
      controls.stop();
    } else if (featuredProducts.length > 0) {
      // Continue from current position
      startAnimation(currentPosition);
    }
  }, [isHovered]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch products and categories in parallel
        const [productsResponse, categoriesResponse] = await Promise.all([
          productsAPI.getAll(),
          categoriesAPI.getAll()
        ]);
        
        setFeaturedProducts(productsResponse.data.slice(0, 8));
        // Ensure categories is always an array
        setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data : []);
      } catch (err) {
        setError('Failed to load data');
        console.error('Error fetching data:', err);
        // Set empty arrays on error
        setFeaturedProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Get category background from category data or fallback to gradient
  const getCategoryBackground = (category) => {
    // Use primary image if available, otherwise fallback to gradient
    const primaryImage = category.primary_image || category.category_images?.[0]?.image_url;
    const gradient = category.gradient_colors || 'from-gray-400 to-gray-600';
    
    return {
      image: primaryImage,
      gradient: gradient
    };
  };

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
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
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

        <div className="relative z-10 container mx-auto px-1 text-center text-white">
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
              <span className="bg-gradient-to-r from-orange-400 to-blue-500 bg-clip-text text-transparent">
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
              Your one-stop shop for the finest dry fruits and nuts,
              handpicked for exceptional quality and guaranteed freshness
            </motion.p>
            
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <Link to="/products">
                <Button
                  size="lg"
                  className="bg-white text-gray-800 hover:bg-white/90 px-8 py-4 rounded-full font-semibold text-lg shadow-2xl hover:shadow-3xl transition-all duration-300 inline-flex items-center space-x-2"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              
              <motion.div
                className="flex items-center space-x-2 text-white/90"
                whileHover={{ scale: 1.02 }}
              >
                <div className="flex space-x-1">
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
        <div className="container mx-auto px-1">
          <motion.div className="text-center mb-16" {...fadeInUp}>
            <h2 className="text-4xl md:text-5xl font-bold text-primary-text mb-4">
              Shop by Category
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Explore our premium collection of handpicked dry fruits and nuts
            </p>
          </motion.div>
          
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6"
            variants={stagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
          >
            {(categories || []).map((category, index) => {
              const bgConfig = getCategoryBackground(category);
              return (
                <Link 
                  to="/products" 
                  state={{ selectedCategoryId: category.id }}
                  key={category.id || category.name}
                >
                  <motion.div
                    variants={fadeInUp}
                    whileHover={{ scale: 1.03, y: -3 }}
                    className="group cursor-pointer"
                  >
                    <Card className="relative h-48 overflow-hidden border-0 shadow-md hover:shadow-lg transition-all duration-300">
                      <div 
                        className={`absolute inset-0 bg-gradient-to-br ${bgConfig.gradient}`}
                        style={{
                          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.5)), url('${bgConfig.image}')`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                          backgroundBlendMode: 'overlay'
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <CardContent className="relative z-10 h-full p-6 flex flex-col justify-end text-center">
                        <h3 className="text-white font-bold text-xl mb-2 drop-shadow-lg">
                          {category.name}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className="mx-auto bg-white/20 text-white border-white/30 hover:bg-white/30"
                        >
                          Shop Now →
                        </Badge>
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              );
            })}
          </motion.div>
        </div>
      </motion.section>

      {/* Featured Products Section */}
      <motion.section className="section-padding bg-white" {...fadeInUp}>
        <div className="container mx-auto px-1">
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
              <div 
                className="relative overflow-hidden mb-12 py-6"
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
              >
                <motion.div 
                  className="flex gap-8 will-change-transform"
                  animate={controls}
                  onUpdate={(latest) => {
                    if (isHovered && latest.x !== undefined) {
                      setCurrentPosition(latest.x);
                    }
                  }}
                  style={{
                    width: `${(featuredProducts.length * 2 + 2) * 320}px`
                  }}
                >
                  {/* Duplicate products for seamless loop */}
                  {[...featuredProducts, ...featuredProducts, ...featuredProducts.slice(0, 2)].map((product, index) => (
                    <motion.div 
                      key={`${product.id}-${index}`} 
                      className="flex-shrink-0 w-80"
                      whileHover={{ 
                        scale: 1.02,
                        zIndex: 10
                      }}
                      transition={{ 
                        type: "spring",
                        stiffness: 300,
                        damping: 20
                      }}
                    >
                      <ProductCardNew product={product} />
                    </motion.div>
                  ))}
                </motion.div>
              </div>
              
              <motion.div className="text-center" {...fadeInUp}>
                <Link to="/products">
                  <Button
                    variant="outline"
                    size="lg"
                    className="inline-flex items-center space-x-2"
                  >
                    <span>View All Products</span>
                    <ArrowRight className="w-5 h-5" />
                  </Button>
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
        <div className="container mx-auto px-1">
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
                  whileHover={{ y: -8 }}
                  className="group"
                >
                  <Card className="text-center h-full border-0 shadow-md hover:shadow-xl transition-all duration-300">
                    <CardContent className="p-6">
                      <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted/30 ${feature.color} mb-6 group-hover:scale-110 transition-transform duration-300`}>
                        <IconComponent className="w-8 h-8" />
                      </div>
                      <h3 className="text-xl font-semibold mb-4">
                        {feature.title}
                      </h3>
                      <p className="text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </motion.section>
    </div>
  );
};

export default Home;