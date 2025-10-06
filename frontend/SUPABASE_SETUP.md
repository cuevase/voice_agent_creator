# Supabase Authentication Setup

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Replace the values with your actual Supabase credentials from your project dashboard.

## Step 3: Set Up Google OAuth

### Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API:
   - Go to **APIs & Services** → **Library**
   - Search for "Google+ API" and enable it
4. Create OAuth 2.0 credentials:
   - Go to **APIs & Services** → **Credentials**
   - Click **Create Credentials** → **OAuth 2.0 Client IDs**
   - Choose **Web application**
   - Add authorized redirect URIs:
     - `https://your-project.supabase.co/auth/v1/callback`
     - `http://localhost:3000/auth/callback` (for development)
     
5. Copy the **Client ID** and **Client Secret**

### Configure Supabase with Google OAuth

1. In your Supabase dashboard, go to **Authentication** → **Providers**
2. Find **Google** and click **Edit**
3. Enable Google provider
4. Enter your Google OAuth credentials:
   - **Client ID**: Your Google OAuth Client ID
   - **Client Secret**: Your Google OAuth Client Secret
5. Save the configuration

## Authentication Flow

The app now includes a complete authentication flow:

1. **Landing Page** - Users see the attractive landing page first
2. **Login Page** - When they click "Get Started", they're prompted to login with Google
3. **Main App** - After successful authentication, they can access the company setup and AI agent features

## Features Added

- ✅ Google OAuth authentication
- ✅ Protected routes (login required)
- ✅ User session management
- ✅ Sign out functionality
- ✅ Loading states during authentication
- ✅ Beautiful login page with Google sign-in
- ✅ Auth callback handling

## Next Steps

1. Add your Supabase credentials to `.env.local`
2. Configure Google OAuth in your Supabase dashboard
3. Test the authentication flow
4. Customize the login page styling if needed

## Troubleshooting

- Make sure your Google OAuth redirect URIs are correctly configured in both Google Cloud Console and Supabase
- Verify your environment variables are loaded correctly
- Check the browser console for any authentication errors

## Current Issue

The OAuth flow is not completing properly. The auth callback is being called without the authorization code. This suggests the redirect URI configuration in your Supabase project needs to be updated.

**Fix:** In your Supabase dashboard, go to **Authentication** → **URL Configuration** and make sure the Site URL is set to `http://localhost:3000` for development. 