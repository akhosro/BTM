# Data Connections - MVP Implementation

## Overview
This module provides the interface for connecting meters to external data sources, with a focus on solar panel API integration for real-time data monitoring.

## MVP Scope (Current Implementation)

### Supported Meter Categories
- **PROD (Solar)** - Production meters with solar panel API integration
- **CONS** - Consumption meters (grid, building load)
- **STOR** - Storage meters (battery, thermal storage)
- **INJ** - Injection meters (grid injection)

### Solar API Integration (MVP)
For the MVP, only solar type with two API providers:

#### Supported Providers
1. **SolarEdge**
   - Site ID-based authentication
   - API key authentication
   - Update frequency: 5min, 15min, 30min, 1hour

2. **Enphase**
   - System ID-based authentication
   - API key authentication (OAuth 2.0 in production)
   - Update frequency: 5min, 15min, 30min, 1hour

## Current Features

### UI Components
- ✅ Tabbed interface for different meter categories
- ✅ Add/remove data sources per meter
- ✅ Basic source configuration (name, type, capacity, carbon intensity, cost)
- ✅ API connection toggle (enable/disable)
- ✅ API provider selection (SolarEdge, Enphase)
- ✅ API credentials input (API Key, System/Site ID)
- ✅ Update frequency selector
- ✅ Test connection functionality
- ✅ Connection status indicators
- ✅ Save all configurations

### Backend
- ✅ Energy sources CRUD API ([/api/energy-sources/route.ts](../api/energy-sources/route.ts))
- ✅ Meters API with site information ([/api/meters/route.ts](../api/meters/route.ts))
- ✅ Mock test connection endpoint ([/api/test-solar-connection/route.ts](../api/test-solar-connection/route.ts))
- ✅ Database schema with metadata JSONB field for flexible API configuration
- ✅ ID mapping for new entities

### Database Schema
The `energy_sources` table stores:
- Basic info: name, sourceType, capacity
- Performance data: carbonIntensity, costPerMwh
- API configuration in `metadata` JSONB:
  ```json
  {
    "useAPI": true,
    "apiProvider": "solaredge",
    "apiKey": "***",
    "systemId": "12345",
    "updateFrequency": "15min",
    "connectionStatus": "success",
    "lastTested": "2025-01-04T..."
  }
  ```

## Testing the Implementation

1. **Create a Solar Meter**
   - Go to Control Room
   - Create a site
   - Add a PROD category meter

2. **Configure Data Source**
   - Navigate to Data Connections
   - Select "Solar" tab
   - Click "Add Data Source" on your meter
   - Fill in source details:
     - Name: "Main Solar Array"
     - Type: Solar
     - Capacity: 500 kW
     - Carbon Intensity: 0
     - Cost: 0

3. **Enable API Connection**
   - Toggle "Enable API" switch
   - Select API Provider (SolarEdge or Enphase)
   - Enter API Key (any value for mock)
   - Enter Site/System ID (any value for mock)
   - Select update frequency
   - Click "Test Connection"
   - Should see "Connected" with mock power data

4. **Save Configuration**
   - Click "Save All Connections"
   - Data persists in database
   - Refresh page to verify

## Production Implementation Roadmap

### Phase 1: Real API Integration
- [ ] Implement SolarEdge API client
  - Endpoint: `https://monitoringapi.solaredge.com/site/{siteId}/currentPowerFlow.json?api_key={apiKey}`
  - Handle rate limits (300 requests/day per site)
  - Parse response and map to our data model

- [ ] Implement Enphase OAuth 2.0 flow
  - Set up OAuth app in Enphase Developer Portal
  - Implement authorization flow
  - Implement token refresh mechanism
  - Endpoint: `https://api.enphaseenergy.com/api/v2/systems/{systemId}/summary`
  - Handle rate limits (10 requests/minute)

### Phase 2: Data Persistence & Background Jobs
- [ ] Create `api_data_cache` table for storing fetched data
- [ ] Implement background job scheduler (cron or queue-based)
- [ ] Set up automatic data fetching based on update frequency
- [ ] Implement data retention policy
- [ ] Add error logging and retry mechanism

### Phase 3: Real-time Updates
- [ ] Implement webhook support for providers that offer it
- [ ] Add WebSocket for live dashboard updates
- [ ] Implement data streaming pipeline

### Phase 4: Analytics & Monitoring
- [ ] Dashboard for viewing real-time data
- [ ] Historical data visualization
- [ ] Alert system for anomalies
- [ ] API health monitoring dashboard

### Phase 5: Scalability
- [ ] Implement connection pooling
- [ ] Add Redis caching layer
- [ ] Set up API request queuing
- [ ] Implement circuit breakers for failing APIs

## File Structure
```
app/
├── data-connections/
│   ├── page.tsx              # Main UI component
│   └── README.md             # This file
├── api/
│   ├── energy-sources/
│   │   └── route.ts          # CRUD for energy sources
│   ├── meters/
│   │   └── route.ts          # Fetch meters with sites
│   └── test-solar-connection/
│       └── route.ts          # Test API connection (mock)
└── db/
    └── schema.ts             # Database schema including energy_sources
```

## API Credentials (Production)

### SolarEdge
- Sign up at: https://monitoring.solaredge.com/
- Generate API key in Account Settings
- Find Site ID in site details

### Enphase
- Register at: https://developer.enphase.com/
- Create OAuth application
- Get Client ID and Client Secret
- Implement OAuth flow to get access tokens

## Notes
- API credentials stored in metadata JSONB field (encrypted in production)
- Connection testing validates credentials before saving
- Update frequency determines background job schedule
- Each provider has different rate limits - implement accordingly
- Consider implementing a unified interface for all providers
