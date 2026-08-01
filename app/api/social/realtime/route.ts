import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";
import { createSocialRealtimeAdapter } from "@/lib/social/realtime";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const actor = await db.query.users.findFirst({
      where: eq(users.clerkUserId, userId),
      columns: { id: true },
    });

    if (!actor) {
      return NextResponse.json({ error: "User record not found." }, { status: 404 });
    }

    const url = new URL(request.url);
    const groupId = Number(url.searchParams.get("groupId")) || null;
    const conversationId = Number(url.searchParams.get("conversationId")) || null;
    const adapter = createSocialRealtimeAdapter();

    return NextResponse.json(
      adapter.clientConfig({
        userId: actor.id,
        groupId,
        conversationId,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load realtime configuration.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}