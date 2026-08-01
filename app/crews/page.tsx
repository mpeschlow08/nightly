import Link from "next/link";

import { blockUserAction, createMeetRequestAction, createSocialGroupAction, endNightOutAction, respondFriendRequestAction, sendFriendRequestAction, startNightOutAction, toggleFriendFavoriteAction, toggleFriendMuteAction, updateSocialProfileAction } from "./actions";
import { archiveDirectConversationAction, deleteDirectConversationAction, markDirectConversationReadAction, sendDirectMessageAction } from "./social-actions";
import { getSocialActor } from "./lib/auth";
import { getDirectConversationOverview, getSocialDashboardData, searchSocialPlatform } from "@/lib/social/data";

type CrewsPageProps = {
  searchParams: Promise<{ q?: string; conversation?: string }>;
};

export default async function CrewsPage({ searchParams }: CrewsPageProps) {
  const actor = await getSocialActor();
  const params = await searchParams;
  const searchQuery = params.q?.trim() ?? "";
  const selectedConversationId = Number(params.conversation) || null;
  const [data, directConversations, searchResults] = await Promise.all([
    getSocialDashboardData(),
    getDirectConversationOverview(),
    searchQuery ? searchSocialPlatform(searchQuery) : Promise.resolve(null),
  ]);
  const selectedSession = data.nightOutSessions[0] ?? null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <section className="rounded-[1.7rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_80px_rgba(232,121,249,0.08)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-fuchsia-200/80">Social Circle</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Friends, groups, and nightlife presence</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-300">Database-backed friend requests, favorite friends, group planning, presence, and meetup tools.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Role: {actor.role}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Code: {data.profile.friendCode}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Friends: {data.friends.length}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Groups: {data.groups.length}</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Requests: {data.requests.length}</span>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Social profile</h2>
            <form action={updateSocialProfileAction} className="mt-4 grid gap-3">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Display name</span><input name="displayName" defaultValue={data.profile.displayName} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Handle</span><input name="handle" defaultValue={data.profile.handle} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Bio</span><textarea name="bio" defaultValue={data.profile.bio ?? ""} rows={3} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Interests, one per line</span><textarea name="interests" defaultValue={data.profile.interests.join("\n")} rows={3} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Nightlife personality</span><textarea name="nightlifePersonality" defaultValue={data.profile.nightlifePersonality ?? ""} rows={2} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Favorite genres</span><textarea name="favoriteGenres" defaultValue={data.profile.favoriteGenres.join("\n")} rows={3} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Favorite venues</span><textarea name="favoriteVenues" defaultValue={data.profile.favoriteVenues.join("\n")} rows={3} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Favorite DJs</span><textarea name="favoriteDjs" defaultValue={data.profile.favoriteDjs.join("\n")} rows={2} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
                <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Favorite neighborhoods</span><textarea name="favoriteNeighborhoods" defaultValue={data.profile.favoriteNeighborhoods.join("\n")} rows={2} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Visibility</span><select name="visibility" defaultValue={data.profile.visibility} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"><option value="public">Public</option><option value="friends">Friends</option><option value="close_friends">Close friends</option><option value="private">Private</option></select></label>
              <button type="submit" className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-3 text-sm font-medium text-fuchsia-100">Save profile</button>
            </form>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Incoming requests</h2>
            <div className="mt-4 space-y-3">
              {data.requests.length === 0 ? <p className="text-sm text-zinc-400">No incoming requests.</p> : null}
              {data.requests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-semibold text-white">{request.requesterProfile?.displayName ?? "Nightly friend"}</p>
                  <p className="mt-1 text-xs text-zinc-400">{request.requesterProfile?.handle ?? "@nightly"} • {request.requesterProfile?.sharedFriendsCount ?? 0} mutual friends</p>
                  <p className="mt-2 text-sm text-zinc-300">{request.message ?? "No note attached."}</p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <form action={respondFriendRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="accepted" />
                      <button type="submit" className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">Accept</button>
                    </form>
                    <form action={respondFriendRequestAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="declined" />
                      <input name="reason" placeholder="Optional reason" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" />
                    </form>
                    <form action={blockUserAction} className="grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input type="hidden" name="blockedUserId" value={request.requesterUserId} />
                      <input name="reason" placeholder="Block reason" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" />
                      <button type="submit" className="rounded-full border border-rose-300/30 bg-rose-500/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-rose-100">Block</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Friends</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {data.friends.length === 0 ? <p className="text-sm text-zinc-400">No friends yet.</p> : null}
              {data.friends.map((friend) => (
                <div key={friend.userId} className="rounded-[1.2rem] border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-semibold text-white">{friend.displayName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{friend.handle}</p>
                  <p className="mt-2 text-xs text-zinc-500">{friend.mutualFriends} mutual friends</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={toggleFriendFavoriteAction}>
                      <input type="hidden" name="friendUserId" value={friend.userId} />
                      <input type="hidden" name="isCloseFriend" value={friend.isCloseFriend ? "false" : "true"} />
                      <button type="submit" className="rounded-full border border-violet-300/30 bg-violet-500/15 px-3 py-2 text-xs text-violet-100">{friend.isCloseFriend ? "Unset close" : "Close friend"}</button>
                    </form>
                    <form action={toggleFriendMuteAction}>
                      <input type="hidden" name="friendUserId" value={friend.userId} />
                      <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">Mute</button>
                    </form>
                    <form action={blockUserAction}>
                      <input type="hidden" name="blockedUserId" value={friend.userId} />
                      <button type="submit" className="rounded-full border border-rose-300/30 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">Block</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Direct messages</h2>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">{directConversations.length} conversations</span>
            </div>
            <div className="mt-4 space-y-3">
              {directConversations.length === 0 ? <p className="text-sm text-zinc-400">No direct conversations yet.</p> : null}
              {directConversations.map((conversation) => (
                <div key={conversation.id} className={`rounded-[1.2rem] border p-4 ${selectedConversationId === conversation.id ? "border-cyan-300/35 bg-cyan-500/10" : "border-white/10 bg-black/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{conversation.peer?.displayName ?? "Nightly friend"}</p>
                      <p className="mt-1 text-xs text-zinc-400">{conversation.peer?.handle ?? "@nightly"}</p>
                      <p className="mt-2 text-sm text-zinc-300">{conversation.latestMessage?.body ?? "Start the conversation"}</p>
                    </div>
                    {conversation.unreadCount > 0 ? <span className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-100">{conversation.unreadCount} unread</span> : null}
                  </div>
                  <form action={sendDirectMessageAction} className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
                    <input type="hidden" name="conversationId" value={conversation.id} />
                    <input type="hidden" name="friendUserId" value={conversation.peer?.userId ?? ""} />
                    <input name="body" placeholder="Send a direct message" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                    <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 text-sm text-cyan-100">Send</button>
                  </form>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={markDirectConversationReadAction}>
                      <input type="hidden" name="conversationId" value={conversation.id} />
                      <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">Mark read</button>
                    </form>
                    <form action={archiveDirectConversationAction}>
                      <input type="hidden" name="conversationId" value={conversation.id} />
                      <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">Archive</button>
                    </form>
                    <form action={deleteDirectConversationAction}>
                      <input type="hidden" name="conversationId" value={conversation.id} />
                      <button type="submit" className="rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Delete</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="space-y-6">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Start Night Out</h2>
            <form action={startNightOutAction} className="mt-4 grid gap-3">
              <input type="hidden" name="status" value="heading_out" />
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Approximate location</span><input name="approximateLocationLabel" placeholder="Midtown" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Venue label</span><input name="currentStopLabel" placeholder="Roof bar" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Location mode</span><select name="locationMode" defaultValue="approximate" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"><option value="venue_only">Venue only</option><option value="approximate">Approximate</option><option value="exact">Exact</option><option value="invisible">Invisible</option></select></label>
              <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-100">Start Night Out</button>
            </form>
            {data.presence ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-zinc-300">
                <p className="font-semibold text-white">{data.presence.status}</p>
                <p className="mt-1 text-xs text-zinc-500">{data.presence.approximateLocationLabel ?? "No location shared"}</p>
                {selectedSession ? (
                  <form action={endNightOutAction} className="mt-3">
                    <input type="hidden" name="nightOutSessionId" value={selectedSession.id} />
                    <button type="submit" className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs text-white">End session</button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Create group</h2>
            <form action={createSocialGroupAction} className="mt-4 grid gap-3">
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Group name</span><input name="name" placeholder="Friday Pulse Crew" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Description</span><textarea name="description" rows={2} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Capacity</span><input name="capacity" type="number" min={2} max={25} defaultValue={8} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <button type="submit" className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-3 text-sm font-medium text-fuchsia-100">Create group</button>
            </form>
            <div className="mt-4 space-y-3">
              {data.groups.length === 0 ? <p className="text-sm text-zinc-400">No groups yet.</p> : null}
              {data.groups.map((group) => (
                <Link key={group.id} href={`/crews/${group.slug}`} className="block rounded-2xl border border-white/10 bg-black/25 p-4 transition hover:border-fuchsia-300/30 hover:bg-fuchsia-500/10">
                  <p className="text-sm font-semibold text-white">{group.name}</p>
                  <p className="mt-1 text-xs text-zinc-400">{group.visibility} • capacity {group.capacity}</p>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Find people</h2>
            <form className="mt-4 grid gap-3">
              <input name="q" defaultValue={searchQuery} placeholder="Search friends, groups, messages, venues, events, plans" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
              <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">Search social</button>
            </form>
            {searchResults ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Friends</p>
                  <div className="mt-2 space-y-2">
                    {searchResults.friends.length === 0 ? <p className="text-sm text-zinc-500">No friend matches.</p> : null}
                    {searchResults.friends.map((candidate) => (
                      <div key={candidate.userId} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm font-semibold text-white">{candidate.displayName}</p>
                        <p className="mt-1 text-xs text-zinc-400">{candidate.handle}</p>
                        <form action={sendFriendRequestAction} className="mt-3 grid gap-2">
                          <input type="hidden" name="recipientUserId" value={candidate.userId} />
                          <input name="message" placeholder="Add a note" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" />
                          <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-3 py-2 text-xs text-cyan-100">Send request</button>
                        </form>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Groups and plans</p>
                  <div className="mt-2 space-y-2">
                    {searchResults.groups.map((group) => (
                      <Link key={group.id} href={`/crews/${group.slug}`} className="block rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm font-semibold text-white">{group.name}</p>
                        <p className="mt-1 text-xs text-zinc-400">{group.visibility}</p>
                      </Link>
                    ))}
                    {searchResults.plans.map((plan) => (
                      <div key={plan.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm font-semibold text-white">{plan.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">{plan.description ?? "No plan notes"}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Messages and nightlife</p>
                  <div className="mt-2 space-y-2">
                    {searchResults.messages.map((message) => (
                      <div key={`${message.kind}-${message.id}`} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm font-semibold text-white">{message.kind === "group" ? "Group message" : "Direct message"}</p>
                        <p className="mt-1 text-xs text-zinc-400">{message.createdAt?.toLocaleString()}</p>
                        <p className="mt-2 text-sm text-zinc-300">{message.body}</p>
                      </div>
                    ))}
                    {searchResults.venues.map((venue) => (
                      <Link key={venue.id} href={`/venues/${venue.id}`} className="block rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm font-semibold text-white">{venue.name}</p>
                        <p className="mt-1 text-xs text-zinc-400">{venue.neighborhood}</p>
                      </Link>
                    ))}
                    {searchResults.events.map((event) => (
                      <Link key={event.id} href={`/events/${event.slug}`} className="block rounded-2xl border border-white/10 bg-black/25 p-4">
                        <p className="text-sm font-semibold text-white">{event.title}</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {data.suggestions.map((candidate) => (
                  <div key={candidate.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
                    <p className="text-sm font-semibold text-white">{candidate.displayName}</p>
                    <p className="mt-1 text-xs text-zinc-400">{candidate.handle}</p>
                    <p className="mt-1 text-xs text-zinc-500">{candidate.mutualFriends} mutual friends</p>
                    <form action={sendFriendRequestAction} className="mt-3 grid gap-2">
                      <input type="hidden" name="recipientUserId" value={candidate.id} />
                      <input name="message" placeholder="Add a note" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" />
                      <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">Send request</button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Meetup tools</h2>
            <form action={createMeetRequestAction} className="mt-4 grid gap-3">
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Request type</span><select name="requestType" defaultValue="meet_here" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"><option value="meet_here">Meet Here</option><option value="im_lost">I&apos;m Lost</option><option value="find_my_friends">Find My Friends</option><option value="group_eta">Group ETA</option><option value="emergency_regroup">Emergency Regroup</option></select></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">Message</span><textarea name="message" rows={2} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <label className="block"><span className="mb-1 block text-xs uppercase tracking-[0.18em] text-zinc-500">ETA minutes</span><input name="etaMinutes" type="number" min={0} max={240} className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" /></label>
              <button type="submit" className="rounded-full border border-white/15 bg-white/5 px-4 py-3 text-sm text-white">Send meetup request</button>
            </form>
          </article>
        </aside>
      </div>
    </main>
  );
}
