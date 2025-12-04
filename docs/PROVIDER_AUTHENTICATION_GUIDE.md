# Provider Authentication Guide

This guide outlines the authentication method for each API provider and implementation priority.

## Authentication Methods Overview

| Provider | Category | Auth Method | Complexity | Priority | Notes |
|----------|----------|-------------|------------|----------|-------|
| **Enphase** | PROD/STOR | OAuth 2.0 | High | ✅ Done | Already implemented |
| **SolarEdge** | PROD/INJ | API Key | Low | High | Simple, very popular |
| **Tesla Powerwall** | STOR | Local API + Token | Medium | High | Popular, local network |
| **Fronius** | INJ | Local API | Low | Medium | Local network only |
| **SMA** | INJ | Multiple options | Medium | Medium | Webconnect or Modbus |
| **UtilityAPI** | CONS | OAuth 2.0 | High | High | Multi-utility support |
| **Green Button** | CONS | OAuth 2.0 | High | Medium | Standardized but complex |
| **Modbus TCP** | All | IP/Port | Low | Medium | Local network, industrial |
| **LG RESU** | STOR | Local API | Medium | Low | Less common |
| **sonnen** | STOR | API Key | Low | Low | Less common |

## Recommended Implementation Priority

### Phase 1: Most Popular (Implement First) ⭐

#### 1. **SolarEdge** (PROD/INJ)
**Why**: Most popular commercial solar monitoring platform
**Auth**: API Key (simple!)
**Implementation**:
- User enters API key + Site ID
- No OAuth needed
- Already have client library ready

```typescript
// Already in lib/api-clients/solaredge.ts
const client = new SolarEdgeClient()
const data = await client.getCurrentPowerFlow(siteId, apiKey)
```

#### 2. **Tesla Powerwall** (STOR)
**Why**: Most popular home battery system
**Auth**: Local network access + Email/Password → Token
**Implementation**:
- User enters Powerwall IP address
- User enters their Tesla account email/password
- Exchange for bearer token
- Store token in metadata

```typescript
// To create: lib/api-clients/tesla.ts
// POST to https://{powerwall-ip}/api/login/Basic
// Get bearer token
// Use for subsequent requests
```

#### 3. **UtilityAPI** (CONS)
**Why**: Covers multiple utility companies (PG&E, SCE, ComEd, etc.)
**Auth**: OAuth 2.0 (similar to Enphase)
**Implementation**:
- Register OAuth app with UtilityAPI
- User connects their utility account
- Similar flow to Enphase

```typescript
// Similar to Enphase OAuth implementation
// Need to register at https://utilityapi.com/
```

### Phase 2: Common Local Systems (Next) 📡

#### 4. **Fronius** (INJ)
**Why**: Popular in Europe, Australia
**Auth**: Local network API (no authentication)
**Implementation**:
- User enters device IP address
- Direct HTTP calls to local device
- No credentials needed

```typescript
// To create: lib/api-clients/fronius.ts
const response = await fetch(
  `http://${deviceIp}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`
)
```

#### 5. **Modbus TCP** (All categories)
**Why**: Industrial/commercial buildings often use Modbus
**Auth**: IP address + optional auth
**Implementation**:
- User enters device IP + port
- Optional: username/password for secure Modbus
- Use Modbus library

```bash
npm install modbus-serial
```

```typescript
// To create: lib/api-clients/modbus.ts
import ModbusRTU from "modbus-serial"
```

### Phase 3: Less Common (Later) ⏰

#### 6. **Green Button** (CONS)
**Why**: Standardized but less adopted
**Auth**: OAuth 2.0 (varies by utility)
**Implementation**: Complex, varies by utility

#### 7. **SMA** (INJ)
**Why**: Commercial solar, less common in small buildings
**Auth**: Multiple options (Webconnect, Modbus, Sunny Portal)

#### 8. **sonnen** (STOR)
**Why**: Less common than Tesla
**Auth**: API Key

#### 9. **LG RESU** (STOR)
**Why**: Less common, often integrated with SolarEdge
**Auth**: Usually via SolarEdge API

---

## Detailed Authentication Implementation

### 1. SolarEdge (API Key) - IMPLEMENT FIRST ✅

**Status**: Client library ready, just need UI updates

**What User Provides**:
- API Key (from SolarEdge portal)
- Site ID (from SolarEdge portal)

**How to Get Credentials** (for docs):
1. Log into https://monitoring.solaredge.com
2. Go to Admin → Site Access → API Access
3. Generate API Key
4. Find Site ID in URL or site details

**UI Updates Needed**:
```typescript
// data-connections-modal.tsx
// Already mostly done! Just ensure:
- API Key field (already there)
- Site ID field (need to add, currently "systemId")
- Test connection uses SolarEdge client
```

**Backend Updates Needed**:
```typescript
// app/api/test-solar-connection/route.ts
// Replace TODO at line 91-95 with:
if (provider === "solaredge") {
  const { solarEdgeClient } = await import("@/lib/api-clients/solaredge")
  const data = await solarEdgeClient.getCurrentPowerFlow(
    credentials.siteId,
    credentials.apiKey
  )

  return NextResponse.json({
    success: true,
    provider,
    currentPower: data.siteCurrentPowerFlow.PV?.currentPower || 0,
    energyToday: data.siteCurrentPowerFlow.PV?.todayEnergy || 0,
    status: data.siteCurrentPowerFlow.PV?.status || "unknown",
    lastUpdate: new Date().toISOString(),
  })
}
```

### 2. Tesla Powerwall (Local API + Token) - HIGH PRIORITY ⚡

**What User Provides**:
- Powerwall IP address (local network)
- Email (Tesla account)
- Password (Tesla account)

**Authentication Flow**:
```typescript
// 1. User enters credentials in UI
// 2. Exchange email/password for token
const response = await fetch(`https://${powerwallIp}/api/login/Basic`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    username: "customer",
    email: userEmail,
    password: userPassword,
    force_sm_off: false,
  }),
})

