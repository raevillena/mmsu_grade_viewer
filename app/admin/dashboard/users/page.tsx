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
import { Plus, Edit, Trash2, Loader2, RefreshCw } from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";

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
  
  useEffect(() => {
    fetchUsers();
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
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <div className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Users</h1>
            <p className="text-muted-foreground mt-1">Manage all users in the system</p>
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
        </div>
      </div>
    </div>
  );
}

