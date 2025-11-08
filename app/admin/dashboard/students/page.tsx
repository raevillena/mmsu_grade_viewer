"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, Loader2, Users, RefreshCw } from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { format } from "date-fns";

interface Student {
  id: string;
  student_number: string;
  email: string;
  fullname: string | null;
  moodle_user_id: number | null;
  last_synced_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * Admin Dashboard - Students List
 * View and search students from the email cache
 */
export default function AdminStudentsPage() {
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const pageSize = 50;
  
  // Moodle sync state
  const [moodleSyncDialogOpen, setMoodleSyncDialogOpen] = useState(false);
  const [moodleCourseId, setMoodleCourseId] = useState("");
  const [moodleEnrolId, setMoodleEnrolId] = useState("");
  const [syncingEmails, setSyncingEmails] = useState(false);

  useEffect(() => {
    fetchStudents();
    // Load Moodle settings from localStorage
    const savedCourseId = localStorage.getItem("moodleCourseId");
    const savedEnrolId = localStorage.getItem("moodleEnrolId");
    if (savedCourseId) {
      setMoodleCourseId(savedCourseId);
    }
    if (savedEnrolId) {
      setMoodleEnrolId(savedEnrolId);
    }
  }, [searchQuery, currentPage]);

  const fetchStudents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        search: searchQuery,
        limit: pageSize.toString(),
        offset: (currentPage * pageSize).toString(),
      });

      const response = await fetch(`/api/students?${params.toString()}`);

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch students");
      }

      setStudents(data.data || []);
      setTotalCount(data.count || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("Failed to fetch students", {
        description: errorMessage,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setCurrentPage(0);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(0);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  // Sync students directly from Moodle (independent of grade records)
  const handleSyncFromMoodle = async () => {
    if (!moodleCourseId || !moodleEnrolId) {
      toast.error("Configuration required", {
        description: "Please enter Moodle Course ID and Enrol ID",
      });
      return;
    }

    setSyncingEmails(true);
    try {
      const response = await fetch("/api/moodle/sync-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseid: moodleCourseId,
          enrolid: moodleEnrolId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync students");
      }

      if (!data.success) {
        throw new Error(data.error || "Sync failed");
      }

      const { total, created, updated, skipped, errors, errorDetails } = data.data;

      // Save Moodle settings to localStorage
      if (moodleCourseId) {
        localStorage.setItem("moodleCourseId", moodleCourseId);
      }
      if (moodleEnrolId) {
        localStorage.setItem("moodleEnrolId", moodleEnrolId);
      }

      const details = [
        `Total: ${total}`,
        `Created: ${created}`,
        `Updated: ${updated}`,
        skipped > 0 ? `Skipped: ${skipped}` : null,
        errors > 0 ? `Errors: ${errors}` : null,
      ].filter(Boolean).join(", ");

      toast.success("Sync completed", {
        description: details,
        duration: 5000,
      });

      if (errors > 0 && errorDetails && errorDetails.length > 0) {
        console.warn("Sync errors:", errorDetails);
      }

      setMoodleSyncDialogOpen(false);
      fetchStudents(); // Refresh the students list
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync students";
      toast.error("Sync failed", {
        description: errorMessage,
      });
    } finally {
      setSyncingEmails(false);
    }
  };

  if (loading && students.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Students</h1>
            <p className="text-muted-foreground mt-1">
              View and search students from the email cache
            </p>
          </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Students List</CardTitle>
                <CardDescription>
                  {totalCount > 0
                    ? `Found ${totalCount} student${totalCount !== 1 ? "s" : ""}${searchQuery ? ` matching "${searchQuery}"` : ""}`
                    : "No students found"}
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setMoodleSyncDialogOpen(true)}
                disabled={syncingEmails}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${syncingEmails ? "animate-spin" : ""}`} />
                Sync Emails from Moodle
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search by name, email, or student number..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Search
                    </>
                  )}
                </Button>
                {searchQuery && (
                  <Button type="button" variant="outline" onClick={handleClearSearch}>
                    Clear
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  onClick={fetchStudents}
                  disabled={loading}
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </form>

            {error && (
              <Alert variant="destructive" className="mb-6">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Students Table */}
            {students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery
                    ? `No students found matching "${searchQuery}"`
                    : "No students in cache. Sync students from Moodle to populate the cache."}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Number</TableHead>
                        <TableHead>Full Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Moodle User ID</TableHead>
                        <TableHead>Last Synced</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => (
                        <TableRow key={student.id}>
                          <TableCell className="font-mono text-sm">
                            {student.student_number}
                          </TableCell>
                          <TableCell className="font-medium">
                            {student.fullname || <span className="text-muted-foreground italic">N/A</span>}
                          </TableCell>
                          <TableCell>{student.email}</TableCell>
                          <TableCell>
                            {student.moodle_user_id ? (
                              <span className="font-mono text-sm">{student.moodle_user_id}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(student.last_synced_at), "PPp")}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(student.created_at), "PPp")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-muted-foreground">
                      Page {currentPage + 1} of {totalPages} ({totalCount} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                        disabled={currentPage === 0 || loading}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
                        disabled={currentPage >= totalPages - 1 || loading}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Moodle Sync Dialog */}
        <Dialog open={moodleSyncDialogOpen} onOpenChange={setMoodleSyncDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sync Students from Moodle</DialogTitle>
              <DialogDescription>
                Fetch and store student data directly from Moodle. This is independent of grade records
                and will populate the student cache with all available students from the specified course.
                The data can be used later for various purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="moodle-course-id">Moodle Course ID</Label>
                <Input
                  id="moodle-course-id"
                  type="text"
                  placeholder="e.g., 15556"
                  value={moodleCourseId}
                  onChange={(e) => {
                    setMoodleCourseId(e.target.value);
                    if (e.target.value.trim()) {
                      localStorage.setItem("moodleCourseId", e.target.value.trim());
                    }
                  }}
                  disabled={syncingEmails}
                />
                <p className="text-sm text-muted-foreground">
                  The course ID from Moodle (found in the course URL)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="moodle-enrol-id">Moodle Enrol ID</Label>
                <Input
                  id="moodle-enrol-id"
                  type="text"
                  placeholder="e.g., 49444"
                  value={moodleEnrolId}
                  onChange={(e) => {
                    setMoodleEnrolId(e.target.value);
                    if (e.target.value.trim()) {
                      localStorage.setItem("moodleEnrolId", e.target.value.trim());
                    }
                  }}
                  disabled={syncingEmails}
                />
                <p className="text-sm text-muted-foreground">
                  The enrollment ID from Moodle (found in enrollment settings)
                </p>
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMoodleSyncDialogOpen(false)}
                  disabled={syncingEmails}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSyncFromMoodle}
                  disabled={syncingEmails}
                >
                  {syncingEmails ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Sync from Moodle
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </div>
  );
}

