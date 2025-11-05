"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type Record } from "@/lib/types";

interface RecordWithSubject extends Record {
  subject_name?: string | null;
}

/**
 * Public grade lookup page
 * Students can view their grades by entering email, student number, and security code
 */
export default function GradesPage() {
  const [email, setEmail] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [code, setCode] = useState("");
  const [records, setRecords] = useState<RecordWithSubject[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setRecords([]);
    setLoading(true);
    setSearched(true);

    try {
      const params = new URLSearchParams({
        email,
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

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>View Your Grades</CardTitle>
            <CardDescription>
              Enter your email, student number, and security code to view your grades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="student@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="studentNumber">Student Number</Label>
                  <Input
                    id="studentNumber"
                    type="text"
                    placeholder="12345678"
                    value={studentNumber}
                    onChange={(e) => setStudentNumber(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Security Code</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="ABC123"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Searching..." : "View Grades"}
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
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Subject</TableHead>
                      <TableHead>Student Name</TableHead>
                      <TableHead>Student Number</TableHead>
                      {gradeKeys.map((key) => (
                        <TableHead key={key} className="text-center">
                          {key}
                        </TableHead>
                      ))}
                    </TableRow>
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

