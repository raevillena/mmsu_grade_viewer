"use client";

import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users, GraduationCap, LogOut } from "lucide-react";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  {
    title: "Users",
    href: "/admin/dashboard/users",
    icon: Users,
  },
  {
    title: "Students",
    href: "/admin/dashboard/students",
    icon: GraduationCap,
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <div className="w-64 border-r bg-background h-screen sticky top-0 flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold">Admin Dashboard</h2>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          
          return (
            <Button
              key={item.href}
              variant={isActive ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start",
                isActive && "bg-secondary"
              )}
              onClick={() => router.push(item.href)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.title}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}

