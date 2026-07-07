# Portal UI/UX Revamp Plan

## Why now

The portal now spans a lot of surface — four student pillars (Prep/CBT, Tech Lab, Pitch Studio, Plans), the educator area, and the admin console. It works, but it grew feature-first, so the UI has accumulated inconsistency:

- **No design tokens.** Brand colours are hardcoded hex (`text-[#4A4E5C]`, `bg-[#0A0F1E]`) in ~every file — 300+ Tailwind lint warnings, no single source of truth, no dark mode possible.
- **Ad-hoc layout.** Two ways to scaffold a page (`PortalHeader`/`PortalBody` vs. bare content under a layout) caused the double-wrap spacing bug. Spacing/typography are eyeballed, not systematic.
- **Inconsistent states.** Loading feedback was missing (just added `SubmitButton`); empty/error states differ per page; no skeletons.
- **Growing navigation.** The student sidebar is now 8 items with no grouping or icons.

Goal: one coherent, branded, accessible design system — mobile-first and low-bandwidth per the guide, TV-friendly, and fast to build new screens on.

## Direction (recommended)

**Adopt shadcn/ui properly on Tailwind v4, themed with the ASC brand as tokens.** We're already ~80% there (the `Button` uses `cva` + Radix + a `cn` util). This keeps the current brand *look* while making it systematic — and it clears the entire hardcoded-hex tech debt.

### 1. Token foundation
- Define the palette as CSS variables / `@theme`: `--background` (cream `#FAF7F0`), `--foreground` (navy `#0A0F1E`), `--primary` (gold `#E8A020`), `--muted-foreground` (`#4A4E5C`), plus `--card`, `--border`, `--input`, `--ring`, `--destructive` — and a dark variant set.
- Map the display fonts (`bebas`, `serif-display`) into the token layer.
- Migrate hardcoded hex → semantic classes (`bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`). Mechanical, no visual change, clears the 300+ warnings.

### 2. One page scaffold
- A single `PageShell` (title + optional actions slot + content) used by **every** screen, so there's exactly one way to build a page. Kills the double-wrap class of bugs and makes spacing consistent.
- Standard vertical rhythm (8-pt scale), consistent card radius/shadow, focus-visible rings.

### 3. Navigation & IA
- Group the student sidebar (e.g. **Learn**: Practice · Exams · Tech Lab · Pitch Studio — **You**: Plans · Results · Resources) and add `lucide` icons (already a dependency).
- Mobile: promote the horizontal-scroll tabs to a bottom tab bar or a drawer as the list grows.
- Consistent back-links / breadcrumbs.

### 4. Component library to standardize
shadcn primitives to add: `Card`, `Input`, `Select`, `Textarea`, `Label`, `Badge`, `Tabs`, `Dialog`/`Sheet` (→ the **registration-in-a-modal** the educator asked for), `Table`, `Progress`, `Skeleton`, `Toast` (sonner — already present). Keep the existing `Button`, `Tooltip`.
Portal patterns to formalize: `EmptyState`, `StatTile`, `SectionHeading`, `SubmitButton` (done), `FormRow`, `DataList`.

### 5. States & feedback
- Loading: `SubmitButton` (done) everywhere + `Skeleton` for data lists + route-level `loading.tsx`.
- Empty: one `EmptyState` (icon + message + CTA).
- Error: `error.tsx` boundaries + inline field errors + `sonner` toasts for save/success.

### 6. Accessibility & responsive
- ≥44px tap targets, `focus-visible` rings, aria labels, AA contrast.
- Fold the existing TV `/display` route into the system as a large-scale variant.

## Phased rollout (no big-bang)

1. **Foundation** — token theme + shadcn init (carefully, so Tailwind v4 `globals.css` isn't clobbered) + `PageShell` + core primitives (Card/Input/Select/Badge/Dialog/Skeleton). Migrate `components/portal/ui.tsx` + Button call-sites. *No visual regression; clears lint; unblocks the registration modal.*
2. **Student pillars** — migrate the student pages to primitives + EmptyState/Skeleton, grouped sidebar + icons.
3. **Educator + admin** — same treatment.
4. **Polish** — dark mode, motion, a11y audit, Lighthouse ≥90 mobile.

## Risks
- Tailwind v4 + shadcn init must not overwrite the working `globals.css` — do it by hand, not a blind `npx shadcn init`.
- Large but mechanical; done behind the token layer, the brand look is preserved throughout.

## Open decisions (need your call)
- **Visual direction:** keep the current identity (navy/gold/cream + condensed display type), or refresh/modernize the look while we're in there?
- **Dark mode:** in scope now, or defer to Phase 4?
- **Density:** current feel is airy/editorial — keep, or tighten to a denser "app" feel?
