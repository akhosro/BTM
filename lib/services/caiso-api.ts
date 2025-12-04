/**
 * CAISO (California Independent System Operator) API Service
 *
 * Fetches wholesale electricity market prices from CAISO OASIS API.
 *
 * CAISO provides several market price types:
 * 1. Day-Ahead Market (DAM) - Day-ahead hourly price forecasts
 * 2. Real-Time Market (RTM) - 5-minute settlement prices
 *
 * OASIS API Documentation: http://oasis.caiso.com/
 * OASIS API Query: http://oasis.caiso.com/oasisapi/SingleZip
 */

interface CAISOPriceData {
  timestamp: Date;
  price: number; // $/MWh
  priceType: "forecast" | "actual";
  forecastedAt?: Date;
  forecastHorizonHours?: number;
  node?: string; // Trading hub or node name
}

/**
 * Parse CSV helper - CAISO returns data in CSV format
 */
function parseCSV(csvData: string): Array<Record<string, string>> {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim());
  const rows: Array<Record<string, string>> = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index]?.trim() || '';
    });

    rows.push(row);
  }

  return rows;
}

/**
 * Fetch CAISO Day-Ahead Market (forecast) prices
 *
 * Fetches day-ahead hourly price forecasts from CAISO OASIS API.
 * By default, fetches tomorrow's prices.
 *
 * @param targetDate - Date to fetch forecast for (defaults to tomorrow)
 * @param node - Trading hub (defaults to "TH_NP15_GEN-APND" - NP15 aggregate pricing node)
 */
export async function fetchCAISOForecastPrices(
  targetDate?: Date,
  node: string = "TH_NP15_GEN-APND"
): Promise<CAISOPriceData[]> {
  try {
    // Default to tomorrow
    const forecastDate = targetDate || new Date(Date.now() + 24 * 60 * 60 * 1000);
    const startDate = new Date(forecastDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(forecastDate);
    endDate.setHours(23, 59, 59, 999);

    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, '');

    // CAISO OASIS API query for Day-Ahead Market Prices (PRC_LMP)
    // queryname: PRC_LMP (Locational Marginal Price)
    // market_run_id: DAM (Day-Ahead Market)
    const url = new URL('http://oasis.caiso.com/oasisapi/SingleZip');
    url.searchParams.set('queryname', 'PRC_LMP');
    url.searchParams.set('startdatetime', `${startDateStr}T00:00-0000`);
    url.searchParams.set('enddatetime', `${endDateStr}T23:59-0000`);
    url.searchParams.set('version', '1');
    url.searchParams.set('market_run_id', 'DAM');
    url.searchParams.set('node', node);
    url.searchParams.set('resultformat', '6'); // CSV format

    console.log(`Fetching CAISO day-ahead prices from: ${url.toString()}`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch CAISO forecast prices: ${response.status}`);
    }

    // CAISO returns a ZIP file containing CSV data
    // For MVP, we'll use a simplified approach with direct CSV parsing
    // In production, you'd need to unzip the response
    const csvData = await response.text();
    return await parseCAISODayAheadPrices(csvData, startDate);
  } catch (error) {
    console.error("Error fetching CAISO forecast prices:", error);
    throw new Error(`Failed to fetch CAISO forecast prices: ${error}`);
  }
}

/**
 * Parse CAISO Day-Ahead Market CSV data
 */
async function parseCAISODayAheadPrices(
  csvData: string,
  forecastedAt: Date
): Promise<CAISOPriceData[]> {
  const prices: CAISOPriceData[] = [];

  try {
    const rows = parseCSV(csvData);

    for (const row of rows) {
      // CAISO CSV columns: INTERVALSTARTTIME_GMT, INTERVALENDTIME_GMT, OPR_DATE, OPR_HR, OPR_INTERVAL,
      // NODE_ID_XML, NODE_ID, NODE, MARKET_RUN_ID, LMP_TYPE, XML_DATA_ITEM, PNODE_RESMRID, GRP_TYPE,
      // POS, MW, LMP_PRC, MLC_PRC, MCC_PRC

      const timestamp = new Date(row['INTERVALSTARTTIME_GMT'] || row['OPR_DATE']);
      const lmpPrice = parseFloat(row['MW'] || row['LMP_PRC'] || '0');
      const node = row['NODE'] || row['NODE_ID'];

      if (isNaN(lmpPrice)) continue;

      // Calculate forecast horizon
      const horizonMs = timestamp.getTime() - forecastedAt.getTime();
      const horizonHours = Math.round(horizonMs / (1000 * 60 * 60));

      prices.push({
        timestamp,
        price: lmpPrice,
        priceType: "forecast",
        forecastedAt,
        forecastHorizonHours: horizonHours,
        node,
      });
    }

    return prices;
  } catch (error) {
    console.error("Error parsing CAISO day-ahead prices:", error);
    throw new Error(`Failed to parse CAISO day-ahead prices: ${error}`);
  }
}

/**
 * Fetch CAISO Real-Time Market (actual) prices
 *
 * Fetches actual 5-minute settlement prices from CAISO OASIS API.
 * For simplicity, this aggregates 5-minute prices to hourly averages.
 *
 * @param startDate - Start date for historical prices
 * @param endDate - End date for historical prices
 * @param node - Trading hub (defaults to "TH_NP15_GEN-APND")
 */
export async function fetchCAISOActualPrices(
  startDate: Date,
  endDate: Date,
  node: string = "TH_NP15_GEN-APND"
): Promise<CAISOPriceData[]> {
  try {
    const now = new Date();
    const effectiveEndDate = endDate > now ? now : endDate;

    const startDateStr = startDate.toISOString().split('T')[0].replace(/-/g, '');
    const endDateStr = effectiveEndDate.toISOString().split('T')[0].replace(/-/g, '');

    // CAISO OASIS API query for Real-Time Market Prices
    // market_run_id: RTM (Real-Time Market)
    const url = new URL('http://oasis.caiso.com/oasisapi/SingleZip');
    url.searchParams.set('queryname', 'PRC_LMP');
    url.searchParams.set('startdatetime', `${startDateStr}T00:00-0000`);
    url.searchParams.set('enddatetime', `${endDateStr}T23:59-0000`);
    url.searchParams.set('version', '1');
    url.searchParams.set('market_run_id', 'RTM');
    url.searchParams.set('node', node);
    url.searchParams.set('resultformat', '6'); // CSV format

    console.log(`Fetching CAISO real-time prices from: ${url.toString()}`);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch CAISO actual prices: ${response.status}`);
    }

    const csvData = await response.text();
    return await parseCAISORealTimePrices(csvData);
  } catch (error) {
    console.error("Error fetching CAISO actual prices:", error);
    throw new Error(`Failed to fetch CAISO actual prices: ${error}`);
  }
}

