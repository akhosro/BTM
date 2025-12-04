/**
 * IESO (Independent Electricity System Operator) API Service
 *
 * Fetches wholesale electricity market prices from IESO for Ontario, Canada.
 *
 * IESO provides several market price types:
 * 1. Day-Ahead Ontario Zonal Price - Day-ahead hourly price forecasts
 * 2. Real-Time Ontario Zonal Price - Actual 5-minute settlement prices
 *
 * Documentation: https://www.ieso.ca/en/Power-Data
 * Public Reports: https://reports-public.ieso.ca/public/
 */

interface IESOPriceData {
  timestamp: Date;
  price: number; // $/MWh
  priceType: "forecast" | "actual";
  forecastedAt?: Date;
  forecastHorizonHours?: number;
}

/**
 * Parse XML helper - extracts text content from XML tag
 */
function getXMLValue(xml: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}>(.*?)<\/${tagName}>`, 's');
  const match = xml.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Fetch IESO Day-Ahead (forecast) prices
 *
 * Fetches day-ahead hourly price forecasts from IESO public reports.
 * By default, fetches tomorrow's prices (the most recent forecast available).
 *
 * @param targetDate - Date to fetch forecast for (defaults to tomorrow)
 */
export async function fetchIESOForecastPrices(
  targetDate?: Date
): Promise<IESOPriceData[]> {
  try {
    // Default to today (current day's published forecast)
    const forecastDate = targetDate || new Date();
    const dateStr = forecastDate.toISOString().split('T')[0].replace(/-/g, '');

    // Construct URL for day-ahead prices
    const url = `https://reports-public.ieso.ca/public/DAHourlyOntarioZonalPrice/PUB_DAHourlyOntarioZonalPrice_${dateStr}.xml`;

    console.log(`Fetching IESO day-ahead prices from: ${url}`);

    const response = await fetch(url);

    if (!response.ok) {
      // Try with _v1 suffix (sometimes IESO publishes with version suffix)
      const urlV1 = `${url.replace('.xml', '_v1.xml')}`;
      const responseV1 = await fetch(urlV1);

      if (!responseV1.ok) {
        throw new Error(`Failed to fetch IESO forecast prices: ${response.status}`);
      }

      return await parseDAHourlyOntarioZonalPrice(await responseV1.text());
    }

    const xmlData = await response.text();
    return await parseDAHourlyOntarioZonalPrice(xmlData);
  } catch (error) {
    console.error("Error fetching IESO forecast prices:", error);
    throw new Error(`Failed to fetch IESO forecast prices: ${error}`);
  }
}

/**
 * Parse Day-Ahead Hourly Ontario Zonal Price XML
 */
async function parseDAHourlyOntarioZonalPrice(
  xmlData: string
): Promise<IESOPriceData[]> {
  const prices: IESOPriceData[] = [];

  // Extract metadata
  const deliveryDateStr = getXMLValue(xmlData, 'DeliveryDate');
  const createdAtStr = getXMLValue(xmlData, 'CreatedAt');

  if (!deliveryDateStr) {
    throw new Error('Invalid XML: Missing DeliveryDate');
  }

  const deliveryDate = new Date(deliveryDateStr);
  const forecastedAt = createdAtStr ? new Date(createdAtStr) : new Date();

  // Extract all HourlyPriceComponents blocks
  const hourlyBlocks = xmlData.match(/<HourlyPriceComponents>[\s\S]*?<\/HourlyPriceComponents>/g);

  if (!hourlyBlocks) {
    throw new Error('Invalid XML: No HourlyPriceComponents found');
  }

  for (const block of hourlyBlocks) {
    const pricingHourStr = getXMLValue(block, 'PricingHour');
    const zonalPriceStr = getXMLValue(block, 'ZonalPrice');

    if (!pricingHourStr || !zonalPriceStr) continue;

    const pricingHour = parseInt(pricingHourStr, 10);
    const zonalPrice = parseFloat(zonalPriceStr);

    // Create timestamp for this hour
    // Note: IESO uses hour 1-24, where hour 1 = 00:00-01:00, hour 24 = 23:00-00:00
    const timestamp = new Date(deliveryDate);
    timestamp.setHours(pricingHour - 1, 0, 0, 0);

    // Calculate forecast horizon
    const horizonMs = timestamp.getTime() - forecastedAt.getTime();
    const horizonHours = Math.round(horizonMs / (1000 * 60 * 60));

    prices.push({
      timestamp,
      price: zonalPrice,
      priceType: "forecast",
      forecastedAt,
      forecastHorizonHours: horizonHours,
    });
  }

  return prices;
}

