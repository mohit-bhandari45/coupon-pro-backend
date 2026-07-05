const nodemailer = require('nodemailer');

// Create transporter option based on ENV variables
const smtpHost = process.env.SMTP_HOST;
const smtpPort = parseInt(process.env.SMTP_PORT || '587');
const smtpSecure = process.env.SMTP_SECURE === 'true'; // true for 465, false for other ports
const smtpUser = process.env.SMTP_USER;
const smtpPass = process.env.SMTP_PASS;
const mailFrom = process.env.MAIL_FROM || '"Cafe Loyalty" <no-reply@cafeloyalty.com>';

let transporter = null;

if (smtpHost && smtpUser && smtpPass) {
    try {
        transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpUser,
                pass: smtpPass
            }
        });
        console.log('⚡ [Mailer] Nodemailer SMTP Mail transporter initialized successfully.');
    } catch (err) {
        console.error('❌ [Mailer] Failed to configure Nodemailer transporter:', err);
    }
} else {
    console.log('⚠️ [Mailer] SMTP credentials missing. Using terminal simulation fallback.');
}

class MailService {
    static async sendMail({ to, subject, text, html }) {
        if (transporter) {
            try {
                const info = await transporter.sendMail({
                    from: mailFrom,
                    to,
                    subject,
                    text,
                    html
                });
                console.log(`✉️ [Mailer] Real email sent successfully. Message ID: ${info.messageId}`);
                return { success: true, messageId: info.messageId };
            } catch (err) {
                console.error(`❌ [Mailer] Error sending real email to ${to}:`, err);
                return { success: false, error: err.message };
            }
        } else {
            console.log(`
┌────────────────────────────────────────────────────────┐
│ ✉️  [SIMULATED MAIL DISPATCH]                          │
├────────────────────────────────────────────────────────┤
│ To:      ${to.padEnd(46)} │
│ Subject: ${subject.substring(0, 46).padEnd(46)} │
├────────────────────────────────────────────────────────┤
\n${text.split('\n').map(line => `│ ${line.substring(0, 54).padEnd(54)} │`).join('\n')}
\n└────────────────────────────────────────────────────────┘
            `);
            return { success: true, simulated: true };
        }
    }

    static async sendCafeOwnerInvoice({ cafe, customerEmail, couponTitle, transaction }) {
        const subject = `☕ Loyalty Coupon Redeemed - ${cafe.name}`;

        const invoiceText = `
Hello ${cafe.owner_name},

A loyalty coupon has been successfully redeemed at your cafe: ${cafe.name}.

Transaction Details:
------------------------------------------
Receipt ID:  ${transaction.id}
Coupon:      ${couponTitle || 'None'}
Customer:    ${customerEmail || 'Guest Customer'}
Bill Total:  ₹${parseFloat(transaction.bill_amount).toFixed(2)}
Discount:    -₹${parseFloat(transaction.discount_amount).toFixed(2)}
Paid Amount: ₹${parseFloat(transaction.payable_amount).toFixed(2)}
Date/Time:   ${new Date(transaction.created_at).toLocaleString()}
------------------------------------------

Thank you for choosing Cafe Loyalty!
`;

        const invoiceHtml = `
            <h3>Hello ${cafe.owner_name},</h3>
            <p>A loyalty coupon has been successfully redeemed at your cafe: <strong>${cafe.name}</strong>.</p>
            <table style="border: 1px solid #ccc; width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="padding: 10px; border: 1px solid #ddd; text-align: left;" colspan="2">Redemption Invoice</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Receipt ID:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${transaction.id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Date/Time:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${new Date(transaction.created_at).toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Coupon:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${couponTitle || 'None'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Customer:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">${customerEmail || 'Guest Customer'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Bill Total:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">₹${parseFloat(transaction.bill_amount).toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; color: #d9534f;"><strong>Discount Applied:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd; color: #d9534f;">-₹${parseFloat(transaction.discount_amount).toFixed(2)}</td>
                    </tr>
                    <tr style="font-weight: bold; background-color: #fafafa;">
                        <td style="padding: 10px; border: 1px solid #ddd; font-size: 16px;"><strong>Paid Amount:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd; font-size: 16px;">₹${parseFloat(transaction.payable_amount).toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
            <p style="margin-top: 15px; font-size: 12px; color: #666;">This is an automated invoice dispatch generated by Cafe Loyalty.</p>
        `;

        return this.sendMail({
            to: cafe.email,
            subject,
            text: invoiceText.trim(),
            html: invoiceHtml
        });
    }
}

module.exports = MailService;
