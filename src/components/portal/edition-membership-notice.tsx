import { Card } from "@/components/portal/ui";

// Which edition this account belongs to. A student record is per-edition, so a
// rep from a past year still signs in and still sees a dashboard headed by the
// current edition — which is not theirs. Say so plainly rather than letting the
// year in the header imply they are on this season's team.
export function EditionMembershipNotice({
  editionYear,
  currentYear,
  schoolName,
}: {
  editionYear: number | null;
  currentYear: number | null;
  schoolName?: string | null;
}) {
  if (editionYear == null || currentYear == null || editionYear === currentYear) return null;

  return (
    <Card className="p-5 border-l-4 border-l-primary">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-ink">
        {editionYear} team member
      </p>
      <p className="font-bebas text-2xl text-foreground leading-tight mt-1">
        You took part in the {editionYear} competition
      </p>
      <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
        The competition is now on {currentYear}, and you are not on this year&apos;s team.
        {schoolName ? ` If ${schoolName} has entered again, ` : " If your school has entered again, "}
        your coordinator can add you to the roster. Nothing here closes in the meantime — practice,
        Tech Lab, plans and study packs stay open all year.
      </p>
    </Card>
  );
}
