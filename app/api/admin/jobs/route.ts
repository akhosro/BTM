import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/session";
import { runJobManually } from "@/lib/scheduler";
import { getDatabaseStats } from "@/lib/scheduler/jobs/cleanup-expired-data";

/**
 * GET /api/admin/jobs
 * Get job status and database statistics
 */
export async function GET(request: Request) {
  try {
    await getCurrentUserId(); // Ensure user is authenticated

    const stats = await getDatabaseStats();

    return NextResponse.json({
      success: true,
      stats,
      availableJobs: [
        {
          name: "sync-energy",
          description: "Sync energy data from all connected sources",
          schedule: "Every 15 minutes",
        },
        {
          name: "sync-carbon",
          description: "Sync grid carbon intensity forecasts",
          schedule: "Every hour",
        },
        {
          name: "generate-recommendations",
          description: "Generate AI optimization recommendations",
          schedule: "Every 6 hours",
        },
        {
          name: "cleanup",
          description: "Clean up expired data",
          schedule: "Daily at 2 AM",
        },
      ],
    });
  } catch (error) {
    console.error("Error fetching job status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch job status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/jobs
 * Manually trigger a background job
 */
export async function POST(request: Request) {
  try {
    await getCurrentUserId(); // Ensure user is authenticated

    const body = await request.json();
    const { jobName } = body;

    if (!jobName) {
      return NextResponse.json(
        { error: "Missing jobName parameter" },
        { status: 400 }
      );
    }

    const validJobs = ["sync-energy", "sync-carbon", "generate-recommendations", "cleanup"];

    if (!validJobs.includes(jobName)) {
      return NextResponse.json(
        { error: `Invalid job name. Valid options: ${validJobs.join(", ")}` },
        { status: 400 }
      );
    }

    console.log(`🔧 Manually triggering job: ${jobName}`);
    const startTime = Date.now();

    await runJobManually(jobName);

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      message: `Job ${jobName} completed successfully`,
      duration,
    });
  } catch (error) {
    console.error("Error running job:", error);
    return NextResponse.json(
      {
        error: "Failed to run job",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
