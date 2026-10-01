import Link from "next/link";

import FriendQrScanner from "@/components/linkup/FriendQrScanner";
import { sendFriendRequestByQrAction } from "../actions";

export default function ScanFriendQrPage() {
  return (
    <main className="nightly-page mx-auto min-h-screen max-w-2xl px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/crews" className="text-sm text-[color:var(--text-secondary)] hover:text-white">Back to Link Up</Link>
      <div className="mt-4"><FriendQrScanner action={sendFriendRequestByQrAction} /></div>
    </main>
  );
}
