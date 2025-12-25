"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { User, Save, Moon, Sun, Monitor, Database, CheckCircle2, XCircle, AlertCircle, Loader2, Settings2, CreditCard, Calendar } from "lucide-react"
import { getTrialStatus, formatTrialStatus } from "@/lib/trial"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTheme } from "@/components/theme-provider"
import { DataConnectionsModal } from "@/components/data-connections-modal"

type Site = {
  id: string
  name: string
  location: string | null
  meters: Meter[]
}

type Meter = {
  id: string
  name: string
  category: "CONS" | "PROD" | "STOR" | "INJ"
  siteId: string
  energySources: EnergySource[]
}

type EnergySource = {
  id: string
  meterId: string
  name: string
  sourceType: string
  metadata: any
  active: boolean
}

type User = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  jobTitle: string | null
  company: string | null
  phone: string | null
  subscription_status: string
  trial_ends_at: string | null
  subscription_started_at: string | null
}

type UserPreferences = {
  id: string
  userId: string
  theme: string | null
  emailNotifications: boolean | null
  language: string | null
  timezone: string | null
  alertThresholds: any
}

export function SettingsContent() {
  const { theme, setTheme } = useTheme()
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMeter, setSelectedMeter] = useState<Meter & { siteName?: string } | null>(null)
  const [showModal, setShowModal] = useState(false)

  // User profile state
  const [user, setUser] = useState<User | null>(null)
  const [userLoading, setUserLoading] = useState(true)
  const [userSaving, setUserSaving] = useState(false)

  // Preferences state
  const [preferences, setPreferences] = useState<UserPreferences | null>(null)
  const [prefSaving, setPrefSaving] = useState(false)

  useEffect(() => {
    fetchData()
    fetchUser()
    fetchPreferences()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/sites")
      if (!response.ok) throw new Error("Failed to fetch sites")
      const data = await response.json()
      setSites(data || [])
    } catch (error) {
      console.error("Error fetching sites:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchUser = async () => {
    setUserLoading(true)
    try {
      const response = await fetch("/api/users/me")
      if (!response.ok) throw new Error("Failed to fetch user")
      const data = await response.json()
      setUser(data)
    } catch (error) {
      console.error("Error fetching user:", error)
    } finally {
      setUserLoading(false)
    }
  }

  const fetchPreferences = async () => {
    try {
      const response = await fetch("/api/users/me/preferences")
      if (!response.ok) throw new Error("Failed to fetch preferences")
      const data = await response.json()
      setPreferences(data)
    } catch (error) {
      console.error("Error fetching preferences:", error)
    }
  }

  const saveUserProfile = async () => {
    if (!user) return
    setUserSaving(true)
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      })
      if (!response.ok) throw new Error("Failed to save profile")
      const updatedUser = await response.json()
      setUser(updatedUser)
    } catch (error) {
      console.error("Error saving profile:", error)
      alert("Failed to save profile")
    } finally {
      setUserSaving(false)
    }
  }

  const savePreferences = async () => {
    if (!preferences) return
    setPrefSaving(true)
    try {
      const response = await fetch("/api/users/me/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      })
      if (!response.ok) throw new Error("Failed to save preferences")
      const updatedPrefs = await response.json()
      setPreferences(updatedPrefs)
    } catch (error) {
      console.error("Error saving preferences:", error)
      alert("Failed to save preferences")
    } finally {
      setPrefSaving(false)
    }
  }

  const getConnectionStatus = (energySources: EnergySource[]) => {
    if (energySources.length === 0) {
      return {
        status: "not_configured",
        label: "Not Configured",
        variant: "outline" as const,
        icon: "alert"
      }
    }

    const source = energySources[0]
    const dataSourceType = source.metadata?.dataSourceType

    // API connections - these are the most important to monitor
    if (dataSourceType === "api") {
      const connectionStatus = source.metadata?.connectionStatus
      if (connectionStatus === "success") {
        return {
          status: "api_connected",
          label: "API Connected",
          variant: "default" as const,
          icon: "success"
        }
      } else if (connectionStatus === "failed") {
        return {
          status: "api_error",
          label: "API Error",
          variant: "destructive" as const,
          icon: "error"
        }
      } else {
        return {
          status: "api_not_tested",
          label: "API Not Tested",
          variant: "secondary" as const,
          icon: "warning"
        }
      }
    }

    // Non-API sources - these don't need monitoring
    if (dataSourceType === "manual") {
      return {
        status: "manual",
        label: "Manual",
        variant: "secondary" as const,
        icon: "info"
      }
    }

    if (dataSourceType === "calculated") {
      return {
        status: "calculated",
        label: "Calculated",
        variant: "secondary" as const,
        icon: "info"
      }
    }

    return {
      status: "configured",
      label: "Configured",
      variant: "secondary" as const,
      icon: "info"
    }
  }

  const getStatusIcon = (iconType: string) => {
    switch (iconType) {
      case "success":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />
      case "error":
        return <XCircle className="h-5 w-5 text-red-600" />
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />
      case "alert":
        return <AlertCircle className="h-5 w-5 text-muted-foreground" />
      case "info":
      default:
        return <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "PROD": return "Solar Production"
      case "CONS": return "Consumption"
      case "STOR": return "Storage"
      case "INJ": return "Injection"
      default: return category
    }
  }

  const handleConfigureClick = (meter: Meter, siteName: string) => {
    setSelectedMeter({ ...meter, siteName })
    setShowModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">Settings</h1>
        <p className="text-pretty text-muted-foreground">Manage your account and application preferences</p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile">Profile & Teams</TabsTrigger>
          <TabsTrigger value="preferences">Preferences</TabsTrigger>
          <TabsTrigger value="connections">Data Connections</TabsTrigger>
        </TabsList>

        {/* Profile & Teams Tab */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <User className="h-5 w-5" />
                Personal Information
              </CardTitle>
              <CardDescription>Update your personal details and contact information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={user?.firstName || ""}
                        onChange={(e) => setUser({ ...user!, firstName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={user?.lastName || ""}
                        onChange={(e) => setUser({ ...user!, lastName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.doe@example.com"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jobTitle">Job Title</Label>
                    <Input
                      id="jobTitle"
                      placeholder="Energy Manager"
                      value={user?.jobTitle || ""}
                      onChange={(e) => setUser({ ...user!, jobTitle: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      placeholder="Acme Inc."
                      value={user?.company || ""}
                      onChange={(e) => setUser({ ...user!, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      placeholder="+1 (555) 123-4567"
                      value={user?.phone || ""}
                      onChange={(e) => setUser({ ...user!, phone: e.target.value })}
                    />
                  </div>
                  <Separator />
                  <div className="flex justify-end">
                    <Button onClick={saveUserProfile} disabled={userSaving}>
                      {userSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <CreditCard className="h-5 w-5" />
                Subscription
              </CardTitle>
              <CardDescription>View your subscription status and trial information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : user ? (
                <>
                  {(() => {
                    const trialStatus = getTrialStatus({
                      subscriptionStatus: user.subscription_status,
                      trialEndsAt: user.trial_ends_at ? new Date(user.trial_ends_at) : null,
                      subscriptionStartedAt: user.subscription_started_at ? new Date(user.subscription_started_at) : null,
                    })

                    return (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between rounded-lg border border-border p-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">Status</p>
                              <Badge variant={
                                user.subscription_status === "active" ? "default" :
                                trialStatus.hasExpired ? "destructive" : "secondary"
                              }>
                                {user.subscription_status === "active" ? "Active Subscription" :
                                 trialStatus.hasExpired ? "Trial Expired" : "Free Trial"}
                              </Badge>
                            </div>
                            {user.subscription_status === "trial" && trialStatus.trialEndsAt && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                {trialStatus.hasExpired ? (
                                  <span>Trial expired on {trialStatus.trialEndsAt.toLocaleDateString()}</span>
                                ) : (
                                  <span>
                                    Trial ends {trialStatus.trialEndsAt.toLocaleDateString()}
                                    {trialStatus.daysRemaining !== null && (
                                      <> ({trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? 's' : ''} remaining)</>
                                    )}
                                  </span>
                                )}
                              </div>
                            )}
                            {user.subscription_status === "active" && user.subscription_started_at && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Calendar className="h-3 w-3" />
                                <span>Active since {new Date(user.subscription_started_at).toLocaleDateString()}</span>
                              </div>
                            )}
                          </div>
                          {user.subscription_status !== "active" && (
                            <Button
                              size="sm"
                              variant={trialStatus.hasExpired ? "default" : "outline"}
                              onClick={() => {
                                window.location.href = "/contact"
                              }}
                            >
                              Upgrade Now
                            </Button>
                          )}
                        </div>
                        {user.subscription_status === "trial" && !trialStatus.hasExpired && (
                          <p className="text-xs text-muted-foreground">
                            Your free trial includes access to all features. Upgrade to continue after your trial ends.
                          </p>
                        )}
                        {trialStatus.hasExpired && (
                          <p className="text-xs text-red-600">
                            Your trial has expired. Please upgrade to continue using Enalysis.
                          </p>
                        )}
                      </div>
                    )
                  })()}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Team Members</CardTitle>
              <CardDescription>Manage users and site permissions (Coming Soon)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {user?.firstName && user?.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : "Demo User"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {user?.email} • {user?.jobTitle || "Admin"}
                        </p>
                      </div>
                      <Badge variant="secondary">You</Badge>
                    </div>
                  </div>
                  <Separator />
                  <Button variant="outline" className="w-full bg-transparent" disabled>
                    <User className="mr-2 h-4 w-4" />
                    Add Team Member (Coming Soon)
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Appearance</CardTitle>
              <CardDescription>Customize the look and feel of the application</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Theme</Label>
                <Select value={theme} onValueChange={(value: "light" | "dark" | "system") => setTheme(value)}>
                  <SelectTrigger id="theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      <div className="flex items-center gap-2">
                        <Sun className="h-4 w-4" />
                        Light
                      </div>
                    </SelectItem>
                    <SelectItem value="dark">
                      <div className="flex items-center gap-2">
                        <Moon className="h-4 w-4" />
                        Dark
                      </div>
                    </SelectItem>
                    <SelectItem value="system">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4" />
                        System
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose between light and dark themes, or use your system preference
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-foreground">Advanced Preferences</CardTitle>
              <CardDescription>Additional settings and preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-dashed border-border p-6 text-center">
                <Settings2 className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Coming Soon</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Notifications, timezone, and additional preferences will be available in a future update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Data Connections Tab */}
        <TabsContent value="connections" className="space-y-6">
          {/* Summary Stats - Moved to Top */}
          {!loading && sites.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Meters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-foreground">
                    {sites.reduce((acc, site) => acc + (site.meters?.length || 0), 0)}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">API Connected</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {sites.reduce((acc, site) =>
                      acc + (site.meters?.filter(m =>
                        m.energySources?.length > 0 &&
                        m.energySources[0]?.metadata?.dataSourceType === "api" &&
                        m.energySources[0]?.metadata?.connectionStatus === "success"
                      ).length || 0), 0
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">API Errors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    {sites.reduce((acc, site) =>
                      acc + (site.meters?.filter(m =>
                        m.energySources?.length > 0 &&
                        m.energySources[0]?.metadata?.dataSourceType === "api" &&
                        m.energySources[0]?.metadata?.connectionStatus === "failed"
                      ).length || 0), 0
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Not Configured</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {sites.reduce((acc, site) =>
                      acc + (site.meters?.filter(m => m.energySources?.length === 0).length || 0), 0
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Database className="h-5 w-5" />
                Data Connection Status
              </CardTitle>
              <CardDescription>Monitor and configure data connections for all meters across your sites</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : sites.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No sites configured yet</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {sites.map((site) => {
                    const meters = site.meters || []
                    return (
                      <div key={site.id} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-lg text-foreground">{site.name}</h3>
                          <Badge variant="outline">{meters.length} meters</Badge>
                        </div>

                        <div className="space-y-2">
                          {meters.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground text-sm">
                              No meters configured for this site
                            </div>
                          ) : (
                            meters.map((meter) => {
                              const connectionInfo = getConnectionStatus(meter.energySources)
                              return (
                                <div
                                  key={meter.id}
                                  className="flex items-center justify-between rounded-lg border border-border p-4 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-4 flex-1">
                                    {getStatusIcon(connectionInfo.icon)}
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <p className="text-sm font-medium text-foreground">{meter.name}</p>
                                        <Badge variant={connectionInfo.variant}>
                                          {connectionInfo.label}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-muted-foreground">
                                        {getCategoryLabel(meter.category)}
                                      </p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleConfigureClick(meter, site.name)}
                                  >
                                    <Settings2 className="h-4 w-4 mr-2" />
                                    Configure
                                  </Button>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Data Connections Modal */}
      <DataConnectionsModal
        meter={selectedMeter}
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setSelectedMeter(null)
        }}
        onSave={() => {
          fetchData()
        }}
      />
    </div>
  )
}
