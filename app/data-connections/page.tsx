"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { Sun, Activity, Battery, Zap, Save, CheckCircle2, XCircle, Loader2, Upload } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { CSVUpload } from "@/components/csv-upload"
import { InjectionValidation } from "@/components/injection-validation"
import { TrialGuard } from "@/components/trial-guard"

type Meter = {
  id: string
  name: string
  category: "CONS" | "PROD" | "STOR" | "INJ"
  siteId: string
  siteName: string
}

type EnergySource = {
  id?: string
  meterId: string
  name: string
  sourceType: string
  capacity: number | null
  metadata: Record<string, any>
  active: boolean
}

function DataConnectionsPage() {
  const [meters, setMeters] = useState<Meter[]>([])
  const [selectedCategory, setSelectedCategory] = useState<"PROD" | "CONS" | "STOR" | "INJ">("PROD")
  const [energySources, setEnergySources] = useState<Record<string, EnergySource[]>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testingConnection, setTestingConnection] = useState<Record<string, boolean>>({})
  const [showUploadFor, setShowUploadFor] = useState<string | null>(null)
  const [showValidation, setShowValidation] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    fetchMeters()
    fetchEnergySources()
  }, [])

  const fetchMeters = async () => {
    try {
      const response = await fetch("/api/meters")
      if (!response.ok) throw new Error("Failed to fetch meters")
      const data = await response.json()
      setMeters(data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load meters",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchEnergySources = async () => {
    try {
      const response = await fetch("/api/energy-sources")
      if (!response.ok) throw new Error("Failed to fetch energy sources")
      const data = await response.json()

      const grouped = data.reduce((acc: Record<string, EnergySource[]>, source: EnergySource) => {
        if (!acc[source.meterId]) acc[source.meterId] = []
        acc[source.meterId].push(source)
        return acc
      }, {})

      setEnergySources(grouped)
    } catch (error) {
      console.error("Error fetching energy sources:", error)
    }
  }

  const updateAPIMetadata = (meterId: string, index: number, key: string, value: any) => {
    setEnergySources(prev => ({
      ...prev,
      [meterId]: prev[meterId].map((source, i) =>
        i === index
          ? { ...source, metadata: { ...source.metadata, [key]: value } }
          : source
      ),
    }))
  }

  const testAPIConnection = async (meterId: string, index: number) => {
    const key = `${meterId}-${index}`
    setTestingConnection(prev => ({ ...prev, [key]: true }))

    try {
      const source = energySources[meterId][index]
      const apiProvider = source.metadata?.apiProvider

      if (!apiProvider) {
        throw new Error("Please select an API provider first")
      }

      const response = await fetch("/api/test-solar-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: apiProvider,
          credentials: {
            apiKey: source.metadata?.apiKey,
            systemId: source.metadata?.systemId,
            siteId: source.metadata?.siteId,
          },
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.message || "Connection test failed")
      }

      toast({
        title: "Success",
        description: `Connected successfully! Current power: ${result.currentPower || 0} kW`,
      })

      updateAPIMetadata(meterId, index, "lastTested", new Date().toISOString())
      updateAPIMetadata(meterId, index, "connectionStatus", "success")
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to API",
        variant: "destructive",
      })

      updateAPIMetadata(meterId, index, "connectionStatus", "failed")
    } finally {
      setTestingConnection(prev => ({ ...prev, [key]: false }))
    }
  }

  const saveConnections = async () => {
    try {
      setSaving(true)

      const allSources = Object.values(energySources).flat()

      if (allSources.length === 0) {
        toast({
          title: "No data to save",
          description: "No energy sources found to configure",
          variant: "destructive",
        })
        return
      }

      const response = await fetch("/api/energy-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: allSources }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save connections")
      }

      toast({
        title: "Success",
        description: "Data connections saved successfully",
      })

      await fetchEnergySources()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save connections",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "PROD": return <Sun className="h-5 w-5 text-orange-600" />
      case "CONS": return <Activity className="h-5 w-5 text-slate-600" />
      case "STOR": return <Battery className="h-5 w-5 text-green-600" />
      case "INJ": return <Zap className="h-5 w-5 text-purple-600" />
      default: return null
    }
  }

  const filteredMeters = meters.filter(m => m.category === selectedCategory)

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
          <h1 className="text-3xl font-bold mb-2">Data Connections</h1>
          <p className="text-muted-foreground">
            Connect and configure your energy asset data sources
          </p>
        </div>

        <Tabs value={selectedCategory} onValueChange={(v) => setSelectedCategory(v as typeof selectedCategory)}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="PROD" className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              Solar
            </TabsTrigger>
            <TabsTrigger value="CONS" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Consumption
            </TabsTrigger>
            <TabsTrigger value="STOR" className="flex items-center gap-2">
              <Battery className="h-4 w-4" />
              Storage
            </TabsTrigger>
            <TabsTrigger value="INJ" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Injection
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedCategory} className="space-y-4">
            {filteredMeters.length === 0 ? (
              <Card>
                <CardContent className="p-6">
                  <p className="text-center text-muted-foreground">
                    No {selectedCategory === "PROD" ? "solar" : selectedCategory === "CONS" ? "consumption" : selectedCategory === "STOR" ? "storage" : "injection"} meters found.
                    Create meters in the Control Room first.
                  </p>
                </CardContent>
              </Card>
            ) : (
              filteredMeters.map((meter) => {
                const hasEnergySources = energySources[meter.id] && energySources[meter.id].length > 0

                return (
                  <Card key={meter.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(meter.category)}
                          <div>
                            <CardTitle className="text-lg">{meter.name}</CardTitle>
                            <CardDescription className="text-xs">{meter.siteName}</CardDescription>
                          </div>
                        </div>
                        {selectedCategory === "INJ" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowValidation(!showValidation)}
                          >
                            {showValidation ? "Hide" : "Show"} Validation
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!hasEnergySources ? (
                        <div className="text-center py-4 text-sm text-muted-foreground">
                          <p>No energy source configured for this meter.</p>
                          <p className="text-xs mt-1">Energy sources are created automatically when you save meters in the Control Room.</p>
                        </div>
                      ) : (
                        energySources[meter.id]?.map((source, index) => (
                          <div key={index} className="space-y-3 border rounded-lg p-3 bg-muted/20">
                            {/* Basic Info Row */}
                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Source Name</Label>
                                <Input
                                  value={source.name}
                                  onChange={(e) => {
                                    setEnergySources(prev => ({
                                      ...prev,
                                      [meter.id]: prev[meter.id].map((s, i) =>
                                        i === index ? { ...s, name: e.target.value } : s
                                      ),
                                    }))
                                  }}
                                  placeholder={`e.g., Main ${selectedCategory === "PROD" ? "Solar Array" : selectedCategory === "CONS" ? "Grid Meter" : selectedCategory === "STOR" ? "Battery" : "Injection Point"}`}
                                  className="h-8 mt-1 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">
                                  {selectedCategory === "STOR" ? "Capacity (kWh)" : "Capacity (kW)"}
                                </Label>
                                <Input
                                  type="number"
                                  value={source.capacity || ""}
                                  onChange={(e) => {
                                    setEnergySources(prev => ({
                                      ...prev,
                                      [meter.id]: prev[meter.id].map((s, i) =>
                                        i === index ? { ...s, capacity: e.target.value ? parseFloat(e.target.value) : null } : s
                                      ),
                                    }))
                                  }}
                                  placeholder={selectedCategory === "STOR" ? "200" : "500"}
                                  className="h-8 mt-1 text-sm"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Data Source</Label>
                                <Select
                                  value={source.metadata?.dataSourceType || "manual"}
                                  onValueChange={(value) => updateAPIMetadata(meter.id, index, "dataSourceType", value)}
                                >
                                  <SelectTrigger className="h-8 mt-1 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {selectedCategory === "INJ" && (
                                      <SelectItem value="calculated">Auto-Calculate (Recommended)</SelectItem>
                                    )}
                                    <SelectItem value="manual">Manual Upload</SelectItem>
                                    <SelectItem value="api">API Connection</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Auto-Calculate Info for Injection */}
                            {selectedCategory === "INJ" && source.metadata?.dataSourceType === "calculated" && (
                              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs">
                                <p className="font-medium mb-1">Auto-Calculated from:</p>
                                <p className="text-muted-foreground font-mono">Injection = Production - Consumption + Battery</p>
                              </div>
                            )}

                            {/* Manual Upload Option */}
                            {source.metadata?.dataSourceType === "manual" && (
                              <div className="border-t pt-2">
                                {showUploadFor === `${meter.id}-${index}` ? (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <Label className="text-xs font-medium">Upload CSV Data</Label>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setShowUploadFor(null)}
                                        className="h-6 text-xs"
                                      >
                                        Close
                                      </Button>
                                    </div>
                                    <CSVUpload
                                      meterId={meter.id}
                                      meterName={meter.name}
                                      category={meter.category}
                                    />
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setShowUploadFor(`${meter.id}-${index}`)}
                                    className="h-7 text-xs w-full"
                                  >
                                    <Upload className="h-3 w-3 mr-1.5" />
                                    Upload CSV Data
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* API Connection Details */}
                            {source.metadata?.dataSourceType === "api" && (
                              <div className="border-t pt-2 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <Label className="text-xs">Provider</Label>
                                    <Select
                                      value={source.metadata?.apiProvider || ""}
                                      onValueChange={(v) => updateAPIMetadata(meter.id, index, "apiProvider", v)}
                                    >
                                      <SelectTrigger className="h-8 mt-1 text-sm">
                                        <SelectValue placeholder="Select..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {selectedCategory === "PROD" && (
                                          <>
                                            <SelectItem value="solaredge">SolarEdge</SelectItem>
                                            <SelectItem value="enphase">Enphase</SelectItem>
                                          </>
                                        )}
                                        {selectedCategory === "CONS" && (
                                          <>
                                            <SelectItem value="utility_api">UtilityAPI</SelectItem>
                                          </>
                                        )}
                                        {selectedCategory === "STOR" && (
                                          <>
                                            <SelectItem value="tesla">Tesla Powerwall</SelectItem>
                                          </>
                                        )}
                                        {selectedCategory === "INJ" && (
                                          <>
                                            <SelectItem value="solaredge">SolarEdge</SelectItem>
                                            <SelectItem value="fronius">Fronius</SelectItem>
                                            <SelectItem value="sma">SMA</SelectItem>
                                            <SelectItem value="enphase">Enphase</SelectItem>
                                            <SelectItem value="modbus">Modbus TCP</SelectItem>
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label className="text-xs">Update Frequency</Label>
                                    <Select
                                      value={source.metadata?.updateFrequency || "15min"}
                                      onValueChange={(v) => updateAPIMetadata(meter.id, index, "updateFrequency", v)}
                                    >
                                      <SelectTrigger className="h-8 mt-1 text-sm">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="5min">5 min</SelectItem>
                                        <SelectItem value="15min">15 min</SelectItem>
                                        <SelectItem value="30min">30 min</SelectItem>
                                        <SelectItem value="1hour">1 hour</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>

                                {source.metadata?.apiProvider && source.metadata?.apiProvider !== "modbus" && (
                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <Label className="text-xs">API Key</Label>
                                      <Input
                                        type="password"
                                        value={source.metadata?.apiKey || ""}
                                        onChange={(e) => updateAPIMetadata(meter.id, index, "apiKey", e.target.value)}
                                        placeholder="Enter API key"
                                        className="h-8 mt-1 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">
                                        {selectedCategory === "PROD" && source.metadata?.apiProvider === "solaredge" ? "Site ID" : "System ID"}
                                      </Label>
                                      <Input
                                        value={source.metadata?.systemId || ""}
                                        onChange={(e) => updateAPIMetadata(meter.id, index, "systemId", e.target.value)}
                                        placeholder="System ID"
                                        className="h-8 mt-1 text-sm"
                                      />
                                    </div>
                                  </div>
                                )}

                                {source.metadata?.apiProvider === "modbus" && (
                                  <div className="grid grid-cols-4 gap-2">
                                    <div className="col-span-2">
                                      <Label className="text-xs">Host/IP</Label>
                                      <Input
                                        value={source.metadata?.modbusHost || ""}
                                        onChange={(e) => updateAPIMetadata(meter.id, index, "modbusHost", e.target.value)}
                                        placeholder="192.168.1.100"
                                        className="h-8 mt-1 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Port</Label>
                                      <Input
                                        value={source.metadata?.modbusPort || "502"}
                                        onChange={(e) => updateAPIMetadata(meter.id, index, "modbusPort", e.target.value)}
                                        placeholder="502"
                                        className="h-8 mt-1 text-sm"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs">Unit ID</Label>
                                      <Input
                                        value={source.metadata?.modbusUnitId || "1"}
                                        onChange={(e) => updateAPIMetadata(meter.id, index, "modbusUnitId", e.target.value)}
                                        placeholder="1"
                                        className="h-8 mt-1 text-sm"
                                      />
                                    </div>
                                  </div>
                                )}

                                {source.metadata?.apiProvider && (
                                  <div className="flex items-center justify-between pt-1">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => testAPIConnection(meter.id, index)}
                                      disabled={testingConnection[`${meter.id}-${index}`]}
                                      className="h-7 text-xs"
                                    >
                                      {testingConnection[`${meter.id}-${index}`] ? "Testing..." : "Test Connection"}
                                    </Button>

                                    {source.metadata?.connectionStatus && (
                                      <div className="flex items-center gap-1.5">
                                        {source.metadata?.connectionStatus === "success" ? (
                                          <>
                                            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                            <span className="text-xs font-medium text-green-600">Connected</span>
                                          </>
                                        ) : (
                                          <>
                                            <XCircle className="h-3.5 w-3.5 text-red-600" />
                                            <span className="text-xs font-medium text-red-600">Failed</span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))
                      )}

                      {/* Validation Section for Injection */}
                      {selectedCategory === "INJ" && showValidation && (
                        <div className="border-t pt-3 mt-3">
                          <InjectionValidation
                            siteId={meter.siteId}
                            injectionMeterId={meter.id}
                            siteName={meter.siteName}
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })
            )}

            {filteredMeters.length > 0 && (
              <div className="flex justify-end pt-2">
                <Button onClick={saveConnections} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save All Connections"}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

export default function DataConnectionsPageWithGuard() {
  return (
    <TrialGuard>
      <DataConnectionsPage />
    </TrialGuard>
  )
}
