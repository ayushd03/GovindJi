import React, { useEffect } from 'react';

const TermsConditions = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="page-container py-12 md:py-16">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Terms & Conditions</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Agreement to Terms</h2>
            <p>
              By accessing and using the GovindJi Dry Fruits website, you accept and agree to be bound by the terms
              and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Product Information</h2>
            <p>
              We strive to provide accurate product descriptions and images. Minor variations in appearance, color,
              and composition may occur due to natural variations in dry fruits and other organic ingredients.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. Pricing and Availability</h2>
            <p>
              Prices are subject to change without notice. Products are available while supplies last. We do not
              guarantee the availability of any product at all times.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. User Accounts</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials. Please notify us
              immediately if you suspect unauthorized use of your account.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Contact Us</h2>
            <p>For any questions, please reach out to us:</p>
            <div className="space-y-2 ml-4">
              <p>Email: <a href="mailto:info@govindji.com" className="text-primary hover:underline">info@govindji.com</a></p>
              <p>Phone: <a href="tel:+919340637575" className="text-primary hover:underline">+91 93406 37575</a></p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsConditions;
