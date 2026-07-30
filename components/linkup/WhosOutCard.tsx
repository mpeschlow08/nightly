import Image from "next/image";

import StatusBadge from "@/components/linkup/StatusBadge";
import type { ActiveTonightFriend, FriendProfile } from "@/data/link-up";

type Props = {
  friend: FriendProfile;
  activity: ActiveTonightFriend;
};

export default function WhosOutCard({ friend, activity }: Props) {
  return (
    <article className="nightly-card w-[16.7rem] shrink-0 rounded-[1.25rem] border border-white/10 bg-gradient-to-b from-white/[0.075] to-white/[0.03] p-4">
      <div className="flex items-start gap-3">
        <Image src={friend.avatarUrl} alt={`${friend.displayName} avatar`} width={48} height={48} className="h-12 w-12 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{friend.displayName}</p>
          <p className="truncate text-xs text-zinc-400">{activity.venue}</p>
        </div>
      </div>
      <div className="mt-3 space-y-2 text-xs text-zinc-300">
        <p>Time Arrived: {activity.arrivedAt}</p>
        <p className="line-clamp-2">{activity.details}</p>
      </div>
      <div className="mt-3">
        <StatusBadge status={friend.status} />
      </div>
      <button type="button" className="nightly-btn-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/20 bg-black/25 px-4 text-sm font-medium text-white">
        View Details
      </button>
    </article>
  );
}
