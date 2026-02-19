# Server Project Configuration Guide

## Overview
This is the backend server for the EazMenu application. It uses Express.js with TypeScript and connects to a PostgreSQL database using Drizzle ORM.

## Critical Configuration Rules

### ⚠️ IMPORTANT: @sbaka/shared Dependency Management

**NEVER reference @sbaka/shared using local relative paths (../).**

The `@sbaka/shared` package is published to GitHub Package Registry and **MUST ALWAYS** be referenced as a remote dependency, even in development.

#### Why This Matters

1. **Peer Dependencies**: The shared package declares `drizzle-orm`, `drizzle-zod`, and `zod` as peer dependencies
2. **Type Safety**: Local path references break TypeScript's module resolution for packages with peer dependencies
3. **Build Consistency**: Ensures all environments (dev, CI/CD, production) use the same dependency resolution strategy
4. **Deployment**: Production deployments cannot access local file paths

### Current Configuration

#### package.json
```json
{
  "dependencies": {
    "@sbaka/shared": "1.2.0",  // ✅ CORRECT: Version from remote registry
    "drizzle-orm": "^0.38.4"    // Required peer dependency
  }
}
```

**NEVER do this:**
```json
{
  "dependencies": {
    "@sbaka/shared": "file:../shared"  // ❌ WRONG: Will break TypeScript
  }
}
```

#### tsconfig.json
```jsonc
{
  "compilerOptions": {
    "moduleResolution": "bundler",  // Handles package resolution correctly
    "skipLibCheck": true,           // Skips type checking in node_modules
    "paths": {
      "@db": ["./db"]               // ✅ Local path aliases are fine
      // ❌ NEVER add: "@sbaka/shared": ["../shared/src"]
    }
  },
  "references": []  // ✅ Empty - no local project references to shared
}
```

### TypeScript Configuration Explained

- **composite: true**: Enables TypeScript project references (currently unused)
- **target: ES2022**: Compiles to ES2022 JavaScript
- **module: ESNext**: Uses ES modules (matching package.json "type": "module")
- **moduleResolution: bundler**: Modern resolution strategy that works with bundlers
- **skipLibCheck: true**: Critical for avoiding type conflicts in dependencies
- **noEmit: true**: TypeScript only checks types, doesn't emit files (build uses esbuild)

### Workflow for Updating @sbaka/shared

1. **Make changes** in the `shared` project
2. **Build the package**: `cd shared && npm run build`
3. **Bump version** in `shared/package.json` (e.g., 1.2.0 → 1.2.1)
4. **Publish to GitHub**: `npm publish` (from shared directory)
5. **Update server**: `npm install @sbaka/shared@1.2.1`
6. **Restart dev server**: `npm run dev`

### Installation Requirements

Before installing dependencies, ensure you have GitHub Package Registry access configured:

```bash
# .npmrc in project root or ~/.npmrc
@sbaka:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
```

### Common Issues and Solutions

#### Issue: "Cannot find module @sbaka/shared"
**Solution**: 
1. Verify the package is installed: `npm ls @sbaka/shared`
2. Check `.npmrc` has correct registry configuration
3. Reinstall: `npm install @sbaka/shared@latest`
4. Restart TypeScript server in your IDE

#### Issue: Type errors from @sbaka/shared
**Solution**:
1. Ensure peer dependencies are installed at the correct versions
2. Check that `skipLibCheck: true` is set in tsconfig.json
3. Verify the shared package version matches across all projects

#### Issue: "Module not found" during build
**Solution**:
1. Never use local paths in package.json
2. Ensure the package is published to the registry
3. Clear node_modules and reinstall: `rm -rf node_modules && npm install`

### Build and Development Scripts

- **dev**: `tsx index.ts` - Development server with hot reload
- **build**: `esbuild` - Bundles the application (external packages not bundled)
- **start**: Production server from built files
- **check**: TypeScript type checking without emitting files

### Project Structure

```
server/
├── package.json          # Dependencies (including @sbaka/shared from registry)
├── tsconfig.json         # TypeScript config (no local references)
├── index.ts              # Application entry point
├── routes.ts             # API routes
├── db/                   # Database utilities and migrations
├── routes/               # Route handlers
├── services/             # Business logic
└── middleware/           # Express middleware
```

## Best Practices

1. ✅ Always use published versions of @sbaka/shared
2. ✅ Keep peer dependencies in sync with shared package requirements
3. ✅ Run `npm run check` before committing
4. ✅ Use semantic versioning for shared package updates
5. ❌ Never add TypeScript path aliases for @sbaka/shared
6. ❌ Never add project references to shared
7. ❌ Never use `npm link` or file: protocol for @sbaka/shared

## Environment Variables

See `.env.example` for required environment variables. The server requires proper database connection strings and API keys to function.

## Database

This project uses Drizzle ORM with the schema defined in `@sbaka/shared`. Database tables are imported from the shared package:

```typescript
import { users, restaurants, tables, orders } from '@sbaka/shared';
```

## Instructions for AI Agents

**⚠️ IMPORTANT: When editing configuration files in this project, you MUST update this AGENT.md file.**

If you make changes to:
- `package.json` (dependencies, scripts, version of @sbaka/shared)
- `tsconfig.json` (compiler options, paths, module resolution, references)
- Build process or deployment configuration
- Environment variable requirements

Then you must:
1. Update the relevant sections in this AGENT.md file to reflect the changes
2. Update the "Last Updated" date below
3. Add a brief note in the change log about what was modified

This ensures the documentation stays in sync with the actual configuration and helps future agents and developers understand the current state.

## Change Log

- **February 7, 2026**: Initial AGENT.md created documenting correct @sbaka/shared dependency management and TypeScript configuration

## Last Updated
February 7, 2026


