// Convert LaTeX-flavored text (as written by Groq) into natural English suitable
// for text-to-speech. Strips delimiters, converts common LaTeX commands to
// spoken equivalents, and normalizes whitespace.
//
// Scope: covers the math Maria/Marco actually write — fractions, exponents,
// roots, sums, integrals, Greek letters, basic operators. Doesn't try to be
// a full LaTeX renderer. If we ever need fuller coverage, swap to
// speech-rule-engine.

/** Public entry point. Pass any message content; get a TTS-friendly string. */
export function latexToSpeech(input: string): string {
  if (!input) return "";

  let s = input;

  // 1. Drop fenced code blocks and inline code — TTS shouldn't try to read code.
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, " $1 ");

  // 2. Extract math regions. Process display ($$...$$) first so they don't
  //    get re-matched as two adjacent inline expressions.
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (_, expr) => " " + speakMath(expr) + " ");
  s = s.replace(/\$([^$\n]+?)\$/g, (_, expr) => " " + speakMath(expr) + " ");

  // 3. Strip remaining markdown symbols that would otherwise be read literally.
  s = s.replace(/[*_#>`~]+/g, " ");
  // Strip Markdown link/image syntax — keep the text only.
  s = s.replace(/!?\[([^\]]+)\]\([^)]+\)/g, "$1");

  // 4. Normalize whitespace.
  s = s.replace(/\s+/g, " ").trim();
  return s;
}

