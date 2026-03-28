import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Award, Leaf, ShieldCheck, Star, Truck } from 'lucide-react';
import ProductCard from '../components/ProductCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { categoriesAPI, productsAPI } from '../services/api';
import { getImageUrl } from '../utils/imageUtils';

const brandPoints = [
  {
    icon: Award,
    title: 'Premium quality',
    description: 'Handpicked dry fruits and nuts selected for freshness and taste.',
  },
  {
    icon: Leaf,
    title: 'Freshly packed',
    description: 'A reliable range for daily use, festive gifting, and repeat orders.',
  },
  {
    icon: Truck,
    title: 'Clear delivery',
    description: 'Delivery charges and timelines are visible before the final order step.',
  },
  {
    icon: ShieldCheck,
    title: 'Simple checkout',
    description: 'Cleaner order flow with better summaries and order tracking.',
  },
];

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productsResponse, categoriesResponse] = await Promise.all([
          productsAPI.getAll(),
          categoriesAPI.getAll(),
        ]);

        setFeaturedProducts((productsResponse.data || []).slice(0, 4));
        setCategories(Array.isArray(categoriesResponse.data) ? categoriesResponse.data.slice(0, 5) : []);
      } catch (requestError) {
        setError('Failed to load storefront data.');
        setFeaturedProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const categoryCards = useMemo(
    () =>
      categories.map((category) => {
        const primaryImage = category.primary_image || category.category_images?.[0]?.image_url;
        return {
          ...category,
          image: primaryImage ? getImageUrl(primaryImage, 'category') : null,
          gradient: category.gradient_colors || 'from-[#526d41] to-[#2f4932]',
        };
      }),
    [categories]
  );

  if (loading) {
    return (
      <div className="page-shell-soft">
        <div className="page-container flex min-h-[70vh] items-center justify-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="h-10 w-10 rounded-full border-[3px] border-[#23442a]/15 border-t-[#23442a]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell-soft">
      <section className="relative flex min-h-[86vh] items-center overflow-hidden pt-24">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/hero_bgg.webp)` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(17,24,39,0.66),rgba(17,24,39,0.5))]" />

        <div className="page-container relative z-10 py-16">
          <div className="mx-auto max-w-4xl text-center text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.34em] text-white/70">
              GovindJi Dry Fruits
            </p>
            <h1 className="mt-6 font-heading text-[3.2rem] font-semibold leading-[0.96] tracking-[-0.05em] text-white sm:text-[4.5rem] lg:text-[5.2rem]">
              Premium dry fruits,
              <br />
              simply presented
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/84 sm:text-lg">
              Handpicked dry fruits and nuts with a cleaner storefront, clearer delivery visibility,
              and a simpler path from browsing to checkout.
            </p>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/products">
                <Button className="h-12 rounded-full bg-white px-7 text-sm font-semibold text-slate-900 hover:bg-white/92">
                  Shop Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/orders">
                <Button
                  variant="outline"
                  className="h-12 rounded-full border border-white/24 bg-transparent px-7 text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  Track Orders
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-white/82">
              <div className="flex items-center gap-1 text-[#f2d08a]">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <span>Trusted by repeat household buyers and gifting customers</span>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-18">
        <div className="page-container">
          <div className="mb-10 text-center">
            <p className="page-eyebrow">Shop by Category</p>
            <h2 className="mt-3 font-heading text-[2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">
              Browse by type
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {categoryCards.map((category) => (
              <Link
                key={category.id || category.name}
                to="/products"
                state={{ selectedCategoryId: category.id }}
                className="group"
              >
                <Card className="overflow-hidden rounded-[1.5rem] border-border/80 bg-white shadow-[0_14px_26px_rgba(15,23,42,0.05)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_18px_34px_rgba(15,23,42,0.08)]">
                  <div className="relative aspect-[4/4.8] overflow-hidden">
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className={`h-full w-full bg-gradient-to-br ${category.gradient}`} />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <p className="text-base font-semibold text-white">{category.name}</p>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#faf6ed] py-16 lg:py-18">
        <div className="page-container">
          <div className="mb-10 text-center">
            <p className="page-eyebrow">Featured Products</p>
            <h2 className="mt-3 font-heading text-[2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">
              Most ordered right now
            </h2>
          </div>

          {error ? (
            <div className="surface-card px-6 py-10 text-center">
              <p className="text-base font-medium text-rose-600">{error}</p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div className="mt-10 text-center">
            <Link to="/products">
              <Button
                variant="outline"
                className="h-11 rounded-full border border-slate-300 bg-white px-6 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                View All Products
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-white py-16 lg:py-18">
        <div className="page-container">
          <div className="mb-10 text-center">
            <p className="page-eyebrow">Why Choose Us</p>
            <h2 className="mt-3 font-heading text-[2rem] font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">
              Quality and clarity first
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {brandPoints.map((point) => {
              const Icon = point.icon;
              return (
                <Card key={point.title} className="rounded-[1.5rem] border-border/80 bg-[#fcfaf5]">
                  <CardContent className="p-6">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#23442a]/8 text-[#23442a]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-lg font-semibold text-foreground">{point.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">{point.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
