import React, { useEffect } from 'react';

const ShippingReturns = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="page-container py-12 md:py-16">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Shipping & Returns</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Shipping Information</h2>

            <h3 className="text-lg font-semibold">Delivery Areas & Timeline</h3>
            <p>
              We deliver across India. Delivery times vary based on your location. Most orders are dispatched within
              1-2 business days and delivered within 2-7 business days depending on your area.
            </p>

            <h3 className="text-lg font-semibold">Order Tracking</h3>
            <p>
              Once your order is dispatched, you'll receive a tracking number via email to monitor your shipment.
            </p>

            <h3 className="text-lg font-semibold">Product Storage</h3>
            <p>
              Our dry fruits are carefully packaged to maintain freshness. Store them in a cool, dry place away
              from direct sunlight for best quality.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Returns Policy</h2>

            <p className="italic">
              We believe in standing behind our products with a generous return policy. If you're not completely
              satisfied with your order, we'll work with you to find a solution.
            </p>

            <p>
              We evaluate each return on a case-by-case basis to ensure fair treatment for both our customers and
              business. Factors we consider include product condition, delivery status, and order specifics.
            </p>

            <p>
              If you have a concern about your order or wish to initiate a return, please contact us with details
              about your situation:
            </p>

            <div className="space-y-2 ml-4">
              <p>📧 Email: <a href="mailto:info@govindji.com" className="text-primary hover:underline">info@govindji.com</a></p>
              <p>📞 Phone: <a href="tel:+919340637575" className="text-primary hover:underline">+91 93406 37575</a></p>
            </div>

            <p className="text-sm text-muted-foreground">
              Open 7 days a week. We'll get back to you promptly and work towards a resolution that works for you.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Damaged or Defective Products</h2>
            <p>
              If your order arrives damaged or defective, please contact us immediately with photos of the issue.
              We'll arrange a replacement or refund right away at no cost to you.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ShippingReturns;