/**
 * Parse CAISO Real-Time Market CSV data
 * Aggregates 5-minute intervals to hourly averages
 */
async function parseCAISORealTimePrices(
  csvData: string
): Promise<CAISOPriceData[]> {
  try {
    const rows = parseCSV(csvData);

    // Group by hour and calculate average
    const hourlyPrices = new Map<string, { prices: number[]; node: string; timestamp: Date }>();

    for (const row of rows) {
      const timestamp = new Date(row['INTERVALSTARTTIME_GMT'] || row['OPR_DATE']);
      const lmpPrice = parseFloat(row['MW'] || row['LMP_PRC'] || '0');
      const node = row['NODE'] || row['NODE_ID'];

      if (isNaN(lmpPrice)) continue;

      // Round to nearest hour
      const hourTimestamp = new Date(timestamp);
      hourTimestamp.setMinutes(0, 0, 0);
      const hourKey = hourTimestamp.toISOString();

      if (!hourlyPrices.has(hourKey)) {
        hourlyPrices.set(hourKey, { prices: [], node, timestamp: hourTimestamp });
      }

      hourlyPrices.get(hourKey)!.prices.push(lmpPrice);
    }

    // Calculate averages
    const prices: CAISOPriceData[] = [];
    for (const [, data] of hourlyPrices) {
      const avgPrice = data.prices.reduce((a, b) => a + b, 0) / data.prices.length;

      prices.push({
        timestamp: data.timestamp,
        price: Math.round(avgPrice * 100) / 100,
        priceType: "actual",
        node: data.node,
      });
    }

    return prices.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  } catch (error) {
    console.error("Error parsing CAISO real-time prices:", error);
    throw new Error(`Failed to parse CAISO real-time prices: ${error}`);
  }
}

/**
 * Get the latest forecast for a specific timestamp
 */
export async function getLatestCAISOForecastForTimestamp(
  timestamp: Date,
  node?: string
): Promise<CAISOPriceData | null> {
  const forecasts = await fetchCAISOForecastPrices(timestamp, node);

  const targetTime = timestamp.getTime();
  let closestForecast: CAISOPriceData | null = null;
  let minDiff = Infinity;

  for (const forecast of forecasts) {
    const diff = Math.abs(forecast.timestamp.getTime() - targetTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestForecast = forecast;
    }
  }

  return closestForecast;
}
