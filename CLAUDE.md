# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React/TypeScript application for coordinating a HOA dissolution campaign using AWS Amplify. The app tracks homeowners, residents, canvassing assignments, and consent signatures through a volunteer-driven workflow.

## Development Commands

```bash
# Development server
npm run dev

# Build for production  
npm run build

# Preview production build
npm run preview

# Amplify sandbox environment
npm run sandbox

# Data import/seeding scripts
npm run import:homeowners:sqlite
npm run import:homeowners          # CSV import
npm run import:votes              # Legacy vote import
npm run seed:admin               # Create admin user
npm run export:backup            # Export data backup
```

## Architecture

### AWS Amplify Backend
- **Authentication**: Email-based login via Cognito
- **Database**: GraphQL API with DynamoDB backend
- **Authorization**: Role-based access (Administrator, Organizer, Canvasser, Member)
- **Functions**: Admin API for user management

### Data Models (amplify/data/resource.ts)
Core entities and relationships:
- `Home` - Physical addresses with lat/lng coordinates
- `Person` - Residents linked to homes (PRIMARY_OWNER, SECONDARY_OWNER, RENTER, OTHER)  
- `Consent` - Signature records for dissolution petition
- `Assignment` - Canvassing tasks assigned to volunteers
- `InteractionRecord` - Door-to-door interaction logs
- `UserProfile` - User account details and role cache
- `Registration` - New member registration workflow

### Frontend Structure
- **Router**: React Router with role-based route protection
- **Pages**: Organized by user role (admin/, organizer/, general)
- **Authentication**: AWS Amplify UI Authenticator wrapper

Key pages:
- `/organize` - Organizer dashboard for managing assignments
- `/absentee` - Track absentee homeowner outreach  
- `/canvass` - Interactive map for canvassing routes
- `/admin/consents` - Record petition signatures
- `/reports` - Analytics and progress tracking

### Scripts Directory
TypeScript utilities for data management:
- Import scripts for bulk homeowner data loading
- Admin user setup and role management
- Database backup and export tools

## Authorization Model

4-tier role hierarchy with GraphQL-level permissions:
1. **Administrator** - Full system access
2. **Organizer** - Manage assignments and view reports  
3. **Canvasser** - Update interaction records
4. **Member** - Read-only access

Public API key allows unauthenticated data imports and public registration forms.

## Development Notes

- Uses Vite for fast development builds
- TypeScript with path aliases (@/* → src/*)
- AWS Amplify handles deployment via GitHub integration
- No linting/testing commands configured - check with user before adding