/** Convert a chunk of LaTeX (without delimiters) into spoken English. */
function speakMath(expr: string): string {
  let m = expr;

  // \frac{a}{b} — handles one level of nesting via inner speakMath recursion.
  m = m.replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, a, b) => {
    const num = speakMath(a).trim();
    const den = speakMath(b).trim();
    return ` ${pronounceFraction(num, den)} `;
  });

  // \sqrt[n]{x} → nth root of x; \sqrt{x} → square root of x
  m = m.replace(/\\sqrt\s*\[([^\]]+)\]\s*\{([^{}]+)\}/g, (_, n, x) => {
    return ` ${ordinal(n.trim())} root of ${speakMath(x).trim()} `;
  });
  m = m.replace(/\\sqrt\s*\{([^{}]+)\}/g, (_, x) => {
    return ` square root of ${speakMath(x).trim()} `;
  });

  // Bounded operators: \int_a^b, \sum_{a}^{b}
  m = m.replace(/\\int_\{?([^{}\s]+)\}?\^\{?([^{}\s]+)\}?/g, " integral from $1 to $2 ");
  m = m.replace(/\\sum_\{?([^{}\s]+)\}?\^\{?([^{}\s]+)\}?/g, " sum from $1 to $2 ");
  m = m.replace(/\\int/g, " integral ");
  m = m.replace(/\\sum/g, " sum ");
  m = m.replace(/\\prod/g, " product ");
  m = m.replace(/\\lim_\{?([^{}]+)\}?/g, " limit as $1 ");
  m = m.replace(/\\lim/g, " limit ");

  // Exponents:
  //   x^{n+1}  → x to the (n plus 1)   (braced — handle first)
  //   x^2      → x squared
  //   x^3      → x cubed
  //   x^n / x^4+ → x to the n
  m = m.replace(/\^\{([^{}]+)\}/g, (_, n) => " to the " + speakMath(n).trim() + " ");
  m = m.replace(/\^2\b/g, " squared ");
  m = m.replace(/\^3\b/g, " cubed ");
  m = m.replace(/\^(-?\d+)/g, " to the $1 ");
  m = m.replace(/\^([a-zA-Z])/g, " to the $1 ");

  // Subscripts: x_1 → x sub 1, x_{abc} → x sub abc
  m = m.replace(/_\{([^{}]+)\}/g, (_, n) => " sub " + speakMath(n).trim() + " ");
  m = m.replace(/_(\w)/g, " sub $1 ");

  // Greek letters
  const greek: Record<string, string> = {
    alpha: "alpha", beta: "beta", gamma: "gamma", delta: "delta",
    epsilon: "epsilon", varepsilon: "epsilon", zeta: "zeta", eta: "eta",
    theta: "theta", vartheta: "theta", iota: "iota", kappa: "kappa",
    lambda: "lambda", mu: "mu", nu: "nu", xi: "xi", omicron: "omicron",
    pi: "pi", varpi: "pi", rho: "rho", varrho: "rho", sigma: "sigma",
    varsigma: "sigma", tau: "tau", upsilon: "upsilon", phi: "phi",
    varphi: "phi", chi: "kai", psi: "psi", omega: "omega",
    Gamma: "capital gamma", Delta: "delta", Theta: "theta",
    Lambda: "lambda", Xi: "xi", Pi: "pi", Sigma: "sigma",
    Upsilon: "upsilon", Phi: "phi", Psi: "psi", Omega: "omega",
  };
  for (const [name, spoken] of Object.entries(greek)) {
    m = m.replace(new RegExp(`\\\\${name}\\b`, "g"), ` ${spoken} `);
  }

  // Operators & relations
  const ops: Array<[RegExp, string]> = [
    [/\\cdot|\\times/g, " times "],
    [/\\div/g, " divided by "],
    [/\\pm/g, " plus or minus "],
    [/\\mp/g, " minus or plus "],
    [/\\leq|\\le\b/g, " less than or equal to "],
    [/\\geq|\\ge\b/g, " greater than or equal to "],
    [/\\neq|\\ne\b/g, " not equal to "],
    [/\\approx/g, " approximately equals "],
    [/\\equiv/g, " is equivalent to "],
    [/\\infty/g, " infinity "],
    [/\\to|\\rightarrow|\\Rightarrow/g, " arrow "],
    [/\\leftarrow|\\Leftarrow/g, " left arrow "],
    [/\\in\b/g, " in "],
    [/\\notin\b/g, " not in "],
    [/\\cup/g, " union "],
    [/\\cap/g, " intersect "],
    [/\\subset/g, " subset of "],
    [/\\angle/g, " angle "],
    [/\\perp/g, " perpendicular to "],
    [/\\parallel/g, " parallel to "],
    [/\\degree|\\circ/g, " degrees "],
  ];
  for (const [pat, word] of ops) m = m.replace(pat, word);

  // Bare ASCII relation signs (inside $...$ context)
  m = m.replace(/<=|≤/g, " less than or equal to ");
  m = m.replace(/>=|≥/g, " greater than or equal to ");
  m = m.replace(/!=|≠/g, " not equal to ");

  // Strip remaining LaTeX braces, slashes, and any unhandled \commands
  m = m.replace(/\\[a-zA-Z]+/g, " ");
  m = m.replace(/[{}]/g, " ");
  m = m.replace(/\\/g, " ");

  // Replace bare math symbols with spoken forms
  m = m.replace(/=/g, " equals ");
  m = m.replace(/\+/g, " plus ");
  // Minus between alphanumerics (don't break hyphenated words)
  m = m.replace(/(\d|\w)\s*-\s*(\d|\w)/g, "$1 minus $2");

  return m.replace(/\s+/g, " ").trim();
}

function pronounceFraction(num: string, den: string): string {
  const nice: Record<string, string> = {
    "1/2": "one half",
    "1/3": "one third",
    "2/3": "two thirds",
    "1/4": "one quarter",
    "3/4": "three quarters",
    "1/5": "one fifth",
    "1/6": "one sixth",
    "1/10": "one tenth",
  };
  const key = `${num}/${den}`;
  if (nice[key]) return nice[key];
  return `${num} over ${den}`;
}

function ordinal(n: string): string {
  const map: Record<string, string> = {
    "2": "square",
    "3": "cube",
    "4": "fourth",
    "5": "fifth",
    "6": "sixth",
    "7": "seventh",
    "8": "eighth",
    "9": "ninth",
    "10": "tenth",
  };
  return map[n] ?? `${n}th`;
}
