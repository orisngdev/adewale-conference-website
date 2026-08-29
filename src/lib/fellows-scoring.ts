import "server-only";

import { FELLOW_SCENARIOS, type FellowFormData, type ScenarioId } from "./fellows";

/**
 * The answer key for the Fellows scenario questions, and the only place it exists.
 *
 * `server-only` is load-bearing: importing this from a client component is a build
 * error, which is what keeps the key out of the browser bundle. Applicants see no
 * marks, no correct answers and no score — the same discipline the paper version
 * gets from switching off Google Forms' quiz feedback.
 *
 * The ids refer to `FELLOW_SCENARIOS[].options[].id`, not to positions, so the
 * options can be reordered in the shared module without silently changing the key.
 */
const ANSWER_KEY: Record<ScenarioId, string> = {
  // Letting one candidate leave early is how a paper walks out of the hall, and
  // how the rest learn that the rule is negotiable. Everyone leaves together.
  scenario1: "b",
  // Suspicion is not proof. Moving close preserves the exam for the innocent and
  // gathers what a report actually needs; announcing or seizing does neither.
  scenario2: "b",
};

export interface ScenarioScore {
  score: number;
  outOf: number;
}

export function scoreScenarios(
  data: Pick<FellowFormData, "scenario1" | "scenario2">,
): ScenarioScore {
  const score = FELLOW_SCENARIOS.reduce((total, scenario) => {
    const given = data[scenario.id];
    return total + (given && given === ANSWER_KEY[scenario.id] ? 1 : 0);
  }, 0);

  return { score, outOf: FELLOW_SCENARIOS.length };
}
