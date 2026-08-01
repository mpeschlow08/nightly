import Link from "next/link";
import { notFound } from "next/navigation";

import {
  requireReverificationAction,
  restoreUserAction,
  suspendUserAction,
} from "@/app/admin/actions";
import { getAdminUserDetail } from "@/app/admin/lib/control-center-data";
import { requireAdminPermission } from "@/app/admin/lib/permissions";

type Props = {
  params: Promise<{ userId: string }>;
};

export default async function AdminUserDetailPage({ params }: Props) {
  await requireAdminPermission("users:view");
  const { userId } = await params;
  const id = Number.parseInt(userId, 10);

  if (!Number.isFinite(id)) {
    notFound();
  }

  const detail = await getAdminUserDetail(id);

  if (!detail.user) {
    notFound();
  }

  return (
    <main className="space-y-5">
      <header>
        <Link href="/admin/users" className="text-xs uppercase tracking-[0.15em] text-cyan-300">
          Back to users
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">User #{detail.user.id}</h1>
        <p className="text-sm text-zinc-300">{detail.user.clerkUserId}</p>
      </header>

      <section className="grid gap-3 rounded-xl border border-white/10 bg-white/5 p-4 lg:grid-cols-3">
        <article>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Role</p>
          <p className="mt-1 text-white">{detail.user.role}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Account status</p>
          <p className="mt-1 text-white">{detail.user.accountStatus}</p>
        </article>
        <article>
          <p className="text-xs uppercase tracking-[0.14em] text-zinc-400">Requires re-verification</p>
          <p className="mt-1 text-white">{detail.user.requiresReverification ? "Yes" : "No"}</p>
        </article>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/5 p-4">
        <h2 className="text-lg font-semibold text-white">Sensitive controls</h2>
        <p className="mt-1 text-xs text-zinc-400">Reason is required and every action is audited with before/after state.</p>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <form action={suspendUserAction} className="space-y-2 rounded-lg border border-rose-300/30 bg-rose-500/10 p-3">
            <input type="hidden" name="userId" value={detail.user.id} />
            <label className="block text-xs text-zinc-200" htmlFor="suspend-reason">Suspend reason</label>
            <textarea id="suspend-reason" name="reason" required className="w-full rounded-md border border-white/20 bg-black/30 px-2 py-1 text-sm text-white" />
            <button type="submit" className="rounded-md border border-rose-300/40 bg-rose-500/20 px-2 py-1 text-xs uppercase tracking-[0.1em] text-rose-100">Suspend user</button>
          </form>

          <form action={restoreUserAction} className="space-y-2 rounded-lg border border-emerald-300/30 bg-emerald-500/10 p-3">
            <input type="hidden" name="userId" value={detail.user.id} />
            <label className="block text-xs text-zinc-200" htmlFor="restore-reason">Restore reason</label>
            <textarea id="restore-reason" name="reason" required className="w-full rounded-md border border-white/20 bg-black/30 px-2 py-1 text-sm text-white" />
            <button type="submit" className="rounded-md border border-emerald-300/40 bg-emerald-500/20 px-2 py-1 text-xs uppercase tracking-[0.1em] text-emerald-100">Restore user</button>
          </form>

          <form action={requireReverificationAction} className="space-y-2 rounded-lg border border-amber-300/30 bg-amber-500/10 p-3">
            <input type="hidden" name="userId" value={detail.user.id} />
            <label className="block text-xs text-zinc-200" htmlFor="reverify-reason">Re-verification reason</label>
            <textarea id="reverify-reason" name="reason" required className="w-full rounded-md border border-white/20 bg-black/30 px-2 py-1 text-sm text-white" />
            <button type="submit" className="rounded-md border border-amber-300/40 bg-amber-500/20 px-2 py-1 text-xs uppercase tracking-[0.1em] text-amber-100">Require re-verification</button>
          </form>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">Venue memberships</h3>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(detail.venueMemberships, null, 2)}</pre>
        </article>
        <article className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-semibold text-white">Admin audit trail</h3>
          <pre className="mt-2 overflow-x-auto text-xs text-zinc-300">{JSON.stringify(detail.audits, null, 2)}</pre>
        </article>
      </section>
    </main>
  );
}
