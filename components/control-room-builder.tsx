"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sun,
  Battery,
  Loader2,
  Building2,
  Activity,
  Plus,
  X,
  ChevronRight,
  Save,
  Settings,
  Edit,
} from "lucide-react"
import { DataConnectionsModal } from "./data-connections-modal"
import { useToast } from "@/hooks/use-toast"
import * as d3 from "d3-hierarchy"
import { select } from "d3-selection"
import { linkHorizontal } from "d3-shape"
import type { EnergySource, Meter, Site, CanvasItem } from "./control-room/types"
import * as ControlRoomUtils from "./control-room/utils"

export function ControlRoomBuilder() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sites, setSites] = useState<Site[]>([])
  const [canvasItems, setCanvasItems] = useState<CanvasItem[]>([])
  const [selectedItem, setSelectedItem] = useState<CanvasItem | null>(null)
  const [showExpansionDialog, setShowExpansionDialog] = useState(false)
  const [showNewSiteDialog, setShowNewSiteDialog] = useState(false)
  const [newSiteName, setNewSiteName] = useState("")
  const [newSiteLocation, setNewSiteLocation] = useState("")
  const [newSiteLatitude, setNewSiteLatitude] = useState("")
  const [newSiteLongitude, setNewSiteLongitude] = useState("")

  // Edit Mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [showDataConnectionsSidebar, setShowDataConnectionsSidebar] = useState(false)
  const [selectedMeterForConnections, setSelectedMeterForConnections] = useState<Meter | null>(null)

  // New meter addition states
  const [showAddMeterDialog, setShowAddMeterDialog] = useState(false)
  const [meterNames, setMeterNames] = useState<string[]>([""])
  const [meterType, setMeterType] = useState<"CONS" | "PROD" | "STOR" | "INJ">("CONS")
  const [saving, setSaving] = useState(false)

  const canvasRef = useRef<HTMLDivElement>(null)

  // Selected line state - tracks which connection line is selected
  const [selectedLine, setSelectedLine] = useState<{ startId: string; endId: string } | null>(null)
  const [showConnectionDialog, setShowConnectionDialog] = useState(false)
  const [connectionInfo, setConnectionInfo] = useState<{ start: CanvasItem | null; end: CanvasItem | null }>({ start: null, end: null })

  // Track deleted items that need to be removed from database
  const [deletedSiteIds, setDeletedSiteIds] = useState<string[]>([])
  const [deletedMeterIds, setDeletedMeterIds] = useState<string[]>([])

  // Rename functionality
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState<string>("")

  const fetchPortfolios = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/portfolios")
      if (!response.ok) throw new Error("Failed to fetch sites")
      const data: Site[] = await response.json()
      setSites(data)

      // Load existing sites and meters into canvas
      const items: CanvasItem[] = []
      const meterMap = new Map<string, Meter>()

      data.forEach((site: Site) => {
        // Add site to canvas
        items.push({
          id: `site-${site.id}`,
          level: 1,
          type: "site",
          data: site,
          name: site.name,
        })

        // Build meter map for hierarchy resolution
        site.meters.forEach((meter: Meter) => {
          meterMap.set(meter.id, meter)
        })
      })

      // Build meter hierarchy by traversing parent relationships
      const calculateMeterLevel = (meter: Meter): number => {
        if (!meter.parentMeterId) return 2 // Top-level meters under site
        const parentMeter = meterMap.get(meter.parentMeterId)
        if (!parentMeter) return 2
        return calculateMeterLevel(parentMeter) + 1
      }

      // Add all meters to canvas with correct levels and parent IDs
      data.forEach((site: Site) => {
        site.meters.forEach((meter: Meter) => {
          const level = calculateMeterLevel(meter)
          const parentId = meter.parentMeterId
            ? `meter-${meter.parentMeterId}`
            : `site-${site.id}`

          items.push({
            id: `meter-${meter.id}`,
            level: level,
            type: "meter",
            data: meter,
            name: meter.name,
            parentId: parentId,
          })
        })
      })

      setCanvasItems(items)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching sites:", error)
      toast({
        title: "Error Loading Data",
        description: "Failed to load energy infrastructure.",
        variant: "destructive",
      })
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPortfolios()
  }, [fetchPortfolios])

  const handleCreateNewSite = () => {
    if (!newSiteName.trim()) {
      toast({
        title: "Name Required",
        description: "Please enter a site name.",
        variant: "destructive",
      })
      return
    }

    // Validate coordinates if provided
    if (newSiteLatitude) {
      const lat = parseFloat(newSiteLatitude)
      if (isNaN(lat) || lat < -90 || lat > 90) {
        toast({
          title: "Invalid Latitude",
          description: "Latitude must be between -90 and 90.",
          variant: "destructive",
        })
        return
      }
    }

    if (newSiteLongitude) {
      const lon = parseFloat(newSiteLongitude)
      if (isNaN(lon) || lon < -180 || lon > 180) {
        toast({
          title: "Invalid Longitude",
          description: "Longitude must be between -180 and 180.",
          variant: "destructive",
        })
        return
      }
    }

    // Check that if one coordinate is provided, both must be provided
    if ((newSiteLatitude && !newSiteLongitude) || (!newSiteLatitude && newSiteLongitude)) {
      toast({
        title: "Incomplete Coordinates",
        description: "Please provide both latitude and longitude, or leave both empty.",
        variant: "destructive",
      })
      return
    }

    const tempSite: Site = {
      id: `temp-${Date.now()}`,
      name: newSiteName,
      location: newSiteLocation || null,
      latitude: newSiteLatitude ? parseFloat(newSiteLatitude) : null,
      longitude: newSiteLongitude ? parseFloat(newSiteLongitude) : null,
      industryType: "other",
      metadata: {},
      active: true,
      meters: [],
    }

    const newItem: CanvasItem = {
      id: `site-${tempSite.id}`,
      level: 1,
      type: "site",
      data: tempSite,
      name: tempSite.name,
    }

    setCanvasItems(prev => [...prev, newItem])
    setShowNewSiteDialog(false)
    setNewSiteName("")
    setNewSiteLocation("")
    setNewSiteLatitude("")
    setNewSiteLongitude("")

    toast({
      title: "Site Created",
      description: `${tempSite.name} has been added to the canvas.`,
    })
  }

  const handleAddMeters = () => {
    if (!selectedItem) return

    const validMeterNames = meterNames.filter(name => name.trim() !== "")

    if (validMeterNames.length === 0) {
      toast({
        title: "No Meters",
        description: "Please enter at least one meter name.",
        variant: "destructive",
      })
      return
    }

    // Determine the siteId based on parent type
    let siteId: string
    if (selectedItem.type === "site") {
      siteId = (selectedItem.data as Site).id
    } else if (selectedItem.type === "meter") {
      siteId = (selectedItem.data as Meter).siteId
    } else {
      return
    }

    const newMeters: Meter[] = validMeterNames.map(name => ({
      id: `temp-meter-${Date.now()}-${Math.random()}`,
      siteId: siteId,
      name: name.trim(),
      category: meterType,
      capacity: null,
      readingFrequency: "15min",
      metadata: {},
      active: true,
      energySources: [],
      assets: [],
    }))

    // If parent is a site, update the site's meters array
    if (selectedItem.type === "site") {
      const site = selectedItem.data as Site
      const updatedSite: Site = {
        ...site,
        meters: [...site.meters, ...newMeters],
      }

      setCanvasItems(prev =>
        prev.map(item =>
          item.id === selectedItem.id
            ? { ...item, data: updatedSite }
            : item
        )
      )
    }

    // Add meter items to canvas
    const newMeterItems: CanvasItem[] = newMeters.map(meter => ({
      id: `meter-${meter.id}`,
      level: selectedItem.level + 1,
      type: "meter",
      data: meter,
      name: meter.name,
      parentId: selectedItem.id,
    }))

    setCanvasItems(prev => [...prev, ...newMeterItems])

    setShowAddMeterDialog(false)
    setMeterNames([""])
    setMeterType("CONS")

    const parentName = selectedItem.name
    toast({
      title: "Meters Added",
      description: `${newMeters.length} ${newMeters.length === 1 ? "meter" : "meters"} added to ${parentName}.`,
    })
  }

  const handleStartRename = (item: CanvasItem) => {
    setEditingItemId(item.id)
    setEditingName(item.name)
  }

  const handleFinishRename = () => {
    if (editingItemId && editingName.trim()) {
      setCanvasItems(prev => prev.map(item => {
        if (item.id === editingItemId) {
          return {
            ...item,
            name: editingName.trim(),
            data: {
              ...item.data,
              name: editingName.trim()
            }
          }
        }
        return item
      }))
    }
    setEditingItemId(null)
    setEditingName("")
  }

  const handleCancelRename = () => {
    setEditingItemId(null)
    setEditingName("")
  }

  const handleRemoveItem = (itemId: string) => {
    setCanvasItems(prev => {
      const itemToRemove = prev.find(i => i.id === itemId)
      if (!itemToRemove) return prev

      // Collect all items to be removed (item + descendants)
      const itemsToRemove: CanvasItem[] = []

      const collectItems = (id: string) => {
        const item = prev.find(i => i.id === id)
        if (item) {
          itemsToRemove.push(item)
          // Find all children
          const children = prev.filter(i => i.parentId === id)
          children.forEach(child => collectItems(child.id))
        }
      }

      collectItems(itemId)

      // Track IDs to delete from database (only non-temp items)
      itemsToRemove.forEach(item => {
        if (item.type === "site") {
          const site = item.data as Site
          if (!site.id.startsWith("temp-")) {
            setDeletedSiteIds(prev => [...prev, site.id])
          }
        } else if (item.type === "meter") {
          const meter = item.data as Meter
          if (!meter.id.startsWith("temp-")) {
            setDeletedMeterIds(prev => [...prev, meter.id])
          }
        }
      })

      return prev.filter(item => {
        if (item.id === itemId) return false
        let current = item
        while (current.parentId) {
          if (current.parentId === itemId) return false
          current = prev.find(i => i.id === current.parentId)!
          if (!current) break
        }
        return true
      })
    })
  }

  const handleOpenAddMeters = (item: CanvasItem) => {
    setSelectedItem(item)
    setMeterNames([""])
    setMeterType("CONS")
    setShowAddMeterDialog(true)
  }

  const handleSaveCanvas = async () => {
    try {
      setSaving(true)

      // Extract sites and meters from canvas items
      const sitesToSave = canvasItems
        .filter(item => item.type === "site")
        .map(item => {
          const site = item.data as Site
          return {
            id: site.id.startsWith("temp-") ? undefined : site.id,
            tempId: site.id.startsWith("temp-") ? site.id : undefined,
            name: site.name,
            location: site.location,
            latitude: site.latitude,
            longitude: site.longitude,
            industryType: site.industryType,
            metadata: site.metadata,
            active: site.active,
          }
        })

      const metersToSave = canvasItems
        .filter(item => item.type === "meter")
        .map(item => {
          const meter = item.data as Meter

          // Find the root site by traversing up the parent chain
          let currentItem = item
          let siteId = meter.siteId
          let parentMeterId: string | null = null

          // Check if the direct parent is a meter (not a site)
          if (item.parentId && !item.parentId.startsWith("site-")) {
            const parentMeter = canvasItems.find(ci => ci.id === item.parentId)
            if (parentMeter && parentMeter.type === "meter") {
              const parentMeterData = parentMeter.data as Meter
              parentMeterId = parentMeterData.id.startsWith("temp-") ? null : parentMeterData.id
            }
          }

          while (currentItem.parentId) {
            const parent = canvasItems.find(ci => ci.id === currentItem.parentId)
            if (!parent) break

            if (parent.type === "site") {
              const site = parent.data as Site
              siteId = site.id
              break
            }
            currentItem = parent
          }

          return {
            id: meter.id.startsWith("temp-") ? undefined : meter.id,
            tempId: meter.id.startsWith("temp-") ? meter.id : undefined,
            siteId: siteId,
            parentMeterId: parentMeterId,
            name: meter.name,
            category: meter.category,
            readingFrequency: meter.readingFrequency,
            capacity: meter.capacity,
            metadata: meter.metadata,
            active: meter.active,
          }
        })

      // Save to database (including deletions)
      const response = await fetch("/api/control-room/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sites: sitesToSave,
          meters: metersToSave,
          deletedSiteIds,
          deletedMeterIds
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to save canvas")
      }

      const result = await response.json()

      // Update canvas items with real IDs from database
      const updatedItems = canvasItems.map(item => {
        if (item.type === "site") {
          const site = item.data as Site
          const savedSite = result.sites.find((s: any) => s.name === site.name)
          if (savedSite) {
            return {
              ...item,
              id: `site-${savedSite.id}`,
              data: { ...site, id: savedSite.id }
            }
          }
        } else if (item.type === "meter") {
          const meter = item.data as Meter
          const savedMeter = result.meters.find((m: any) => m.name === meter.name)
          if (savedMeter) {
            return {
              ...item,
              id: `meter-${savedMeter.id}`,
              data: { ...meter, id: savedMeter.id, siteId: savedMeter.siteId }
            }
          }
        }
        return item
      })

      setCanvasItems(updatedItems)

      // Clear deleted IDs after successful save
      setDeletedSiteIds([])
      setDeletedMeterIds([])

      toast({
        title: "Canvas Saved",
        description: "Your control room has been saved successfully.",
      })

      // Refresh data
      await fetchPortfolios()
    } catch (error) {
      console.error("Error saving canvas:", error)
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save canvas",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading energy infrastructure...</p>
        </div>
      </div>
    )
  }

  const maxLevel = Math.max(...canvasItems.map(i => i.level), 0)
  const columns: CanvasItem[][] = []
  for (let level = 1; level <= maxLevel; level++) {
    columns.push(canvasItems.filter(i => i.level === level))
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Control Room</h1>
          <p className="text-muted-foreground mt-1">Build your energy flow visualization</p>
        </div>
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleSaveCanvas}
                disabled={saving || canvasItems.length === 0}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? "Saving..." : "Save Canvas"}
              </Button>
              <Button className="gap-2" onClick={() => setShowNewSiteDialog(true)}>
                <Plus className="h-4 w-4" />
                Add New Site
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsEditMode(false)}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Done Editing
              </Button>
            </>
          ) : (
            <Button
              onClick={() => setIsEditMode(true)}
              className="gap-2"
            >
              <Edit className="h-4 w-4" />
              Edit Layout
            </Button>
          )}
        </div>
      </div>

      {/* New Site Dialog */}
      <Dialog open={showNewSiteDialog} onOpenChange={setShowNewSiteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Site</DialogTitle>
            <DialogDescription>
              Add a new site to your control room
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site Name *</Label>
              <Input
                id="site-name"
                placeholder="e.g., Belgium Data Center"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-location">Location</Label>
              <Input
                id="site-location"
                placeholder="e.g., Brussels"
                value={newSiteLocation}
                onChange={(e) => setNewSiteLocation(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-latitude">
                Latitude
                <span className="text-xs text-muted-foreground ml-1">Optional</span>
              </Label>
              <Input
                id="site-latitude"
                type="number"
                placeholder="e.g., 50.8503"
                value={newSiteLatitude}
                onChange={(e) => setNewSiteLatitude(e.target.value)}
                step="0.0001"
                min="-90"
                max="90"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-longitude">
                Longitude
                <span className="text-xs text-muted-foreground ml-1">Optional</span>
              </Label>
              <Input
                id="site-longitude"
                type="number"
                placeholder="e.g., 4.3517"
                value={newSiteLongitude}
                onChange={(e) => setNewSiteLongitude(e.target.value)}
                step="0.0001"
                min="-180"
                max="180"
              />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowNewSiteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateNewSite}>
              Create Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Meters Dialog */}
      <Dialog open={showAddMeterDialog} onOpenChange={setShowAddMeterDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Meters to {selectedItem?.name}</DialogTitle>
            <DialogDescription>
              Add multiple meters at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Meter Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={meterType === "CONS" ? "default" : "outline"}
                  onClick={() => setMeterType("CONS")}
                  className="justify-start"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Consumption
                </Button>
                <Button
                  variant={meterType === "PROD" ? "default" : "outline"}
                  onClick={() => setMeterType("PROD")}
                  className="justify-start"
                >
                  <Sun className="h-4 w-4 mr-2" />
                  Production
                </Button>
                <Button
                  variant={meterType === "STOR" ? "default" : "outline"}
                  onClick={() => setMeterType("STOR")}
                  className="justify-start"
                >
                  <Battery className="h-4 w-4 mr-2" />
                  Storage
                </Button>
                <Button
                  variant={meterType === "INJ" ? "default" : "outline"}
                  onClick={() => setMeterType("INJ")}
                  className="justify-start"
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Injection
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Meter Names</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMeterNames([...meterNames, ""])}
                  className="h-8 gap-1"
                >
                  <Plus className="h-3 w-3" />
                  Add More
                </Button>
              </div>
              <ScrollArea className="max-h-[300px]">
                <div className="space-y-2 pr-2">
                  {meterNames.map((name, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Meter ${index + 1}`}
                        value={name}
                        onChange={(e) => {
                          const newNames = [...meterNames]
                          newNames[index] = e.target.value
                          setMeterNames(newNames)
                        }}
                      />
                      {meterNames.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setMeterNames(meterNames.filter((_, i) => i !== index))
                          }}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAddMeterDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMeters}>
              Add Meters
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expand Meter Dialog */}
      <Dialog open={showExpansionDialog} onOpenChange={setShowExpansionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Expand {selectedItem?.name}</DialogTitle>
            <DialogDescription>
              Add child meters, energy sources or assets to this meter
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => {
                  setShowExpansionDialog(false)
                  handleOpenAddMeters(selectedItem!)
                }}
              >
                <Activity className="h-6 w-6" />
                <span className="text-xs">Child Meters</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => {
                  toast({
                    title: "Coming Soon",
                    description: "Energy source management will be available soon.",
                  })
                }}
              >
                <Sun className="h-6 w-6" />
                <span className="text-xs">Energy Source</span>
              </Button>
              <Button
                variant="outline"
                className="h-20 flex-col gap-2"
                onClick={() => {
                  toast({
                    title: "Coming Soon",
                    description: "Asset management will be available soon.",
                  })
                }}
              >
                <Battery className="h-6 w-6" />
                <span className="text-xs">Asset</span>
              </Button>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowExpansionDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connection Info Dialog */}
      <Dialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connection Details</DialogTitle>
            <DialogDescription>
              View the flow direction between connected items
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Start Item */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex-shrink-0">
                {connectionInfo.start?.type === "site" ? (
                  <Building2 className="h-6 w-6 text-blue-600" />
                ) : (
                  <Activity className="h-6 w-6 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-semibold">From (Parent)</p>
                <p className="font-medium text-sm truncate">{connectionInfo.start?.name || 'Unknown'}</p>
                {connectionInfo.start?.type === "meter" && (
                  <p className="text-xs text-muted-foreground">
                    {((connectionInfo.start.data as Meter).category)}
                  </p>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="h-px w-12 bg-gradient-to-r from-blue-400 to-green-400"></div>
                <ChevronRight className="h-6 w-6 text-green-600" />
                <div className="h-px w-12 bg-gradient-to-r from-blue-400 to-green-400"></div>
              </div>
            </div>

            {/* End Item */}
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex-shrink-0">
                {connectionInfo.end?.type === "site" ? (
                  <Building2 className="h-6 w-6 text-blue-600" />
                ) : (
                  <Activity className="h-6 w-6 text-slate-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground uppercase font-semibold">To (Child)</p>
                <p className="font-medium text-sm truncate">{connectionInfo.end?.name || 'Unknown'}</p>
                {connectionInfo.end?.type === "meter" && (
                  <p className="text-xs text-muted-foreground">
                    {((connectionInfo.end.data as Meter).category)}
                  </p>
                )}
              </div>
            </div>

            {/* Flow Direction Info */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-muted-foreground mb-1 font-semibold">Flow Direction:</p>
              <p className="text-sm">
                Energy flows from <span className="font-semibold text-blue-600">{connectionInfo.start?.name}</span> to <span className="font-semibold text-green-600">{connectionInfo.end?.name}</span>
              </p>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => {
              setShowConnectionDialog(false)
              setSelectedLine(null)
            }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Main Canvas */}
      <Card>
        <CardContent className="p-6">
          {canvasItems.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <p className="text-muted-foreground mb-4">
                No sites on canvas yet
              </p>
              <Button onClick={() => setShowNewSiteDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Your First Site
              </Button>
            </div>
          ) : (
            <div
              ref={canvasRef}
              className="relative min-h-[600px] h-[800px] overflow-auto border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/30 p-4"
              onClick={() => setSelectedLine(null)}
            >
              {/* SVG Connection Lines Layer */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1, minWidth: '2000px', minHeight: '2000px' }}>
                <defs>
                  {/* Define arrowhead markers for line endpoints */}
                  <marker id="dot-start" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
                    <circle cx="5" cy="5" r="4" fill="currentColor" opacity="0.8" />
                  </marker>
                  <marker id="dot-end" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6">
                    <circle cx="5" cy="5" r="4" fill="currentColor" opacity="0.8" />
                  </marker>
                </defs>

                {/* Lines from Sites to Level 2 Meter Groups - draw line to each individual meter */}
                {canvasItems.filter(item => item.type === "site").flatMap((siteItem, siteIdx) => {
                  const site = siteItem.data as Site
                  const meterGroups = ControlRoomUtils.getMeterGroups(site.id, canvasItems)
                  const siteX = siteItem.position?.x ?? (50)

                  // Calculate Y position accounting for all previous sites and their descendants
                  let defaultSiteY = 50
                  const allSites = canvasItems.filter(item => item.type === "site")
                  for (let i = 0; i < siteIdx; i++) {
                    const prevSite = allSites[i].data as Site
                    const siteCardHeight = 80
                    defaultSiteY += siteCardHeight + 20

                    const descendantsHeight = ControlRoomUtils.calculateSiteTotalHeight(prevSite.id, canvasItems)
                    defaultSiteY += descendantsHeight
                  }

                  const siteY = siteItem.position?.y ?? defaultSiteY
                  const siteWidth = 180
                  const siteHeight = 80
                  const siteCenterX = siteX + siteWidth
                  const siteCenterY = siteY + siteHeight / 2

                  // Draw a line to each individual meter in each group
                  return Object.entries(meterGroups).flatMap(([category, meters], groupIdx) => {
                    const groupId = `${site.id}-${category}`

                    const headerHeight = 28
                    const meterItemHeight = 28
                    const minMeterSpacing = 8

                    // Stack cards with proper spacing that accounts for each meter's children (same as rendering)
                    let cumulativeY = siteY
                    for (let i = 0; i < groupIdx; i++) {
                      const prevCategories = Object.entries(meterGroups)
                      if (i < prevCategories.length) {
                        const prevMeters = prevCategories[i][1]

                        // Add header height for the previous category card
                        cumulativeY += headerHeight

                        // For each meter in the previous category, allocate vertical space
                        prevMeters.forEach((prevMeter) => {
                          const childrenHeight = ControlRoomUtils.calculateTotalHeight(prevMeter.id, canvasItems)
                          const requiredHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing
                          cumulativeY += requiredHeight
                        })

                        // Add gap between category cards
                        cumulativeY += 16
                      }
                    }

                    const defaultX = siteX + 280
                    const defaultY = cumulativeY

                    // Check if this group has been dragged to a custom position
                    const existingGroupItem = canvasItems.find(item => item.id === groupId)
                    const groupX = existingGroupItem?.position?.x ?? defaultX
                    const groupY = existingGroupItem?.position?.y ?? defaultY

                    const lineColor =
                      category === "CONS" ? "#64748b" :
                      category === "PROD" ? "#f97316" :
                      category === "STOR" ? "#22c55e" :
                      "#a855f7"

                    // Draw a line to each meter in this group
                    // Calculate accumulated Y offset for each meter based on previous meters' space requirements
                    let accumulatedMeterY = 0
                    return meters.map((meterItem, meterIdx) => {
                      // Calculate the Y position of this specific meter within the group
                      // Account for previous meters' allocated space (row height or children height, whichever is larger)
                      if (meterIdx > 0) {
                        const prevMeter = meters[meterIdx - 1]
                        const prevChildrenHeight = ControlRoomUtils.calculateTotalHeight(prevMeter.id, canvasItems)
                        const prevRequiredHeight = Math.max(meterItemHeight, prevChildrenHeight) + minMeterSpacing
                        accumulatedMeterY += prevRequiredHeight
                      }

                      // Account for header height + border (1px)
                      const meterRowY = groupY + headerHeight + 1 + accumulatedMeterY
                      // Calculate the allocated height for this meter (either row height or children height)
                      const currentChildrenHeight = ControlRoomUtils.calculateTotalHeight(meterItem.id, canvasItems)
                      const currentRequiredHeight = Math.max(meterItemHeight, currentChildrenHeight)
                      // Center the line vertically within the allocated space
                      const meterRowCenterY = meterRowY + (currentRequiredHeight / 2)

                      // End line at the card's left edge
                      const lineEndX = groupX

                      // Calculate Bezier curve control points
                      const controlX = (siteCenterX + lineEndX) / 2
                      const pathD = `M ${siteCenterX},${siteCenterY} C ${controlX},${siteCenterY} ${controlX},${meterRowCenterY} ${lineEndX},${meterRowCenterY}`

                      const startId = siteItem.id
                      const endId = meterItem.id
                      const isSelected = selectedLine?.startId === startId && selectedLine?.endId === endId

                      return (
                        <g
                          key={`line-${site.id}-${meterItem.id}`}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLine({ startId, endId })

                            // Show dialog with connection info
                            const startItem = canvasItems.find(item => item.id === startId)
                            const endItem = canvasItems.find(item => item.id === endId)
                            setConnectionInfo({ start: startItem || null, end: endItem || null })
                            setShowConnectionDialog(true)
                          }}
                        >
                          {/* Invisible wider path for easier clicking */}
                          <path
                            d={pathD}
                            stroke="transparent"
                            strokeWidth="12"
                            fill="none"
                            style={{ pointerEvents: 'all' }}
                          />
                          {/* Visible path */}
                          <path
                            d={pathD}
                            stroke={lineColor}
                            strokeWidth={isSelected ? "4" : "2"}
                            fill="none"
                            opacity={isSelected ? "1" : "0.6"}
                            style={{ pointerEvents: 'none' }}
                          />
                          {/* Start dot */}
                          <circle
                            cx={siteCenterX}
                            cy={siteCenterY}
                            r={isSelected ? "6" : "4"}
                            fill={lineColor}
                            opacity={isSelected ? "1" : "0.8"}
                            style={{ pointerEvents: 'none' }}
                          />
                          {/* End dot */}
                          <circle
                            cx={lineEndX}
                            cy={meterRowCenterY}
                            r={isSelected ? "6" : "4"}
                            fill={lineColor}
                            opacity={isSelected ? "1" : "0.8"}
                            style={{ pointerEvents: 'none' }}
                          />
                        </g>
                      )
                    })
                  })
                })}

                {/* Lines from Parent Meters to Child Meter Groups (Level 2 to 3+) - draw line to each individual meter */}
                {canvasItems.filter(item => item.type === "meter" && item.parentId && !item.parentId.startsWith("site-")).map(item => item.parentId).filter((value, index, self) => self.indexOf(value) === index).flatMap((parentMeterId) => {
                  const parentMeterGroups = ControlRoomUtils.getMeterGroupsByParent(parentMeterId!, canvasItems)
                  const parentMeterItem = canvasItems.find(item => item.id === parentMeterId)

                  if (!parentMeterItem) return []

                  // Get the parent meter's position within its group card
                  // This function returns the exact Y position of the parent meter row
                  // and already accounts for all vertical spacing in the parent card
                  const parentGroupPos = ControlRoomUtils.getParentMeterPosition(parentMeterItem, canvasItems)

                  // Calculate cumulative Y offset from previous sibling meters' descendants
                  // This is crucial for avoiding overlap when multiple siblings have children
                  let siblingsDescendantsOffset = 0
                  const grandparentId = parentMeterItem.parentId
                  if (grandparentId && !grandparentId.startsWith("site-")) {
                    // Get all sibling meters (meters with same parent and category)
                    const parentCategory = (parentMeterItem.data as Meter).category
                    const siblings = canvasItems.filter(item =>
                      item.type === "meter" &&
                      item.parentId === grandparentId &&
                      (item.data as Meter).category === parentCategory
                    ).sort((a, b) => a.id.localeCompare(b.id))

                    const parentIndex = siblings.findIndex(s => s.id === parentMeterItem.id)

                    // Add cumulative height of all previous siblings' descendants
                    for (let i = 0; i < parentIndex; i++) {
                      const siblingDescendantsHeight = ControlRoomUtils.calculateTotalHeight(siblings[i].id, canvasItems)
                      if (siblingDescendantsHeight > 0) {
                        siblingsDescendantsOffset += siblingDescendantsHeight
                      }
                    }
                  }

                  // Draw a line to each individual meter in each child group
                  return Object.entries(parentMeterGroups).flatMap(([category, meters], groupIdx) => {
                    const groupId = `${parentMeterItem.id}-${category}`

                    const headerHeight = 28
                    const meterItemHeight = 28
                    const minMeterSpacing = 8

                    // Start with the parent meter's Y position and add siblings' descendants offset for CHILD positioning only
                    let cumulativeY = parentGroupPos.y + siblingsDescendantsOffset

                    // Add spacing for previous category groups of this parent
                    for (let i = 0; i < groupIdx; i++) {
                      const prevCategories = Object.entries(parentMeterGroups)
                      if (i < prevCategories.length) {
                        const prevMeters = prevCategories[i][1]

                        // Add header height for previous group
                        cumulativeY += headerHeight

                        // For each meter in previous group, add its allocated space
                        prevMeters.forEach((prevMeter) => {
                          const childrenHeight = ControlRoomUtils.calculateTotalHeight(prevMeter.id, canvasItems)
                          const requiredHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing
                          cumulativeY += requiredHeight
                        })

                        // Add gap between category cards
                        cumulativeY += 16
                      }
                    }

                    const defaultX = parentGroupPos.x + 250
                    const defaultY = cumulativeY

                    const existingItem = canvasItems.find(item => item.id === groupId)
                    const groupX = existingItem?.position?.x ?? defaultX
                    const groupY = existingItem?.position?.y ?? defaultY

                    // Standard width for meter group cards
                    const groupCardWidth = 200

                    // Start from the right edge of the parent meter's group card
                    const parentMeterRightX = parentGroupPos.x + groupCardWidth

                    // parentGroupPos.y already gives us the TOP of the specific meter row
                    // Calculate the allocated height for the parent meter (either row height or children height)
                    const parentChildrenHeight = ControlRoomUtils.calculateTotalHeight(parentMeterItem.id, canvasItems)
                    const parentRequiredHeight = Math.max(meterItemHeight, parentChildrenHeight)
                    // Center the line vertically within the allocated space
                    const parentMeterCenterY = parentGroupPos.y + (parentRequiredHeight / 2)

                    const lineColor =
                      category === "CONS" ? "#64748b" :
                      category === "PROD" ? "#f97316" :
                      category === "STOR" ? "#22c55e" :
                      "#a855f7"

                    // Draw a line to each child meter in this group
                    let accumulatedChildMeterY = 0
                    return meters.map((childMeterItem, meterIdx) => {
                      // Calculate the Y position of this specific child meter within the group
                      // Account for previous meters' allocated space (row height or children height, whichever is larger)
                      if (meterIdx > 0) {
                        const prevMeter = meters[meterIdx - 1]
                        const prevChildrenHeight = ControlRoomUtils.calculateTotalHeight(prevMeter.id, canvasItems)
                        const prevRequiredHeight = Math.max(meterItemHeight, prevChildrenHeight) + minMeterSpacing
                        accumulatedChildMeterY += prevRequiredHeight
                      }

                      // Account for header height + border (1px)
                      const childMeterRowY = groupY + headerHeight + 1 + accumulatedChildMeterY
                      // Calculate the allocated height for this child meter (either row height or children height)
                      const childrenHeight = ControlRoomUtils.calculateTotalHeight(childMeterItem.id, canvasItems)
                      const childRequiredHeight = Math.max(meterItemHeight, childrenHeight)
                      // Center the line vertically within the allocated space
                      const childMeterRowCenterY = childMeterRowY + (childRequiredHeight / 2)

                      // End line at child card's left edge
                      const lineEndX = groupX

                      // Calculate Bezier curve control points
                      const controlX = (parentMeterRightX + lineEndX) / 2
                      const pathD = `M ${parentMeterRightX},${parentMeterCenterY} C ${controlX},${parentMeterCenterY} ${controlX},${childMeterRowCenterY} ${lineEndX},${childMeterRowCenterY}`

                      const startId = parentMeterItem.id
                      const endId = childMeterItem.id
                      const isSelected = selectedLine?.startId === startId && selectedLine?.endId === endId

                      return (
                        <g
                          key={`line-${parentMeterId}-${childMeterItem.id}`}
                          style={{ cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedLine({ startId, endId })

                            // Show dialog with connection info
                            const startItem = canvasItems.find(item => item.id === startId)
                            const endItem = canvasItems.find(item => item.id === endId)
                            setConnectionInfo({ start: startItem || null, end: endItem || null })
                            setShowConnectionDialog(true)
                          }}
                        >
                          {/* Invisible wider path for easier clicking */}
                          <path
                            d={pathD}
                            stroke="transparent"
                            strokeWidth="12"
                            fill="none"
                            style={{ pointerEvents: 'all' }}
                          />
                          {/* Visible path */}
                          <path
                            d={pathD}
                            stroke={lineColor}
                            strokeWidth={isSelected ? "4" : "2"}
                            fill="none"
                            opacity={isSelected ? "1" : "0.6"}
                            style={{ pointerEvents: 'none' }}
                          />
                          {/* Start dot */}
                          <circle
                            cx={parentMeterRightX}
                            cy={parentMeterCenterY}
                            r={isSelected ? "6" : "4"}
                            fill={lineColor}
                            opacity={isSelected ? "1" : "0.8"}
                            style={{ pointerEvents: 'none' }}
                          />
                          {/* End dot */}
                          <circle
                            cx={lineEndX}
                            cy={childMeterRowCenterY}
                            r={isSelected ? "6" : "4"}
                            fill={lineColor}
                            opacity={isSelected ? "1" : "0.8"}
                            style={{ pointerEvents: 'none' }}
                          />
                        </g>
                      )
                    })
                  })
                })}
              </svg>

              {/* Sites - draggable */}
              {canvasItems.filter(item => item.type === "site").map((siteItem, index) => {
                const site = siteItem.data as Site
                const defaultX = 50

                // Calculate Y position accounting for all previous sites and their descendants
                let defaultY = 50
                const allSites = canvasItems.filter(item => item.type === "site")
                for (let i = 0; i < index; i++) {
                  const prevSite = allSites[i].data as Site
                  const siteCardHeight = 80 // Site card height
                  defaultY += siteCardHeight + 20 // Site card + gap

                  // Add all descendants of this previous site
                  const descendantsHeight = ControlRoomUtils.calculateSiteTotalHeight(prevSite.id, canvasItems)
                  defaultY += descendantsHeight
                }

                return (
                  <div
                    key={siteItem.id}
                    data-site-id={site.id}
                    className="absolute"
                    style={{
                      left: siteItem.position?.x ?? defaultX,
                      top: siteItem.position?.y ?? defaultY,
                      width: '180px',
                    }}
                  >
                    <Card className="border-2 border-blue-500 shadow-lg hover:shadow-xl transition-all duration-200 bg-blue-50">
                      <CardContent className="p-2">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              {editingItemId === siteItem.id ? (
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  onBlur={handleFinishRename}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleFinishRename()
                                    } else if (e.key === 'Escape') {
                                      handleCancelRename()
                                    }
                                  }}
                                  autoFocus
                                  className="h-6 text-xs py-0 px-1 font-semibold"
                                />
                              ) : (
                                <span
                                  className="font-semibold text-xs truncate text-blue-900 cursor-pointer hover:text-blue-600"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleStartRename(siteItem)
                                  }}
                                  title="Click to rename"
                                >
                                  {site.name}
                                </span>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRemoveItem(siteItem.id)
                              }}
                              className="h-5 w-5 p-0 flex-shrink-0 hover:bg-destructive/10"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                          {site.location && (
                            <p className="text-[10px] text-muted-foreground truncate">{site.location}</p>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenAddMeters(siteItem)
                            }}
                            className="w-full gap-1 h-6 text-[10px] border-blue-300 hover:bg-blue-100"
                          >
                            <Plus className="h-3 w-3" />
                            Add Meters
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })}

              {/* Meter Groups - draggable */}
              {canvasItems.filter(item => item.type === "site").flatMap((siteItem, siteIdx) => {
                const site = siteItem.data as Site
                const meterGroups = ControlRoomUtils.getMeterGroups(site.id, canvasItems)
                const siteX = siteItem.position?.x ?? (50)

                // Calculate Y position accounting for all previous sites and their descendants
                let defaultSiteY = 50
                const allSites = canvasItems.filter(item => item.type === "site")
                for (let i = 0; i < siteIdx; i++) {
                  const prevSite = allSites[i].data as Site
                  const siteCardHeight = 80
                  defaultSiteY += siteCardHeight + 20

                  const descendantsHeight = ControlRoomUtils.calculateSiteTotalHeight(prevSite.id, canvasItems)
                  defaultSiteY += descendantsHeight
                }

                const siteY = siteItem.position?.y ?? defaultSiteY

                return Object.entries(meterGroups).map(([category, meters], groupIdx) => {
                  const groupId = `${site.id}-${category}`

                  const headerHeight = 28
                  const meterItemHeight = 28
                  const minMeterSpacing = 8 // Minimum spacing between meter rows

                  // Stack cards with proper spacing that accounts for each meter's children
                  let cumulativeY = siteY
                  for (let i = 0; i < groupIdx; i++) {
                    const prevCategories = Object.entries(meterGroups)
                    if (i < prevCategories.length) {
                      const prevMeters = prevCategories[i][1]

                      // Add header height for the previous category card
                      cumulativeY += headerHeight

                      // For each meter in the previous category, allocate vertical space
                      // based on either its row height or its children's height (whichever is larger)
                      prevMeters.forEach((prevMeter) => {
                        const childrenHeight = ControlRoomUtils.calculateTotalHeight(prevMeter.id, canvasItems)
                        // Allocate space: max of meter row height or children's height, plus spacing
                        const requiredHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing
                        cumulativeY += requiredHeight
                      })

                      // Add gap between category cards
                      cumulativeY += 16
                    }
                  }

                  const defaultX = siteX + 280
                  const defaultY = cumulativeY

                  // Use stored position if item was dragged, otherwise use calculated position
                  const existingItem = canvasItems.find(item => item.id === groupId)
                  const finalX = existingItem?.position?.x ?? defaultX
                  const finalY = existingItem?.position?.y ?? defaultY

                  return (
                    <div
                      key={groupId}
                      className="absolute"
                      style={{
                        left: finalX,
                        top: finalY,
                        width: '200px',
                      }}
                    >
                      <Card className={`border-l-4 shadow-lg hover:shadow-xl transition-all duration-200 ${
                        category === "CONS" ? "border-l-slate-500 bg-gradient-to-r from-slate-50 to-white" :
                        category === "PROD" ? "border-l-orange-500 bg-gradient-to-r from-orange-50 to-white" :
                        category === "STOR" ? "border-l-green-500 bg-gradient-to-r from-green-50 to-white" :
                        "border-l-purple-500 bg-gradient-to-r from-purple-50 to-white"
                      }`}>
                        <CardContent className="px-1.5 py-0">
                          {/* Group Header */}
                          <div className="flex items-center gap-1 py-0 border-b">
                            {category === "CONS" && <Activity className="h-3 w-3 text-slate-600" />}
                            {category === "PROD" && <Sun className="h-3 w-3 text-orange-600" />}
                            {category === "STOR" && <Battery className="h-3 w-3 text-green-600" />}
                            {category === "INJ" && <Activity className="h-3 w-3 text-purple-600" />}
                            <span className={`font-bold text-[10px] uppercase tracking-wide ${
                              category === "CONS" ? "text-slate-700" :
                              category === "PROD" ? "text-orange-700" :
                              category === "STOR" ? "text-green-700" :
                              "text-purple-700"
                            }`}>
                              {category === "CONS" ? "METERS" :
                               category === "PROD" ? "SOLAR" :
                               category === "STOR" ? "STORAGE" :
                               "INJECTION"}
                            </span>
                            <Badge variant="outline" className={`text-[8px] h-3.5 px-1 ml-auto ${
                              category === "CONS" ? "bg-white text-slate-700 border-slate-300" :
                              category === "PROD" ? "bg-white text-orange-700 border-orange-300" :
                              category === "STOR" ? "bg-white text-green-700 border-green-300" :
                              "bg-white text-purple-700 border-purple-300"
                            }`}>
                              {category}
                            </Badge>
                          </div>

                          {/* Individual Meters */}
                          <div>
                            {meters.map((meterItem, index) => {
                              // Calculate dynamic height for this meter row based on its children
                              const meterItemHeight = 28
                              const minMeterSpacing = 8
                              const childrenHeight = ControlRoomUtils.calculateTotalHeight(meterItem.id, canvasItems)
                              const rowHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing

                              return (
                              <div key={meterItem.id} style={{ minHeight: `${rowHeight}px` }}>
                                {index > 0 && (
                                  <div className={`h-px ${
                                    category === "CONS" ? "bg-slate-200" :
                                    category === "PROD" ? "bg-orange-200" :
                                    category === "STOR" ? "bg-green-200" :
                                    "bg-purple-200"
                                  }`} />
                                )}
                                <div className="flex items-center justify-between px-1 hover:bg-white/70 transition-colors group/item" style={{ height: `${meterItemHeight}px`, paddingTop: '1px', paddingBottom: '1px' }}>
                                  <div className="flex items-center gap-0.5 flex-1 min-w-0">
                                    <div className={`h-1 w-1 rounded-full flex-shrink-0 ${
                                      category === "CONS" ? "bg-slate-500" :
                                      category === "PROD" ? "bg-orange-500" :
                                      category === "STOR" ? "bg-green-500" :
                                      "bg-purple-500"
                                    }`} />
                                    {editingItemId === meterItem.id ? (
                                      <Input
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={handleFinishRename}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleFinishRename()
                                          } else if (e.key === 'Escape') {
                                            handleCancelRename()
                                          }
                                        }}
                                        autoFocus
                                        className="h-5 text-[10px] py-0 px-1"
                                      />
                                    ) : (
                                      <span
                                        className="text-[10px] font-medium truncate cursor-pointer hover:text-blue-600"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleStartRename(meterItem)
                                        }}
                                        title="Click to rename"
                                      >
                                        {meterItem.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()

                                          // Extract actual meter ID (remove "meter-" prefix if present)
                                          const actualMeterId = meterItem.id.replace(/^meter-/, '')

                                          // Find meter by ID across all sites
                                          let foundSite: Site | undefined = undefined
                                          let foundMeter: Meter | undefined = undefined

                                          for (const site of sites) {
                                            const meter = site.meters.find(m => m.id === actualMeterId)
                                            if (meter) {
                                              foundSite = site
                                              foundMeter = meter
                                              break
                                            }
                                          }

                                          if (foundMeter && foundSite) {
                                            setSelectedMeterForConnections({
                                              ...foundMeter,
                                              siteName: foundSite.name
                                            })
                                            setShowDataConnectionsSidebar(true)
                                          } else {
                                            console.error("Could not find meter. Canvas ID:", meterItem.id, "Actual ID:", actualMeterId)
                                          }
                                        }}
                                        className="h-4 w-4 p-0 opacity-0 group-hover/item:opacity-100 flex-shrink-0 hover:bg-blue-100 transition-opacity"
                                        title="Configure data connections"
                                      >
                                        <Settings className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleOpenAddMeters(meterItem)
                                        }}
                                        className="h-4 w-4 p-0 opacity-0 group-hover/item:opacity-100 flex-shrink-0 hover:bg-blue-100 transition-opacity"
                                        title="Add child meters"
                                      >
                                        <ChevronRight className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveItem(meterItem.id)
                                        }}
                                        className="h-4 w-4 p-0 opacity-0 group-hover/item:opacity-100 flex-shrink-0 hover:bg-destructive/10 transition-opacity"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )})}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              })}

              {/* Child Meter Groups (Level 3+) - Render grouped meters for all parent meters */}
              {canvasItems.filter(item => item.type === "meter" && item.parentId && !item.parentId.startsWith("site-")).map(item => item.parentId).filter((value, index, self) => self.indexOf(value) === index).flatMap((parentMeterId) => {
                const parentMeterGroups = ControlRoomUtils.getMeterGroupsByParent(parentMeterId!, canvasItems)
                const parentMeterItem = canvasItems.find(item => item.id === parentMeterId)

                if (!parentMeterItem) return []

                // Get the parent meter's position within its group card using recursive function
                // This already accounts for all vertical spacing in the parent card
                const parentGroupPos = ControlRoomUtils.getParentMeterPosition(parentMeterItem, canvasItems)

                // Calculate cumulative Y offset from previous sibling meters' descendants
                // This is crucial for avoiding overlap when multiple siblings have children
                let siblingsDescendantsOffset = 0
                const grandparentId = parentMeterItem.parentId
                if (grandparentId && !grandparentId.startsWith("site-")) {
                  // Get all sibling meters (meters with same parent and category)
                  const parentCategory = (parentMeterItem.data as Meter).category
                  const siblings = canvasItems.filter(item =>
                    item.type === "meter" &&
                    item.parentId === grandparentId &&
                    (item.data as Meter).category === parentCategory
                  ).sort((a, b) => a.id.localeCompare(b.id))

                  const parentIndex = siblings.findIndex(s => s.id === parentMeterItem.id)

                  // Add cumulative height of all previous siblings' descendants
                  for (let i = 0; i < parentIndex; i++) {
                    const siblingDescendantsHeight = ControlRoomUtils.calculateTotalHeight(siblings[i].id, canvasItems)
                    if (siblingDescendantsHeight > 0) {
                      siblingsDescendantsOffset += siblingDescendantsHeight
                    }
                  }
                }

                return Object.entries(parentMeterGroups).map(([category, meters], groupIdx) => {
                  const groupId = `${parentMeterItem.id}-${category}`

                  // Calculate proper spacing based on previous cards AND their descendants
                  const headerHeight = 28
                  const meterItemHeight = 28
                  const minMeterSpacing = 8

                  // Start with the parent meter's Y position and add siblings' descendants offset for positioning
                  let cumulativeY = parentGroupPos.y + siblingsDescendantsOffset

                  // Add spacing for previous category groups of this parent
                  for (let i = 0; i < groupIdx; i++) {
                    const prevCategories = Object.entries(parentMeterGroups)
                    if (i < prevCategories.length) {
                      const prevMeters = prevCategories[i][1]

                      // Add header height for previous group
                      cumulativeY += headerHeight

                      // For each meter in previous group, add its allocated space
                      prevMeters.forEach((prevMeter) => {
                        const childrenHeight = ControlRoomUtils.calculateTotalHeight(prevMeter.id, canvasItems)
                        const requiredHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing
                        cumulativeY += requiredHeight
                      })

                      // Add gap between category cards
                      cumulativeY += 16
                    }
                  }

                  const defaultX = parentGroupPos.x + 250
                  const defaultY = cumulativeY

                  // Use stored position if dragged
                  const existingItem = canvasItems.find(item => item.id === groupId)
                  const finalX = existingItem?.position?.x ?? defaultX
                  const finalY = existingItem?.position?.y ?? defaultY

                  return (
                    <div
                      key={groupId}
                      className="absolute"
                      style={{
                        left: finalX,
                        top: finalY,
                        width: '200px',
                      }}
                    >
                      <Card className={`border-l-4 shadow-lg hover:shadow-xl transition-all duration-200 ${
                        category === "CONS" ? "border-l-slate-500 bg-gradient-to-r from-slate-50 to-white" :
                        category === "PROD" ? "border-l-orange-500 bg-gradient-to-r from-orange-50 to-white" :
                        category === "STOR" ? "border-l-green-500 bg-gradient-to-r from-green-50 to-white" :
                        "border-l-purple-500 bg-gradient-to-r from-purple-50 to-white"
                      }`}>
                        <CardContent className="px-1.5 py-0">
                          {/* Group Header */}
                          <div className="flex items-center gap-1 py-0 border-b">
                            {category === "CONS" && <Activity className="h-3 w-3 text-slate-600" />}
                            {category === "PROD" && <Sun className="h-3 w-3 text-orange-600" />}
                            {category === "STOR" && <Battery className="h-3 w-3 text-green-600" />}
                            {category === "INJ" && <Activity className="h-3 w-3 text-purple-600" />}
                            <span className={`font-bold text-[10px] uppercase tracking-wide ${
                              category === "CONS" ? "text-slate-700" :
                              category === "PROD" ? "text-orange-700" :
                              category === "STOR" ? "text-green-700" :
                              "text-purple-700"
                            }`}>
                              {category === "CONS" ? "METERS" :
                               category === "PROD" ? "SOLAR" :
                               category === "STOR" ? "STORAGE" :
                               "INJECTION"}
                            </span>
                            <Badge variant="outline" className={`text-[8px] h-3.5 px-1 ml-auto ${
                              category === "CONS" ? "bg-white text-slate-700 border-slate-300" :
                              category === "PROD" ? "bg-white text-orange-700 border-orange-300" :
                              category === "STOR" ? "bg-white text-green-700 border-green-300" :
                              "bg-white text-purple-700 border-purple-300"
                            }`}>
                              {category}
                            </Badge>
                          </div>

                          {/* Individual Meters */}
                          <div>
                            {meters.map((meterItem, index) => {
                              // Calculate dynamic height for this meter row based on its children
                              const meterItemHeight = 28
                              const minMeterSpacing = 8
                              const childrenHeight = ControlRoomUtils.calculateTotalHeight(meterItem.id, canvasItems)
                              const rowHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing

                              return (
                              <div key={meterItem.id} style={{ minHeight: `${rowHeight}px` }}>
                                {index > 0 && (
                                  <div className={`h-px ${
                                    category === "CONS" ? "bg-slate-200" :
                                    category === "PROD" ? "bg-orange-200" :
                                    category === "STOR" ? "bg-green-200" :
                                    "bg-purple-200"
                                  }`} />
                                )}
                                <div className="flex items-center justify-between px-1 hover:bg-white/70 transition-colors group/item" style={{ height: `${meterItemHeight}px`, paddingTop: '1px', paddingBottom: '1px' }}>
                                  <div className="flex items-center gap-0.5 flex-1 min-w-0">
                                    <div className={`h-1 w-1 rounded-full flex-shrink-0 ${
                                      category === "CONS" ? "bg-slate-500" :
                                      category === "PROD" ? "bg-orange-500" :
                                      category === "STOR" ? "bg-green-500" :
                                      "bg-purple-500"
                                    }`} />
                                    {editingItemId === meterItem.id ? (
                                      <Input
                                        value={editingName}
                                        onChange={(e) => setEditingName(e.target.value)}
                                        onBlur={handleFinishRename}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            handleFinishRename()
                                          } else if (e.key === 'Escape') {
                                            handleCancelRename()
                                          }
                                        }}
                                        autoFocus
                                        className="h-5 text-[10px] py-0 px-1"
                                      />
                                    ) : (
                                      <span
                                        className="text-[10px] font-medium truncate cursor-pointer hover:text-blue-600"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleStartRename(meterItem)
                                        }}
                                        title="Click to rename"
                                      >
                                        {meterItem.name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-0.5">
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()

                                          // Extract actual meter ID (remove "meter-" prefix if present)
                                          const actualMeterId = meterItem.id.replace(/^meter-/, '')

                                          // Find meter by ID across all sites
                                          let foundSite: Site | undefined = undefined
                                          let foundMeter: Meter | undefined = undefined

                                          for (const site of sites) {
                                            const meter = site.meters.find(m => m.id === actualMeterId)
                                            if (meter) {
                                              foundSite = site
                                              foundMeter = meter
                                              break
                                            }
                                          }

                                          if (foundMeter && foundSite) {
                                            setSelectedMeterForConnections({
                                              ...foundMeter,
                                              siteName: foundSite.name
                                            })
                                            setShowDataConnectionsSidebar(true)
                                          } else {
                                            console.error("Could not find meter. Canvas ID:", meterItem.id, "Actual ID:", actualMeterId)
                                          }
                                        }}
                                        className="h-4 w-4 p-0 opacity-0 group-hover/item:opacity-100 flex-shrink-0 hover:bg-blue-100 transition-opacity"
                                        title="Configure data connections"
                                      >
                                        <Settings className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleOpenAddMeters(meterItem)
                                        }}
                                        className="h-4 w-4 p-0 opacity-0 group-hover/item:opacity-100 flex-shrink-0 hover:bg-blue-100 transition-opacity"
                                        title="Add child meters"
                                      >
                                        <ChevronRight className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                    {isEditMode && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleRemoveItem(meterItem.id)
                                        }}
                                        className="h-4 w-4 p-0 opacity-0 group-hover/item:opacity-100 flex-shrink-0 hover:bg-destructive/10 transition-opacity"
                                      >
                                        <X className="h-2.5 w-2.5" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )})}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )
                })
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Connections Modal */}
      <DataConnectionsModal
        meter={selectedMeterForConnections}
        isOpen={showDataConnectionsSidebar}
        onClose={() => {
          setShowDataConnectionsSidebar(false)
          setSelectedMeterForConnections(null)
        }}
        onSave={() => {
          // Refresh sites data after saving connections
          fetchPortfolios()
        }}
      />
    </div>
  )
}
