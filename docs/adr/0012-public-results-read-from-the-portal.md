# The Public Results Page Reads the Portal, Not the CMS

`/results` is rendered from `registration_stage_results` — the same row the paper-exam cut writes — joined to the school, its LGA and the Reps who advanced with it. Sanity no longer feeds this page. Only rows whose `outcome` is `advanced` are read, so a school that did not get through is never named publicly, and the podium is `state_rank` 1–3, which `commit_paper_cut` already stores. The page uses the service-role client inside `unstable_cache`, because `stage_results_read` is scoped to admins and a school's own members and the publishable key would return an empty set with no error.

## Considered options

- **Read the portal database directly (chosen).** Committing a cut publishes the page; there is one source of truth and no step between deciding and announcing. Ranks, LGA, qualifying route (`reason`) and per-Rep scores already exist on the rows the cut writes, so the page needed no schema change at all. Costs the editorial freedom Sanity gave — a theme or a photograph now has nowhere to live on this page — and means the page can only show editions the portal actually holds.
- **Keep Sanity as the source and push committed results into it.** Would have preserved editorial override and every historical edition. Rejected: it adds a sync with no owner, and a sync that can drift is exactly how the portal and the public page came to disagree in the first place — the page had been hand-typed and reflected nothing the portal knew.
- **Keep the page on Sanity, typed by hand.** What it was. A cut could be committed and the public page stay wrong indefinitely, with no way to tell which was right.

## Notes

- **Editions before 2025 are not shown.** They exist only as hand-typed Sanity rows and were never in the portal; the owner accepted losing them rather than backfilling. If they are wanted back, they need a table of their own — the champions are school *names*, some of which never registered in the portal and so have no `registration_id` to hang off.
- **`state_rank` is what makes a podium possible without new schema.** There is no "champion" concept anywhere in the portal; for a paper-exam stage the rank at commit is the nearest true thing, so the podium is derived rather than declared. A Grand Finale champion decided by a knockout match has no equivalent, and that stage will need one.
- **Stages are sectioned in the edition's own order**, using `editions.stages`. A stage the edition does not list still renders, at the end: a renamed stage should drop a heading out of sequence, not drop a whole cohort off the page.
- **Reps are keyed by school *and* stage**, because advancing at the zonal stage does not put a Rep on the roster for a later one.
- **Only non-sensitive columns are selected.** School name, LGA, score, rank, route and Rep name. Contact details, notes, eliminated outcomes and every column the registration form collects stay in the database — the service-role client bypasses RLS, so the `select` list is the whole of the access control and is deliberately short.
- **`src/features/results/filter-bar.tsx` was deleted** rather than left behind: it existed only to filter Sanity's category and zone facets, neither of which the portal data has.
