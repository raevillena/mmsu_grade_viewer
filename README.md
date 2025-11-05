# MMSU Grade Viewer

A full-stack web application for managing and viewing student grades, built with Next.js 16, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

## Features

### 🔐 Authentication & Authorization

- **External Authentication API** for Admin and Teacher login
- Automatic token refresh mechanism
- HTTP-only cookies for secure token storage
- Role-based access control (Admin, Teacher, Student/Public)

### 👨‍💼 Admin Dashboard

- Manage users (Create, Read, Update, Delete)
- Assign roles (admin, teacher, student)
- View and manage synced users from external API

### 👩‍🏫 Teacher Dashboard

- Create and manage subjects
- Upload grades via:
  - **Excel files** (.xlsx, .xls)
  - **Google Sheets** (URL import)
- Manual grade entry
- View and edit student grade records in spreadsheet-like interface

### 👨‍🎓 Student / Public Access

- Public grade lookup page
- View grades by entering:
  - Email
  - Student Number
  - Security Code
- No authentication required for public access

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Database**: Supabase (PostgreSQL)
- **Authentication**: External API + HTTP-only cookies
- **Validation**: Zod
- **File Processing**: xlsx (SheetJS)

## Prerequisites

- Node.js 20.9+ and npm (required for Next.js 16)
- Supabase account and project
- External Authentication API (for Admin/Teacher login)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# External Authentication API
EXTERNAL_AUTH_API_URL=https://your-auth-api.com/api
```

**Note**: The `.envs` directory (if you create one) is already in `.gitignore` and will be hidden.

### 3. Set Up Supabase Database

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Run the SQL schema from `supabase-schema.sql`:

```sql
-- Copy and paste the contents of supabase-schema.sql
```

This will create:
- `users` table
- `subjects` table
- `records` table
- Necessary indexes

### 4. Seed Sample Data (Optional)

If you want to populate the database with sample data:

```bash
# Install tsx if you haven't already
npm install -g tsx

# Run the seed script
tsx scripts/seed.ts
```

Make sure to set `SUPABASE_SERVICE_ROLE_KEY` in your environment for the seed script to work.

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
mmsu_grade_viewer/
├── app/
│   ├── (admin)/
│   │   └── dashboard/
│   │       └── users/          # Admin user management
│   ├── (teacher)/
│   │   └── dashboard/
│   │       └── subjects/       # Teacher subject management
│   ├── api/
│   │   ├── auth/               # Authentication endpoints
│   │   ├── users/              # User CRUD (admin only)
│   │   ├── subjects/           # Subject CRUD
│   │   └── records/            # Record CRUD
│   ├── grades/                 # Public grade lookup
│   ├── login/                  # Login page
│   └── layout.tsx
├── components/
│   └── ui/                     # shadcn/ui components
├── lib/
│   ├── auth.ts                 # Authentication utilities
│   ├── supabaseClient.ts       # Supabase client setup
│   ├── types.ts                # TypeScript types
│   └── utils.ts                # Utility functions
├── middleware.ts               # Route protection & token validation
├── supabase-schema.sql         # Database schema
└── scripts/
    └── seed.ts                 # Seed data script
```

## API Routes

### Authentication

- `POST /api/auth/login` - Login with external API
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/validate` - Validate current token
- `POST /api/auth/logout` - Logout and clear cookies

### Users (Admin Only)

- `GET /api/users` - Get all users
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user by ID
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user

### Subjects

- `GET /api/subjects` - Get subjects (filtered by teacher for teachers)
- `POST /api/subjects` - Create subject
- `GET /api/subjects/[id]` - Get subject by ID
- `PUT /api/subjects/[id]` - Update subject
- `DELETE /api/subjects/[id]` - Delete subject

### Records

- `GET /api/records` - Get records (supports public lookup with query params)
- `POST /api/records` - Create record
- `GET /api/records/[id]` - Get record by ID
- `PUT /api/records/[id]` - Update record
- `DELETE /api/records/[id]` - Delete record

## External Authentication API

The application expects an external authentication API with the following endpoints:

### POST /login
Request:
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

Response:
```json
{
  "access_token": "jwt_token",
  "refresh_token": "refresh_token",
  "role": "admin" | "teacher",
  "user": {
    "id": "external_user_id",
    "name": "User Name",
    "email": "user@example.com"
  }
}
```

### POST /refresh
Request:
```json
{
  "refresh_token": "refresh_token"
}
```

Response:
```json
{
  "access_token": "new_jwt_token",
  "refresh_token": "new_refresh_token"
}
```

### POST /validate
Headers:
```
Authorization: Bearer {access_token}
```

Response:
```json
{
  "valid": true,
  "user": {
    "id": "external_user_id",
    "name": "User Name",
    "email": "user@example.com",
    "role": "admin" | "teacher"
  }
}
```

## File Upload Formats

### Excel File Format

Expected columns:
- `Student Name` or `student_name` or `Name`
- `Student Number` or `student_number` or `Student Number`
- `Email` or `email`
- `Code` or `code` or `Security Code`
- Additional columns will be treated as grade columns (e.g., `quiz1`, `LE1`, `assignment1`, etc.)

### Google Sheets Format

Same format as Excel. The app will automatically convert the Google Sheets URL to a CSV export URL and parse it.

## Security Features

- HTTP-only cookies for token storage
- Automatic token refresh before expiration
- Role-based route protection via middleware
- Server-side token validation
- Input validation with Zod schemas
- SQL injection protection via Supabase client

## Development

### TypeScript

This project uses strict TypeScript. All type errors must be resolved before deployment.

### Tailwind CSS

Uses Tailwind CSS v4 syntax. Refer to the [Tailwind v4 documentation](https://tailwindcss.com/docs) for proper usage.

### Code Style

- Follow existing project structure and conventions
- Use camelCase for file names
- Write self-documenting code with descriptive naming
- Add comments for complex logic
- Follow DRY and KISS principles

## Troubleshooting

### Supabase Connection Issues

- Verify your `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct
- Check that your Supabase project is active
- Ensure RLS policies allow your operations (if RLS is enabled)

### Authentication Issues

- Verify `EXTERNAL_AUTH_API_URL` is correct
- Check that the external API endpoints match the expected format
- Review browser cookies to ensure tokens are being set

### File Upload Issues

- Ensure Excel files are in .xlsx or .xls format
- Verify Google Sheets are publicly accessible or shared with appropriate permissions
- Check that column names match expected formats

## License

This project is private and proprietary.

## Support

For issues or questions, please contact the development team.

