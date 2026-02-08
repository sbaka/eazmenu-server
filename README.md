# EazMenu Server

Backend server for the EazMenu restaurant ordering system.

## Important Architecture Notes

### Package Dependencies

**CRITICAL:** This server uses the `@sbaka/shared` package which is published to GitHub Packages. 

#### Local Development vs Production

**Local Development:**
```json
"@sbaka/shared": "file:../shared"
```
- Uses the local shared package from `../shared` folder
- Ensures you're testing with latest local changes
- Run `npm install` after any changes to shared package

**Production/Deployment:**
```json
"@sbaka/shared": "1.1.6"
```
- Downloads from GitHub Packages registry
- Before deploying, update package.json to use version number
- After deployment, revert back to `file:../shared` for development

#### Drizzle ORM Version Management

- **DO NOT** add `drizzle-orm` as a direct dependency in this package's `package.json`
- The server uses `drizzle-orm` through the `@sbaka/shared` package dependency
- This ensures both packages use the exact same version of drizzle-orm, preventing TypeScript type conflicts
- When deployed, the server installs `@sbaka/shared` from GitHub Packages (not local reference)

#### Why This Matters

TypeScript will throw type incompatibility errors if:
- Server has its own `drizzle-orm` installation
- Shared package has a different `drizzle-orm` installation
- Even with the same version number, separate node_modules instances cause type conflicts

#### Package References

- The `@sbaka/shared` package is published to GitHub Packages
- In production: Server downloads the published package from GitHub
- In development: TypeScript paths may reference local shared package source
- **Never reference files outside the server package in runtime code**
- Only development-time TypeScript paths can reference outside (for local development)

### Development Setup

```bash
npm install
npm run dev
```

### Database Commands

```bash
npm run db:generate  # Generate migrations
npm run db:migrate   # Run migrations
npm run db:push      # Push schema to database
npm run db:seed      # Seed database with sample data
```

### Building for Production

```bash
npm run build
npm start
```

## Environment Variables

See `.env.example` for required environment variables.


