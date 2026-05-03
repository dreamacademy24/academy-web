import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
function le(k:string){if(process.env[k])return process.env[k];try{const t=readFileSync(resolve(ROOT,".env.local"),"utf-8");return t.match(new RegExp(`^${k}=(.+)$`,"m"))?.[1]?.trim().replace(/^["']|["']$/g,"");}catch{return undefined;}}
const sb=createClient(le("NEXT_PUBLIC_SUPABASE_URL")!,le("SUPABASE_SERVICE_ROLE_KEY")!,{auth:{persistSession:false}});

(async()=>{
  const failedIds = ["4a1773cc-d6a0-477c-bcae-df6455a06a01","aeba5a1a-af65-48a1-8c23-a658b85c94ff","90781ae6-da5e-496e-8032-cb609ad2dc52","8b3a9a62-aade-40c9-a207-a2294e21903e"];
  const { data } = await sb.from("bookings").select("id, booker_name, accom_type, status, reservation_date").in("id", failedIds);
  console.log(JSON.stringify(data, null, 2));

  // 현재 bookings_new에 허용된 booking_type 값 (분포)
  const { data: cur } = await sb.from("bookings_new").select("booking_type");
  const types = [...new Set((cur??[]).map((r:any)=>r.booking_type).filter(Boolean))];
  console.log("\n현재 bookings_new에 존재하는 booking_type 값:");
  console.log(types);
})();
