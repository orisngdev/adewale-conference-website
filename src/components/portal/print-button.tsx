"use client";

import { Button } from "@/components/ui/button";

export default function PrintButton() {
  return (
    <div className="print:hidden">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        🖨 Print / Save as PDF
      </Button>
    </div>
  );
}
