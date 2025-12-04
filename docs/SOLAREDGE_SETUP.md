# SolarEdge API Setup Guide

## For End Users: How to Connect Your SolarEdge System

### Step 1: Get Your API Key

1. Log into your SolarEdge monitoring portal:
   - Go to: https://monitoring.solaredge.com
   - Use your SolarEdge account credentials

2. Navigate to API Access:
   - Click on **Admin** (top right)
   - Select **Site Access**
   - Click on **API Access** tab

3. Generate API Key:
   - Click **"Generate API Key"** button
   - **Important**: Copy and save this key immediately!
   - You won't be able to see it again
   - If you lose it, you'll need to generate a new one

### Step 2: Find Your Site ID

**Option A: From URL**
- While logged into the monitoring portal
- Look at the URL in your browser
- It will look like: `https://monitoring.solaredge.com/solaredge-web/p/site/123456/...`
- Your Site ID is the number after `/site/` (e.g., `123456`)

**Option B: From Site Details**
- Go to your site dashboard
- Click on **Site** → **Details**
- Your Site ID is displayed in the site information

### Step 3: Connect in Enalysis

1. Log into your Enalysis account
2. Go to **Settings** → **Data Connections**
3. Select your **Solar Production** meter
4. Click **"Configure Data Connection"**
5. Select **"SolarEdge"** as the API Provider
6. Enter your credentials:
   - **API Key**: Paste the API key from Step 1
   - **Site ID**: Enter the Site ID from Step 2
7. Click **"Test Connection"**
8. If successful, click **"Save Changes"**

### Step 4: Verify Connection

After saving:
- You should see **"API Connected"** status
- Data will update every 15 minutes automatically
- Check your dashboard to see live solar production data

---

## Troubleshooting

### "Invalid API key" Error

**Causes**:
- API key was typed incorrectly (copy/paste to avoid typos)
- API key was regenerated (old key no longer works)
- API key doesn't have access to this site

**Solutions**:
1. Double-check you copied the entire API key
2. Generate a new API key and try again
3. Ensure you're using the correct SolarEdge account

### "Rate limit exceeded" Error

**Cause**: SolarEdge allows 300 API requests per day per site

**Solutions**:
- Wait 24 hours for the limit to reset
- Reduce testing frequency
- Contact SolarEdge to request higher limits (for commercial users)

### "Site not found" Error

**Causes**:
- Site ID is incorrect
- Site ID doesn't match the API key's account

**Solutions**:
1. Verify Site ID from the monitoring portal
2. Ensure you're using the API key from the same SolarEdge account

### No Data Showing

**Possible Causes**:
- Solar system is offline (check in SolarEdge portal)
- It's nighttime (no solar production)
- Connection was just set up (wait 15 minutes for first data fetch)

**Solutions**:
1. Check if data shows in the SolarEdge portal
2. Wait for next data sync (every 15 minutes)
3. Check "Last Update" timestamp in Enalysis

---

## API Rate Limits

| Limit | Value |
|-------|-------|
| **Daily Requests** | 300 per site |
| **Recommended Fetch Interval** | 15-30 minutes |
| **Data Delay** | 5-15 minutes from real-time |

**Note**: Enalysis automatically fetches data every 15 minutes, using only 96 of your 300 daily requests.

---

## Security & Privacy

### Is My Data Secure?

✅ Yes! Here's how we protect your data:

1. **API Key Storage**: Encrypted in our database
2. **Transmission**: All API calls use HTTPS
3. **Access**: Only you can see your data
4. **Isolation**: Your API key only accesses your sites

### Can I Revoke Access?

Yes, at any time:

**Option 1: In Enalysis**
- Go to Settings → Data Connections
- Click "Disconnect" on your SolarEdge connection

**Option 2: In SolarEdge**
- Log into monitoring.solaredge.com
- Go to Admin → Site Access → API Access
- Delete or regenerate your API key
- This immediately stops all API access

### What Data Do We Access?

We only read:
- Current power production (kW)
- Daily energy production (kWh)
- System status (online/offline)
- Grid import/export (if available)
- Battery status (if you have storage)

We **do not**:
- Modify your system settings
- Access your personal information
- Share your data with third parties

---

## Advanced Features

### Multiple Sites

If you have multiple SolarEdge sites:

1. Each site needs to be connected separately
2. Use the same API key for all sites from one account
3. Enter the specific Site ID for each

### Battery Storage

If you have a SolarEdge battery:

- Battery data appears automatically
- Shows charge level and power flow
- No additional configuration needed

### Commercial Systems

For commercial installations with multiple inverters:

- All inverters under one site use the same API key
- Total production is aggregated automatically
- Individual inverter data available in SolarEdge portal

---

## For Platform Administrators

### Testing the Integration

**Without Real Credentials** (Development):
```typescript
// Uses mock data automatically
// No need for real API key during development
```

**With Real Credentials** (Staging/Production):
1. Get a test SolarEdge account
2. Use demo site or your own installation
3. Test connection in UI
4. Verify data appears in dashboard

### API Implementation Details

**Endpoint Used**:
```
GET https://monitoringapi.solaredge.com/site/{siteId}/currentPowerFlow.json?api_key={apiKey}
```

**Response Format**:
```json
{
  "siteCurrentPowerFlow": {
    "updateRefreshRate": 3,
    "unit": "kW",
    "PV": {
      "status": "Active",
      "currentPower": 12530.0,
      "todayEnergy": 45200.0
    },
    "GRID": {
      "status": "Active",
      "currentPower": -8230.0
    },
    "LOAD": {
      "status": "Active",
      "currentPower": 4300.0
    },
    "STORAGE": {
      "status": "Active",
      "currentPower": 0.0,
      "chargeLevel": 85.5
    }
  }
}
```

**Data Conversions**:
- Power: Watts → Kilowatts (÷ 1000)
- Energy: Watt-hours → Kilowatt-hours (÷ 1000)

**Error Handling**:
- 403: Invalid API key
- 429: Rate limit exceeded
- 404: Site not found
- 500: SolarEdge service error

### Monitoring & Alerts

**Set up monitoring for**:
- API key expirations
- Rate limit approaching (> 280 requests/day)
- Connection failures
- Data staleness (> 1 hour old)

---

## Resources

- **SolarEdge Monitoring API Documentation**:
  https://www.solaredge.com/sites/default/files/se_monitoring_api.pdf

- **SolarEdge Monitoring Portal**:
  https://monitoring.solaredge.com

- **Support**:
  Contact your installer or SolarEdge support

- **Enalysis Support**:
  [Your support contact]

---

## FAQ

**Q: Does this work with all SolarEdge systems?**
A: Yes, any SolarEdge system with monitoring enabled.

**Q: Will this drain my API request quota?**
A: No, we only use 96 of your 300 daily requests (fetching every 15 min).

**Q: What if I have multiple buildings?**
A: Connect each building separately with its own Site ID.

**Q: Can I use this with a commercial system?**
A: Yes! Works with residential and commercial systems.

**Q: Does this work in real-time?**
A: Near real-time (5-15 minute delay from SolarEdge).

**Q: What if my system goes offline?**
A: Enalysis will show the last known status and resume when online.
