/**
 * Seed script for populating the database with sample data
 * Run this script after setting up your Supabase database
 * 
 * Usage: tsx scripts/seed.ts
 */

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Load environment variables from .env.local file
config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables"
  );
  process.exit(1);
}

// Use service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seed() {
  console.log("Starting seed process...");

  try {
    // Create sample admin user
    const { data: adminUser, error: adminError } = await supabase
      .from("users")
      .insert({
        name: "Admin User",
        email: "admin@mmsu.edu",
        role: "admin",
        external_id: "ext_admin_001",
      })
      .select()
      .single();

    if (adminError && !adminError.message.includes("duplicate")) {
      console.error("Error creating admin user:", adminError);
    } else {
      console.log("✓ Admin user created:", adminUser?.email);
    }

    // Create sample teacher users
    const teachers = [
      {
        name: "Dr. John Smith",
        email: "teacher1@mmsu.edu",
        role: "teacher" as const,
        external_id: "ext_teacher_001",
      },
      {
        name: "Prof. Jane Doe",
        email: "teacher2@mmsu.edu",
        role: "teacher" as const,
        external_id: "ext_teacher_002",
      },
    ];

    const teacherUsers = [];
    for (const teacher of teachers) {
      const { data, error } = await supabase
        .from("users")
        .insert(teacher)
        .select()
        .single();

      if (error && !error.message.includes("duplicate")) {
        console.error(`Error creating teacher ${teacher.email}:`, error);
      } else {
        console.log("✓ Teacher created:", data?.email);
        if (data) teacherUsers.push(data);
      }
    }

    // Create sample subjects
    const subjects = [
      {
        name: "Mathematics 101",
        teacher_id: teacherUsers[0]?.id,
      },
      {
        name: "Computer Science 201",
        teacher_id: teacherUsers[0]?.id,
      },
      {
        name: "Physics 101",
        teacher_id: teacherUsers[1]?.id,
      },
    ].filter((s) => s.teacher_id); // Only create subjects if teacher exists

    const createdSubjects = [];
    for (const subject of subjects) {
      const { data, error } = await supabase
        .from("subjects")
        .insert(subject)
        .select()
        .single();

      if (error) {
        console.error(`Error creating subject ${subject.name}:`, error);
      } else {
        console.log("✓ Subject created:", data?.name);
        if (data) createdSubjects.push(data);
      }
    }

    // Create sample grade records
    const sampleRecords = [];
    if (createdSubjects.length > 0) {
      const subject = createdSubjects[0];
      
      // Sample records for Mathematics 101
      const studentRecords = [
        {
          subject_id: subject.id,
          student_name: "Alice Johnson",
          student_number: "2024-001",
          email: "alice.johnson@student.mmsu.edu",
          code: "ABC123",
          grades: {
            quiz1: 85,
            quiz2: 90,
            LE1: 88,
            assignment1: 92,
            final: 89,
          },
        },
        {
          subject_id: subject.id,
          student_name: "Bob Williams",
          student_number: "2024-002",
          email: "bob.williams@student.mmsu.edu",
          code: "DEF456",
          grades: {
            quiz1: 78,
            quiz2: 82,
            LE1: 80,
            assignment1: 85,
            final: 81,
          },
        },
        {
          subject_id: subject.id,
          student_name: "Charlie Brown",
          student_number: "2024-003",
          email: "charlie.brown@student.mmsu.edu",
          code: "GHI789",
          grades: {
            quiz1: 92,
            quiz2: 95,
            LE1: 93,
            assignment1: 98,
            final: 95,
          },
        },
      ];

      for (const record of studentRecords) {
        const { data, error } = await supabase
          .from("records")
          .insert(record)
          .select()
          .single();

        if (error) {
          console.error(`Error creating record for ${record.student_name}:`, error);
        } else {
          console.log("✓ Record created:", data?.student_name);
          sampleRecords.push(data);
        }
      }
    }

    console.log("\n✓ Seed process completed successfully!");
    console.log(`\nCreated:`);
    console.log(`- ${teacherUsers.length} teacher(s)`);
    console.log(`- ${createdSubjects.length} subject(s)`);
    console.log(`- ${sampleRecords.length} record(s)`);
    console.log("\nYou can now test the application with these sample credentials.");
  } catch (error) {
    console.error("Seed process failed:", error);
    process.exit(1);
  }
}

seed();


