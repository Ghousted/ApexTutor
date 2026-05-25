// Curriculum catalog. Each instructor has an ordered set of lessons keyed
// to a grade band. The chat picks the student's next lesson based on their
// grade level + progress and drives the conversation toward mastering it.
//
// Adding a lesson: append to the array. Lessons are picked in `order`
// sequence within the student's grade band. The catalog is static for now —
// move to Firestore once admins need to author lessons via UI.

export interface Lesson {
  id: string;
  instructorId: string;
  order: number;             // ordering within the instructor's curriculum
  gradeBand: { min: number; max: number };
  title: string;
  objective: string;         // 1-sentence "by the end you'll be able to ..."
  calibrationQuestion: string; // a question the AI uses to gauge where the student is
  keyExamples: string[];     // 2-3 worked examples the AI can draw on
}

export const LESSONS: Lesson[] = [
  // ─── MATH (Professor Maria) ────────────────────────────────────────────
  {
    id: "math-place-value",
    instructorId: "maria-math",
    order: 1,
    gradeBand: { min: 4, max: 5 },
    title: "Place Value and Whole Numbers",
    objective:
      "Read, write, and compare whole numbers up to the millions using place value.",
    calibrationQuestion:
      "What is the value of the digit 7 in the number 47,253?",
    keyExamples: [
      "In 5,294, the digit 5 is in the thousands place (value 5000).",
      "Comparing 8,431 and 8,341: same thousands, but 4 hundreds > 3 hundreds.",
    ],
  },
  {
    id: "math-multiplication-division",
    instructorId: "maria-math",
    order: 2,
    gradeBand: { min: 4, max: 5 },
    title: "Multiplying and Dividing Whole Numbers",
    objective:
      "Confidently multiply and divide multi-digit whole numbers using place value strategies.",
    calibrationQuestion: "What's 24 × 6?",
    keyExamples: [
      "24 × 6 = (20 × 6) + (4 × 6) = 120 + 24 = 144.",
      "144 ÷ 6: how many 6s in 144? 6 × 24 = 144, so the answer is 24.",
    ],
  },
  {
    id: "math-fractions-intro",
    instructorId: "maria-math",
    order: 3,
    gradeBand: { min: 4, max: 6 },
    title: "Understanding Fractions",
    objective:
      "Name, compare, and represent fractions using parts of a whole.",
    calibrationQuestion:
      "If you cut a pizza into 8 equal slices and eat 3, what fraction is left?",
    keyExamples: [
      "3/8 means 3 out of 8 equal parts.",
      "1/2 = 2/4 = 4/8 — same amount, different ways to write it.",
    ],
  },
  {
    id: "math-fractions-add-sub",
    instructorId: "maria-math",
    order: 4,
    gradeBand: { min: 5, max: 7 },
    title: "Adding and Subtracting Fractions",
    objective:
      "Add and subtract fractions, including ones with different denominators.",
    calibrationQuestion: "What's 1/2 + 1/3?",
    keyExamples: [
      "1/2 + 1/3: common denominator 6 → 3/6 + 2/6 = 5/6.",
      "3/4 − 1/4 = 2/4 = 1/2 (same denominator, just subtract the tops).",
    ],
  },
  {
    id: "math-fractions-mul-div",
    instructorId: "maria-math",
    order: 5,
    gradeBand: { min: 5, max: 7 },
    title: "Multiplying and Dividing Fractions",
    objective:
      "Multiply and divide fractions, including by whole numbers.",
    calibrationQuestion: "What's 2/3 × 3/4?",
    keyExamples: [
      "2/3 × 3/4 = (2×3)/(3×4) = 6/12 = 1/2.",
      "1/2 ÷ 1/4 = 1/2 × 4/1 = 4/2 = 2 (multiply by the reciprocal).",
    ],
  },
  {
    id: "math-decimals",
    instructorId: "maria-math",
    order: 6,
    gradeBand: { min: 5, max: 7 },
    title: "Decimals: Place Value and Operations",
    objective:
      "Read, compare, and perform basic arithmetic with decimal numbers.",
    calibrationQuestion: "What's 0.3 + 0.45?",
    keyExamples: [
      "0.3 + 0.45 = 0.30 + 0.45 = 0.75 (align the decimal points).",
      "0.7 × 10 = 7. Multiplying by 10 shifts the decimal one place right.",
    ],
  },
  {
    id: "math-percent",
    instructorId: "maria-math",
    order: 7,
    gradeBand: { min: 6, max: 8 },
    title: "Percent: Concepts and Conversions",
    objective:
      "Convert between fractions, decimals, and percents, and find the percent of a number.",
    calibrationQuestion: "What is 25% of 80?",
    keyExamples: [
      "25% means 25 per 100, so 25/100 = 1/4.",
      "25% of 80 = (1/4) × 80 = 20.",
    ],
  },
  {
    id: "math-ratio-proportion",
    instructorId: "maria-math",
    order: 8,
    gradeBand: { min: 6, max: 8 },
    title: "Ratio and Proportion",
    objective:
      "Express, simplify, and solve problems with ratios and proportions.",
    calibrationQuestion:
      "If 2 mangoes cost ₱30, how much do 5 mangoes cost?",
    keyExamples: [
      "Ratio 2:30 simplifies to 1:15 — one mango costs ₱15.",
      "5 mangoes × ₱15 = ₱75.",
    ],
  },
  {
    id: "math-integers",
    instructorId: "maria-math",
    order: 9,
    gradeBand: { min: 6, max: 8 },
    title: "Integers and the Number Line",
    objective:
      "Add, subtract, multiply, and divide positive and negative integers.",
    calibrationQuestion: "What's −3 + 7?",
    keyExamples: [
      "−3 + 7 = 4 (think: start at −3 on the number line, move 7 right).",
      "(−2) × (−3) = 6 (negative times negative is positive).",
    ],
  },
  {
    id: "math-algebra-intro",
    instructorId: "maria-math",
    order: 10,
    gradeBand: { min: 7, max: 9 },
    title: "Introduction to Algebra: Variables and Expressions",
    objective:
      "Evaluate and simplify algebraic expressions using variables and operations.",
    calibrationQuestion: "If x = 4, what is the value of 2x + 3?",
    keyExamples: [
      "2x + 3 when x = 4: 2(4) + 3 = 8 + 3 = 11.",
      "Simplify 3a + 5a = 8a (combine like terms).",
    ],
  },
  {
    id: "math-linear-equations",
    instructorId: "maria-math",
    order: 11,
    gradeBand: { min: 7, max: 10 },
    title: "Solving Linear Equations",
    objective: "Solve one-variable linear equations using inverse operations.",
    calibrationQuestion: "Solve for x: 2x + 5 = 13.",
    keyExamples: [
      "2x + 5 = 13 → 2x = 8 → x = 4.",
      "3(x − 2) = 9 → x − 2 = 3 → x = 5.",
    ],
  },
  {
    id: "math-geometry-basics",
    instructorId: "maria-math",
    order: 12,
    gradeBand: { min: 5, max: 9 },
    title: "Geometry Basics: Perimeter, Area, Volume",
    objective:
      "Compute perimeter, area, and volume for common shapes (rectangles, triangles, circles, prisms).",
    calibrationQuestion:
      "What's the area of a rectangle with length 7 and width 4?",
    keyExamples: [
      "Area of rectangle = length × width = 7 × 4 = 28 square units.",
      "Volume of a rectangular box = l × w × h.",
    ],
  },

  // ─── SCIENCE (Professor Marco) ─────────────────────────────────────────
  {
    id: "sci-living-nonliving",
    instructorId: "marco-science",
    order: 1,
    gradeBand: { min: 4, max: 5 },
    title: "Living vs Non-Living Things",
    objective:
      "Distinguish living from non-living things using observable characteristics.",
    calibrationQuestion: "Is a candle flame living or non-living? Why?",
    keyExamples: [
      "Living things grow, reproduce, need food and air, and respond to their environment.",
      "A flame uses oxygen but doesn't grow into a baby flame — non-living.",
    ],
  },
  {
    id: "sci-plants",
    instructorId: "marco-science",
    order: 2,
    gradeBand: { min: 4, max: 5 },
    title: "Plants and Their Parts",
    objective:
      "Identify the major parts of a plant and their functions in growth and survival.",
    calibrationQuestion: "What part of the plant absorbs water from the soil?",
    keyExamples: [
      "Roots absorb water and nutrients and hold the plant in place.",
      "Leaves capture sunlight to make food through photosynthesis.",
    ],
  },
  {
    id: "sci-animals-habitats",
    instructorId: "marco-science",
    order: 3,
    gradeBand: { min: 4, max: 6 },
    title: "Animals and Habitats",
    objective:
      "Classify animals by habitat and describe adaptations that help them survive.",
    calibrationQuestion: "Why do polar bears have thick white fur?",
    keyExamples: [
      "Polar bears' thick fur insulates them in cold habitats; white fur camouflages them against ice.",
      "Fish have gills to breathe underwater — an adaptation to their aquatic habitat.",
    ],
  },
  {
    id: "sci-human-body",
    instructorId: "marco-science",
    order: 4,
    gradeBand: { min: 5, max: 7 },
    title: "The Human Body: Major Systems",
    objective:
      "Describe the function of major body systems (circulatory, respiratory, digestive, skeletal).",
    calibrationQuestion: "What does the heart do?",
    keyExamples: [
      "The heart pumps blood through the circulatory system to deliver oxygen and nutrients.",
      "Lungs exchange oxygen and carbon dioxide between air and blood.",
    ],
  },
  {
    id: "sci-solar-system",
    instructorId: "marco-science",
    order: 5,
    gradeBand: { min: 5, max: 7 },
    title: "The Solar System",
    objective:
      "Identify the planets and describe their key characteristics in order from the sun.",
    calibrationQuestion: "Which planet is closest to the sun?",
    keyExamples: [
      "Order from the sun: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune.",
      "Earth is the third planet and the only one known to support life.",
    ],
  },
  {
    id: "sci-states-of-matter",
    instructorId: "marco-science",
    order: 6,
    gradeBand: { min: 5, max: 8 },
    title: "States of Matter",
    objective:
      "Compare solids, liquids, and gases and describe how matter changes between states.",
    calibrationQuestion:
      "When water boils into steam, what state of matter does it become?",
    keyExamples: [
      "Solid: fixed shape and volume (ice). Liquid: takes container's shape, fixed volume (water). Gas: fills container (steam).",
      "Boiling water turns liquid water into water vapor — a gas.",
    ],
  },
  {
    id: "sci-energy",
    instructorId: "marco-science",
    order: 7,
    gradeBand: { min: 6, max: 9 },
    title: "Energy: Forms and Transformations",
    objective:
      "Identify forms of energy (kinetic, potential, light, heat, electrical) and how energy transforms.",
    calibrationQuestion: "What kind of energy does a moving car have?",
    keyExamples: [
      "A moving car has kinetic energy (energy of motion).",
      "When you flip a light switch, electrical energy becomes light and heat.",
    ],
  },
  {
    id: "sci-forces-motion",
    instructorId: "marco-science",
    order: 8,
    gradeBand: { min: 6, max: 9 },
    title: "Forces and Motion",
    objective:
      "Describe how forces cause objects to start, stop, or change direction, including gravity and friction.",
    calibrationQuestion:
      "What slows down a basketball rolling on the floor?",
    keyExamples: [
      "Friction between the ball and the floor opposes its motion and slows it down.",
      "Gravity pulls a dropped ball toward Earth's center.",
    ],
  },
  {
    id: "sci-weather-climate",
    instructorId: "marco-science",
    order: 9,
    gradeBand: { min: 6, max: 8 },
    title: "Weather and Climate",
    objective:
      "Distinguish weather from climate and describe the water cycle.",
    calibrationQuestion: "What's the difference between weather and climate?",
    keyExamples: [
      "Weather: day-to-day conditions (rainy today). Climate: long-term patterns (tropical, dry).",
      "Water cycle: evaporation → condensation → precipitation → collection.",
    ],
  },
  {
    id: "sci-ecosystems",
    instructorId: "marco-science",
    order: 10,
    gradeBand: { min: 5, max: 8 },
    title: "Ecosystems and the Food Chain",
    objective:
      "Describe how energy flows through an ecosystem from producers to consumers.",
    calibrationQuestion:
      "In a food chain: grass → grasshopper → frog. What does the frog eat?",
    keyExamples: [
      "Producers (plants) make their own food. Consumers eat other organisms.",
      "Frog → grasshopper → grass: energy flows up the chain.",
    ],
  },
  {
    id: "sci-atoms",
    instructorId: "marco-science",
    order: 11,
    gradeBand: { min: 7, max: 10 },
    title: "Atoms and Elements: Introduction",
    objective:
      "Describe the structure of an atom and identify common elements on the periodic table.",
    calibrationQuestion:
      "What three particles make up an atom?",
    keyExamples: [
      "Atoms have a nucleus (protons + neutrons) with electrons orbiting around it.",
      "Hydrogen (H) is the simplest element — 1 proton, 1 electron.",
    ],
  },
  {
    id: "sci-chemical-reactions",
    instructorId: "marco-science",
    order: 12,
    gradeBand: { min: 8, max: 12 },
    title: "Chemical Reactions: Basics",
    objective:
      "Recognize signs of a chemical reaction and balance simple equations.",
    calibrationQuestion: "What gas is produced when vinegar reacts with baking soda?",
    keyExamples: [
      "Vinegar + baking soda → carbon dioxide gas (the fizzing).",
      "Signs of a reaction: color change, gas, heat, light, new substance.",
    ],
  },
];

