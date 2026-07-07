// Future Tech Skills Lab — Scratch → Python → Data learning path.

export const TECH_LAB_STEPS = [
  {
    key: "scratch",
    title: "Scratch — block-based coding",
    desc: "Learn the logic of programming visually, dragging blocks together.",
    href: "https://scratch.mit.edu/",
  },
  {
    key: "python",
    title: "Python fundamentals",
    desc: "Move to real code: variables, loops, functions and problem-solving.",
    href: "https://www.learnpython.org/",
  },
  {
    key: "data",
    title: "Data libraries (Pandas & NumPy)",
    desc: "Work with real data — the toolkit behind AI and data science.",
    href: "https://code.org/en-US/tools/python-lab",
  },
] as const;

export type TechLabStepKey = (typeof TECH_LAB_STEPS)[number]["key"];

// Curated free platforms (guide §6.2).
export const TECH_LAB_LINKS = [
  { title: "Code.org Python Lab", href: "https://code.org/en-US/tools/python-lab", note: "Browser Python 3 · Pandas, NumPy, Matplotlib" },
  { title: "freeCodeCamp", href: "https://www.freecodecamp.org/", note: "Project-based certifications" },
  { title: "Codecademy", href: "https://www.codecademy.com/", note: "Intro programming & data science" },
];

// Embeddable browser IDE (no server-side execution). Override via env.
export const TECH_LAB_IDE_URL =
  process.env.NEXT_PUBLIC_TECH_LAB_IDE_URL || "https://trinket.io/embed/python3";
