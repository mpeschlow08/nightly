import { NextResponse } from "next/server";

import { db } from "@/db";
import { venues } from "@/db/schema";

export async function GET() {
  try {
    const venueRows = await db.select().from(venues);

    return NextResponse.json(venueRows);
  } catch (error) {
    console.error("Failed to load venues:", error);

    return NextResponse.json(
      { error: "Failed to load venues" },
      { status: 500 },
    );
  }
}