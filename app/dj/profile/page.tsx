import { redirect } from "next/navigation";

import { requireDjProfileForDashboard } from "../lib/data";

export default async function DjPublicProfileRedirectPage() {
  const { profile } = await requireDjProfileForDashboard();
  redirect(`/dj/profile/${profile.username}`);
}
