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
            <h2 className="text-2xl font-semibold">Shipping Policy</h2>
            <p>
              The orders for the user are shipped through registered domestic courier companies and/or speed post only. Orders are shipped within <strong>7 days</strong> from the date of the order and/or payment or as per the delivery date agreed at the time of order confirmation and delivering of the shipment, subject to courier company / post office norms.
            </p>
            <p>
              Platform Owner shall not be liable for any delay in delivery by the courier company / postal authority. Delivery of all orders will be made to the address provided by the buyer at the time of purchase.
            </p>
            <p>
              Delivery of our services will be confirmed on your email ID as specified at the time of registration. If there are any shipping cost(s) levied by the seller or the Platform Owner (as the case be), the same is not refundable.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Cancellation Policy</h2>
            <p>
              Cancellations will only be considered if the request is made within <strong>2 days</strong> of placing the order. However, cancellation requests may not be entertained if the orders have been communicated to such sellers/merchant(s) listed on the Platform and they have initiated the process of shipping them, or the product is out for delivery. In such an event, you may choose to reject the product at the doorstep.
            </p>
            <p>
              AARYASH AND COMPANY does not accept cancellation requests for perishable items like eatables, etc. However, a replacement can be made if the user establishes that the quality of the product delivered is not good.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Return & Exchange Policy</h2>
            <p>
              We offer exchanges within the first <strong>2 days</strong> from the date of your purchase. If 2 days have passed since your purchase, you will not be offered a return or exchange of any kind. <strong>No refunds will be offered.</strong>
            </p>
            <p>
              In order to become eligible for an exchange:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>The purchased item should be unused and in the same condition as you received it.</li>
              <li>The item must have original packaging.</li>
              <li>If the item that you purchased was on a sale, then the item may not be eligible for an exchange.</li>
              <li>Further, only such items are replaced by us (based on an exchange request), if such items are found defective or damaged.</li>
            </ul>
            <p>
              In case of receipt of damaged or defective items, or if you feel that the product received is not as shown on the site or as per your expectations, please report to our customer service team within <strong>2 days</strong> of receipt of the products.
            </p>
            <p>
              You agree that there may be a certain category of products/items that are exempted from returns or exchanges. Such categories of the products would be identified to you at the time of purchase.
            </p>
            <p>
              For exchange accepted request(s) (as applicable), once your returned product/item is received and inspected by us, we will send you an email to notify you about receipt of the returned/exchanged product. Further, if the same has been approved after the quality check at our end, your request will be processed in accordance with our policies.
            </p>
            <p>
              If you need to place an exchange request for an eligible product/item, please send us an email at <a href="mailto:info@govindji.com" className="text-primary hover:underline">info@govindji.com</a>.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">Contact Us</h2>
            <p>If you have any questions about this policy, please reach out to us:</p>
            <div className="space-y-2 ml-4">
              <p>Email: <a href="mailto:info@govindji.com" className="text-primary hover:underline">info@govindji.com</a></p>
              <p>Phone: <a href="tel:+919340637575" className="text-primary hover:underline">+91 93406 37575</a></p>
              <p>Address: 3, Marothia Bazar, Indore, Madhya Pradesh, India</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ShippingReturns;
