"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Login page for Admin and Teacher authentication
 * Uses external authentication API via /api/auth/login
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      // Check if response is ok before trying to parse JSON
      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        const errorMessage = "Invalid response from server";
        setError(errorMessage);
        toast.error("Server Error", {
          description: errorMessage,
        });
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorMessage = data.error || "Login failed";
        setError(errorMessage);
        toast.error("Login Failed", {
          description: errorMessage,
        });
        setLoading(false);
        return;
      }

      console.log("Login response data:", data);
      console.log("User role:", data.user?.role);
      console.log("Full data object:", JSON.stringify(data, null, 2));

      // Redirect based on role - use immediate redirect without setTimeout
      const targetPath = data.user?.role === "admin" 
        ? "/admin/dashboard/users"
        : data.user?.role === "teacher"
        ? "/teacher/dashboard/subjects"
        : null;

      if (targetPath) {
        console.log(`Redirecting to ${targetPath} for role: ${data.user?.role}`);
        toast.success("Login Successful", {
          description: `Welcome! Redirecting to ${data.user?.role === "admin" ? "Admin" : "Teacher"} dashboard...`,
          duration: 3000, // Show for 3 seconds
        });
        // Use router.push for client-side navigation to preserve toast state
        // Small delay to ensure toast is visible before navigation
        setTimeout(() => {
          router.push(targetPath);
        }, 100);
      } else {
        const role = data.user?.role || "undefined";
        console.error("Unknown role:", role);
        console.error("Full data:", data);
        const errorMessage = `Unauthorized role: ${role}. You don't have access to this application.`;
        setError(errorMessage);
        toast.error("Access Denied", {
          description: `Your account has the role "${role}" which is not authorized for this application. Please contact an administrator.`,
          duration: 5000,
        });
        setLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      const errorMessage = err instanceof Error ? err.message : "An error occurred. Please try again.";
      setError(errorMessage);
      toast.error("Login Error", {
        description: errorMessage,
      });
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            Enter your credentials to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none disabled:opacity-50"
                  disabled={loading}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

