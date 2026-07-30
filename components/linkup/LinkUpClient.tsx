"use client";

import { useMemo, useState } from "react";
import Image from "next/image";

import FriendProfileCard from "@/components/linkup/FriendProfileCard";
import FriendRequestCard from "@/components/linkup/FriendRequestCard";
import GroupPlanCard from "@/components/linkup/GroupPlanCard";
import LinkUpEmptyState from "@/components/linkup/LinkUpEmptyState";
import LinkUpSectionHeader from "@/components/linkup/LinkUpSectionHeader";
import StatusBadge from "@/components/linkup/StatusBadge";
import WhosOutCard from "@/components/linkup/WhosOutCard";
import {
  activeTonight,
  getFriendById,
  groupPlans,
  incomingRequests,
  linkUpFriends,
  meetHereArrivalTimes,
  meetHereVenues,
  privacyModes,
  recentlyAddedFriendIds,
  statusPresentation,
  upcomingPlans,
  type FriendStatus,
} from "@/data/link-up";

type Props = {
  selectedVenue?: string;
};

type MeetHereConfirmation = {
  friendName: string;
  venue: string;
  arrivalTime: string;
};

const userStatusOptions: FriendStatus[] = ["going-out", "at-home", "looking-for-plans", "at-a-venue", "offline"];

