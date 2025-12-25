import { AppLayout } from "@/components/app-layout"
import { SettingsContent } from "@/components/settings-content"
import { TrialGuard } from "@/components/trial-guard"

export default function SettingsPage() {
  return (
    <TrialGuard>
      <AppLayout>
        <SettingsContent />
      </AppLayout>
    </TrialGuard>
  )
}
