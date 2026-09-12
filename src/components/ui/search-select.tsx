"use client";

import * as React from "react";
import { Check, Search } from "lucide-react";
import { cn } from "../../lib/utils";
import { searchHaystackMatches } from "../../lib/search";
import { selectVariants } from "./select";
import type { VariantProps } from "class-variance-authority";

/**
 * A dropdown you can type into. Use this instead of {@link Select} when the
 * list is long enough that scanning it is work — schools, students, centres,
 * assessments — and keep the native `Select` for short fixed lists, where the
 * OS picker is better than anything we can draw (especially on a phone).
 *
 * A native `<select>` cannot host a search field, so this is a real combobox:
 * a trigger, a popup with a filter box, and a hidden input carrying the value.
 * That hidden input is the whole contract with the server — the component is
 * usable from a server component as long as `options` is plain data, so pages
 * that post to a server action keep working unchanged.
 *
 * Unlike `Select` this renders a wrapper, so `className` styles the wrapper
 * (the layout box) and the trigger always fills it.
 *
 * Note: `required` is deliberately not forwarded to the hidden input — browsers
 * refuse to validate a control they cannot focus ("not focusable"), which
 * silently wedges the whole form. Validate the field in the server action.
 */

export type SearchSelectOption = {
  value: string;
  label: string;
  /** Secondary line — e.g. a school's LGA, to tell two similar names apart. */
  hint?: string;
};

/** Beyond this many matches we stop rendering and ask for a narrower search. */
const MAX_RENDERED = 100;

/**
 * Filtering goes through the portal's shared search helper, so typing here
 * behaves exactly like every other search box in the app — token-based, so
 * "govt girls" finds "Government Girls' Sec. School" regardless of word order
 * or punctuation.
 */
function filterOptions(options: SearchSelectOption[], query: string) {
  if (!query.trim()) return options;
  return options.filter((o) => searchHaystackMatches([o.label, o.hint], query));
}

export function SearchSelect({
  name,
  options,
  defaultValue,
  value: controlledValue,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  emptyMessage = "No matches",
  disabled,
  className,
  variant,
  size,
  "aria-label": ariaLabel,
}: {
  /** Field name for the hidden input that submits with the form. */
  name?: string;
  options: SearchSelectOption[];
  defaultValue?: string;
  /** Pass to control the value; omit to let the component own it. */
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Styles the wrapper — the trigger always fills it. */
  className?: string;
  "aria-label"?: string;
} & VariantProps<typeof selectVariants>) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolled;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);

  const rootRef = React.useRef<HTMLDivElement>(null);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const id = React.useId();

  const onDark = variant === "onDark";
  const matches = React.useMemo(() => filterOptions(options, query), [options, query]);
  const shown = matches.slice(0, MAX_RENDERED);
  const selected = options.find((o) => o.value === value);

  function commit(next: string) {
    if (controlledValue === undefined) setUncontrolled(next);
    onValueChange?.(next);
    setOpen(false);
    setQuery("");
  }

  // Open focused on the search box, with the active row on the current value so
  // Enter re-picks what is already chosen rather than jumping to the top.
  React.useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const current = matches.findIndex((o) => o.value === value);
    setActiveIndex(current >= 0 ? current : 0);
    // Only on open — re-running as `matches` narrows would fight the keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Typing narrows the list under the cursor, so park it back at the top.
  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!shown.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((i) => (i + step + shown.length) % shown.length);
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActiveIndex(event.key === "Home" ? 0 : shown.length - 1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault(); // never let Enter submit the surrounding form
      const option = shown[activeIndex];
      if (option) commit(option.value);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {name ? <input type="hidden" name={name} value={value} /> : null}

      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-list`}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cn(
          selectVariants({ variant, size }),
          "w-full cursor-pointer truncate text-left",
          !selected && (onDark ? "text-white/40" : "text-muted-foreground"),
        )}
      >
        {selected?.label ?? placeholder}
      </button>

      {open ? (
        <div
          className={cn(
            "absolute z-50 mt-1 w-full min-w-56 overflow-hidden rounded-md border border-input",
            "bg-popover text-popover-foreground shadow-lg",
            onDark && "rounded-none border-white/15 bg-foreground text-white",
          )}
        >
          <div className={cn("relative border-b border-input", onDark && "border-white/15")}>
            <Search
              className={cn(
                "pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground",
                onDark && "text-white/50",
              )}
              strokeWidth={2}
            />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              aria-autocomplete="list"
              aria-controls={`${id}-list`}
              aria-activedescendant={shown[activeIndex] ? `${id}-opt-${activeIndex}` : undefined}
              className={cn(
                "w-full bg-transparent py-2 pl-8 pr-3 text-sm outline-none placeholder:text-muted-foreground",
                onDark && "placeholder:text-white/40",
              )}
            />
          </div>

          <ul ref={listRef} id={`${id}-list`} role="listbox" className="max-h-60 overflow-y-auto py-1">
            {shown.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    id={`${id}-opt-${index}`}
                    role="option"
                    aria-selected={isSelected}
                    data-active={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                      index === activeIndex && (onDark ? "bg-white/10" : "bg-primary/10"),
                    )}
                  >
                    <Check
                      className={cn(
                        "size-3.5 shrink-0",
                        onDark ? "text-primary" : "text-gold-ink",
                        !isSelected && "opacity-0",
                      )}
                      strokeWidth={2.5}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                      {option.hint ? (
                        <span className={cn("ml-2 text-xs", onDark ? "text-white/50" : "text-muted-foreground")}>{option.hint}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}

            {shown.length === 0 ? (
              <li className={cn("px-3 py-6 text-center text-sm", onDark ? "text-white/50" : "text-muted-foreground")}>{emptyMessage}</li>
            ) : null}

            {matches.length > shown.length ? (
              <li className={cn("border-t px-3 py-2 text-center text-xs", onDark ? "border-white/15 text-white/50" : "border-input text-muted-foreground")}>
                {matches.length - shown.length} more — keep typing to narrow
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