export default function LinkUpClient({ selectedVenue }: Props) {
  const [showCodeSheet, setShowCodeSheet] = useState(false);
  const [showQrSheet, setShowQrSheet] = useState(false);

  const [myStatus, setMyStatus] = useState<FriendStatus>("looking-for-plans");

  const [meetFriendId, setMeetFriendId] = useState(linkUpFriends[0]?.id ?? "");
  const [meetVenue, setMeetVenue] = useState(selectedVenue || meetHereVenues[0]);
  const [meetArrivalTime, setMeetArrivalTime] = useState(meetHereArrivalTimes[1]);
  const [confirmation, setConfirmation] = useState<MeetHereConfirmation | null>(null);

  const [privacyMode, setPrivacyMode] = useState<(typeof privacyModes)[number]>("Share Venue Only");

  const recentlyAddedFriends = useMemo(
    () => linkUpFriends.filter((friend) => recentlyAddedFriendIds.includes(friend.id)),
    [],
  );

  const activeTonightFriends = useMemo(() => {
    return activeTonight
      .map((activity) => {
        const friend = getFriendById(activity.friendId);
        if (!friend) return null;
        return { friend, activity };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, []);

  const hasFriends = linkUpFriends.length > 0;
  const hasActiveFriends = activeTonightFriends.length > 0;
  const hasRequests = incomingRequests.length > 0;
  const hasPlans = groupPlans.length > 0;

  const selectedFriend = getFriendById(meetFriendId);

  const submitMeetHere = () => {
    if (!selectedFriend || !meetVenue || !meetArrivalTime) return;

    setConfirmation({
      friendName: selectedFriend.displayName,
      venue: meetVenue,
      arrivalTime: meetArrivalTime,
    });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#04070b] text-zinc-100 antialiased">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_14%_0%,rgba(168,85,247,0.24),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(232,121,249,0.2),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(76,29,149,0.28),transparent_38%)]" />

      <main className="relative z-10 mx-auto max-w-3xl px-4 pb-28 pt-5 sm:px-5 lg:px-6">
        <section className="nightly-card nightly-fade-in overflow-hidden rounded-[1.6rem] border border-white/15 bg-gradient-to-br from-fuchsia-500/18 via-violet-500/10 to-purple-950/45 p-5 shadow-[0_28px_90px_rgba(0,0,0,0.42)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-fuchsia-100/80">Nightly Link Up</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-[2.1rem]">Find your friends. Plan in seconds.</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-200">
            See who is out, coordinate arrivals, and make plans without exposing more location detail than you want.
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setShowCodeSheet(true);
                setShowQrSheet(false);
              }}
              className="nightly-btn-primary min-h-12 rounded-full bg-white text-sm font-semibold text-zinc-900"
            >
              Add by Friend Code
            </button>
            <button
              type="button"
              onClick={() => {
                setShowQrSheet(true);
                setShowCodeSheet(false);
              }}
              className="nightly-btn-secondary min-h-12 rounded-full border border-white/20 bg-black/25 text-sm font-semibold text-white"
            >
              Scan Friend QR
            </button>
          </div>

          {showCodeSheet ? (
            <div className="mt-4 rounded-2xl border border-white/20 bg-black/35 p-4 nightly-fade-in">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200/85">Enter Nightly Friend Code</p>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Example: NIGHT-7K2A"
                  className="min-h-11 flex-1 rounded-full border border-white/20 bg-black/40 px-4 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-fuchsia-300/45 focus:outline-none"
                />
                <button type="button" className="nightly-btn-primary min-h-11 shrink-0 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-semibold text-white">
                  Send
                </button>
              </div>
            </div>
          ) : null}

          {showQrSheet ? (
            <div className="mt-4 rounded-2xl border border-white/20 bg-black/35 p-4 nightly-fade-in">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-fuchsia-200/85">Scan Friend QR</p>
              <p className="mt-2 text-sm text-zinc-300">Point your camera at a Nightly Friend QR to send a friend request.</p>
              <div className="mt-3 grid place-items-center rounded-xl border border-dashed border-fuchsia-300/30 bg-fuchsia-500/10 p-6 text-center text-xs text-fuchsia-100/90">
                Camera preview placeholder
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-6 space-y-3">
          <LinkUpSectionHeader
            eyebrow="Home"
            title="Friends Active Tonight"
            subtitle="Your fastest view of who is out right now."
          />
          {hasActiveFriends ? (
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-1">
              {activeTonightFriends.map(({ friend, activity }) => (
                <WhosOutCard key={activity.id} friend={friend} activity={activity} />
              ))}
            </div>
          ) : (
            <LinkUpEmptyState
              title="No active friends"
              description="No one is sharing live activity right now. Add more friends with Friend Code or Friend QR to build your tonight crew."
            />
          )}
        </section>

        <section className="mt-6 space-y-3">
          <LinkUpSectionHeader
            title="Incoming Friend Requests"
            subtitle="Quick review requests before heading out."
            action={<span className="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/18 px-2.5 py-1 text-[11px] font-semibold text-fuchsia-100">{incomingRequests.length}</span>}
          />

          {hasRequests ? (
            <div className="grid gap-3">
              {incomingRequests.slice(0, 2).map((request) => (
                <FriendRequestCard key={request.id} request={request} />
              ))}
            </div>
          ) : (
            <LinkUpEmptyState
              title="No requests"
              description="Your request inbox is clear. Share your Friend Code or Friend QR to meet more people tonight."
            />
          )}
        </section>

        <section className="mt-6 space-y-3">
          <LinkUpSectionHeader title="Recently Added Friends" subtitle="Keep momentum with your latest connections." />
          {hasFriends ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {recentlyAddedFriends.map((friend) => (
                <FriendProfileCard key={friend.id} friend={friend} />
              ))}
            </div>
          ) : (
            <LinkUpEmptyState
              title="No friends yet"
              description="Build your Nightly circle in seconds by adding friends through Friend Code or Friend QR."
            />
          )}
        </section>

        <section className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <LinkUpSectionHeader title="Night Out Status" subtitle="Set your status so friends know your vibe." />
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {userStatusOptions.map((status) => {
              const selected = myStatus === status;
              const details = statusPresentation[status];

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => setMyStatus(status)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-left transition ${
                    selected
                      ? "border-fuchsia-300/40 bg-fuchsia-500/14"
                      : "border-white/10 bg-black/20 hover:border-fuchsia-300/30 hover:bg-fuchsia-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <span className={`h-2.5 w-2.5 rounded-full ${details.indicatorClassName}`} />
                    {details.label}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <LinkUpSectionHeader title="Upcoming Plans" subtitle="Keep next moves visible for everyone." />
          {upcomingPlans.length > 0 ? (
            <div className="mt-3 grid gap-2">
              {upcomingPlans.map((plan) => (
                <article key={plan.id} className="rounded-xl border border-white/10 bg-black/25 p-3">
                  <p className="text-sm font-semibold text-white">{plan.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{plan.venue}</p>
                  <div className="mt-2 flex items-center justify-between text-xs text-zinc-300">
                    <span>{plan.time}</span>
                    <span>{plan.attendeeCount} attending</span>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-3">
              <LinkUpEmptyState
                title="No plans"
                description="No plans yet. Use Create Plan and Invite Friends to lock in tonight quickly."
              />
            </div>
          )}
        </section>

        <section className="mt-6 space-y-3">
          <LinkUpSectionHeader eyebrow="Social" title="Who Is Out Tonight" subtitle="Live pulse from your friend network." />
          {hasActiveFriends ? (
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pr-1">
              {activeTonightFriends.map(({ friend, activity }) => (
                <WhosOutCard key={`out-${activity.id}`} friend={friend} activity={activity} />
              ))}
            </div>
          ) : (
            <LinkUpEmptyState
              title="No active friends"
              description="Nobody has checked in yet. Encourage friends to connect with Friend Code or Friend QR first."
            />
          )}
        </section>

        <section className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <LinkUpSectionHeader eyebrow="Meet Here" title="Coordinate Arrival" subtitle="Select friend, venue, and arrival time in one flow." />
          <div className="mt-4 grid gap-3">
            <label className="space-y-1.5 text-xs text-zinc-300">
              <span className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Friend</span>
              <select
                value={meetFriendId}
                onChange={(event) => setMeetFriendId(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 focus:border-fuchsia-300/45 focus:outline-none"
              >
                {linkUpFriends.map((friend) => (
                  <option key={friend.id} value={friend.id}>
                    {friend.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs text-zinc-300">
              <span className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Venue</span>
              <select
                value={meetVenue}
                onChange={(event) => setMeetVenue(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 focus:border-fuchsia-300/45 focus:outline-none"
              >
                {meetHereVenues.map((venue) => (
                  <option key={venue} value={venue}>
                    {venue}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-xs text-zinc-300">
              <span className="font-semibold uppercase tracking-[0.12em] text-zinc-400">Arrival Time</span>
              <select
                value={meetArrivalTime}
                onChange={(event) => setMeetArrivalTime(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-white/15 bg-black/30 px-3 text-sm text-zinc-100 focus:border-fuchsia-300/45 focus:outline-none"
              >
                {meetHereArrivalTimes.map((arrivalTime) => (
                  <option key={arrivalTime} value={arrivalTime}>
                    {arrivalTime}
                  </option>
                ))}
              </select>
            </label>

            <button type="button" onClick={submitMeetHere} className="nightly-btn-primary min-h-12 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-semibold text-white">
              Confirm Meet Here
            </button>
          </div>

          {confirmation ? (
            <div className="mt-4 rounded-2xl border border-fuchsia-300/35 bg-gradient-to-r from-fuchsia-500/18 to-violet-500/16 p-4 nightly-fade-in">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-100/90">Confirmed</p>
              <p className="mt-2 text-base font-semibold text-white">You are meeting {confirmation.friendName}</p>
              <p className="mt-1 text-sm text-zinc-100">
                {confirmation.venue} at {confirmation.arrivalTime}
              </p>
              <p className="mt-2 text-xs text-zinc-200/90">This is a preview flow for launch. Live coordination backend will be added next.</p>
            </div>
          ) : null}
        </section>

        <section className="mt-6 space-y-3">
          <LinkUpSectionHeader
            eyebrow="Group Plans"
            title="Group Plans"
            subtitle="Create a plan and invite friends instantly."
            action={
              <button type="button" className="rounded-full border border-fuchsia-300/35 bg-fuchsia-500/16 px-3 py-1.5 text-xs font-semibold text-fuchsia-100">
                Create Plan
              </button>
            }
          />

          <div className="flex flex-wrap gap-2">
            <button type="button" className="nightly-btn-primary min-h-11 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-4 text-sm font-semibold text-white">
              Create Plan
            </button>
            <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-white/20 bg-black/25 px-4 text-sm font-semibold text-zinc-100">
              Invite Friends
            </button>
          </div>

          {hasPlans ? (
            <div className="grid gap-3">
              {groupPlans.map((plan) => (
                <GroupPlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          ) : (
            <LinkUpEmptyState
              title="No plans"
              description="No group plans are active. Tap Create Plan, then Invite Friends to coordinate tonight."
            />
          )}
        </section>

        <section className="mt-6 space-y-3">
          <LinkUpSectionHeader title="Friend Request Inbox" subtitle="Accept or decline requests before tonight starts." />
          {hasRequests ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {incomingRequests.map((request) => (
                <FriendRequestCard key={`inbox-${request.id}`} request={request} />
              ))}
            </div>
          ) : (
            <LinkUpEmptyState
              title="No requests"
              description="You are all caught up. Share your Friend Code and Friend QR to grow your network."
            />
          )}
        </section>

        <section className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
          <LinkUpSectionHeader title="Privacy Settings" subtitle="Control how much location detail your friends can see." />
          <div className="mt-4 space-y-2">
            {privacyModes.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPrivacyMode(mode)}
                className={`flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-sm ${
                  privacyMode === mode
                    ? "border-fuchsia-300/40 bg-fuchsia-500/14 text-white"
                    : "border-white/12 bg-black/20 text-zinc-200 hover:border-fuchsia-300/30"
                }`}
              >
                <span>{mode}</span>
                <span className="h-3 w-3 rounded-full border border-white/35 bg-black/30">
                  {privacyMode === mode ? <span className="block h-full w-full rounded-full bg-fuchsia-300" /> : null}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
          <LinkUpSectionHeader title="Current You" subtitle="Snapshot of your share state tonight." />
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
            <Image
              src="https://images.unsplash.com/photo-1512310604669-443f26c35f52?auto=format&fit=crop&w=240&q=80"
              alt="Your avatar"
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
              priority
            />
            <div>
              <p className="text-sm font-semibold text-white">You</p>
              <p className="text-xs text-zinc-400">Privacy: {privacyMode}</p>
              <div className="mt-2">
                <StatusBadge status={myStatus} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
