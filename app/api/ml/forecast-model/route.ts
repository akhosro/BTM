import { NextResponse } from "next/server";
import {
  trainModel,
  evaluateModel,
  getImprovedForecasts,
  type ForecastCorrectionModel,
} from "@/lib/services/ml-forecast-model";

// In-memory model store (in production, store in database or file system)
let currentModel: ForecastCorrectionModel | null = null;

/**
 * Train ML forecast improvement model
 *
 * POST /api/ml/forecast-model
 * Body: {
 *   iso: "IESO",
 *   trainStartDate: "2025-01-01",
 *   trainEndDate: "2025-08-01",
 *   testStartDate?: "2025-08-01",
 *   testEndDate?: "2025-08-15"
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      iso = "IESO",
      trainStartDate,
      trainEndDate,
      testStartDate,
      testEndDate,
    } = body;

    if (!trainStartDate || !trainEndDate) {
      return NextResponse.json(
        { error: "trainStartDate and trainEndDate are required" },
        { status: 400 }
      );
    }

    const trainStart = new Date(trainStartDate);
    const trainEnd = new Date(trainEndDate);

    console.log(`[ML Model] Training model for ${iso} from ${trainStart} to ${trainEnd}`);

    // Train the model
    const model = await trainModel(iso, trainStart, trainEnd);

    console.log(`[ML Model] Training complete: ${model.dataPoints} data points`);
    console.log(`[ML Model] MAE: ${model.stats.meanAbsoluteError}`);
    console.log(`[ML Model] MAPE: ${model.stats.meanAbsolutePercentageError}%`);

    // Store the model
    currentModel = model;

    // Evaluate on test set if provided
    let evaluation = null;
    if (testStartDate && testEndDate) {
      const testStart = new Date(testStartDate);
      const testEnd = new Date(testEndDate);

      console.log(`[ML Model] Evaluating on test set: ${testStart} to ${testEnd}`);

      evaluation = await evaluateModel(iso, testStart, testEnd, model);

      console.log(`[ML Model] Original MAE: ${evaluation.originalPerformance.mae}`);
      console.log(`[ML Model] Improved MAE: ${evaluation.improvedPerformance.mae}`);
      console.log(`[ML Model] MAE Reduction: ${evaluation.improvement.maeReduction}%`);
    }

    return NextResponse.json({
      success: true,
      message: "Model trained successfully",
      model: {
        version: model.version,
        trainedAt: model.trainedAt,
        dataPoints: model.dataPoints,
        stats: model.stats,
      },
      evaluation,
    });
  } catch (error) {
    console.error("[ML Model] Training error:", error);
    return NextResponse.json(
      {
        error: "Failed to train model",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Get improved forecasts using the trained model
 *
 * GET /api/ml/forecast-model?iso=IESO&startDate=2025-08-15&endDate=2025-08-16
 */
export async function GET(request: Request) {
  try {
    if (!currentModel) {
      return NextResponse.json(
        {
          error: "No model trained yet. Please train a model first using POST /api/ml/forecast-model",
        },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(request.url);
    const iso = searchParams.get("iso") || "IESO";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Get improved forecasts
    const improvedForecasts = await getImprovedForecasts(iso, start, end, currentModel);

    return NextResponse.json({
      success: true,
      model: {
        version: currentModel.version,
        trainedAt: currentModel.trainedAt,
        dataPoints: currentModel.dataPoints,
      },
      forecasts: improvedForecasts,
      count: improvedForecasts.length,
    });
  } catch (error) {
    console.error("[ML Model] Prediction error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate improved forecasts",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * Get current model status
 *
 * DELETE /api/ml/forecast-model - Clear current model
 */
export async function DELETE() {
  if (!currentModel) {
    return NextResponse.json(
      { error: "No model to delete" },
      { status: 404 }
    );
  }

  const deletedModel = currentModel;
  currentModel = null;

  return NextResponse.json({
    success: true,
    message: "Model deleted",
    deletedModel: {
      version: deletedModel.version,
      trainedAt: deletedModel.trainedAt,
      dataPoints: deletedModel.dataPoints,
    },
  });
}
