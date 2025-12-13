"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Upload, CheckCircle2, AlertCircle, Loader2, Download, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface CSVUploadProps {
  meterId: string
  meterName: string
  category: "CONS" | "PROD" | "STOR" | "INJ"
  onUploadComplete?: () => void
}

export function CSVUpload({ meterId, meterName, category, onUploadComplete }: CSVUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<any[]>([])
  const [uploadResult, setUploadResult] = useState<{ success: boolean; count: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  const parseCSV = (text: string): any[] => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())

    // Validate headers
    if (!headers.includes('timestamp') || !headers.includes('value')) {
      throw new Error('CSV must contain "timestamp" and "value" columns')
    }

    const data = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',')
      const row: any = {}

      headers.forEach((header, index) => {
        row[header] = values[index]?.trim()
      })

      if (row.timestamp && row.value) {
        data.push({
          timestamp: row.timestamp,
          value: parseFloat(row.value),
          unit: row.unit || 'kWh',
          metric: row.metric || 'energy',
          quality: row.quality || 'good',
          metadata: {}
        })
      }
    }

    return data
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file",
        variant: "destructive",
      })
      return
    }

    setFile(selectedFile)
    setUploadResult(null)

    // Parse and preview
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = parseCSV(text)
        setPreview(parsed.slice(0, 5)) // Show first 5 rows
      } catch (error) {
        toast({
          title: "Parse Error",
          description: error instanceof Error ? error.message : "Failed to parse CSV",
          variant: "destructive",
        })
        setFile(null)
      }
    }
    reader.readAsText(selectedFile)
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      const reader = new FileReader()
      reader.onload = async (event) => {
        try {
          const text = event.target?.result as string
          const data = parseCSV(text)

          const response = await fetch('/api/measurements/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              meterId,
              data,
            }),
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.message || 'Upload failed')
          }

          const result = await response.json()
          setUploadResult({ success: true, count: result.count })

          toast({
            title: "Success",
            description: `Uploaded ${result.count} measurements successfully`,
          })

          if (onUploadComplete) {
            onUploadComplete()
          }

          // Reset
          setFile(null)
          setPreview([])
          if (fileInputRef.current) {
            fileInputRef.current.value = ''
          }
        } catch (error) {
          toast({
            title: "Upload Failed",
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive",
          })
          setUploadResult({ success: false, count: 0 })
        } finally {
          setUploading(false)
        }
      }
      reader.readAsText(file)
    } catch (error) {
      setUploading(false)
      toast({
        title: "Error",
        description: "Failed to read file",
        variant: "destructive",
      })
    }
  }

  const downloadTemplate = () => {
    // Generate category-specific template with appropriate examples
    // Keep it simple - just timestamp and value (in kWh)
    // Advanced users can add optional columns: unit, metric, quality
    let template = ''

    if (category === 'CONS') {
      // Consumption meter template - typical building load
      template = `timestamp,value
2024-01-01T00:00:00Z,150.5
2024-01-01T00:15:00Z,148.2
2024-01-01T00:30:00Z,152.8
2024-01-01T00:45:00Z,155.1
2024-01-01T01:00:00Z,151.9`
    } else if (category === 'PROD') {
      // Solar production meter template - morning ramp-up
      template = `timestamp,value
2024-01-01T08:00:00Z,25.3
2024-01-01T08:15:00Z,42.7
2024-01-01T08:30:00Z,68.5
2024-01-01T08:45:00Z,89.2
2024-01-01T09:00:00Z,105.8`
    } else if (category === 'STOR') {
      // Battery storage meter template - charge/discharge (negative = discharge)
      template = `timestamp,value
2024-01-01T00:00:00Z,45.2
2024-01-01T00:15:00Z,-30.5
2024-01-01T00:30:00Z,20.8
2024-01-01T00:45:00Z,-15.3
2024-01-01T01:00:00Z,0.0`
    } else {
      // Grid injection meter template (INJ) - export to grid
      template = `timestamp,value
2024-01-01T10:00:00Z,85.4
2024-01-01T10:15:00Z,92.1
2024-01-01T10:30:00Z,78.6
2024-01-01T10:45:00Z,88.9
2024-01-01T11:00:00Z,95.2`
    }

    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${category.toLowerCase()}-template.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Upload Measurement Data</h3>
          <p className="text-xs text-muted-foreground">Upload CSV with columns: timestamp, value (in kWh)</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-3 w-3 mr-2" />
          Download Template
        </Button>
      </div>

      <div className="border-2 border-dashed rounded-lg p-6">
        <div className="flex flex-col items-center gap-4">
          <FileText className="h-10 w-10 text-muted-foreground" />

          <div className="text-center">
            <p className="text-sm font-medium">
              {file ? file.name : "Choose a CSV file to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              CSV format: timestamp, value (in kWh)
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id={`file-upload-${meterId}`}
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select File
            </Button>

            {file && (
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Data
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {preview.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h4 className="text-sm font-medium mb-3">Preview (first 5 rows)</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Timestamp</th>
                    <th className="text-right p-2">Value (kWh)</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, index) => (
                    <tr key={index} className="border-b">
                      <td className="p-2">{new Date(row.timestamp).toLocaleString()}</td>
                      <td className="text-right p-2">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {uploadResult && (
        <Alert variant={uploadResult.success ? "default" : "destructive"}>
          {uploadResult.success ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {uploadResult.success
              ? `Successfully uploaded ${uploadResult.count} measurements to ${meterName}`
              : "Upload failed. Please check the file format and try again."}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
