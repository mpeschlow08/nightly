"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireDjProfileForDashboard } from "@/app/dj/lib/data";
import { endSession, prepareSession, startSession, updateSessionMediaReview, updateSessionMicrophone } from "@/lib/artist-sessions/service";

async function actor() {
  const { user, profile } = await requireDjProfileForDashboard();
  return { userId: user.id, djProfileId: profile.id };
}

function publicId(form: FormData) {
  const value = form.get("sessionId");
  if (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value)) throw new Error("artist_session_invalid");
  return value;
}

export async function checkInForSet(form: FormData) {
  const venueId = Number(form.get("venueId"));
  const session = await prepareSession(await actor(), venueId);
  revalidatePath("/dj/sessions");
  redirect(`/dj/sessions?session=${session.publicId}`);
}

export async function startMySet(form: FormData) {
  const session = await startSession(await actor(), publicId(form));
  revalidatePath("/dj/sessions");
  redirect(`/dj/sessions?session=${session.publicId}`);
}

export async function endMySet(form: FormData) {
  await endSession(await actor(), publicId(form));
  revalidatePath("/dj/sessions");
  redirect("/dj/sessions");
}

export async function setMicrophonePreference(form: FormData) {
  const id = publicId(form);
  await updateSessionMicrophone(await actor(), id, form.get("includeMicrophone") === "on");
  revalidatePath("/dj/sessions");
  redirect(`/dj/sessions?session=${id}`);
}

export async function reviewSetMoment(form: FormData) {
  const id = publicId(form);
  const mediaId = Number(form.get("mediaId"));
  const reviewState = form.get("reviewState");
  if (reviewState !== "approved" && reviewState !== "hidden") throw new Error("artist_session_media_invalid");
  await updateSessionMediaReview(await actor(), id, mediaId, reviewState);
  revalidatePath("/dj/sessions");
  redirect(`/dj/sessions?session=${id}`);
}