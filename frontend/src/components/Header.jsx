import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Menu, Search, ShoppingCart, User, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import AuthModal from './AuthModal';

const navLinks = [
  { label: 'Home', href: '/' },
  { label: 'Products', href: '/products' },
];

const Header = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const { getCartItemsCount, toggleCartPopup } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const cartItemsCount = getCartItemsCount();
  const displayName = useMemo(
    () => user?.user_metadata?.name || user?.email?.split('@')[0] || 'Account',
    [user]
  );

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (location.pathname === '/products' || location.pathname.startsWith('/products/')) {
      const params = new URLSearchParams(location.search);
      const searchFromUrl = params.get('search') || '';
      setSearchTerm((previous) => (previous === searchFromUrl ? previous : searchFromUrl));
      return;
    }

    setSearchTerm((previous) => (previous === '' ? previous : ''));
  }, [location.pathname, location.search]);

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsUserMenuOpen(false);
  };

  const handleSearch = (event) => {
    event.preventDefault();
    const normalizedSearch = searchTerm.trim();
    const nextPath = normalizedSearch
      ? `/products?search=${encodeURIComponent(normalizedSearch)}`
      : '/products';
    const currentPathWithSearch = `${location.pathname}${location.search}`;

    if (currentPathWithSearch !== nextPath) {
      navigate(nextPath);
    }
    setIsMenuOpen(false);
  };

  const isActiveLink = (href) => (
    href === '/'
      ? location.pathname === '/'
      : location.pathname === href || location.pathname.startsWith(`${href}/`)
  );

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b border-border/70 transition-all duration-200 ${
          isScrolled
            ? 'bg-[rgba(255,253,248,0.96)] shadow-[0_18px_40px_rgba(15,23,42,0.06)] backdrop-blur-xl'
            : 'bg-[rgba(255,253,248,0.88)] backdrop-blur-lg'
        }`}
      >
        <div className="page-container">
          <div className="grid h-[74px] grid-cols-[auto_1fr_auto] items-center gap-3 lg:gap-5 xl:gap-6">
            <Link to="/" className="flex shrink-0 items-center">
              <img
                src="/Govindji_Logo.webp"
                alt="GovindJi Dry Fruits"
                className="h-12 w-auto sm:h-14"
              />
            </Link>

            <div className="hidden min-w-0 justify-center lg:flex">
              <form onSubmit={handleSearch} className="relative w-full max-w-[460px] xl:max-w-[560px]">
                <input
                  type="text"
                  placeholder="Search products"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  className="input-field w-full min-w-0 rounded-full border-border/80 bg-white/95 pl-10 pr-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"
                />
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </form>
            </div>

            <div className="hidden shrink-0 items-center justify-end gap-1.5 lg:flex xl:gap-2">
              <nav className="flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    className={`inline-flex items-center rounded-full px-3.5 py-2 text-sm font-semibold transition-colors xl:px-4 ${
                      isActiveLink(link.href)
                        ? 'bg-[#23442a] text-white'
                        : 'text-slate-600 hover:bg-[#23442a]/6 hover:text-[#16221a]'
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>

              {isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setIsUserMenuOpen((current) => !current)}
                    className="inline-flex h-11 items-center gap-2 rounded-full border border-border/80 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#23442a]/15 hover:text-[#16221a] xl:px-4"
                    type="button"
                  >
                    <User className="h-4 w-4 text-[#23442a]" />
                    <span className="max-w-[124px] truncate xl:max-w-[148px]">{displayName}</span>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>

                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        className="absolute right-0 mt-2 w-52 overflow-hidden rounded-2xl border border-border/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                      >
                        <div className="border-b border-border/70 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                            Signed in
                          </p>
                          <p className="mt-1 truncate text-sm font-semibold text-foreground">{displayName}</p>
                        </div>
                        <div className="p-2">
                          <Link
                            to="/orders"
                            className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-muted/60 hover:text-foreground"
                          >
                            My Orders
                          </Link>
                          {(user?.role === 'admin' || user?.role === 'manager') && (
                            <Link
                              to="/admin"
                              className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 hover:bg-muted/60 hover:text-foreground"
                            >
                              Admin Panel
                            </Link>
                          )}
                          <button
                            onClick={handleLogout}
                            className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                            type="button"
                          >
                            Logout
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="inline-flex h-11 items-center rounded-full border border-border/80 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-[#23442a]/15 hover:text-[#16221a] xl:px-4"
                  type="button"
                >
                  <User className="mr-2 h-4 w-4 text-[#23442a]" />
                  Sign In
                </button>
              )}

              <button
                onClick={toggleCartPopup}
                className="premium-cart-btn relative inline-flex h-11 items-center gap-2 rounded-full bg-[#23442a] px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#1d3722] xl:px-4"
                type="button"
              >
                <ShoppingCart className="h-4 w-4" data-cart-icon />
                <span>Cart</span>
                {cartItemsCount > 0 && (
                  <span className="inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-white px-1.5 py-0.5 text-[11px] font-bold text-[#23442a]">
                    {cartItemsCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-2 justify-self-end lg:hidden">
              <button
                onClick={toggleCartPopup}
                className="premium-cart-btn relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-white text-slate-700 shadow-sm"
                type="button"
                aria-label="Open cart"
              >
                <ShoppingCart className="h-4 w-4" data-cart-icon />
                {cartItemsCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[#23442a] px-1 py-0.5 text-[10px] font-bold text-white">
                    {cartItemsCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setIsMenuOpen((current) => !current)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/80 bg-white text-slate-700 shadow-sm"
                type="button"
                aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              >
                {isMenuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="border-t border-border/70 bg-[rgba(255,253,248,0.98)] lg:hidden"
            >
              <div className="page-container space-y-4 py-3.5">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    placeholder="Search products"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="input-field w-full rounded-full border-border/80 bg-white pl-10 pr-4"
                  />
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </form>

                <div className="grid gap-2">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
                        isActiveLink(link.href)
                          ? 'bg-[#23442a] text-white'
                          : 'bg-white text-slate-700'
                      }`}
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>

                {isAuthenticated ? (
                  <div className="rounded-[1.4rem] border border-border/80 bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Account
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{displayName}</p>
                    <div className="mt-3 grid gap-2">
                      <Link to="/orders" className="rounded-xl bg-muted/45 px-3 py-2.5 text-sm font-medium text-slate-700">
                        My Orders
                      </Link>
                      {(user?.role === 'admin' || user?.role === 'manager') && (
                        <Link to="/admin" className="rounded-xl bg-muted/45 px-3 py-2.5 text-sm font-medium text-slate-700">
                          Admin Panel
                        </Link>
                      )}
                      <button
                        onClick={handleLogout}
                        className="rounded-xl bg-rose-50 px-3 py-2.5 text-left text-sm font-medium text-rose-600"
                        type="button"
                      >
                        Logout
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false);
                      setIsAuthModalOpen(true);
                    }}
                    className="store-button-primary w-full"
                    type="button"
                  >
                    Sign In
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};

export default Header;
