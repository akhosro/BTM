"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingDown, TrendingUp } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type InjectionValidationProps = {
  siteId: string
  injectionMeterId: string
  siteName?: string
}

type ComparisonData = {
  timestamp: string
  calculated: number
  measured: number | null
  discrepancy: number | null
  discrepancyPercent: number | null
  alert: boolean
  metadata: any
}

type ValidationSummary = {
  totalPoints: number
  measuredPoints: number
  calculatedPoints: number
  avgDiscrepancy: number
  maxDiscrepancy: number
  alertCount: number
  accuracy: number
}

export function InjectionValidation({ siteId, injectionMeterId, siteName }: InjectionValidationProps) {
  const [loading, setLoading] = useState(false)
  const [comparison, setComparison] = useState<ComparisonData[]>([])
  const [summary, setSummary] = useState<ValidationSummary | null>(null)
  const { toast } = useToast()

  const validateInjection = async () => {
    setLoading(true)
    try {
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - 7) // Last 7 days

      const response = await fetch(
        `/api/measurements/calculate-injection?siteId=${siteId}&injectionMeterId=${injectionMeterId}&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Validation failed")
      }

      const result = await response.json()
      setComparison(result.comparison.slice(0, 20)) // Show last 20 data points
      setSummary(result.summary)

      toast({
        title: "Validation Complete",
        description: `Compared ${result.summary.totalPoints} data points`,
      })
    } catch (error) {
      toast({
        title: "Validation Failed",
        description: error instanceof Error ? error.message : "Failed to validate injection",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const formatValue = (value: number | null) => {
    if (value === null) return "—"
    return `${value.toFixed(2)} kW`
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return "—"
    return `${value.toFixed(1)}%`
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Injection Validation
              {summary && (
                <Badge variant={summary.accuracy >= 95 ? "default" : "destructive"}>
                  {summary.accuracy.toFixed(1)}% Accuracy
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Compare measured injection vs calculated from other meters
            </CardDescription>
          </div>
          <Button
            onClick={validateInjection}
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Validating..." : "Run Validation"}
          </Button>
        </div>
      </CardHeader>

      {summary && (
        <CardContent className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Total Points</div>
              <div className="text-xl font-bold">{summary.totalPoints}</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Avg Discrepancy</div>
              <div className="text-xl font-bold">{summary.avgDiscrepancy.toFixed(2)} kW</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Max Discrepancy</div>
              <div className="text-xl font-bold">{summary.maxDiscrepancy.toFixed(2)} kW</div>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <div className="text-xs text-muted-foreground mb-1">Alerts</div>
              <div className="text-xl font-bold flex items-center gap-2">
                {summary.alertCount}
                {summary.alertCount > 0 && (
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                )}
              </div>
            </div>
          </div>

          {/* Alerts */}
          {summary.alertCount > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-orange-900">Discrepancy Alert</h4>
                  <p className="text-xs text-orange-700 mt-1">
                    {summary.alertCount} measurements show {">"}5% difference between measured and calculated values.
                    This may indicate meter calibration issues or missing measurement data.
                  </p>
                </div>
              </div>
            </div>
          )}

          {summary.accuracy >= 95 && summary.alertCount === 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-sm text-green-900">Excellent Accuracy</h4>
                  <p className="text-xs text-green-700 mt-1">
                    Your injection meter measurements closely match calculated values, indicating good meter calibration.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Comparison Table */}
          <div>
            <h4 className="text-sm font-medium mb-3">Recent Measurements (Last 20)</h4>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-right">Measured</TableHead>
                    <TableHead className="text-right">Calculated</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No data available. Click "Run Validation" to compare measurements.
                      </TableCell>
                    </TableRow>
                  ) : (
                    comparison.map((row, index) => {
                      const isPositive = row.calculated > 0
                      const hasMeasured = row.measured !== null

                      return (
                        <TableRow key={index} className={row.alert ? "bg-orange-50/50" : ""}>
                          <TableCell className="font-mono text-xs">
                            {new Date(row.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {hasMeasured ? (
                              <span className={row.measured! > 0 ? "text-green-600" : "text-blue-600"}>
                                {formatValue(row.measured)}
                                {row.measured! > 0 ? (
                                  <TrendingUp className="inline h-3 w-3 ml-1" />
                                ) : (
                                  <TrendingDown className="inline h-3 w-3 ml-1" />
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <span className={isPositive ? "text-green-600" : "text-blue-600"}>
                              {formatValue(row.calculated)}
                              {isPositive ? (
                                <TrendingUp className="inline h-3 w-3 ml-1" />
                              ) : (
                                <TrendingDown className="inline h-3 w-3 ml-1" />
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {row.discrepancy !== null ? (
                              <span className={row.alert ? "text-orange-600 font-medium" : ""}>
                                {formatValue(row.discrepancy)} ({formatPercent(row.discrepancyPercent)})
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.alert ? (
                              <Badge variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Alert
                              </Badge>
                            ) : hasMeasured ? (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                No Data
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="text-xs text-muted-foreground mt-4">
            <p><strong>Legend:</strong></p>
            <ul className="list-disc list-inside space-y-1 mt-1">
              <li><TrendingUp className="inline h-3 w-3" /> = Exporting to grid (positive)</li>
              <li><TrendingDown className="inline h-3 w-3" /> = Importing from grid (negative)</li>
              <li>Alert = Discrepancy {">"} 5%</li>
            </ul>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
