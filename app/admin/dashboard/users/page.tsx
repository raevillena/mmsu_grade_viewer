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
import { type User, type UserRole } from "@/lib/types";
import { Plus, Edit, Trash2, LogOut, Loader2, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Admin Dashboard - User Management
 * Allows admins to view, create, edit, and delete users
 */
export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "student" as UserRole,
    external_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: string; name: string } | null>(null);
  
  // Moodle sync state
  const [moodleSyncDialogOpen, setMoodleSyncDialogOpen] = useState(false);
  const [moodleCourseId, setMoodleCourseId] = useState("");
  const [moodleEnrolId, setMoodleEnrolId] = useState("");
  const [syncingEmails, setSyncingEmails] = useState(false);

  useEffect(() => {
    fetchUsers();
    // Load Moodle settings from localStorage
    const savedCourseId = localStorage.getItem("moodleCourseId");
    const savedEnrolId = localStorage.getItem("moodleEnrolId");
    if (savedCourseId) {
      setMoodleCourseId(savedCourseId);
    }
    if (savedEnrolId) {
      setMoodleEnrolId(savedEnrolId);
    }
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/users");
      const data = await response.json();

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch users");
      }

      setUsers(data.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        external_id: user.external_id || "",
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        role: "student",
        external_id: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingUser(null);
      setFormData({
        name: "",
        email: "",
        role: "student",
        external_id: "",
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const payload = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        ...(formData.external_id && { external_id: formData.external_id }),
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
        const errorMessage = data.error || "Failed to save user";
        setError(errorMessage);
        toast.error(editingUser ? "Update Failed" : "Create Failed", {
          description: errorMessage,
        });
        return;
      }

      handleCloseDialog();
      fetchUsers();
      toast.success(editingUser ? "User Updated" : "User Created", {
        description: `"${formData.name}" has been ${editingUser ? "updated" : "created"} successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(editingUser ? "Update Failed" : "Create Failed", {
        description: errorMessage,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) {
      setUserToDelete({ id: userId, name: user.name });
      setDeleteDialogOpen(true);
    }
  };

  // Handle bulk sync from Moodle (admin only - updates global cache)
  const handleBulkSyncEmails = async () => {
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
        throw new Error(data.error || "Failed to sync emails");
      }

      // Bulk sync is no longer supported
      if (!data.success) {
        throw new Error(data.error || "Bulk sync is not supported");
      }

      if (data.success) {
        const { total, synced, created, updated, recordsUpdated, errors } = data.data;
        
        // Save Moodle settings to localStorage
        if (moodleCourseId) {
          localStorage.setItem("moodleCourseId", moodleCourseId);
        }
        if (moodleEnrolId) {
          localStorage.setItem("moodleEnrolId", moodleEnrolId);
        }
        
        const recordsText = recordsUpdated > 0 ? `, ${recordsUpdated} grade record(s) updated` : "";
        toast.success("Sync completed", {
          description: `Synced ${synced} students (${created} created, ${updated} updated)${recordsText}${errors > 0 ? `. ${errors} errors.` : ""}`,
        });
        
        setMoodleSyncDialogOpen(false);
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

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    const userId = userToDelete.id;
    const userName = userToDelete.name;

    setDeletingId(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (response.status === 401) {
        // Unauthorized - redirect to login
        window.location.replace("/login");
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.error || "Failed to delete user";
        setError(errorMessage);
        toast.error("Delete Failed", {
          description: errorMessage,
        });
        return;
      }

      fetchUsers();
      toast.success("User Deleted", {
        description: `"${userName}" has been deleted successfully.`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error("Delete Failed", {
        description: errorMessage,
      });
    } finally {
      setDeletingId(null);
      setUserToDelete(null);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
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
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage users</p>
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

        <div className="flex gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => setMoodleSyncDialogOpen(true)}
            disabled={syncingEmails}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Emails from Moodle
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  Manage all users in the system
                </CardDescription>
              </div>
              <Button 
                onClick={() => handleOpenDialog()}
                disabled={submitting || deletingId !== null}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>External ID</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                          {user.role}
                        </span>
                      </TableCell>
                      <TableCell>{user.external_id || "-"}</TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(user)}
                            disabled={deletingId === user.id || submitting}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteClick(user.id)}
                            disabled={deletingId === user.id || submitting}
                          >
                            {deletingId === user.id ? (
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
                {editingUser ? "Edit User" : "Create User"}
              </DialogTitle>
              <DialogDescription>
                {editingUser
                  ? "Update user information"
                  : "Add a new user to the system"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                  disabled={submitting}
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
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as UserRole,
                    })
                  }
                  required
                  disabled={submitting}
                >
                  <option value="admin">Admin</option>
                  <option value="teacher">Teacher</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="external_id">External ID (Optional)</Label>
                <Input
                  id="external_id"
                  value={formData.external_id}
                  onChange={(e) =>
                    setFormData({ ...formData, external_id: e.target.value })
                  }
                  placeholder="External API user ID"
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
                      {editingUser ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    editingUser ? "Update" : "Create"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          onConfirm={handleDeleteConfirm}
          title="Delete User"
          description={
            userToDelete
              ? `Are you sure you want to delete "${userToDelete.name}"? This action cannot be undone.`
              : ""
          }
          confirmText="Delete"
          cancelText="Cancel"
          variant="destructive"
        />

        {/* Moodle Sync Dialog */}
        <Dialog open={moodleSyncDialogOpen} onOpenChange={setMoodleSyncDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Sync Emails from Moodle</DialogTitle>
              <DialogDescription>
                <div className="space-y-2">
                  <p className="text-destructive font-medium">
                    Bulk sync is not supported because Moodle API doesn't return student numbers (idnumber) when fetching all users.
                  </p>
                  <p>
                    Please use the subject-specific sync feature in each subject's page instead. 
                    That feature searches Moodle individually for each student number in the subject's records.
                  </p>
                </div>
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
                  onClick={handleBulkSyncEmails}
                  disabled={true}
                  variant="outline"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Not Available
                </Button>
                <p className="text-sm text-muted-foreground text-center">
                  Use subject-specific sync in each subject page instead
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