/**
 * Fetch IESO Real-Time (actual) prices
 *
 * Fetches actual 5-minute settlement prices from IESO public reports.
 * For simplicity, this aggregates 5-minute prices to hourly averages.
 *
 * @param startDate - Start date for historical prices
 * @param endDate - End date for historical prices
 */
export async function fetchIESOActualPrices(
  startDate: Date,
  endDate: Date
): Promise<IESOPriceData[]> {
  try {
    const prices: IESOPriceData[] = [];
    const currentDate = new Date(startDate);
    const now = new Date();

    // Ensure we don't try to fetch future data
    const effectiveEndDate = endDate > now ? now : endDate;

    // Fetch hourly data for each hour in the date range
    while (currentDate < effectiveEndDate) {
      const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '');
      // IESO uses 1-24 hour format (not 0-23), where hour 1 = 00:00-01:00
      const iesoHour = currentDate.getHours() + 1;
      const hourStr = iesoHour.toString().padStart(2, '0');

      // Construct URL for real-time prices for this specific hour
      const url = `https://reports-public.ieso.ca/public/RealtimeOntarioZonalPrice/PUB_RealtimeOntarioZonalPrice_${dateStr}${hourStr}.xml`;

      try {
        const response = await fetch(url);

        if (response.ok) {
          const xmlData = await response.text();
          const hourlyPrices = await parseRealtimeOntarioZonalPrice(xmlData, currentDate);
          prices.push(...hourlyPrices);
        } else {
          console.warn(`No data available for ${dateStr} hour ${hourStr} (HTTP ${response.status})`);
        }
      } catch (error) {
        // Skip this hour if data not available
        console.warn(`Error fetching data for ${dateStr} hour ${hourStr}:`, error);
      }

      // Move to next hour
      currentDate.setHours(currentDate.getHours() + 1);
    }

    console.log(`Fetched ${prices.length} actual price records`);
    return prices;
  } catch (error) {
    console.error("Error fetching IESO actual prices:", error);
    throw new Error(`Failed to fetch IESO actual prices: ${error}`);
  }
}

/**
 * Parse Real-Time Ontario Zonal Price XML
 * Aggregates 5-minute intervals to hourly average
 */
async function parseRealtimeOntarioZonalPrice(
  xmlData: string,
  baseTime: Date
): Promise<IESOPriceData[]> {
  // Extract the delivery date and hour
  // Format is: "For 2025-08-20 - Hour 1"
  const deliveryDateValue = getXMLValue(xmlData, 'DeliveryDate');

  if (!deliveryDateValue) {
    throw new Error('Invalid XML: Missing DeliveryDate');
  }

  // Parse the delivery date format: "For 2025-08-20 - Hour 1"
  const match = deliveryDateValue.match(/For (\d{4}-\d{2}-\d{2}) - Hour (\d+)/);
  if (!match) {
    throw new Error(`Invalid DeliveryDate format: ${deliveryDateValue}`);
  }

  const deliveryDateStr = match[1];  // "2025-08-20"
  const deliveryHourStr = match[2];   // "1"

  // Extract interval prices from the XML
  // Format: <OntarioZonalPriceInterval1><Interval1>28.94</Interval1>...</OntarioZonalPriceInterval1>
  const intervalPrices: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const valueStr = getXMLValue(xmlData, `Interval${i}`);
    if (valueStr && valueStr !== '') {
      const price = parseFloat(valueStr);
      if (!isNaN(price)) {
        intervalPrices.push(price);
      }
    }
  }

  if (intervalPrices.length === 0) {
    // No valid prices found, return empty array
    return [];
  }

  // Calculate average price for the hour
  const avgPrice = intervalPrices.reduce((a, b) => a + b, 0) / intervalPrices.length;

  // Create timestamp for this hour
  // IESO uses 1-24 hour format, where hour 1 = 00:00-01:00, hour 24 = 23:00-00:00
  const timestamp = new Date(deliveryDateStr);
  const iesoHour = parseInt(deliveryHourStr, 10);
  // Convert IESO hour (1-24) to standard hour (0-23)
  timestamp.setHours(iesoHour - 1, 0, 0, 0);

  return [{
    timestamp,
    price: Math.round(avgPrice * 100) / 100,
    priceType: "actual",
  }];
}

/**
 * Get the latest forecast for a specific timestamp
 * Useful for comparing forecasts with actual prices
 */
export async function getLatestForecastForTimestamp(
  timestamp: Date
): Promise<IESOPriceData | null> {
  const forecasts = await fetchIESOForecastPrices(timestamp);

  // Find the forecast closest to the requested timestamp
  const targetTime = timestamp.getTime();
  let closestForecast: IESOPriceData | null = null;
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
