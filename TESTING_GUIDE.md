# Testing Guide - Control Room Database Integration

## Overview
This guide walks you through testing the newly implemented database-backed Control Room system.

## Prerequisites
✅ PostgreSQL running on `127.0.0.1:5432`
✅ Database `enalysis_mvp` created
✅ Schema applied (all 11 tables)
✅ Dev server running on `http://localhost:3001`

## Test Plan

### Phase 1: Fresh Onboarding Flow

#### Step 1.1: Clear Existing Data (Optional)
If you want to test from scratch:

```sql
-- Connect to database
PGPASSWORD=1519188 psql -U postgres -h 127.0.0.1 -d enalysis_mvp

-- Clear tables (in order)
DELETE FROM energy_connections;
DELETE FROM measurements;
DELETE FROM energy_sources;
DELETE FROM assets;
DELETE FROM meters;
DELETE FROM recommendations;
DELETE FROM sites;
DELETE FROM portfolios;

-- Verify seed data still exists
SELECT * FROM asset_types;
```

#### Step 1.2: Access Control Room
1. Open browser to `http://localhost:3001/control-room`
2. You should see the onboarding screen automatically

**Expected**:
- Title: "Set Up Your Energy System"
- Progress bar showing "Step 1 of X"
- Site configuration form

#### Step 1.3: Configure Sites
Add 2 sites for testing:

**Site 1**:
- Name: `Toronto Data Center`
- Industry Type: `Data Center`
- Location: `Toronto, Ontario`
- Estimated Load: `850` kW
- Click "Add Site"

**Site 2**:
- Name: `Ottawa Hub`
- Industry Type: `Commercial`
- Location: `Ottawa, Ontario`
- Estimated Load: `420` kW
- Click "Add Site"

**Expected**:
- Both sites appear in "Added Sites" section
- Can remove sites if needed
- "Continue" button enabled

Click "Continue"

#### Step 1.4: Select Assets
Select the following assets:
- ✅ Grid Connection (pre-selected, cannot uncheck)
- ✅ Solar Panels
- ✅ Battery Storage
- ⬜ Backup Generator (leave unchecked for now)
- ⬜ EV Chargers (leave unchecked for now)

**Expected**:
- Progress shows "Step 2 of 5"
- Assets highlight when selected

Click "Continue"

#### Step 1.5: Configure Solar
Choose manual entry:
- System Size: `500` kW
- Click "Continue with Manual Entry"

**Expected**:
- Progress shows "Step 3 of 5"
- Validation passes
- Advances to next step

#### Step 1.6: Configure Battery
Choose manual entry:
- Capacity: `200` kWh
- Current Charge: `80` %
- Click "Continue with Manual Entry"

**Expected**:
- Progress shows "Step 4 of 5"
- Validation passes
- Advances to utility connection step

#### Step 1.7: Utility Connection
Options:
1. Click "Connect Utility Meter" (simulates connection)
2. Or click "Skip for Now"

**Expected**:
- Shows success screen
- "Go to Control Room" button visible

#### Step 1.8: Complete Onboarding
Click "Go to Control Room"

**Expected**:
- Saving spinner appears
- Redirects to control room canvas
- Shows loading state briefly

**Verify in Database**:
```sql
-- Check created data
SELECT * FROM portfolios;
SELECT * FROM sites;
SELECT * FROM meters;
SELECT * FROM energy_sources;
```

You should see:
- 1 portfolio (auto-created)
- 2 sites (Toronto Data Center, Ottawa Hub)
- 8 meters (4 per site: CONS, PROD, STOR, INJ)
- 2 energy sources (1 solar, 1 battery)

---

### Phase 2: Control Room Visualization

#### Step 2.1: Verify Nodes Appear
After onboarding completes:

**Expected Nodes**:
1. **Grid Column (Left)**:
   - Grid Import (default, amber)
   - Grid Injection nodes (purple, one per site if any)

