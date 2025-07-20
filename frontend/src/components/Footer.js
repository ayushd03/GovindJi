import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Instagram, 
  Youtube,
  Heart,
  ArrowUp
} from 'lucide-react';

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fadeInUp = {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: "easeOut" },
    viewport: { once: true }
  };

  const stagger = {
    whileInView: {
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  return (
    <footer className="bg-footer-bg text-white mt-auto">
      {/* Main Footer Content */}
      <motion.div 
        className="container mx-auto px-2 pt-16 pb-16"
        variants={stagger}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <motion.div variants={fadeInUp} className="space-y-6">
            <div>
              <img 
                src="/Govindji_Logo.webp" 
                alt="GovindJi Dry Fruits" 
                className="h-12 w-auto mb-4 filter brightness-0 invert"
              />
              <h3 className="text-xl font-bold text-primary-accent mb-3">
                GovindJi Dry Fruits
              </h3>
              <p className="text-gray-300 leading-relaxed">
                Your trusted destination for premium quality dry fruits and nuts. 
                Serving customers with excellence since years.
              </p>
            </div>
            
            {/* Social Media */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-primary-accent">Follow Us</h4>
              <div className="flex space-x-4">
                {[
                  { icon: Facebook, href: '#', label: 'Facebook' },
                  { icon: Instagram, href: '#', label: 'Instagram' },
                  { icon: Twitter, href: '#', label: 'Twitter' },
                  { icon: Youtube, href: '#', label: 'YouTube' }
                ].map((social) => {
                  const IconComponent = social.icon;
                  return (
                    <motion.a
                      key={social.label}
                      href={social.href}
                      whileHover={{ scale: 1.1, y: -2 }}
                      whileTap={{ scale: 0.9 }}
                      className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-primary-accent transition-all duration-300"
                      aria-label={social.label}
                    >
                      <IconComponent className="w-5 h-5" />
                    </motion.a>
                  );
                })}
              </div>
            </div>
          </motion.div>

          {/* Quick Links */}
          <motion.div variants={fadeInUp}>
            <h4 className="text-lg font-semibold mb-6 text-primary-accent">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { name: 'All Products', href: '/products' },
                { name: 'Featured Products', href: '/products?featured=true' },
                { name: 'Best Sellers', href: '/products?bestseller=true' },
                { name: 'New Arrivals', href: '/products?new=true' },
                { name: 'Gift Hampers', href: '/products?category=gifts' }
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-primary-accent transition-colors duration-300 inline-flex items-center group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform duration-300">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Customer Service */}
          <motion.div variants={fadeInUp}>
            <h4 className="text-lg font-semibold mb-6 text-primary-accent">Customer Service</h4>
            <ul className="space-y-3">
              {[
                { name: 'Help Center', href: '/help' },
                { name: 'Shipping Information', href: '/shipping' },
                { name: 'Returns & Exchanges', href: '/returns' },
                { name: 'Size Guide', href: '/size-guide' },
                { name: 'Track Your Order', href: '/track-order' },
                { name: 'FAQ', href: '/faq' }
              ].map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-gray-300 hover:text-primary-accent transition-colors duration-300 inline-flex items-center group"
                  >
                    <span className="group-hover:translate-x-1 transition-transform duration-300">
                      {link.name}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Contact Info */}
          <motion.div variants={fadeInUp}>
            <h4 className="text-lg font-semibold mb-6 text-primary-accent">Get In Touch</h4>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-primary-accent mt-1 flex-shrink-0" />
                <div>
                  <p className="text-gray-300 leading-relaxed">
                    PV82+M8J, Marothia Bazar,<br />
                    Bartan Bazar, Indore,<br />
                    Madhya Pradesh 452002
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <Phone className="w-5 h-5 text-primary-accent flex-shrink-0" />
                <a 
                  href="tel:+919340637575" 
                  className="text-gray-300 hover:text-primary-accent transition-colors duration-300"
                >
                  093406 37575
                </a>
              </div>
              
              <div className="flex items-center space-x-3">
                <Mail className="w-5 h-5 text-primary-accent flex-shrink-0" />
                <a 
                  href="mailto:info@govindjidryfruit.com" 
                  className="text-gray-300 hover:text-primary-accent transition-colors duration-300"
                >
                  info@govindjidryfruit.com
                </a>
              </div>
              
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-primary-accent mt-1 flex-shrink-0">🕐</div>
                <div>
                  <p className="text-gray-300 leading-relaxed">
                    Closed ⋅ Opens 9 am Mon
                  </p>
                </div>
              </div>
            </div>

            {/* Newsletter Signup */}
            <div className="mt-6">
              <h5 className="text-sm font-semibold mb-3 text-primary-accent">Newsletter</h5>
              <div className="flex">
                <input
                  type="email"
                  placeholder="Your email address"
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-l-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary-accent transition-colors duration-300"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 bg-primary-accent text-white rounded-r-lg hover:bg-secondary-accent transition-colors duration-300 font-medium"
                >
                  Subscribe
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Footer Bottom */}
      <motion.div 
        className="border-t border-white/10 bg-black/20 py-6"
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        viewport={{ once: true }}
      >
        <div className="container mx-auto px-2">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-2 text-gray-300">
              <span>&copy; 2025 GovindJi Dry Fruits. All rights reserved.</span>
            </div>
            
            <div className="flex items-center space-x-6">
              <Link 
                to="/privacy" 
                className="text-gray-300 hover:text-primary-accent transition-colors duration-300 text-sm"
              >
                Privacy Policy
              </Link>
              <Link 
                to="/terms"
                className="text-gray-300 hover:text-primary-accent transition-colors duration-300 text-sm"
              >
                Terms & Conditions
              </Link>
              <motion.button
                onClick={scrollToTop}
                whileHover={{ scale: 1.1, y: -2 }}
                whileTap={{ scale: 0.9 }}
                className="w-10 h-10 bg-primary-accent rounded-full flex items-center justify-center hover:bg-secondary-accent transition-all duration-300 shadow-lg"
                aria-label="Scroll to top"
              >
                <ArrowUp className="w-5 h-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};

export default Footer;