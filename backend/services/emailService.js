const nodemailer = require('nodemailer');

/**
 * Email Service for sending payment notifications
 * Supports payment success and failure emails
 */
class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }

  /**
   * Send payment success email
   */
  async sendPaymentSuccessEmail(orderDetails, transactionDetails) {
    try {
      const { customer_email, id: orderId, total_amount, order_items } = orderDetails;
      const { merchantTransactionId, completedAt } = transactionDetails;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; }
            .order-details { background: white; padding: 15px; margin: 20px 0; border-radius: 5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background: #f0f0f0; font-weight: bold; }
            .success-icon { font-size: 48px; color: #4CAF50; text-align: center; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Successful!</h1>
            </div>
            <div class="content">
              <div class="success-icon">✓</div>
              <p>Dear Customer,</p>
              <p>Thank you for your purchase at <strong>Govind Ji Dry Fruits</strong>. Your payment has been received successfully.</p>

              <div class="order-details">
                <h3>Order Details</h3>
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>Transaction ID:</strong> ${merchantTransactionId}</p>
                <p><strong>Amount Paid:</strong> ₹${parseFloat(total_amount).toFixed(2)}</p>
                <p><strong>Payment Date:</strong> ${new Date(completedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>

                ${order_items && order_items.length > 0 ? `
                <h4>Items Ordered:</h4>
                <table>
                  <tr>
                    <th>Product</th>
                    <th>Quantity</th>
                    <th>Price</th>
                  </tr>
                  ${order_items.map(item => `
                    <tr>
                      <td>${item.products?.name || 'Product'}</td>
                      <td>${item.quantity}</td>
                      <td>₹${parseFloat(item.price).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </table>
                ` : ''}
              </div>

              <p>Your order is being processed and will be shipped soon. You can track your order status in the <a href="${process.env.FRONTEND_URL}/orders">My Orders</a> section.</p>

              <p>If you have any questions, please contact our support team.</p>

              <p>Thank you for shopping with us!</p>
              <p><strong>Govind Ji Dry Fruits</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Govind Ji Dry Fruits. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: `"Govind Ji Dry Fruits" <${process.env.SMTP_FROM_EMAIL}>`,
        to: customer_email,
        subject: `Order Confirmation - ${orderId}`,
        html: emailHtml
      });

      console.log('Payment success email sent to:', customer_email);
    } catch (error) {
      console.error('Failed to send payment success email:', error);
      throw error;
    }
  }

  /**
   * Send payment failure email
   */
  async sendPaymentFailureEmail(orderDetails, transactionDetails) {
    try {
      const { customer_email, id: orderId, total_amount } = orderDetails;
      const { merchantTransactionId, error_details } = transactionDetails;

      const retryUrl = `${process.env.FRONTEND_URL}/orders`;

      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #f44336; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background: #f9f9f9; padding: 20px; }
            .alert-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
            .retry-button { display: inline-block; background: #4CAF50; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            .failed-icon { font-size: 48px; color: #f44336; text-align: center; margin: 20px 0; }
            ul { margin: 10px 0; padding-left: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Failed</h1>
            </div>
            <div class="content">
              <div class="failed-icon">✗</div>
              <p>Dear Customer,</p>
              <p>We regret to inform you that your recent payment attempt was unsuccessful.</p>

              <div class="alert-box">
                <h3>Transaction Details</h3>
                <p><strong>Order ID:</strong> ${orderId}</p>
                <p><strong>Transaction ID:</strong> ${merchantTransactionId}</p>
                <p><strong>Amount:</strong> ₹${parseFloat(total_amount).toFixed(2)}</p>
                ${error_details ? `<p><strong>Reason:</strong> ${error_details.message || 'Payment declined'}</p>` : ''}
              </div>

              <p>Don't worry! Your order is still saved and you can retry the payment at any time.</p>

              <center>
                <a href="${retryUrl}" class="retry-button">View Orders & Retry Payment</a>
              </center>

              <h3>Common Reasons for Payment Failure:</h3>
              <ul>
                <li>Insufficient balance in your account</li>
                <li>Incorrect payment details</li>
                <li>Network connectivity issues</li>
                <li>Bank server temporarily down</li>
                <li>Payment timeout</li>
              </ul>

              <p>If you continue to experience issues, please try a different payment method or contact your bank.</p>

              <p>For assistance, please reach out to our support team.</p>

              <p>Thank you,<br><strong>Govind Ji Dry Fruits</strong></p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} Govind Ji Dry Fruits. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.transporter.sendMail({
        from: `"Govind Ji Dry Fruits" <${process.env.SMTP_FROM_EMAIL}>`,
        to: customer_email,
        subject: `Payment Failed - Order ${orderId}`,
        html: emailHtml
      });

      console.log('Payment failure email sent to:', customer_email);
    } catch (error) {
      console.error('Failed to send payment failure email:', error);
      throw error;
    }
  }
}

module.exports = new EmailService();
