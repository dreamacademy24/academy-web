import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireExpenseOwner, expenseErrorResponse } from "@/lib/expenses/auth";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 대표의 서명된 직원 세션만 허용합니다. 장부 암호로 우회할 수 없습니다.
async function checkPass(req: Request): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  try { await requireExpenseOwner(req); return {ok:true}; }
  catch(error) { return {ok:false,res:expenseErrorResponse(error)}; }
}
async function checkApprovedLink(id:string):Promise<NextResponse|null> {
 const result=await sb.from('expense_claims').select('id').eq('ledger_entry_id',id).eq('status','approved').maybeSingle();
 if(result.error)return NextResponse.json({message:'승인 연결 확인을 위해 지출 저장소 설정이 필요합니다.'},{status:503});
 return result.data?NextResponse.json({message:'직원 승인 지출과 연결된 원장은 직접 수정·삭제할 수 없습니다. 원본과 승인 이력을 보존합니다.'},{status:409}):null;
}

async function getConfig() {
  const { data } = await sb.from("may_ledger_config").select("*").eq("id", "settings").maybeSingle();
  return {
    krwPerPhp: data?.krw_per_php != null ? Number(data.krw_per_php) : 23,
    usdPerPhp: data?.usd_per_php != null ? Number(data.usd_per_php) : 58,
  };
}

// GET — 전체 항목 + 설정
export async function GET(req: Request) {
  const c = await checkPass(req); if (!c.ok) return c.res;
  const items:Record<string,unknown>[]=[];
  for(let offset=0;;offset+=1000){
   const {data,error}=await sb.from('may_ledger').select('*').order('entry_date',{ascending:false}).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+999);
   if(error)return NextResponse.json({message:'원장 조회에 실패했습니다.'},{status:503});
   items.push(...(data||[]));
   if((data||[]).length<1000)break;
   if(items.length>=50000)return NextResponse.json({message:'원장 거래량이 많습니다. 기간별 통합 보고를 이용하세요.'},{status:413});
  }
  const payload={items,config:await getConfig()};
  if(Buffer.byteLength(JSON.stringify(payload))>4*1024*1024)return NextResponse.json({message:'전체 원장 크기가 큽니다. 기간별 통합 보고를 이용하세요.'},{status:413});
  return NextResponse.json(payload,{headers:{'Cache-Control':'no-store'}});
}

// POST — 항목 추가, 또는 {kind:'config'} 로 환율 저장
export async function POST(req: Request) {
  const c = await checkPass(req); if (!c.ok) return c.res;
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: "BAD_JSON" }, { status: 400 }); }

  if (b.kind === "config") {
    const patch: Record<string, number> = {};
    if (b.krwPerPhp != null) patch.krw_per_php = Number(b.krwPerPhp);
    if (b.usdPerPhp != null) patch.usd_per_php = Number(b.usdPerPhp);
    const { error } = await sb.from("may_ledger_config")
      .upsert({ id: "settings", ...patch, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  // Company manual expenses are entered only by Abby/Bella and posted by approval.
  // Owner personal-book entries, income, and FX administration remain separate.
  if(b.book!=="집"&&b.type!=="income")return NextResponse.json({message:'회사 지출은 아비·벨라 제출 후 대표 승인으로 반영합니다.'},{status:403});
  const amount = Number(b.amount);
  if (!isFinite(amount) || amount <= 0) return NextResponse.json({ error: "금액을 확인해주세요" }, { status: 400 });
  const id = (typeof b.id === "string" && b.id) ? b.id
    : "e" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  // source: 'manual' 기본. 모리 발생/지급 구분은 'mori_accrue' / 'mori_settle' 로 저장(스키마 변경 없이).
  const src = (typeof b.source === "string" && b.source) ? b.source : "manual";
  const row = {
    id,
    entry_date: (b.entry_date as string) || new Date().toISOString().slice(0, 10),
    book: (b.book as string) === "집" ? "집" : "회사",
    type: (b.type as string) === "income" ? "income" : "expense",
    division: (b.division as string) || "",
    detail: (b.detail as string) || "",
    memo: (b.memo as string) || "",
    amount: Math.abs(amount),
    currency: (b.currency as string) === "KRW" ? "KRW" : "PHP",
    source: src,
  };
  const { data, error } = await sb.from("may_ledger").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

// PATCH — {id, patch:{...}}
export async function PATCH(req: Request) {
  const c = await checkPass(req); if (!c.ok) return c.res;
  const b = await req.json().catch(() => null) as { id?: string; patch?: Record<string, unknown> } | null;
  if (!b?.id || !b.patch) return NextResponse.json({ error: "id/patch 필요" }, { status: 400 });
  const protectedEntry=await checkApprovedLink(b.id);if(protectedEntry)return protectedEntry;
  const allowed: Record<string, unknown> = {};
  for (const k of ["entry_date", "book", "type", "division", "detail", "memo", "amount", "currency", "source"]) {
    if (k in b.patch) allowed[k] = b.patch[k];
  }
  const { error } = await sb.from("may_ledger").update(allowed).eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — ?id=
export async function DELETE(req: Request) {
  const c = await checkPass(req); if (!c.ok) return c.res;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });
  const protectedEntry=await checkApprovedLink(id);if(protectedEntry)return protectedEntry;
  const { error } = await sb.from("may_ledger").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