/** All lessons taught by a given instructor, sorted by curriculum order. */
export function lessonsForInstructor(instructorId: string): Lesson[] {
  return LESSONS.filter((l) => l.instructorId === instructorId).sort(
    (a, b) => a.order - b.order
  );
}

/** Look up a single lesson by id. Returns null if not found. */
export function getLesson(id: string | null | undefined): Lesson | null {
  if (!id) return null;
  return LESSONS.find((l) => l.id === id) ?? null;
}

/**
 * Pick the next lesson for a student.
 *
 * Algorithm:
 *  1. Filter to lessons taught by this instructor.
 *  2. Filter to lessons whose grade band includes the student's grade.
 *  3. Skip any lesson already marked "mastered" or "skipped".
 *  4. Return the first remaining lesson in curriculum order.
 *  5. If nothing matches grade band, fall back to the lowest-grade lesson
 *     the student hasn't done — better some progress than nothing.
 */
export function pickNextLesson({
  instructorId,
  gradeLevel,
  masteredIds,
  skippedIds = [],
}: {
  instructorId: string;
  gradeLevel: number;
  masteredIds: string[];
  skippedIds?: string[];
}): Lesson | null {
  const all = lessonsForInstructor(instructorId);
  const completed = new Set([...masteredIds, ...skippedIds]);

  // Preferred: in grade band and not done.
  const inBand = all.filter(
    (l) =>
      gradeLevel >= l.gradeBand.min &&
      gradeLevel <= l.gradeBand.max &&
      !completed.has(l.id)
  );
  if (inBand.length > 0) return inBand[0];

  // Fallback: any incomplete lesson (lowest grade first).
  const remaining = all.filter((l) => !completed.has(l.id));
  return remaining[0] ?? null;
}
