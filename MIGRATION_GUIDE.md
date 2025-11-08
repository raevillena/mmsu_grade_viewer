# Database Migration Guide

This guide explains how to update your Supabase database with schema changes.

## Method 1: Using Supabase SQL Editor (Recommended)

### Step 1: Access Supabase Dashboard

1. Go to [https://supabase.com](https://supabase.com)
2. Log in to your account
3. Select your project

### Step 2: Open SQL Editor

1. In the left sidebar, click on **"SQL Editor"**
2. Click **"New query"** to create a new SQL query

### Step 3: Run the Migration

Copy and paste the following SQL into the editor:

```sql
-- Add index on fullname column for better search performance
CREATE INDEX IF NOT EXISTS idx_student_email_cache_fullname ON student_email_cache(fullname);
```

### Step 4: Execute

1. Click the **"Run"** button (or press `Ctrl+Enter` / `Cmd+Enter`)
2. Wait for the query to complete
3. You should see a success message: "Success. No rows returned"

## Method 2: Using Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

Or manually run the SQL:

```bash
supabase db execute --file migrations/add_fullname_index.sql
```

## Method 3: Apply Full Schema (If Starting Fresh)

If you're setting up the database for the first time or want to ensure all indexes exist:

1. Open Supabase SQL Editor
2. Copy the entire contents of `supabase-schema.sql`
3. Paste into the SQL Editor
4. Click **"Run"**

**Note:** This will create all tables and indexes. If tables already exist, it will skip creation but add any missing indexes.

## Verifying the Migration

After running the migration, verify the index was created:

```sql
-- Check if the index exists
SELECT 
    indexname,
    indexdef
FROM 
    pg_indexes
WHERE 
    tablename = 'student_email_cache'
    AND indexname = 'idx_student_email_cache_fullname';
```

You should see the index in the results.

## Troubleshooting

### Error: "relation already exists"

If you see this error, the index already exists. This is safe to ignore when using `CREATE INDEX IF NOT EXISTS`.

### Error: "permission denied"

Make sure you're using a user with sufficient permissions. In Supabase, you should be logged in as the project owner or have database admin access.

### Error: "column does not exist"

Make sure the `student_email_cache` table exists. If not, run the full schema from `supabase-schema.sql` first.

## Additional Notes

- **Safe to run multiple times**: The `IF NOT EXISTS` clause ensures the migration is idempotent
- **No data loss**: Adding an index does not modify existing data
- **Recommended**: Use the Supabase SQL Editor (Method 1) for simplicity
- **Performance**: The index will improve search performance on the `fullname` column

## Future Migrations

For future schema changes:

1. Create a new migration file in the `migrations/` directory
2. Document what the migration does
3. Follow the same process to apply it via Supabase SQL Editor

