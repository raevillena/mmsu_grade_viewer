# Migration: Add max_scores Column

This migration adds the `max_scores` column to the `records` table to store maximum scores per grade key (typically from the second row of imported sheets).

## Quick Migration

Run this SQL in your Supabase SQL Editor:

```sql
ALTER TABLE records 
ADD COLUMN IF NOT EXISTS max_scores JSONB DEFAULT '{}'::jsonb;
```

Or use the migration file:

```sql
-- See migrations/add_max_scores_column.sql
```

## What This Does

- Adds a `max_scores` JSONB column to store maximum scores per grade key
- Defaults to an empty JSON object `{}`
- Allows the system to display max scores as subheaders in grade tables
- Max scores are populated from the second row when importing from Google Sheets or Excel

## Verification

After running the migration, verify the column exists:

```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'records' AND column_name = 'max_scores';
```

You should see:
- `column_name`: max_scores
- `data_type`: jsonb
- `column_default`: '{}'::jsonb

## Usage

When importing from Google Sheets or Excel:
1. Row 0: Headers (grade column names)
2. Row 1: Max scores (for each grade column)
3. Row 2+: Student data

The max scores will be stored in the `max_scores` column and displayed as subheaders in the grade tables.

