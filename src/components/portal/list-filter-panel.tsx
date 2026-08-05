"use client";

import { ListFilter, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

const filterSelectCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-2 text-sm outline-none focus:border-primary";

/** Labelled select for use inside {@link FilterPanel}. */
export function FilterField({
  label,
  name,
  defaultValue,
  children,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <select name={name} defaultValue={defaultValue ?? ""} className={`${filterSelectCls} mt-1 w-full`}>
        {children}
      </select>
    </label>
  );
}

/**
 * Collapsible filter panel for list pages. Renders a "Filter" trigger that
 * opens criteria controls; fields stay in the parent form so search and
 * filters submit together.
 */
export function FilterPanel({
  activeCount = 0,
  preserve,
  children,
}: {
  activeCount?: number;
  preserve?: Record<string, string | undefined>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (panelRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function clearFilters() {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(preserve ?? {})) {
      if (value) search.set(key, value);
    }
    const qs = search.toString();
    const href = `${pathname}${qs ? `?${qs}` : ""}`;
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (href === current) {
      setOpen(false);
      return;
    }
    startTransition(() => {
      router.push(href, { scroll: false });
      setOpen(false);
    });
  }

  return (
    <div ref={panelRef} className="relative">
      <Button
        type="button"
        size="sm"
        variant="outline"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className={activeCount > 0 ? "border-primary/40 bg-primary/5" : undefined}
      >
        <ListFilter className="size-4" strokeWidth={2} />
        Filter
        {activeCount > 0 ? (
          <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold leading-none text-gold-ink">
            {activeCount}
          </span>
        ) : null}
      </Button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter options"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-md border border-foreground/15 bg-card p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">Filter by</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label="Close filters"
            >
              <X className="size-4" />
            </button>
          </div>

          <fieldset disabled={pending} className="space-y-3">
            {children}
            <div className="flex items-center gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1">
                {pending ? "Applying..." : "Apply filters"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending || activeCount === 0}
                onClick={clearFilters}
              >
                Clear
              </Button>
            </div>
          </fieldset>
        </div>
      ) : null}
    </div>
  );
}

/** @internal exported for tests */
export function clearFilterHref(pathname: string, preserve?: Record<string, string | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(preserve ?? {})) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return `${pathname}${qs ? `?${qs}` : ""}`;
}