const { token } = await response.json()

// 3. Store token in metadata
// 4. Use token for subsequent requests
const data = await fetch(`https://${powerwallIp}/api/meters/aggregates`, {
  headers: { "Authorization": `Bearer ${token}` },
})
```

**Security Considerations**:
- Powerwall must be on same network OR user must set up VPN
- Token doesn't expire (unless Powerwall reboots)
- Store token encrypted in database

**UI Additions Needed**:
```typescript
// For Tesla provider:
<Input label="Powerwall IP Address" placeholder="192.168.1.100" />
<Input label="Tesla Email" type="email" />
<Input label="Tesla Password" type="password" />
<Button>Connect to Powerwall</Button>
```

### 3. UtilityAPI (OAuth 2.0) - HIGH PRIORITY 🏢

**What You (Platform) Do Once**:
1. Register at https://utilityapi.com/
2. Get Client ID/Secret (like Enphase)
3. Add to environment variables:
```bash
UTILITYAPI_CLIENT_ID="your_client_id"
UTILITYAPI_CLIENT_SECRET="your_client_secret"
UTILITYAPI_REDIRECT_URI="https://yourdomain.com/api/oauth/utilityapi/callback"
```

**What User Does**:
1. Click "Connect to UtilityAPI"
2. Select their utility company
3. Log in with utility credentials
4. Authorize access

**Implementation**:
- Exact same OAuth pattern as Enphase!
- Copy Enphase OAuth routes and modify for UtilityAPI
- UI already supports OAuth pattern

**Files to Create** (copy from Enphase):
```
app/api/oauth/utilityapi/
├── authorize/route.ts   (copy from enphase, change URLs)
├── callback/route.ts    (copy from enphase, change URLs)
└── refresh/route.ts     (copy from enphase, change URLs)
```

### 4. Fronius (Local API - No Auth) - MEDIUM PRIORITY 🌐

**What User Provides**:
- Device IP address (e.g., 192.168.1.50)

**Implementation**:
```typescript
// lib/api-clients/fronius.ts
export class FroniusClient {
  async getPowerFlowRealtime(deviceIp: string) {
    const response = await fetch(
      `http://${deviceIp}/solar_api/v1/GetPowerFlowRealtimeData.fcgi`
    )
    return response.json()
  }
}
```

**UI**:
```typescript
// Just IP address field
<Input label="Fronius Inverter IP Address" placeholder="192.168.1.50" />
```

### 5. Modbus TCP (IP + Port) - MEDIUM PRIORITY 🔧

**What User Provides**:
- Device IP
- Port (default 502)
- Starting register address
- Number of registers to read

**Implementation**:
```bash
npm install modbus-serial
```

```typescript
// lib/api-clients/modbus.ts
import ModbusRTU from "modbus-serial"

export class ModbusClient {
  async readRegisters(ip: string, port: number, register: number, length: number) {
    const client = new ModbusRTU()
    await client.connectTCP(ip, { port })
    const data = await client.readHoldingRegisters(register, length)
    await client.close()
    return data
  }
}
```

**UI**:
```typescript
<Input label="Device IP" />
<Input label="Port" defaultValue="502" />
<Input label="Register Address" />
<Input label="Number of Registers" />
```

---

## Recommended UI Updates

### Update `getProviderOptions()` with Auth Type Hints

```typescript
case "PROD":
  return [
    { value: "solaredge", label: "SolarEdge", auth: "api_key" },
    { value: "enphase", label: "Enphase", auth: "oauth" },
    { value: "fronius", label: "Fronius", auth: "local" },
    { value: "sma", label: "SMA", auth: "api_key" },
    { value: "huawei", label: "Huawei", auth: "api_key" },
    { value: "growatt", label: "Growatt", auth: "api_key" },
  ]

