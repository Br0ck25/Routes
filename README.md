# Go Route Yourself - Route Planning & Trip Tracking Application

A Progressive Web App (PWA) for delivery drivers and logistics professionals to plan routes, track expenses, and calculate profitability.

## 🚀 Features

- **Route Planning**: Multi-destination route calculator with Google Maps integration
- **Cost Tracking**: Track fuel costs, maintenance, supplies, and earnings
- **Profitability Analysis**: Calculate net profit and profit per hour
- **Trip Logging**: Save and manage trip history with detailed notes
- **Data Export**: Export trip logs to PDF and CSV formats
- **Offline Support**: View cached logs offline with service worker
- **PWA**: Installable as a mobile/desktop app
- **User Accounts**: Secure authentication with cloud sync

## 🔒 Security Improvements (v3.0.0)

### Critical Security Fixes

This version includes major security improvements:

1. **API Key Protection**
   - Google Maps API key moved from hardcoded HTML to external config file
   - `config.js` is now gitignored and must be created from template
   - Admin token separated from codebase

2. **XSS Protection**
   - Added HTML sanitization utility (`utils.js`)
   - All user-provided data is now escaped before rendering
   - Implemented `escapeHtml()` function for all innerHTML operations

3. **Security Headers**
   - Comprehensive HTTP security headers in `_headers` file:
     - Content Security Policy (CSP)
     - X-Frame-Options: DENY
     - X-Content-Type-Options: nosniff
     - X-XSS-Protection
     - Referrer-Policy
     - Permissions-Policy
   - Restricted CORS from wildcard to specific domain

4. **Service Worker Security**
   - Sensitive files (config.js, admin.html) excluded from caching
   - Version bumped to v3.0.0 to clear old caches
   - Added error handling for failed requests

5. **Input Validation**
   - Added utility functions for validating numbers, dates, times
   - String length limits to prevent data overflow
   - URL validation to prevent javascript: and data: URLs

## 📋 Setup Instructions

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/Routes.git
cd Routes
```

### 2. Configure API Keys

**IMPORTANT**: You must create a `config.js` file before the application will work.

```bash
# Copy the example config file
cp config.example.js config.js
```

Edit `config.js` and add your credentials:

```javascript
const CONFIG = {
  GOOGLE_MAPS_API_KEY: 'YOUR_API_KEY_HERE',
  ADMIN_TOKEN: 'Bearer YOUR_STRONG_TOKEN_HERE',
  // ... other settings
};
```

#### Getting a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Directions API
   - Distance Matrix API
4. Create credentials (API Key)
5. **IMPORTANT**: Add API restrictions:
   - Application restrictions: HTTP referrers
   - Add your domain: `https://gorouteyourself.com/*`
   - API restrictions: Select only the APIs listed above

#### Generating a Secure Admin Token

