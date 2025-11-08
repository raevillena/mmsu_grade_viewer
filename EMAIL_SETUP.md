# Email Service Configuration Guide

This application uses [Resend](https://resend.com) to send access code emails to students. Follow these steps to configure it.

## Step 1: Sign Up for Resend

1. Go to [https://resend.com](https://resend.com)
2. Click "Sign Up" and create an account
3. Verify your email address

## Step 2: Get Your API Key

1. After logging in, go to the [API Keys](https://resend.com/api-keys) page
2. Click "Create API Key"
3. Give it a name (e.g., "MMSU Grade Viewer")
4. Copy the API key (you'll only see it once!)

## Step 3: Verify Your Domain (Required for Production)

**For Testing (Development):**
- Resend provides a test domain: `onboarding@resend.dev`
- You can use this for testing without domain verification

**For Production:**
1. Go to [Domains](https://resend.com/domains) in Resend dashboard
2. Click "Add Domain"
3. Enter your domain (e.g., `mmsu.edu.ph`)
4. Follow the DNS configuration instructions:
   - Add the provided DNS records to your domain's DNS settings
   - Wait for DNS propagation (can take a few minutes to 24 hours)
   - Resend will verify automatically once DNS records are correct

## Step 4: Configure Environment Variables

Add these variables to your `.env.local` file (or your deployment platform's environment variables):

```env
# Required: Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Required: Email address to send from
# For testing: Use onboarding@resend.dev
# For production: Use your verified domain (e.g., noreply@mmsu.edu.ph)
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Optional: Application name (defaults to "MMSU Grade Viewer")
APP_NAME=MMSU Grade Viewer

# Optional: Base URL for email links (auto-detected on Vercel)
# For local development: http://localhost:3000
# For production: https://yourdomain.com
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## Step 5: Test the Configuration

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Go to a subject page in the teacher dashboard
3. Click "Send Access Codes" button
4. Select a student or click "Send Emails"
5. Check the console logs for any errors
6. Check the student's email inbox (and spam folder)

## Troubleshooting

### Error: "Email service not configured"
- Make sure `RESEND_API_KEY` is set in your `.env.local` file
- Restart your development server after adding environment variables

### Error: "Invalid API key"
- Verify your API key is correct
- Make sure there are no extra spaces or quotes around the key
- Check that you're using the correct API key from Resend dashboard

### Error: "Domain not verified"
- For production, you must verify your domain in Resend
- For testing, use `onboarding@resend.dev` as the `RESEND_FROM_EMAIL`
- Make sure the email format is correct: `name@domain.com`

### Emails not being received
- Check spam/junk folder
- Verify the recipient email address is correct
- Check Resend dashboard for delivery status and logs
- Make sure your domain is verified (for production)

### Emails going to spam
- Verify your domain with Resend (adds SPF, DKIM records)
- Use a professional "from" email address
- Avoid spam trigger words in subject/content
- Consider setting up DMARC records

## Resend Pricing

- **Free Tier**: 3,000 emails/month, 100 emails/day
- **Pro Tier**: Starts at $20/month for 50,000 emails
- See [Resend Pricing](https://resend.com/pricing) for details

## Alternative Email Services

If you prefer a different email service, you can modify `lib/email.ts` to use:
- SendGrid
- AWS SES
- Mailgun
- Postmark
- Nodemailer (with SMTP)

## Security Notes

- **Never commit** `.env.local` to git (it should be in `.gitignore`)
- Keep your API keys secure
- Rotate API keys periodically
- Use different API keys for development and production

