"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { type Record as GradeRecord, type Subject } from "@/lib/types";
import { ArrowLeft, Plus, Edit, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

/**
 * Teacher Dashboard - Subject Detail Page
 * View and manage grade records for a specific subject
 * Supports manual entry, Excel upload, and Google Sheets import
 */
export default function SubjectDetailPage() {
  const router = useRouter();
  const params = useParams();
  const subjectId = params.id as string;

  const [subject, setSubject] = useState<Subject | null>(null);
  const [records, setRecords] = useState<GradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<GradeRecord | null>(null);
  const [formData, setFormData] = useState({
    student_name: "",
    student_number: "",
    email: "",
    code: "",
    grades: {} as Record<string, number>,
  });
  const [gradeKeys, setGradeKeys] = useState<string[]>([]);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");

  useEffect(() => {
    if (subjectId) {
      fetchSubject();
      fetchRecords();
    }
  }, [subjectId]);

  const fetchSubject = async () => {
    try {
      const response = await fetch(`/api/subjects/${subjectId}`);

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch subject");
      }

      setSubject(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const fetchRecords = async () => {
    try {
      const response = await fetch(`/api/records?subject_id=${subjectId}`);

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch records");
      }

      const fetchedRecords = data.data || [];
      setRecords(fetchedRecords);

      // Extract all grade keys from records
      const keys = new Set<string>();
      fetchedRecords.forEach((record: GradeRecord) => {
        Object.keys(record.grades || {}).forEach((key) => keys.add(key));
      });
      setGradeKeys(Array.from(keys).sort());

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (record?: GradeRecord) => {
    if (record) {
      setEditingRecord(record);
      setFormData({
        student_name: record.student_name,
        student_number: record.student_number,
        email: record.email,
        code: record.code,
        grades: record.grades || {},
      });
      // Update grade keys if record has new keys
      const keys = Object.keys(record.grades || {});
      setGradeKeys((prev) => {
        const combined = new Set([...prev, ...keys]);
        return Array.from(combined).sort();
      });
    } else {
      setEditingRecord(null);
      setFormData({
        student_name: "",
        student_number: "",
        email: "",
        code: "",
        grades: {},
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRecord(null);
    setFormData({
      student_name: "",
      student_number: "",
      email: "",
      code: "",
      grades: {},
    });
  };

  const handleAddGradeKey = () => {
    const key = prompt("Enter grade key (e.g., quiz1, LE1, assignment1):");
    if (key && !gradeKeys.includes(key)) {
      setGradeKeys([...gradeKeys, key].sort());
      setFormData({
        ...formData,
        grades: { ...formData.grades, [key]: 0 },
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      const url = editingRecord
        ? `/api/records/${editingRecord.id}`
        : "/api/records";
      const method = editingRecord ? "PUT" : "POST";

      const payload = {
        ...formData,
        subject_id: subjectId,
      };

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
        throw new Error(data.error || "Failed to save record");
      }

      handleCloseDialog();
      fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleDelete = async (recordId: string) => {
    if (!confirm("Are you sure you want to delete this record?")) {
      return;
    }

    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete record");
      }

      fetchRecords();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Process the data - expect columns: student_name, student_number, email, code, and grade columns
      const records: any[] = [];

      for (const row of jsonData as any[]) {
        const studentName = row["Student Name"] || row["student_name"] || row["Name"];
        const studentNumber = row["Student Number"] || row["student_number"] || row["Student Number"];
        const email = row["Email"] || row["email"];
        const code = row["Code"] || row["code"] || row["Security Code"];

        if (!studentName || !studentNumber || !email || !code) {
          continue;
        }

        // Extract grades (all columns except the standard ones)
        const grades: Record<string, number> = {};
        Object.keys(row).forEach((key) => {
          if (
            !["Student Name", "student_name", "Name", "Student Number", "student_number", 
              "Email", "email", "Code", "code", "Security Code"].includes(key)
          ) {
            const value = row[key];
            if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
              grades[key] = Number(value);
            }
          }
        });

        records.push({
          subject_id: subjectId,
          student_name: studentName,
          student_number: String(studentNumber),
          email: String(email),
          code: String(code),
          grades,
        });
      }

      // Upload records
      for (const record of records) {
        const response = await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });

        if (response.status === 401) {
          // Unauthorized - redirect to login
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to upload record");
        }
      }

      setUploadDialogOpen(false);
      fetchRecords();
      alert(`Successfully uploaded ${records.length} records`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process Excel file");
    }
  };

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) {
      setError("Please enter a Google Sheet URL");
      return;
    }

    try {
      // Convert Google Sheets URL to CSV export URL
      // Format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
      // CSV: https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid=0
      const match = googleSheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Invalid Google Sheets URL");
      }

      const sheetId = match[1];
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;

      const response = await fetch(csvUrl);
      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: "string" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      // Process similar to Excel upload
      const records: any[] = [];

      for (const row of jsonData as any[]) {
        const studentName = row["Student Name"] || row["student_name"] || row["Name"];
        const studentNumber = row["Student Number"] || row["student_number"] || row["Student Number"];
        const email = row["Email"] || row["email"];
        const code = row["Code"] || row["code"] || row["Security Code"];

        if (!studentName || !studentNumber || !email || !code) {
          continue;
        }

        const grades: Record<string, number> = {};
        Object.keys(row).forEach((key) => {
          if (
            !["Student Name", "student_name", "Name", "Student Number", "student_number", 
              "Email", "email", "Code", "code", "Security Code"].includes(key)
          ) {
            const value = row[key];
            if (typeof value === "number" || (typeof value === "string" && !isNaN(Number(value)))) {
              grades[key] = Number(value);
            }
          }
        });

        records.push({
          subject_id: subjectId,
          student_name: studentName,
          student_number: String(studentNumber),
          email: String(email),
          code: String(code),
          grades,
        });
      }

      // Upload records
      for (const record of records) {
        const response = await fetch("/api/records", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(record),
        });

        if (response.status === 401) {
          // Unauthorized - redirect to login
          window.location.replace("/login");
          return;
        }

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to upload record");
        }
      }

      setUploadDialogOpen(false);
      setGoogleSheetUrl("");
      fetchRecords();
      alert(`Successfully imported ${records.length} records from Google Sheets`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import from Google Sheets");
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" onClick={() => router.push("/teacher/dashboard/subjects")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{subject?.name || "Subject"}</h1>
            <p className="text-muted-foreground mt-1">Manage grade records</p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4 mb-6">
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Add Record
          </Button>
          <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Grades
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Grade Records</CardTitle>
            <CardDescription>
              {records.length} record{records.length !== 1 ? "s" : ""} in this subject
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student Name</TableHead>
                    <TableHead>Student Number</TableHead>
                    <TableHead>Email</TableHead>
                    {gradeKeys.map((key) => (
                      <TableHead key={key} className="text-center">
                        {key}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={4 + gradeKeys.length}
                        className="text-center text-muted-foreground"
                      >
                        No records found. Add your first record or upload a file.
                      </TableCell>
                    </TableRow>
                  ) : (
                    records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{record.student_name}</TableCell>
                        <TableCell>{record.student_number}</TableCell>
                        <TableCell>{record.email}</TableCell>
                        {gradeKeys.map((key) => (
                          <TableCell key={key} className="text-center">
                            {record.grades?.[key] ?? "-"}
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(record)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(record.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Record Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingRecord ? "Edit Record" : "Add Record"}
              </DialogTitle>
              <DialogDescription>
                {editingRecord
                  ? "Update student grade record"
                  : "Add a new student grade record"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="student_name">Student Name</Label>
                  <Input
                    id="student_name"
                    value={formData.student_name}
                    onChange={(e) =>
                      setFormData({ ...formData, student_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="student_number">Student Number</Label>
                  <Input
                    id="student_number"
                    value={formData.student_number}
                    onChange={(e) =>
                      setFormData({ ...formData, student_number: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="code">Security Code</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label>Grades</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddGradeKey}
                  >
                    Add Grade Column
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {gradeKeys.map((key) => (
                    <div key={key} className="space-y-2">
                      <Label htmlFor={`grade-${key}`}>{key}</Label>
                      <Input
                        id={`grade-${key}`}
                        type="number"
                        step="0.01"
                        value={formData.grades[key] || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            grades: {
                              ...formData.grades,
                              [key]: parseFloat(e.target.value) || 0,
                            },
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button type="submit">{editingRecord ? "Update" : "Create"}</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Grades</DialogTitle>
              <DialogDescription>
                Upload grades from Excel file or Google Sheets
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="excel-file">Upload Excel File (.xlsx)</Label>
                <Input
                  id="excel-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleExcelUpload}
                />
                <p className="text-sm text-muted-foreground">
                  Expected columns: Student Name, Student Number, Email, Code, and grade columns
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="google-sheet-url">Google Sheets URL</Label>
                <Input
                  id="google-sheet-url"
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                />
                <Button
                  type="button"
                  onClick={handleGoogleSheetImport}
                  className="w-full"
                  disabled={!googleSheetUrl}
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Import from Google Sheets
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

