import { INSTRUCTORS } from "@/lib/instructors";

export const metadata = { title: "Instructors · Admin" };

export default function AdminInstructorsPage() {
  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-ink">Instructors</h1>
        <p className="text-sm text-slate-500 mt-1">
          Current roster — defined in code at <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">lib/instructors.ts</code>.
          Adding more via UI is on the roadmap (Phase 5).
        </p>
      </header>

      <div className="grid md:grid-cols-2 gap-4">
        {INSTRUCTORS.map((i) => (
          <div
            key={i.id}
            className="p-5 bg-white border border-slate-200 rounded-2xl"
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0"
                style={{ background: i.accentColor }}
              >
                {i.avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className="text-[10px] uppercase tracking-wider font-semibold"
                  style={{ color: i.accentColor }}
                >
                  {i.subject}
                </p>
                <h2 className="font-semibold text-ink">{i.name}</h2>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">{i.tagline}</p>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-slate-400">Voice</dt>
                <dd className="text-slate-700 font-mono">{i.voiceId}</dd>
              </div>
              <div>
                <dt className="text-slate-400">Free tier</dt>
                <dd className="text-slate-700">{i.freeTier ? "Yes" : "No"}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
