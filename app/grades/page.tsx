"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Record } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { format } from "date-fns";

interface RecordWithSubject extends Record {
  subject_name?: string | null;
}

/**
 * Public grade lookup page
 * Students can view their grades by entering student number and access code
 */
function GradesPageContent() {
  const searchParams = useSearchParams();
  const [studentNumber, setStudentNumber] = useState("");
  const [code, setCode] = useState("");
  const [records, setRecords] = useState<RecordWithSubject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Pre-populate from URL params and auto-submit if both are present
  useEffect(() => {
    const studentNumberParam = searchParams.get("student_number");
    const codeParam = searchParams.get("code");
    
    if (studentNumberParam) {
      setStudentNumber(studentNumberParam);
    }
    if (codeParam) {
      setCode(codeParam);
    }
    
    // Auto-submit if both params are present
    if (studentNumberParam && codeParam) {
      // Small delay to ensure state is set
      const timer = setTimeout(() => {
        setError(null);
        setRecords([]);
        setLoading(true);
        setSearched(true);

        const params = new URLSearchParams({
          student_number: studentNumberParam,
          code: codeParam,
        });

        fetch(`/api/records?${params.toString()}`)
          .then((response) => response.json())
          .then((data) => {
            if (!data.error) {
              setRecords(data.data || []);
              if (data.data && data.data.length === 0) {
                setError("No records found. Please check your information and try again.");
              }
            } else {
              setError(data.error || "Failed to fetch records");
            }
            setLoading(false);
          })
          .catch(() => {
            setError("An error occurred. Please try again.");
            setLoading(false);
          });
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setRecords([]);
    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        student_number: studentNumber,
        code,
      });

      const response = await fetch(`/api/records?${params.toString()}`);

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch records");
        setLoading(false);
        return;
      }

      setRecords(data.data || []);
      if (data.data && data.data.length === 0) {
        setError("No records found. Please check your information and try again.");
      }
      setLoading(false);
    } catch (err) {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  // Get all unique grade keys from all records
  const getAllGradeKeys = (records: RecordWithSubject[]): string[] => {
    const keys = new Set<string>();
    records.forEach((record) => {
      Object.keys(record.grades || {}).forEach((key) => keys.add(key));
    });
    return Array.from(keys).sort();
  };

  const gradeKeys = getAllGradeKeys(records);
  
  // Get max scores from first record (should be same for all records in a subject)
  const maxScores = records.length > 0 && records[0].max_scores ? records[0].max_scores : {};

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
            <CardHeader>
              <CardTitle>View Your Grades</CardTitle>
              <CardDescription>
                Enter your student number and access code to view your grades
              </CardDescription>
            </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="studentNumber">Student Number</Label>
                  <Input
                    id="studentNumber"
                    type="text"
                    placeholder="12-005577"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Access Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="100001"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Loading..." : "View Grades"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {records.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Grades</CardTitle>
              <CardDescription>
                Found {records.length} record{records.length !== 1 ? "s" : ""}
                {(() => {
                  // Find the most recent updated_at from all records
                  const allUpdatedAts = records
                    .map(r => r.updated_at)
                    .filter(Boolean) as string[];
                  if (allUpdatedAts.length > 0) {
                    const mostRecent = allUpdatedAts.sort((a, b) => 
                      new Date(b).getTime() - new Date(a).getTime()
                    )[0];
                    return (
                      <span className="block mt-1 text-xs">
                        Last updated: {format(new Date(mostRecent), "PPpp")}
                      </span>
                    );
                  }
                  return null;
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead rowSpan={Object.keys(maxScores).length > 0 ? 2 : 1}>Subject</TableHead>
                      <TableHead rowSpan={Object.keys(maxScores).length > 0 ? 2 : 1}>Student Name</TableHead>
                      <TableHead rowSpan={Object.keys(maxScores).length > 0 ? 2 : 1}>Student Number</TableHead>
                      {gradeKeys.map((key) => (
                        <TableHead key={key} className="text-center">
                          {key}
                        </TableHead>
                      ))}
                    </TableRow>
                    {Object.keys(maxScores).length > 0 && (
                      <TableRow>
                        {gradeKeys.map((key) => (
                          <TableHead key={key} className="text-center text-xs text-muted-foreground font-normal">
                            / {maxScores[key] ?? "-"}
                          </TableHead>
                        ))}
                      </TableRow>
                    )}
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.subject_name || record.subject_id}</TableCell>
                        <TableCell>{record.student_name}</TableCell>
                        <TableCell>{record.student_number}</TableCell>
                        {gradeKeys.map((key) => (
                          <TableCell key={key} className="text-center">
                            {record.grades?.[key] ?? "-"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {searched && records.length === 0 && !error && (
          <Alert>
            <AlertDescription>
              No records found. Please verify your information and try again.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}

/**
 * Wrapper component with Suspense for useSearchParams
 */
export default function GradesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background py-12 px-4 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <GradesPageContent />
    </Suspense>
  );
}

