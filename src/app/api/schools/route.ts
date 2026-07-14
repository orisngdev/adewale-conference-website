import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { LGA_OPTIONS, SCHOOL_CATEGORY_OPTIONS } from "@/lib/forms";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/supabase/env";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function requireOption<T extends readonly string[]>(
  value: string | null,
  options: T,
  fieldName: string,
): T[number] {
  if (!value) {
    throw new Error(`${fieldName} is required.`);
  }

  if (!options.includes(value)) {
    throw new Error(`${fieldName} is invalid.`);
  }

  return value as T[number];
}

// School lookup for the registration form's dropdown. Reads the portal's
// schools table (kept complete by the Airtable sync) with the public anon
// key — schools_read RLS is public, and no cookies keeps this cacheable.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lga = requireOption(searchParams.get("lga"), LGA_OPTIONS, "School LGA");
    const category = requireOption(
      searchParams.get("category"),
      SCHOOL_CATEGORY_OPTIONS,
      "School Category",
    );

    if (!isSupabaseConfigured) {
      return NextResponse.json({ schools: [] });
    }

    const supabase = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("schools")
      .select("id, name, category, lga")
      .eq("lga", lga)
      .eq("category", category)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);

    const schools = (data ?? [])
      .map((s) => ({
        id: s.id as string,
        name: (s.name ?? "").trim(),
        category: (s.category ?? "").trim(),
        lga: (s.lga ?? "").trim(),
      }))
      .filter((s) => s.name);

    return NextResponse.json({ schools });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "School LGA is required." ||
        error.message === "School Category is required." ||
        error.message === "School LGA is invalid." ||
        error.message === "School Category is invalid."
      ) {
        return badRequest(error.message);
      }
    }

    console.error("School lookup failed:", error);
    return NextResponse.json(
      { error: "Unable to load schools right now." },
      { status: 500 },
    );
  }
}
