"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";
import { filterFormQuery } from "@/components/portal/list-filter-query";

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

/**
 * Search/filter bar for admin list pages. The URL remains the source of truth,
 * but submission uses Next navigation so the transition feels in-app.
 */
export function FilterBar({
  q,
  placeholder,
  preserve,
  children,
  showApply = true,
  applyLabel = "Apply",
}: {
  q?: string;
  placeholder: string;
  preserve?: Record<string, string | undefined>;
  children?: React.ReactNode;
  /** When false, rely on Enter in search or an in-panel apply control. */
  showApply?: boolean;
  applyLabel?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const href = `${pathname}${filterFormQuery(formData)}`;
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    if (href === current) return;
    startTransition(() => {
      router.push(href, { scroll: false });
    });
  }

  return (
    <Card className="p-4 mb-4">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-2" aria-busy={pending}>
        <fieldset disabled={pending} className="contents">
          {Object.entries(preserve ?? {}).map(([key, value]) =>
            value ? <input key={key} type="hidden" name={key} value={value} /> : null,
          )}
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder={placeholder}
            className={`${inputCls} flex-1 min-w-48`}
          />
          {children}
          {showApply ? (
            <Button type="submit" size="sm" variant="outline">
              {pending ? "Applying..." : applyLabel}
            </Button>
          ) : null}
        </fieldset>
      </form>
    </Card>
  );
}
