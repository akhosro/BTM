# Data Upload Guide - Consumption, Storage & Injection Meters

## Overview

Complete frontend and backend implementation for uploading measurement data for all meter types: consumption (CONS), storage (STOR), injection (INJ), and production (PROD).

---

## ✅ What Was Built

### 1. **Backend API Routes**

#### `/api/measurements/upload` - Bulk Data Upload
Located at: [app/api/measurements/upload/route.ts](app/api/measurements/upload/route.ts)

**POST - Upload Measurements**
```typescript
POST /api/measurements/upload
{
  "meterId": "uuid-of-meter",
  "data": [
    {
      "timestamp": "2024-01-01T00:00:00Z",
      "value": 150.5,
      "quality": "good",  // optional: "good", "bad", "estimated"
      "metadata": {}      // optional
    },
    // ... more records
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 100,
  "message": "Successfully uploaded 100 measurements"
}
```

**GET - Fetch Measurements**
```typescript
GET /api/measurements/upload?meterId=uuid&limit=100&startDate=...&endDate=...
```

### 2. **Frontend Components**

#### CSV Upload Component
Located at: [components/csv-upload.tsx](components/csv-upload.tsx)

**Features:**
- Drag-and-drop or file selection
- CSV parsing with validation
- Preview of first 5 rows before upload
- Template CSV download
- Real-time upload progress
- Success/error feedback
- Automatic data validation

### 3. **Enhanced Data Connections UI**
Located at: [app/data-connections/page.tsx](app/data-connections/page.tsx)

**New Features:**
- Each meter card now has 2 tabs:
  1. **Configuration Tab**: Meter details and API settings (for PROD only)
  2. **Data Upload Tab**: CSV upload interface for ALL meter types

**Supported for ALL Meter Categories:**
- ✅ CONS (Consumption) - Grid import and facility usage
- ✅ STOR (Storage) - Battery charge/discharge
- ✅ INJ (Injection) - Grid export from solar/battery
- ✅ PROD (Production) - Solar panels (with API support)

---

## 📊 CSV File Format

### Required Columns
- `timestamp` - ISO 8601 format (e.g., "2024-01-01T00:00:00Z")
- `value` - Numeric value (kW or kWh)

### Optional Columns
- `quality` - Data quality indicator: "good", "bad", or "estimated" (default: "good")

### Example CSV Template

```csv
timestamp,value,quality
2024-01-01T00:00:00Z,150.5,good
2024-01-01T00:15:00Z,148.2,good
2024-01-01T00:30:00Z,152.8,good
2024-01-01T00:45:00Z,155.1,good
2024-01-01T01:00:00Z,151.9,good
```

**Download Template**: Click the "Download Template" button in the Data Upload tab for any meter.

---

## 🔄 Complete User Flow

### Step 1: Create Meters in Control Room
```
1. Navigate to http://localhost:3000/control-room
2. Complete onboarding to create sites
3. Add meters (Consumption, Storage, Injection, Production)
4. Save configuration
```

### Step 2: Navigate to Data Connections
```
1. Go to http://localhost:3000/data-connections
2. Select "Energy Assets" tab
3. Choose meter category (Solar/Consumption/Storage/Injection)
```

### Step 3: Upload Data
```
1. Click on the meter card
2. Switch to "Data Upload" tab
3. Click "Download Template" to get CSV format
4. Prepare your CSV file with measurement data
5. Click "Select File" or drag CSV file
6. Review the preview (first 5 rows shown)
7. Click "Upload Data" button
8. Wait for success confirmation
```

### Step 4: Verify Upload
```
1. Check database using Drizzle Studio at http://localhost:4983
2. Navigate to "measurements" table
3. Filter by meter_id to see uploaded data
```

---

## 📋 Meter Types & Use Cases

### Consumption Meters (CONS)
**Purpose**: Track grid import and total facility energy consumption

**Example Data Points:**
- Grid energy import (kW)
- Total facility load (kW)
- HVAC consumption (kW)
- Lighting loads (kW)

**CSV Example:**
```csv
timestamp,value,quality
2024-01-01T00:00:00Z,850.0,good
2024-01-01T00:15:00Z,842.5,good
2024-01-01T00:30:00Z,865.3,good
```

### Storage Meters (STOR)
**Purpose**: Track battery charge/discharge cycles

**Example Data Points:**
- Battery charge level (kWh or %)
- Charge/discharge power (kW, positive=charging, negative=discharging)
- State of charge (%)

**CSV Example:**
```csv
timestamp,value,quality
2024-01-01T00:00:00Z,150.0,good
2024-01-01T00:15:00Z,155.5,good
2024-01-01T00:30:00Z,148.2,good
```

### Injection Meters (INJ)
**Purpose**: Track grid export from solar and battery

**Example Data Points:**
- Grid export power (kW)
- Solar to grid (kW)
- Battery to grid (kW)

**CSV Example:**
```csv
timestamp,value,quality
2024-01-01T00:00:00Z,45.5,good
2024-01-01T00:15:00Z,52.3,good
2024-01-01T00:30:00Z,48.7,good
```

### Production Meters (PROD)
**Purpose**: Track solar panel generation

