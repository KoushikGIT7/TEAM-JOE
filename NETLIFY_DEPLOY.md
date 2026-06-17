# Netlify Deployment Guide

## Environment Variables for Netlify

Add these environment variables in your Netlify dashboard before deploying:

### Required Environment Variables

Go to: **Site settings → Environment variables → Add a variable**

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key for AI features | `AIzaSy...` | Optional* |

\* *GEMINI_API_KEY is optional - the app will work without it, but AI features may not function.*

### Firebase Credentials (If Using Firebase)

**Note:** The project currently uses localStorage. Firebase credentials are only needed if you migrate to Firebase.

| Variable Name | Description | Example Value | Required |
|--------------|-------------|---------------|----------|
| `VITE_FIREBASE_API_KEY` | Firebase API Key | `AIzaSy...` | No |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain | `project.firebaseapp.com` | No |
| `VITE_FIREBASE_PROJECT_ID` | Firebase Project ID | `cse-cafeteria` | No |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage Bucket | `project.appspot.com` | No |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID | `123456789` | No |
| `VITE_FIREBASE_APP_ID` | Firebase App ID | `1:123:web:abc` | No |
| `VITE_FIREBASE_MEASUREMENT_ID` | Analytics ID | `G-XXXXXXXXXX` | No |

See `FIREBASE_CREDENTIALS.md` for detailed Firebase setup instructions.

### How to Add Environment Variables in Netlify

1. **Log in to Netlify Dashboard**
   - Go to https://app.netlify.com
   - Select your site (or create a new one)

2. **Navigate to Environment Variables**
   - Click on **Site settings**
   - Scroll down to **Environment variables**
   - Click **Add a variable**

3. **Add Each Variable**
   - **Key**: `GEMINI_API_KEY`
   - **Value**: Your actual API key
   - **Scopes**: Select where it applies (Production, Deploy previews, Branch deploys)
   - Click **Save**

### Getting Your Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Create API Key**
4. Copy the generated key
5. Paste it in Netlify as `GEMINI_API_KEY`

### Netlify Build Settings

**Build command:**
```bash
npm run build
```

**Publish directory:**
```
dist
```

**Node version:**
```
18.x or higher
```

### Netlify Configuration File (netlify.toml)

Create a `netlify.toml` file in your project root:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "18"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### Deployment Steps

1. **Connect Repository to Netlify**
   - Go to Netlify Dashboard
   - Click **Add new site** → **Import an existing project**
   - Connect to GitHub
   - Select your repository: `KoushikGIT7/CSE-Cafeteria-Automation`

2. **Configure Build Settings**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Click **Deploy site**

3. **Add Environment Variables**
   - After first deployment, go to **Site settings** → **Environment variables**
   - Add `GEMINI_API_KEY` (if needed)
   - Trigger a new deployment

4. **Deploy**
   - Netlify will automatically deploy on every push to main branch
   - Or manually trigger from the Deploys tab

### Important Notes

- **Environment variables are case-sensitive** - use exact names as shown
- **Never commit API keys** to your repository
- **Redeploy after adding variables** - changes require a new build
- The app uses **localStorage** for data storage, so data persists per browser
- For production, consider migrating to a backend database

### Troubleshooting

**Build fails?**
- Check Node version (should be 18+)
- Verify build command: `npm run build`
- Check build logs in Netlify dashboard

**Environment variables not working?**
- Ensure variable names match exactly (case-sensitive)
- Redeploy after adding variables
- Check variable scopes (Production, Preview, etc.)

**App not loading?**
- Verify `netlify.toml` redirects are configured
- Check browser console for errors
- Ensure `dist` folder is being published
