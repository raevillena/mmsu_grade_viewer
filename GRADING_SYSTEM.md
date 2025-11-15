# Grading System Feature

This document describes the dynamic grading system feature that allows teachers to configure and compute final grades per subject.

## Overview

The grading system allows teachers to:
1. Configure a custom grading system per subject with categories, components, and weights
2. Map grade keys (like "quiz1", "LE1") to grading components
3. Compute final grades automatically based on the configured system

## Database Migration

Before using this feature, run the migration to add the `grading_system` column to the `subjects` table:

```sql
-- See migrations/add_grading_system_column.sql
ALTER TABLE subjects 
ADD COLUMN IF NOT EXISTS grading_system JSONB DEFAULT '{}'::jsonb;
```

## Default Grading System Structure

The system comes with a default structure based on the sample grading system:

### Major Exams (30%)
- Midterm Exam (15%)
- Final Exam (15%)

### Major Outputs (70%)
- Long Exam (50%)
- Problem Set (10%)
- Assignment/Seatwork/Quizzes (5%)
- Attendance (5%)

## How to Use

### 1. Configure Grading System

1. Navigate to a subject's detail page
2. Click "Configure Grading System" button
3. The dialog will show:
   - **Grade Column Mapping Section**: Lists all available grade columns with checkboxes to select which component(s) each belongs to
   - **Category and Component Weights Section**: Adjust weights for categories and components
4. For each grade column:
   - Check the boxes next to the component(s) it should belong to
   - A grade column can belong to multiple components (it will contribute to each independently)
5. Adjust weights if needed (must sum to 100% for categories, and component weights must sum to category weight)
6. Click "Save Grading System"

### 2. Compute Grades

1. After configuring the grading system and adding grade records
2. Click "Compute Grades" button
3. The system will:
   - Calculate percentage scores for each component based on grade keys
   - Calculate category scores (weighted average of components)
   - Calculate final grade (weighted average of categories)
4. View results in the computed grades dialog

## Grade Key Mapping

Grade keys are the column names used in your grade records (e.g., "quiz1", "LE1", "assignment1"). When configuring the grading system:

- Each grade column is displayed with checkboxes for all available components
- Select which component(s) each grade column belongs to by checking the boxes
- **A grade column can belong to multiple components** - it will contribute to each component's score independently
- Multiple grade columns can be assigned to a single component (they will be summed together)
- The system will calculate the percentage based on max_scores if available

## Calculation Formula

1. **Component Score**: Sum of all grade key scores / Sum of all grade key max scores × 100
2. **Category Score**: Weighted average of component scores within the category
3. **Final Grade**: Weighted average of all category scores

## Example

If you have:
- Midterm Exam component (15% weight) with grade keys: "midterm1", "midterm2"
- Student scores: midterm1 = 45/50, midterm2 = 48/50
- Component score = (45 + 48) / (50 + 50) × 100 = 93%
- Category score (Major Exams, 30% total): 
  - If Midterm (15%) = 93% and Final (15%) = 85%
  - Category score = (93 × 15 + 85 × 15) / 30 = 89%
- Final grade = Weighted sum of all category scores

### Multiple Component Assignment Example

If "quiz1" is assigned to both "Midterm Exam" and "Long Exam" components:
- The quiz1 score contributes to Midterm Exam's calculation
- The quiz1 score also contributes to Long Exam's calculation
- Each component calculates independently, so quiz1 is counted in both

## Notes

- Weights must sum to 100% for the entire system
- Component weights within a category must sum to the category weight
- Grade keys must match exactly (case-sensitive) with keys in your grade records
- Max scores are used if available in the records; otherwise, raw scores are used

