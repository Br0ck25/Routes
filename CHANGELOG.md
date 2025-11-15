# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] - 2025-11-15

### 🔒 Security

#### Critical Fixes

- **Removed hardcoded Google Maps API key** from index.html
  - Created `config.js` for sensitive configuration
  - Added `config.example.js` template
  - Updated `.gitignore` to exclude config files
  - Implemented dynamic API key loading with error handling

- **Removed hardcoded admin token** from admin.html
  - Moved admin authentication to config file
  - Added security warnings and documentation
  - Generated new secure token format

- **Fixed XSS vulnerabilities**
  - Created `utils.js` with HTML sanitization utilities
  - Implemented `escapeHtml()` for all user data rendering
  - Updated admin.html to sanitize usernames, passwords, tokens
  - Added input validation utilities (numbers, dates, times, URLs)

- **Added comprehensive security headers** in `_headers`
  - Content Security Policy (CSP)
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection
  - Referrer-Policy: strict-origin-when-cross-origin
  - Permissions-Policy with restrictive defaults

- **Improved CORS configuration**
  - Restricted from wildcard (*) to specific domain
  - Added proper cache control headers
  - Separated static and dynamic resource caching

#### Service Worker Security

- **Updated service worker** to v3.0.0
  - Excluded sensitive files from caching (config.js, admin.html, .env)
  - Added error handling for failed fetches
  - Improved cache invalidation strategy
  - Added utils.js to cached resources

### 📚 Documentation

- **Added comprehensive README.md**
  - Setup instructions
  - Security best practices
  - API key configuration guide
  - Troubleshooting section
  - Development guidelines

- **Created SECURITY.md**
  - Detailed security improvements
  - Vulnerability reporting process
  - Security checklist
  - Best practices for deployment
  - Testing guidelines

- **Added CHANGELOG.md**
  - Version history
  - Change tracking

### 🛠️ Infrastructure

- **Created `.gitignore`**
  - Excluded sensitive files (config.js, .env)
  - Added common development files
  - Protected API keys and secrets

- **Added `.htaccess`** for Apache servers
  - Security headers (duplicate of _headers for Apache)
  - Force HTTPS
  - Protect sensitive files
  - Compression and caching rules

### 🔧 Configuration

- **Created `config.js` system**
  - Centralized configuration management
  - Environment-ready structure
  - Feature flags support
  - Example template provided

- **Created `utils.js` utility library**
  - `escapeHtml()` - HTML sanitization
  - `sanitizeNumber()` - Number validation
  - `sanitizeDate()` - Date validation
  - `sanitizeTime()` - Time validation
  - `sanitizeString()` - String sanitization
  - `isSafeUrl()` - URL validation

### ⚠️ Breaking Changes

- **Configuration required**: Application now requires `config.js` file to be created from `config.example.js`
- **Admin token changed**: Admin token must be updated in `config.js` and backend
- **Service worker version bump**: Old caches will be cleared on first load

### 🔄 Migration Guide

For users upgrading from v2.x:

1. **Create config file**:
   ```bash
   cp config.example.js config.js
   ```

2. **Add your API keys** to `config.js`:
   - Google Maps API key
   - Admin token (generate new one)

3. **Update backend** with new admin token

4. **Clear browser cache** to load new service worker

5. **Verify API key restrictions** in Google Cloud Console

6. **Test all functionality**:
   - Route calculation
   - User authentication
   - Admin panel access
   - Offline mode

### 📝 Known Issues

- Service worker may not update immediately (hard refresh required)
- Some innerHTML usages in index.html still need sanitization
- Backend authentication still uses simple bearer tokens (JWT recommended)

### 🎯 Future Improvements

Planned for v3.1.0:
- [ ] Backend API proxy for Google Maps
- [ ] JWT authentication
- [ ] Rate limiting
- [ ] CSRF protection
- [ ] Modularize JavaScript code
- [ ] Extract CSS to separate files
- [ ] Add unit tests

### 🔍 Full Diff

Files Added:
- `config.js` (gitignored, create from template)
- `config.example.js`
- `utils.js`
- `.gitignore`
- `.htaccess`
- `README.md`
- `SECURITY.md`
- `CHANGELOG.md`

Files Modified:
- `index.html` - API key loading, utils import
- `admin.html` - Token removal, XSS fixes, utils import
- `service-worker.js` - Security updates, cache v3.0.0
- `_headers` - Comprehensive security headers

---

## [2.1.6] - Previous Version

- Route calculation functionality
- User authentication
- Trip logging
- PDF/CSV export
- Offline support
- PWA features

---

**Note**: For security reasons, detailed vulnerability information is not disclosed in the public changelog. See SECURITY.md for security-specific information.
