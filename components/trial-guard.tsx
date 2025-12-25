"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getTrialStatus } from "@/lib/trial"

/**
 * Trial Guard Component
 * Redirects users to trial-expired page if their trial has ended
 */
export function TrialGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isAllowed, setIsAllowed] = useState(false)

  useEffect(() => {
    const checkTrialStatus = async () => {
      try {
        const response = await fetch("/api/users/me")

        if (!response.ok) {
          // Not authenticated - let middleware handle redirect
          setIsChecking(false)
          setIsAllowed(true)
          return
        }

        const userData = await response.json()

        const trialStatus = getTrialStatus({
          subscriptionStatus: userData.subscriptionStatus,
          trialEndsAt: userData.trialEndsAt ? new Date(userData.trialEndsAt) : null,
          subscriptionStartedAt: userData.subscriptionStartedAt
            ? new Date(userData.subscriptionStartedAt)
            : null,
        })

        // Allow access if:
        // 1. Active subscription
        // 2. Trial is still active
        if (userData.subscriptionStatus === "active" || !trialStatus.hasExpired) {
          setIsAllowed(true)
        } else {
          // Trial has expired - redirect to trial expired page
          router.push("/trial-expired")
        }
      } catch (error) {
        console.error("Error checking trial status:", error)
        // On error, allow access (fail open)
        setIsAllowed(true)
      } finally {
        setIsChecking(false)
      }
    }

    checkTrialStatus()
  }, [router])

  // Show nothing while checking
  if (isChecking) {
    return null
  }

  // Show children if allowed
  if (isAllowed) {
    return <>{children}</>
  }

  // Show nothing if not allowed (redirecting)
  return null
}
