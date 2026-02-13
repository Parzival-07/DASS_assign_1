const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized: false
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000
});

async function sendTicketEmail(recipientEmail, ticketData) {
  const qrData = encodeURIComponent(JSON.stringify({
    ticketId: ticketData.ticketId,
    eventId: ticketData.eventId,
    userId: ticketData.userId
  }));
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${qrData}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipientEmail,
    subject: `Ticket Confirmation - ${ticketData.eventName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 2px solid #333;">
        <h2 style="color: #28a745; text-align: center;">Registration Confirmed!</h2>
        
        <p>Dear <strong>${ticketData.userName}</strong>,</p>
        
        <p>Your ${ticketData.eventType === 'merchandise' ? 'purchase' : 'registration'} for <strong>${ticketData.eventName}</strong> has been confirmed.</p>
        
        <div style="background: #f8f9fa; padding: 15px; margin: 20px 0; border-left: 4px solid #007bff;">
          <h3 style="margin-top: 0;">Ticket Details</h3>
          <p><strong>Ticket ID:</strong> ${ticketData.ticketId}</p>
          <p><strong>Event:</strong> ${ticketData.eventName}</p>
          <p><strong>Event Type:</strong> ${ticketData.eventType === 'merchandise' ? 'Merchandise Purchase' : 'Normal Event'}</p>
          <p><strong>Event Date:</strong> ${new Date(ticketData.eventDate).toLocaleString()}</p>
          ${ticketData.teamName ? `<p><strong>Team Name:</strong> ${ticketData.teamName}</p>` : ''}
          ${ticketData.selectedSize ? `<p><strong>Size:</strong> ${ticketData.selectedSize}</p>` : ''}
          ${ticketData.selectedColor ? `<p><strong>Color:</strong> ${ticketData.selectedColor}</p>` : ''}
          ${ticketData.selectedVariant ? `<p><strong>Variant:</strong> ${ticketData.selectedVariant}</p>` : ''}
          ${ticketData.quantity ? `<p><strong>Quantity:</strong> ${ticketData.quantity}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <img src="${qrUrl}" alt="QR Code" style="border: 2px solid #ddd; padding: 10px;" />
          <p style="color: #666; font-size: 14px;">Scan this QR code at the event venue</p>
        </div>
        
        <p style="color: #666; font-size: 14px; margin-top: 30px;">
          This is an automated email. Please do not reply to this message.
        </p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        
        <p style="text-align: center; color: #999; font-size: 12px;">
          © ${new Date().getFullYear()} Event Management System | IIIT
        </p>
      </div>
    `
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email actually sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email FAILED:', error.message);
    throw error;
  }
}

module.exports = { sendTicketEmail };
