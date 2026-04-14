import React, { useEffect } from 'react';

const PrivacyPolicy = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="page-container py-12 md:py-16">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">Last updated: March 2026</p>
        </div>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">1. Introduction</h2>
            <p>
              GovindJi Dry Fruits ("we", "us", "our") operates the website. This page informs you of our policies
              regarding the collection, use, and disclosure of personal data when you use our service and the choices
              you have associated with that data.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">2. Information We Collect</h2>
            <p>
              We collect information necessary to process your orders and improve your experience, including your name,
              contact details, address, and payment information. We also collect usage data to enhance our service.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">3. How We Use Your Information</h2>
            <p>
              Your information is used to process and deliver your orders, provide customer support, send order updates,
              and improve our website and services.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">4. Security of Data</h2>
            <p>
              The security of your data is important to us but remember that no method of transmission over the Internet
              or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to
              protect your personal data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">5. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal information. Please contact us if you have
              any concerns about how your data is being handled.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">6. Contact Us</h2>
            <p>If you have any questions about this privacy policy, please contact us at:</p>
            <div className="space-y-2 ml-4">
              <p>Email: <a href="mailto:info@govindji.com" className="text-primary hover:underline">info@govindji.com</a></p>
              <p>Phone: <a href="tel:+919340637575" className="text-primary hover:underline">+91 93406 37575</a></p>
              <p>Address: Near Bajaj Khaana Chowk, Marothia Bazar, Indore, MP 452002</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
