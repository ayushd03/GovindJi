import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Mail, MapPin, Phone, Facebook, Instagram, Twitter, ShieldCheck, Truck, RefreshCw, CreditCard } from 'lucide-react';

const shopLinks = [
  { name: 'All Products', href: '/products' },
  { name: 'Best Sellers', href: '/products?category=best-sellers' },
  { name: 'Gift Boxes', href: '/products?category=gifts' },
  { name: 'Corporate Gifting', href: '/contact' },
];

const customerServiceLinks = [
  { name: 'Track Order', href: '/orders' },
  { name: 'Shipping Policy', href: '/shipping' },
  { name: 'Contact Us', href: '/contact' },
];

const policiesLinks = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms & Conditions', href: '/terms' },
  { name: 'Disclaimer', href: '/terms' },
];

const Footer = () => {
  const [email, setEmail] = useState('');

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubscribe = (e) => {
    e.preventDefault();
    // Newsletter subscription logic would go here
    setEmail('');
    alert('Thank you for subscribing to our newsletter!');
  };

  return (
    <footer className="selection-inverse mt-14 border-t border-border/70 bg-[#112a17] text-white">
      {/* Features Banner */}
      <div className="border-b border-white/10 bg-[#17311f]">
        <div className="page-container py-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 divide-x divide-white/10">
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
              <ShieldCheck className="h-6 w-6 text-[#f59e0b]" />
              <div>
                <h4 className="text-sm font-semibold text-white">100% Secure</h4>
                <p className="text-xs text-white/60">Safe encrypted payments</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
              <Truck className="h-6 w-6 text-[#f59e0b]" />
              <div>
                <h4 className="text-sm font-semibold text-white">Pan India Delivery</h4>
                <p className="text-xs text-white/60">Fast shipping in 7 days</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
              <RefreshCw className="h-6 w-6 text-[#f59e0b]" />
              <div>
                <h4 className="text-sm font-semibold text-white">Easy Exchanges</h4>
                <p className="text-xs text-white/60">2-day exchange policy</p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2 text-center px-4">
              <CreditCard className="h-6 w-6 text-[#f59e0b]" />
              <div>
                <h4 className="text-sm font-semibold text-white">Multiple Payment</h4>
                <p className="text-xs text-white/60">UPI, Cards, NetBanking</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.5fr]">
          {/* Brand Info */}
          <div className="space-y-5">
            <h3 className="font-heading text-2xl font-bold tracking-wide text-white">
              GovindJi Dry Fruits
            </h3>
            <p className="text-sm leading-relaxed text-white/70">
              Your trusted source for premium dry fruits, nuts, and healthy snacks. We bring you handpicked quality directly from the best farms, ensuring freshness and purity in every bite.
            </p>
            <div className="flex items-center gap-4 pt-2">
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all hover:bg-[#f59e0b] hover:text-[#112a17]" aria-label="Facebook">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all hover:bg-[#f59e0b] hover:text-[#112a17]" aria-label="Instagram">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="#" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-white transition-all hover:bg-[#f59e0b] hover:text-[#112a17]" aria-label="Twitter">
                <Twitter className="h-5 w-5" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-6">Shop</h4>
            <ul className="space-y-3 text-sm text-white/70">
              {shopLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-[#f59e0b] transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer Service */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-6">Customer Help</h4>
            <ul className="space-y-3 text-sm text-white/70">
              {customerServiceLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-[#f59e0b] transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-6">Legal</h4>
            <ul className="space-y-3 text-sm text-white/70">
              {policiesLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-[#f59e0b] transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact & Newsletter */}
          <div className="space-y-6">
            <div>
              <h4 className="text-sm font-bold uppercase tracking-wider text-white mb-6">Stay Connected</h4>
              <p className="text-sm text-white/70 mb-4">
                Subscribe to receive updates, access to exclusive deals, and more.
              </p>
              <form onSubmit={handleSubscribe} className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                  className="w-full rounded-md border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#f59e0b] focus:outline-none focus:ring-1 focus:ring-[#f59e0b]"
                />
                <button
                  type="submit"
                  className="whitespace-nowrap rounded-md bg-[#f59e0b] px-6 py-2.5 text-sm font-semibold text-[#112a17] transition-all hover:bg-[#d98b09]"
                >
                  Subscribe
                </button>
              </form>
            </div>
            
            <div className="pt-2 space-y-3 text-sm text-white/70">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 shrink-0 text-[#f59e0b]" />
                <p className="leading-relaxed">
                  3, Marothia Bazar,<br />
                  Near Bajaj Khaana Chowk,<br />
                  Indore, MP 452002
                </p>
              </div>
              <a href="tel:+919340637575" className="flex items-center gap-3 hover:text-[#f59e0b] transition-colors">
                <Phone className="h-4 w-4 shrink-0 text-[#f59e0b]" />
                <span>+91 93406 37575</span>
              </a>
              <a href="mailto:info@govindji.com" className="flex items-center gap-3 hover:text-[#f59e0b] transition-colors">
                <Mail className="h-4 w-4 shrink-0 text-[#f59e0b]" />
                <span>info@govindji.com</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#0d2213]">
        <div className="page-container flex flex-col gap-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1 text-sm text-white/50">
            <p>&copy; {new Date().getFullYear()} GovindJi Dry Fruits. All rights reserved.</p>
            <p className="text-xs">Owned & Operated by AARYASH AND COMPANY</p>
          </div>
          
          {/* Mock Payment Icons */}
          <div className="flex items-center gap-3 opacity-60">
             <div className="h-6 w-10 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold">UPI</div>
             <div className="h-6 w-10 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold">VISA</div>
             <div className="h-6 w-10 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold">MC</div>
          </div>

          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/12 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors sm:self-auto uppercase tracking-wider"
            type="button"
            aria-label="Scroll to top"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
