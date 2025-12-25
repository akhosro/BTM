import { AppLayout } from "@/components/app-layout"
import { ControlRoomBuilder } from "@/components/control-room-builder"
import { TrialGuard } from "@/components/trial-guard"

export default function ControlRoomPage() {
  return (
    <TrialGuard>
      <AppLayout>
        <ControlRoomBuilder />
      </AppLayout>
    </TrialGuard>
  )
}
