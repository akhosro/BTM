# Tesla Powerwall Setup Guide

## Overview

This guide explains how to connect your Tesla Powerwall to the Enalysis platform for real-time battery monitoring and energy management.

## What You'll Need

1. **Tesla Powerwall** installed and operational
2. **Tesla Account** (email and password)
3. **Powerwall IP Address** on your local network
4. **Same Network Access** (your device and Powerwall must be on the same WiFi/LAN)

## Understanding Tesla Powerwall Integration

### Authentication Method: Local Network Token

Unlike cloud-based APIs, Tesla Powerwall uses **local network authentication**:

- Your credentials are sent **directly to your Powerwall** (not to Tesla servers)
- You receive a **bearer token** that doesn't expire
- All data requests go **directly to your Powerwall** on your local network
- No internet connection required for data fetching (once connected)

### What Data We Collect

- **Battery Level**: Current state of charge (%)
- **Battery Power**: Current charging/discharging rate (kW)
- **Solar Production**: Current solar power generation (kW)
- **Grid Power**: Power flowing to/from the grid (kW)
- **Load Power**: Current home energy consumption (kW)
- **Energy Metrics**: Daily solar production (kWh)

## Step-by-Step Setup

### Step 1: Find Your Powerwall IP Address

#### Method 1: Tesla Mobile App
1. Open the Tesla app on your phone
2. Go to your Powerwall
3. Tap on the gear icon (Settings)
4. Look for "Powerwall Gateway" or "System Information"
5. Note the IP address (e.g., `192.168.1.100`)

#### Method 2: Router Admin Panel
1. Log into your router's admin interface
2. Look for "Connected Devices" or "DHCP Clients"
3. Find device named "Tesla" or "Powerwall"
4. Note the assigned IP address

#### Method 3: Network Scan (Advanced)
```bash
# On Mac/Linux
arp -a | grep -i tesla

# On Windows
arp -a | findstr /i tesla
```

### Step 2: Connect in Enalysis

1. **Navigate to Data Connections**
   - Log into your Enalysis account
   - Go to Settings → Data Connections
   - Select the meter you want to connect (e.g., "Battery Storage")

2. **Select Tesla Powerwall**
   - Choose "Tesla Powerwall" from the provider dropdown

3. **Enter Connection Details**
   - **Powerwall IP Address**: Enter the IP from Step 1 (e.g., `192.168.1.100`)
   - **Tesla Account Email**: Your Tesla account email
   - **Tesla Account Password**: Your Tesla account password

4. **Test Connection**
   - Click "Test Connection"
   - Wait for verification (may take 5-10 seconds)
   - You should see current battery level and power flow data

5. **Save**
   - Click "Save" to store the connection
   - Your token will be saved securely for future use
   - **Note**: You won't need to enter your password again

## Security & Privacy

### Local Network Only

- **Your credentials never leave your network** during authentication
- Data is fetched directly from your Powerwall (no cloud intermediary)
- Connection only works when you're on the same network

### Token Storage

- After successful authentication, we store a **bearer token**
- This token is used for all future data requests
- Token doesn't expire (remains valid until you reset your Powerwall)
- Token is encrypted in our database

### Password Security

- Your password is **never stored** in our database
- It's only used once to obtain the token
- Sent over HTTPS directly to your Powerwall

### Revoking Access

To revoke Enalysis access to your Powerwall:

1. **Delete Connection**: In Enalysis, click "Disconnect" on your Tesla Powerwall connection
2. **Reset Powerwall** (optional, if you want to invalidate the token):
   - In the Tesla app, go to Powerwall settings
   - Perform a software reset (this will generate a new token requirement)

## Troubleshooting

### Error: "Powerwall not found at this IP address"

**Possible Causes:**
- Incorrect IP address
- Powerwall is offline
- Not on the same network

**Solutions:**
1. Verify the IP address is correct (see Step 1)
2. Check Powerwall status in Tesla app
3. Ensure your device is on the same WiFi/LAN as Powerwall
4. Try pinging the Powerwall:
   ```bash
   ping 192.168.1.100
   ```

### Error: "Cannot reach Powerwall"

**Possible Causes:**
- Network connectivity issues
- Firewall blocking local connections
- Powerwall gateway is down

**Solutions:**
1. Check your internet/WiFi connection
2. Disable VPN if enabled
3. Try accessing Powerwall's web interface directly:
   ```
   https://192.168.1.100/
   ```
4. Restart your Powerwall gateway (via Tesla app)

### Error: "Invalid Tesla email or password"

**Possible Causes:**
- Incorrect credentials
- Tesla account password recently changed

**Solutions:**
1. Verify credentials by logging into https://tesla.com
2. Try resetting your Tesla password
3. Ensure you're using your Tesla account (not a separate Powerwall-only account)

### Error: "Token expired. Please reconnect"

**Possible Causes:**
- Powerwall was reset
- Token was manually invalidated

**Solutions:**
1. Click "Disconnect" in Enalysis
2. Reconnect using your email and password
3. New token will be generated

### SSL Certificate Warnings

