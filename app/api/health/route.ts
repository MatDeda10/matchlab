import { NextResponse } from "next/server";
import { getDataSource } from "@/lib/api";
import { APP, DATA_SOURCE, MODEL } from "@/lib/config/constants";
import { countRows, getSourceMetadata } from "@/lib/db/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const source = getDataSource();
  try {
    return NextResponse.json(
      {
        status: "ok",
        app: { name: APP.name, version: APP.version },
        model: MODEL.version,
        provider: {
          requested: DATA_SOURCE.provider,
          active: source.provider.id,
          configured: source.configured,
          capabilities: source.capabilities,
        },
        database: {
          fixtures: countRows("fixtures"),
          teams: countRows("teams"),
          competitions: countRows("competitions"),
          statistics: countRows("fixture_statistics"),
          odds: countRows("odds_snapshots"),
          predictions: countRows("predictions"),
          scenarios: countRows("scenarios"),
        },
        lastSync: getSourceMetadata(1)[0] ?? null,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health]", error);
    return NextResponse.json(
      { status: "error", message: "Database o configurazione non disponibili." },
      { status: 503 },
    );
  }
}
