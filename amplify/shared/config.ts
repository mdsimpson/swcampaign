// Shared configuration for Amplify functions
// This file contains all configurable app settings for backend functions

export const APP_CONFIG = {
  // Production domain - change this to your actual domain
  DOMAIN: 'swhoa.michael-simpson.com',
  
  // Full app URL (automatically constructed)
  get APP_URL() {
    return `https://${this.DOMAIN}`
  },
  
  // Email-related URLs
  get ADMIN_ENROLLMENT_URL() {
    return `${this.APP_URL}/admin/enroll`
  },
  
  get LOGIN_URL() {
    return `${this.APP_URL}/login`
  },
  
} as const

// Export individual values for convenience  
export const { DOMAIN, APP_URL } = APP_CONFIG

export default APP_CONFIG