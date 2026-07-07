// Innovation & Pitch Studio — Design Thinking + Business Model Canvas.

export const DESIGN_STAGES = [
  { key: "empathize", title: "Empathize", desc: "Understand the real problems your neighbours face — talk to them, observe, listen." },
  { key: "define", title: "Define", desc: "Frame the core problem as a clear, human-centred challenge statement." },
  { key: "ideate", title: "Ideate", desc: "Brainstorm many possible solutions — quantity over judgement." },
  { key: "prototype", title: "Prototype", desc: "Build a rough, cheap version of your best idea to make it real." },
  { key: "test", title: "Test", desc: "Put the prototype in front of real people and learn from their reactions." },
] as const;

export type DesignStageKey = (typeof DESIGN_STAGES)[number]["key"];

// Nine blocks of the Business Model Canvas (guide §3.4), laid out row by row.
export const BMC_BLOCKS = [
  { key: "key_partners", title: "Key Partners" },
  { key: "key_activities", title: "Key Activities" },
  { key: "key_resources", title: "Key Resources" },
  { key: "value_props", title: "Value Propositions" },
  { key: "customer_relationships", title: "Customer Relationships" },
  { key: "channels", title: "Channels" },
  { key: "customer_segments", title: "Customer Segments" },
  { key: "cost_structure", title: "Cost Structure" },
  { key: "revenue_streams", title: "Revenue Streams" },
] as const;

export type BmcBlockKey = (typeof BMC_BLOCKS)[number]["key"];

// Curated free platforms (guide §6.3).
export const PITCH_LINKS = [
  { title: "Stanford d.school K12", href: "https://dloft.stanford.edu/resources/educator-designed-curriculum", note: "Design Thinking toolkits" },
  { title: "EIX Resource Hub", href: "https://eiexchange.com/educator-resources-hub", note: "Customer discovery & pitch design" },
  { title: "HP LIFE — Design Thinking", href: "https://www.life-global.org/course/16-design-thinking", note: "Self-paced business course" },
];