2. **Consumption Column (Middle)**:
   - Toronto Data Center (blue, ~850kW)
   - Ottawa Hub (blue, ~420kW)

3. **Production Column (Right)**:
   - Solar Array 500kW (orange)
   - Battery Storage 200kWh (yellow)

**Visual Checks**:
- ✅ All nodes render correctly
- ✅ Node colors match asset types
- ✅ Power values display
- ✅ Category badges show (CONS, PROD, IMP, INJ)

#### Step 2.2: Test Node Interaction
1. Click on "Toronto Data Center" node

**Expected**:
- Side panel opens
- Shows tabs: Energy, Financial, Forecasting, Carbon
- Displays current load, peak, average
- Charts render with mock data

2. Close panel and click "Solar Array"

**Expected**:
- Different metrics shown (production-focused)
- Cost = $0/MWh (renewable)
- Carbon = 0 g/kWh

#### Step 2.3: Test View Modes
Toggle between view modes using top buttons:

1. **Energy View**: Shows power in kW
2. **Carbon View**: Shows carbon intensity (g/kWh)
3. **Cost View**: Shows cost per MWh

**Expected**:
- Node displays update accordingly
- Values recalculate for each mode
- Solar/battery show 0 carbon

---

### Phase 3: Connection Management

#### Step 3.1: Enter Edit Mode
1. Click "Edit Layout" button (top right)

**Expected**:
- Edit mode banner appears (blue)
- Nodes show link buttons (right side)
- Add Node dropdown available
- Auto-Layout and Save buttons visible

#### Step 3.2: Create Connection (Valid)
Test: Grid Import → Toronto Data Center

1. Click link button on "Grid Import" node
2. Drag cursor to "Toronto Data Center" node
3. Release on the node

**Expected**:
- Connection line appears (blue with glow)
- Arrow points to Toronto Data Center
- Shows "100%" badge on line
- Toast: "Connection Created"
- Saves to database

**Verify in Database**:
```sql
SELECT * FROM energy_connections ORDER BY created_at DESC LIMIT 1;
```

Should show new connection with:
- `source_id` = Grid Import meter ID
- `target_id` = Toronto Data Center meter ID

#### Step 3.3: Create Connection (Invalid)
Test: Toronto Data Center → Grid Import (reverse)

1. Try to drag from Toronto Data Center to Grid Import

**Expected**:
- Red toast: "Invalid Connection"
- Reason: "Consumption nodes cannot export to grid directly"
- No connection created

#### Step 3.4: Create Multi-Connection (Percentage Split)
Test: Solar → Both Sites

1. Drag from "Solar Array" to "Toronto Data Center"
   - Should create 100% connection

2. Drag from "Solar Array" to "Ottawa Hub"
   - Percentage dialog appears
   - Shows: "Current Allocations: Toronto Data Center - 100%"
   - Shows: "Remaining: 0%"

3. Try entering 50%
   - Error: "Total allocation would be 150%"

4. Go back and delete first connection:
   - Click red X button on connection line
   - Confirms deletion

5. Create new connections with proper splits:
   - Solar → Toronto: 60%
   - Solar → Ottawa: 40%

**Expected**:
- Two connections from solar
- Lines show 60% and 40% badges
- Solar node shows "Allocated: 100%" badge

**Verify in Database**:
```sql
SELECT
  ec.id,
  ec.source_type,
  ec.target_type,
  ec.power,
  ec.description
FROM energy_connections ec
WHERE ec.source_id IN (SELECT id FROM energy_sources WHERE source_type = 'solar');
```

#### Step 3.5: Test Connection Deletion
1. Click red X on any connection line

**Expected**:
- Connection disappears immediately
- Toast: "Connection Removed"
- Database record deleted

**Verify**:
```sql
SELECT COUNT(*) FROM energy_connections;
```
Count should decrease by 1.

#### Step 3.6: Test Auto-Layout
1. Drag nodes to random positions
2. Click "Auto-Layout" button

