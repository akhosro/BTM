import type React from "react"
import { AppSidebar } from "./app-sidebar"
import { AppHeader } from "./app-header"

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <div className="pl-16">
        <AppHeader />
        <main>
          <div className="container mx-auto p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
