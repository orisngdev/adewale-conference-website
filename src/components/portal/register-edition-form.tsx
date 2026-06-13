"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { registerForEdition } from "@/app/(portal)/portal/school/actions";

const inputCls =
  "w-full rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]";

export default function RegisterEditionForm({ year }: { year: number }) {
  const [error, formAction, pending] = useActionState(
    registerForEdition.bind(null, year),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input name="school" required placeholder="School name" className={inputCls} />
      <div className="grid sm:grid-cols-2 gap-2">
        <input name="lga" placeholder="LGA" className={inputCls} />
        <input name="category" placeholder="Category (Public / Private)" className={inputCls} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid sm:grid-cols-2 gap-2">
          <input
            name={`rep${i}`}
            placeholder={`Representative ${i} name`}
            className={inputCls}
          />
          <input name={`rep${i}_level`} placeholder="Class (e.g. SS2)" className={inputCls} />
        </div>
      ))}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Registering…" : `Register for ${year}`}
        </Button>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </form>
  );
}
