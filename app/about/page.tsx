"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, Users, BookOpen, Calculator, Shield, Github, Code } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <ThemeToggle />
      </div>
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-primary/10 rounded-lg">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <div>
                <CardTitle className="text-3xl">MMSU Grade Viewer</CardTitle>
                <CardDescription className="text-base mt-1">
                  Grade Management and Viewing System
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-4">About</h2>
              <p className="text-muted-foreground leading-relaxed">
                MMSU Grade Viewer is a comprehensive grade management system designed for Mariano Marcos State University.
                This application provides teachers with powerful tools to manage student grades, configure custom grading systems,
                and compute final grades automatically. Students can easily view their grades using their student number and access code.
              </p>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">Features</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Grade Management</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Manage student grades with manual entry, Excel upload, or Google Sheets import. 
                      Organize grades by subject and track student progress.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Dynamic Grading System</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Configure custom grading systems per subject with categories, components, and weights.
                      Automatically compute final grades based on your configuration.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Student Access</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Students can view their grades securely using their student number and unique access code.
                      View computed final grades with detailed breakdowns.
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Secure & Private</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      Secure authentication for teachers and administrators. 
                      Student data is protected with access codes and encrypted storage.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold mb-4">How It Works</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    1
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">For Teachers</h3>
                    <p className="text-sm text-muted-foreground">
                      Log in to your account, create subjects, and add grade records. Configure your grading system
                      with categories and components, then compute final grades automatically.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">For Students</h3>
                    <p className="text-sm text-muted-foreground">
                      Visit the grades page, enter your student number and access code provided by your teacher.
                      View your grades and computed final grades with detailed breakdowns.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Grading System</h3>
                    <p className="text-sm text-muted-foreground">
                      Each subject can have a custom grading system with multiple categories (e.g., Major Exams, Major Outputs)
                      and components within each category. Final grades are computed automatically based on your configuration.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h2 className="text-2xl font-semibold mb-4">Quick Links</h2>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" asChild>
                  <Link href="/grades">
                    <BookOpen className="mr-2 h-4 w-4" />
                    View Grades
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/login">
                    <Shield className="mr-2 h-4 w-4" />
                    Teacher Login
                  </Link>
                </Button>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h2 className="text-2xl font-semibold mb-4">Developer</h2>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Code className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">Raymart O. Villena</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Full-Stack Developer | IoT & Cloud Enthusiast
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <a 
                          href="https://github.com/raevillena" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <Github className="h-4 w-4" />
                          View on GitHub
                        </a>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center">
                © {new Date().getFullYear()} MMSU Grade Viewer. All rights reserved.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

