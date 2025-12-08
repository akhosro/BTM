import { db } from "../db";
import { recommendations } from "../db/schema";

async function addManufacturingRecs() {
  console.log("📝 Adding recommendations for Manufacturing Plant A...\\n");

  const manufacturingSiteId = "3ed267ca-06ff-4c6d-af65-08ed908aa9bf";

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  const rec1Time = new Date(todayStart);
  rec1Time.setHours(14, 0, 0, 0);

  const rec2Time = new Date(todayStart);
  rec2Time.setHours(16, 0, 0, 0);

  const recsToAdd = [
    {
      siteId: manufacturingSiteId,
      type: "cost",
      headline: "Shift production to off-peak hours",
      description: "Moving energy-intensive operations to 22:00-06:00 can reduce costs by $450/day",
      status: "pending",
      confidence: 92,
      costSavings: 450,
      co2Reduction: 2.3,
      recommendedTimeStart: rec1Time,
      supportingData: {
        peakHours: "14:00-18:00",
        offPeakHours: "22:00-06:00",
        savingsBreakdown: {
          demandCharge: 280,
          energyCharge: 170
        }
      }
    },
    {
      siteId: manufacturingSiteId,
      type: "carbon",
      headline: "Use battery storage during high-carbon period",
      description: "Grid carbon intensity peaks at 16:00-18:00. Discharge batteries to avoid 1.8 tCO₂",
      status: "pending",
      confidence: 88,
      costSavings: 120,
      co2Reduction: 1.8,
      recommendedTimeStart: rec2Time,
      supportingData: {
        carbonIntensity: {
          current: 450,
          peak: 580
        },
        batteryCapacity: "500 kWh"
      }
    },
    {
      siteId: manufacturingSiteId,
      type: "efficiency",
      headline: "Optimize HVAC schedule based on occupancy",
      description: "Reduce HVAC runtime during low-occupancy periods to save $320/day",
      status: "pending",
      confidence: 85,
      costSavings: 320,
      co2Reduction: 1.2,
      recommendedTimeStart: todayStart,
      supportingData: {
        occupancyPattern: "Peak: 08:00-17:00",
        currentSchedule: "24/7",
        proposedSchedule: "07:00-18:00"
      }
    }
  ];

  try {
    for (const rec of recsToAdd) {
      await db.insert(recommendations).values(rec);
      console.log(`✅ Added: ${rec.headline}`);
    }

    console.log(`\\n✅ Successfully added ${recsToAdd.length} recommendations for Manufacturing Plant A`);
  } catch (error) {
    console.error("❌ Error adding recommendations:", error);
    process.exit(1);
  }

  process.exit(0);
}

addManufacturingRecs();
