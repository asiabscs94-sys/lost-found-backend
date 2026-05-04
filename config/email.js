const nodemailer = require('nodemailer');

/**
 * Sends an email using Gmail SMTP.
 * Requires EMAIL_USER and EMAIL_PASS (App Password) in .env
 */
const sendEmail = async (options) => {
    try {
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 465,
            secure: true, // use SSL
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        const mailOptions = {
            from: `"REUNITEDLY Support" <${process.env.EMAIL_USER}>`,
            to: options.email,
            subject: options.subject,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        
        // Check if the recipient was accepted
        if (info.rejected.length > 0) {
            console.log(`❌ Email rejected by recipient: ${options.email}`);
            return { success: false, message: 'Invalid or non-existent Gmail address.' };
        }

        console.log(`✅ Actual Email Delivered to: ${options.email}`);
        return { success: true, info };
    } catch (error) {
        console.error('❌ Gmail Delivery Failed:', error.message);
        
        // Handle specific SMTP errors
        if (error.code === 'EENVELOPE' || error.responseCode === 550) {
            return { success: false, message: 'The Gmail address you entered does not exist.' };
        }
        
        throw new Error(error.message || 'Email delivery failed.');
    }
};

module.exports = sendEmail;
