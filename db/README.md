# Database Setup and Management

This directory contains all database-related files for the restaurant SaaS application.

## Files Overview

- **`index.ts`** - Database connection setup with PostgreSQL pool
- **`migrate.ts`** - Automatic database structure initialization
- **`init-standalone.ts`** - Standalone script for manual database initialization
- **`seed.ts`** - Development data seeding (optional)
- **`migrations/`** - Drizzle migration files (auto-generated)

## Automatic Database Initialization

The backend automatically ensures the database structure exists when it starts:

```typescript
// This happens automatically in server/index.ts
await ensureDatabaseStructure();
```

### What it does:

1. **Tests database connection** - Verifies DATABASE_URL is valid
2. **Runs migrations** - Applies any Drizzle migration files if they exist
3. **Creates tables manually** - If no migrations exist, creates all required tables
4. **Verifies structure** - Ensures all required tables are present
5. **Creates indexes** - Adds performance indexes automatically

## Manual Database Management

### Environment Setup
```bash
# Required environment variable
DATABASE_URL=postgresql://user:password@localhost:5432/eazmenu
```

### Available Commands

```bash
# Initialize database structure (standalone)
npm run db:init

# Generate migration files from schema changes
npm run db:generate

# Apply migrations to database
npm run db:migrate

# Push schema directly (force sync, use with caution)
npm run db:push

# Seed development data (optional)
npm run db:seed
```

## Database Schema

The application uses a multi-tenant architecture:

```
merchants (users/owners)
  └── restaurants (business locations)
      ├── languages (supported languages)
      ├── categories (menu sections)
      │   ├── category_translations
      │   └── menu_items
      │       └── menu_item_translations
      ├── tables (dining tables)
      └── orders
          └── order_items
```

### Key Features

- **Multi-tenant**: Each merchant can have multiple restaurants
- **Multi-language**: Full translation support for menus
- **Order management**: Real-time order tracking with status updates
- **Data integrity**: Foreign key constraints and unique constraints
- **Performance**: Optimized indexes on frequently queried columns

## Production Deployment

### First-time Setup

1. **Provision PostgreSQL database** (AWS RDS, Supabase, Neon, etc.)
2. **Set DATABASE_URL** environment variable
3. **Start the application** - Database structure will be created automatically

### Migration Workflow

For schema changes in production:

1. **Modify schema** in `shared/schema.ts`
2. **Generate migration**: `npm run db:generate`
3. **Review migration** in `db/migrations/`
4. **Apply migration**: `npm run db:migrate`

### Backup Strategy

**Important**: Set up regular database backups:

```bash
# Example backup command
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Example restore command
psql $DATABASE_URL < backup-20240101.sql
```

## Development

### Local PostgreSQL Setup

Using Docker:
```bash
docker run -d \
  --name postgres \
  -e POSTGRES_DB=eazmenu \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  postgres:15
```

### Database Reset

To completely reset the database:

```bash
# Drop all tables (destructive!)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Recreate structure
npm run db:init

# Add sample data (optional)
npm run db:seed
```

## Troubleshooting

### Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

### Common Error Solutions

- **"relation does not exist"** → Run `npm run db:init`
- **"permission denied"** → Check database user permissions
- **"too many connections"** → Check connection pool settings
- **SSL issues** → Verify SSL configuration in production

### Debugging

Enable detailed database logging:

```bash
# Set environment variable
DEBUG=drizzle:*

# Run with logging
npm run dev
```

## Security Considerations

- **Environment Variables**: Never commit DATABASE_URL to version control
- **SSL Connections**: Always use SSL in production/staging
- **User Permissions**: Use restricted database users in production
- **Backup Encryption**: Encrypt database backups
- **Access Control**: Limit database access to application servers only

## Performance

### Monitoring

- Monitor connection pool utilization
- Track slow query logs
- Set up database performance alerts
- Monitor disk usage and growth

### Optimization

- Indexes are automatically created for foreign keys
- Consider adding custom indexes for frequently queried columns
- Use connection pooling (already configured)
- Consider read replicas for high-traffic applications