When accessing Powerwall locally, you may see SSL certificate warnings in logs. This is normal because:
- Powerwall uses a self-signed certificate
- Local network access doesn't require public CA validation
- Our implementation handles this securely

## Data Fetching

### How Often Is Data Fetched?

- **Test Connection**: On-demand when you click "Test"
- **Automated Fetching**: Every 15 minutes (once connected)
- **Real-Time Updates**: Dashboard refreshes every 5 minutes

### What Happens When Powerwall Is Offline?

- Data fetching will fail gracefully
- Dashboard will show "Last Update: [timestamp]"
- Once Powerwall comes back online, data fetching resumes automatically

## Advanced Configuration

### Static IP Recommendation

To prevent connection issues if your Powerwall's IP changes:

1. **Reserve IP in Router**:
   - Log into your router
   - Find "DHCP Reservation" or "Static IP"
   - Assign a permanent IP to your Powerwall's MAC address

2. **Update Enalysis** (if IP changes):
   - Go to Data Connections
   - Edit your Tesla Powerwall connection
   - Update the IP address
   - Test and save

### Multiple Powerwalls

If you have multiple Powerwalls at different locations:

1. **Create Separate Meters**: One for each location
2. **Connect Each Powerwall**: Each gets its own IP and connection
3. **Use Different Accounts** (if applicable): Each site can use different Tesla accounts

## Power Flow Metrics Explained

### Battery Power (kW)
- **Positive value**: Battery is discharging (powering your home)
- **Negative value**: Battery is charging (from solar or grid)
- **Zero**: Battery is idle

### Grid Power (kW)
- **Positive value**: Importing from grid (buying power)
- **Negative value**: Exporting to grid (selling power)
- **Zero**: Grid-neutral (self-sufficient)

### Solar Power (kW)
- Current solar production
- Always positive (when sun is shining)
- Zero at night or cloudy days

### Load Power (kW)
- Total home energy consumption
- Includes all appliances and devices
- Always positive

## Data Accuracy

### Update Frequency
- Powerwall updates its metrics every 1-2 seconds
- Enalysis fetches every 15 minutes
- Historical data is aggregated daily

### Known Limitations
- **Daily Energy**: Calculated from cumulative exports (may not match Tesla app exactly)
- **Real-Time vs. Historical**: Small discrepancies possible due to timing
- **Weather Impact**: Solar production affected by clouds, shadows, dirt

## Cost & Rate Limits

### API Costs
- **FREE**: Tesla Powerwall has no API costs
- Local network access has no usage limits

### Network Bandwidth
- **Minimal**: Each request is ~1-2 KB
- **Monthly Usage**: ~650 KB (one request every 15 min)
- No impact on your internet speed

## Production vs. Development

### Development Mode (Current)
- Uses mock data if no Powerwall is available
- Test connection works without real hardware

### Production Mode
- Requires actual Tesla Powerwall
- Must be on same network for initial setup
- Remote access possible with VPN (advanced)

## Remote Access (Advanced)

To access your Powerwall remotely:

### Option 1: VPN to Home Network
1. Set up VPN server on your home network (e.g., WireGuard, OpenVPN)
2. Connect to VPN when away from home
3. Access Powerwall via local IP as normal

### Option 2: Reverse Proxy (Not Recommended)
- Requires advanced networking knowledge
- Security risks if misconfigured
- Use VPN instead for safety

## Support Resources

- **Tesla Support**: https://www.tesla.com/support/energy/powerwall
- **Tesla Community**: https://teslamotorsclub.com/
- **Powerwall API Docs** (Unofficial): https://github.com/vloschiavo/powerwall2

## FAQs

### Q: Will this void my Tesla warranty?
**A:** No. You're accessing the official local API that Tesla provides.

### Q: Can I use this if I have solar without Powerwall?
**A:** No. This integration is specifically for Powerwall. For solar-only, use your inverter's API (e.g., SolarEdge, Enphase).

### Q: Do I need Tesla Solar to use this?
**A:** No. Powerwall works with any solar system or without solar.

### Q: What if I have multiple Powerwalls?
**A:** They're configured as one unit with one IP address. The API returns combined data.

### Q: Can Tesla see that I'm using this integration?
**A:** No. All communication is local network only. Tesla has no visibility.

### Q: What happens during a power outage?
**A:** If your Powerwall is in backup mode, it may still be accessible on your local network. Internet outages won't affect local data fetching.

### Q: Can I connect if my Powerwall is in "Island Mode"?
**A:** Yes, as long as your device is on the same network as the Powerwall gateway.

---

## Quick Reference

| Field | Example | Where to Find |
|-------|---------|---------------|
| **Powerwall IP** | `192.168.1.100` | Tesla app → Settings → Powerwall Gateway |
| **Email** | `user@example.com` | Your Tesla account email |
| **Password** | `••••••••` | Your Tesla account password |

## Next Steps

1. **Connect Your Powerwall**: Follow Step 2 above
2. **Verify Data**: Check dashboard for real-time metrics
3. **Set Up Notifications**: Configure alerts for low battery, grid outages, etc.
4. **Explore Analytics**: View historical trends and optimization recommendations

---

**Need Help?** Contact support or check the troubleshooting section above.
