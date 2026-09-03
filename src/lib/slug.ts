import { SupabaseClient } from "@supabase/supabase-js";

const turkishCharMap: Record<string, string> = {
  "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u",
  "Ç": "c", "Ğ": "g", "İ": "i", "Ö": "o", "Ş": "s", "Ü": "u",
};

export function generateBaseSlug(name: string): string {
  return name
    .split("")
    .map(char => turkishCharMap[char] || char)
    .join("")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function generateUniqueSlug(
  supabaseAdmin: SupabaseClient<any, any, any>,
  baseSlug: string,
  maxAttempts = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const suffix = attempt === 0 
      ? "" 
      : "-" + Math.random().toString(36).substring(2, 6);
    const slug = baseSlug + suffix;

    const { data, error } = await supabaseAdmin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .single();

    if (error && error.code === "PGRST116") {
      return slug;
    }
  }
  
  const timestamp = Date.now().toString(36);
  return baseSlug + "-" + timestamp;
}