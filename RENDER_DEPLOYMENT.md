# Deploying to Render.com

This guide covers deploying the EazMenu server to Render.com using Docker.

## Prerequisites

1. **GitHub Personal Access Token** with `read:packages` scope
   - Go to https://github.com/settings/tokens
   - Generate a token with `read:packages` permission
   - Copy and save it securely

2. **Render.com Account**
   - Sign up at https://render.com
   - Connect your GitHub account

## Step 1: Create Web Service on Render

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"**
3. Connect to your `eazmenu-server` repository
4. Configure:
   - **Name**: `eazmenu-server` (or your choice)
   - **Environment**: `Docker`
   - **Region**: Choose closest to your users
   - **Branch**: `master`
   - **Dockerfile Path**: `./Dockerfile`

## Step 2: Configure Build Settings

### Build Command (leave empty, Docker handles this)
```
(leave empty)
```

### Docker Build Arguments

Add the following build argument:

| Key | Value |
|-----|-------|
| `GITHUB_TOKEN` | Your GitHub Personal Access Token |

⚠️ **IMPORTANT**: This is required to install `@sbaka/shared` from GitHub Packages

## Step 3: Environment Variables

Add these environment variables in Render:

### Required
| Key | Value | Description |
|-----|-------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `DATABASE_URL` | Your database URL | PostgreSQL connection string |
| `SESSION_SECRET` | Generate random string | Session encryption key |
| `PORT` | `3000` | Server port (Render provides this) |

### Optional (Supabase Auth)
| Key | Value | Description |
|-----|-------|-------------|
| `SUPABASE_URL` | Your Supabase URL | Supabase project URL |
| `SUPABASE_ANON_KEY` | Your anon key | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | Supabase admin key |

### Optional (Email, Storage, etc.)
Add any other environment variables your app needs.

## Step 4: Health Check Configuration

Render uses the Docker `HEALTHCHECK` directive automatically:
- Path: `/api/health`
- Interval: 30 seconds
- Timeout: 3 seconds

No additional configuration needed!

## Step 5: Deploy

1. Click **"Create Web Service"**
2. Render will:
   - Pull your code
   - Build the Docker image (using your GitHub token to install @sbaka/shared)
   - Start the container
   - Run health checks

## Deployment Commands

### Manual Deploy
```bash
# Push to GitHub to trigger auto-deploy
git push origin master
```

### Check Deployment Status
- Go to your service in Render Dashboard
- View **"Logs"** tab for build and runtime logs
- Check **"Events"** tab for deployment history

## Database Setup

### Option 1: Render PostgreSQL (Recommended)

1. Create a new PostgreSQL database on Render:
   - Click **"New +"** → **"PostgreSQL"**
   - Name it (e.g., `eazmenu-db`)
   - Choose a plan
   
2. Copy the **Internal Database URL**
3. Add it as `DATABASE_URL` environment variable in your web service

### Option 2: External Database (Neon, Supabase, etc.)

Just add the connection string as `DATABASE_URL`

## Run Migrations

After first deployment, run migrations:

1. Go to your service → **"Shell"** tab
2. Run:
```bash
npm run db:migrate
```

Or use Render's one-off job feature.

## Troubleshooting

### Build Fails: "403 Forbidden" for @sbaka/shared

**Cause**: GitHub token missing or invalid

**Fix**:
1. Check `GITHUB_TOKEN` build argument is set
2. Verify token has `read:packages` scope
3. Token should not be expired

### Build Fails: "Cannot find module @sbaka/shared"

**Cause**: Package not found in GitHub Packages

**Fix**:
1. Verify package is published: https://github.com/sbaka?tab=packages
2. Check package name is `@sbaka/shared` (not `@eazmenu/shared`)
3. Verify you pushed the package to GitHub Packages

### App Crashes on Startup

**Cause**: Missing environment variables or database connection

**Fix**:
1. Check all required env vars are set
2. Verify `DATABASE_URL` is correct
3. Check logs in Render dashboard
4. Ensure migrations ran successfully

### Health Check Failing

**Cause**: App not responding on port 3000 or `/api/health` endpoint broken

**Fix**:
1. Check app logs for errors
2. Verify `PORT` env var is set
3. Test health endpoint locally: `curl http://localhost:3000/api/health`

## Monitoring

### View Logs
```
Render Dashboard → Your Service → Logs
```

### Metrics
Render provides:
- CPU usage
- Memory usage
- Request rate
- Response time

### Alerts
Set up alerts in Render for:
- Failed deployments
- High error rates
- Resource usage

## Scaling

### Vertical Scaling
Upgrade your Render plan for more resources:
- More CPU
- More memory
- Better performance

### Horizontal Scaling (Pro Plan)
Add multiple instances for high availability.

## CI/CD

Render auto-deploys on every push to `master`:

1. Push code to GitHub
2. Render detects changes
3. Builds new Docker image
4. Runs health checks
5. Switches traffic to new version
6. Zero-downtime deployment ✅

## Cost Optimization

### Free Tier
- Services spin down after 15 minutes of inactivity
- First request after spin-down takes ~30 seconds

### Paid Plans
- Always-on services
- No cold starts
- Better performance

## Security Checklist

- ✅ GitHub token stored as build secret (not in code)
- ✅ Environment variables encrypted by Render
- ✅ App runs as non-root user (defined in Dockerfile)
- ✅ Health checks enabled
- ✅ HTTPS enabled by default
- ✅ Database uses SSL connections

## Next Steps

1. Set up custom domain
2. Configure CDN for static assets
3. Set up monitoring and alerts
4. Configure backup strategy for database
5. Set up staging environment

## Support

- [Render Documentation](https://render.com/docs)
- [GitHub Packages Docs](https://docs.github.com/en/packages)
- Check Render community forums
