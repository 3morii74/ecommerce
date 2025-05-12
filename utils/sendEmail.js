const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
  const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.BREVO_SMTP_USER, // SMTP login (e.g., 899b30001@smtp-brevo.com)
      pass: process.env.BREVO_SMTP_KEY,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  console.log('SMTP Config (Brevo):', {
    host: 'smtp-relay.brevo.com',
    port: 587,
    user: process.env.BREVO_SMTP_USER,
    pass: process.env.BREVO_SMTP_KEY ? '[hidden]' : 'undefined',
  });

  const mailOpts = {
    from: `Dodo's Bakes <${process.env.BREVO_SENDER_EMAIL}>`, // Use the verified sender email
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html || `<p>${options.message.replace(/\n/g, '<br>')}</p>`, // Use provided html, or fallback to message
  };

  console.log('Sending email with details:', {
    from: mailOpts.from,
    to: mailOpts.to,
    subject: mailOpts.subject,
  });

  try {
    const info = await transporter.sendMail(mailOpts);
    console.log(`Email sent successfully to ${options.email}. Message ID: ${info.messageId}`);
    console.log('SMTP Response:', info.response);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw new Error('Failed to send email');
  }
};

module.exports = sendEmail;