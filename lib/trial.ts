/**
 * Trial Management Utilities
 * Handles 14-day free trial tracking and status checks
 */

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number | null;
  trialEndsAt: Date | null;
  subscriptionStatus: string;
  hasExpired: boolean;
}

/**
 * Check if a user's trial is still active
 */
export function getTrialStatus(user: {
  subscriptionStatus: string;
  trialEndsAt: Date | null;
  subscriptionStartedAt: Date | null;
}): TrialStatus {
  // If user has an active subscription, trial is not applicable
  if (user.subscriptionStatus === "active" && user.subscriptionStartedAt) {
    return {
      isActive: false,
      daysRemaining: null,
      trialEndsAt: null,
      subscriptionStatus: user.subscriptionStatus,
      hasExpired: false,
    };
  }

  // If subscription is expired or cancelled
  if (
    user.subscriptionStatus === "expired" ||
    user.subscriptionStatus === "cancelled"
  ) {
    return {
      isActive: false,
      daysRemaining: 0,
      trialEndsAt: user.trialEndsAt,
      subscriptionStatus: user.subscriptionStatus,
      hasExpired: true,
    };
  }

  // For trial users
  if (!user.trialEndsAt) {
    // No trial end date set - should not happen for new users
    return {
      isActive: true,
      daysRemaining: null,
      trialEndsAt: null,
      subscriptionStatus: user.subscriptionStatus,
      hasExpired: false,
    };
  }

  const now = new Date();
  const trialEndDate = new Date(user.trialEndsAt);
  const hasExpired = now > trialEndDate;

  if (hasExpired) {
    return {
      isActive: false,
      daysRemaining: 0,
      trialEndsAt: trialEndDate,
      subscriptionStatus: "expired",
      hasExpired: true,
    };
  }

  // Calculate days remaining
  const timeRemaining = trialEndDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

  return {
    isActive: true,
    daysRemaining,
    trialEndsAt: trialEndDate,
    subscriptionStatus: user.subscriptionStatus,
    hasExpired: false,
  };
}

/**
 * Format trial status for display
 */
export function formatTrialStatus(trialStatus: TrialStatus): string {
  if (trialStatus.subscriptionStatus === "active") {
    return "Active Subscription";
  }

  if (trialStatus.hasExpired) {
    return "Trial Expired";
  }

  if (trialStatus.daysRemaining === null) {
    return "Trial Active";
  }

  if (trialStatus.daysRemaining === 0) {
    return "Trial expires today";
  }

  if (trialStatus.daysRemaining === 1) {
    return "1 day remaining";
  }

  return `${trialStatus.daysRemaining} days remaining`;
}
