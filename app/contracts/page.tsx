"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import {
  DollarSign,
  Leaf,
  Save,
  Loader2,
  Plus,
  Check,
  Clock,
  Archive,
  Calendar,
  TrendingUp,
  Zap,
  FileText
} from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { format } from "date-fns"

type Site = {
  id: string
  name: string
  location: string | null
}

type Contract = {
  id: string
  siteId: string
  region: string
  utilityProvider: string
  rateType: string
  rateStructure: any
  currency: string
  demandCharge: number | null
  demandThreshold: number | null
  validFrom: string
  validTo: string | null
  active: boolean
  dataSource: string
  metadata: any
}

export default function ContractsPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [selectedSiteId, setSelectedSiteId] = useState<string>("")
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddContract, setShowAddContract] = useState(false)
  const { toast } = useToast()

  const [pricingConfig, setPricingConfig] = useState({
    utilityProvider: "",
    rateType: "Time-of-Use" as string,
    dataSource: "manual" as "manual" | "api",
    apiProvider: "",
    offPeakRate: "",
    midPeakRate: "",
    onPeakRate: "",
    demandCharge: "",
    demandThreshold: "",
    validFrom: new Date().toISOString().split('T')[0],
    validTo: "",
  })

  useEffect(() => {
    fetchSites()
  }, [])

  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id)
    }
  }, [sites, selectedSiteId])

  useEffect(() => {
    if (selectedSiteId) {
      fetchContracts(selectedSiteId)
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

  const fetchContracts = async (siteId: string) => {
    try {
      const response = await fetch(`/api/electricity-pricing?siteId=${siteId}`)
      if (response.ok) {
        const data = await response.json()
        setContracts(data)
      }
    } catch (error) {
      console.error("Error fetching contracts:", error)
    }
  }

  const resetForm = () => {
    setPricingConfig({
      utilityProvider: "",
      rateType: "Time-of-Use",
      dataSource: "manual",
      apiProvider: "",
      offPeakRate: "",
      midPeakRate: "",
      onPeakRate: "",
      demandCharge: "",
      demandThreshold: "",
      validFrom: new Date().toISOString().split('T')[0],
      validTo: "",
    })
  }

  const saveContract = async () => {
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
      if (!selectedSite || !selectedSite.location) {
        toast({
          title: "Error",
          description: "Site location is required.",
          variant: "destructive",
        })
        return
      }

      const rateStructure = {
        ratePlan: pricingConfig.rateType,
        seasons: {
          summer: {
            months: [5, 6, 7, 8, 9],
            periods: {
              onPeak: {
                hours: [[11, 17]],
                rate: parseFloat(pricingConfig.onPeakRate) || 0.151,
                label: "On-Peak"
              },
              midPeak: {
                hours: [[7, 11], [17, 19]],
                rate: parseFloat(pricingConfig.midPeakRate) || 0.102,
                label: "Mid-Peak"
              },
              offPeak: {
                hours: [[19, 7]],
                rate: parseFloat(pricingConfig.offPeakRate) || 0.074,
                label: "Off-Peak"
              }
            }
          },
          winter: {
            months: [1, 2, 3, 4, 10, 11, 12],
            periods: {
              onPeak: {
                hours: [[7, 11], [17, 19]],
                rate: parseFloat(pricingConfig.onPeakRate) || 0.151,
                label: "On-Peak"
              },
              midPeak: {
                hours: [[11, 17]],
                rate: parseFloat(pricingConfig.midPeakRate) || 0.102,
                label: "Mid-Peak"
              },
              offPeak: {
                hours: [[19, 7]],
                rate: parseFloat(pricingConfig.offPeakRate) || 0.074,
                label: "Off-Peak"
              }
            }
          }
        },
        deliveryCharges: 0.0132,
        regulatoryCharges: 0.0057,
        hst: 0.13
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
          currency: "CAD",
          demandCharge: pricingConfig.demandCharge ? parseFloat(pricingConfig.demandCharge) : null,
          demandThreshold: pricingConfig.demandThreshold ? parseFloat(pricingConfig.demandThreshold) : null,
          validFrom: new Date(pricingConfig.validFrom).toISOString(),
          validTo: pricingConfig.validTo ? new Date(pricingConfig.validTo).toISOString() : null,
          active: true,
          dataSource: pricingConfig.dataSource,
          metadata: {
            apiProvider: pricingConfig.apiProvider,
            configuredAt: new Date().toISOString(),
          }
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save contract")
      }

      toast({
        title: "Success",
        description: "Contract saved successfully",
      })

      resetForm()
      setShowAddContract(false)
      await fetchContracts(selectedSiteId)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save contract",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getContractStatus = (contract: Contract): 'active' | 'upcoming' | 'expired' => {
    const now = new Date()
    const validFrom = new Date(contract.validFrom)
    const validTo = contract.validTo ? new Date(contract.validTo) : null

    if (validFrom > now) return 'upcoming'
    if (validTo && validTo < now) return 'expired'
    return 'active'
  }

  const getContractBadge = (contract: Contract) => {
    const status = getContractStatus(contract)

    if (status === 'active') {
      return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Active</Badge>
    }
    if (status === 'upcoming') {
      return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Upcoming</Badge>
    }
    return <Badge variant="secondary"><Archive className="h-3 w-3 mr-1" />Expired</Badge>
  }

  const formatRate = (rateStructure: any): string => {
    if (!rateStructure?.seasons?.summer?.periods) return "N/A"

    const periods = rateStructure.seasons.summer.periods
    const onPeak = periods.onPeak?.rate || 0
    const midPeak = periods.midPeak?.rate || 0
    const offPeak = periods.offPeak?.rate || 0

    return `$${offPeak.toFixed(3)} - $${onPeak.toFixed(3)}/kWh`
  }

  const activeContracts = contracts.filter(c => getContractStatus(c) === 'active')
  const upcomingContracts = contracts.filter(c => getContractStatus(c) === 'upcoming')
  const historicalContracts = contracts.filter(c => getContractStatus(c) === 'expired')

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Electricity Contracts</h1>
              <p className="text-muted-foreground">
                Manage electricity pricing contracts for cost optimization
              </p>
            </div>
            <Button onClick={() => setShowAddContract(!showAddContract)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contract
            </Button>
          </div>
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
                  <h4 className="text-sm font-semibold text-blue-900">Multiple Contracts Per Site</h4>
                  <p className="text-xs text-blue-800">
                    You can configure multiple contracts per site for time-based transitions, different rate structures,
                    solar export contracts, or historical cost analysis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Site Selector */}
          {sites.length > 1 && (
            <Card>
              <CardContent className="pt-4">
                <Label className="text-sm">Select Site</Label>
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
              </CardContent>
            </Card>
          )}

          {/* Add Contract Form */}
          {showAddContract && (
            <Card className="border-green-200">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="h-5 w-5" />
                  New Contract
                </CardTitle>
                <CardDescription>Add a new electricity pricing contract</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Utility Provider *</Label>
                    <Input
                      value={pricingConfig.utilityProvider}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, utilityProvider: e.target.value })}
                      placeholder="e.g., Toronto Hydro, Alectra"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Rate Type</Label>
                    <Select
                      value={pricingConfig.rateType}
                      onValueChange={(v) => setPricingConfig({ ...pricingConfig, rateType: v })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Time-of-Use">Time-of-Use (TOU)</SelectItem>
                        <SelectItem value="Ultra-Low Overnight">Ultra-Low Overnight (ULO)</SelectItem>
                        <SelectItem value="Commercial Demand">Commercial Demand</SelectItem>
                        <SelectItem value="Feed-In Tariff">Feed-In Tariff (Solar Export)</SelectItem>
                        <SelectItem value="Fixed Rate">Fixed Rate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                  <Label className="text-sm font-medium">Time-of-Use Rates (CAD $/kWh)</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Off-Peak</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pricingConfig.offPeakRate}
                        onChange={(e) => setPricingConfig({ ...pricingConfig, offPeakRate: e.target.value })}
                        placeholder="0.074"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mid-Peak</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pricingConfig.midPeakRate}
                        onChange={(e) => setPricingConfig({ ...pricingConfig, midPeakRate: e.target.value })}
                        placeholder="0.102"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">On-Peak</Label>
                      <Input
                        type="number"
                        step="0.001"
                        value={pricingConfig.onPeakRate}
                        onChange={(e) => setPricingConfig({ ...pricingConfig, onPeakRate: e.target.value })}
                        placeholder="0.151"
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Demand Charge ($/kW)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pricingConfig.demandCharge}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, demandCharge: e.target.value })}
                      placeholder="12.85"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Demand Threshold (kW)</Label>
                    <Input
                      type="number"
                      value={pricingConfig.demandThreshold}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, demandThreshold: e.target.value })}
                      placeholder="50"
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">Valid From *</Label>
                    <Input
                      type="date"
                      value={pricingConfig.validFrom}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, validFrom: e.target.value })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Valid Until (Optional)</Label>
                    <Input
                      type="date"
                      value={pricingConfig.validTo}
                      onChange={(e) => setPricingConfig({ ...pricingConfig, validTo: e.target.value })}
                      className="mt-1"
                      placeholder="Leave blank for ongoing"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { resetForm(); setShowAddContract(false); }}>
                    Cancel
                  </Button>
                  <Button onClick={saveContract} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Contract
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contracts Tabs */}
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active" className="gap-2">
                <Zap className="h-4 w-4" />
                Active ({activeContracts.length})
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                <Calendar className="h-4 w-4" />
                Upcoming ({upcomingContracts.length})
              </TabsTrigger>
              <TabsTrigger value="historical" className="gap-2">
                <Archive className="h-4 w-4" />
                Historical ({historicalContracts.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-3 mt-4">
              {activeContracts.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No active contracts. Add one to get started.</p>
                  </CardContent>
                </Card>
              ) : (
                activeContracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} />
                ))
              )}
            </TabsContent>

            <TabsContent value="upcoming" className="space-y-3 mt-4">
              {upcomingContracts.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No upcoming contracts.</p>
                  </CardContent>
                </Card>
              ) : (
                upcomingContracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} />
                ))
              )}
            </TabsContent>

            <TabsContent value="historical" className="space-y-3 mt-4">
              {historicalContracts.length === 0 ? (
                <Card>
                  <CardContent className="pt-6 pb-6 text-center text-muted-foreground">
                    <Archive className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No historical contracts.</p>
                  </CardContent>
                </Card>
              ) : (
                historicalContracts.map((contract) => (
                  <ContractCard key={contract.id} contract={contract} />
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  )
}

// Contract Card Component
function ContractCard({ contract }: { contract: Contract }) {
  const getContractStatus = (contract: Contract): 'active' | 'upcoming' | 'expired' => {
    const now = new Date()
    const validFrom = new Date(contract.validFrom)
    const validTo = contract.validTo ? new Date(contract.validTo) : null

    if (validFrom > now) return 'upcoming'
    if (validTo && validTo < now) return 'expired'
    return 'active'
  }

  const getContractBadge = (status: 'active' | 'upcoming' | 'expired') => {
    if (status === 'active') {
      return <Badge className="bg-green-500"><Check className="h-3 w-3 mr-1" />Active</Badge>
    }
    if (status === 'upcoming') {
      return <Badge className="bg-blue-500"><Clock className="h-3 w-3 mr-1" />Upcoming</Badge>
    }
    return <Badge variant="secondary"><Archive className="h-3 w-3 mr-1" />Expired</Badge>
  }

  const formatRate = (rateStructure: any): string => {
    if (!rateStructure?.seasons?.summer?.periods) return "N/A"

    const periods = rateStructure.seasons.summer.periods
    const onPeak = periods.onPeak?.rate || 0
    const midPeak = periods.midPeak?.rate || 0
    const offPeak = periods.offPeak?.rate || 0

    return `$${offPeak.toFixed(3)} - $${onPeak.toFixed(3)}/kWh`
  }

  const status = getContractStatus(contract)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{contract.utilityProvider}</CardTitle>
                {getContractBadge(status)}
              </div>
              <CardDescription className="mt-1">
                {contract.rateType} • {contract.region}
              </CardDescription>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-green-600">{formatRate(contract.rateStructure)}</div>
            <div className="text-xs text-muted-foreground mt-1">{contract.currency}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Valid From</div>
            <div className="font-medium">{format(new Date(contract.validFrom), 'MMM d, yyyy')}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Valid Until</div>
            <div className="font-medium">{contract.validTo ? format(new Date(contract.validTo), 'MMM d, yyyy') : 'Ongoing'}</div>
          </div>
          {contract.demandCharge && (
            <div>
              <div className="text-xs text-muted-foreground">Demand Charge</div>
              <div className="font-medium">${contract.demandCharge}/kW</div>
            </div>
          )}
          <div>
            <div className="text-xs text-muted-foreground">Data Source</div>
            <div className="font-medium capitalize">{contract.dataSource}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
