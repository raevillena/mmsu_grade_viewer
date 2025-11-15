"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { type Record as GradeRecord, type Subject, type GradingSystem, type GradingCategory, type GradingComponent } from "@/lib/types";
import { ArrowLeft, Plus, Edit, Trash2, Upload, FileSpreadsheet, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Search, X, Copy, Check, RefreshCw, Mail, Calculator, Settings, BookOpen, FileText, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
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
    max_scores: {} as Record<string, number>,
  });
  const [gradeKeys, setGradeKeys] = useState<string[]>([]);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [persistentSheetUrl, setPersistentSheetUrl] = useState("");
  const [clearAllBeforeImport, setClearAllBeforeImport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Moodle sync state
  const [moodleSyncDialogOpen, setMoodleSyncDialogOpen] = useState(false);
  const [moodleCourseId, setMoodleCourseId] = useState("");
  const [moodleEnrolId, setMoodleEnrolId] = useState("");
  const [syncingEmails, setSyncingEmails] = useState(false);
  const [fetchingEmail, setFetchingEmail] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [sendEmailDialogOpen, setSendEmailDialogOpen] = useState(false);
  const [pendingEmailAction, setPendingEmailAction] = useState<{ selectedOnly: boolean } | null>(null);
  
  // Inline editing state
  const [editingEmailId, setEditingEmailId] = useState<string | null>(null);
  const [editingEmailValue, setEditingEmailValue] = useState<string>("");
  const [savingEmailId, setSavingEmailId] = useState<string | null>(null);
  
  // Sorting and filtering state
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [filterText, setFilterText] = useState("");
  
  // Selection state
  const [selectedRecords, setSelectedRecords] = useState<Set<string>>(new Set());
  const [copiedRecordId, setCopiedRecordId] = useState<string | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [regeneratingCodeId, setRegeneratingCodeId] = useState<string | null>(null);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  
  // Grading system state
  const [gradingSystemDialogOpen, setGradingSystemDialogOpen] = useState(false);
  const [gradingSystem, setGradingSystem] = useState<GradingSystem | null>(null);
  const [savingGradingSystem, setSavingGradingSystem] = useState(false);
  
  // Computed grades state
  const [computedGrades, setComputedGrades] = useState<any[] | null>(null);
  const [computingGrades, setComputingGrades] = useState(false);
  const [computedGradesDialogOpen, setComputedGradesDialogOpen] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState("records");
  
  // Collapsible sections state for grading system dialog
  const [gradeMappingExpanded, setGradeMappingExpanded] = useState(true);
  const [weightsExpanded, setWeightsExpanded] = useState(true);

  useEffect(() => {
    if (subjectId) {
      fetchSubject();
      fetchRecords();
      // Load persistent Google Sheets URL from localStorage
      const savedUrl = localStorage.getItem(`googleSheetUrl_${subjectId}`);
      if (savedUrl) {
        setPersistentSheetUrl(savedUrl);
      }
      // Load persistent Moodle settings from localStorage
      const savedCourseId = localStorage.getItem(`moodleCourseId_${subjectId}`);
      const savedEnrolId = localStorage.getItem(`moodleEnrolId_${subjectId}`);
      if (savedCourseId) {
        setMoodleCourseId(savedCourseId);
      }
      if (savedEnrolId) {
        setMoodleEnrolId(savedEnrolId);
      }
    }
  }, [subjectId]);

  // Check if table is scrollable and show hint
  useEffect(() => {
    const checkScrollable = () => {
      if (tableScrollRef.current) {
        const { scrollWidth, clientWidth } = tableScrollRef.current;
        const { scrollLeft } = tableScrollRef.current;
        const isScrollable = scrollWidth > clientWidth;
        // Show hint only if scrollable and not scrolled all the way to the right
        setShowScrollHint(isScrollable && scrollLeft < scrollWidth - clientWidth - 10);
      }
    };

    checkScrollable();
    window.addEventListener("resize", checkScrollable);
    
    // Check after records load and grade keys change
    const timer = setTimeout(checkScrollable, 100);

    return () => {
      window.removeEventListener("resize", checkScrollable);
      clearTimeout(timer);
    };
  }, [records, gradeKeys]);

  // Clear selection when records change (after fetch/delete)
  useEffect(() => {
    // Only keep selected records that still exist
    setSelectedRecords((prev) => {
      const existingIds = new Set(records.map((r) => r.id));
      const filtered = new Set(Array.from(prev).filter((id) => existingIds.has(id)));
      return filtered;
    });
  }, [records]);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // Derived state for bulk selection display
  const isBulkActionVisible = selectedRecords.size > 0;

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

      const subjectData = data.data;
      setSubject(subjectData);
      // Load grading system if it exists and is valid
      if (subjectData.grading_system && 
          subjectData.grading_system.categories && 
          Array.isArray(subjectData.grading_system.categories) && 
          subjectData.grading_system.categories.length > 0) {
        setGradingSystem(subjectData.grading_system);
      } else {
        // Reset to null if invalid structure
        setGradingSystem(null);
      }
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
        max_scores: record.max_scores || {},
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
        max_scores: {},
      });
    }
    setDialogOpen(true);
  };

  // Auto-fill email from cache when student_number changes
  useEffect(() => {
    if (formData.student_number && formData.student_number.trim() && !editingRecord) {
      const studentNumber = formData.student_number.trim();
      // Debounce the lookup
      const timeoutId = setTimeout(async () => {
        try {
          const response = await fetch(`/api/moodle/lookup-email?student_number=${encodeURIComponent(studentNumber)}`);
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setFormData((prev) => ({
                ...prev,
                email: data.data.email,
                student_name: prev.student_name || data.data.fullname || prev.student_name,
              }));
            }
          }
        } catch (err) {
          // Silently fail - user can manually enter email
          console.log("Email lookup failed:", err);
        }
      }, 500); // 500ms debounce

      return () => clearTimeout(timeoutId);
    }
  }, [formData.student_number, editingRecord]);

  // Handle manual email fetch from Moodle
  const handleFetchEmail = async () => {
    if (!formData.student_number.trim()) {
      toast.error("Student number required", {
        description: "Please enter a student number first",
      });
      return;
    }

    if (!moodleCourseId || !moodleEnrolId) {
      toast.error("Moodle configuration required", {
        description: "Please set Moodle Course ID and Enrol ID in the sync dialog first",
      });
      setMoodleSyncDialogOpen(true);
      return;
    }

    setFetchingEmail(true);
    try {
      const response = await fetch("/api/moodle/fetch-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_number: formData.student_number.trim(),
          courseid: moodleCourseId,
          enrolid: moodleEnrolId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch email");
      }

      if (data.success && data.data) {
        setFormData((prev) => ({
          ...prev,
          email: data.data.email,
          student_name: prev.student_name || data.data.fullname || prev.student_name,
        }));
        toast.success("Email fetched", {
          description: data.data.from_cache ? "From cache" : "From Moodle",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch email";
      toast.error("Fetch failed", {
        description: errorMessage,
      });
    } finally {
      setFetchingEmail(false);
    }
  };

  // Handle opening send email confirmation dialog
  const handleSendEmailsClick = (selectedOnly: boolean = false) => {
    let recordsToSend: GradeRecord[] = [];
    
    if (selectedOnly) {
      // Send only to selected records
      if (selectedRecords.size === 0) {
        toast.error("No selection", {
          description: "Please select at least one student to send emails to",
        });
        return;
      }
      
      recordsToSend = records.filter(r => selectedRecords.has(r.id));
    } else {
      // Send to all records
      recordsToSend = records;
    }

    if (recordsToSend.length === 0) {
      toast.error("No records", {
        description: "No records to send emails for",
      });
      return;
    }

    // Filter records that have email and code
    const validRecords = recordsToSend.filter(r => r.email && r.code);
    if (validRecords.length === 0) {
      toast.error("No valid records", {
        description: "No records with both email and access code",
      });
      return;
    }

    // Store the action and open dialog
    setPendingEmailAction({ selectedOnly });
    setSendEmailDialogOpen(true);
  };

  // Handle actually sending emails (called from dialog confirmation)
  const handleSendEmailsConfirm = async () => {
    if (!pendingEmailAction) return;

    const { selectedOnly } = pendingEmailAction;
    setSendEmailDialogOpen(false);
    setSendingEmails(true);

    try {
      const response = await fetch("/api/records/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectId,
          record_ids: selectedOnly ? Array.from(selectedRecords) : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send emails");
      }

      if (data.success) {
        const { total, sent, failed, errors } = data.data;
        
        toast.success("Emails sent", {
          description: `Sent ${sent} of ${total} email(s)${failed > 0 ? `. ${failed} failed.` : ""}`,
          duration: 5000,
        });
        
        if (failed > 0 && errors.length > 0) {
          console.error("Email errors:", errors);
          // Show first few errors in console or toast
          if (errors.length <= 3) {
            errors.forEach((err: string) => {
              toast.error("Email error", { description: err, duration: 3000 });
            });
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send emails";
      toast.error("Send failed", {
        description: errorMessage,
      });
    } finally {
      setSendingEmails(false);
      setPendingEmailAction(null);
    }
  };

  // Handle subject-specific email sync (only updates records in this subject)
  const handleSyncSubjectEmails = async () => {
    if (!moodleCourseId || !moodleEnrolId) {
      toast.error("Configuration required", {
        description: "Please enter Moodle Course ID and Enrol ID",
      });
      setMoodleSyncDialogOpen(true);
      return;
    }

    setSyncingEmails(true);
    try {
      const response = await fetch("/api/moodle/sync-subject-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectId,
          courseid: moodleCourseId,
          enrolid: moodleEnrolId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to sync emails");
      }

      if (data.success) {
        const { total, updated, notFound, errors } = data.data;
        
        toast.success("Sync completed", {
          description: `Updated ${updated} of ${total} record(s)${notFound > 0 ? `. ${notFound} not found in Moodle.` : ""}${errors > 0 ? ` ${errors} errors.` : ""}`,
        });
        
        // Refresh records to show updated emails
        if (updated > 0) {
          fetchRecords();
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sync emails";
      toast.error("Sync failed", {
        description: errorMessage,
      });
    } finally {
      setSyncingEmails(false);
    }
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
      max_scores: {},
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
    setSubmitting(true);

    try {
      const url = editingRecord
        ? `/api/records/${editingRecord.id}`
        : "/api/records";
      const method = editingRecord ? "PUT" : "POST";

      // Build payload, excluding empty max_scores when updating (to preserve existing values)
      const { max_scores, ...formDataWithoutMaxScores } = formData;
      const payload = {
        ...formDataWithoutMaxScores,
        subject_id: subjectId,
        // Only include max_scores if it has values (to avoid clearing existing max_scores on update)
        ...(Object.keys(max_scores || {}).length > 0 ? { max_scores } : {}),
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
        const errorMessage = data.error || "Failed to save record";
        setError(errorMessage);
        toast.error(editingRecord ? "Update Failed" : "Create Failed", {
          description: errorMessage,
        });
        return;
      }

      handleCloseDialog();
      fetchRecords();
      toast.success(editingRecord ? "Record Updated" : "Record Created", {
        description: `Record for "${formData.student_name}" has been ${editingRecord ? "updated" : "created"} successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(editingRecord ? "Update Failed" : "Create Failed", {
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle inline email editing
  const handleEmailEditStart = (record: GradeRecord) => {
    setEditingEmailId(record.id);
    setEditingEmailValue(record.email);
  };

  const handleEmailEditCancel = () => {
    setEditingEmailId(null);
    setEditingEmailValue("");
  };

  const handleEmailEditSave = async (recordId: string) => {
    const newEmail = editingEmailValue.trim();
    
    // Validate email format (must be valid if provided, cannot be empty)
    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error("Invalid email", {
        description: "Please enter a valid email address",
      });
      // Keep editing mode open so user can fix it
      return;
    }

    const record = records.find(r => r.id === recordId);
    if (!record) {
      handleEmailEditCancel();
      return;
    }

    // If email hasn't changed, just cancel
    if (newEmail === record.email) {
      handleEmailEditCancel();
      return;
    }

    setSavingEmailId(recordId);
    
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail,
        }),
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const responseText = await response.text();
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error("Invalid response from server");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to update email");
      }

      // Refresh records to ensure UI is in sync with database
      await fetchRecords();

      setEditingEmailId(null);
      setEditingEmailValue("");
      
      toast.success("Email updated", {
        description: "Email has been updated successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update email";
      toast.error("Update failed", {
        description: errorMessage,
      });
    } finally {
      setSavingEmailId(null);
    }
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, recordId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleEmailEditSave(recordId);
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleEmailEditCancel();
    }
  };

  const handleEmailBlur = (recordId: string) => {
    // Use setTimeout to allow click events to fire first
    // This prevents canceling when clicking the save button
    setTimeout(() => {
      // Only save if we're still in editing mode (user didn't cancel)
      if (editingEmailId === recordId) {
        handleEmailEditSave(recordId);
      }
    }, 200);
  };

  const handleDeleteClick = (recordId: string) => {
    const record = records.find((r) => r.id === recordId);
    if (record) {
      // Clear any selected records when doing single delete
      clearSelection();
      setRecordToDelete({ id: recordId, name: record.student_name });
      setDeleteDialogOpen(true);
    }
  };

  const handleDeleteConfirm = async () => {
    // Handle bulk delete
    if (selectedRecords.size > 0) {
      await handleBulkDeleteConfirm();
      return;
    }

    // Handle single delete
    if (!recordToDelete) return;

    const recordId = recordToDelete.id;
    const recordName = recordToDelete.name;

    setDeletingId(recordId);
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
        const errorMessage = data.error || "Failed to delete record";
        setError(errorMessage);
        toast.error("Delete Failed", {
          description: errorMessage,
        });
        return;
      }

      fetchRecords();
      toast.success("Record Deleted", {
        description: `Record for "${recordName}" has been deleted successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("Delete Failed", {
        description: errorMessage,
      });
    } finally {
      setDeletingId(null);
      setRecordToDelete(null);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      // Parse with header row to get raw data for max scores
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

      // Process the data - expect columns: student_name, student_number, email, code, and grade columns
      const records: any[] = [];

      // Read second row (index 1) as max scores for each grade column
      const maxScores: Record<string, number> = {};
      if (jsonData.length > 1) {
        const maxScoreRow = jsonData[1] as any[];
        const headerRow = jsonData[0] as any[];
        
        // Find grade start column (typically after name, number, email, code columns)
        const gradeStartColIndex = 4; // Default to column E (index 4)
        
        for (let colIndex = gradeStartColIndex; colIndex < maxScoreRow.length; colIndex++) {
          const header = headerRow[colIndex] ? String(headerRow[colIndex]).trim() : `Column_${colIndex + 1}`;
          const maxScoreValue = maxScoreRow[colIndex];
          
          // Try to parse as number
          if (maxScoreValue !== null && maxScoreValue !== undefined && maxScoreValue !== "") {
            let numValue: number;
            if (typeof maxScoreValue === "number") {
              numValue = maxScoreValue;
            } else {
              const strValue = String(maxScoreValue).trim();
              numValue = parseFloat(strValue);
            }
            
            if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
              const gradeKey = header && header !== "" ? header : `Grade_${colIndex - gradeStartColIndex + 1}`;
              maxScores[gradeKey] = numValue;
            }
          }
        }
        
      }

      // Process data rows (skip header row at index 0 and max score row at index 1)
      // Start from row 2 (index 2)
      for (let i = 2; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        
        // Skip empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === "")) {
          continue;
        }

        // Try to find columns by header names or use default positions
        const headerRow = jsonData[0] as any[];
        let nameColIndex = -1;
        let numberColIndex = -1;
        let emailColIndex = -1;
        let codeColIndex = -1;
        
        headerRow.forEach((header, index) => {
          const headerStr = String(header || "").toLowerCase().trim();
          if (headerStr.includes("name") && !headerStr.includes("number") && nameColIndex === -1) {
            nameColIndex = index;
          } else if ((headerStr.includes("student") && headerStr.includes("number")) || headerStr === "id") {
            if (numberColIndex === -1 && index < 10) {
              numberColIndex = index;
            }
          } else if (headerStr.includes("email")) {
            emailColIndex = index;
          } else if (headerStr.includes("code") || headerStr.includes("security")) {
            codeColIndex = index;
          }
        });
        
        // Use defaults if not found
        if (nameColIndex === -1) nameColIndex = 1;
        if (numberColIndex === -1) numberColIndex = 2;
        if (emailColIndex === -1) emailColIndex = 3;
        if (codeColIndex === -1) codeColIndex = -1; // Optional
        
        const studentName = row[nameColIndex] ? String(row[nameColIndex]).trim() : "";
        const studentNumber = row[numberColIndex] ? String(row[numberColIndex]).trim() : "";
        const email = emailColIndex >= 0 && row[emailColIndex] 
          ? String(row[emailColIndex]).trim() 
          : `${studentNumber.replace(/[^a-zA-Z0-9]/g, "")}@mmsu.edu.ph`;
        const code = codeColIndex >= 0 && row[codeColIndex]
          ? String(row[codeColIndex]).trim()
          : studentNumber.replace(/[^0-9]/g, "").slice(-6) || "000000";

        if (!studentName || !studentNumber) {
          continue;
        }

        // Extract grades from remaining columns (starting from index 4)
        const grades: Record<string, number> = {};
        const gradeStartColIndex = 4;
        
        for (let colIndex = gradeStartColIndex; colIndex < row.length; colIndex++) {
          const header = headerRow[colIndex] ? String(headerRow[colIndex]).trim() : `Column_${colIndex + 1}`;
          const value = row[colIndex];
          
          if (value === null || value === undefined || value === "") {
            continue;
          }
          
          let numValue: number;
          if (typeof value === "number") {
            numValue = value;
          } else {
            const strValue = String(value).trim();
            numValue = parseFloat(strValue);
          }
          
          if (!isNaN(numValue) && isFinite(numValue)) {
            const gradeKey = header && header !== "" ? header : `Grade_${colIndex - gradeStartColIndex + 1}`;
            grades[gradeKey] = numValue;
          }
        }

        if (Object.keys(grades).length > 0) {
          records.push({
            subject_id: subjectId,
            student_name: studentName,
            student_number: String(studentNumber),
            email: String(email),
            code: String(code),
            grades,
            // Include max_scores if we found any (same for all records)
            ...(Object.keys(maxScores).length > 0 ? { max_scores: maxScores } : {}),
          });
        }
      }

      if (records.length === 0) {
        throw new Error("No valid records found in the Excel file. Please check the file format.");
      }

      console.log(`Excel Upload: Parsed ${records.length} records`);

      // Clear all records if option is enabled
      if (clearAllBeforeImport) {
        try {
          const deleteResponse = await fetch(`/api/records?subject_id=${subjectId}`);
          if (deleteResponse.ok) {
            const deleteData = await deleteResponse.json();
            const existingRecords = deleteData.data || [];
            for (const existingRecord of existingRecords) {
              await fetch(`/api/records/${existingRecord.id}`, {
                method: "DELETE",
              });
            }
            toast.info("Cleared Records", {
              description: `Deleted ${existingRecords.length} existing record${existingRecords.length !== 1 ? "s" : ""}`,
            });
          }
        } catch (deleteErr) {
          console.error("Excel Upload: Error clearing records:", deleteErr);
          toast.warning("Clear Warning", {
            description: "Failed to clear some existing records. Continuing with import...",
          });
        }
      }

      // Fetch existing records to check for updates
      const existingRecordsResponse = await fetch(`/api/records?subject_id=${subjectId}`);
      const existingRecordsData = await existingRecordsResponse.json();
      const existingRecords = existingRecordsData.data || [];
      
      // Create a map of student_number to record ID for quick lookup
      const existingRecordsMap = new Map<string, string>();
      existingRecords.forEach((rec: GradeRecord) => {
        existingRecordsMap.set(rec.student_number, rec.id);
      });


      // Upload/Update records (emails will be synced after import using sync-subject-emails)
      let successCount = 0;
      let updateCount = 0;
      let createCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          const existingRecordId = existingRecordsMap.get(record.student_number);
          const isUpdate = !!existingRecordId;
          
          const url = existingRecordId ? `/api/records/${existingRecordId}` : "/api/records";
          const method = existingRecordId ? "PUT" : "POST";
          
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
          });

          if (response.status === 401) {
            window.location.replace("/login");
            return;
          }

          const responseText = await response.text();

          if (!response.ok) {
            let errorData;
            try {
              errorData = JSON.parse(responseText);
            } catch (parseError) {
              errorData = { error: responseText || "Unknown error" };
            }
            
            const errorMessage = errorData.error || "Failed to upload";
            const errorDetails = errorData.details ? JSON.stringify(errorData.details, null, 2) : "";
            const fullError = errorDetails 
              ? `${errorMessage}\nDetails: ${errorDetails}`
              : errorMessage;
            
            console.error(`Excel Upload: Error for ${record.student_name}:`, {
              status: response.status,
              statusText: response.statusText,
              error: errorMessage,
              details: errorData.details,
              fullResponse: errorData,
            });
            
            errorCount++;
            errors.push(`${record.student_name}: ${fullError}`);
          } else {
            if (isUpdate) {
              updateCount++;
            } else {
              createCount++;
            }
            successCount++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.error(`Excel Upload: Exception for ${record.student_name}:`, {
            error: errorMessage,
            stack: err instanceof Error ? err.stack : undefined,
            record: JSON.stringify(record, null, 2),
          });
          errorCount++;
          errors.push(`${record.student_name}: ${errorMessage}`);
        }
      }
      
      console.log(`Excel Upload: Upload complete. Success: ${successCount}, Errors: ${errorCount}`);

      // Sync emails after import if Moodle config is available
      if (successCount > 0 && moodleCourseId && moodleEnrolId) {
        try {
          const syncResponse = await fetch("/api/moodle/sync-subject-emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject_id: subjectId,
              courseid: moodleCourseId,
              enrolid: moodleEnrolId,
            }),
          });

          if (!syncResponse.ok) {
            console.warn("Email sync failed after import");
          }
        } catch (syncErr) {
          console.warn("Error syncing emails:", syncErr);
        }
      }

      setUploadDialogOpen(false);
      fetchRecords();
      
      // Note: Excel upload doesn't use a URL, so we don't persist anything
      
      if (successCount > 0) {
        const updateText = updateCount > 0 ? `${updateCount} updated` : "";
        const createText = createCount > 0 ? `${createCount} created` : "";
        const actionText = [updateText, createText].filter(Boolean).join(", ");
        toast.success("Upload Successful", {
          description: `Successfully processed ${successCount} record${successCount !== 1 ? "s" : ""} (${actionText})${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        throw new Error(`Failed to upload all records. Errors: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`);
      }

      if (errorCount > 0 && successCount > 0) {
        setError(`Some records failed to upload: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to process Excel file";
      setError(errorMessage);
      toast.error("Upload Failed", {
        description: errorMessage,
      });
    } finally {
      setUploading(false);
      // Reset file input
      e.target.value = "";
    }
  };


  // Handle Google Sheets import with a specific URL
  const handleGoogleSheetImportWithUrl = async (urlToUse?: string) => {
    const url = urlToUse || googleSheetUrl;
    if (!url) {
      setError("Please enter a Google Sheet URL");
      toast.error("Invalid Input", {
        description: "Please enter a Google Sheet URL",
      });
      return;
    }

    setUploading(true);
    setError(null);
    
    // Persist the URL immediately after validation (before import)
    // This ensures the URL is saved even if the import encounters issues
    if (url.trim()) {
      localStorage.setItem(`googleSheetUrl_${subjectId}`, url.trim());
      setPersistentSheetUrl(url.trim());
    }
    
    try {
      // Convert Google Sheets URL to CSV export URL
      // Format: https://docs.google.com/spreadsheets/d/{ID}/edit#gid=0
      // CSV: https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid=0
      const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (!match) {
        throw new Error("Invalid Google Sheets URL");
      }

      const sheetId = match[1];
        // Extract GID from URL if present, otherwise use "0"
        const urlGidMatch = url.match(/[#&]gid=(\d+)/);
      const gid = urlGidMatch ? urlGidMatch[1] : "0";
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error("Failed to fetch Google Sheet. Make sure the sheet is publicly accessible or shared with view permissions.");
      }

      const csvText = await response.text();
      const workbook = XLSX.read(csvText, { type: "string" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Parse with header row, but also get raw data to handle positional columns
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
      
      // Process records - handle both header-based and positional column formats
      const records: any[] = [];
      
      // Try to detect column indices by looking at first few rows
      let nameColIndex = -1;
      let numberColIndex = -1;
      let emailColIndex = -1;
      let codeColIndex = -1;
      let gradeStartColIndex = -1;
      
      // First, try to find columns by header names (if headers exist)
      // Only check the first row (header row) for column names
      if (jsonData.length > 0) {
        const headerRow = jsonData[0] as any[];
        headerRow.forEach((header, index) => {
          const headerStr = String(header || "").toLowerCase().trim();
          // Skip empty headers
          if (!headerStr) return;
          
          // Look for name column - must contain "name" but not "number"
          if (headerStr.includes("name") && !headerStr.includes("number") && nameColIndex === -1) {
            nameColIndex = index;
          } 
          // Look for student number column - must contain "student" and "number", or just "id" (but not as part of another word)
          else if (
            (headerStr.includes("student") && headerStr.includes("number")) ||
            (headerStr === "id" || headerStr === "student id" || headerStr === "student_id")
          ) {
            // Only set if not already found and it's a reasonable position (not too far right, which would be a grade column)
            if (numberColIndex === -1 && index < 10) {
              numberColIndex = index;
            }
          } 
          // Look for email column
          else if (headerStr.includes("email") || headerStr.includes("e-mail")) {
            emailColIndex = index;
          } 
          // Look for code column
          else if (headerStr.includes("code") || headerStr.includes("security")) {
            codeColIndex = index;
          }
        });
      }
      
      // If not found by headers, use common positions:
      // Column A (0): Number/Index (skip)
      // Column B (1): Student Name
      // Column C (2): Student Number
      // Column D (3): Course/Program (skip)
      // Column E (4)+: Grades
      if (nameColIndex === -1) {
        nameColIndex = 1; // Column B
      }
      if (numberColIndex === -1) {
        numberColIndex = 2; // Column C
      }
      if (gradeStartColIndex === -1) {
        gradeStartColIndex = 4; // Column E
      }
      
      // Validate that numberColIndex is reasonable (not a grade column)
      // Grade columns typically start at index 4+, so if numberColIndex is >= 4, it's probably wrong
      if (numberColIndex >= gradeStartColIndex) {
        numberColIndex = 2;
      }
      
      // Read second row (index 1) as max scores for each grade column
      const maxScores: Record<string, number> = {};
      if (jsonData.length > 1) {
        const maxScoreRow = jsonData[1] as any[];
        const headerRow = jsonData[0] as any[];
        
        for (let colIndex = gradeStartColIndex; colIndex < maxScoreRow.length; colIndex++) {
          const header = headerRow[colIndex] ? String(headerRow[colIndex]).trim() : `Column_${colIndex + 1}`;
          const maxScoreValue = maxScoreRow[colIndex];
          
          // Try to parse as number
          if (maxScoreValue !== null && maxScoreValue !== undefined && maxScoreValue !== "") {
            let numValue: number;
            if (typeof maxScoreValue === "number") {
              numValue = maxScoreValue;
            } else {
              const strValue = String(maxScoreValue).trim();
              numValue = parseFloat(strValue);
            }
            
            if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
              const gradeKey = header && header !== "" ? header : `Grade_${colIndex - gradeStartColIndex + 1}`;
              maxScores[gradeKey] = numValue;
            }
          }
        }
        
      }
      
      // Process data rows (skip header row, max score row, and any empty rows)
      // Start from row 2 (index 2) since row 0 is header and row 1 is max scores
      for (let i = 2; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        
        // Skip empty rows
        if (!row || row.length === 0 || row.every(cell => !cell || String(cell).trim() === "")) {
          continue;
        }
        
        // Skip rows that look like header rows (all text, no numbers)
        // Note: We already skip row 1 (max scores row) by starting loop at i=2
        const hasNumbers = row.some(cell => {
          const val = String(cell || "");
          return !isNaN(Number(val)) && val.trim() !== "";
        });
        if (!hasNumbers) {
          continue; // Skip rows that look like header rows
        }
        
        const studentName = row[nameColIndex] ? String(row[nameColIndex]).trim() : "";
        const studentNumberRaw = row[numberColIndex];
        const studentNumber = studentNumberRaw ? String(studentNumberRaw).trim() : "";
        
        // Skip if essential fields are missing
        if (!studentName || !studentNumber) {
          continue;
        }
        
        // Generate email from student number if not found
        const email = emailColIndex >= 0 && row[emailColIndex] 
          ? String(row[emailColIndex]).trim() 
          : `${studentNumber.replace(/[^a-zA-Z0-9]/g, "")}@mmsu.edu.ph`;
        
        // Generate code from student number if not found (last 6 digits)
        const code = codeColIndex >= 0 && row[codeColIndex]
          ? String(row[codeColIndex]).trim()
          : studentNumber.replace(/[^0-9]/g, "").slice(-6) || "000000";
        
        // Extract grades from remaining columns
        const grades: Record<string, number> = {};
        const headerRow = jsonData[0] as any[];
        
        for (let colIndex = gradeStartColIndex; colIndex < row.length; colIndex++) {
          const header = headerRow[colIndex] ? String(headerRow[colIndex]).trim() : `Column_${colIndex + 1}`;
          const value = row[colIndex];
          
          // Skip empty cells and non-numeric values
          if (value === null || value === undefined || value === "") {
            continue;
          }
          
          // Convert to number more robustly - handle strings with whitespace
          let numValue: number;
          if (typeof value === "number") {
            numValue = value;
          } else {
            const strValue = String(value).trim();
            numValue = parseFloat(strValue);
          }
          
          if (!isNaN(numValue) && isFinite(numValue)) {
            // Use header as grade key, or generate one if header is empty
            const gradeKey = header && header !== "" ? header : `Grade_${colIndex - gradeStartColIndex + 1}`;
            grades[gradeKey] = numValue;
          }
        }
        
        // Only add record if it has at least one grade
        if (Object.keys(grades).length > 0) {
          const record = {
            subject_id: subjectId,
            student_name: studentName,
            student_number: studentNumber,
            email: email,
            code: code,
            grades,
            // Include max_scores if we found any (same for all records)
            ...(Object.keys(maxScores).length > 0 ? { max_scores: maxScores } : {}),
          };
          
          records.push(record);
        }
      }

      if (records.length === 0) {
        throw new Error("No valid records found in the Google Sheet. Please check the sheet format.");
      }

      console.log(`Google Sheets Import: Parsed ${records.length} records`);

      // Clear all records if option is enabled
      if (clearAllBeforeImport) {
        try {
          const deleteResponse = await fetch(`/api/records?subject_id=${subjectId}`);
          if (deleteResponse.ok) {
            const deleteData = await deleteResponse.json();
            const existingRecords = deleteData.data || [];
            for (const existingRecord of existingRecords) {
              await fetch(`/api/records/${existingRecord.id}`, {
                method: "DELETE",
              });
            }
            toast.info("Cleared Records", {
              description: `Deleted ${existingRecords.length} existing record${existingRecords.length !== 1 ? "s" : ""}`,
            });
          }
        } catch (deleteErr) {
          console.error("Google Sheets Import: Error clearing records:", deleteErr);
          toast.warning("Clear Warning", {
            description: "Failed to clear some existing records. Continuing with import...",
          });
        }
      }

      // Fetch existing records to check for updates
      const existingRecordsResponse = await fetch(`/api/records?subject_id=${subjectId}`);
      const existingRecordsData = await existingRecordsResponse.json();
      const existingRecords = existingRecordsData.data || [];
      
      // Create a map of student_number to record ID for quick lookup
      const existingRecordsMap = new Map<string, string>();
      existingRecords.forEach((rec: GradeRecord) => {
        existingRecordsMap.set(rec.student_number, rec.id);
      });


      // Upload/Update records (emails will be synced after import using sync-subject-emails)
      let successCount = 0;
      let updateCount = 0;
      let createCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        try {
          const existingRecordId = existingRecordsMap.get(record.student_number);
          const isUpdate = !!existingRecordId;
          
          const url = existingRecordId ? `/api/records/${existingRecordId}` : "/api/records";
          const method = existingRecordId ? "PUT" : "POST";
          
          const response = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(record),
          });

          if (response.status === 401) {
            window.location.replace("/login");
            return;
          }

          const responseText = await response.text();

          if (!response.ok) {
            let errorData;
            try {
              errorData = JSON.parse(responseText);
            } catch (parseError) {
              errorData = { error: responseText || "Unknown error" };
            }
            
            const errorMessage = errorData.error || "Failed to upload";
            const errorDetails = errorData.details ? JSON.stringify(errorData.details, null, 2) : "";
            const fullError = errorDetails 
              ? `${errorMessage}\nDetails: ${errorDetails}`
              : errorMessage;
            
            console.error(`Google Sheets Import: Error for ${record.student_name}:`, {
              status: response.status,
              statusText: response.statusText,
              error: errorMessage,
              details: errorData.details,
              fullResponse: errorData,
            });
            
            errorCount++;
            errors.push(`${record.student_name}: ${fullError}`);
          } else {
            if (isUpdate) {
              updateCount++;
            } else {
              createCount++;
            }
            successCount++;
          }
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          console.error(`Google Sheets Import: Exception for ${record.student_name}:`, {
            error: errorMessage,
            stack: err instanceof Error ? err.stack : undefined,
            record: JSON.stringify(record, null, 2),
          });
          errorCount++;
          errors.push(`${record.student_name}: ${errorMessage}`);
        }
      }
      
      console.log(`Google Sheets Import: Upload complete. Success: ${successCount}, Errors: ${errorCount}`);

      // Sync emails after import if Moodle config is available
      if (successCount > 0 && moodleCourseId && moodleEnrolId) {
        try {
          const syncResponse = await fetch("/api/moodle/sync-subject-emails", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              subject_id: subjectId,
              courseid: moodleCourseId,
              enrolid: moodleEnrolId,
            }),
          });

          if (!syncResponse.ok) {
            console.warn("Email sync failed after import");
          }
        } catch (syncErr) {
          console.warn("Error syncing emails:", syncErr);
        }
      }

      setUploadDialogOpen(false);
      setGoogleSheetUrl("");
      fetchRecords();

      if (successCount > 0) {
        const updateText = updateCount > 0 ? `${updateCount} updated` : "";
        const createText = createCount > 0 ? `${createCount} created` : "";
        const actionText = [updateText, createText].filter(Boolean).join(", ");
        toast.success("Import Successful", {
          description: `Successfully processed ${successCount} record${successCount !== 1 ? "s" : ""} (${actionText})${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        throw new Error(`Failed to import all records. Errors: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`);
      }

      if (errorCount > 0 && successCount > 0) {
        setError(`Some records failed to import: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to import from Google Sheets";
      setError(errorMessage);
      toast.error("Import Failed", {
        description: errorMessage,
      });
    } finally {
      setUploading(false);
    }
  };

  // Handle Google Sheets import (wrapper for dialog)
  const handleGoogleSheetImport = async () => {
    await handleGoogleSheetImportWithUrl();
  };

  // Handle updating from persistent Google Sheets URL
  const handleUpdateFromPersistentSheet = async () => {
    if (!persistentSheetUrl) {
      // If no persistent URL, open the upload dialog so user can set one
      toast.info("No Google Sheet URL set", {
        description: "Opening upload dialog to set a Google Sheets URL",
      });
      setUploadDialogOpen(true);
      return;
    }
    // Use the persistent URL for import
    setGoogleSheetUrl(persistentSheetUrl);
    await handleGoogleSheetImportWithUrl(persistentSheetUrl);
  };

  // Handle record selection
  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const clearSelection = () => {
    setSelectedRecords(new Set());
  };

  const handleRegenerateCode = async (recordId: string) => {
    setRegeneratingCodeId(recordId);
    try {
      const response = await fetch(`/api/records/${recordId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to regenerate code");
      }

      const { data } = await response.json();
      
      // Update the record in local state
      setRecords((prev) =>
        prev.map((record) =>
          record.id === recordId ? { ...record, code: data.code } : record
        )
      );

      toast.success("Access code regenerated", {
        description: `New code: ${data.code}`,
      });
    } catch (error) {
      console.error("Regenerate code error:", error);
      toast.error("Failed to regenerate code", {
        description: error instanceof Error ? error.message : "An error occurred",
      });
    } finally {
      setRegeneratingCodeId(null);
    }
  };

  const handleCopyCode = async (recordId: string, code: string | null | undefined) => {
    if (!code) {
      toast.warning("No access code", {
        description: "This record does not have an access code yet.",
      });
      return;
    }

    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error("Clipboard API is not available");
      }

      await navigator.clipboard.writeText(code);

      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }

      setCopiedRecordId(recordId);
      copyTimeoutRef.current = setTimeout(() => setCopiedRecordId(null), 2000);

      toast.success("Code copied", {
        description: code,
      });
    } catch (err) {
      console.error("Copy Code: Failed to copy access code", err);
      toast.error("Copy failed", {
        description: "Unable to copy the access code. Please try again.",
      });
    }
  };

  // Handle bulk delete
  const handleBulkDeleteClick = () => {
    if (selectedRecords.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedRecords.size === 0) return;

    const idsToDelete = Array.from(selectedRecords);
    setDeletingId("bulk");
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const id of idsToDelete) {
        try {
          const response = await fetch(`/api/records/${id}`, {
            method: "DELETE",
          });

          if (response.status === 401) {
            window.location.replace("/login");
            return;
          }

          if (!response.ok) {
            const errorData = await response.json();
            errorCount++;
            errors.push(errorData.error || "Failed to delete");
          } else {
            successCount++;
          }
        } catch (err) {
          errorCount++;
          errors.push(err instanceof Error ? err.message : "Unknown error");
        }
      }

      clearSelection();
      fetchRecords();

      if (successCount > 0) {
        toast.success("Delete Successful", {
          description: `Successfully deleted ${successCount} record${successCount !== 1 ? "s" : ""}${errorCount > 0 ? `. ${errorCount} failed.` : ""}`,
        });
      }

      if (errorCount > 0 && successCount === 0) {
        toast.error("Delete Failed", {
          description: `Failed to delete all records. ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`,
        });
      }
    } catch (err) {
      toast.error("Delete Failed", {
        description: err instanceof Error ? err.message : "An error occurred",
      });
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
    }
  };

  // Handle column sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Get sort icon for a column
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-2 h-4 w-4" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4" />
    );
  };

  // Filter and sort records
  const filteredAndSortedRecords = records
    .filter((record) => {
      if (!filterText.trim()) return true;
      const searchLower = filterText.toLowerCase();
      return (
        record.student_name.toLowerCase().includes(searchLower) ||
        record.student_number.toLowerCase().includes(searchLower) ||
        record.email.toLowerCase().includes(searchLower) ||
        (record.code ?? "").toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (!sortField) return 0;

      let aValue: any;
      let bValue: any;

      if (sortField === "student_name" || sortField === "student_number" || sortField === "email" || sortField === "code") {
        aValue = a[sortField as keyof GradeRecord];
        bValue = b[sortField as keyof GradeRecord];
      } else {
        // It's a grade key
        aValue = a.grades?.[sortField] ?? 0;
        bValue = b.grades?.[sortField] ?? 0;
      }

      // Handle string comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        return sortDirection === "asc"
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Handle number comparison
      const aNum = typeof aValue === "number" ? aValue : parseFloat(String(aValue)) || 0;
      const bNum = typeof bValue === "number" ? bValue : parseFloat(String(bValue)) || 0;
      return sortDirection === "asc" ? aNum - bNum : bNum - aNum;
    });

  // Calculate selection state based on filtered records
  const isAllSelected = filteredAndSortedRecords.length > 0 && selectedRecords.size === filteredAndSortedRecords.length;
  const isIndeterminate = selectedRecords.size > 0 && selectedRecords.size < filteredAndSortedRecords.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      setSelectedRecords(new Set());
    } else {
      // Select all visible records
      setSelectedRecords(new Set(filteredAndSortedRecords.map((r) => r.id)));
    }
  };

  // Initialize default grading system structure
  const getDefaultGradingSystem = (): GradingSystem => {
    return {
      categories: [
        {
          id: "major_exams",
          name: "Major Exams",
          weight: 30,
          components: [
            {
              id: "midterm",
              name: "Midterm Exam",
              weight: 15,
              gradeKeys: [],
            },
            {
              id: "final",
              name: "Final Exam",
              weight: 15,
              gradeKeys: [],
            },
          ],
        },
        {
          id: "major_outputs",
          name: "Major Outputs",
          weight: 70,
          components: [
            {
              id: "long_exam",
              name: "Long Exam",
              weight: 50,
              gradeKeys: [],
            },
            {
              id: "problem_set",
              name: "Problem Set",
              weight: 10,
              gradeKeys: [],
            },
            {
              id: "assignments",
              name: "Assignment/Seatwork/Quizzes",
              weight: 5,
              gradeKeys: [],
            },
            {
              id: "attendance",
              name: "Attendance",
              weight: 5,
              gradeKeys: [],
            },
          ],
        },
      ],
      passing_grade: 50, // Default passing grade
    };
  };

  // Handle opening grading system configuration dialog
  const handleOpenGradingSystemDialog = () => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories) || gradingSystem.categories.length === 0) {
      // Initialize with default structure if not properly configured
      setGradingSystem(getDefaultGradingSystem());
    }
    setGradingSystemDialogOpen(true);
  };

  // Handle saving grading system
  const handleSaveGradingSystem = async () => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories) || gradingSystem.categories.length === 0) {
      toast.error("Invalid grading system", {
        description: "Grading system is not properly configured.",
      });
      return;
    }

    // Validate weights sum to 100
    const totalCategoryWeight = gradingSystem.categories.reduce((sum, cat) => sum + (cat.weight || 0), 0);
    if (totalCategoryWeight !== 100) {
      toast.error("Invalid weights", {
        description: `Category weights must sum to 100%. Current total: ${totalCategoryWeight}%`,
      });
      return;
    }

    // Validate component weights within each category
    for (const category of gradingSystem.categories) {
      if (!category.components || !Array.isArray(category.components)) continue;
      const totalComponentWeight = category.components.reduce((sum, comp) => sum + (comp.weight || 0), 0);
      if (totalComponentWeight !== category.weight) {
        toast.error("Invalid component weights", {
          description: `Components in "${category.name}" must sum to ${category.weight}%. Current total: ${totalComponentWeight}%`,
        });
        return;
      }
    }

    setSavingGradingSystem(true);
    try {
      const response = await fetch(`/api/subjects/${subjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grading_system: gradingSystem,
        }),
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save grading system");
      }

      setGradingSystemDialogOpen(false);
      fetchSubject(); // Refresh to get updated subject
      toast.success("Grading system saved", {
        description: "Grading system configuration has been saved successfully.",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save grading system";
      toast.error("Save failed", {
        description: errorMessage,
      });
    } finally {
      setSavingGradingSystem(false);
    }
  };

  // Handle computing grades
  const handleComputeGrades = async () => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories) || gradingSystem.categories.length === 0) {
      toast.error("Grading system not configured", {
        description: "Please configure the grading system first.",
      });
      setGradingSystemDialogOpen(true);
      return;
    }

    setComputingGrades(true);
    try {
      const response = await fetch(`/api/subjects/${subjectId}/compute-grades`, {
        method: "POST",
      });

      if (response.status === 401) {
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to compute grades");
      }

      if (data.success && data.data) {
        setComputedGrades(data.data.computedGrades);
        setComputedGradesDialogOpen(true);
        toast.success("Grades computed", {
          description: `Computed grades for ${data.data.computedGrades.length} student(s).`,
        });
        // Refresh records to show updated computed grades
        fetchRecords();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to compute grades";
      toast.error("Compute failed", {
        description: errorMessage,
      });
    } finally {
      setComputingGrades(false);
    }
  };

  // Get which components a grade key belongs to
  const getGradeKeyComponents = (gradeKey: string): string[] => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories)) return [];
    const componentIds: string[] = [];
    gradingSystem.categories.forEach((category) => {
      if (category && category.components && Array.isArray(category.components)) {
        category.components.forEach((component) => {
          if (component && component.gradeKeys && Array.isArray(component.gradeKeys) && component.gradeKeys.includes(gradeKey)) {
            componentIds.push(component.id);
          }
        });
      }
    });
    return componentIds;
  };

  // Assign a grade key to a component (1:1 mapping - removes from all other components first)
  const assignGradeKeyToComponent = (gradeKey: string, componentId: string) => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories)) return;

    const updatedSystem: GradingSystem = {
      ...gradingSystem,
      categories: gradingSystem.categories.map((category) => ({
        ...category,
        components: (category.components || []).map((component) => {
          if (component.id === componentId) {
            // Add the grade key to this component
            const gradeKeys = (component.gradeKeys || []).includes(gradeKey)
              ? component.gradeKeys || [] // Already assigned, keep it
              : [...(component.gradeKeys || []), gradeKey]; // Add it
            return { ...component, gradeKeys };
          } else {
            // Remove the grade key from all other components (1:1 mapping)
            const gradeKeys = (component.gradeKeys || []).filter((k) => k !== gradeKey);
            return { ...component, gradeKeys };
          }
        }),
      })),
    };

    setGradingSystem(updatedSystem);
  };

  // Add a new component to a category
  const addComponentToCategory = (categoryId: string) => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories)) return;

    const category = gradingSystem.categories.find((cat) => cat.id === categoryId);
    if (!category) return;

    const newComponent: GradingComponent = {
      id: `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: "New Component",
      weight: 0,
      gradeKeys: [],
    };

    const updatedSystem: GradingSystem = {
      ...gradingSystem,
      categories: gradingSystem.categories.map((cat) =>
        cat.id === categoryId
          ? { ...cat, components: [...(cat.components || []), newComponent] }
          : cat
      ),
    };

    setGradingSystem(updatedSystem);
  };

  // Remove a component from a category
  const removeComponentFromCategory = (categoryId: string, componentId: string) => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories)) return;

    const updatedSystem: GradingSystem = {
      ...gradingSystem,
      categories: gradingSystem.categories.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              components: (cat.components || []).filter((comp) => comp.id !== componentId),
            }
          : cat
      ),
    };

    setGradingSystem(updatedSystem);
  };

  // Update component name
  const updateComponentName = (categoryId: string, componentId: string, newName: string) => {
    if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories)) return;

    const updatedSystem: GradingSystem = {
      ...gradingSystem,
      categories: gradingSystem.categories.map((cat) =>
        cat.id === categoryId
          ? {
              ...cat,
              components: (cat.components || []).map((comp) =>
                comp.id === componentId ? { ...comp, name: newName } : comp
              ),
            }
          : cat
      ),
    };

    setGradingSystem(updatedSystem);
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
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.push("/teacher/dashboard/subjects")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{subject?.name || "Subject"}</h1>
              <p className="text-muted-foreground mt-1">Manage grade records</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="records" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Records
            </TabsTrigger>
            <TabsTrigger value="grading" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Grading
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="records" className="space-y-6">
            {/* Persistent Google Sheets Link */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Google Sheets Link</CardTitle>
                <CardDescription>
                  Set a persistent Google Sheets URL to quickly update grades from the same sheet
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        value={persistentSheetUrl}
                        onChange={(e) => {
                          setPersistentSheetUrl(e.target.value);
                          // Save to localStorage on change
                          if (e.target.value.trim()) {
                            localStorage.setItem(`googleSheetUrl_${subjectId}`, e.target.value.trim());
                          } else {
                            localStorage.removeItem(`googleSheetUrl_${subjectId}`);
                          }
                        }}
                        disabled={uploading}
                      />
                    </div>
                    <Button
                      onClick={handleUpdateFromPersistentSheet}
                      disabled={uploading || submitting || deletingId !== null}
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating...
                        </>
                      ) : (
                        <>
                          <FileSpreadsheet className="mr-2 h-4 w-4" />
                          Update from Sheet
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="clear-all-before-import"
                      checked={clearAllBeforeImport}
                      onCheckedChange={(checked) => setClearAllBeforeImport(checked === true)}
                      disabled={uploading}
                    />
                    <Label
                      htmlFor="clear-all-before-import"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Clear all existing records before importing
                    </Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Grade Records</CardTitle>
                    <CardDescription>
                      {filteredAndSortedRecords.length} of {records.length} record{records.length !== 1 ? "s" : ""} shown
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => handleOpenDialog()}
                      disabled={submitting || deletingId !== null || uploading}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Record
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setUploadDialogOpen(true)}
                      disabled={submitting || deletingId !== null || uploading}
                    >
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Grades
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, number, or email..."
                      value={filterText}
                      onChange={(e) => setFilterText(e.target.value)}
                      className="pl-9 pr-9"
                    />
                    {filterText && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                        onClick={() => setFilterText("")}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {selectedRecords.size > 0 && (
                  <div className="mb-4 flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        {selectedRecords.size} record{selectedRecords.size !== 1 ? "s" : ""} selected
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelection}
                        className="h-7"
                      >
                        Clear selection
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => handleSendEmailsClick(true)}
                        disabled={sendingEmails || submitting || uploading || syncingEmails}
                      >
                        {sendingEmails ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Emails to Selected
                          </>
                        )}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDeleteClick}
                        disabled={deletingId === "bulk" || submitting || uploading}
                      >
                        {deletingId === "bulk" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting...
                          </>
                        ) : (
                          <>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <div 
                  ref={tableScrollRef}
                  className="overflow-x-auto relative"
                  onScroll={() => {
                    if (tableScrollRef.current) {
                      const { scrollLeft, scrollWidth, clientWidth } = tableScrollRef.current;
                      // Hide hint when scrolled to the right
                      setShowScrollHint(scrollLeft < scrollWidth - clientWidth - 10);
                    }
                  }}
                >
                  {/* Gradient fade effect to indicate scrollable content */}
                  {showScrollHint && (
                    <div className="absolute right-0 top-0 bottom-0 w-24 pointer-events-none z-20 bg-gradient-to-l from-background via-background/80 to-transparent" />
                  )}
                  {/* Scroll hint indicator */}
                  {showScrollHint && (
                    <div className="absolute right-[140px] top-1/2 -translate-y-1/2 z-20 pointer-events-none animate-pulse">
                      <div className="flex items-center gap-1 text-muted-foreground text-xs bg-background/90 backdrop-blur-sm px-2 py-1 rounded-full border border-border/50 shadow-sm">
                        <span>← Scroll</span>
                        <div className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                      </div>
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12" rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          <div className="flex items-center">
                            <Checkbox
                              checked={isAllSelected}
                              indeterminate={isIndeterminate}
                              onCheckedChange={toggleSelectAll}
                              disabled={filteredAndSortedRecords.length === 0}
                            />
                          </div>
                        </TableHead>
                        <TableHead rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 hover:bg-accent font-medium"
                            onClick={() => handleSort("student_name")}
                          >
                            Student Name
                            {getSortIcon("student_name")}
                          </Button>
                        </TableHead>
                        <TableHead rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 hover:bg-accent font-medium"
                            onClick={() => handleSort("student_number")}
                          >
                            Student Number
                            {getSortIcon("student_number")}
                          </Button>
                        </TableHead>
                        <TableHead rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 hover:bg-accent font-medium"
                            onClick={() => handleSort("email")}
                          >
                            Email
                            {getSortIcon("email")}
                          </Button>
                        </TableHead>
                        <TableHead rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-3 h-8 hover:bg-accent font-medium"
                            onClick={() => handleSort("code")}
                          >
                            Access Code
                            {getSortIcon("code")}
                          </Button>
                        </TableHead>
                        {gradeKeys.map((key) => (
                          <TableHead key={key} className="text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 hover:bg-accent font-medium"
                              onClick={() => handleSort(key)}
                            >
                              {key}
                              {getSortIcon(key)}
                            </Button>
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold" rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          Final Grade
                        </TableHead>
                        <TableHead className="text-right sticky right-0 z-30 bg-background/95 backdrop-blur-sm min-w-[120px] border-l-2 border-border/50 shadow-[inset_4px_0_8px_-4px_rgba(0,0,0,0.1),_-2px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[inset_4px_0_8px_-4px_rgba(0,0,0,0.3),_-2px_0_8px_-2px_rgba(0,0,0,0.2)]" rowSpan={records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 ? 2 : 1}>
                          <div className="flex items-center justify-end gap-1">
                            <span>Actions</span>
                            <div className="h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary/40" />
                            </div>
                          </div>
                        </TableHead>
                      </TableRow>
                      {records.length > 0 && records[0].max_scores && Object.keys(records[0].max_scores).length > 0 && (
                        <TableRow>
                          {/* Empty cells for columns that span 2 rows (Checkbox, Name, Number, Email, Code) */}
                          {/* These are automatically skipped due to rowSpan, but we need to account for them */}
                          {/* Then add max score cells for grade columns */}
                          {gradeKeys.map((key) => (
                            <TableHead key={key} className="text-center text-xs text-muted-foreground font-normal">
                              / {records[0].max_scores![key] ?? "-"}
                            </TableHead>
                          ))}
                          {/* Note: Actions column is handled by rowSpan, so no cell needed here */}
                        </TableRow>
                      )}
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedRecords.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7 + gradeKeys.length + 1}
                            className="text-center text-muted-foreground"
                          >
                            {filterText ? "No records match your search." : "No records found. Add your first record or upload a file."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAndSortedRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedRecords.has(record.id)}
                                onCheckedChange={() => toggleRecordSelection(record.id)}
                                disabled={deletingId === record.id || submitting || uploading}
                              />
                            </TableCell>
                            <TableCell>{record.student_name}</TableCell>
                            <TableCell>{record.student_number}</TableCell>
                            <TableCell>
                              {editingEmailId === record.id ? (
                                <div className="flex items-center gap-1 min-w-[200px]">
                                  <Input
                                    type="email"
                                    value={editingEmailValue}
                                    onChange={(e) => setEditingEmailValue(e.target.value)}
                                    onBlur={() => handleEmailBlur(record.id)}
                                    onKeyDown={(e) => handleEmailKeyDown(e, record.id)}
                                    className="h-8 text-sm"
                                    disabled={savingEmailId === record.id}
                                    placeholder="student@example.com"
                                    autoFocus
                                    onFocus={(e) => e.target.select()}
                                  />
                                  {savingEmailId === record.id && (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground flex-shrink-0" />
                                  )}
                                </div>
                              ) : (
                                <div
                                  className="cursor-pointer hover:bg-muted/50 px-2 py-1 rounded -mx-2 -my-1 transition-colors min-h-[32px] flex items-center"
                                  onClick={() => handleEmailEditStart(record)}
                                  title="Click to edit email"
                                >
                                  {record.email || <span className="text-muted-foreground italic">Click to add email</span>}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm">
                                  {record.code && record.code.trim() ? record.code : "-"}
                                </span>
                                <div className="flex items-center gap-1">
                                  {record.code && record.code.trim() && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleCopyCode(record.id, record.code)}
                                        disabled={deletingId === record.id || submitting || uploading || regeneratingCodeId === record.id}
                                        aria-label="Copy access code"
                                      >
                                        {copiedRecordId === record.id ? (
                                          <Check className="h-4 w-4 text-primary" />
                                        ) : (
                                          <Copy className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleRegenerateCode(record.id)}
                                        disabled={deletingId === record.id || submitting || uploading || regeneratingCodeId === record.id}
                                        aria-label="Regenerate access code"
                                        title="Regenerate access code"
                                      >
                                        {regeneratingCodeId === record.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        ) : (
                                          <RefreshCw className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            {gradeKeys.map((key) => (
                              <TableCell key={key} className="text-center">
                                {record.grades?.[key] ?? "-"}
                              </TableCell>
                            ))}
                            <TableCell className="text-center font-semibold">
                              {record.computed_grade?.finalGrade !== undefined ? (
                                <span
                                  className={`px-2 py-1 rounded ${
                                    record.computed_grade.finalGrade >= (gradingSystem?.passing_grade || 50)
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                  }`}
                                >
                                  {record.computed_grade.finalGrade.toFixed(2)}%
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right sticky right-0 z-30 bg-background/95 backdrop-blur-sm min-w-[120px] border-l-2 border-border/50 shadow-[inset_4px_0_8px_-4px_rgba(0,0,0,0.1),_-2px_0_8px_-2px_rgba(0,0,0,0.05)] dark:shadow-[inset_4px_0_8px_-4px_rgba(0,0,0,0.3),_-2px_0_8px_-2px_rgba(0,0,0,0.2)]">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDialog(record)}
                                  disabled={deletingId === record.id || submitting || uploading || regeneratingCodeId === record.id}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(record.id)}
                                  disabled={deletingId === record.id || submitting || uploading || regeneratingCodeId === record.id}
                                >
                                  {deletingId === record.id ? (
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
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="grading" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Grading System</CardTitle>
                    <CardDescription>Configure and compute final grades</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={handleOpenGradingSystemDialog}
                      disabled={submitting || deletingId !== null || uploading || syncingEmails}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Grading System
                    </Button>
                    <Button
                      variant="default"
                      onClick={handleComputeGrades}
                      disabled={computingGrades || records.length === 0 || submitting || deletingId !== null || uploading || syncingEmails || !gradingSystem}
                    >
                      {computingGrades ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Computing...
                        </>
                      ) : (
                        <>
                          <Calculator className="mr-2 h-4 w-4" />
                          Compute Grades
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {gradingSystem ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Grading system is configured. You can compute final grades for all students.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Alert>
                    <AlertDescription>
                      No grading system configured. Click "Configure Grading System" to set up the grading structure for this subject.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Settings & Communication</CardTitle>
                    <CardDescription>Configure Moodle integration and send access codes</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setMoodleSyncDialogOpen(true)}
                      disabled={submitting || deletingId !== null || uploading || syncingEmails}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configure Moodle
                    </Button>
                    <Button
                      variant="default"
                      onClick={() => handleSendEmailsClick(false)}
                      disabled={sendingEmails || records.length === 0 || submitting || deletingId !== null || uploading || syncingEmails}
                    >
                      {sendingEmails ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-2 h-4 w-4" />
                          Send Access Codes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Sync</Label>
                  <Button 
                    variant="outline" 
                    onClick={handleSyncSubjectEmails}
                    disabled={submitting || deletingId !== null || uploading || syncingEmails}
                    className="w-full justify-start"
                  >
                    {syncingEmails ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Syncing...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Sync Emails for This Subject
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Sync student emails from Moodle for this subject
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

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
                    disabled={submitting}
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
                    disabled={submitting}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="email">Email</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleFetchEmail}
                      disabled={submitting || fetchingEmail || !formData.student_number.trim()}
                      className="h-7 text-xs"
                    >
                      {fetchingEmail ? (
                        <>
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          Fetching...
                        </>
                      ) : (
                        <>
                          <Mail className="mr-1 h-3 w-3" />
                          Fetch from Moodle
                        </>
                      )}
                    </Button>
                  </div>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={submitting}
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
                    disabled={submitting}
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
                    disabled={submitting}
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
                        disabled={submitting}
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
                      {editingRecord ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingRecord ? "Update" : "Create"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Upload Dialog */}
        <Dialog 
          open={uploadDialogOpen} 
          onOpenChange={(open) => {
            setUploadDialogOpen(open);
            if (open) {
              // Pre-populate with persistent URL when opening
              setGoogleSheetUrl(persistentSheetUrl);
            } else {
              // Reset when dialog closes
              setGoogleSheetUrl("");
              setError(null);
            }
          }}
        >
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
                  disabled={uploading}
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
                  disabled={uploading}
                />
                <p className="text-sm text-muted-foreground">
                  The URL will be saved for quick updates. You can also set it in the persistent link field above.
                </p>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="clear-all-dialog"
                    checked={clearAllBeforeImport}
                    onCheckedChange={(checked) => setClearAllBeforeImport(checked === true)}
                    disabled={uploading}
                  />
                  <Label
                    htmlFor="clear-all-dialog"
                    className="text-sm font-normal cursor-pointer"
                  >
                    Clear all existing records before importing
                  </Label>
                </div>
                <Button
                  type="button"
                  onClick={handleGoogleSheetImport}
                  className="w-full"
                  disabled={!googleSheetUrl || uploading}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Import from Google Sheets
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              // Clear selection and recordToDelete when dialog closes
              clearSelection();
              setRecordToDelete(null);
            }
          }}
          onConfirm={handleDeleteConfirm}
          title={selectedRecords.size > 0 ? "Delete Selected Records" : "Delete Record"}
          description={
            selectedRecords.size > 0
              ? `Are you sure you want to delete ${selectedRecords.size} selected record${selectedRecords.size !== 1 ? "s" : ""}? This action cannot be undone.`
              : recordToDelete
              ? `Are you sure you want to delete the record for "${recordToDelete.name}"? This action cannot be undone.`
              : ""
          }
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />

        {/* Moodle Configuration Dialog */}
        <Dialog open={moodleSyncDialogOpen} onOpenChange={setMoodleSyncDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Configure Moodle Settings</DialogTitle>
              <DialogDescription>
                Set Moodle Course ID and Enrol ID for syncing emails for students in this subject.
                These settings are saved per subject.
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
                    // Save to localStorage
                    if (e.target.value.trim()) {
                      localStorage.setItem(`moodleCourseId_${subjectId}`, e.target.value.trim());
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
                    // Save to localStorage
                    if (e.target.value.trim()) {
                      localStorage.setItem(`moodleEnrolId_${subjectId}`, e.target.value.trim());
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
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Send Email Confirmation Dialog */}
        <Dialog open={sendEmailDialogOpen} onOpenChange={(open) => {
          setSendEmailDialogOpen(open);
          if (!open) {
            setPendingEmailAction(null);
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Access Code Emails</DialogTitle>
              <DialogDescription>
                {(() => {
                  if (!pendingEmailAction) return "";
                  
                  const { selectedOnly } = pendingEmailAction;
                  let recordsToSend: GradeRecord[] = [];
                  
                  if (selectedOnly) {
                    recordsToSend = records.filter(r => selectedRecords.has(r.id));
                  } else {
                    recordsToSend = records;
                  }
                  
                  const validRecords = recordsToSend.filter(r => r.email && r.code);
                  
                  return `Are you sure you want to send access code emails to ${validRecords.length} student(s)?`;
                })()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Each student will receive an email containing:
              </p>
              <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                <li>Their access code</li>
                <li>Subject name</li>
                <li>Link to view their grades</li>
                <li>Instructions on how to use the access code</li>
              </ul>
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSendEmailDialogOpen(false);
                    setPendingEmailAction(null);
                  }}
                  disabled={sendingEmails}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleSendEmailsConfirm}
                  disabled={sendingEmails}
                >
                  {sendingEmails ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-4 w-4" />
                      Send Emails
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Grading System Configuration Dialog */}
        <Dialog open={gradingSystemDialogOpen} onOpenChange={setGradingSystemDialogOpen} size="full">
          <DialogContent className="max-h-[95vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="pb-4 border-b px-6 pt-6">
              <DialogTitle className="text-2xl">
                Configure Grading System
                {subject?.name && (
                  <span className="text-xl font-normal text-muted-foreground ml-2">
                    - {subject.name}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-base mt-2">
                Set up the grading system for this subject. Map grade columns to components and adjust weights.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto px-6">
            {gradingSystem && gradingSystem.categories && Array.isArray(gradingSystem.categories) && gradingSystem.categories.length > 0 ? (
              <div className="space-y-6 py-4">
                {/* Grade Key Mapping Section */}
                {gradeKeys.length > 0 ? (
                  <Card className="shadow-sm">
                    <CardHeader 
                      className="bg-muted/50 pb-3 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => setGradeMappingExpanded(!gradeMappingExpanded)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <CardTitle className="text-xl flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            Map Grade Columns to Components
                          </CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            setGradeMappingExpanded(!gradeMappingExpanded);
                          }}
                        >
                          {gradeMappingExpanded ? (
                            <ChevronUp className="h-5 w-5" />
                          ) : (
                            <ChevronDown className="h-5 w-5" />
                          )}
                        </Button>
                      </div>
                      <CardDescription className="text-base mt-1">
                        Select which component each grade column belongs to. Each column can only be assigned to one component (1:1 mapping).
                      </CardDescription>
                    </CardHeader>
                    {gradeMappingExpanded && (
                      <CardContent className="pt-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {gradeKeys.map((gradeKey) => {
                          const selectedComponents = getGradeKeyComponents(gradeKey);
                          
                          return (
                            <div key={gradeKey} className="border-2 rounded-xl p-5 space-y-4 bg-card hover:border-primary/50 transition-colors">
                              <div className="flex items-center justify-between pb-2 border-b">
                                <Label className="text-lg font-bold text-foreground">{gradeKey}</Label>
                                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                  {selectedComponents.length > 0 ? (
                                    <>
                                      <Check className="h-4 w-4" />
                                      {selectedComponents.length} component{selectedComponents.length !== 1 ? "s" : ""}
                                    </>
                                  ) : (
                                    <>
                                      <X className="h-4 w-4" />
                                      Not assigned
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-4">
                                {/* Unassigned option */}
                                <div className="space-y-2 pb-2 border-b">
                                  <div 
                                    className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                                      selectedComponents.length === 0 ? 'bg-muted border border-muted-foreground/20' : 'hover:bg-muted/50'
                                    }`}
                                  >
                                    <input
                                      type="radio"
                                      id={`${gradeKey}-unassigned`}
                                      name={`gradeKey-${gradeKey}`}
                                      checked={selectedComponents.length === 0}
                                      onChange={() => {
                                        // Remove from all components
                                        if (!gradingSystem || !gradingSystem.categories || !Array.isArray(gradingSystem.categories)) return;
                                        const updatedSystem: GradingSystem = {
                                          ...gradingSystem,
                                          categories: gradingSystem.categories.map((category) => ({
                                            ...category,
                                            components: (category.components || []).map((component) => ({
                                              ...component,
                                              gradeKeys: (component.gradeKeys || []).filter((k) => k !== gradeKey),
                                            })),
                                          })),
                                        };
                                        setGradingSystem(updatedSystem);
                                      }}
                                      className="h-5 w-5 cursor-pointer"
                                    />
                                    <Label
                                      htmlFor={`${gradeKey}-unassigned`}
                                      className="text-sm font-medium cursor-pointer flex-1 text-muted-foreground"
                                    >
                                      Unassigned
                                    </Label>
                                  </div>
                                </div>
                                {gradingSystem.categories.map((category) => (
                                  <div key={category.id} className="space-y-2">
                                    <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                                      {category.name}
                                    </Label>
                                    <div className="space-y-2 pl-1">
                                      {(category.components || []).map((component) => {
                                        const isSelected = selectedComponents.includes(component.id);
                                        return (
                                          <div 
                                            key={component.id} 
                                            className={`flex items-center space-x-3 p-2 rounded-lg transition-colors ${
                                              isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                                            }`}
                                          >
                                            <input
                                              type="radio"
                                              id={`${gradeKey}-${component.id}`}
                                              name={`gradeKey-${gradeKey}`}
                                              checked={isSelected}
                                              onChange={() => assignGradeKeyToComponent(gradeKey, component.id)}
                                              className="h-5 w-5 cursor-pointer"
                                            />
                                            <Label
                                              htmlFor={`${gradeKey}-${component.id}`}
                                              className="text-sm font-medium cursor-pointer flex-1 flex items-center justify-between"
                                            >
                                              <span>{component.name}</span>
                                              <span className="text-xs text-muted-foreground ml-2">
                                                {component.weight || 0}%
                                              </span>
                                            </Label>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      </CardContent>
                    )}
                  </Card>
                ) : (
                  <Alert className="border-2">
                    <AlertDescription className="text-base py-2">
                      No grade columns found. Add grade records first to configure the grading system.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Category and Component Configuration Section */}
                <Card className="shadow-sm">
                  <CardHeader 
                    className="bg-muted/50 pb-3 cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => setWeightsExpanded(!weightsExpanded)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1">
                        <CardTitle className="text-xl flex items-center gap-2">
                          <span className="text-2xl">⚖️</span>
                          Category and Component Weights
                        </CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          setWeightsExpanded(!weightsExpanded);
                        }}
                      >
                        {weightsExpanded ? (
                          <ChevronUp className="h-5 w-5" />
                        ) : (
                          <ChevronDown className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                    <CardDescription className="text-base mt-1">
                      Adjust weights for categories and components. Category weights must sum to 100%, and component weights within each category must sum to the category weight.
                    </CardDescription>
                  </CardHeader>
                  {weightsExpanded && (
                    <CardContent className="pt-6 space-y-6">
                    {gradingSystem.categories.map((category) => {
                      const categoryComponents = category.components || [];
                      const totalComponentWeight = categoryComponents.reduce((sum, comp) => sum + (comp.weight || 0), 0);
                      const isWeightValid = Math.abs(totalComponentWeight - (category.weight || 0)) < 0.01;
                      
                      return (
                        <Card key={category.id} className="border-2">
                          <CardHeader className="pb-4">
                            <div className="flex items-center justify-between flex-wrap gap-4">
                              <div className="flex-1">
                                <CardTitle className="text-lg mb-1">{category.name}</CardTitle>
                                <CardDescription className="flex items-center gap-2">
                                  <span>Current weight: <strong>{category.weight || 0}%</strong></span>
                                  {!isWeightValid && (
                                    <span className="text-destructive text-xs">
                                      (Components sum to {totalComponentWeight}%)
                                    </span>
                                  )}
                                </CardDescription>
                              </div>
                              <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg">
                                <Label className="font-medium whitespace-nowrap">Category Weight:</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={category.weight || 0}
                                  onChange={(e) => {
                                    const newWeight = parseFloat(e.target.value) || 0;
                                    const updatedSystem: GradingSystem = {
                                      ...gradingSystem,
                                      categories: (gradingSystem.categories || []).map((cat) =>
                                        cat.id === category.id ? { ...cat, weight: newWeight } : cat
                                      ),
                                    };
                                    setGradingSystem(updatedSystem);
                                  }}
                                  className="w-24 text-center font-semibold"
                                />
                                <span className="font-medium">%</span>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {categoryComponents.map((component) => {
                              const assignedKeys = component.gradeKeys || [];
                              return (
                                <div key={component.id} className="border rounded-xl p-4 space-y-3 bg-card">
                                  <div className="flex items-center justify-between flex-wrap gap-3">
                                    <div className="flex-1 min-w-[200px]">
                                      <div className="flex items-center gap-2 mb-2">
                                        <div className="flex-1">
                                          <Label className="text-xs text-muted-foreground mb-1 block">Component Name</Label>
                                          <Input
                                            type="text"
                                            value={component.name}
                                            onChange={(e) => updateComponentName(category.id, component.id, e.target.value)}
                                            className="text-base font-semibold h-9 px-3 border-2 focus:border-primary"
                                            placeholder="Enter component name"
                                          />
                                        </div>
                                        <div className="pt-6">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                                            onClick={() => removeComponentFromCategory(category.id, component.id)}
                                            title="Remove component"
                                          >
                                            <Minus className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <span>Weight: <strong>{component.weight || 0}%</strong></span>
                                        <span>•</span>
                                        <span>{assignedKeys.length} column{assignedKeys.length !== 1 ? "s" : ""} assigned</span>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-3 bg-muted/30 px-4 py-2 rounded-lg">
                                      <Label className="text-sm font-medium whitespace-nowrap">Component Weight:</Label>
                                      <Input
                                        type="number"
                                        min="0"
                                        max={category.weight || 0}
                                        value={component.weight || 0}
                                        onChange={(e) => {
                                          const newWeight = parseFloat(e.target.value) || 0;
                                          const updatedSystem: GradingSystem = {
                                            ...gradingSystem,
                                            categories: (gradingSystem.categories || []).map((cat) =>
                                              cat.id === category.id
                                                ? {
                                                    ...cat,
                                                    components: (cat.components || []).map((comp) =>
                                                      comp.id === component.id ? { ...comp, weight: newWeight } : comp
                                                    ),
                                                  }
                                                : cat
                                            ),
                                          };
                                          setGradingSystem(updatedSystem);
                                        }}
                                        className="w-20 text-center font-semibold"
                                      />
                                      <span className="text-sm font-medium">%</span>
                                    </div>
                                  </div>
                                  {assignedKeys.length > 0 && (
                                    <div className="flex flex-wrap gap-2 pt-2 border-t">
                                      <span className="text-xs text-muted-foreground font-medium">Assigned columns:</span>
                                      {assignedKeys.map((key) => (
                                        <span
                                          key={key}
                                          className="px-2.5 py-1 bg-primary/10 text-primary rounded-md text-sm font-medium"
                                        >
                                          {key}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                            <Button
                              variant="outline"
                              className="w-full mt-4"
                              onClick={() => addComponentToCategory(category.id)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Component to {category.name}
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                    </CardContent>
                  )}
                </Card>
                
                {/* Passing Grade Configuration */}
                <Card className="shadow-sm border-2">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <span className="text-2xl">🎯</span>
                      Passing Grade
                    </CardTitle>
                    <CardDescription className="text-base mt-1">
                      Set the minimum grade required to pass. Grades at or above this threshold will be displayed in green, below in red.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3 bg-muted/50 px-4 py-3 rounded-lg">
                      <Label className="font-medium whitespace-nowrap">Passing Grade:</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={gradingSystem.passing_grade ?? 50}
                        onChange={(e) => {
                          const newPassingGrade = parseFloat(e.target.value) || 50;
                          const updatedSystem: GradingSystem = {
                            ...gradingSystem,
                            passing_grade: newPassingGrade,
                          };
                          setGradingSystem(updatedSystem);
                        }}
                        className="w-24 text-center font-semibold"
                      />
                      <span className="font-medium">%</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Alert className="border-2 my-4">
                <AlertDescription className="text-base py-2">
                  Grading system is not properly configured. Please initialize it with the default structure.
                </AlertDescription>
              </Alert>
            )}
            </div>
            {gradingSystem && gradingSystem.categories && Array.isArray(gradingSystem.categories) && gradingSystem.categories.length > 0 && (
              <div className="flex justify-end gap-3 pt-4 border-t bg-muted/30 px-6 py-4 mt-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setGradingSystemDialogOpen(false)}
                    disabled={savingGradingSystem}
                    size="lg"
                    className="min-w-[120px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveGradingSystem}
                    disabled={savingGradingSystem}
                    size="lg"
                    className="min-w-[180px]"
                  >
                    {savingGradingSystem ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-5 w-5" />
                        Save Grading System
                      </>
                    )}
                  </Button>
                </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Computed Grades Dialog */}
        <Dialog open={computedGradesDialogOpen} onOpenChange={setComputedGradesDialogOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Computed Grades</DialogTitle>
              <DialogDescription>
                Final grades computed based on the configured grading system
              </DialogDescription>
            </DialogHeader>
            {computedGrades && computedGrades.length > 0 && (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Student Number</TableHead>
                        {gradingSystem?.categories.map((category) => (
                          <TableHead key={category.id} className="text-center">
                            {category.name} ({category.weight}%)
                          </TableHead>
                        ))}
                        <TableHead className="text-center font-bold">Final Grade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {computedGrades.map((computed: any) => (
                        <TableRow key={computed.recordId}>
                          <TableCell>{computed.studentName}</TableCell>
                          <TableCell>{computed.studentNumber}</TableCell>
                          {gradingSystem?.categories.map((category) => {
                            const categoryScore = computed.categoryScores[category.id];
                            return (
                              <TableCell key={category.id} className="text-center">
                                {categoryScore ? `${categoryScore.score.toFixed(2)}%` : "-"}
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold">
                            <span
                              className={`px-2 py-1 rounded ${
                                computed.finalGrade >= (gradingSystem?.passing_grade || 50)
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                              }`}
                            >
                              {computed.finalGrade.toFixed(2)}%
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setComputedGradesDialogOpen(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

