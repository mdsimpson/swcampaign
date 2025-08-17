// Application configuration
// This file contains all configurable app settings

export const APP_CONFIG = {
  // Production domain - change this to your actual domain
  DOMAIN: 'swhoa.michael-simpson.com',
  
  // Full app URL (automatically constructed)
  get APP_URL() {
    return `https://${this.DOMAIN}`
  },
  
  // API endpoints and other configurable URLs can be added here
  // For example:
  // SUPPORT_EMAIL: 'support@swhoa.michael-simpson.com',
  // CONTACT_EMAIL: 'contact@swhoa.michael-simpson.com',
} as const

// Export individual values for convenience
export const { DOMAIN, APP_URL } = APP_CONFIG

// Default export for importing the entire config
export default APP_CONFIG