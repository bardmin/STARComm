# STAR Community App - Replit Guide

## Overview

The STAR Community App is a community-focused marketplace that connects residents with local service providers through a token-based economy. The application features collaborative projects, charitable causes, and a comprehensive service booking system with escrow functionality.

This is a full-stack TypeScript application built with React (frontend) and Express.js (backend), using PostgreSQL as the database with Drizzle ORM for data management.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with custom STAR Community color scheme
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for lightweight client-side routing
- **Forms**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js with custom middleware
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based authentication with bcrypt password hashing
- **Session Management**: Express sessions with PostgreSQL session store
- **API Design**: RESTful API with role-based access control

### Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Comprehensive multi-table design supporting users, services, bookings, wallets, projects, causes, and messaging
- **Roles**: Multi-role system (resident, service_provider, agent, cause_champion, admin)
- **Token Economy**: Integrated wallet and transaction system with escrow functionality

## Key Components

### Authentication System
- Multi-role user registration and login
- JWT token management with secure storage
- Role-based route protection
- Password hashing with bcrypt

### Service Marketplace
- Service categories with icons and descriptions
- Service creation and management for providers
- Advanced search and filtering capabilities
- Service booking with date/time selection
- Service ID generation for verification
- Escrow system for secure payments

### Token Economy
- Digital wallet system for each user
- Token transactions (purchase, earn, spend, escrow)
- Redemption system (60% conversion rate to cash)
- Transaction history and balance tracking

### Community Features
- STAR Projects for collaborative community initiatives
- STAR Causes for charitable donations
- Progress tracking and contribution management
- Community engagement metrics

### Messaging System
- Real-time messaging between users
- Conversation management
- Message status tracking (read/unread)

### Admin Dashboard
- User management and verification
- Service oversight and approval
- Transaction monitoring
- System analytics and reporting

## Data Flow

### User Registration Flow
1. User selects role (resident, service_provider, agent, cause_champion)
2. Form validation with Zod schemas
3. Password hashing with bcrypt
4. User creation in database
5. Automatic wallet creation
6. JWT token generation and storage

### Service Booking Flow
1. User browses services with search/filter
2. Service detail view with provider information
3. Booking form with date/time selection
4. Token balance verification
5. Escrow creation (tokens held until completion)
6. Service ID generation for verification
7. Booking confirmation and notifications

### Token Transaction Flow
1. User initiates transaction (purchase/booking/donation)
2. Balance verification and validation
3. Transaction recording in database
4. Wallet balance updates
5. Escrow management for service bookings
6. Transaction history updates

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection for serverless environments
- **drizzle-orm**: Type-safe ORM for database operations
- **@tanstack/react-query**: Server state management and caching
- **bcrypt**: Password hashing and verification
- **jsonwebtoken**: JWT token creation and verification
- **connect-pg-simple**: PostgreSQL session store for Express

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives for components
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Dynamic className generation
- **lucide-react**: Icon library
- **react-hook-form**: Form state management
- **@hookform/resolvers**: Form validation resolvers

### Development Dependencies
- **vite**: Build tool and development server
- **typescript**: Type checking and compilation
- **tsx**: TypeScript execution for development
- **esbuild**: Fast JavaScript bundler for production

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with PostgreSQL 16
- **Development Server**: Vite dev server with HMR
- **Database**: Local PostgreSQL instance
- **Port Configuration**: Application runs on port 5000

### Production Build
1. **Frontend Build**: `vite build` compiles React app to static assets
2. **Backend Build**: `esbuild` bundles Express server for production
3. **Database Migration**: Drizzle handles schema migrations
4. **Static File Serving**: Express serves built frontend assets

### Deployment Configuration
- **Target**: Autoscale deployment on Replit
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**: DATABASE_URL, JWT_SECRET

## Changelog

```
Changelog:
- June 16, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```