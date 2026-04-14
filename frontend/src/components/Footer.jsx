import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Mail, MapPin, Phone } from 'lucide-react';

const shopLinks = [
  { name: 'Home', href: '/' },
  { name: 'All Products', href: '/products' },
  { name: 'My Orders', href: '/orders' },
];

const policiesLinks = [
  { name: 'Privacy Policy', href: '/privacy' },
  { name: 'Terms & Conditions', href: '/terms' },
  { name: 'Shipping & Returns', href: '/shipping' },
];

const Footer = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="selection-inverse mt-14 border-t border-border/70 bg-[#17311f] text-white">
      <div className="page-container py-12">
        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr_0.75fr_1fr]">
          <div className="space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              GovindJi Dry Fruits
            </p>
            <h3 className="max-w-sm font-heading text-2xl font-semibold leading-tight text-white">
              Dry fruits online, without the guesswork.
            </h3>
            <p className="max-w-md text-sm leading-7 text-white/68">
              Check exact pack sizes, delivery timelines, and final pricing before checkout,
              then reorder your regular basket in minutes.
            </p>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Shop</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              {shopLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-white">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Legal</h4>
            <ul className="mt-4 space-y-3 text-sm text-white/75">
              {policiesLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.href} className="hover:text-white">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Contact</h4>
            <div className="mt-4 space-y-3.5 text-sm text-white/75">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-white/45" />
                <p className="leading-6">
                  Near Bajaj Khaana Chowk, Marothia Bazar, Indore
                  <br />
                  MP 452002
                </p>
              </div>
              <a href="tel:+919340637575" className="flex items-center gap-3 hover:text-white">
                <Phone className="h-4 w-4 shrink-0 text-white/45" />
                <span>+91 93406 37575</span>
              </a>
              <a href="mailto:info@govindji.com" className="flex items-center gap-3 hover:text-white">
                <Mail className="h-4 w-4 shrink-0 text-white/45" />
                <span>info@govindji.com</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-[#132819]">
        <div className="page-container flex flex-col gap-3 py-4 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 GovindJi Dry Fruits. All rights reserved.</p>
          <button
            onClick={scrollToTop}
            className="inline-flex items-center gap-2 self-start rounded-full border border-white/12 px-4 py-2 text-white/70 hover:bg-white/5 hover:text-white sm:self-auto"
            type="button"
          >
            <ArrowUp className="h-4 w-4" />
            Back to top
          </button>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
