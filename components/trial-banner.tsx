"use client"

import { useEffect, useState } from "react"
import { AlertCircle, X } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getTrialStatus, formatTrialStatus, type TrialStatus } from "@/lib/trial"

interface UserWithTrial {
  subscription_status: string
  trial_ends_at: string | null
  subscription_started_at: string | null
}

export function TrialBanner() {
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    const fetchTrialStatus = async () => {
      try {
        const response = await fetch("/api/users/me")
        if (response.ok) {
          const userData: UserWithTrial = await response.json()

          const status = getTrialStatus({
            subscriptionStatus: userData.subscription_status,
            trialEndsAt: userData.trial_ends_at ? new Date(userData.trial_ends_at) : null,
            subscriptionStartedAt: userData.subscription_started_at
              ? new Date(userData.subscription_started_at)
              : null,
          })

          setTrialStatus(status)
        }
      } catch (error) {
        console.error("Error fetching trial status:", error)
      }
    }

    fetchTrialStatus()
  }, [])

  // Don't show banner if dismissed, user has active subscription, or trial not loaded
  if (
    isDismissed ||
    !trialStatus ||
    trialStatus.subscriptionStatus === "active"
  ) {
    return null
  }

  // Show warning if trial expires soon (3 days or less)
  const showWarning =
    trialStatus.isActive &&
    trialStatus.daysRemaining !== null &&
    trialStatus.daysRemaining <= 3

  // Show error if trial has expired
  const showError = trialStatus.hasExpired

  if (!showWarning && !showError) {
    return null
  }

  return (
    <Alert
      variant={showError ? "destructive" : "default"}
      className="rounded-none border-l-0 border-r-0 border-t-0"
    >
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>
          {showError ? (
            <>
              Your free trial has expired. Upgrade to continue using Enalysis.
            </>
          ) : (
            <>
              Free trial {formatTrialStatus(trialStatus).toLowerCase()}. Upgrade
              to keep your energy optimization running.
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={showError ? "default" : "outline"}
            onClick={() => {
              // TODO: Navigate to upgrade page
              window.location.href = "/contact"
            }}
          >
            Upgrade Now
          </Button>
          {!showError && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsDismissed(true)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}
