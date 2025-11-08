# Vercel Deployment Guide

This guide will help you deploy the MMSU Grade Viewer application to Vercel.

## Prerequisites

- A Vercel account ([sign up here](https://vercel.com/signup))
- A GitHub/GitLab/Bitbucket account (for connecting your repository)
- All environment variables configured

## Step 1: Prepare Your Repository

1. Ensure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket)
2. Make sure `.env.local` is in `.gitignore` (it should already be)
3. Commit and push all changes

## Step 2: Deploy to Vercel

### Option A: Deploy via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository
4. Vercel will auto-detect Next.js
5. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)
   - **Install Command**: `npm install` (default)

### Option B: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts:
   - Link to existing project or create new
   - Confirm project settings
   - Deploy to production: `vercel --prod`

## Step 3: Configure Environment Variables

In your Vercel project dashboard:

1. Go to **Settings** → **Environment Variables**
2. Add all required environment variables:

### Required Environment Variables

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# External Authentication API
EXTERNAL_AUTH_API_URL=https://your-auth-api.com/api

# Email Service (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@yourdomain.com

# Application Configuration
APP_NAME=MMSU Grade Viewer
NEXT_PUBLIC_BASE_URL=https://your-vercel-app.vercel.app

# Moodle Integration (Optional - if using Moodle sync)
MOODLE_BASE_URL=https://mvle4.mmsu.edu.ph
MOODLE_LOGIN_PATH=/login/index.php
MOODLE_DASHBOARD_PATH=/my/index.php
MOODLE_AJAX_SERVICE_PATH=/lib/ajax/service.php
MOODLE_LOGIN_USERNAME=your_moodle_username
MOODLE_LOGIN_PASSWORD=your_moodle_password
```

### Environment Variable Notes

- **NEXT_PUBLIC_*** variables are exposed to the browser
- **SUPABASE_SERVICE_ROLE_KEY** should be kept secret (not prefixed with NEXT_PUBLIC_)
- **RESEND_API_KEY** should be kept secret
- **MOODLE_LOGIN_PASSWORD** should be kept secret
- Set variables for all environments (Production, Preview, Development)

## Step 4: Configure Build Settings

Vercel should auto-detect Next.js, but verify these settings:

1. Go to **Settings** → **General**
2. Ensure:
   - **Framework Preset**: Next.js
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install`
   - **Node.js Version**: 20.x (required for Next.js 16)

## Step 5: Database Setup

1. Ensure your Supabase database is set up:
   - Run the SQL schema from `supabase-schema.sql` in Supabase SQL Editor
   - Verify all tables are created

2. Configure Supabase RLS (Row Level Security) if needed:
   - The app uses service role key for admin operations
   - Public access is allowed for grade lookup

## Step 6: Domain Configuration (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `grades.mmsu.edu.ph`)
3. Follow DNS configuration instructions
4. Update `NEXT_PUBLIC_BASE_URL` to match your custom domain

## Step 7: Deploy and Verify

1. After setting environment variables, trigger a new deployment:
   - Go to **Deployments** tab
   - Click **"Redeploy"** on the latest deployment
   - Or push a new commit to trigger auto-deployment

2. Verify deployment:
   - Check build logs for errors
   - Visit your deployment URL
   - Test login functionality
   - Test grade lookup functionality

## Troubleshooting

### Build Failures

- **TypeScript Errors**: Fix all TypeScript errors before deploying
- **Missing Dependencies**: Ensure `package.json` has all required dependencies
- **Environment Variables**: Verify all required env vars are set

### Runtime Errors

- **Supabase Connection**: Check `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Authentication**: Verify `EXTERNAL_AUTH_API_URL` is correct
- **Email Service**: Check `RESEND_API_KEY` and `RESEND_FROM_EMAIL`
- **Base URL**: Ensure `NEXT_PUBLIC_BASE_URL` matches your Vercel deployment URL

### Function Timeout

- API routes have a 30-second timeout (configured in `vercel.json`)
- For longer operations, consider:
  - Using background jobs
  - Optimizing the operation
  - Using Vercel Edge Functions

### CORS Issues

- Vercel automatically handles CORS for Next.js API routes
- If using external APIs, ensure they allow your Vercel domain

## Continuous Deployment

Vercel automatically deploys:
- **Production**: On push to main/master branch
- **Preview**: On push to other branches or pull requests

## Monitoring

1. **Analytics**: Enable Vercel Analytics in project settings
2. **Logs**: View function logs in Vercel dashboard
3. **Performance**: Monitor Core Web Vitals in Analytics

## Security Best Practices

1. **Never commit** `.env.local` or sensitive keys
2. **Use Vercel Environment Variables** for all secrets
3. **Enable Vercel Protection** for preview deployments (optional)
4. **Use Vercel's built-in HTTPS** (automatic)
5. **Review RLS policies** in Supabase

## Additional Resources

- [Vercel Next.js Documentation](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Next.js Deployment](https://nextjs.org/docs/deployment)

## Support

For deployment issues:
1. Check Vercel build logs
2. Review environment variables
3. Verify database connection
4. Check function logs for runtime errors

