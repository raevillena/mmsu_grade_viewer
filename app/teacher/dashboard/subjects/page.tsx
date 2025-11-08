"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Subject } from "@/lib/types";
import { Plus, Edit, Trash2, LogOut, BookOpen, Upload, FileSpreadsheet, Link, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import * as XLSX from "xlsx";

/**
 * Teacher Dashboard - Subjects Management
 * Allows teachers to create, view, edit, and delete their subjects
 */
export default function TeacherSubjectsPage() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subjectToDelete, setSubjectToDelete] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchCurrentUser();
    fetchSubjects();
  }, []);

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch("/api/auth/validate", { method: "POST" });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (data.valid && data.user && data.user.id) {
        // Use the user ID directly from the validate response
        // The validate endpoint returns the Supabase user ID
        setCurrentUserId(data.user.id);
      }
    } catch (err) {
      console.error("Error fetching current user:", err);
    }
  };

  const fetchSubjects = async () => {
    try {
      const response = await fetch("/api/subjects");

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch subjects");
      }

      setSubjects(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (subject?: Subject) => {
    if (subject) {
      setEditingSubject(subject);
      setFormData({ name: subject.name });
    } else {
      setEditingSubject(null);
      setFormData({ name: "" });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSubject(null);
    setFormData({ name: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (!currentUserId) {
      setError("User ID not found. Please refresh the page.");
      setSubmitting(false);
      return;
    }

    try {
      const url = editingSubject
        ? `/api/subjects/${editingSubject.id}`
        : "/api/subjects";
      const method = editingSubject ? "PUT" : "POST";

      const payload = editingSubject
        ? { name: formData.name }
        : { name: formData.name, teacher_id: currentUserId };

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to save subject";
        setError(errorMessage);
        toast.error(editingSubject ? "Update Failed" : "Create Failed", {
          description: errorMessage,
        });
        return;
      }

      handleCloseDialog();
      fetchSubjects();
      toast.success(editingSubject ? "Subject Updated" : "Subject Created", {
        description: `"${formData.name}" has been ${editingSubject ? "updated" : "created"} successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(editingSubject ? "Update Failed" : "Create Failed", {
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (subjectId: string) => {
    const subject = subjects.find((s) => s.id === subjectId);
    if (subject) {
      setSubjectToDelete({ id: subjectId, name: subject.name });
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!subjectToDelete) return;

    const subjectId = subjectToDelete.id;
    const subjectName = subjectToDelete.name;

    setDeletingId(subjectId);
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to delete subject";
        setError(errorMessage);
        toast.error("Delete Failed", {
          description: errorMessage,
        });
        return;
      }

      fetchSubjects();
      toast.success("Subject Deleted", {
        description: `"${subjectName}" has been deleted successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("Delete Failed", {
        description: errorMessage,
      });
    } finally {
      setDeletingId(null);
      setSubjectToDelete(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Extract subject names from the Excel file
      // Expected columns: "Subject Name", "subject_name", "Name", or "Subject"
      const subjectNames: string[] = [];

      for (const row of jsonData as any[]) {
        const subjectName = 
          row["Subject Name"] || 
          row["subject_name"] || 
          row["Name"] || 
          row["Subject"] ||
          row["subject"];

        if (subjectName && typeof subjectName === "string" && subjectName.trim()) {
          subjectNames.push(subjectName.trim());
        }
      }

      if (subjectNames.length === 0) {
        throw new Error("No valid subject names found in the Excel file. Expected columns: 'Subject Name', 'subject_name', 'Name', or 'Subject'");
      }

      // Create subjects
      await createSubjectsFromNames(subjectNames);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process Excel file";
      setError(errorMessage);
      toast.error("Import Failed", {
        description: errorMessage,
      });
    } finally {
      setImportLoading(false);
      // Reset file input
      e.target.value = "";
    }
  };

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) {
      setError("Please enter a Google Sheet URL");
      toast.error("Invalid Input", {
        description: "Please enter a Google Sheet URL",
      });
      return;
    }

    setImportLoading(true);
    setError(null);

    try {
      // Convert Google Sheets URL to CSV export URL
      // Format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
      // CSV: https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid=0
      const match = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Invalid Google Sheets URL. Please use a URL like: https://docs.google.com/spreadsheets/d/{ID}/edit");
      }

      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch Google Sheet. Make sure the sheet is publicly accessible or shared with view permissions.");
      }

      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: "string" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Extract subject names
      const subjectNames: string[] = [];

      for (const row of jsonData as any[]) {
        const subjectName = 
          row["Subject Name"] || 
          row["subject_name"] || 
          row["Name"] || 
          row["Subject"] ||
          row["subject"];

        if (subjectName && typeof subjectName === "string" && subjectName.trim()) {
          subjectNames.push(subjectName.trim());
        }
      }

      if (subjectNames.length === 0) {
        throw new Error("No valid subject names found in the Google Sheet. Expected columns: 'Subject Name', 'subject_name', 'Name', or 'Subject'");
      }

      // Create subjects
      await createSubjectsFromNames(subjectNames);
      setGoogleSheetUrl("");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import from Google Sheets";
      setError(errorMessage);
      toast.error("Import Failed", {
        description: errorMessage,
      });
    } finally {
      setImportLoading(false);
    }
  };

  const createSubjectsFromNames = async (subjectNames: string[]) => {
    if (!currentUserId) {
      throw new Error("User ID not found. Please refresh the page.");
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const name of subjectNames) {
      try {
        const response = await fetch("/api/subjects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            teacher_id: currentUserId,
          }),
        });

        if (response.status === 401) {
          window.location.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok) {
          errorCount++;
          errors.push(`${name}: ${data.error || "Failed to create"}`);
        } else {
          successCount++;
        }
      } catch (err) {
        errorCount++;
        errors.push(`${name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }

    if (successCount > 0) {
      toast.success("Import Successful", {
        description: `Successfully created ${successCount} subject${successCount !== 1 ? "s" : ""}${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
      });
      fetchSubjects();
      setImportDialogOpen(false);
    }

    if (errorCount > 0 && successCount === 0) {
      throw new Error(`Failed to create all subjects. Errors: ${errors.join("; ")}`);
    }

    if (errorCount > 0 && successCount > 0) {
      setError(`Some subjects failed to create: ${errors.join("; ")}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage your subjects</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Subjects</CardTitle>
                <CardDescription>
                  Manage the subjects you teach
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => setImportDialogOpen(true)} 
                  disabled={!currentUserId || submitting || deletingId !== null}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </Button>
                <Button 
                  onClick={() => handleOpenDialog()} 
                  disabled={!currentUserId || submitting || deletingId !== null}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Subject
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No subjects found. Create your first subject to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  subjects.map((subject) => (
                    <TableRow key={subject.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <button
                            onClick={() => router.push(`/teacher/dashboard/subjects/${subject.id}`)}
                            className="font-medium hover:underline"
                          >
                            {subject.name}
                          </button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(subject.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(subject)}
                            disabled={deletingId === subject.id || submitting}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(subject.id)}
                            disabled={deletingId === subject.id || submitting}
                          >
                            {deletingId === subject.id ? (
                              <Loader2 className="h-4 w-4 text-destructive animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSubject ? "Edit Subject" : "Create Subject"}
              </DialogTitle>
              <DialogDescription>
                {editingSubject
                  ? "Update subject information"
                  : "Add a new subject you teach"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Subject Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., Mathematics 101"
                    required
                    disabled={submitting}
                  />
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
                  onClick={handleCloseDialog}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {editingSubject ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingSubject ? "Update" : "Create"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Import Subjects</DialogTitle>
              <DialogDescription>
                Import multiple subjects from an Excel file or Google Sheets
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* Excel File Upload */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                  <Label className="text-base font-semibold">Import from Excel</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="excel-file">Excel File (.xlsx, .xls)</Label>
                  <Input
                    id="excel-file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleExcelImport}
                    disabled={importLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Expected column: "Subject Name", "subject_name", "Name", or "Subject"
                  </p>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Google Sheets Import */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-muted-foreground" />
                  <Label className="text-base font-semibold">Import from Google Sheets</Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="google-sheet-url">Google Sheets URL</Label>
                  <Input
                    id="google-sheet-url"
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={googleSheetUrl}
                    onChange={(e) => setGoogleSheetUrl(e.target.value)}
                    disabled={importLoading}
                  />
                  <p className="text-sm text-muted-foreground">
                    Make sure the sheet is publicly accessible or shared with view permissions
                  </p>
                  <Button
                    type="button"
                    onClick={handleGoogleSheetImport}
                    disabled={importLoading || !googleSheetUrl}
                    className="w-full"
                  >
                    {importLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      "Import from Google Sheets"
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setImportDialogOpen(false);
                    setGoogleSheetUrl("");
                    setError(null);
                  }}
                  disabled={importLoading}
                >
                  {importLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Close"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete Subject"
          description={
            subjectToDelete
              ? `Are you sure you want to delete "${subjectToDelete.name}"? All records associated with this subject will also be deleted. This action cannot be undone.`
              : ""
          }
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />
      </div>
    </div>
  );
}

