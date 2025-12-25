import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { AppLayout } from "@/components/app-layout"
import { DashboardContent } from "@/components/dashboard-content"
import { TrialGuard } from "@/components/trial-guard"

export default async function DashboardPage() {
  const session = await getSession()

  // Redirect to landing page if not authenticated
  if (!session) {
    redirect("/landing")
  }

  return (
    <TrialGuard>
      <AppLayout>
        <DashboardContent />
      </AppLayout>
    </TrialGuard>
  )
}
