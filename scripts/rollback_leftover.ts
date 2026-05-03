import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
function le(k: string) {
  if (process.env[k]) return process.env[k];
  try {
    const t = readFileSync(resolve(ROOT, ".env.local"), "utf-8");
    return t.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1]?.trim().replace(/^["']|["']$/g, "");
  } catch { return undefined; }
}
const sb = createClient(le("NEXT_PUBLIC_SUPABASE_URL")!, le("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

(async () => {
  const { data } = await sb.from("bookings").select("id, booker_name, created_at").or("booker_name.ilike.%김장미%,booker_name.ilike.%장이화%").gte("created_at", "2026-04-29");
  console.log("matches:", data);
  if (data && data.length > 0) {
    const ids = data.map((r: any) => r.id);
    const { error, count } = await sb.from("bookings").delete({ count: "exact" }).in("id", ids);
    console.log("delete:", error?.message ?? `${count} rows deleted`);
  } else {
    console.log("no leftover");
  }
})();
