import { Select } from "@/components/ui/select";
import {
  ANNOUNCEMENT_OUTCOME_OPTIONS,
  ANNOUNCEMENT_STAGE_OPTIONS,
  audienceLabel,
  audienceValue,
} from "@/lib/announcements";

/**
 * The school audience as ONE control. Separate stage and outcome pickers would
 * let an admin leave "eliminated at" showing over an "all schools" choice.
 * Options repeat their group's wording because a collapsed native select shows
 * the option text alone, where a bare "Qualifications" says nothing.
 */
export function AnnouncementAudienceSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <Select name="audience" defaultValue={defaultValue} className="w-full">
      <option value="">{audienceLabel(null, "advanced")}</option>
      {ANNOUNCEMENT_OUTCOME_OPTIONS.map((outcome) => (
        <optgroup key={outcome.value} label={outcome.label}>
          {ANNOUNCEMENT_STAGE_OPTIONS.map((stage) => (
            <option key={stage} value={audienceValue(stage, outcome.value)}>
              {audienceLabel(stage, outcome.value)}
            </option>
          ))}
        </optgroup>
      ))}
    </Select>
  );
}
