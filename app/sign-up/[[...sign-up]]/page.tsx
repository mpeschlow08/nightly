import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(135deg,_#04070b_0%,_#080b14_60%,_#0b1020_100%)] px-4 py-10 text-zinc-100">
      <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-zinc-950/80 p-4 shadow-[0_0_90px_rgba(34,211,238,0.12)] backdrop-blur-xl sm:p-6">
        <div className="mb-5 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Nightly</p>
          <h1 className="mt-2 text-3xl font-semibold text-white">Create your account</h1>
          <p className="mt-2 text-sm text-zinc-400">Use Google, Apple, Facebook, email, or phone.</p>
        </div>
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" forceRedirectUrl="/select-role" />
      </div>
    </main>
  );
}
