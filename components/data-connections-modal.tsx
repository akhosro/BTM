"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { CheckCircle2, XCircle, Loader2, Upload, AlertTriangle } from "lucide-react"
import { CSVUpload } from "@/components/csv-upload"

type Meter = {
  id: string
  name: string
  category: "CONS" | "PROD" | "STOR" | "INJ"
  siteId: string
  siteName?: string
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

interface DataConnectionsModalProps {
  meter: Meter | null
  isOpen: boolean
  onClose: () => void
  onSave?: () => void
}

export function DataConnectionsModal({ meter, isOpen, onClose, onSave }: DataConnectionsModalProps) {
  const [energySource, setEnergySource] = useState<EnergySource | null>(null)
  const [originalSource, setOriginalSource] = useState<EnergySource | null>(null)
  const [saving, setSaving] = useState(false)
  const [testingConnection, setTestingConnection] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const { toast } = useToast()

  // Fetch energy source when meter changes
  useEffect(() => {
    if (meter && isOpen) {
      fetchEnergySource()
    }
  }, [meter, isOpen])

  // Track changes
  useEffect(() => {
    if (energySource && originalSource) {
      const changed = JSON.stringify(energySource) !== JSON.stringify(originalSource)
      setHasChanges(changed)
    }
  }, [energySource, originalSource])

  const fetchEnergySource = async () => {
    if (!meter) return

    setLoading(true)
    try {
      const response = await fetch(`/api/energy-sources?meterId=${meter.id}`)
      if (!response.ok) throw new Error("Failed to fetch energy source")

      const data = await response.json()

      // Get the first energy source for this meter or create a default one
      let source: EnergySource
      if (data && data.length > 0) {
        source = data[0]
      } else {
        // Create default energy source structure
        source = {
          meterId: meter.id,
          name: `${meter.name} Source`,
          sourceType: meter.category,
          capacity: null,
          metadata: {
            dataSourceType: meter.category === "INJ" ? "calculated" : "manual"
          },
          active: true
        }
      }
      setEnergySource(source)
      setOriginalSource(JSON.parse(JSON.stringify(source))) // Deep copy
    } catch (error) {
      console.error("Error fetching energy source:", error)
      // Create default energy source on error
      const source: EnergySource = {
        meterId: meter.id,
        name: `${meter.name} Source`,
        sourceType: meter.category,
        capacity: null,
        metadata: {
          dataSourceType: meter.category === "INJ" ? "calculated" : "manual"
        },
        active: true
      }
      setEnergySource(source)
      setOriginalSource(JSON.parse(JSON.stringify(source)))
    } finally {
      setLoading(false)
    }
  }

  const updateMetadata = (key: string, value: any) => {
    if (!energySource) return

    setEnergySource({
      ...energySource,
      metadata: { ...energySource.metadata, [key]: value }
    })
  }

  const initiateOAuthFlow = async (provider: string) => {
    if (!energySource || !meter) {
      toast({
        title: "Error",
        description: "Please select a meter first",
        variant: "destructive",
      })
      return
    }

    try {
      // Ensure energy source has meterId
      const sourceToSave = {
        ...energySource,
        meterId: meter.id,
      }

      // First ensure the energy source exists by saving it
      const response = await fetch("/api/energy-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: [sourceToSave] }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to save energy source")
      }

      const data = await response.json()
      if (!data.sources || !Array.isArray(data.sources) || data.sources.length === 0) {
        throw new Error("No energy source returned from server")
      }

      const savedSource = data.sources[0]
      if (!savedSource?.id) {
        throw new Error("Energy source ID not returned from server")
      }

      // Redirect to OAuth initiation endpoint
      let redirectUrl = `/api/oauth/${provider}/authorize?meterId=${meter.id}&energySourceId=${savedSource.id}`

      // For UtilityAPI, add utility parameter
      if (provider === "utilityapi" && energySource.metadata?.utility) {
        redirectUrl += `&utility=${energySource.metadata.utility}`
      }

      window.location.href = redirectUrl
    } catch (error) {
      console.error("Error initiating OAuth:", error)
      toast({
        title: "OAuth Error",
        description: error instanceof Error ? error.message : "Failed to initiate OAuth flow",
        variant: "destructive",
      })
    }
  }

  const testAPIConnection = async () => {
    if (!energySource) return

    setTestingConnection(true)
    try {
      const apiProvider = energySource.metadata?.apiProvider

      if (!apiProvider) {
        throw new Error("Please select an API provider first")
      }

      const response = await fetch("/api/test-solar-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: apiProvider,
          credentials: {
            apiKey: energySource.metadata?.apiKey,
            systemId: energySource.metadata?.systemId,
            siteId: energySource.metadata?.siteId,
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

      updateMetadata("lastTested", new Date().toISOString())
      updateMetadata("connectionStatus", "success")
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to API",
        variant: "destructive",
      })

      updateMetadata("connectionStatus", "failed")
    } finally {
      setTestingConnection(false)
    }
  }

  const handleSaveClick = () => {
    if (!hasChanges) {
      onClose()
      return
    }
    setShowConfirmDialog(true)
  }

  const handleConfirmSave = async () => {
    if (!energySource || !meter) return

    setSaving(true)
    setShowConfirmDialog(false)

    try {
      const response = await fetch("/api/energy-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: [energySource] }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save connection")
      }

      toast({
        title: "Success",
        description: "Data connection saved successfully",
      })

      if (onSave) {
        onSave()
      }

      onClose()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save connection",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm("You have unsaved changes. Are you sure you want to close?")
      if (!confirmClose) return
    }
    onClose()
  }

  const getProviderOptions = () => {
    if (!meter) return []

    switch (meter.category) {
      case "PROD":
        return [
          { value: "solaredge", label: "SolarEdge" },
          { value: "enphase", label: "Enphase" },
        ]
      case "CONS":
        return [
          { value: "utility_api", label: "UtilityAPI" },
        ]
      case "STOR":
        return [
          { value: "tesla_powerwall", label: "Tesla Powerwall" },
        ]
      case "INJ":
        return [
          { value: "solaredge", label: "SolarEdge" },
          { value: "fronius", label: "Fronius" },
          { value: "sma", label: "SMA" },
          { value: "enphase", label: "Enphase" },
          { value: "modbus", label: "Modbus TCP" },
        ]
      default:
        return []
    }
  }

  const getCategoryLabel = () => {
    if (!meter) return ""
    switch (meter.category) {
      case "PROD": return "solar production"
      case "CONS": return "consumption"
      case "STOR": return "storage"
      case "INJ": return "injection"
      default: return ""
    }
  }

  if (!meter) return null

  const dataSourceType = energySource?.metadata?.dataSourceType || "manual"

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Configure Data Connection
            </DialogTitle>
            <DialogDescription>
              {meter.name} - {getCategoryLabel()} meter
              {meter.siteName && ` (${meter.siteName})`}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Data Source Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="dataSourceType">Data Source Type</Label>
                <Select
                  value={dataSourceType}
                  onValueChange={(value) => updateMetadata("dataSourceType", value)}
                >
                  <SelectTrigger id="dataSourceType">
                    <SelectValue placeholder="Select data source type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Upload</SelectItem>
                    <SelectItem value="api">API Connection</SelectItem>
                    {meter.category === "INJ" && (
                      <SelectItem value="calculated">Auto-Calculate</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Manual Upload */}
              {dataSourceType === "manual" && (
                <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label>Upload CSV Data</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUpload(!showUpload)}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {showUpload ? "Hide Upload" : "Show Upload"}
                    </Button>
                  </div>
                  {showUpload && (
                    <CSVUpload
                      onUploadComplete={() => {
                        toast({
                          title: "Success",
                          description: "CSV data uploaded successfully",
                        })
                        setShowUpload(false)
                      }}
                      meterId={meter.id}
                      meterName={meter.name}
                      category={meter.category}
                    />
                  )}
                </div>
              )}

              {/* API Connection */}
              {dataSourceType === "api" && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiProvider">API Provider</Label>
                    <Select
                      value={energySource?.metadata?.apiProvider || ""}
                      onValueChange={(value) => updateMetadata("apiProvider", value)}
                    >
                      <SelectTrigger id="apiProvider">
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProviderOptions().map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* OAuth Providers (Enphase) */}
                  {(energySource?.metadata?.apiProvider === "enphase" || energySource?.metadata?.apiProvider === "enphase_battery") ? (
                    <>
                      {energySource?.metadata?.accessToken ? (
                        <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">OAuth Connected</span>
                          </div>
                          {energySource.metadata.tokenExpiry && (
                            <p className="text-xs text-muted-foreground">
                              Token expires: {new Date(energySource.metadata.tokenExpiry).toLocaleString()}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateMetadata("accessToken", "")
                              updateMetadata("refreshToken", "")
                              updateMetadata("tokenExpiry", "")
                            }}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <p className="text-sm text-muted-foreground">
                            Enphase requires OAuth 2.0 authentication. Click below to connect your Enphase account.
                          </p>
                          <Button
                            onClick={() => initiateOAuthFlow("enphase")}
                            className="w-full"
                          >
                            Connect to Enphase
                          </Button>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="systemId">System ID</Label>
                        <Input
                          id="systemId"
                          placeholder="Enter system ID from Enphase"
                          value={energySource?.metadata?.systemId || ""}
                          onChange={(e) => updateMetadata("systemId", e.target.value)}
                        />
                      </div>
                    </>
                  ) : energySource?.metadata?.apiProvider === "tesla_powerwall" ? (
                    /* Tesla Powerwall (Local Network + Token) */
                    <>
                      {energySource?.metadata?.token ? (
                        <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">Powerwall Connected</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            IP: {energySource.metadata.powerwallIp}
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateMetadata("token", "")
                              updateMetadata("teslaEmail", "")
                            }}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-muted-foreground">
                            Tesla Powerwall requires local network access. Make sure your Powerwall is on the same network.
                          </p>

                          <div className="space-y-2">
                            <Label htmlFor="powerwallIp">Powerwall IP Address</Label>
                            <Input
                              id="powerwallIp"
                              placeholder="192.168.1.100"
                              value={energySource?.metadata?.powerwallIp || ""}
                              onChange={(e) => updateMetadata("powerwallIp", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Find this in your Tesla app or router settings
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="teslaEmail">Tesla Account Email</Label>
                            <Input
                              id="teslaEmail"
                              type="email"
                              placeholder="your.email@example.com"
                              value={energySource?.metadata?.teslaEmail || ""}
                              onChange={(e) => updateMetadata("teslaEmail", e.target.value)}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="teslaPassword">Tesla Account Password</Label>
                            <Input
                              id="teslaPassword"
                              type="password"
                              placeholder="Your Tesla account password"
                              value={energySource?.metadata?.teslaPassword || ""}
                              onChange={(e) => updateMetadata("teslaPassword", e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              Password is not stored. Used only to get access token.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : energySource?.metadata?.apiProvider === "utility_api" ? (
                    /* UtilityAPI (OAuth for utility consumption data) */
                    <>
                      {energySource?.metadata?.accessToken ? (
                        <div className="space-y-2 p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="text-green-600 font-medium">Utility Connected</span>
                          </div>
                          {energySource.metadata.utilityName && (
                            <p className="text-xs text-muted-foreground">
                              Utility: {energySource.metadata.utilityName}
                            </p>
                          )}
                          {energySource.metadata.serviceAddress && (
                            <p className="text-xs text-muted-foreground">
                              Address: {energySource.metadata.serviceAddress}
                            </p>
                          )}
                          {energySource.metadata.tokenExpiry && (
                            <p className="text-xs text-muted-foreground">
                              Token expires: {new Date(energySource.metadata.tokenExpiry).toLocaleString()}
                            </p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              updateMetadata("accessToken", "")
                              updateMetadata("refreshToken", "")
                              updateMetadata("tokenExpiry", "")
                              updateMetadata("utility", "")
                              updateMetadata("authorizationURI", "")
                              updateMetadata("authorizationUid", "")
                              updateMetadata("utilityMeterUid", "")
                            }}
                          >
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="utility">Your Utility Company</Label>
                            <Select
                              value={energySource?.metadata?.utility || ""}
                              onValueChange={(value) => updateMetadata("utility", value)}
                            >
                              <SelectTrigger id="utility">
                                <SelectValue placeholder="Select your utility" />
                              </SelectTrigger>
                              <SelectContent>
                                {/* California */}
                                <SelectItem value="pge">PG&E (Pacific Gas & Electric)</SelectItem>
                                <SelectItem value="sce">SCE (Southern California Edison)</SelectItem>
                                <SelectItem value="sdge">SDG&E (San Diego Gas & Electric)</SelectItem>

                                {/* Ontario, Canada */}
                                <SelectItem value="torontohydro">Toronto Hydro</SelectItem>
                                <SelectItem value="hydroone">Hydro One</SelectItem>
                                <SelectItem value="alectra">Alectra Utilities</SelectItem>
                                <SelectItem value="ottawahydro">Ottawa Hydro</SelectItem>
                                <SelectItem value="londonhydro">London Hydro</SelectItem>
                                <SelectItem value="enbridgegas">Enbridge Gas</SelectItem>
                                <SelectItem value="lakefront">Lakefront Utilities</SelectItem>
                                <SelectItem value="welland">Welland Hydro</SelectItem>
                                <SelectItem value="essex">Essex Powerlines</SelectItem>

                                {/* US - Other */}
                                <SelectItem value="duke">Duke Energy</SelectItem>
                                <SelectItem value="nationalgrid">National Grid</SelectItem>
                                <SelectItem value="eversource">Eversource</SelectItem>
                                <SelectItem value="commonwealth">Commonwealth Edison (ComEd)</SelectItem>
                                <SelectItem value="consumers">Consumers Energy</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              UtilityAPI uses Green Button Connect to securely access your utility consumption data.
                              Click below to authorize access through your utility company.
                            </p>
                            <Button
                              onClick={() => initiateOAuthFlow("utilityapi")}
                              className="w-full"
                              disabled={!energySource?.metadata?.utility}
                            >
                              Connect to {energySource?.metadata?.utility ? energySource.metadata.utility.toUpperCase() : "Utility"}
                            </Button>
                            {!energySource?.metadata?.utility && (
                              <p className="text-xs text-amber-600">
                                Please select your utility company first
                              </p>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : (
                    /* API Key Providers (SolarEdge, etc.) */
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="apiKey">API Key</Label>
                        <Input
                          id="apiKey"
                          type="password"
                          placeholder="Enter API key"
                          value={energySource?.metadata?.apiKey || ""}
                          onChange={(e) => updateMetadata("apiKey", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="systemId">System ID</Label>
                        <Input
                          id="systemId"
                          placeholder="Enter system ID"
                          value={energySource?.metadata?.systemId || ""}
                          onChange={(e) => updateMetadata("systemId", e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="siteId">Site ID (if applicable)</Label>
                        <Input
                          id="siteId"
                          placeholder="Enter site ID"
                          value={energySource?.metadata?.siteId || ""}
                          onChange={(e) => updateMetadata("siteId", e.target.value)}
                        />
                      </div>
                    </>
                  )}

                  {/* Connection Status */}
                  {energySource?.metadata?.connectionStatus && (
                    <div className="flex items-center gap-2 text-sm">
                      {energySource.metadata.connectionStatus === "success" ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                          <span className="text-green-600">Connected</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-red-600">Connection Failed</span>
                        </>
                      )}
                      {energySource.metadata.lastTested && (
                        <span className="text-muted-foreground ml-2">
                          Last tested: {new Date(energySource.metadata.lastTested).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={testAPIConnection}
                    disabled={testingConnection || !energySource?.metadata?.apiProvider}
                    className="w-full"
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                </div>
              )}

              {/* Auto-Calculate (for Injection) */}
              {dataSourceType === "calculated" && meter.category === "INJ" && (
                <div className="rounded-lg border p-4 bg-blue-50 dark:bg-blue-950/30">
                  <p className="text-sm text-muted-foreground">
                    Grid injection will be automatically calculated as: Production - Consumption - Storage
                  </p>
                </div>
              )}

              {/* Capacity */}
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity (kW)</Label>
                <Input
                  id="capacity"
                  type="number"
                  step="0.1"
                  placeholder="Enter capacity"
                  value={energySource?.capacity || ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : parseFloat(e.target.value)
                    setEnergySource(energySource ? { ...energySource, capacity: value } : null)
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveClick}
              disabled={saving || loading}
              className={hasChanges ? "bg-primary" : ""}
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : hasChanges ? (
                "Save Changes"
              ) : (
                "Close"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Changes
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to save these data connection changes for <strong>{meter.name}</strong>?
              This will update how data is collected for this meter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmSave}>
              Yes, Save Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
