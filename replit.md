# Overview

Starlix is a video generation application built with React and Express that leverages the STLIX API for AI-powered video creation. The app supports both text-to-video and image-to-video generation with a modern, responsive user interface. Users can create videos from text prompts or upload images with motion descriptions, track their generation history, and manage their credits.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The frontend is built with **React 18** using **TypeScript** and follows a component-based architecture:

- **UI Framework**: Uses shadcn/ui components built on Radix UI primitives for consistent, accessible design
- **Styling**: Tailwind CSS with custom dark theme variables and design tokens
- **State Management**: React Query (TanStack Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation for type-safe form management
- **Build Tool**: Vite for fast development and optimized production builds

The app uses a single-page application structure with the main video generator interface handling both text-to-video and image-to-video workflows.

## Backend Architecture

The backend follows a **REST API** pattern built with **Express.js**:

- **Server Framework**: Express.js with TypeScript for type safety
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Storage Layer**: Abstracted storage interface supporting both in-memory (development) and database persistence
- **File Handling**: Multer for multipart file uploads
- **API Integration**: RESTful client for STLIX API communication

The server implements middleware for request logging, error handling, and development-specific features like Vite integration.

## Data Storage

**Database Schema** (PostgreSQL with Drizzle ORM):
- **Users Table**: Stores user credentials and credit balances
- **Video Generations Table**: Tracks generation requests, status, and results

**Storage Abstraction**: Interface-based storage layer allows switching between in-memory storage (development) and PostgreSQL (production) without code changes.

## Authentication & Authorization

Currently implements a simplified authentication system with:
- Basic user credential storage
- Default demo user for development
- Credit-based usage tracking
- No session management or JWT tokens (simplified for demo)

## API Integration

**STLIX API Integration**:
- Text-to-video generation endpoint
- Image-to-video generation with file upload
- Status polling for generation progress
- Credit management and usage tracking
- Error handling and retry logic

## Key Design Patterns

**Component Composition**: Uses shadcn/ui's composable component pattern for consistent UI elements
**Query Management**: React Query handles caching, background updates, and optimistic updates
**Type Safety**: End-to-end TypeScript with shared types between client and server
**Error Boundaries**: Graceful error handling with user-friendly error messages
**Responsive Design**: Mobile-first approach with Tailwind's responsive utilities

# External Dependencies

## Core APIs
- **STLIX API**: Primary video generation service for AI-powered video creation
- **STLIX Upload API**: File upload service for image-to-video generation

## Database
- **PostgreSQL**: Primary data storage via Neon serverless postgres
- **Drizzle ORM**: Type-safe database operations and migrations

## UI & Styling
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Frontend build tool and development server
- **TypeScript**: Type safety across the entire stack
- **ESBuild**: Backend bundling for production deployment

## Utility Libraries
- **React Query**: Server state management and caching
- **React Hook Form**: Form state management and validation
- **Zod**: Runtime type validation and schema definition
- **date-fns**: Date formatting and manipulation
- **clsx/tailwind-merge**: Conditional CSS class management

## File Handling
- **Multer**: Multipart file upload handling
- **Form-Data**: Multipart form data construction for API requests