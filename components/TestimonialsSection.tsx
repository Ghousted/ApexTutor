import { Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    quote:
      "Super laki ng improvement ng son ko in Math after just a few sessions. Before, hirap siyang sumabay sa class discussions, but now mas confident na siya mag-solve on his own. What I love most is how the tutors explain complex topics in a simple and relatable way. Sulit compared to traditional tutors charging $60/hour or more.",
    name: "Maria L.",
    role: "Parent of Grade 8 Student",
    avatar: "ML",
    color: "from-rose-300 to-orange-300",
  },
  {
    quote:
      "I used to struggle a lot with Science, especially Physics and Chemistry. The AI tutorial sessions made everything easier to understand because the lessons felt interactive and personalized. It honestly feels like learning from top teachers, but in a much more approachable way.",
    name: "Ethan R.",
    role: "Senior High School Student",
    avatar: "ER",
    color: "from-sky-300 to-indigo-300",
  },
  {
    quote:
      "Ang ganda ng mix ng English and Taglish explanations because mas naiintindihan ko yung concepts without feeling overwhelmed. The tutors really focus on helping students think critically, not just memorize formulas. I feel more prepared now to compete academically and in real-world problem solving.",
    name: "Nicole T.",
    role: "First Year College Student",
    avatar: "NT",
    color: "from-emerald-300 to-teal-300",
  },
];

const UNIVERSITIES = [
  { short: "ADMU", colors: "from-blue-500 to-blue-700", label: "Ateneo" },
  { short: "UP", colors: "from-rose-600 to-rose-800", label: "UP" },
  { short: "DLSU", colors: "from-emerald-600 to-emerald-800", label: "DLSU" },
  { short: "UST", colors: "from-yellow-500 to-yellow-700", label: "UST" },
];

export default function TestimonialsSection() {
  return (
    <>
      {/* University Trust Bar — white section */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-ink mb-10 leading-snug">
            Trusted by students from top universities
            <br className="hidden md:block" /> across the Philippines
          </h2>
          <div className="flex flex-wrap justify-center items-center gap-10">
            {UNIVERSITIES.map((u) => (
              <div
                key={u.short}
                className="flex flex-col items-center gap-2 opacity-80 hover:opacity-100 transition-opacity"
                title={u.label}
              >
                <div
                  className={`w-12 h-12 rounded-full bg-gradient-to-br ${u.colors} flex items-center justify-center shadow-sm ring-2 ring-white`}
                >
                  <span className="text-[10px] font-bold text-white tracking-tight">
                    {u.short}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials — peach section */}
      <section className="py-20 px-4 bg-gradient-to-b from-[#fde6d3] via-[#fdeede] to-[#fef5ec]">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-12">
            <Quote
              className="w-12 h-12 text-orange-200 fill-orange-200"
              strokeWidth={1}
              style={{ transform: "scaleX(-1)" }}
            />
            <h2 className="text-3xl md:text-4xl font-bold text-ink">Testimonials</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="rounded-2xl bg-white p-6 flex flex-col gap-5 shadow-sm border border-slate-100"
              >
                <p className="text-slate-700 text-sm leading-relaxed flex-1">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-3 pt-2">
                  <div
                    className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm`}
                  >
                    <span className="text-white text-xs font-bold">{t.avatar}</span>
                  </div>
                  <div>
                    <p className="text-ink font-semibold text-sm">{t.name}</p>
                    <p className="text-slate-500 text-xs">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