**Expected**:
- All nodes arrange in neat columns
- Grid nodes on left
- Consumption in middle
- Production on right
- Evenly spaced vertically
- Toast shows nodes organized

#### Step 3.7: Save Layout
1. Click "Save" button

**Expected**:
- Toast: "Layout Saved"
- Exits edit mode
- Positions saved to localStorage

2. Refresh page

**Expected**:
- Nodes return to saved positions
- Connections reload from database
- No layout shift

---

### Phase 4: Advanced Features

#### Step 4.1: Test Zoom Controls
1. Click zoom in (+) button several times
2. Click zoom out (-) button
3. Click reset view button

**Expected**:
- Canvas zooms smoothly
- Percentage indicator updates (50%-200%)
- Nodes scale proportionally
- Reset returns to 100%

#### Step 4.2: Test Drag and Drop
1. Exit edit mode
2. Enter edit mode again
3. Drag any node to new position

**Expected**:
- Node follows cursor smoothly
- Connections update dynamically
- Other nodes unaffected
- Can drag anywhere on canvas

#### Step 4.3: Test Site Filter
1. Use site filter dropdown (top)
2. Select "Toronto Data Center"

**Expected**:
- (Currently shows all - filtering to be implemented)
- Should highlight or filter to show only Toronto-related nodes

#### Step 4.4: Test Date Range
1. Use date range dropdown
2. Select "Last 7 days"

**Expected**:
- (Currently shows today - historical data to be implemented)
- Should affect measurement queries when implemented

---

### Phase 5: Error Handling

#### Step 5.1: Test Network Failure
1. Stop database or cause connection error
2. Refresh Control Room page

**Expected**:
- Loading spinner appears
- Red toast: "Error Loading Data"
- Description: "Failed to load energy infrastructure data"
- Graceful error display (no crash)

#### Step 5.2: Test Invalid Connection Creation
Try all invalid connection types:

1. **CONS → CONS**: "Cannot connect consumption to consumption directly"
2. **CONS → INJ**: "Consumption nodes cannot export to grid directly"
3. **CONS → PROD**: "Consumption nodes cannot feed production nodes"
4. **INJ → Any**: "Injection nodes cannot be connection sources"
5. **PROD → PROD** (non-storage): "Cannot connect production to production"

**Expected**:
- All show appropriate error messages
- No connections created
- System remains stable

#### Step 5.3: Test Percentage Validation
In edit mode with existing connection:

1. Create connection from Solar to site
2. Try to add second connection
3. Enter invalid percentages:
   - `0`: Error
   - `101`: Error
   - `abc`: Error
   - Negative: Error

**Expected**:
- Validation messages appear
- Connection not created
- Dialog stays open for correction

---

### Phase 6: Database Integrity

#### Step 6.1: Verify Foreign Keys
```sql
-- All meters should belong to sites
SELECT m.id, m.name, s.name as site_name
FROM meters m
LEFT JOIN sites s ON m.site_id = s.id
WHERE s.id IS NULL;
-- Should return 0 rows

-- All sites should belong to portfolios
SELECT s.id, s.name, p.name as portfolio_name
FROM sites s
LEFT JOIN portfolios p ON s.portfolio_id = p.id
WHERE p.id IS NULL;
-- Should return 0 rows

-- All energy sources should belong to meters
SELECT es.id, es.name, m.name as meter_name
FROM energy_sources es
LEFT JOIN meters m ON es.meter_id = m.id
WHERE m.id IS NULL;
-- Should return 0 rows
```

#### Step 6.2: Verify Cascade Deletes
```sql
-- Get a portfolio ID
SELECT id FROM portfolios LIMIT 1;

-- Delete portfolio (should cascade to sites, meters, sources)
-- DO NOT RUN THIS IN PRODUCTION!
-- This is just to verify cascade behavior in test environment
```

