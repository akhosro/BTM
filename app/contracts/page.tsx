"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { DollarSign, Leaf, Save, Loader2 } from "lucide-react"
import { AppLayout } from "@/components/app-layout"

type Site = {
  id: string
  name: string
  location: string | null
}

export default function ContractsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [existingPricingId, setExistingPricingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  const [pricingConfig, setPricingConfig] = useState({
    utilityProvider: "",
    rateType: "time_of_use" as "time_of_use" | "fixed",
    dataSource: "manual" as "manual" | "api",
    apiProvider: "",
    apiKey: "",
    offPeakRate: "",
    midPeakRate: "",
    onPeakRate: "",
    demandCharge: "",
    demandThreshold: "",
  })

  useEffect(() => {
    fetchSites()
  }, [])

  // Auto-select first site when sites are loaded
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id)
    }
  }, [sites, selectedSiteId])

  // Fetch existing pricing when site is selected
  useEffect(() => {
    if (selectedSiteId) {
      fetchExistingPricing(selectedSiteId)
    }
  }, [selectedSiteId])

  const fetchSites = async () => {
    try {
      const response = await fetch("/api/sites")
      if (response.ok) {
        const data = await response.json()
        setSites(data)
      }
    } catch (error) {
      console.error("Error fetching sites:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingPricing = async (siteId: string) => {
    try {
      const response = await fetch(`/api/electricity-pricing?siteId=${siteId}&activeOnly=true`)
      if (response.ok) {
        const pricingData = await response.json()

        if (pricingData && pricingData.length > 0) {
          const pricing = pricingData[0]
          setExistingPricingId(pricing.id)
          const rateStructure = pricing.rateStructure || {}

          setPricingConfig({
            utilityProvider: pricing.utilityProvider || "",
            rateType: pricing.rateType || "time_of_use",
            dataSource: pricing.dataSource || "manual",
            apiProvider: pricing.metadata?.apiProvider || "",
            apiKey: "",
            offPeakRate: rateStructure.off_peak?.rate?.toString() || "",
            midPeakRate: rateStructure.mid_peak?.rate?.toString() || "",
            onPeakRate: rateStructure.on_peak?.rate?.toString() || "",
            demandCharge: pricing.demandCharge?.toString() || "",
            demandThreshold: pricing.demandThreshold?.toString() || "",
          })
        } else {
          setExistingPricingId(null)
          setPricingConfig({
            utilityProvider: "",
            rateType: "time_of_use",
            dataSource: "manual",
            apiProvider: "",
            apiKey: "",
            offPeakRate: "",
            midPeakRate: "",
            onPeakRate: "",
            demandCharge: "",
            demandThreshold: "",
          })
        }
      }
    } catch (error) {
      console.error("Error fetching existing pricing:", error)
    }
  }

  const savePricingConfig = async () => {
    try {
      setSaving(true)

      if (!selectedSiteId) {
        toast({
          title: "Error",
          description: "Please select a site first.",
          variant: "destructive",
        })
        return
      }

      const selectedSite = sites.find(s => s.id === selectedSiteId)
      if (!selectedSite) {
        toast({
          title: "Error",
          description: "Selected site not found.",
          variant: "destructive",
        })
        return
      }

      if (!selectedSite.location) {
        toast({
          title: "Error",
          description: "Site location is required. Please add a location to your site in Control Room.",
          variant: "destructive",
        })
        return
      }

      const rateStructure = {
        off_peak: {
          rate: parseFloat(pricingConfig.offPeakRate) || 0.082,
          hours: [[0, 7], [19, 24]],
          days: [1, 2, 3, 4, 5],
          label: "Off-Peak"
        },
        mid_peak: {
          rate: parseFloat(pricingConfig.midPeakRate) || 0.113,
          hours: [[7, 11], [17, 19]],
          days: [1, 2, 3, 4, 5],
          label: "Mid-Peak"
        },
        on_peak: {
          rate: parseFloat(pricingConfig.onPeakRate) || 0.170,
          hours: [[11, 17]],
          days: [1, 2, 3, 4, 5],
          label: "On-Peak"
        },
        weekend: {
          rate: parseFloat(pricingConfig.offPeakRate) || 0.082,
          hours: [[0, 24]],
          days: [0, 6],
          label: "Weekend (Off-Peak)"
        }
      }

      const response = await fetch("/api/electricity-pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: selectedSite.id,
          region: selectedSite.location,
          utilityProvider: pricingConfig.utilityProvider,
          rateType: pricingConfig.rateType,
          rateStructure,
          currency: "USD",
          demandCharge: pricingConfig.demandCharge ? parseFloat(pricingConfig.demandCharge) : null,
          demandThreshold: pricingConfig.demandThreshold ? parseFloat(pricingConfig.demandThreshold) : null,
          validFrom: new Date().toISOString(),
          dataSource: pricingConfig.dataSource,
          metadata: {
            apiProvider: pricingConfig.apiProvider,
            configuredAt: new Date().toISOString(),
          }
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save pricing config")
      }

      toast({
        title: "Success",
        description: "Electricity pricing contract saved successfully",
      })

      // Refresh the pricing data
      await fetchExistingPricing(selectedSiteId)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save pricing configuration",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Electricity Contracts</h1>
          <p className="text-muted-foreground">
            Configure electricity pricing contracts and rates for cost optimization
          </p>
        </div>

        <div className="space-y-4">
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center">
                    <Leaf className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-blue-900">Automatic Data Sources</h4>
                  <p className="text-xs text-blue-800">
                    Weather forecasts and grid carbon intensity data are automatically retrieved based on your site locations.
                    Configure electricity pricing below for AI-powered cost optimization.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-lg">Electricity Pricing Contract</CardTitle>
                      {existingPricingId && <Badge variant="secondary" className="text-xs">Configured</Badge>}
                    </div>
                    <CardDescription className="text-xs">Configure time-of-use rates for cost optimization</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {sites.length > 1 && (
                <div>
                  <Label className="text-sm">Site</Label>
                  <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select a site" />
                    </SelectTrigger>
                    <SelectContent>
                      {sites.map((site) => (
                        <SelectItem key={site.id} value={site.id}>
                          {site.name} {site.location ? `(${site.location})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm">Utility Provider</Label>
                  <Input
                    value={pricingConfig.utilityProvider}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, utilityProvider: e.target.value })}
                    placeholder="e.g., Hydro One, PG&E"
                    className="mt-1 h-9"
                  />
                </div>
                <div>
                  <Label className="text-sm">Rate Type</Label>
                  <Select
                    value={pricingConfig.rateType}
                    onValueChange={(v: any) => setPricingConfig({ ...pricingConfig, rateType: v })}
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time_of_use">Time of Use (TOU)</SelectItem>
                      <SelectItem value="fixed">Fixed Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {pricingConfig.rateType === "time_of_use" && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <Label className="text-sm font-medium">Time-of-Use Rates ($/kWh)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Off-Peak (7PM-7AM)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pricingConfig.offPeakRate}
                        onChange={(e) => setPricingConfig({ ...pricingConfig, offPeakRate: e.target.value })}
                        placeholder="0.082"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mid-Peak (7-11AM, 5-7PM)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pricingConfig.midPeakRate}
                        onChange={(e) => setPricingConfig({ ...pricingConfig, midPeakRate: e.target.value })}
                        placeholder="0.113"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">On-Peak (11AM-5PM)</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pricingConfig.onPeakRate}
                        onChange={(e) => setPricingConfig({ ...pricingConfig, onPeakRate: e.target.value })}
                        placeholder="0.170"
                        className="mt-1 h-8 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {pricingConfig.rateType === "fixed" && (
                <div className="bg-muted/40 rounded-lg p-3">
                  <Label className="text-sm font-medium">Fixed Rate ($/kWh)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={pricingConfig.offPeakRate}
                    onChange={(e) => setPricingConfig({ ...pricingConfig, offPeakRate: e.target.value })}
                    placeholder="0.120"
                    className="mt-2 h-9"
                  />
                </div>
              )}

              <div className="border-t pt-3">
                <Label className="text-sm font-medium">Demand Charges (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-2">For commercial/industrial rates</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Charge ($/kW)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pricingConfig.demandCharge}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, demandCharge: e.target.value })}
                      placeholder="15.00"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Threshold (kW)</Label>
                    <Input
                      type="number"
                      step="1"
                      value={pricingConfig.demandThreshold}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, demandThreshold: e.target.value })}
                      placeholder="100"
                      className="mt-1 h-8 text-sm"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={savePricingConfig} disabled={saving} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  {existingPricingId ? "Update Contract" : "Save Contract"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  )
}
