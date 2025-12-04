// Utility functions for Control Room Builder

import type { CanvasItem, Meter, Site } from "./types"

/**
 * Group meters by category for a given site
 */
export function getMeterGroups(siteId: string, canvasItems: CanvasItem[]): Record<string, CanvasItem[]> {
  const meters = canvasItems.filter(item =>
    item.type === "meter" && item.parentId === `site-${siteId}`
  )

  const groups: Record<string, CanvasItem[]> = {}
  meters.forEach(meter => {
    const category = (meter.data as Meter).category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(meter)
  })

  // Sort meters within each category by ID to match line calculation order
  Object.keys(groups).forEach(category => {
    groups[category].sort((a, b) => a.id.localeCompare(b.id))
  })

  return groups
}

/**
 * Group meters by any parent ID and category (for Level 3+)
 */
export function getMeterGroupsByParent(parentId: string, canvasItems: CanvasItem[]): Record<string, CanvasItem[]> {
  const meters = canvasItems.filter(item =>
    item.type === "meter" && item.parentId === parentId
  )

  const groups: Record<string, CanvasItem[]> = {}
  meters.forEach(meter => {
    const category = (meter.data as Meter).category
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(meter)
  })

  // Sort meters within each category by ID to match line calculation order
  Object.keys(groups).forEach(category => {
    groups[category].sort((a, b) => a.id.localeCompare(b.id))
  })

  return groups
}

/**
 * Calculate the total vertical space needed for a meter and ALL its descendants
 */
export function calculateTotalHeight(meterId: string, canvasItems: CanvasItem[]): number {
  const childGroups = getMeterGroupsByParent(meterId, canvasItems)

  if (Object.keys(childGroups).length === 0) {
    return 0 // No children, no additional height needed
  }

  const headerHeight = 28
  const meterItemHeight = 28
  let totalHeight = 0

  // Calculate height of all child group cards
  Object.values(childGroups).forEach(childMeters => {
    const cardHeight = headerHeight + (childMeters.length * meterItemHeight)
    totalHeight += cardHeight + 16 // Card + gap

    // Recursively calculate height of each child's descendants
    childMeters.forEach(childMeter => {
      const descendantHeight = calculateTotalHeight(childMeter.id, canvasItems)
      totalHeight += descendantHeight
    })
  })

  return totalHeight
}

/**
 * Calculate the maximum vertical extent for all meters in a category group
 * This accounts for siblings being stacked vertically
 */
export function calculateGroupTotalHeight(meters: CanvasItem[], canvasItems: CanvasItem[]): number {
  if (meters.length === 0) return 0

  let maxHeight = 0

  // Sort meters consistently for sibling calculation
  const sortedMeters = [...meters].sort((a, b) => a.id.localeCompare(b.id))

  // Calculate cumulative height accounting for sibling stacking
  sortedMeters.forEach((meter, idx) => {
    let meterTotalHeight = 0

    // Get direct children of this meter
    const childGroups = getMeterGroupsByParent(meter.id, canvasItems)

    if (Object.keys(childGroups).length > 0) {
      const headerHeight = 28
      const meterItemHeight = 28

      // Calculate height of this meter's child groups
      Object.values(childGroups).forEach(childMeters => {
        const cardHeight = headerHeight + (childMeters.length * meterItemHeight)
        meterTotalHeight += cardHeight + 16

        // Add descendants' height
        childMeters.forEach(childMeter => {
          const descendantHeight = calculateTotalHeight(childMeter.id, canvasItems)
          meterTotalHeight += descendantHeight
        })
      })

      // Add previous siblings' child heights
      for (let i = 0; i < idx; i++) {
        const siblingChildGroups = getMeterGroupsByParent(sortedMeters[i].id, canvasItems)
        Object.values(siblingChildGroups).forEach(childMeters => {
          const cardHeight = headerHeight + (childMeters.length * meterItemHeight)
          meterTotalHeight += cardHeight + 16

          childMeters.forEach(childMeter => {
            const descendantHeight = calculateTotalHeight(childMeter.id, canvasItems)
            meterTotalHeight += descendantHeight
          })
        })
      }
    }

    maxHeight = Math.max(maxHeight, meterTotalHeight)
  })

  return maxHeight
}