#### Step 6.3: Verify Data Types
```sql
-- Check that capacities are numeric
SELECT id, name, capacity
FROM meters
WHERE capacity IS NOT NULL
  AND capacity::text !~ '^\d+\.?\d*$';
-- Should return 0 rows

-- Check timestamps
SELECT id, created_at, updated_at
FROM portfolios
WHERE created_at > updated_at;
-- Should return 0 rows
```

---

## Known Issues & Limitations

### Current Limitations:
1. ✅ **Connections persist** - Fixed in latest update
2. ✅ **Connections load on mount** - Fixed in latest update
3. ⚠️ **No real-time measurements** - Using mock data for charts
4. ⚠️ **Single portfolio** - Shows first portfolio only
5. ⚠️ **No node editing** - Cannot update meter/source details
6. ⚠️ **No node deletion** - Cannot remove nodes after creation
7. ⚠️ **Asset types unused** - Assets table not yet integrated

### Expected Behaviors:
- Node positions saved to **localStorage** (not database)
- Power values are static (from capacity field)
- Charts show mock time-series data
- No live updates (requires WebSocket)

---

## Success Criteria

### Must Pass:
- [x] Onboarding creates database records
- [x] Nodes appear from database data
- [x] Connections create and delete from database
- [x] Percentage allocation works correctly
- [x] Invalid connections blocked with messages
- [x] Data persists after page refresh
- [x] Layout positions save and restore

### Should Pass:
- [ ] All foreign key constraints valid
- [ ] No orphaned records
- [ ] Graceful error handling
- [ ] Smooth animations and interactions
- [ ] Mobile responsive (bonus)

---

## Troubleshooting

### Issue: Nodes Don't Appear
**Check**:
1. Database has data: `SELECT COUNT(*) FROM sites;`
2. API responds: `curl http://localhost:3001/api/portfolios`
3. Console errors in browser DevTools
4. Network tab shows 200 response

### Issue: Connections Don't Save
**Check**:
1. Edit mode is enabled
2. Console shows POST to `/api/connections`
3. Database table exists: `\dt energy_connections`
4. Network tab shows response

### Issue: Database Connection Failed
**Check**:
1. PostgreSQL running: `pg_isready -h 127.0.0.1`
2. Credentials correct in `.env.local`
3. Database exists: `psql -U postgres -h 127.0.0.1 -l`

### Issue: Dev Server Not Running
**Restart**:
```bash
cd enalysis-mvp
npx kill-port 3000 3001
npm run dev
```

---

## Next Steps After Testing

1. **If tests pass**:
   - Deploy to staging environment
   - Add real measurement data ingestion
   - Implement WebSocket for live updates

2. **If tests fail**:
   - Document failures in GitHub Issues
   - Check console logs
   - Review database state
   - Check API responses

---

## Quick Test Script

For rapid testing, run these commands:

```bash
# 1. Verify database
PGPASSWORD=1519188 psql -U postgres -h 127.0.0.1 -d enalysis_mvp -c "\dt"

# 2. Check data
PGPASSWORD=1519188 psql -U postgres -h 127.0.0.1 -d enalysis_mvp -c "SELECT COUNT(*) as portfolios FROM portfolios; SELECT COUNT(*) as sites FROM sites; SELECT COUNT(*) as meters FROM meters; SELECT COUNT(*) as sources FROM energy_sources;"

# 3. View connections
PGPASSWORD=1519188 psql -U postgres -h 127.0.0.1 -d enalysis_mvp -c "SELECT * FROM energy_connections;"

# 4. Check dev server
curl http://localhost:3001/api/portfolios

# 5. Clear test data (WARNING: Destructive!)
# PGPASSWORD=1519188 psql -U postgres -h 127.0.0.1 -d enalysis_mvp -c "TRUNCATE energy_connections, measurements, energy_sources, assets, meters, recommendations, sites, portfolios RESTART IDENTITY CASCADE;"
```

---

**Happy Testing! 🚀**

Report issues to: [GitHub Issues](https://github.com/anthropics/enalysis-mvp/issues) (or wherever your repo is)
