import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email', // For testing, use ethereal.email
      port: 587,
      auth: {
        user: 'jacynthe.herman@ethereal.email',
        pass: 'r6xqGSFmuruGKVwWG2',
      },
      tls: {
      rejectUnauthorized: false
    }
    });

    this.transporter.verify((error, success) => {
    if (error) {
      console.error('❌ SMTP Connection Error:', error);
    } else {
      console.log('✅ SMTP Server is ready to take our messages');
    }
  });
  }

  async sendPasswordReset(email: string, link: string) {
   const info = await this.transporter.sendMail({
      from: '"Sanga Bank Support" <noreply@sangabank.com>',
      to: email,
      subject: 'Password Reset Request',
      text: 'If you see this, the mailer works!', 
      html: `
        <h3>Password Reset Request</h3>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <a href="${link}" style="padding: 10px 20px; background: #2563eb; color: white; border-radius: 8px; text-decoration: none;">Reset Password</a>
        <p>This link will expire in 1 hour.</p>
      `,
    });
console.log(`📬 Message sent. ID: ${info.messageId}`);
  
  const previewUrl = nodemailer.getTestMessageUrl(info);
  console.log(`🔗 Preview URL: ${previewUrl}`);
  
  return info;
  }
  
}