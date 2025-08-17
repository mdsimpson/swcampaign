# 🔧 Application Configuration Guide

This guide explains how to configure your application's domain and URLs.

## 📍 Domain Configuration

All domain URLs are centralized in configuration files to make deployment easier.

### Frontend Configuration

**File**: `src/config/app.ts`

```typescript
export const APP_CONFIG = {
  // Domain from environment variable or fallback to default
  get DOMAIN() {
    return import.meta.env.VITE_APP_DOMAIN || 'swhoa.michael-simpson.com'
  },
  
  // Automatically constructs full URL
  get APP_URL() {
    return `https://${this.DOMAIN}`
  },
}
```

**Environment Variable**: `VITE_APP_DOMAIN` (frontend)

### Backend Configuration  

**File**: `amplify/shared/config.ts`

```typescript
export const APP_CONFIG = {
  // Domain from environment variable or fallback to default
  get DOMAIN() {
    return process.env.APP_DOMAIN || 'swhoa.michael-simpson.com'
  },
  
  // Automatically constructs URLs
  get APP_URL() {
    return `https://${this.DOMAIN}`
  },
  
  get ADMIN_ENROLLMENT_URL() {
    return `${this.APP_URL}/admin/enroll`
  },
}
```

**Environment Variable**: `APP_DOMAIN` (backend functions)

### Environment Variables

**Files**: 
- `amplify/functions/notify-admins/resource.ts`
- `amplify/functions/send-welcome-email/resource.ts`

```typescript
environment: {
  FROM_EMAIL: process.env.FROM_EMAIL || 'mike@michael-simpson.com', // Environment variable with fallback
  APP_DOMAIN: process.env.APP_DOMAIN || 'swhoa.michael-simpson.com' // Environment variable with fallback
}
```

## 🚀 How to Change the Domain

### 1. Update Environment Variables

**Option A: Environment Variables (Recommended)**
Set these environment variables in your deployment platform:

**Frontend:**
- `VITE_APP_DOMAIN=your-new-domain.com`

**Backend Functions:**  
- `APP_DOMAIN=your-new-domain.com`
- `FROM_EMAIL=your-email@your-domain.com`

**Option B: Update Fallback Values**
If you prefer not to use environment variables, edit the fallback values:

1. **Edit `src/config/app.ts`**:
   ```typescript
   return import.meta.env.VITE_APP_DOMAIN || 'your-new-domain.com'
   ```

2. **Edit `amplify/shared/config.ts`**:
   ```typescript
   return process.env.APP_DOMAIN || 'your-new-domain.com'
   ```

3. **Edit function resource files**:
   - `amplify/functions/notify-admins/resource.ts`
   - `amplify/functions/send-welcome-email/resource.ts`
   - `amplify/functions/admin-api/resource.ts`
   
   Change:
   ```typescript
   FROM_EMAIL: process.env.FROM_EMAIL || 'your-email@your-domain.com',
   APP_DOMAIN: process.env.APP_DOMAIN || 'your-new-domain.com'
   ```

### 2. Deploy Changes

1. **Commit changes**:
   ```bash
   git add -A
   git commit -m "Update domain configuration"
   git push origin main
   ```

2. **Deploy backend** (if using production):
   ```bash
   npx ampx pipeline-deploy --branch main
   ```

3. **Update AWS Amplify hosting** (if needed):
   - Go to AWS Amplify Console
   - Update custom domain settings

## 📧 Email Configuration

Email addresses are configured via environment variables:

**Environment Variable**: `FROM_EMAIL`
**Default Fallback**: `mike@michael-simpson.com`

```typescript
FROM_EMAIL: process.env.FROM_EMAIL || 'mike@michael-simpson.com' // Environment variable with fallback
```

## 🔍 URLs Used in the Application

The following URLs are automatically generated from your domain configuration:

- **Main app**: `https://your-domain.com`
- **Admin enrollment**: `https://your-domain.com/admin/enroll`
- **Login page**: `https://your-domain.com/login`

## ✅ Current Configuration

Currently configured for:
- **Domain**: `swhoa.michael-simpson.com`
- **Main URL**: `https://swhoa.michael-simpson.com`
- **Admin URL**: `https://swhoa.michael-simpson.com/admin/enroll`

## 🔄 Fallback Behavior

If environment variables are not set, the application will fall back to the hardcoded values in the configuration files.

Priority order:
1. Environment variable (`process.env.APP_URL`)
2. Configuration file value (`APP_URL` from config)
3. Previous fallback removed (was hardcoded placeholder)

This ensures your application will always have the correct URLs configured!