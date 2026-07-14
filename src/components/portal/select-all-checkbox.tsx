"use client";

// Toggles every rendered checkbox that submits to the given form (i.e. the
// current page of a paginated list) — used by the registrations bulk review.
export function SelectAllCheckbox({
  formId,
  targetName,
}: {
  formId: string;
  targetName: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
      <input
        type="checkbox"
        className="size-4 accent-primary"
        aria-label="Select all on this page"
        onChange={(e) => {
          const checked = e.currentTarget.checked;
          document
            .querySelectorAll<HTMLInputElement>(
              `input[type="checkbox"][name="${targetName}"][form="${formId}"]`,
            )
            .forEach((box) => {
              box.checked = checked;
            });
        }}
      />
      Select all
    </label>
  );
}
