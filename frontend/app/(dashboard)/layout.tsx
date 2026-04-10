"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/api";
import type { User } from "@/types";
import { UserContext } from "@/contexts/user-context";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "sonner";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const user = await auth.me();
        setUser(user);
      } catch (err: unknown) {
        if ((err as { status?: number })?.status === 401) router.push("/auth");
      }
    }
    fetchUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 仅 mount 时执行一次，鉴权由 api.ts 的 tryRefresh 持续维护

  return (
    <UserContext.Provider value={user}>
      <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <span className="text-sm font-medium text-muted-foreground">vlab</span>
          </header>
          <div className="flex flex-1 flex-col gap-4 p-4">{children}</div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster richColors />
      </TooltipProvider>
    </UserContext.Provider>
  );
}
