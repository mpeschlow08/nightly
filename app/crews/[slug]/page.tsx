import Link from "next/link";
import { notFound } from "next/navigation";

import { createGroupInviteAction, createGroupPollAction, createNightOutPlanAction, createStoryPostAction, deleteGroupMessageAction, requestGroupJoinAction, reviewGroupJoinRequestAction, toggleGroupMessageReactionAction, transferGroupOwnershipAction, updateGroupMessageAction, voteGroupPollAction, addNightOutPlanStopAction } from "@/app/crews/social-actions";
import { createGroupMessageAction } from "@/app/crews/actions";
import { getSocialGroupPageData } from "@/lib/social/group-data";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ before?: string }>;
};

export default async function CrewDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const beforeMessageId = query.before ? Number(query.before) : null;
  const data = await getSocialGroupPageData(slug, Number.isFinite(beforeMessageId) ? beforeMessageId : null);

  if (!data) {
    notFound();
  }

  const isHost = data.group.hostUserId === data.actor.userId;

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 text-zinc-100 sm:px-6 lg:px-8">
      <section className="rounded-[1.8rem] border border-white/10 bg-zinc-950/80 p-6 shadow-[0_0_90px_rgba(34,211,238,0.08)] backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs uppercase tracking-[0.32em] text-cyan-200/80">Social Group</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">{data.group.name}</h1>
            <p className="mt-3 text-sm leading-7 text-zinc-300">{data.group.description ?? "No description yet."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{data.group.visibility}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Capacity {data.group.capacity}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Invite code {data.group.inviteCode}</span>
              {data.group.archivedAt ? <span className="rounded-full border border-amber-300/30 bg-amber-500/15 px-3 py-1 text-amber-100">Archived</span> : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-zinc-300">
            <Link href="/crews" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-zinc-100 transition hover:border-cyan-300/30">Back to crews</Link>
            {data.membership ? <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-emerald-100">Role: {data.membership.role}</span> : null}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-white">Group chat</h2>
              {data.hasMoreMessages && data.nextMessageCursor ? (
                <Link href={`/crews/${data.group.slug}?before=${data.nextMessageCursor}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-zinc-200">Load older</Link>
              ) : null}
            </div>

            {data.membership ? (
              <form action={createGroupMessageAction} className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="groupId" value={data.group.id} />
                <input type="hidden" name="groupSlug" value={data.group.slug} />
                <textarea name="body" rows={3} placeholder="Drop the next move, meetup point, or budget callout" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <div className="grid gap-3 md:grid-cols-3">
                  <input name="mentions" placeholder="Mention handles, one per line" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                  <input name="mediaUrl" placeholder="Media URL or asset placeholder" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                  <select name="messageType" defaultValue="text" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"><option value="text">Text</option><option value="image">Image</option><option value="video">Video</option><option value="voice">Voice</option><option value="reply">Reply</option></select>
                </div>
                <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-100">Send message</button>
              </form>
            ) : (
              <form action={requestGroupJoinAction} className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="groupId" value={data.group.id} />
                <textarea name="requestMessage" rows={2} placeholder="Why you want in" className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <button type="submit" className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-3 text-sm font-medium text-fuchsia-100">Request to join</button>
              </form>
            )}

            <div className="mt-5 space-y-3">
              {data.messages.length === 0 ? <p className="text-sm text-zinc-400">No messages yet.</p> : null}
              {data.messages.map((message) => (
                <div key={message.id} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{message.displayName}</p>
                      <p className="mt-1 text-xs text-zinc-400">{message.handle} • {message.createdAt?.toLocaleString()}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-zinc-300">{message.messageType}</span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm text-zinc-200">{message.body}</p>
                  {message.media.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-cyan-100">
                      {message.media.map((asset) => (
                        <a key={asset.mediaAssetId} href={asset.blobUrl} target="_blank" rel="noreferrer" className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-1.5">
                          {asset.kind}
                        </a>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-300">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{message.reactions.length} reactions</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{message.readCount} read</span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">{message.deliveredCount} delivered</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={toggleGroupMessageReactionAction}>
                      <input type="hidden" name="messageId" value={message.id} />
                      <input type="hidden" name="groupSlug" value={data.group.slug} />
                      <input type="hidden" name="emoji" value="🔥" />
                      <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white">🔥 React</button>
                    </form>
                    {message.senderUserId === data.actor.userId ? (
                      <form action={updateGroupMessageAction} className="flex flex-wrap gap-2">
                        <input type="hidden" name="messageId" value={message.id} />
                        <input type="hidden" name="groupSlug" value={data.group.slug} />
                        <input name="body" defaultValue={message.body} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white" />
                        <button type="submit" className="rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Edit</button>
                      </form>
                    ) : null}
                    {message.senderUserId === data.actor.userId || data.canModerate ? (
                      <form action={deleteGroupMessageAction}>
                        <input type="hidden" name="messageId" value={message.id} />
                        <input type="hidden" name="groupSlug" value={data.group.slug} />
                        <button type="submit" className="rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Delete</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Planning</h2>
            {data.membership ? (
              <form action={createNightOutPlanAction} className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="groupId" value={data.group.id} />
                <input name="title" placeholder="Tonight's plan title" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <textarea name="description" rows={2} placeholder="What the plan should optimize for" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <div className="grid gap-3 md:grid-cols-3">
                  <input name="budgetLabel" placeholder="$ / $$ / $$$" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                  <input name="transportationPlan" placeholder="Ride-share / walk / split" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                  <input name="aiSummary" placeholder="AI summary or optimization notes" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                </div>
                <button type="submit" className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-3 text-sm font-medium text-fuchsia-100">Create plan</button>
              </form>
            ) : null}
            <div className="mt-5 space-y-4">
              {data.plans.length === 0 ? <p className="text-sm text-zinc-400">No saved plans yet.</p> : null}
              {data.plans.map((plan) => (
                <div key={plan.id} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{plan.title}</p>
                      <p className="mt-1 text-xs text-zinc-400">{plan.budgetLabel ?? "Flexible"} • {plan.transportationPlan ?? "Transportation undecided"}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-200">{plan.members.length} members</span>
                  </div>
                  {plan.description ? <p className="mt-3 text-sm text-zinc-300">{plan.description}</p> : null}
                  <div className="mt-3 space-y-2">
                    {plan.stops.map((stop) => (
                      <div key={stop.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                        <p className="font-medium text-white">{stop.title}</p>
                        <p className="mt-1 text-xs text-zinc-400">{stop.venueName ?? stop.eventTitle ?? "Custom stop"} • ETA {stop.etaMinutes ?? "TBD"} min</p>
                      </div>
                    ))}
                  </div>
                  {data.membership ? (
                    <form action={addNightOutPlanStopAction} className="mt-3 grid gap-2 md:grid-cols-4">
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="groupSlug" value={data.group.slug} />
                      <input name="title" placeholder="Next stop" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                      <input name="arrivalWindow" placeholder="11:30 PM" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                      <input name="etaMinutes" type="number" min={0} placeholder="15" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                      <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">Add stop</button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        </section>

        <aside className="space-y-6">
          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Members</h2>
            <div className="mt-4 space-y-3">
              {data.members.map((member) => (
                <div key={member.id} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{member.displayName}</p>
                      <p className="mt-1 text-xs text-zinc-400">{member.handle} • {member.role}</p>
                    </div>
                    {isHost && member.userId !== data.actor.userId ? (
                      <form action={transferGroupOwnershipAction}>
                        <input type="hidden" name="groupId" value={data.group.id} />
                        <input type="hidden" name="targetUserId" value={member.userId} />
                        <button type="submit" className="rounded-full border border-violet-300/25 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">Transfer host</button>
                      </form>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Polls</h2>
            {data.membership ? (
              <form action={createGroupPollAction} className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="groupId" value={data.group.id} />
                <input name="question" placeholder="What should be the final stop?" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <textarea name="options" rows={3} placeholder="One option per line" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <button type="submit" className="rounded-full border border-cyan-300/30 bg-cyan-500/20 px-4 py-3 text-sm font-medium text-cyan-100">Create poll</button>
              </form>
            ) : null}
            <div className="mt-5 space-y-3">
              {data.polls.length === 0 ? <p className="text-sm text-zinc-400">No polls yet.</p> : null}
              {data.polls.map((poll) => (
                <div key={poll.id} className="rounded-[1.2rem] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{poll.question}</p>
                  <div className="mt-3 space-y-2">
                    {poll.options.map((option) => {
                      const voteCount = poll.votes.filter((vote) => vote.optionLabel === option).length;
                      return (
                        <form key={option} action={voteGroupPollAction} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                          <input type="hidden" name="pollId" value={poll.id} />
                          <input type="hidden" name="optionLabel" value={option} />
                          <span className="text-sm text-zinc-200">{option}</span>
                          <button type="submit" className="rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-xs text-white">Vote • {voteCount}</button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Invites and requests</h2>
            {data.canModerate ? (
              <form action={createGroupInviteAction} className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <input type="hidden" name="groupId" value={data.group.id} />
                <input name="inviteeUserId" type="number" placeholder="Invitee user ID" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <input name="expiresAt" type="datetime-local" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <button type="submit" className="rounded-full border border-fuchsia-300/30 bg-fuchsia-500/20 px-4 py-3 text-sm font-medium text-fuchsia-100">Create invite</button>
              </form>
            ) : null}
            <div className="mt-5 space-y-3">
              {data.invites.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                  <p className="font-medium text-white">{invite.inviteCode}</p>
                  <p className="mt-1 text-xs text-zinc-400">{invite.status} • expires {invite.expiresAt?.toLocaleString() ?? "not set"}</p>
                </div>
              ))}
              {data.joinRequests.map((request) => (
                <div key={request.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{request.displayName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{request.handle}</p>
                  <p className="mt-2 text-sm text-zinc-300">{request.requestMessage ?? "No note attached."}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={reviewGroupJoinRequestAction}>
                      <input type="hidden" name="joinRequestId" value={request.id} />
                      <input type="hidden" name="decision" value="approve" />
                      <button type="submit" className="rounded-full border border-emerald-300/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">Approve</button>
                    </form>
                    <form action={reviewGroupJoinRequestAction}>
                      <input type="hidden" name="joinRequestId" value={request.id} />
                      <input type="hidden" name="decision" value="decline" />
                      <button type="submit" className="rounded-full border border-rose-300/25 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">Decline</button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-lg font-semibold text-white">Stories</h2>
            {data.membership ? (
              <form action={createStoryPostAction} className="mt-4 grid gap-3 rounded-[1.25rem] border border-white/10 bg-black/20 p-4">
                <input name="mediaAssetId" type="number" placeholder="Registered media asset ID" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <input name="caption" placeholder="Story caption" className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white" />
                <button type="submit" className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">Post story</button>
              </form>
            ) : null}
            <div className="mt-5 space-y-3">
              {data.stories.length === 0 ? <p className="text-sm text-zinc-400">No active stories.</p> : null}
              {data.stories.map((story) => (
                <div key={story.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-white">{story.displayName}</p>
                  <p className="mt-1 text-xs text-zinc-400">{story.handle}</p>
                  <a href={story.blobUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-full border border-cyan-300/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">Open {story.mediaKind}</a>
                  {story.caption ? <p className="mt-3 text-sm text-zinc-300">{story.caption}</p> : null}
                </div>
              ))}
            </div>
          </article>
        </aside>
      </div>
    </main>
  );
}
