import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.EMAIL_API_KEY;
const EMAIL_FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || 'noreply@example.com';
const EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'STAR Community';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('SendGrid API key configured.');
} else {
  console.warn('SendGrid API Key (EMAIL_API_KEY) is not configured. Email sending will be disabled.');
}

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string; // Optional HTML content
}

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  if (!SENDGRID_API_KEY) {
    console.warn(`Email sending skipped (SendGrid API Key not configured): Subject "${options.subject}" to ${options.to}`);
    // Simulate success in dev if no key, to not block logic flow
    return process.env.NODE_ENV === 'development';
  }

  const msg = {
    to: options.to,
    from: {
        name: EMAIL_SENDER_NAME,
        email: EMAIL_FROM_ADDRESS,
    },
    subject: options.subject,
    text: options.text,
    html: options.html || `<p>${options.text.replace(/\n/g, '<br>')}</p>`, // Simple HTML from text
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent: Subject "${options.subject}" to ${options.to}`);
    return true;
  } catch (error: any) {
    console.error('Error sending email:', error.toString());
    if (error.response) {
      console.error('SendGrid Error Response Body:', error.response.body);
    }
    return false;
  }
};

// --- Specific Email Functions ---

interface UserContext {
  firstName: string;
  // Add other relevant context fields like confirmationLink, etc.
  clientUrl?: string;
}

export const sendRegistrationEmail = async (to: string, context: UserContext): Promise<boolean> => {
  const subject = `Welcome to ${EMAIL_SENDER_NAME}, ${context.firstName}!`;
  // In a real app, use proper email templates (HTML/MJML)
  const text = `Hi ${context.firstName},\n\nWelcome to the STAR Community Platform! We're excited to have you.\n\nExplore your community: ${context.clientUrl || process.env.VITE_CLIENT_URL || 'our platform'}\n\nThanks,\nThe ${EMAIL_SENDER_NAME} Team`;
  const html = `<p>Hi ${context.firstName},</p>
                <p>Welcome to the <strong>STAR Community Platform</strong>! We're excited to have you.</p>
                <p>Explore your community: <a href="${context.clientUrl || process.env.VITE_CLIENT_URL || '#'}">Click here</a></p>
                <p>Thanks,<br/>The ${EMAIL_SENDER_NAME} Team</p>`;

  return sendEmail({ to, subject, text, html });
};

export const sendPasswordResetEmail = async (to: string, context: { resetLink: string }): Promise<boolean> => {
  const subject = `Password Reset Request for ${EMAIL_SENDER_NAME}`;
  const text = `Hello,\n\nYou requested a password reset. Please use the following link to reset your password:\n${context.resetLink}\n\nIf you did not request this, please ignore this email.\n\nThanks,\nThe ${EMAIL_SENDER_NAME} Team`;
  const html = `<p>Hello,</p>
                <p>You requested a password reset. Please use the following link to reset your password:</p>
                <p><a href="${context.resetLink}">Reset Password</a></p>
                <p>If you did not request this, please ignore this email.</p>
                <p>Thanks,<br/>The ${EMAIL_SENDER_NAME} Team</p>`;

  return sendEmail({ to, subject, text, html });
};
