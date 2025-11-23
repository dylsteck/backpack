"use client"

import * as React from "react"
import { ChevronRight, type LucideIcon } from "lucide-react"
import { Link } from "@tanstack/react-router"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export const NavMain = React.memo(function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon: LucideIcon
    isActive?: boolean
    items?: {
      title: string
      url: string
    }[]
  }[]
}) {
  return (
    <SidebarGroup>
      <SidebarMenu>
        {items.map((item) => {
          const hasItems = item.items && item.items.length > 0;

          if (!hasItems) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton asChild tooltip={item.title}>
                  {item.url.startsWith('http') || item.url.startsWith('#') ? (
                    <a href={item.url} target={item.url.startsWith('http') ? '_blank' : undefined} rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  ) : (
                    <Link to={item.url} preload={false}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          return (
            <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={item.title}>
                  {item.url.startsWith('http') || item.url.startsWith('#') ? (
                    <a href={item.url} target={item.url.startsWith('http') ? '_blank' : undefined} rel={item.url.startsWith('http') ? 'noopener noreferrer' : undefined}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  ) : (
                    <Link to={item.url} preload={false}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  )}
                </SidebarMenuButton>
                <CollapsibleTrigger asChild>
                  <SidebarMenuAction className="data-[state=open]:rotate-90">
                    <ChevronRight />
                    <span className="sr-only">Toggle</span>
                  </SidebarMenuAction>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    {item.items?.map((subItem) => (
                      <SidebarMenuSubItem key={subItem.title}>
                        <SidebarMenuSubButton asChild>
                          {subItem.url.startsWith('http') || subItem.url.startsWith('#') ? (
                            <a href={subItem.url} target={subItem.url.startsWith('http') ? '_blank' : undefined} rel={subItem.url.startsWith('http') ? 'noopener noreferrer' : undefined}>
                              <span>{subItem.title}</span>
                            </a>
                          ) : (
                            <Link to={subItem.url} preload={false}>
                              <span>{subItem.title}</span>
                            </Link>
                          )}
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    ))}
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
})