**Methods:**
1. **CSV Upload** (same as above)
2. **API Connection** (SolarEdge, Enphase - see Configuration tab)

**CSV Example:**
```csv
timestamp,value,quality
2024-01-01T12:00:00Z,95.5,good
2024-01-01T12:15:00Z,98.2,good
2024-01-01T12:30:00Z,102.8,good
```

---

## 🔌 API Integration Options

### For Production Meters (Solar)
Currently supported API providers:
- **SolarEdge** - Configure in "Configuration" tab
- **Enphase** - Configure in "Configuration" tab
- **Manual CSV** - Use "Data Upload" tab

### For Other Meters (CONS, STOR, INJ)
Currently:
- ✅ **CSV Upload** - Fully functional
- ⏳ **API Integration** - Coming soon

API providers planned:
- Utility meters (consumption)
- Battery management systems (storage)
- Smart inverters (injection)

---

## 💾 Database Schema

### Measurements Table
```sql
CREATE TABLE measurements (
  id UUID PRIMARY KEY,
  meter_id UUID REFERENCES meters(id),
  timestamp TIMESTAMP NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  quality TEXT CHECK (quality IN ('good', 'bad', 'estimated')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_measurements_meter_time ON measurements(meter_id, timestamp DESC);
CREATE INDEX idx_measurements_timestamp ON measurements(timestamp DESC);
```

---

## 🧪 Testing the Upload Flow

### Test with Sample Data

1. **Download Template**
   ```
   Click "Download Template" in Data Upload tab
   ```

2. **Edit CSV File**
   Add your measurement data following the format

3. **Upload via UI**
   ```
   1. Select meter card
   2. Go to "Data Upload" tab
   3. Upload CSV file
   4. Verify success message
   ```

4. **Verify in Database**
   ```bash
   # Open Drizzle Studio
   npm run db:studio

   # Navigate to: http://localhost:4983
   # Table: measurements
   # Filter: meter_id = your-meter-uuid
   ```

### Test with API (Programmatic Upload)

```bash
curl -X POST http://localhost:3000/api/measurements/upload \
  -H "Content-Type: application/json" \
  -d '{
    "meterId": "your-meter-uuid",
    "data": [
      {
        "timestamp": "2024-01-01T00:00:00Z",
        "value": 150.5,
        "quality": "good"
      },
      {
        "timestamp": "2024-01-01T00:15:00Z",
        "value": 148.2,
        "quality": "good"
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "count": 2,
  "message": "Successfully uploaded 2 measurements"
}
```

---

## 📁 File Reference

### New Files Created
1. **[app/api/measurements/upload/route.ts](app/api/measurements/upload/route.ts)**
   - POST: Bulk upload measurements
   - GET: Fetch measurements by meter

2. **[components/csv-upload.tsx](components/csv-upload.tsx)**
   - Reusable CSV upload component
   - Works with any meter type
   - Includes validation and preview

### Modified Files
1. **[app/data-connections/page.tsx](app/data-connections/page.tsx)**
   - Added nested tabs (Configuration / Data Upload)
   - Integrated CSVUpload component
   - Added support for all meter categories

---

## 🎯 Key Features

### CSV Upload Component
✅ **Template Download** - Get proper CSV format
✅ **File Validation** - Checks for required columns
✅ **Preview** - Shows first 5 rows before upload
✅ **Error Handling** - Clear error messages
✅ **Progress Feedback** - Upload status indicators
✅ **Auto-clear** - Resets after successful upload

### Data Validation
✅ **Timestamp Format** - ISO 8601 validation
✅ **Numeric Values** - Type checking
✅ **Quality Enum** - Validates quality values
✅ **Required Fields** - Ensures timestamp + value present

### Performance
✅ **Bulk Insert** - Efficient database writes
✅ **Indexed Queries** - Fast retrieval by meter & time
✅ **Pagination Support** - Limit parameter for large datasets

---

## 🚀 Next Steps (Optional Enhancements)

### Immediate Improvements
1. **Add data visualization** - Chart uploaded measurements
2. **Add download** - Export measurements to CSV
3. **Add edit** - Modify uploaded data points
4. **Add delete** - Remove incorrect measurements

### Future API Integrations
1. **Utility APIs** - Automatic consumption data pull
2. **Battery BMS** - Real-time battery data (Tesla, LG, Sonnen)
3. **Smart Meters** - Direct meter connections
4. **Grid APIs** - Injection metering

### Advanced Features
1. **Scheduled imports** - Cron jobs for automatic CSV uploads
2. **FTP/SFTP support** - Automated file transfers
3. **Data quality checks** - Anomaly detection
4. **Gap filling** - Interpolation for missing data

---

## 🎉 Summary

**Status: ✅ COMPLETE**

All meter types (Consumption, Storage, Injection, Production) now support:
- ✅ CSV file upload with validation
- ✅ Bulk data import to database
- ✅ API routes for programmatic access
- ✅ Clean UI with preview and templates
- ✅ Error handling and user feedback

**URLs:**
- Data Connections: http://localhost:3000/data-connections
- Database Studio: http://localhost:4983
- API Endpoint: http://localhost:3000/api/measurements/upload

**Ready to upload data for all your meters!** 📊⚡🔋
