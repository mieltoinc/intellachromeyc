# Supabase Setup for Intella Chrome Extension

## Quick Setup

1. **Get your Supabase credentials** from your Supabase dashboard:
   - Project URL (looks like: `https://abcdefghijk.supabase.co`)
   - Anon/Public key (starts with `eyJ...`)

2. **Create a `.env` file** in the project root with your credentials:
   ```bash
   # Copy from .env.example and fill in your values
   VITE_SUPABASE_URL=https://your-actual-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
   
   # Optional: Custom API URL (defaults to https://api.mielto.com)
   VITE_MIELTO_API_URL=https://api.mielto.com
   ```

3. **Build the project** after adding your credentials:
   ```bash
   npm run build
   ```

## Authentication Flow

The extension now uses a two-step authentication process:

1. **Step 1**: User logs in with Supabase (email/password)
2. **Step 2**: Extension sends Supabase token to your backend at `/auth/supabase`

Your backend should have an endpoint like:
```
POST /auth/supabase
Authorization: Bearer <supabase-jwt-token>
```

This endpoint should:
- Verify the Supabase JWT token
- Return user data and any Mielto-specific info (workspaces, etc.)

## Testing

After updating the credentials:
1. Run `npm run build`
2. Load the extension in Chrome
3. Try logging in - check the console for detailed logs