import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/portal/ui";

// Shared search / filter / pagination controls for portal list pages.
// Everything is server-rendered: the filter bar is a plain GET form and the
// pager is plain links, so the pages stay RSCs with zero client JS.

const inputCls =
  "rounded-md border border-foreground/15 bg-card px-3 py-2 text-sm outline-none focus:border-primary";

export const filterSelectCls =
  "rounded-md border border-foreground/15 bg-card px-2 py-2 text-sm outline-none focus:border-primary";

export type ListParams = Record<string, string | undefined>;

/** Query string from params, dropping empties — page is reset unless kept explicitly. */
export function listQuery(params: ListParams) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Parse a 1-based page number from a search param. */
export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

/** Supabase .range() bounds for a 1-based page. */
export function pageBounds(page: number, pageSize: number) {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * GET-form filter bar: a search input (`q`) plus any <select> filters passed
 * as children. `preserve` carries params that aren't form fields (e.g. the
 * edition tab) through submission; page intentionally resets to 1.
 */
export function FilterBar({
  q,
  placeholder,
  preserve,
  children,
}: {
  q?: string;
  placeholder: string;
  preserve?: ListParams;
  children?: React.ReactNode;
}) {
  return (
    <Card className="p-4 mb-4">
      <form method="get" className="flex flex-wrap items-center gap-2">
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
        <Button type="submit" size="sm" variant="outline">
          Apply
        </Button>
      </form>
    </Card>
  );
}

/**
 * Numbered pager (prev · window around the current page · next). Links carry
 * every active filter; hidden when everything fits on one page.
 */
export function Pagination({
  page,
  pageCount,
  path,
  params,
}: {
  page: number;
  pageCount: number;
  path: string;
  params: ListParams;
}) {
  if (pageCount <= 1) return null;

  const href = (p: number) => `${path}${listQuery({ ...params, page: p > 1 ? String(p) : undefined })}`;

  // First, last, and a window of two around the current page; gaps become "…".
  const shown = [...new Set([1, pageCount, page - 1, page, page + 1, page - 2, page + 2])]
    .filter((p) => p >= 1 && p <= pageCount)
    .sort((a, b) => a - b);

  const items: (number | "gap")[] = [];
  for (const p of shown) {
    const prev = items[items.length - 1];
    if (typeof prev === "number" && p - prev > 1) items.push("gap");
    items.push(p);
  }

  const navCls =
    "px-4 py-2.5 text-sm font-bold uppercase tracking-wide bg-foreground/5 text-muted-foreground hover:text-foreground";

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-2 mt-6">
      {page > 1 ? (
        <Link href={href(page - 1)} className={navCls}>
          ← Prev
        </Link>
      ) : null}
      {items.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className="text-muted-foreground text-sm px-1">
            …
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-current={item === page ? "page" : undefined}
            className={`px-4 py-2.5 text-sm font-bold uppercase tracking-wide ${
              item === page
                ? "bg-primary/15 text-gold-ink"
                : "bg-foreground/5 text-muted-foreground hover:text-foreground"
            }`}
          >
            {item}
          </Link>
        ),
      )}
      {page < pageCount ? (
        <Link href={href(page + 1)} className={navCls}>
          Next →
        </Link>
      ) : null}
    </nav>
  );
}
