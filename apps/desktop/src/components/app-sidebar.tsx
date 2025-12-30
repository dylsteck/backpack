import * as React from "react"
import {
  Home,
  Grid3x3,
} from "lucide-react"
import { Link } from "@tanstack/react-router"
import iconImage from "@/assets/images/icon.png"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import ToggleTheme from "@/components/ToggleTheme"

const data = {
  navMain: [
    {
      title: "Home",
      url: "/",
      icon: Home,
      isActive: true,
    },
    {
      title: "Apps",
      url: "/apps",
      icon: Grid3x3,
    },
  ],
  navSecondary: [],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      {...props}
    >
      {/* Top bar with traffic signals area and toggle */}
      <div className="relative flex h-[44px] items-center px-2">
        {/* Space for traffic lights */}
        <div className="w-[76px]" />
        {/* Full-width border that extends across entire window */}
        <div className="fixed top-[44px] left-0 right-0 h-px bg-border opacity-60 z-40" />
      </div>
      <SidebarHeader className="pt-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" preload={false}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg">
                  <img src={iconImage} alt="App icon" className="size-8 rounded-lg" loading="lazy" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Cortex</span>
                  <span className="truncate text-xs">Your life in one app</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Theme</span>
            <ToggleTheme />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
