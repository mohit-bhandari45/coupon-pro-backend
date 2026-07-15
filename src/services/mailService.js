const { Resend } = require('resend');

const resendApiKey = process.env.RESEND_API_KEY;
const mailFrom = process.env.MAIL_FROM || '"RedPerks" <no-reply@redperks.in>';

let resend = null;

if (resendApiKey) {
    try {
        resend = new Resend(resendApiKey);
        console.log('⚡ [Mailer] Resend client initialized successfully.');
    } catch (err) {
        console.error('❌ [Mailer] Failed to configure Resend client:', err);
    }
} else {
    console.log('⚠️ [Mailer] RESEND_API_KEY missing. Using terminal simulation fallback.');
}

class MailService {
    static async sendMail({ to, subject, text, html }) {
        if (resend) {
            try {
                const { data, error } = await resend.emails.send({
                    from: mailFrom,
                    to,
                    subject,
                    text,
                    html
                });

                if (error) {
                    console.error(`❌ [Mailer] Error sending real email to ${to}:`, error);
                    return { success: false, error: error.message || String(error) };
                }

                console.log(`✉️ [Mailer] Real email sent successfully. Message ID: ${data.id}`);
                return { success: true, messageId: data.id };
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
Date/Time:   ${new Date(transaction.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
------------------------------------------

Thank you for choosing RedPerks!
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
                        <td style="padding: 10px; border: 1px solid #ddd;">${new Date(transaction.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
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
            <p style="margin-top: 15px; font-size: 12px; color: #666;">This is an automated invoice dispatch generated by RedPerks.</p>
        `;

        return this.sendMail({
            to: cafe.email,
            subject,
            text: invoiceText.trim(),
            html: invoiceHtml
        });
    }

    static async sendAuthOtp({ to, code }) {
        const subject = `🔑 Verification Code - RedPerks`;
        const text = `Your verification code is: ${code}. It is valid for 10 minutes.`;
        const html = `
            <h3>Verification Code</h3>
            <p>Your RedPerks verification code is: <strong style="font-size: 20px; color: #8b5cf6; letter-spacing: 2px;">${code}</strong></p>
            <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>
        `;
        return this.sendMail({ to, subject, text, html });
    }

    static async sendMerchantVerificationOtp({ to, code }) {
        const subject = `🔑 Merchant Email Verification - RedPerks`;
        const text = `Your merchant email verification code is: ${code}. It is valid for 10 minutes.`;
        const html = `
            <h3>Merchant Verification Code</h3>
            <p>Your RedPerks merchant verification code is: <strong style="font-size: 20px; color: #8b5cf6; letter-spacing: 2px;">${code}</strong></p>
            <p>This code is valid for 10 minutes. Please verify your email to unlock your owner dashboard.</p>
        `;
        return this.sendMail({ to, subject, text, html });
    }

    static async sendCouponCodeEmail({ to, code, title, desc_text, discount_type, discount_value, min_bill_amount }) {
        const subject = `🎁 Exclusive Promotion Code - RedPerks`;
        const ruleStr = discount_type === 'percent' ? `${discount_value}% Off` : `₹${discount_value} Off`;
        const minStr = min_bill_amount > 0 ? ` on bills above ₹${min_bill_amount}` : '';
        const text = `Congratulations! You have received a promo code: ${code}.
Title: ${title} (${desc_text})
Benefit: ${ruleStr}${minStr}.
Enter this code at any participating cafe checkout screen to apply your discount.`;

        const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px;">
                <h3 style="color: #111827; margin-bottom: 10px;">Congratulations! You've Received a Promo Code</h3>
                <p style="color: #4b5563; font-size: 14px;">You have been awarded an exclusive customer coupon code:</p>
                <div style="background-color: #f3f4f6; border-left: 4px solid #ef4444; padding: 15px; margin: 15px 0; border-radius: 4px;">
                    <p style="margin: 0 0 5px 0; font-size: 16px; font-weight: bold; color: #111827;">${title}</p>
                    <p style="margin: 0 0 10px 0; font-size: 14px; color: #4b5563;">${desc_text}</p>
                    <p style="margin: 0; font-size: 28px; font-weight: bold; color: #ef4444; letter-spacing: 1px;">${code}</p>
                </div>
                <p style="font-size: 14px; color: #111827;"><strong>Discount:</strong> ${ruleStr}${minStr}</p>
                <p style="font-size: 14px; color: #6b7280; margin-top: 15px;">Enter this code on the payment checkout page to apply your reward.</p>
                <p style="font-size: 12px; color: #9ca3af; margin-top: 25px; border-top: 1px solid #f3f4f6; padding-top: 10px;">This is an automated message sent by RedPerks.</p>
            </div>
        `;

        return this.sendMail({ to, subject, text, html });
    }
}

module.exports = MailService;