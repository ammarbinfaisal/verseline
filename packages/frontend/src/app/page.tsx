import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-white mb-3">
          Verseline
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 text-lg">Timed-text video editor</p>
      </div>

      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-6 py-2.5 rounded-lg bg-white text-zinc-950 font-medium text-sm hover:bg-zinc-100 transition-colors"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-6 py-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-300 dark:border-zinc-700"
        >
          Sign up
        </Link>
      </div>
    </main>
  );
}
