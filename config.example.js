// Configuration template file
// Copy this file to 'config.js' and fill in your actual API keys

const CONFIG = {
  // Google Maps API Key
  // Get your API key from: https://console.cloud.google.com/google/maps-apis
  // IMPORTANT: Enable the following APIs:
  //   - Maps JavaScript API
  //   - Places API
  //   - Directions API
  //   - Distance Matrix API
  // SECURITY: Add API restrictions (HTTP referrers) to your key
  GOOGLE_MAPS_API_KEY: 'YOUR_GOOGLE_MAPS_API_KEY_HERE',

  // API endpoints
  API_BASE_URL: 'https://logs.gorouteyourself.com',

  // Admin Authentication Token
  // SECURITY CRITICAL: Generate a strong, random token
  // Use a tool like: openssl rand -base64 32
  // This should be replaced with proper JWT authentication
  ADMIN_TOKEN: 'Bearer YOUR_STRONG_RANDOM_TOKEN_HERE',

  // Feature flags
  ENABLE_GOOGLE_OAUTH: true,
  ENABLE_OFFLINE_MODE: true
};

// Make config available globally
window.CONFIG = CONFIG;
