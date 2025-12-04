"use client"

import { useState, useEffect } from "react"
import { Zap, Leaf, TrendingUp, DollarSign, Calendar, MapPin, Battery, Sun } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

const iconMap: Record<string, any> = {
  cost: DollarSign,
  carbon: Leaf,
  efficiency: Zap,
  battery: Battery,
  solar: Sun,
}

export function DashboardContent() {
  const [timeRange, setTimeRange] = useState("today")
  const [selectedSiteId, setSelectedSiteId] = useState("all")
  const [sites, setSites] = useState<any[]>([])
  const [viewMode, setViewMode] = useState<"timeline" | "acknowledged">("timeline")
  const [acknowledgedIds, setAcknowledgedIds] = useState<string[]>([])
  const [stats, setStats] = useState<any>(null)
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const currentHour = new Date().getHours()
  const greeting = currentHour < 12 ? "Good morning" : currentHour < 18 ? "Good afternoon" : "Good evening"

  useEffect(() => {
    fetchDashboardData()
    fetchSites()
  }, [timeRange, selectedSiteId])

  const fetchSites = async () => {
    try {
      const response = await fetch("/api/sites")
      if (response.ok) {
        const data = await response.json()
        setSites(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error("Error fetching sites:", error)
    }
  }

  const fetchDashboardData = async () => {
    try {
      setLoading(true)

      // Build query parameters
      const params = new URLSearchParams()
      if (timeRange !== "today") params.append("timeRange", timeRange)
      if (selectedSiteId !== "all") params.append("siteId", selectedSiteId)

      // Fetch stats
      const statsResponse = await fetch(`/api/dashboard/stats?${params.toString()}`)
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        setStats(statsData.stats)
      }

      // Fetch recommendations
      const recsResponse = await fetch(`/api/dashboard/recommendations?${params.toString()}`)
      if (recsResponse.ok) {
        const recsData = await recsResponse.json()
        setRecommendations(recsData.recommendations || [])
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const pendingRecommendations = recommendations.filter((r) => r.status === "pending")
  const acknowledgedRecommendations = recommendations.filter((r) => acknowledgedIds.includes(r.id))

  const groupedByDate = acknowledgedRecommendations.reduce(
    (acc, rec) => {
      const date = new Date(rec.timestamp).toLocaleDateString()
      if (!acc[date]) acc[date] = []
      acc[date].push(rec)
      return acc
    },
    {} as Record<string, any[]>,
  )

  const handleAcknowledge = (id: string) => {
    setAcknowledgedIds((prev) => [...prev, id])
  }

  const handleUnacknowledge = (id: string) => {
    setAcknowledgedIds((prev) => prev.filter((acknowledgedId) => acknowledgedId !== id))
  }

  const kpiStats = stats
    ? [
        {
          title: "Energy Spend Forecast",
          value: `$${stats.energySpendForecast.value}`,
          description: stats.energySpendForecast.description,
          icon: DollarSign,
          trend: stats.energySpendForecast.trend,
        },
        {
          title: "CO₂ Intensity Forecast",
          value: `${stats.carbonIntensity.value} g/kWh`,
          description: stats.carbonIntensity.description,
          icon: Leaf,
          trend: stats.carbonIntensity.trend,
        },
        {
          title: "Optimization Opportunity",
          value: `${stats.optimizationOpportunity.value}%`,
          description: stats.optimizationOpportunity.description,
          icon: TrendingUp,
          trend: stats.optimizationOpportunity.trend,
        },
        {
          title: "Potential Savings",
          value: `$${stats.potentialSavings.value}`,
          description: stats.potentialSavings.description,
          icon: Zap,
          trend: stats.potentialSavings.trend,
        },
      ]
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground">{greeting}, Operator</h1>
          <p className="text-pretty text-muted-foreground">Portfolio overview and optimization opportunities</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="7days">Next 7 days</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-40">
              <MapPin className="mr-2 h-4 w-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sites</SelectItem>
              {sites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpiStats.map((stat) => (
          <Card key={stat.title} className="cursor-pointer transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{stat.description}</p>
                <span className="text-xs font-medium text-secondary">{stat.trend}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">AI Recommendations</CardTitle>
              <p className="text-sm text-muted-foreground">Optimization opportunities for your portfolio</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "timeline" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("timeline")}
              >
                Timeline View
                <Badge variant={viewMode === "timeline" ? "secondary" : "outline"} className="ml-2">
                  {pendingRecommendations.length}
                </Badge>
              </Button>
              <Button
                variant={viewMode === "acknowledged" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("acknowledged")}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Acknowledged
                <Badge variant={viewMode === "acknowledged" ? "secondary" : "outline"} className="ml-2">
                  {acknowledgedRecommendations.length}
                </Badge>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === "timeline" && (
            <div className="space-y-4">
              {pendingRecommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Zap className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground">No Pending Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    Check back later for new optimization opportunities, or run the seed script to generate sample recommendations.
                  </p>
                </div>
              ) : (
                pendingRecommendations.map((rec) => {
                  const Icon = iconMap[rec.type] || Zap
                  const isAcknowledged = acknowledgedIds.includes(rec.id)
                  return (
                    <div
                      key={rec.id}
                      className="flex flex-col gap-3 rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex flex-1 gap-4">
                          <div
                            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${
                              rec.type === "carbon"
                                ? "bg-secondary/20 text-secondary"
                                : rec.type === "cost"
                                  ? "bg-primary/20 text-primary"
                                  : "bg-accent/20 text-accent"
                            }`}
                          >
                            <Icon className="h-6 w-6" />
                          </div>
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-foreground">{rec.headline}</h3>
                              <Badge
                                variant={
                                  rec.type === "carbon" ? "secondary" : rec.type === "cost" ? "default" : "outline"
                                }
                              >
                                {rec.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.description}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline">{rec.site}</Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>Confidence: {rec.confidence}%</span>
                              <span>•</span>
                              <span className="text-primary">Save ${rec.costSavings}</span>
                              <span>•</span>
                              <span className="text-secondary">Avoid {rec.co2Reduction} tCO₂</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="default" onClick={() => handleAcknowledge(rec.id)} disabled={isAcknowledged}>
                          {isAcknowledged ? "Acknowledged" : "Acknowledge"}
                        </Button>
                        <Button size="sm" variant="ghost">
                          Ignore
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {viewMode === "acknowledged" && (
            <div className="space-y-6">
              {acknowledgedRecommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold text-foreground">No Acknowledged Recommendations</h3>
                  <p className="text-sm text-muted-foreground">
                    Click "Acknowledge" on any recommendation in Timeline View to add it here.
                  </p>
                </div>
              ) : (
                (Object.entries(groupedByDate) as [string, any[]][]).map(([date, recs]) => (
                  <div key={date}>
                    <h3 className="mb-4 text-lg font-semibold text-foreground">{date}</h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {recs.map((rec: any) => {
                        const Icon = iconMap[rec.type] || Zap
                        return (
                          <Card key={rec.id} className="transition-shadow hover:shadow-md">
                            <CardHeader className="pb-3">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                                    rec.type === "carbon"
                                      ? "bg-secondary/20 text-secondary"
                                      : rec.type === "cost"
                                        ? "bg-primary/20 text-primary"
                                        : "bg-accent/20 text-accent"
                                  }`}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-sm text-foreground">{rec.headline}</CardTitle>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {new Date(rec.timestamp).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </p>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="space-y-2 pt-0">
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Savings</span>
                                <span className="font-semibold text-primary">${rec.costSavings}</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">CO₂ Reduction</span>
                                <span className="font-semibold text-secondary">{rec.co2Reduction} tCO₂</span>
                              </div>
                              <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Confidence</span>
                                <span className="font-mono font-semibold">{rec.confidence}%</span>
                              </div>
                              <div className="pt-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full bg-transparent"
                                  onClick={() => handleUnacknowledge(rec.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
