export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-white">Verseline</h1>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 shadow-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
