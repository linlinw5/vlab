"use client";

import * as React from "react";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  FlaskConicalIcon,
  TerminalIcon,
  UsersIcon,
  MonitorIcon,
  ClockIcon,
} from "lucide-react";
import { useUser } from "@/contexts/user-context";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useUser();
  const isAdmin = user?.roleId === 1;

  const navItems = [
    {
      title: "Labs",
      url: "/labs",
      icon: <FlaskConicalIcon />,
    },
    {
      title: "VMs",
      url: "/vms",
      icon: <MonitorIcon />,
    },
    ...(isAdmin
      ? [
          {
            title: "administration",
            url: "#",
            icon: <UsersIcon />,
            items: [
              { title: "Users", url: "/admin/users" },
              { title: "Groups", url: "/admin/groups" },
              { title: "Categories", url: "/admin/categories" },
              { title: "Labs", url: "/admin/labs" },
              { title: "Assignment", url: "/admin/assign" },
              { title: "VMs", url: "/admin/vms" },
              { title: "VMs by User", url: "/admin/vms/user" },
              { title: "vCenter", url: "/admin/vcenter" },
              { title: "Tasks", url: "/admin/cron" },
            ],
          },
        ]
      : []),
  ];

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/labs">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <TerminalIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">vlab</span>
                  <span className="truncate text-xs">Virtual Lab System</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>{user && <NavUser user={{ name: user.username, email: user.email }} />}</SidebarFooter>
    </Sidebar>
  );
}
