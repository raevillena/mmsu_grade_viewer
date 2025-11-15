"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type Record } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { format } from "date-fns";
import { Calculator, Loader2, Info } from "lucide-react";
import Link from "next/link";

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
  
  // Computed grade state
  const [computingGrade, setComputingGrade] = useState<string | null>(null); // subject_id
  const [computedGrade, setComputedGrade] = useState<any>(null);
  const [computedGradeDialogOpen, setComputedGradeDialogOpen] = useState(false);
  const [computeError, setComputeError] = useState<string | null>(null);

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

  // Group records by subject
  const groupRecordsBySubject = (records: RecordWithSubject[]) => {
    const grouped: { [key: string]: RecordWithSubject[] } = {};
    records.forEach((record) => {
      const subjectId = record.subject_id;
      if (!grouped[subjectId]) {
        grouped[subjectId] = [];
      }
      grouped[subjectId].push(record);
    });
    return grouped;
  };

  const handleComputeGrade = async (subjectId: string) => {
    if (!studentNumber || !code) {
      setComputeError("Student number and access code are required");
      return;
    }

    setComputingGrade(subjectId);
    setComputeError(null);
    setComputedGrade(null);

    try {
      const response = await fetch(`/api/subjects/${subjectId}/compute-grade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_number: studentNumber,
          code: code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setComputeError(data.error || "Failed to compute grade");
        setComputingGrade(null);
        return;
      }

      setComputedGrade(data.data);
      setComputedGradeDialogOpen(true);
      setComputingGrade(null);
    } catch (err) {
      setComputeError("An error occurred while computing the grade");
      setComputingGrade(null);
    }
  };

  const gradeKeys = getAllGradeKeys(records);
  const recordsBySubject = groupRecordsBySubject(records);
  
  // Get max scores from first record (should be same for all records in a subject)
  const maxScores = records.length > 0 && records[0].max_scores ? records[0].max_scores : {};

  return (
    <div className="min-h-screen bg-background py-12 px-4 relative">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/about" className="flex items-center gap-2">
            <Info className="h-4 w-4" />
            About
          </Link>
        </Button>
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
          <div className="space-y-6">
            {Object.entries(recordsBySubject).map(([subjectId, subjectRecords]) => {
              const subjectName = subjectRecords[0]?.subject_name || subjectId;
              const subjectGradeKeys = getAllGradeKeys(subjectRecords);
              const subjectMaxScores = subjectRecords[0]?.max_scores || {};

              return (
                <Card key={subjectId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{subjectName}</CardTitle>
                        <CardDescription>
                          {subjectRecords.length} record{subjectRecords.length !== 1 ? "s" : ""}
                          {(() => {
                            const allUpdatedAts = subjectRecords
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
                      </div>
                      <Button
                        onClick={() => handleComputeGrade(subjectId)}
                        disabled={computingGrade === subjectId}
                        variant="outline"
                        className="flex items-center gap-2"
                      >
                        {computingGrade === subjectId ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Computing...
                          </>
                        ) : (
                          <>
                            <Calculator className="h-4 w-4" />
                            Compute Grade
                          </>
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead rowSpan={Object.keys(subjectMaxScores).length > 0 ? 2 : 1}>Student Name</TableHead>
                            <TableHead rowSpan={Object.keys(subjectMaxScores).length > 0 ? 2 : 1}>Student Number</TableHead>
                            {subjectGradeKeys.map((key) => (
                              <TableHead key={key} className="text-center">
                                {key}
                              </TableHead>
                            ))}
                          </TableRow>
                          {Object.keys(subjectMaxScores).length > 0 && (
                            <TableRow>
                              {subjectGradeKeys.map((key) => (
                                <TableHead key={key} className="text-center text-xs text-muted-foreground font-normal">
                                  / {subjectMaxScores[key] ?? "-"}
                                </TableHead>
                              ))}
                            </TableRow>
                          )}
                        </TableHeader>
                        <TableBody>
                          {subjectRecords.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{record.student_name}</TableCell>
                              <TableCell>{record.student_number}</TableCell>
                              {subjectGradeKeys.map((key) => (
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
              );
            })}
          </div>
        )}

        {searched && records.length === 0 && !error && (
          <Alert>
            <AlertDescription>
              No records found. Please verify your information and try again.
            </AlertDescription>
          </Alert>
        )}

        {/* Computed Grade Dialog */}
        <Dialog open={computedGradeDialogOpen} onOpenChange={setComputedGradeDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Computed Final Grade</DialogTitle>
              <DialogDescription>
                {computedGrade?.subjectName && (
                  <span className="block mt-1">Subject: {computedGrade.subjectName}</span>
                )}
              </DialogDescription>
            </DialogHeader>
            {computeError && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{computeError}</AlertDescription>
              </Alert>
            )}
            {computedGrade && (
              <div className="space-y-6">
                <div className={`rounded-lg p-6 text-center ${
                  computedGrade.finalGrade >= (computedGrade.passingGrade || 50)
                    ? "bg-green-100 dark:bg-green-900/30"
                    : "bg-red-100 dark:bg-red-900/30"
                }`}>
                  <div className="text-sm text-muted-foreground mb-2">Final Grade</div>
                  <div className={`text-5xl font-bold ${
                    computedGrade.finalGrade >= (computedGrade.passingGrade || 50)
                      ? "text-green-800 dark:text-green-400"
                      : "text-red-800 dark:text-red-400"
                  }`}>
                    {computedGrade.finalGrade.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">out of 100.00</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Passing Grade: {(computedGrade.passingGrade || 50).toFixed(0)}%
                  </div>
                </div>

                {computedGrade.breakdown && computedGrade.breakdown.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Grade Breakdown</h3>
                    {computedGrade.breakdown.map((category: any) => (
                      <Card key={category.categoryId} className="border-2">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              {category.categoryName}
                            </CardTitle>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-primary">
                                {category.categoryScore.toFixed(2)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                out of {category.categoryWeight}%
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {category.components.map((component: any) => (
                              <div
                                key={component.componentId}
                                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                              >
                                <div>
                                  <div className="font-medium">{component.componentName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Weight: {component.componentWeight}%
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">
                                    {component.componentScore.toFixed(2)}%
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
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