case "STOR":
  return [
    { value: "tesla_powerwall", label: "Tesla Powerwall", auth: "local_token" },
    { value: "enphase_battery", label: "Enphase IQ", auth: "oauth" },
    { value: "lg_resu", label: "LG RESU", auth: "local" },
    { value: "sonnen", label: "sonnen", auth: "api_key" },
  ]

case "CONS":
  return [
    { value: "utilityapi", label: "UtilityAPI", auth: "oauth" },
    { value: "green_button", label: "Green Button", auth: "oauth" },
    { value: "manual", label: "Manual Upload", auth: "none" },
  ]
```

### Conditional Form Fields Based on Auth Type

```typescript
{/* API Key providers */}
{authType === "api_key" && (
  <>
    <Input label="API Key" type="password" />
    <Input label="System ID" />
  </>
)}

{/* OAuth providers */}
{authType === "oauth" && (
  <Button onClick={() => initiateOAuthFlow(provider)}>
    Connect to {providerName}
  </Button>
)}

{/* Local network providers */}
{authType === "local" && (
  <>
    <Input label="Device IP Address" placeholder="192.168.1.100" />
    <Input label="Port" defaultValue="502" />
  </>
)}

{/* Tesla Powerwall */}
{provider === "tesla_powerwall" && (
  <>
    <Input label="Powerwall IP" placeholder="192.168.1.100" />
    <Input label="Tesla Email" type="email" />
    <Input label="Password" type="password" />
  </>
)}
```

---

## Implementation Roadmap

### Week 1: SolarEdge (Easiest, Most Popular)
- [x] Client library exists
- [ ] Update UI to use `siteId` instead of `systemId`
- [ ] Replace mock API call with real SolarEdge call
- [ ] Test with real SolarEdge account
- **Effort**: 2-3 hours

### Week 2: Tesla Powerwall (High Demand)
- [ ] Create Tesla client library
- [ ] Add Tesla-specific UI fields
- [ ] Implement token exchange
- [ ] Test with real Powerwall
- **Effort**: 4-6 hours

### Week 3: UtilityAPI (Consumer Electricity)
- [ ] Register OAuth app with UtilityAPI
- [ ] Copy Enphase OAuth implementation
- [ ] Modify for UtilityAPI endpoints
- [ ] Test with supported utility
- **Effort**: 3-4 hours

### Week 4: Local Network Devices
- [ ] Fronius client library
- [ ] Modbus client library
- [ ] Update UI for local network providers
- **Effort**: 4-6 hours

---

## Summary by Priority

### Must Have (Phase 1) - 2 weeks
1. ✅ **Enphase** (OAuth) - Already done!
2. 🔥 **SolarEdge** (API Key) - 90% done, finish this week
3. 🔥 **Tesla Powerwall** (Local Token) - High demand
4. 🔥 **UtilityAPI** (OAuth) - Consumer electricity

### Should Have (Phase 2) - 1 month
5. **Fronius** (Local API)
6. **Modbus TCP** (Industrial)

### Nice to Have (Phase 3) - Later
7. **Green Button** (OAuth, complex)
8. **SMA** (Multiple methods)
9. **Others** (sonnen, LG, etc.)

---

## Cost Implications

| Provider | Setup Cost | Monthly Cost | Notes |
|----------|-----------|--------------|-------|
| Enphase | $0 | $0 | OAuth, already registered |
| SolarEdge | $0 | $0 | API key, no registration |
| Tesla Powerwall | $0 | $0 | Local API, no cloud |
| UtilityAPI | $0-50 | $0-10 per meter | May have fees for commercial use |
| Fronius | $0 | $0 | Local API |
| Modbus | $0 | $0 | Local network |
| Green Button | Varies | Varies | Depends on utility |

**Total Estimated**: $0-100 for setup, $0-50/month for production

---

## Testing Without Real Hardware

For each provider, you can:

1. **Keep mock mode** for demo purposes
2. **Use your own accounts** if you have them
3. **Request demo accounts** from providers
4. **Use simulators** for local devices (Fronius has simulator mode)

---

## Next Steps

**This Week**:
1. Finish SolarEdge implementation (2-3 hours)
2. Update UI to show auth method for each provider
3. Create provider selection guide for users

**This Month**:
1. Tesla Powerwall implementation
2. UtilityAPI OAuth setup
3. Documentation for each provider

**Long Term**:
1. Local network device support
2. Additional battery systems
3. Green Button standardization
