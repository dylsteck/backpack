# cortex

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Elysia, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **React Native** - Build mobile apps using React
- **Expo** - Tools for React Native development
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **shadcn/ui** - Reusable UI components
- **Elysia** - Type-safe, high-performance framework
- **tRPC** - End-to-end type-safe APIs
- **Bun** - Runtime environment
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Getting Started

First, install the dependencies:

```bash
pnpm install
```
## Database Setup

This project uses PostgreSQL with Drizzle ORM.

1. Make sure you have a PostgreSQL database set up.
2. Update your `apps/server/.env` file with your PostgreSQL connection details.

3. Apply the schema to your database:
```bash
pnpm db:push
```

## Environment Configuration

### Server Environment Variables (`apps/server/.env`)

Create a `.env` file in `apps/server/` with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cortex

# Teller API (for bank account integration)
TELLER_APPLICATION_ID=app_xxxxxxxxxxxxxx
TELLER_ENVIRONMENT=sandbox  # or "production"
TELLER_SIGNING_SECRET=your_signing_secret  # Optional, for webhooks
```

### Desktop App Environment Variables (`apps/desktop/.env`)

Create a `.env` file in `apps/desktop/` with:

```bash
VITE_API_URL=http://localhost:3000
VITE_TELLER_APPLICATION_ID=app_xxxxxxxxxxxxxx
```

### Teller Setup

To enable bank account connections via Teller:

1. Sign up at [https://teller.io](https://teller.io)
2. Create an application in the Teller Dashboard
3. Get your Application ID (starts with `app_`)
4. Add the Application ID to both server and desktop `.env` files
5. Use `sandbox` environment for testing (no real bank connections required)
6. Apply for production access when ready to use real bank data

**Note**: The Teller Application ID is public and safe to use in frontend code.


Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3001](http://localhost:3001) in your browser to see the web application.
Use the Expo Go app to run the mobile application.
The API is running at [http://localhost:3000](http://localhost:3000).







## Project Structure

```
cortex/
├── apps/
│   ├── web/         # Frontend application (Next.js)
│   ├── native/      # Mobile application (React Native, Expo)
│   └── server/      # Backend API (Elysia, TRPC)
├── packages/
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `pnpm dev`: Start all applications in development mode
- `pnpm build`: Build all applications
- `pnpm dev:web`: Start only the web application
- `pnpm dev:server`: Start only the server
- `pnpm check-types`: Check TypeScript types across all apps
- `pnpm dev:native`: Start the React Native/Expo development server
- `pnpm db:push`: Push schema changes to database
- `pnpm db:studio`: Open database studio UI
