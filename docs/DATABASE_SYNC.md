# Database Schema Sync Guide

This guide explains how to keep your local Supabase database schema in sync with production.

## What Gets Synced

The sync process pulls the following from production:

✅ **Included (Schema Only)**:
- Database tables and columns
- Row Level Security (RLS) policies
- Database triggers
- Database functions
- Indexes and constraints
- Extensions

❌ **NOT Included (Data)**:
- User data
- Donations
- Organizations
- Events
- Any production data

## Quick Start

### Sync Schema from Production

Run this command whenever you need to update your local schema:

```bash
npm run supabase:sync
```

You'll be prompted for your production Supabase database password.

**Alternatively**, you can set the password as an environment variable:

```bash
export SUPABASE_DB_PASSWORD="your-password-here"
npm run supabase:sync
```

## When to Sync

You should sync your local schema in these situations:

1. **After Production Changes**: When someone adds new tables, columns, or policies in production
2. **Starting Development**: When you first clone the repo or switch branches
3. **Before Testing**: To ensure you're testing against the current schema
4. **Weekly Routine**: As a best practice, sync at least once a week

## What Happens During Sync

1. **Connects to Production**: Links to your production Supabase project
2. **Pulls Schema**: Downloads the complete schema as a SQL migration
3. **Cleans Migration**: Removes any incompatible psql commands
4. **Applies Changes**: Resets local database with the new schema
5. **Verifies Sync**: Counts tables, policies, and triggers to confirm

## Troubleshooting

### Password Authentication Failed

If you get a password error:
1. Check your password in the Supabase Dashboard: Settings > Database
2. Reset the password if needed
3. Try again with the new password

### Local Supabase Not Running

If you see "Local Supabase is not running":
```bash
supabase start
```

Then run the sync command again.

### Migration Fails

If the migration fails to apply:
1. Check that your local Supabase is running: `supabase status`
2. Try stopping and restarting: `supabase stop && supabase start`
3. Run sync again: `npm run supabase:sync`

## Manual Sync

If you prefer to run the sync manually without the script:

```bash
# 1. Link to production (only needed once)
supabase link --project-ref wbyxrtpzusysxdwtmzfa --password YOUR_PASSWORD

# 2. Pull schema
supabase db pull --password YOUR_PASSWORD

# 3. Clean migration file (remove psql meta-commands)
LATEST_MIGRATION=$(ls -t supabase/migrations/*.sql | head -1)
sed -i '' '/^\\restrict/d' "$LATEST_MIGRATION"
sed -i '' '/^\\unrestrict/d' "$LATEST_MIGRATION"

# 4. Apply to local
supabase db reset
```

## Best Practices

1. **Sync Before Major Work**: Always sync before starting a new feature
2. **Commit Migrations**: Commit the generated migration files to git
3. **Team Communication**: Let your team know when you make schema changes
4. **Test After Sync**: Run your app after syncing to catch any issues
5. **Don't Sync Data**: Never sync production data to local (use seed scripts instead)

## Related Commands

- `npm run supabase:status` - Check Supabase status
- `supabase start` - Start local Supabase
- `supabase stop` - Stop local Supabase
- `supabase db reset` - Reset local database

## Production Schema Changes

If you need to make schema changes in production:

1. **Test Locally First**: Make changes in local Supabase Studio
2. **Generate Migration**: Run `supabase db diff` to generate migration
3. **Review Migration**: Check the generated SQL file
4. **Apply to Production**: Use Supabase Dashboard or CLI to apply
5. **Notify Team**: Let everyone know to sync their local schemas

## Support

If you encounter issues not covered here:
1. Check Supabase CLI documentation: https://supabase.com/docs/guides/cli
2. Check the migration files in `supabase/migrations/`
3. Ask the team for help
