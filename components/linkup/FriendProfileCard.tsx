import Image from "next/image";
import Link from "next/link";

import StatusBadge from "@/components/linkup/StatusBadge";
import type { FriendProfile } from "@/data/link-up";

type Props = {
  friend: FriendProfile;
};

export default function FriendProfileCard({ friend }: Props) {
  return (
    <article className="nightly-card nightly-card-interactive rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <Image
          src={friend.avatarUrl}
          alt={`${friend.displayName} avatar`}
          width={56}
          height={56}
          className="h-14 w-14 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{friend.displayName}</p>
          <p className="truncate text-xs text-zinc-400">{friend.username}</p>
          <div className="mt-2">
            <StatusBadge status={friend.status} />
          </div>
        </div>
      </div>

      <div className="mt-3 space-y-2 text-xs text-zinc-300">
        <p className="line-clamp-2">Favorite Genres: {friend.favoriteGenres.join(" • ")}</p>
        <p>Mutual Friends: {friend.mutualFriends}</p>
      </div>

      <Link
        href={`/profile`}
        className="nightly-btn-secondary mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-full border border-white/15 bg-black/25 px-4 text-sm font-medium text-white"
      >
        View Profile
      </Link>
    </article>
  );
}
