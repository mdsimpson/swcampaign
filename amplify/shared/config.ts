// Shared configuration for Amplify functions
// This file contains all configurable app settings for backend functions

export const APP_CONFIG = {
  // Domain from environment variable or fallback to default
  get DOMAIN() {
    return process.env.APP_DOMAIN || 'swhoa.michael-simpson.com'
  },
  
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
export const DOMAIN = APP_CONFIG.DOMAIN
export const APP_URL = APP_CONFIG.APP_URL
export const ADMIN_ENROLLMENT_URL = APP_CONFIG.ADMIN_ENROLLMENT_URL
export const LOGIN_URL = APP_CONFIG.LOGIN_URL

export default APP_CONFIG