/**
 * Calculate the total vertical space needed for a site including ALL meter groups and descendants
 */
export function calculateSiteTotalHeight(siteId: string, canvasItems: CanvasItem[]): number {
  const meterGroups = getMeterGroups(siteId, canvasItems)
  const headerHeight = 28
  const meterItemHeight = 28
  let totalHeight = 0

  // Calculate height for each category group and its descendants
  Object.values(meterGroups).forEach(meters => {
    const cardHeight = headerHeight + (meters.length * meterItemHeight)
    totalHeight += cardHeight + 16 // Card + gap

    // Add descendants' height accounting for sibling stacking
    const groupDescendantHeight = calculateGroupTotalHeight(meters, canvasItems)
    totalHeight += groupDescendantHeight
  })

  return totalHeight
}

/**
 * Get the position of a specific meter within its group card
 */
export function getParentMeterPosition(parentMeterItem: CanvasItem, canvasItems: CanvasItem[]): { x: number; y: number } {
  const parentSiteOrMeter = canvasItems.find(item => item.id === parentMeterItem.parentId)

  if (!parentSiteOrMeter) {
    return { x: 0, y: 0 }
  }

  const parentCategory = (parentMeterItem.data as Meter).category

  if (parentSiteOrMeter.type === "site") {
    // Parent is Level 2 - find its group card and calculate meter position within it
    const site = parentSiteOrMeter.data as Site
    const siteX = parentSiteOrMeter.position?.x ?? 50

    // Calculate default site Y position accounting for all previous sites
    let defaultSiteY = 50
    const allSites = canvasItems.filter(item => item.type === "site")
    const siteIndex = allSites.findIndex(s => s.id === parentSiteOrMeter.id)
    for (let i = 0; i < siteIndex; i++) {
      const prevSite = allSites[i].data as Site
      const siteCardHeight = 80
      defaultSiteY += siteCardHeight + 20
      const descendantsHeight = calculateSiteTotalHeight(prevSite.id, canvasItems)
      defaultSiteY += descendantsHeight
    }

    const siteY = parentSiteOrMeter.position?.y ?? defaultSiteY
    const groupId = `${site.id}-${parentCategory}`

    // Check if this group card has been dragged to a custom position
    const groupCard = canvasItems.find(item => item.id === groupId)

    // Calculate default Y position for this group (accounting for previous category groups)
    const meterGroups = getMeterGroups(site.id, canvasItems)
    const categories = Object.keys(meterGroups)
    const categoryIndex = categories.indexOf(parentCategory)

    let defaultGroupY = siteY
    const headerHeight = 28
    const meterItemHeight = 28
    const minMeterSpacing = 8

    // Add heights of previous category groups that are stacked above this one
    // Using the same logic as rendering with dynamic spacing
    for (let i = 0; i < categoryIndex; i++) {
      const prevCategory = categories[i]
      const prevMeters = meterGroups[prevCategory]

      // Add header height
      defaultGroupY += headerHeight

      // For each meter in the previous category, allocate vertical space
      prevMeters.forEach((prevMeter) => {
        const childrenHeight = calculateTotalHeight(prevMeter.id, canvasItems)
        const requiredHeight = Math.max(meterItemHeight, childrenHeight) + minMeterSpacing
        defaultGroupY += requiredHeight
      })

      // Add gap between category cards
      defaultGroupY += 16
    }

    const groupX = groupCard?.position?.x ?? (siteX + 280)
    const groupY = groupCard?.position?.y ?? defaultGroupY

    // Find the meter's position within the group
    const metersInGroup = canvasItems.filter(item =>
      item.type === "meter" && item.parentId === `site-${site.id}` && (item.data as Meter).category === parentCategory
    ).sort((a, b) => a.id.localeCompare(b.id))

    const meterIndex = metersInGroup.findIndex(m => m.id === parentMeterItem.id)

    // Calculate Y offset for this specific meter within the group using accumulated spacing
    let accumulatedMeterY = 0
    for (let i = 0; i < meterIndex; i++) {
      const prevMeter = metersInGroup[i]
      // Use the full canvas item ID (with meter- prefix) for calculateTotalHeight
      const prevChildrenHeight = calculateTotalHeight(prevMeter.id, canvasItems)
      const prevRequiredHeight = Math.max(meterItemHeight, prevChildrenHeight) + minMeterSpacing
      accumulatedMeterY += prevRequiredHeight
    }

    // Account for header height + border (1px) before the first meter
    const meterY = groupY + headerHeight + 1 + accumulatedMeterY

    return {
      x: groupX,
      y: meterY
    }
  } else if (parentSiteOrMeter.type === "meter") {
    // Parent is Level 3+ - find the group card that contains this parent meter
    // The group ID is constructed from the grandparent meter's ID + the parent meter's category
    const parentGroupId = `${parentSiteOrMeter.id}-${parentCategory}`
    const parentGroupCard = canvasItems.find(item => item.id === parentGroupId)

    if (parentGroupCard?.position) {
      // Find all meters in this group with the same category
      const metersInGroup = canvasItems.filter(item =>
        item.type === "meter" &&
        item.parentId === parentSiteOrMeter.id &&
        (item.data as Meter).category === parentCategory
      ).sort((a, b) => a.id.localeCompare(b.id))

      // Find the index of the parent meter within this group
      const meterIndex = metersInGroup.findIndex(m => m.id === parentMeterItem.id)
      const headerHeight = 28
      const meterItemHeight = 28
      const minMeterSpacing = 8

      // Calculate Y offset for this specific meter within the group using accumulated spacing
      let accumulatedMeterY = 0
      for (let i = 0; i < meterIndex; i++) {
        const prevMeter = metersInGroup[i]
        // Use the full canvas item ID (with meter- prefix) for calculateTotalHeight
        const prevChildrenHeight = calculateTotalHeight(prevMeter.id, canvasItems)
        const prevRequiredHeight = Math.max(meterItemHeight, prevChildrenHeight) + minMeterSpacing
        accumulatedMeterY += prevRequiredHeight
      }

      // Calculate the Y position of this specific meter row within the group
      const meterY = parentGroupCard.position.y + headerHeight + 1 + accumulatedMeterY

      return { x: parentGroupCard.position.x, y: meterY }
    }

    // If no position stored for the group, calculate default position based on grandparent's position
    const grandparentPos = getParentMeterPosition(parentSiteOrMeter, canvasItems)

    // Find meter index in default layout
    const metersInGroup = canvasItems.filter(item =>
      item.type === "meter" &&
      item.parentId === parentSiteOrMeter.id &&
      (item.data as Meter).category === parentCategory
    ).sort((a, b) => a.id.localeCompare(b.id))

    const meterIndex = metersInGroup.findIndex(m => m.id === parentMeterItem.id)
    const headerHeight = 28
    const meterItemHeight = 28
    const minMeterSpacing = 8

    // Calculate Y offset for this specific meter using accumulated spacing
    let accumulatedMeterY = 0
    for (let i = 0; i < meterIndex; i++) {
      const prevMeter = metersInGroup[i]
      const prevChildrenHeight = calculateTotalHeight(prevMeter.id, canvasItems)
      const prevRequiredHeight = Math.max(meterItemHeight, prevChildrenHeight) + minMeterSpacing
      accumulatedMeterY += prevRequiredHeight
    }

    return {
      x: grandparentPos.x + 250,
      y: grandparentPos.y + headerHeight + 1 + accumulatedMeterY
    }
  }

  return { x: 0, y: 0 }
}
