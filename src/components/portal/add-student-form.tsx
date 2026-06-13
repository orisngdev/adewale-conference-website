"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { addStudent } from "@/app/(portal)/portal/school/actions";

const inputCls =
  "rounded-md border border-[#0A0F1E]/15 bg-white px-3 py-2 text-sm outline-none focus:border-[#E8A020]";

export default function AddStudentForm() {
  const [error, formAction, pending] = useActionState(addStudent, null);

  return (
    <form action={formAction} className="flex flex-col sm:flex-row gap-2">
      <input name="name" required placeholder="Student name" className={`flex-1 ${inputCls}`} />
      <input name="level" placeholder="Class (e.g. SS2)" className={`sm:w-40 ${inputCls}`} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add student"}
      </Button>
      {error ? <p className="text-sm text-red-600 sm:self-center">{error}</p> : null}
    </form>
  );
}
