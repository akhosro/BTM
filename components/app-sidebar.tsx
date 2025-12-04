"use client"

import { Zap, Home, Grid3x3, Settings, FileText } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const navigation = [
  { name: "Overview", href: "/", icon: Home, section: "OVERVIEW" },
  { name: "Control Room", href: "/control-room", icon: Grid3x3, section: "SYSTEM" },
  { name: "Contracts", href: "/contracts", icon: FileText, section: "SYSTEM" },
  { name: "Settings", href: "/settings", icon: Settings, section: "SETTINGS" },
]

export function AppSidebar() {
  const pathname = usePathname()

  // Group navigation by section
  const sections = navigation.reduce(
    (acc, item) => {
      if (!acc[item.section]) {
        acc[item.section] = []
      }
      acc[item.section].push(item)
      return acc
    },
    {} as Record<string, typeof navigation>,
  )

  return (
    <TooltipProvider delayDuration={0}>
      <aside className="fixed left-0 top-0 z-40 h-screen w-16 border-r border-border bg-sidebar">
        <div className="flex h-full flex-col items-center py-4">
          <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <Zap className="h-6 w-6 text-primary-foreground" />
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col gap-6">
            {Object.entries(sections).map(([section, items]) => (
              <div key={section} className="flex flex-col gap-2">
                {items.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Tooltip key={item.name}>
                      <TooltipTrigger asChild>
                        <Link href={item.href}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-10 w-10 transition-colors",
                              isActive
                                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            )}
                          >
                            <item.icon className="h-5 w-5" />
                            <span className="sr-only">{item.name}</span>
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">
                        <p>{item.name}</p>
                      </TooltipContent>
                    </Tooltip>
                  )
                })}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </TooltipProvider>
  )
}
