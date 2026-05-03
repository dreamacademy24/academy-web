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
  const ids = [
    "a97b4302-0e51-484b-935f-0666e3c53e64",
    "7b7aa9ed-3ac6-47de-814b-6b35f1e8fcae",
    "dcfe5a33-1eb5-44f7-9134-365e54730491",
    "cd0fe506-d0ca-42bd-8a9f-b61f42e76293",
  ];
  const { data: bks } = await sb.from("bookings_new").select("id, booker_name").in("id", ids);
  for (const b of bks ?? []) {
    const { data: stu } = await sb.from("students").select("id, name_kr, name_en, academy_start, created_at").eq("booking_id", (b as any).id).order("created_at", { ascending: true });
    console.log(`\n${(b as any).booker_name} (${(b as any).id}): ${stu?.length}명`);
    stu?.forEach((s: any) => console.log(`  ${s.id} ${s.name_kr} / ${s.name_en} / start=${s.academy_start} / ${s.created_at}`));
  }
})();