```bash
# Generate a strong random token (Linux/Mac)
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Environment Variables (Production)

For production deployments, consider using environment variables instead of config.js:

```bash
# .env (never commit this file!)
GOOGLE_MAPS_API_KEY=your_key_here
ADMIN_TOKEN=your_token_here
```

### 4. Deploy to Cloudflare Pages

```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler pages publish . --project-name=go-route-yourself
```

## 🗂️ Project Structure

```
Routes/
├── index.html              # Main application
├── admin.html              # Admin panel (requires authentication)
├── offline.html            # Offline fallback page
├── faq.html                # FAQ page
├── privacy-policy.html     # Privacy policy
│
├── config.js               # Configuration (gitignored, create from template)
├── config.example.js       # Configuration template
├── utils.js                # Security utilities
│
├── service-worker.js       # PWA service worker
├── manifest.json           # PWA manifest
│
├── _headers                # Cloudflare Pages security headers
├── _routes.json            # Cloudflare Pages routing config
├── .gitignore              # Git ignore rules
│
├── logo.png                # App logo (192x192)
├── logo-512.png            # App logo (512x512)
│
└── README.md               # This file
```

## 🔐 Security Best Practices

### For Developers

1. **Never commit sensitive data**
   - Always use `.gitignore` for `config.js`, `.env` files
   - Use environment variables for production
   - Rotate API keys and tokens regularly

2. **API Key Security**
   - Enable API restrictions in Google Cloud Console
   - Use HTTP referrer restrictions
   - Monitor API usage for anomalies
   - Consider backend proxy for production

3. **Admin Access**
   - Change the default admin token immediately
   - Use strong, randomly generated tokens
   - Consider implementing IP whitelisting
   - Add rate limiting to admin endpoints
   - Enable audit logging

4. **Code Quality**
   - Always use `escapeHtml()` when rendering user data
   - Validate all inputs before processing
   - Use Content Security Policy headers
   - Keep dependencies updated

### For Production

1. **Backend Implementation** (Recommended)
   - Move Google Maps API calls to backend
   - Implement proper JWT authentication
   - Add CSRF protection
   - Use database encryption at rest
   - Enable HTTPS/TLS only

2. **Monitoring**
   - Set up logging and monitoring
   - Track failed login attempts
   - Monitor API usage and costs
   - Set up alerts for suspicious activity

3. **Compliance**
   - Review privacy policy
   - Ensure GDPR compliance if serving EU users
   - Implement data retention policies
   - Add cookie consent if required

## 🛠️ Development

### Local Development

```bash
# Serve locally with Python
python -m http.server 8000

# Or with Node.js http-server
npx http-server -p 8000
```

Visit `http://localhost:8000`

### Testing

Before committing changes:

1. Test all critical flows:
   - User signup/login
   - Route calculation
   - Trip logging
   - Data export (PDF/CSV)
   - Offline functionality

2. Security checks:
   - Verify config.js is gitignored
   - Check no API keys in committed code
   - Test XSS protection with `<script>alert('test')</script>`
   - Verify CSP headers in browser console

3. Browser compatibility:
   - Chrome/Edge (latest)
   - Firefox (latest)
   - Safari (iOS/macOS)
   - Test PWA installation

## 📝 Known Issues & TODO

### High Priority

- [ ] Implement proper backend authentication (JWT)
- [ ] Move Google Maps API calls to backend proxy
- [ ] Add rate limiting to API endpoints
- [ ] Implement CSRF protection
- [ ] Add audit logging for admin actions

### Medium Priority

- [ ] Extract CSS to separate file
- [ ] Extract JavaScript to separate modules
- [ ] Add unit tests
- [ ] Implement two-factor authentication
- [ ] Add data encryption at rest
- [ ] Improve mobile responsiveness

### Low Priority

- [ ] Add TypeScript for type safety
- [ ] Implement code splitting
- [ ] Add bundle size optimization
- [ ] Create dark mode theme

## 🐛 Troubleshooting

### "Google Maps not loading"

1. Check that `config.js` exists and has valid API key
2. Verify API key restrictions in Google Cloud Console
3. Check browser console for CORS errors
4. Ensure all required Google Maps APIs are enabled

### "401 Unauthorized on admin panel"

1. Verify admin token in `config.js` matches backend
2. Check browser console for network errors
3. Ensure backend is running and accessible

### "Service worker not updating"

1. Clear browser cache (Ctrl+Shift+Delete)
2. Unregister service worker in DevTools > Application > Service Workers
3. Hard reload (Ctrl+Shift+R)
4. Verify service worker version number was incremented

## 📄 License

[Add your license here]

## 🤝 Contributing

[Add contribution guidelines here]

## 📧 Support

For help or questions:
- Email: support@gorouteyourself.com
- Issues: [GitHub Issues](https://github.com/yourusername/Routes/issues)

---

**⚠️ SECURITY NOTICE**: This application handles sensitive user data. Always follow security best practices, keep dependencies updated, and perform regular security audits.
