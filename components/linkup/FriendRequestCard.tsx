import Image from "next/image";

import type { FriendRequest } from "@/data/link-up";

type Props = {
  request: FriendRequest;
};

export default function FriendRequestCard({ request }: Props) {
  return (
    <article className="nightly-card rounded-[1.2rem] border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-start gap-3">
        <Image src={request.avatarUrl} alt={`${request.displayName} avatar`} width={50} height={50} className="h-12 w-12 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{request.displayName}</p>
          <p className="truncate text-xs text-zinc-400">{request.username}</p>
          <p className="mt-1 text-xs text-zinc-300">Mutual Friends: {request.mutualFriends}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button type="button" className="nightly-btn-primary min-h-11 rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500 px-3 text-sm font-semibold text-white">
          Accept
        </button>
        <button type="button" className="nightly-btn-secondary min-h-11 rounded-full border border-white/20 bg-black/25 px-3 text-sm font-semibold text-zinc-100">
          Decline
        </button>
      </div>
    </article>
  );
}
