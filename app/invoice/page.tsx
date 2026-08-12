"use client";
import { useState, useMemo, useEffect, useRef, Suspense } from "react";
import { fetchDhAvailRooms } from "@/lib/dhRooms";
import { fetchDeployedHolidays, holidaysInRange, HOLIDAY_GUEST_NOTICE, type HolidayItem } from "@/lib/holidays";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { commuteUnitPrice } from "@/lib/commutePricing";
import { isCommuteBooking } from "@/lib/bookingTypes";
import html2canvas from "html2canvas";

/* ── 유틸 함수 (100% 기존 유지) ── */
function isPeak(d: string): boolean {
  if (!d) return false;
  const dt = new Date(d), y = dt.getFullYear(), m = dt.getMonth()+1, day = dt.getDate();
  if (y === 2027) return (m===7&&day>=18)||(m===8&&day<=30)||(m===12&&day>=19)||m===1||m===2;
  if (y === 2028) return m===1||(m===2&&day<=28)||(m===7&&day>=15)||m===8||(m===12&&day>=15);
  return (m===7&&day>=15)||m===8||(m===12&&day>=15)||m===1||m===2;
}
/* 주 전체(7일)가 성수기여야 성수기 주 — 주별 시즌 판정 */
function weekAllPeak(ds: string): boolean {
  if (!ds) return false;
  const dt = new Date(ds + "T00:00:00"); dt.setDate(dt.getDate() + 6);
  const es = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  return isPeak(ds) && isPeak(es);
}
function seasonMixInv(ci: string, w: number): { off: number; peak: number } {
  let off = 0, peak = 0;
  for (let i = 0; i < w; i++) {
    const dt = new Date(ci + "T00:00:00"); dt.setDate(dt.getDate() + i * 7);
    const ds = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    if (weekAllPeak(ds)) peak++; else off++;
  }
  return { off, peak };
}
function addDays(d: string, n: number): string {
  if (!d) return "";
  const dt = new Date(d);
  dt.setDate(dt.getDate()+n);
  return dt.toISOString().slice(0,10);
}
function fmtDate(d: string) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}
function fmtSavedAt(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", { year:"numeric", month:"long", day:"numeric", hour:"2-digit", minute:"2-digit" });
}

/* ── 요금 테이블 (100% 기존 유지) ── */
type P3=[number,number,number];
const DH:Record<string,P3>={
  "2-1-1":[3490000,2790000,3140000],
  "2-1-2":[4970000,3970000,4470000],
  "2-2-1":[4070000,3250000,3660000],
  "2-1-3":[6450000,5160000,5800000],
  "2-2-2":[5550000,4440000,4990000],
  "2-3-1":[4650000,3720000,4180000],
  "2-1-4":[7940000,6350000,7140000],
  "2-2-3":[7040000,5630000,6330000],
  "2-3-2":[6140000,4910000,5520000],
  "2-1-5":[9420000,7530000,8470000],
  "2-2-4":[8520000,6810000,7660000],
  "2-3-3":[7620000,6090000,6850000],
  "3-1-1":[5070000,4050000,4560000],
  "3-1-2":[7190000,5750000,6470000],
  "3-2-1":[5900000,4720000,5310000],
  "3-1-3":[9300000,7440000,8370000],
  "3-2-2":[8000000,6400000,7200000],
  "3-3-1":[6720000,5370000,6040000],
  "3-1-4":[11420000,9130000,10270000],
  "3-2-3":[10130000,8100000,9110000],
  "3-3-2":[8840000,7070000,7950000],
  "3-1-5":[13530000,10820000,12170000],
  "3-2-4":[12240000,9790000,11010000],
  "3-3-3":[10950000,8760000,9850000],
  "4-1-1":[6290000,5030000,5660000],
  "4-1-2":[8950000,7160000,8050000],
  "4-2-1":[7350000,5880000,6620000],
  "4-1-3":[11600000,9280000,10440000],
  "4-2-2":[10000000,8000000,9000000],
  "4-3-1":[8420000,6730000,7570000],
  "4-1-4":[14250000,11400000,12830000],
  "4-2-3":[12670000,10130000,11400000],
  "4-3-2":[11080000,8860000,9970000],
  "4-1-5":[16900000,13520000,15210000],
  "4-2-4":[15320000,12250000,13780000],
  "4-3-3":[13730000,10980000,12350000],
  "5-1-1":[7840000,6270000,7050000],
  "5-1-2":[11150000,8920000,10030000],
  "5-2-1":[9140000,7310000,8220000],
  "5-1-3":[14470000,11570000,13020000],
  "5-2-2":[12450000,9960000,11210000],
  "5-3-1":[10450000,8360000,9400000],
  "5-1-4":[17790000,14230000,16010000],
  "5-2-3":[15780000,12620000,14200000],
  "5-3-2":[13770000,11010000,12390000],
  "5-1-5":[21100000,16880000,18990000],
  "5-2-4":[19090000,15270000,17180000],
  "5-3-3":[17080000,13660000,15370000],
  "6-1-1":[9380000,7500000,8440000],
  "6-1-2":[13350000,10680000,12020000],
  "6-2-1":[10930000,8740000,9830000],
  "6-1-3":[17340000,13870000,15600000],
  "6-2-2":[14900000,11920000,13410000],
  "6-3-1":[12480000,9980000,11230000],
  "6-1-4":[21320000,17050000,19180000],
  "6-2-3":[18890000,15110000,17000000],
  "6-3-2":[16450000,13160000,14810000],
  "6-1-5":[25290000,20230000,22760000],
  "6-2-4":[22850000,18280000,20570000],
  "6-3-3":[20430000,16340000,18380000],
  "7-1-1":[10930000,8740000,9830000],
  "7-1-2":[15570000,12450000,14010000],
  "7-2-1":[12720000,10170000,11440000],
  "7-1-3":[20200000,16160000,18180000],
  "7-2-2":[17350000,13880000,15620000],
  "7-3-1":[14500000,11600000,13050000],
  "7-1-4":[24850000,19880000,22360000],
  "7-2-3":[22000000,17600000,19800000],
  "7-3-2":[19150000,15320000,17230000],
  "7-1-5":[29490000,23590000,26540000],
  "7-2-4":[26640000,21310000,23970000],
  "7-3-3":[23790000,19030000,21410000],
  "8-1-1":[12490000,9990000,11240000],
  "8-1-2":[17800000,14240000,16020000],
  "8-2-1":[14520000,11610000,13060000],
  "8-1-3":[23100000,18480000,20790000],
  "8-2-2":[19830000,15860000,17840000],
  "8-3-1":[16550000,13240000,14890000],
  "8-1-4":[28420000,22730000,25570000],
  "8-2-3":[25140000,20110000,22620000],
  "8-3-2":[21850000,17480000,19670000],
  "8-1-5":[33730000,26980000,30350000],
  "8-2-4":[30450000,24360000,27400000],
  "8-3-3":[27170000,21730000,24450000],
  "9-1-1":[14040000,11230000,12630000],
  "9-1-2":[20000000,16000000,18000000],
  "9-2-1":[16300000,13040000,14670000],
  "9-1-3":[25980000,20780000,23380000],
  "9-2-2":[22280000,17820000,20050000],
  "9-3-1":[18580000,14860000,16720000],
  "9-1-4":[31950000,25560000,28760000],
  "9-2-3":[28250000,22600000,25420000],
  "9-3-2":[24550000,19640000,22090000],
  "9-1-5":[37930000,30340000,34130000],
  "9-2-4":[34230000,27380000,30800000],
  "9-3-3":[30530000,24420000,27470000],
  "10-1-1":[15590000,12470000,14030000],
  "10-1-2":[22220000,17770000,19990000],
  "10-2-1":[18100000,14480000,16290000],
  "10-1-3":[28850000,23080000,25970000],
  "10-2-2":[24740000,19790000,22260000],
  "10-3-1":[20600000,16480000,18540000],
  "10-1-4":[35500000,28400000,31950000],
  "10-2-3":[31370000,25090000,28230000],
  "10-3-2":[27250000,21800000,24520000],
  "10-1-5":[42140000,33710000,37920000],
  "10-2-4":[38000000,30400000,34200000],
  "10-3-3":[33890000,27110000,30500000],
  "11-1-1":[17130000,13700000,15410000],
  "11-1-2":[24440000,19550000,21990000],
  "11-2-1":[19890000,15910000,17900000],
  "11-1-3":[31740000,25390000,28560000],
  "11-2-2":[27190000,21750000,24470000],
  "11-3-1":[22640000,18110000,20370000],
  "11-1-4":[39040000,31230000,35130000],
  "11-2-3":[34490000,27590000,31040000],
  "11-3-2":[29940000,23950000,26940000],
  "11-1-5":[46340000,37070000,41700000],
  "11-2-4":[41790000,33430000,37610000],
  "11-3-3":[37240000,29790000,33510000],
  "12-1-1":[18680000,14940000,16810000],
  "12-1-2":[26650000,21320000,23980000],
  "12-2-1":[21680000,17340000,19510000],
  "12-1-3":[34600000,27680000,31140000],
  "12-2-2":[29640000,23710000,26670000],
  "12-3-1":[24670000,19730000,22200000],
  "12-1-4":[42580000,34060000,38320000],
  "12-2-3":[37600000,30080000,33840000],
  "12-3-2":[32640000,26110000,29370000],
  "12-1-5":[50540000,40430000,45480000],
  "12-2-4":[45570000,36450000,41010000],
  "12-3-3":[40600000,32480000,36540000]
};
const JP:Record<string,P3>={
  "디럭스-2-1-1":[5550000,4440000,5000000],
  "디럭스-2-1-2":[7040000,5630000,6330000],
  "디럭스-2-2-1":[6140000,4910000,5520000],
  "디럭스-2-1-3":[8530000,6820000,7670000],
  "디럭스-2-2-2":[7630000,6100000,6860000],
  "프리미어-2-1-1":[5700000,4560000,5130000],
  "프리미어-2-1-2":[7180000,5740000,6460000],
  "프리미어-2-2-1":[6280000,5020000,5650000],
  "프리미어-2-1-3":[8670000,6930000,7800000],
  "프리미어-2-2-2":[7770000,6210000,6990000],
  "막탄스윗-2-1-1":[6250000,5000000,5630000],
  "막탄스윗-2-1-2":[7740000,6190000,6960000],
  "막탄스윗-2-2-1":[6840000,5470000,6150000],
  "막탄스윗-2-1-3":[9230000,7380000,8300000],
  "막탄스윗-2-2-2":[8330000,6660000,7490000],
  "디럭스-3-1-1":[8180000,6540000,7360000],
  "디럭스-3-1-2":[10300000,8240000,9270000],
  "디럭스-3-2-1":[9000000,7200000,8100000],
  "디럭스-3-1-3":[12400000,9920000,11160000],
  "디럭스-3-2-2":[11120000,8890000,10000000],
  "프리미어-3-1-1":[8390000,6710000,7550000],
  "프리미어-3-1-2":[10500000,8400000,9450000],
  "프리미어-3-2-1":[9220000,7370000,8290000],
  "프리미어-3-1-3":[12620000,10090000,11350000],
  "프리미어-3-2-2":[11330000,9060000,10190000],
  "막탄스윗-3-1-1":[9230000,7380000,8300000],
  "막탄스윗-3-1-2":[11350000,9080000,10210000],
  "막탄스윗-3-2-1":[10050000,8040000,9050000],
  "막탄스윗-3-1-3":[13450000,10760000,12110000],
  "막탄스윗-3-2-2":[12170000,9730000,10950000],
  "디럭스-4-1-1":[10720000,8570000,9640000],
  "디럭스-4-1-2":[13370000,10690000,12030000],
  "디럭스-4-2-1":[11780000,9420000,10600000],
  "디럭스-4-1-3":[16030000,12820000,14420000],
  "디럭스-4-2-2":[14440000,11550000,12990000],
  "프리미어-4-1-1":[11000000,8800000,9900000],
  "프리미어-4-1-2":[13650000,10920000,12280000],
  "프리미어-4-2-1":[12050000,9640000,10850000],
  "프리미어-4-1-3":[16300000,13040000,14670000],
  "프리미어-4-2-2":[14720000,11770000,13240000],
  "막탄스윗-4-1-1":[12120000,9690000,10900000],
  "막탄스윗-4-1-2":[14770000,11810000,13290000],
  "막탄스윗-4-2-1":[13180000,10540000,11860000],
  "막탄스윗-4-1-3":[17430000,13940000,15680000],
  "막탄스윗-4-2-2":[15840000,12670000,14250000],
  "디럭스-5-1-1":[13370000,10690000,12030000],
  "디럭스-5-1-2":[16680000,13340000,15010000],
  "디럭스-5-2-1":[14670000,11730000,13200000],
  "디럭스-5-1-3":[20000000,16000000,18000000],
  "디럭스-5-2-2":[17990000,14390000,16190000],
  "프리미어-5-1-1":[13720000,10970000,12340000],
  "프리미어-5-1-2":[17030000,13620000,15320000],
  "프리미어-5-2-1":[15020000,12010000,13510000],
  "프리미어-5-1-3":[20350000,16280000,18310000],
  "프리미어-5-2-2":[18340000,14670000,16500000],
  "막탄스윗-5-1-1":[15120000,12090000,13600000],
  "막탄스윗-5-1-2":[18430000,14740000,16580000],
  "막탄스윗-5-2-1":[16420000,13130000,14770000],
  "막탄스윗-5-1-3":[21750000,17400000,19570000],
  "막탄스윗-5-2-2":[19740000,15790000,17760000],
  "디럭스-6-1-1":[16020000,12810000,14410000],
  "디럭스-6-1-2":[20000000,16000000,18000000],
  "디럭스-6-2-1":[17570000,14050000,15810000],
  "디럭스-6-1-3":[23980000,19180000,21580000],
  "디럭스-6-2-2":[21550000,17240000,19390000],
  "프리미어-6-1-1":[16440000,13150000,14790000],
  "프리미어-6-1-2":[20420000,16330000,18370000],
  "프리미어-6-2-1":[17990000,14390000,16190000],
  "프리미어-6-1-3":[24400000,19520000,21960000],
  "프리미어-6-2-2":[21970000,17570000,19770000],
  "막탄스윗-6-1-1":[18120000,14490000,16300000],
  "막탄스윗-6-1-2":[22100000,17680000,19890000],
  "막탄스윗-6-2-1":[19670000,15730000,17700000],
  "막탄스윗-6-1-3":[26080000,20860000,23470000],
  "막탄스윗-6-2-2":[23650000,18920000,21280000],
  "디럭스-7-1-1":[18670000,14930000,16800000],
  "디럭스-7-1-2":[23300000,18640000,20970000],
  "디럭스-7-2-1":[20450000,16360000,18410000],
  "디럭스-7-1-3":[27950000,22360000,25150000],
  "디럭스-7-2-2":[25100000,20080000,22590000],
  "프리미어-7-1-1":[19150000,15320000,17240000],
  "프리미어-7-1-2":[23800000,19040000,21420000],
  "프리미어-7-2-1":[20950000,16760000,18850000],
  "프리미어-7-1-3":[28440000,22750000,25590000],
  "프리미어-7-2-2":[25590000,20470000,23030000],
  "막탄스윗-7-1-1":[21120000,16890000,19000000],
  "막탄스윗-7-1-2":[25750000,20600000,23180000],
  "막탄스윗-7-2-1":[22900000,18320000,20610000],
  "막탄스윗-7-1-3":[30400000,24320000,27360000],
  "막탄스윗-7-2-2":[27550000,22040000,24790000],
  "디럭스-8-1-1":[21340000,17070000,19200000],
  "디럭스-8-1-2":[26650000,21320000,23980000],
  "디럭스-8-2-1":[23370000,18690000,21030000],
  "디럭스-8-1-3":[31950000,25560000,28760000],
  "디럭스-8-2-2":[28680000,22940000,25810000],
  "프리미어-8-1-1":[21900000,17520000,19710000],
  "프리미어-8-1-2":[27200000,21760000,24480000],
  "프리미어-8-2-1":[23930000,19140000,21530000],
  "프리미어-8-1-3":[32520000,26010000,29260000],
  "프리미어-8-2-2":[29240000,23390000,26310000],
  "막탄스윗-8-1-1":[24140000,19310000,21720000],
  "막탄스윗-8-1-2":[29450000,23560000,26500000],
  "막탄스윗-8-2-1":[26170000,20930000,23550000],
  "막탄스윗-8-1-3":[34750000,27800000,31280000],
  "막탄스윗-8-2-2":[31480000,25180000,28330000],
  "디럭스-9-1-1":[23990000,19190000,21590000],
  "디럭스-9-1-2":[29950000,23960000,26960000],
  "디럭스-9-2-1":[26250000,21000000,23630000],
  "디럭스-9-1-3":[35940000,28750000,32340000],
  "디럭스-9-2-2":[32240000,25790000,29010000],
  "프리미어-9-1-1":[24620000,19690000,22150000],
  "프리미어-9-1-2":[30590000,24470000,27530000],
  "프리미어-9-2-1":[26890000,21510000,24200000],
  "프리미어-9-1-3":[36570000,29250000,32910000],
  "프리미어-9-2-2":[32870000,26290000,29580000],
  "막탄스윗-9-1-1":[27140000,21710000,24420000],
  "막탄스윗-9-1-2":[33100000,26480000,29790000],
  "막탄스윗-9-2-1":[29400000,23520000,26460000],
  "막탄스윗-9-1-3":[39090000,31270000,35180000],
  "막탄스윗-9-2-2":[35390000,28310000,31850000],
  "디럭스-10-1-1":[26650000,21320000,23980000],
  "디럭스-10-1-2":[33280000,26620000,29950000],
  "디럭스-10-2-1":[29150000,23320000,26240000],
  "디럭스-10-1-3":[39920000,31930000,35920000],
  "디럭스-10-2-2":[35800000,28640000,32220000],
  "프리미어-10-1-1":[27350000,21880000,24610000],
  "프리미어-10-1-2":[33980000,27180000,30580000],
  "프리미어-10-2-1":[29850000,23880000,26870000],
  "프리미어-10-1-3":[40620000,32490000,36550000],
  "프리미어-10-2-2":[36500000,29200000,32850000],
  "막탄스윗-10-1-1":[30150000,24120000,27130000],
  "막탄스윗-10-1-2":[36780000,29420000,33100000],
  "막탄스윗-10-2-1":[32650000,26120000,29390000],
  "막탄스윗-10-1-3":[43420000,34730000,39070000],
  "막탄스윗-10-2-2":[39300000,31440000,35370000],
  "디럭스-11-1-1":[29300000,23440000,26370000],
  "디럭스-11-1-2":[36600000,29280000,32940000],
  "디럭스-11-2-1":[32050000,25640000,28840000],
  "디럭스-11-1-3":[43900000,35120000,39510000],
  "디럭스-11-2-2":[39350000,31480000,35420000],
  "프리미어-11-1-1":[30070000,24050000,27060000],
  "프리미어-11-1-2":[37370000,29890000,33630000],
  "프리미어-11-2-1":[32820000,26250000,29530000],
  "프리미어-11-1-3":[44670000,35730000,40200000],
  "프리미어-11-2-2":[40130000,32100000,36110000],
  "막탄스윗-11-1-1":[33150000,26520000,29830000],
  "막탄스윗-11-1-2":[40450000,32360000,36400000],
  "막탄스윗-11-2-1":[35900000,28720000,32310000],
  "막탄스윗-11-1-3":[47750000,38200000,42970000],
  "막탄스윗-11-2-2":[43200000,34560000,38880000],
  "디럭스-12-1-1":[31950000,25560000,28760000],
  "디럭스-12-1-2":[39920000,31930000,35920000],
  "디럭스-12-2-1":[34950000,27960000,31450000],
  "디럭스-12-1-3":[47890000,38310000,43100000],
  "디럭스-12-2-2":[42920000,34330000,38620000],
  "프리미어-12-1-1":[32800000,26240000,29520000],
  "프리미어-12-1-2":[40750000,32600000,36680000],
  "프리미어-12-2-1":[35790000,28630000,32210000],
  "프리미어-12-1-3":[48730000,38980000,43850000],
  "프리미어-12-2-2":[43750000,35000000,39380000],
  "막탄스윗-12-1-1":[36150000,28920000,32540000],
  "막탄스윗-12-1-2":[44120000,35290000,39700000],
  "막탄스윗-12-2-1":[39150000,31320000,35230000],
  "막탄스윗-12-1-3":[52090000,41670000,46880000],
  "막탄스윗-12-2-2":[47120000,37690000,42400000],
  // 2+3 (성인2+아이3) — 2-2 + 아이1명 증가분(1-3 − 1-2) 파생, 2026-07-20 추가
"디럭스-2-2-3":[9120000,7290000,8200000],
  "디럭스-3-2-3":[13220000,10570000,11890000],
  "디럭스-4-2-3":[17100000,13680000,15380000],
  "디럭스-5-2-3":[21310000,17050000,19180000],
  "디럭스-6-2-3":[25530000,20420000,22970000],
  "디럭스-7-2-3":[29750000,23800000,26770000],
  "디럭스-8-2-3":[33980000,27180000,30590000],
  "디럭스-9-2-3":[38230000,30580000,34390000],
  "디럭스-10-2-3":[42440000,33950000,38190000],
  "디럭스-11-2-3":[46650000,37320000,41990000],
  "디럭스-12-2-3":[50890000,40710000,45800000],
  "프리미어-2-2-3":[9260000,7400000,8330000],
  "프리미어-3-2-3":[13450000,10750000,12090000],
  "프리미어-4-2-3":[17370000,13890000,15630000],
  "프리미어-5-2-3":[21660000,17330000,19490000],
  "프리미어-6-2-3":[25950000,20760000,23360000],
  "프리미어-7-2-3":[30230000,24180000,27200000],
  "프리미어-8-2-3":[34560000,27640000,31090000],
  "프리미어-9-2-3":[38850000,31070000,34960000],
  "프리미어-10-2-3":[43140000,34510000,38820000],
  "프리미어-11-2-3":[47430000,37940000,42680000],
  "프리미어-12-2-3":[51730000,41380000,46550000],
  "막탄스윗-2-2-3":[9820000,7850000,8830000],
  "막탄스윗-3-2-3":[14270000,11410000,12850000],
  "막탄스윗-4-2-3":[18500000,14800000,16640000],
  "막탄스윗-5-2-3":[23060000,18450000,20750000],
  "막탄스윗-6-2-3":[27630000,22100000,24860000],
  "막탄스윗-7-2-3":[32200000,25760000,28970000],
  "막탄스윗-8-2-3":[36780000,29420000,33110000],
  "막탄스윗-9-2-3":[41380000,33100000,37240000],
  "막탄스윗-10-2-3":[45940000,36750000,41340000],
  "막탄스윗-11-2-3":[50500000,40400000,45450000],
  "막탄스윗-12-2-3":[55090000,44070000,49580000],
};
const C9:Record<string,P3>={
  "디럭스-2-1-1":[4630000,3700000,4160000],
  "디럭스-2-1-2":[5730000,4580000,5150000],
  "디럭스-2-2-1":[4830000,3860000,4340000],
  "디럭스-2-1-3":[6830000,5460000,6140000],
  "디럭스-2-2-2":[5930000,4740000,5330000],
  "풀억세스룸-2-1-1":[5020000,4010000,4510000],
  "풀억세스룸-2-1-2":[6120000,4890000,5500000],
  "풀억세스룸-2-2-1":[5220000,4170000,4690000],
  "풀억세스룸-2-1-3":[7220000,5770000,6490000],
  "풀억세스룸-2-2-2":[6320000,5050000,5680000],
  "디럭스-3-1-1":[6790000,5430000,6110000],
  "디럭스-3-1-2":[8330000,6660000,7490000],
  "디럭스-3-2-1":[7040000,5630000,6330000],
  "디럭스-3-1-3":[9870000,7890000,8880000],
  "디럭스-3-2-2":[8580000,6860000,7720000],
  "풀억세스룸-3-1-1":[7380000,5900000,6640000],
  "풀억세스룸-3-1-2":[8920000,7130000,8020000],
  "풀억세스룸-3-2-1":[7630000,6100000,6860000],
  "풀억세스룸-3-1-3":[10450000,8360000,9410000],
  "풀억세스룸-3-2-2":[9170000,7330000,8250000],
  "디럭스-4-1-1":[8850000,7080000,7970000],
  "디럭스-4-1-2":[10750000,8600000,9670000],
  "디럭스-4-2-1":[9150000,7320000,8240000],
  "디럭스-4-1-3":[12640000,10110000,11370000],
  "디럭스-4-2-2":[11050000,8840000,9940000],
  "풀억세스룸-4-1-1":[9640000,7710000,8670000],
  "풀억세스룸-4-1-2":[11530000,9220000,10370000],
  "풀억세스룸-4-2-1":[9940000,7950000,8940000],
  "풀억세스룸-4-1-3":[13420000,10730000,12070000],
  "풀억세스룸-4-2-2":[11830000,9460000,10640000],
  "디럭스-5-1-1":[11050000,8840000,9940000],
  "디럭스-5-1-2":[13400000,10720000,12060000],
  "디럭스-5-2-1":[11400000,9120000,10260000],
  "디럭스-5-1-3":[15770000,12610000,14190000],
  "디럭스-5-2-2":[13750000,11000000,12380000],
  "풀억세스룸-5-1-1":[12030000,9620000,10820000],
  "풀억세스룸-5-1-2":[14390000,11510000,12950000],
  "풀억세스룸-5-2-1":[12380000,9900000,11140000],
  "풀억세스룸-5-1-3":[16750000,13400000,15070000],
  "풀억세스룸-5-2-2":[14740000,11790000,13260000],
  "디럭스-6-1-1":[13230000,10580000,11900000],
  "디럭스-6-1-2":[16050000,12840000,14450000],
  "디럭스-6-2-1":[13630000,10900000,12260000],
  "디럭스-6-1-3":[18890000,15110000,17000000],
  "디럭스-6-2-2":[16450000,13160000,14810000],
  "풀억세스룸-6-1-1":[14400000,11520000,12960000],
  "풀억세스룸-6-1-2":[17240000,13790000,15510000],
  "풀억세스룸-6-2-1":[14800000,11840000,13320000],
  "풀억세스룸-6-1-3":[20070000,16050000,18060000],
  "풀억세스룸-6-2-2":[17640000,14110000,15870000],
  "디럭스-7-1-1":[15420000,12330000,13870000],
  "디럭스-7-1-2":[18720000,14970000,16840000],
  "디럭스-7-2-1":[15870000,12690000,14280000],
  "디럭스-7-1-3":[22020000,17610000,19810000],
  "디럭스-7-2-2":[19170000,15330000,17250000],
  "풀억세스룸-7-1-1":[16790000,13430000,15110000],
  "풀억세스룸-7-1-2":[20090000,16070000,18080000],
  "풀억세스룸-7-2-1":[17240000,13790000,15510000],
  "풀억세스룸-7-1-3":[23390000,18710000,21050000],
  "풀억세스룸-7-2-2":[20540000,16430000,18480000],
  "디럭스-8-1-1":[17620000,14090000,15850000],
  "디럭스-8-1-2":[21400000,17120000,19260000],
  "디럭스-8-2-1":[18120000,14490000,16300000],
  "디럭스-8-1-3":[25180000,20140000,22660000],
  "디럭스-8-2-2":[21900000,17520000,19710000],
  "풀억세스룸-8-1-1":[19190000,15350000,17270000],
  "풀억세스룸-8-1-2":[22970000,18370000,20670000],
  "풀억세스룸-8-2-1":[19690000,15750000,17720000],
  "풀억세스룸-8-1-3":[26750000,21400000,24070000],
  "풀억세스룸-8-2-2":[23470000,18770000,21120000],
  "디럭스-9-1-1":[19800000,15840000,17820000],
  "디럭스-9-1-2":[24050000,19240000,21650000],
  "디럭스-9-2-1":[20350000,16280000,18320000],
  "디럭스-9-1-3":[28300000,22640000,25470000],
  "디럭스-9-2-2":[24600000,19680000,22140000],
  "풀억세스룸-9-1-1":[21570000,17250000,19410000],
  "풀억세스룸-9-1-2":[25830000,20660000,23240000],
  "풀억세스룸-9-2-1":[22120000,17690000,19900000],
  "풀억세스룸-9-1-3":[30080000,24060000,27070000],
  "풀억세스룸-9-2-2":[26380000,21100000,23740000],
  "디럭스-10-1-1":[22000000,17600000,19800000],
  "디럭스-10-1-2":[26730000,21380000,24050000],
  "디럭스-10-2-1":[22600000,18080000,20340000],
  "디럭스-10-1-3":[31450000,25160000,28300000],
  "디럭스-10-2-2":[27330000,21860000,24590000],
  "풀억세스룸-10-1-1":[23950000,19160000,21560000],
  "풀억세스룸-10-1-2":[28690000,22950000,25820000],
  "풀억세스룸-10-2-1":[24550000,19640000,22100000],
  "풀억세스룸-10-1-3":[33400000,26720000,30060000],
  "풀억세스룸-10-2-2":[29290000,23430000,26360000],
  "디럭스-11-1-1":[24190000,19350000,21770000],
  "디럭스-11-1-2":[29390000,23510000,26450000],
  "디럭스-11-2-1":[24840000,19870000,22350000],
  "디럭스-11-1-3":[34590000,27670000,31130000],
  "디럭스-11-2-2":[30040000,24030000,27030000],
  "풀억세스룸-11-1-1":[26350000,21080000,23710000],
  "풀억세스룸-11-1-2":[31540000,25230000,28380000],
  "풀억세스룸-11-2-1":[27000000,21600000,24300000],
  "풀억세스룸-11-1-3":[36740000,29390000,33060000],
  "풀억세스룸-11-2-2":[32190000,25750000,28970000],
  "디럭스-12-1-1":[26380000,21100000,23740000],
  "디럭스-12-1-2":[32050000,25640000,28840000],
  "디럭스-12-2-1":[27080000,21660000,24370000],
  "디럭스-12-1-3":[37720000,30170000,33940000],
  "디럭스-12-2-2":[32750000,26200000,29470000],
  "풀억세스룸-12-1-1":[28730000,22980000,25850000],
  "풀억세스룸-12-1-2":[34400000,27520000,30960000],
  "풀억세스룸-12-2-1":[29430000,23540000,26480000],
  "풀억세스룸-12-1-3":[40070000,32050000,36060000],
  "풀억세스룸-12-2-2":[35100000,28080000,31590000]
};

/* ── 견적 계산 함수 (100% 기존 유지) ── */
// 드림하우스 단독(비패키지·숙소만, booking2) 요금 — 시즌 무관 단일가 (2026-07-22 메이 확정)
// 1주 724,500 / 2주 1,285,200 / 3주 1,927,800 / 4주 2,318,400 (5주+ = 4주 주당가 579,600/주 연장)
const DH_ONLY_TOTAL:Record<number,number>={1:724500,2:1285200,3:1927800,4:2318400,5:2898000,6:3477600,7:4057200,8:4636800,9:5216400,10:5796000,11:6375600,12:6955200};
function dhOnlyPrice(w:number):number{
  if(DH_ONLY_TOTAL[w])return DH_ONLY_TOTAL[w];
  if(w>4)return 579600*w;
  return 0;
}
type AT=""| "dreamhouse"|"jpark"|"cubenine";
function lk(t:AT,r:string,w:number,p:number,k:number):P3|null{
  const half=(e:P3):P3=>[Math.round(e[0]/2),Math.round(e[1]/2),Math.round(e[2]/2)];
  if(t==="dreamhouse"){const e=DH[`${w}-${p}-${k}`];if(e)return e;if(w===1){const e2=DH[`2-${p}-${k}`];if(e2)return half(e2);}return null;}
  if(t==="jpark"){const e=JP[`${r}-${w}-${p}-${k}`];if(e)return e;if(w===1){const e2=JP[`${r}-2-${p}-${k}`];if(e2)return half(e2);}return null;}
  const e=C9[`${r}-${w}-${p}-${k}`];if(e)return e;if(w===1){const e2=C9[`${r}-2-${p}-${k}`];if(e2)return half(e2);}return null;
}
function sp(e:P3,pk:boolean){return pk?e[2]:e[1];}
const RESORT_LOGO:Record<string,string>={jpark:"https://yiglafscjvjgkxpycevk.supabase.co/storage/v1/object/public/staff-files/logos/jpark-logo.png",cubenine:"https://yiglafscjvjgkxpycevk.supabase.co/storage/v1/object/public/staff-files/logos/cube9-logo.png"};
function ResortLogo({t}:{t:AT}){ if(t!=="jpark"&&t!=="cubenine")return null; return <img src={RESORT_LOGO[t]} alt="" style={{height:15,verticalAlign:"middle",marginRight:6,...(t==="jpark"?{filter:"brightness(0)"}:{})}}/>; }
function alKo(t:AT,r:string){return t==="dreamhouse"?"드림하우스":t==="jpark"?`제이파크${r?" "+r+" 가든뷰":""}`:`큐브나인${r?" "+r:""}`;}
function al(t:AT,r:string){return t==="dreamhouse"?"Dream House":t==="jpark"?`제이파크 ${r} 가든뷰`:`큐브나인 ${r}`;}
function fmt(n:number){return n.toLocaleString("ko-KR");}
function mp(t:AT){return t==="dreamhouse"?6:t==="jpark"?5:4;} // 제이파크 5인(성인2+아이3, 2026-07-21)
function extraRate(t:AT){return t==="cubenine"?250000:340000;}

/* ── 타입 ── */
interface Disc{id:number;name:string;amount:number}
interface LC{id:number;name:string;amount:string}
interface StudentInfo{id:number;korName:string;engName:string;age:string;grade:string;academyStart:string;academyEnd:string;academyWeeks:string;photo:string;name_kr?:string;name_en?:string;birth_date?:string;level?:string}


/* 학생 영문이름·나이 비어있으면 students 테이블 값으로 자동 병합 (4자리 출생연도 → 만나이) */
async function fillStudentInfo(bookingId:string|null,sts:any[]):Promise<any[]>{
  try{
    if(!bookingId||!Array.isArray(sts)||sts.length===0)return sts;
    if(!sts.some((s:any)=>!String(s.engName||"").trim()||!String(s.age||"").trim()))return sts;
    const {data:tbl}=await supabase.from("students").select("name_kr,name_en,age").eq("booking_id",bookingId);
    if(!tbl||tbl.length===0)return sts;
    const normAge=(v:unknown)=>{const n=parseInt(String(v??"").trim(),10);if(!n)return "";return n>1900?String(new Date().getFullYear()-n):String(n);};
    return sts.map((s:any)=>{
      const key=String(s.korName||s.name_kr||"").trim();
      const m=key?tbl.find((r:any)=>String(r.name_kr||"").trim()===key):null;
      if(!m)return s;
      return {...s,
        engName:String(s.engName||"").trim()||String(m.name_en||"").toUpperCase(),
        age:String(s.age||"").trim()||normAge(m.age)};
    });
  }catch{return sts;}
}
/* 한글 이름으로 students 테이블에서 영문 이름 자동 조회 (입력값 미존재 시 빈 문자열) */
async function autofillEngName(korName:string):Promise<string>{
  const k=korName.trim();
  if(!k) return "";
  const {data}=await supabase.from("students").select("name_en").eq("name_kr",k);
  const found=(data||[]).find(r=>r.name_en&&r.name_en.trim());
  return found?.name_en||"";
}
function getNextMonday(dateStr:string){const d=new Date(dateStr);const day=d.getDay();const daysUntilMonday=(8-day)%7;d.setDate(d.getDate()+daysUntilMonday);return d.toISOString().split('T')[0];}
// 아카데미 종료일 계산 (월~금 학원 운영 가정)
// start = 월요일, weeks = 운영 주차 → end = start + (weeks-1)*7 + 4 (금요일)
function calcAcademyEnd(startStr:string,weeks:number|string):string{
  if(!startStr) return "";
  const w=Number(weeks);
  if(!w||w<1) return "";
  return addDays(startStr,(w-1)*7+4);
}

const todayStr = new Date().toISOString().slice(0,10);
const todayCompact = todayStr.replace(/-/g,"");

export default function InvoicePageWrapper(){ return <Suspense><InvoicePageInner/></Suspense>; }

function InvoicePageInner(){
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookingId = searchParams.get("id");
  const assigneeParam = searchParams.get("assignee") || "";
  const invoiceType = searchParams.get("type") || ""; // guest | resort | ""
  const [dbLoaded, setDbLoaded] = useState(false);

  /* ── 견적 상태 (기존 유지) ── */
  const [cm,setCm]=useState<"single"|"combo">("single");
  const [a1T,setA1T]=useState<AT>("dreamhouse");
  const [a1R,setA1R]=useState("디럭스");
  const [dhOnly,setDhOnly]=useState(false);
  const [acadOpt,setAcadOpt]=useState(false);
  const [a1W,setA1W]=useState(2);
  const [a1CI,setA1CI]=useState("");
  const [a2T,setA2T]=useState<AT>("jpark");
  const [a2R,setA2R]=useState("디럭스");
  const [a2W,setA2W]=useState(2);
  const [cP,setCP]=useState(1);
  const [cK,setCK]=useState(1);
  const [ex1Cnt,setEx1Cnt]=useState(0);
  const [ex2Cnt,setEx2Cnt]=useState(0);
  const [dbCheckout,setDbCheckout]=useState<string>("");
  const [lateCheckout,setLateCheckout]=useState(false); // 레이트 체크아웃 (12noon→22:30pm)

  const a1CO=a1CI?addDays(a1CI,a1W*7):"";
  const a2CI=cm==="combo"?a1CO:"";
  const a2CO=a2CI?addDays(a2CI,a2W*7):"";

  /* ── 날짜/기간 변경 시 드림하우스·큐브나인 가용성 가드 (오버부킹 방지) ── */
  const availGuard=useRef<{ci:string;w:number;w2:number;m:string;t1:string;t2:string}|null>(null);
  useEffect(()=>{(async()=>{
    if(isCommute||!a1CI)return;
    const cur={ci:a1CI,w:a1W,w2:a2W,m:cm,t1:a1T,t2:a2T};
    const prev=availGuard.current;
    availGuard.current=cur;
    if(!prev)return; // 최초 로드는 기록만
    if(prev.ci===cur.ci&&prev.w===cur.w&&prev.w2===cur.w2&&prev.m===cur.m&&prev.t1===cur.t1&&prev.t2===cur.t2)return;
    const warns:string[]=[];
    try{
      // 드림하우스 구간
      const dhSeg=a1T==="dreamhouse"?[a1CI,a1CO]:(cm==="combo"&&a2T==="dreamhouse"?[a2CI,a2CO]:null);
      if(dhSeg&&dhSeg[0]&&dhSeg[1]&&dhSeg[0]<dhSeg[1]){
        const av=await fetch(`/api/dreamhouse/availability?ci=${dhSeg[0]}&co=${dhSeg[1]}${bookingId?`&exclude=${bookingId}`:""}`).then(r=>r.json());
        if(Array.isArray(av.fullDates)&&av.fullDates.length>0)warns.push("드림하우스 만실: "+av.fullDates.slice(0,4).map((d:string)=>d.slice(5)).join(", ")+(av.fullDates.length>4?` 외 ${av.fullDates.length-4}일`:""));
      }
      // 큐브나인 구간 (룸타입별 수량)
      const cnSeg=a1T==="cubenine"?[a1CI,a1CO,a1R]:(cm==="combo"&&a2T==="cubenine"?[a2CI,a2CO,a2R]:null);
      if(cnSeg&&cnSeg[0]&&cnSeg[1]&&cnSeg[0]<cnSeg[1]){
        const rt=String(cnSeg[2]||"디럭스");const isFA=rt.includes("풀");const cap=isFA?4:7;
        const grp=isFA?["103","104","105","106"]:["204","205","206","207","208","209","210"];
        const {data:st}=await supabase.from("app_settings").select("value").eq("key","cube9_room_blocks").maybeSingle();
        const blocks=(Array.isArray(st?.value)?st!.value:[]) as {room:string;ci:string;co:string;booking_id?:string}[];
        const blk=blocks.filter(x=>grp.includes(x.room)&&x.booking_id!==bookingId&&x.ci<cnSeg[1]&&cnSeg[0]<x.co);
        const linked=new Set(blocks.map(x=>x.booking_id).filter(Boolean));
        const {data:bks}=await supabase.from("bookings").select("id,cn_room_type,checkin_date,checkout_date,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout,status,paid_amount").ilike("accom_type","%큐브%");
        // 날짜별 실제 동시 점유로 판정 (미입금 접수 건은 제외)
        const ivs:{ci:string;co:string}[]=blk.map(x=>({ci:String(x.ci),co:String(x.co)}));
        for(const b of (bks||[])){
          if(b.id===bookingId||String(b.status||"").includes("취소")||linked.has(b.id))continue;
          if((b.cn_room_type||"디럭스").includes("풀")!==isFA)continue;
          const confirmed=Number((b as {paid_amount?:number}).paid_amount||0)>0||/영수증발행|결제완료|완료|인보이스발행/.test(String(b.status||""));
          if(!confirmed)continue;
          let bci=b.checkin_date,bco=b.checkout_date;
          if(b.seg1_type==="cubenine"){bci=b.seg1_checkin;bco=b.seg1_checkout;}
          else if(b.seg2_type==="cubenine"){bci=b.seg2_checkin;bco=b.seg2_checkout;}
          if(bci&&bco&&String(bci)<cnSeg[1]&&cnSeg[0]<String(bco))ivs.push({ci:String(bci),co:String(bco)});
        }
        const _pad=(n:number)=>String(n).padStart(2,"0");
        const fullD:string[]=[];
        {const d=new Date(cnSeg[0]+"T00:00:00");const end=new Date(cnSeg[1]+"T00:00:00");
         while(d<end){const dsr=`${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
           const n=ivs.filter(v=>v.ci<=dsr&&dsr<v.co).length;
           if(n>=cap)fullD.push(dsr);d.setDate(d.getDate()+1);}}
        if(fullD.length)warns.push(`큐브나인 ${isFA?"풀억세스":"디럭스오션"} 만실 날짜: `+fullD.slice(0,5).map(x=>x.slice(5)).join(", ")+(fullD.length>5?` 외 ${fullD.length-5}일`:"")+` (정원 ${cap}팀)`);
      }
    }catch{/* 확인 실패 시 차단하지 않음 */}
    if(warns.length){
      const go=confirm("🚨 오버부킹 경고 — 변경하려는 기간에 자리가 없습니다!\n\n"+warns.join("\n")+"\n\n[취소] = 이전 날짜로 되돌리기 (권장)\n[확인] = 만실 무시하고 강제 변경 (오버부킹 위험)");
      if(!go){availGuard.current=prev;setA1CI(prev.ci);setA1W(prev.w);setA2W(prev.w2);}
    }
  })();},[a1CI,a1W,a2W,cm,a1T,a2T]);
  const overallCI=a1CI;
  /* ── 체류 기간 휴무일 (배포된 휴일, 인보이스에 자동 표시 — 날짜 변경 시 갱신) ── */
  const [allHolidays,setAllHolidays]=useState<HolidayItem[]>([]);
  useEffect(()=>{fetchDeployedHolidays().then(setAllHolidays);},[]);
  // 체크아웃: dbCheckout(수동 수정값) 우선, 없으면 자동계산(a1W*7 / 콤보 a2CO)
  const overallCO=dbCheckout||(cm==="combo"?a2CO:a1CO);
  /* 콤보 숙소별 구간 표시 (인보이스 어느 날짜가 어느 숙소인지) */
  const _accomKo=(t:string)=>t==="dreamhouse"?"드림하우스":t==="jpark"?"제이파크":t==="cubenine"?"큐브나인":t;
  const _accomEn=(t:string)=>t==="dreamhouse"?"Dream House":t==="jpark"?"J Park":t==="cubenine"?"Cube Nine":t;

  const stayHolidays=holidaysInRange(allHolidays,overallCI,overallCO);
  const coTimeText=lateCheckout?"22:30pm":"12noon"; // 체크아웃 시간 표기
  async function syncLateCheckout(v:boolean){
    setLateCheckout(v);
    if(bookingId){try{await supabase.from("bookings").update({late_checkout:v}).eq("id",bookingId);}catch{}}
  }

  /* ── 새 상태 ── */
  const [preview,setPreview]=useState(false);
  const [reservationNo,setReservationNo]=useState(()=>"DA-"+todayCompact+"-"+Math.floor(Math.random()*900000+100000));
  const [reservationDate,setReservationDate]=useState(todayStr);
  const [booker,setBooker]=useState({name:"",englishName:"",balanceDate:""});
  const [students,setStudents]=useState<StudentInfo[]>([{id:1,korName:"",engName:"",age:"",grade:"주니어",academyStart:"",academyEnd:"",academyWeeks:"2",photo:"O"}]);
  const [applied,setApplied]=useState(false);
  const [billing,setBilling]=useState({basePrice:0,items:[] as{label:string;price:number;season:string;accom?:string;roomType?:string;weeks?:number;parents?:number;kids?:number}[],discounts:[{id:1,name:"",amount:0}] as Disc[],additions:[{id:1,name:"",amount:0}] as Disc[],locals:[{id:1,name:"드림하우스 보증금",amount:""}] as LC[]});
  const [checkin,setCheckin]=useState({pickup:"O",drop:"O",pickupPlace:"",flightIn:"",flightOut:"",houseNo:"",specialRequest:""});
  const [adminOnly,setAdminOnly]=useState({agency:"",ssp:"O"});
  const [isCommute,setIsCommute]=useState(false);

  /* ── 인보이스 스냅샷 (저장/불러오기) ── */
  const [snapshotChecked,setSnapshotChecked]=useState(false); // 스냅샷 조회 완료 여부
  const [hasSnapshot,setHasSnapshot]=useState(false);          // 저장된 스냅샷 존재 여부 (뷰 모드)
  const [snapshotSavedAt,setSnapshotSavedAt]=useState<string>("");
  const [confirmedAt,setConfirmedAt]=useState<string>("");      // 확정 시각 (있으면 🔒)

  /* ── 인보이스/영수증 서브탭 ── */
  const initialTab=(searchParams.get("tab")==="receipt")?"receipt":"invoice";
  const [tab,setTab]=useState<"invoice"|"receipt">(initialTab);
  const [receiptPayments,setReceiptPayments]=useState<{id:number;type:string;date:string;amount:string}[]>([
    {id:1,type:"예약금",date:todayStr,amount:""}
  ]);
  const [dhRegistered,setDhRegistered]=useState(false);
  // 이미 룸이 배정된 예약(B17L10 등)은 처음부터 "하우스 등록완료"로 표시
  useEffect(()=>{ if(/^B\d/i.test((checkin.houseNo||"").trim())) setDhRegistered(true); },[checkin.houseNo]);
  const [savingReceipt,setSavingReceipt]=useState(false);

  // 현재 폼 상태 전체를 스냅샷 객체로 수집
  // billing(=금액·할인·추가·현지지불·basePrice)·applied 등 폼 state 전체. override로 일부 키 덮어쓰기 가능
  function collectFormState(override?:Record<string,unknown>){
    return {cm,a1T,a1R,a1W,a1CI,a2T,a2R,a2W,cP,cK,ex1Cnt,ex2Cnt,dbCheckout,
      reservationNo,reservationDate,booker,students,applied,billing,checkin,adminOnly,isCommute,forceFullPayment,lateCheckout,
      receiptPayments,
      ...(override||{})};
  }
  // 스냅샷 saved_data → 폼 상태 복원
  function applySnapshot(d:any){
    if(!d) return;
    if(d.cm!==undefined)setCm(d.cm);
    if(d.a1T!==undefined)setA1T(d.a1T);
    if(d.a1R!==undefined)setA1R(d.a1R);
    if(d.a1W!==undefined)setA1W(d.a1W);
    if(d.a1CI!==undefined)setA1CI(d.a1CI);
    if(d.a2T!==undefined)setA2T(d.a2T);
    if(d.a2R!==undefined)setA2R(d.a2R);
    if(d.a2W!==undefined)setA2W(d.a2W);
    if(d.cP!==undefined)setCP(d.cP);
    if(d.cK!==undefined)setCK(d.cK);
    if(d.ex1Cnt!==undefined)setEx1Cnt(d.ex1Cnt);
    if(d.ex2Cnt!==undefined)setEx2Cnt(d.ex2Cnt);
    if(d.dbCheckout!==undefined)setDbCheckout(d.dbCheckout);
    if(d.reservationNo!==undefined)setReservationNo(d.reservationNo);
    if(d.reservationDate!==undefined)setReservationDate(d.reservationDate);
    if(d.booker!==undefined)setBooker(d.booker);
    if(Array.isArray(d.students)){setStudents(d.students);fillStudentInfo(bookingId,d.students).then(f=>{if(f!==d.students)setStudents(f);});}
    if(d.billing!==undefined)setBilling(d.billing);
    // billing(items/금액)이 있으면 applied=true 강제 — 미리보기 "견적 계산 후 적용" 문구 방지
    const hasBilling=!!(d.billing&&((Array.isArray(d.billing.items)&&d.billing.items.length>0)||Number(d.billing.basePrice)>0));
    setApplied(!!d.applied||hasBilling);
    if(d.checkin!==undefined)setCheckin(d.checkin);
    if(d.adminOnly!==undefined)setAdminOnly(d.adminOnly);
    // isCommute는 스냅샷이 아니라 실제 예약(booking_type/accom_type)에서만 판정 → 아래 전용 useEffect (stale 스냅샷이 통학형을 가리는 문제 방지)
    if(d.forceFullPayment!==undefined)setForceFullPayment(d.forceFullPayment);
    if(d.lateCheckout!==undefined)setLateCheckout(d.lateCheckout);
    if(Array.isArray(d.receiptPayments)&&d.receiptPayments.length>0)setReceiptPayments(d.receiptPayments);
  }
  /* ── 인보이스 확정/해제 (PATCH confirmed_at + saved_data 함께 저장) ── */
  async function confirmInvoice(){
    if(!bookingId){alert("예약 ID가 없어 확정할 수 없습니다.");return;}
    try{
      const res=await fetch("/api/invoice/snapshot",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({booking_id:bookingId,saved_data:collectFormState()}),
      });
      const j=await res.json().catch(()=>null);
      if(!res.ok){alert("확정 실패: "+(j?.error||res.status));return;}
      setConfirmedAt(j?.snapshot?.confirmed_at||new Date().toISOString());
      setSnapshotSavedAt(j?.snapshot?.saved_at||new Date().toISOString());
      setHasSnapshot(true);
      // 인보이스 확정 시 예약 상태 변경 + 체크인/체크아웃 자동 동기화 (인보이스에서 조정한 날짜가 예약 원본에 반영)
      // 영수증발행은 실제 지불내역 금액이 있을 때만 — 없으면 인보이스발행까지만 (2026-07-30 메이 지시)
      const upd:Record<string,unknown>={status:receiptPaidTotal>0?"영수증발행":"인보이스발행",updated_at:new Date().toISOString()};
      if(!isCommute){
        if(a1CI) upd.checkin_date=a1CI;
        if(overallCO) upd.checkout_date=overallCO;
        // 숙소 구성 동기화 — 인보이스에서 콤보/단독 구성을 바꾼 경우 예약 레코드도 일치시킴 (2026-07-30)
        const KO:Record<string,string>={dreamhouse:"드림하우스",jpark:"제이파크",cubenine:"큐브나인"};
        const SEG:Record<string,string>={dreamhouse:"dreamhouse",jpark:"jaypark",cubenine:"cubenine"};
        if(cm==="combo"&&a1CI&&a1CO&&a2CO){
          upd.accom_type=`${KO[a1T]||a1T}+${KO[a2T]||a2T}`;
          upd.seg1_type=SEG[a1T]||a1T;upd.seg1_checkin=a1CI;upd.seg1_checkout=a1CO;
          upd.seg2_type=SEG[a2T]||a2T;upd.seg2_checkin=a2CI;upd.seg2_checkout=overallCO||a2CO;
          if(a1T==="dreamhouse")upd.dh_weeks=a1W;if(a2T==="dreamhouse")upd.dh_weeks=a2W;
          if(a1T==="jpark")upd.jp_weeks=a1W;if(a2T==="jpark")upd.jp_weeks=a2W;
          if(a1T==="cubenine"){upd.cn_period=`${a1W}주`;upd.cn_room_type=a1R;}
          if(a2T==="cubenine"){upd.cn_period=`${a2W}주`;upd.cn_room_type=a2R;}
        }else if(cm==="single"&&!dhOnly){
          upd.accom_type=a1T==="dreamhouse"?"드림하우스":`${KO[a1T]||a1T} 패키지`;
          upd.seg1_type=null;upd.seg1_checkin=null;upd.seg1_checkout=null;
          upd.seg2_type=null;upd.seg2_checkin=null;upd.seg2_checkout=null;
          if(a1T==="cubenine"){upd.cn_period=`${a1W}주`;upd.cn_room_type=a1R;}
          if(a1T==="jpark")upd.jp_weeks=a1W;
          if(a1T==="dreamhouse")upd.dh_weeks=a1W;
        }
      }
      const {error:stErr}=await supabase.from("bookings").update(upd).eq("id",bookingId);
      if(stErr) console.error("[confirmInvoice status]",stErr);
      alert("✅ 인보이스가 확정되었습니다."+(stErr?"":"\n(예약 상태: 영수증발행 · 체크인/아웃 동기화)"));
    }catch(e){console.error(e);alert("확정 실패 — 네트워크/서버 확인");}
  }
  // "수정하기" 진입 — 확정 상태면 경고 후 confirmed_at = null로 풀고 편집 모드 진입
  async function requestEdit(){
    if(confirmedAt){
      const ok=confirm("확정된 인보이스를 수정하면 재확정이 필요합니다. 계속할까요?");
      if(!ok) return;
      if(bookingId){
        try{
          await fetch("/api/invoice/snapshot",{
            method:"PATCH",headers:{"Content-Type":"application/json"},
            body:JSON.stringify({booking_id:bookingId,confirmed_at:null,saved_data:collectFormState()}),
          });
        }catch{}
      }
      setConfirmedAt("");
    }
    setPreview(false);
    setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),100);
  }

  // 저장된 인보이스 전체 삭제(초기화) → 예약 정보로 처음부터 다시 불러옴
  async function resetInvoice(){
    if(!bookingId) return;
    if(!confirm("저장된 인보이스를 삭제하고 예약 정보로 처음부터 다시 불러올까요?\n입력했던 금액·항목이 모두 지워집니다.")) return;
    try{
      const res=await fetch("/api/invoice/snapshot?booking_id="+encodeURIComponent(bookingId),{method:"DELETE"});
      if(!res.ok){ const j=await res.json().catch(()=>({})); alert("초기화 실패: "+(j.error||res.status)); return; }
      window.location.reload();
    }catch{ alert("초기화 실패"); }
  }

  // 스냅샷 저장 (인보이스 미리보기 클릭 시 자동 호출)
  async function saveSnapshot(override?:Record<string,unknown>){
    if(!bookingId) return;
    try{
      const res=await fetch("/api/invoice/snapshot",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({booking_id:bookingId,saved_data:collectFormState(override)}),
      });
      if(res.ok){
        const j=await res.json();
        setHasSnapshot(true);
        setSnapshotSavedAt(j?.snapshot?.saved_at||new Date().toISOString());
      }
    }catch{/* 테이블 미생성 등 — 미리보기 자체는 정상 동작 */}
  }

  /* ── 학생 academyStart 자동동기화 (다음 월요일) — academyEnd는 DB값 우선 보존 ── */
  useEffect(()=>{
    // 드하 단독(숙소만, 아카데미 미등록): 아카데미 날짜 자동값 없음 + 이미 채워진 자동값 제거
    if(dhOnly&&!acadOpt){
      setStudents(prev=>prev.some(s=>s.academyStart||s.academyEnd)?prev.map(s=>({...s,academyStart:"",academyEnd:""})):prev);
      return;
    }
    if(!a1CI) return;
    const monday=getNextMonday(a1CI);
    setStudents(prev=>prev.map(s=>({...s,academyStart:monday,academyEnd:(s.academyStart===monday&&s.academyEnd)?s.academyEnd:calcAcademyEnd(monday,s.academyWeeks)})));
  },[a1CI,dhOnly,acadOpt]);

  /* ── 스냅샷 우선 조회 — 있으면 뷰 모드, 없으면 예약 로드로 진행 ── */
  useEffect(()=>{
    if(!bookingId){setSnapshotChecked(true);return;}
    let cancelled=false;
    fetch("/api/invoice/snapshot?booking_id="+encodeURIComponent(bookingId))
      .then(r=>r.ok?r.json():null)
      .then(j=>{
        if(cancelled)return;
        // route가 {snapshot:{...}} wrapper로 반환할 수도, 루트로 반환할 수도 있어 폴백 처리
        const snap=j&&(j.snapshot??j);
        if(snap&&snap.saved_data){
          applySnapshot(snap.saved_data);
          setSnapshotSavedAt(snap.saved_at||"");
          setConfirmedAt(snap.confirmed_at||"");
          setHasSnapshot(true);
          setPreview(true); // 저장된 데이터 기준 뷰 모드
        }
      })
      .catch(()=>{})
      .finally(()=>{if(!cancelled)setSnapshotChecked(true);});
    return ()=>{cancelled=true;};
  },[bookingId]);

  /* ── isCommute는 스냅샷 유무와 무관하게 항상 실제 예약에서 판정 (stale 스냅샷이 통학형을 가리는 문제 방지) ── */
  useEffect(()=>{
    if(!bookingId) return;
    supabase.from("bookings").select("booking_type,accom_type,academy_option").eq("id",bookingId).maybeSingle().then(({data})=>{
      if(data){
        setIsCommute(isCommuteBooking(data));
        setDhOnly((data.accom_type||"").includes("드림하우스 단독"));
        setAcadOpt(!!data.academy_option);
      }
    });
  },[bookingId]);

  /* ── DB에서 예약 로드 (스냅샷 없을 때만) ── */
  useEffect(()=>{
    if(!bookingId||!snapshotChecked||hasSnapshot) return;
    supabase.from("bookings").select("*").eq("id",bookingId).single().then(async({data})=>{
      if(!data) return;
      // 영문이름 폴백: booker_english > checkin_details.guest_names_en 첫 이름
      let englishName=data.booker_english||"";
      if(!englishName){
        try{
          const cd=await supabase.from("checkin_details").select("guest_names_en").eq("booking_id",bookingId).maybeSingle();
          const raw=cd.data?.guest_names_en||"";
          if(raw){
            // 첫 번째 이름 추출 (구분자: / , · 줄바꿈)
            const first=raw.split(/[/,·\n]/)[0]?.trim()||"";
            if(first) englishName=first;
          }
        }catch{}
      }
      setBooker({name:data.booker_name,englishName,balanceDate:data.balance_date||""});
      setIsCommute(isCommuteBooking(data));
      if(data.checkout_date) setDbCheckout(data.checkout_date);
      let sts:any[]=[];
      try{const parsed=typeof data.students==="string"?JSON.parse(data.students):data.students;if(Array.isArray(parsed))sts=parsed;}catch{}
      // JSONB가 비어있거나 이름이 모두 비어있으면 students 테이블 fallback
      const hasName=(s:any)=>String(s?.korName||s?.name_kr||s?.engName||s?.name_en||"").trim().length>0;
      if(sts.length===0||!sts.some(hasName)){
        const {data:fromTable}=await supabase.from("students").select("*").eq("booking_id",bookingId);
        if(fromTable&&fromTable.length>0){
          sts=fromTable.map((r:any)=>({
            korName:r.name_kr||"",engName:r.name_en||"",
            age:r.age||"",grade:r.class_type||"",
            academyStart:r.academy_start||"",academyEnd:r.academy_end||"",
            academyWeeks:"",photo:r.photo_allowed===false?"X":"O",
            name_kr:r.name_kr||"",name_en:r.name_en||"",
            birth_date:r.age||"",level:r.level||"",
          }));
        }
      }
      sts=await fillStudentInfo(bookingId,sts);
      if(sts.length>0) setStudents(sts.map((s:any,i:number)=>({...s,id:i+1,academyStart:s.academyStart||"",academyEnd:s.academyEnd||"",academyWeeks:s.academyWeeks||"2",photo:s.photo||"O"})));
      // 룸 번호: house_no 우선, 없으면 accom_room 폴백. DH 접두어 제거 + 공백 제거 + 대문자
      const rawRoom=(data.house_no||data.accom_room||"").toString();
      const normalizedRoom=rawRoom.replace(/^dh/i,"").replace(/\s+/g,"").toUpperCase();
      setCheckin(c=>({...c,pickup:data.pickup||"O",drop:data.drop_off||"O",pickupPlace:data.pickup_place||"",flightIn:data.flight_in||"",flightOut:data.flight_out||"",houseNo:normalizedRoom,specialRequest:data.special_request||""}));
      setAdminOnly({agency:data.agency||"개인",ssp:data.ssp||"O"});
      // 🏫 숙소 단독 + 아카데미 별도 등록(academy_option): 수업료(통학형 요금표)를 추가 항목으로 자동 세팅
      if(data.academy_option&&(data.accom_type||"").includes("단독")){
        try{
          const kidsN=Math.max(1,(sts.filter((st:any)=>String(st?.korName||st?.name_kr||"").trim()).length)||Number(data.children)||1);
          const s0:any=sts[0]||{};
          const aStart=s0.academyStart||data.academy_start||data.checkin_date||"";
          const aEnd=s0.academyEnd||data.academy_end||data.checkout_date||"";
          let aw=0;
          if(aStart&&aEnd){
            const diff=Math.round((new Date(aEnd).getTime()-new Date(aStart).getTime())/86400000);
            aw=Math.max(1,Math.round((diff+3)/7));
          }
          if(!aw&&data.accom_weeks)aw=Number(data.accom_weeks)||0;
          if(aw>0){
            const pk=isPeak(aStart);
            const amt=commuteUnitPrice(aw,pk?"peak":"off")*kidsN;
            const label=`아카데미 수업료 ${aw}주 × 학생 ${kidsN}명 (${pk?"성수기":"비수기"})`;
            setBilling(b=>{
              if(b.additions.some(x=>(x.name||"").startsWith("아카데미 수업료")))return b;
              const item={id:Date.now(),name:label,amount:amt};
              const empty=b.additions.length===1&&!b.additions[0].name&&!b.additions[0].amount;
              return {...b,additions:empty?[item]:[...b.additions,item]};
            });
          }
        }catch{/* 자동 추가 실패해도 인보이스는 정상 진행 */}
      }
      if(data.checkin_date) setA1CI(data.checkin_date);
      // accom_type 매핑 (booking → calculator)
      const _at = data.accom_type as string | undefined;
      if (_at && _at.includes("+")) {
        // 콤보 처리 — includes 기반 (정확매칭 실패 방지)
        if (_at.includes("드림하우스") && _at.includes("제이파크")) {
          setCm("combo"); setA1T("dreamhouse"); setA2T("jpark");
          if(data.dh_weeks) setA1W(data.dh_weeks);
          if(data.jp_weeks) setA2W(data.jp_weeks);
          if(data.jp_room_type) setA2R(data.jp_room_type);
        } else if (_at.includes("드림하우스") && (_at.includes("큐브나인") || _at.includes("큐브"))) {
          setCm("combo"); setA1T("dreamhouse"); setA2T("cubenine");
          if(data.dh_weeks) setA1W(data.dh_weeks);
          if(data.cn_period){
            const raw=String(data.cn_period);
            if(raw.includes("6일")||raw==="6일"){setA2W(1);}
            else{const m=raw.match(/(\d+)/);if(m)setA2W(Number(m[1]));}
          }
          if(data.cn_room_type) setA2R(data.cn_room_type);
        }
      } else if (_at && _at.includes("드림하우스")) {
        setCm("single"); setA1T("dreamhouse");
      } else if (_at && _at.includes("제이파크")) {
        // "제이파크", "제이파크 단독", "제이파크 패키지" 등 모두 매칭
        setCm("single"); setA1T("jpark");
      } else if (_at && (_at.includes("큐브나인") || _at.includes("큐브"))) {
        setCm("single"); setA1T("cubenine");
      }
      // 콤보 fallback: dh_weeks/jp_weeks/cn_period 모두 NULL인 옛 예약 → accom_weeks 반분 또는 dates 역산
      if(_at && _at.includes("+")){
        const hasW1=!!(data.dh_weeks);
        const hasW2=!!(data.jp_weeks||data.cn_period);
        if(!hasW1&&!hasW2&&data.accom_weeks){
          // accom_weeks를 반으로 나눠 양쪽에 배분 (정확하지 않으나 default(2)보다 나음)
          const half=Math.ceil(Number(data.accom_weeks)/2);
          setA1W(half); setA2W(Number(data.accom_weeks)-half);
        }
      }
      // "통학형" 또는 미일치 — 변경 없음 (default 유지)
      // 콤보일 때 accom_weeks는 합산값이라 a1W에 통째 넣으면 a2W=0 사고 발생.
      const _bt = data.booking_type as string | undefined;
      const isCombo = !!((_at && _at.includes("+")) || _bt === "dreamhouse_jaypark" || _bt === "dreamhouse_cubenine");
      // booking_type 기반 콤보 감지 (accom_type이 없는 신규 예약용)
      if (!(_at && _at.includes("+")) && _bt === "dreamhouse_jaypark") {
        setCm("combo"); setA1T("dreamhouse"); setA2T("jpark");
        if(data.dh_weeks) setA1W(data.dh_weeks);
        if(data.jp_weeks) setA2W(data.jp_weeks);
      } else if (!(_at && _at.includes("+")) && _bt === "dreamhouse_cubenine") {
        setCm("combo"); setA1T("dreamhouse"); setA2T("cubenine");
        if(data.dh_weeks) setA1W(data.dh_weeks);
      } else if (!(_at && _at.includes("+")) && (_bt === "dreamhouse")) {
        setCm("single"); setA1T("dreamhouse");
        if(data.dh_weeks) setA1W(data.dh_weeks);
      } else if (!(_at && _at.includes("+")) && (_bt === "jaypark")) {
        setCm("single"); setA1T("jpark");
        if(data.jp_weeks) setA1W(data.jp_weeks);
        if(data.jp_room_type) setA1R(data.jp_room_type);
      } else if (!(_at && _at.includes("+")) && (_bt === "cubenine")) {
        setCm("single"); setA1T("cubenine");
      }
      if (data.accom_weeks && !isCombo) {
        setA1W(data.accom_weeks);
      }
      // 통학형: accom_weeks 없으면 날짜 기반 주수 역산
      if (isCommuteBooking(data) && !data.accom_weeks) {
        const _start = data.academy_start || data.checkin_date;
        const _end = data.academy_end || data.checkout_date;
        if (_start && _end) {
          const diffW = Math.round((new Date(_end).getTime() - new Date(_start).getTime()) / (7 * 86400000));
          if (diffW > 0) setA1W(diffW);
        }
      }
      // 단독: 분해 컬럼이 있으면 우선 사용 (정확도 ↑)
      if (!isCombo) {
        if (_at && _at.includes("드림하우스") && data.dh_weeks) setA1W(data.dh_weeks);
        if (_at && _at.includes("제이파크") && data.jp_weeks) {
          setA1W(data.jp_weeks);
          if(data.jp_room_type) setA1R(data.jp_room_type);
        }
        if (_at && (_at.includes("큐브나인") || _at.includes("큐브")) && data.cn_period) {
          const raw=String(data.cn_period);
          if(raw.includes("6일")||raw==="6일"){setA1W(1);}
          else{const m=raw.match(/(\d+)/);if(m)setA1W(Number(m[1]));}
          if(data.cn_room_type) setA1R(data.cn_room_type);
        }
      }
      // 숙소 구간(seg1/seg2)이 있으면 순서·날짜·기간을 그대로 반영 (최종 override)
      if (data.seg1_type && data.seg2_type) {
        const segMap: Record<string, AT> = { jaypark: "jpark", dreamhouse: "dreamhouse", cubenine: "cubenine" };
        const s1 = segMap[data.seg1_type as string] || "dreamhouse";
        const s2 = segMap[data.seg2_type as string] || "jpark";
        const segW = (a?: string, b?: string) => {
          if (!a || !b) return 0;
          const w = Math.round((new Date(b).getTime() - new Date(a).getTime()) / (7 * 86400000));
          return w > 0 ? w : 0;
        };
        const sc1 = ((data.seg1_checkin as string) || "").split("T")[0];
        const w1 = segW(data.seg1_checkin as string, data.seg1_checkout as string);
        const w2 = segW(data.seg2_checkin as string, data.seg2_checkout as string);
        setCm("combo");
        setA1T(s1); setA2T(s2);
        if (sc1) setA1CI(sc1);
        if (w1) setA1W(w1);
        if (w2) setA2W(w2);
        if (s1 === "jpark" && data.jp_room_type) setA1R(data.jp_room_type);
        if (s1 === "cubenine" && data.cn_room_type) setA1R(data.cn_room_type);
        if (s2 === "jpark" && data.jp_room_type) setA2R(data.jp_room_type);
        if (s2 === "cubenine" && data.cn_room_type) setA2R(data.cn_room_type);
      }
      if(data.adults) setCP(data.adults);
      if(data.children){setCK(data.children);}else if(sts&&sts.length>0){setCK(sts.length);}
      if(data.base_price>0){
        const items=typeof data.billing_items==="string"?JSON.parse(data.billing_items):(data.billing_items||[]);
        const discs=typeof data.discounts==="string"?JSON.parse(data.discounts):(data.discounts||[]);
        const adds=typeof data.additions==="string"?JSON.parse(data.additions):(data.additions||[]);
        const locs=typeof data.locals==="string"?JSON.parse(data.locals):(data.locals||[]);
        const _isCommute=isCommuteBooking(data);
        const defaultLocals:LC[]=_isCommute?[{id:1,name:"",amount:""}]:[{id:1,name:"드림하우스 보증금",amount:""}];
        const filteredLocs=_isCommute?locs.filter((l:LC)=>l.name!=="드림하우스 보증금"):locs;
        setBilling({basePrice:data.base_price,items,discounts:discs.length>0?discs:[{id:1,name:"",amount:0}],additions:adds.length>0?adds:[{id:1,name:"",amount:0}],locals:filteredLocs.length>0?filteredLocs:defaultLocals});
        setApplied(true);
        // calculator state 복원 (룸타입/주수/인원 — 신 포맷 items에만 존재. 옛 데이터는 undefined → no-op)
        // 단, 숙소 구간(seg1/seg2)이 있으면 숙소/주수는 구간이 source → 저장된 accom/weeks 복원 스킵(순서 보존)
        const _hasSeg = !!(data.seg1_type && data.seg2_type);
        if(items[0]){
          if(!_hasSeg && items[0].accom) setA1T(items[0].accom);
          if(!_hasSeg && items[0].roomType) setA1R(items[0].roomType);
          if(!_hasSeg && items[0].weeks) setA1W(items[0].weeks);
          if(items[0].parents) setCP(items[0].parents);
          if(items[0].kids) setCK(items[0].kids);
        }
        if(items[1]){
          setCm("combo");
          if(!_hasSeg && items[1].accom) setA2T(items[1].accom);
          if(!_hasSeg && items[1].roomType) setA2R(items[1].roomType);
          if(!_hasSeg && items[1].weeks) setA2W(items[1].weeks);
        }
      }
      if(data.reservation_no) setReservationNo(data.reservation_no);
      if(data.reservation_date) setReservationDate(data.reservation_date);
      setDbLoaded(true);
    });
  },[bookingId,snapshotChecked,hasSnapshot]);

  /* ── 담당자 DB 저장 ── */
  useEffect(()=>{
    if(assigneeParam&&bookingId) supabase.from("bookings").update({assignee:assigneeParam}).eq("id",bookingId);
  },[assigneeParam,bookingId]);

  /* ── 잔금납부일 자동계산 (체크인-2개월) ── */
  useEffect(()=>{
    if(!a1CI) return;
    const d=new Date(a1CI);
    d.setMonth(d.getMonth()-2);
    const bd=d.toISOString().slice(0,10);
    setBooker(b=>({...b,balanceDate:bd}));
  },[a1CI]);

  /* ── 숙소 기간 → 학생 기간 자동동기화 — academyEnd는 DB값 우선 보존 ── */
  useEffect(()=>{
    const totalWeeks=cm==="combo"?a1W+a2W:a1W;
    setStudents(prev=>prev.map(s=>({
      ...s,
      academyWeeks:String(totalWeeks),
      academyEnd:(String(s.academyWeeks)===String(totalWeeks)&&s.academyEnd)?s.academyEnd:calcAcademyEnd(s.academyStart,totalWeeks)
    })));
  },[a1W,a2W,cm]);

  /* ── 첫 번째 학생 시작일/기간 → 나머지 학생 자동복사 ── */
  useEffect(()=>{
    if(students.length<2) return;
    const first=students[0];
    setStudents(prev=>prev.map((s,i)=>i===0?s:{
      ...s,
      academyStart:first.academyStart,
      academyWeeks:first.academyWeeks,
      academyEnd:first.academyEnd,
    }));
  },[students[0]?.academyStart,students[0]?.academyWeeks,students[0]?.academyEnd]);

  /* ── 드림하우스 보증금 자동계산 (통학형은 보증금 없음) ── */
  useEffect(()=>{
    const hasDH=cm==="combo"?(a1T==="dreamhouse"||a2T==="dreamhouse"):a1T==="dreamhouse";
    if(isCommute||!hasDH){
      // 통학형·리조트형(드림하우스 없음)이면 드림하우스 보증금 항목 제거
      setBilling(b=>({...b,locals:b.locals.filter(l=>l.name!=="드림하우스 보증금")}));
      return;
    }
    const dhWeeks=cm==="combo"?(a1T==="dreamhouse"?a1W:a2W):a1W;
    const deposit=dhWeeks*2000;
    setBilling(b=>({...b,locals:b.locals.map(l=>l.name==="드림하우스 보증금"?{...l,amount:String(deposit)}:l)}));
  },[a1W,a2W,cm,a1T,a2T,isCommute,hasSnapshot]);

  /* ── 현지 지불 자동 항목 (SSP × 보호자 / 주니어 교재비 / 킨더 재료비) ── */
  const autoLocals=useMemo(()=>{
    const items:{name:string;amount:string;_auto:string}[]=[];
    // 드림하우스 단독(숙소만, 아카데미 미등록): 수업 관련 현지비용(SSP/교재비/킨더 재료비) 없음 — 보증금만
    if(dhOnly&&!acadOpt) return items;
    // SSP: '항상 표시' — cP가 0/NaN/undefined여도 최소 1줄 보장
    const adultCount=Math.max(1,Number(cP)||1);
    for(let i=0;i<adultCount;i++){
      items.push({name:"1인 SSP / SSP I card",amount:"11,000",_auto:"ssp"});
    }
    const isJunior=(s:StudentInfo)=>s.grade==="주니어"||(s.level||"").toLowerCase()==="junior";
    const isKinder=(s:StudentInfo)=>s.grade==="킨더"||(s.level||"").toLowerCase()==="kinder";
    if(students.some(isJunior)){
      items.push({name:"교재비 - 주니어 1권",amount:"350",_auto:"junior"});
    }
    // 킨더 재료비: a1W/a2W에서 직접 주수 계산 (students.academyWeeks 타이밍 문제 우회)
    const kinderStudents=students.filter(isKinder);
    if(kinderStudents.length>0){
      const accomWeeks=cm==="combo"?a1W+a2W:a1W;
      const weeks=accomWeeks||Math.max(...kinderStudents.map(s=>Number(s.academyWeeks)||0),0);
      if(weeks>0){
        const amt=weeks===4?2500:weeks===2?1750:Math.round((weeks/4)*2500);
        const amtFmt=amt.toLocaleString();
        items.push({name:`킨더 - 재료비 ${weeks}주 ${amtFmt}페소`,amount:amtFmt,_auto:"kinder"});
      }
    }
    return items;
  },[cP,students,a1W,a2W,cm,dhOnly,acadOpt]);

  /* ── 자동 항목 → locals 동기화 (최초 append + 주수 변경 시 킨더 재료비 업데이트) ── */
  const autoLocalsApplied=useRef(false);
  useEffect(()=>{
    if(hasSnapshot) return; // 스냅샷/확정 인보이스는 자동채움 스킵
    if(autoLocals.length===0) return;
    const hasSSP=billing.locals.some(l=>l.name?.includes('SSP'));
    if(!hasSSP && !autoLocalsApplied.current){
      // 최초: 기존 locals 유지하면서 자동항목 append
      autoLocalsApplied.current=true;
      const base=Date.now();
      setBilling(prev=>({
        ...prev,
        locals:[
          ...prev.locals,
          ...autoLocals.map((item,i)=>({id:base+i,name:item.name,amount:String(item.amount)}))
        ]
      }));
    } else if(autoLocalsApplied.current){
      // 이미 적용됨 → 킨더 재료비만 갱신 (SSP/교재비는 금액 고정이라 불필요)
      const newKinder=autoLocals.find(a=>a._auto==="kinder");
      setBilling(prev=>{
        const updated=prev.locals.map(l=>{
          if(l.name?.includes('킨더')&&l.name?.includes('재료비')&&newKinder){
            return {...l,name:newKinder.name,amount:String(newKinder.amount)};
          }
          return l;
        });
        // 기존에 킨더가 없었는데 새로 생겼으면 추가
        if(newKinder && !updated.some(l=>l.name?.includes('킨더')&&l.name?.includes('재료비'))){
          updated.push({id:Date.now()+99,name:newKinder.name,amount:String(newKinder.amount)});
        }
        // 킨더 학생이 없어졌으면 제거
        if(!newKinder){
          return {...prev,locals:updated.filter(l=>!(l.name?.includes('킨더')&&l.name?.includes('재료비')))};
        }
        return {...prev,locals:updated};
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[autoLocals, hasSnapshot]);

  /* ── 드하 단독(숙소만): 예약 플래그가 늦게 로드돼 이미 붙은 수업 관련 자동항목 제거 ── */
  useEffect(()=>{
    if(hasSnapshot) return;
    if(!(dhOnly&&!acadOpt)) return;
    setBilling(prev=>{
      const filtered=prev.locals.filter(l=>{
        const n=l.name||"";
        return !(n.includes("SSP")||n.includes("교재비")||(n.includes("킨더")&&n.includes("재료비")));
      });
      if(filtered.length===prev.locals.length) return prev;
      return {...prev,locals:filtered};
    });
  },[dhOnly,acadOpt,hasSnapshot]);

  /* ── 견적 useMemo (100% 기존 유지) ── */
  const est=useMemo(()=>{
    const extras:{label:string;price:number}[]=[];
    // 통학형: 숙소/룸 무관, 학생별 학원비(주차×시즌 단가) 합산 = 학생수×단가. 공용 단가표(commutePricing) 사용.
    if(isCommute){
      const valid=students.filter(s=>(s.korName||"").trim()||(s.engName||"").trim());
      const list:any[]=valid.length>0?valid:[{academyWeeks:String(a1W||2),academyStart:a1CI,korName:"",engName:""}];
      const items:any[]=[];
      let total=0;
      list.forEach((s:any,idx:number)=>{
        let w=Number(s.academyWeeks)||0;
        if(!w && s.academyStart && s.academyEnd){
          w=Math.round((new Date(s.academyEnd).getTime()-new Date(s.academyStart).getTime())/(7*86400000));
        }
        if(!w) w=Number(a1W)||2;
        const pk=isPeak(s.academyStart||a1CI);
        const price=commuteUnitPrice(w,pk?"peak":"off");
        total+=price;
        const nm=(s.korName||s.engName||`학생${idx+1}`);
        items.push({label:`통학형 ${w}주 (${nm})`,price,fullPrice:price,ratio:1,totalW:w,ci:s.academyStart||a1CI,co:"",season:pk?"성수기":"비수기",accom:"commute",roomType:"",weeks:w,parents:0,kids:1});
      });
      return{total,extras,items};
    }
    // 드림하우스 단독(숙소만): 인원·시즌 무관 단일 요금표
    if(dhOnly&&cm==="single"&&a1T==="dreamhouse"){
      const price=dhOnlyPrice(a1W);
      if(price>0){
        return{total:price,extras,items:[{label:`Dream House 단독 ${a1W}주`,price,fullPrice:price,ratio:1,totalW:a1W,ci:a1CI,co:a1CO,season:"숙소만",accom:"dreamhouse",roomType:"",weeks:a1W,parents:cP,kids:cK}]};
      }
    }
    if(cm==="single"){
      const e=lk(a1T,a1R,a1W,cP,cK);if(!e)return null;
      const mx=a1CI?seasonMixInv(a1CI,a1W):{off:a1W,peak:0};
      const price=mx.peak===0?e[1]:mx.off===0?e[2]:Math.round((e[1]/a1W*mx.off+e[2]/a1W*mx.peak)/10000)*10000;
      const pk=mx.peak>0&&mx.off===0;
      const seasonLb=mx.peak===0?"비수기":mx.off===0?"성수기":`혼합 (비수기 ${mx.off}주+성수기 ${mx.peak}주)`;
      if(ex1Cnt>0)extras.push({label:`추가 인원 ${ex1Cnt}명 × 1주`,price:extraRate(a1T)*ex1Cnt});
      const extTotal=extras.reduce((s,x)=>s+x.price,0);
      return{total:price+extTotal,extras,items:[{label:al(a1T,a1R)+" "+a1W+"주",price,fullPrice:price,ratio:1,totalW:a1W,ci:a1CI,co:a1CO,season:seasonLb,accom:a1T,roomType:a1R,weeks:a1W,parents:cP,kids:cK}]};
    }
    const tw=a1W+a2W;
    const e1=lk(a1T,a1R,tw,cP,cK),e2=lk(a2T,a2R,tw,cP,cK);if(!e1||!e2)return null;
    const mx1=a1CI?seasonMixInv(a1CI,a1W):{off:a1W,peak:0};
    const mx2=a2CI?seasonMixInv(a2CI,a2W):{off:a2W,peak:0};
    const segPrice=(e:P3,mx:{off:number;peak:number})=>Math.round((e[1]/tw*mx.off+e[2]/tw*mx.peak)/10000)*10000;
    const p1=segPrice(e1,mx1),p2=segPrice(e2,mx2);
    const f1=sp(e1,mx1.peak>mx1.off),f2=sp(e2,mx2.peak>mx2.off);
    const sLb=(mx:{off:number;peak:number})=>mx.peak===0?"비수기":mx.off===0?"성수기":`혼합 (비${mx.off}+성${mx.peak})`;
    if(ex1Cnt>0)extras.push({label:`${al(a1T,a1R)} 추가 ${ex1Cnt}명 × 1주`,price:extraRate(a1T)*ex1Cnt});
    if(ex2Cnt>0)extras.push({label:`${al(a2T,a2R)} 추가 ${ex2Cnt}명 × 1주`,price:extraRate(a2T)*ex2Cnt});
    const extTotal=extras.reduce((s,x)=>s+x.price,0);
    return{total:p1+p2+extTotal,extras,items:[
      {label:al(a1T,a1R)+" "+a1W+"주",price:p1,fullPrice:f1,ratio:a1W/tw,totalW:tw,ci:a1CI,co:a1CO,season:sLb(mx1),accom:a1T,roomType:a1R,weeks:a1W,parents:cP,kids:cK},
      {label:al(a2T,a2R)+" "+a2W+"주",price:p2,fullPrice:f2,ratio:a2W/tw,totalW:tw,ci:a2CI,co:a2CO,season:sLb(mx2),accom:a2T,roomType:a2R,weeks:a2W,parents:cP,kids:cK},
    ]};
  },[cm,a1T,a1R,a1W,a1CI,a2T,a2R,a2W,a2CI,cP,cK,ex1Cnt,ex2Cnt,isCommute,dhOnly,students]);

  function applyInv(){
    if(!est)return;
    const billItems=[...est.items.map(i=>({label:i.label,price:i.price,season:i.season,accom:i.accom,roomType:i.roomType,weeks:i.weeks,parents:i.parents,kids:i.kids})),...est.extras.map(x=>({label:x.label,price:x.price,season:""}))];
    setBilling(b=>({...b,basePrice:est.total,items:billItems}));
    setApplied(true);
  }

  /* ── 견적 선택 UI (기존 유지) ── */
  function rSel(t:AT,sT:(v:AT)=>void,r:string,sR:(v:string)=>void,w:number,sW:(v:number)=>void,ciVal:string,sCI:((v:string)=>void)|null,coVal:string,label:string){
    return(<div className="ab"><div className="ab-l">{label}</div><div className="f-row">
      <div className="f-group"><label className="f-label">숙소</label><select className="f-select" value={t} onChange={e=>{const v=e.target.value as AT;sT(v);sR(v==="jpark"?"디럭스":v==="cubenine"?"디럭스":"");sW(2);}}><option value="dreamhouse">드림하우스</option><option value="jpark">제이파크</option><option value="cubenine">큐브나인</option></select></div>
      {(t==="jpark"||t==="cubenine")&&<div className="f-group"><label className="f-label">룸타입</label><select className="f-select" value={r} onChange={e=>sR(e.target.value)}>{t==="jpark"?<><option value="디럭스">디럭스 가든뷰</option><option value="프리미어">프리미어 가든뷰</option><option value="막탄스윗">막탄스윗 가든뷰</option></>:<><option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option></>}</select></div>}
      <div className="f-group"><label className="f-label">기간</label><select className="f-select" value={w} onChange={e=>sW(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).filter(v=>t!=="dreamhouse"||v>=2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div>
    </div><div className="f-row">
      <div className="f-group"><label className="f-label">체크인</label>{sCI?<input className="f-input" type="date" value={ciVal} onChange={e=>sCI(e.target.value)}/>:<input className="f-input auto" type="date" value={ciVal} readOnly/>}</div>
      <div className="f-group"><label className="f-label">체크아웃 (자동)</label><input className="f-input auto" value={coVal} readOnly/></div>
    </div></div>);
  }

  /* ── 할인/추가/현지비용 헬퍼 ── */
  const td=billing.discounts.reduce((s,d)=>s+(Number(d.amount)||0),0);
  const ta=billing.additions.reduce((s,a)=>s+(Number(a.amount)||0),0);
  const fp=billing.basePrice+ta-td;
  // 예약금 정책: 리조트형(드림하우스 없이 제이파크/큐브나인만 — 단독·리조트 콤보) = 총액의 50% (천원 반올림), 그 외 = 100만원
  const _isResort=(t:string)=>t==="jpark"||t==="cubenine";
  const isResortSingle=!isCommute&&!dhOnly&&(cm==="combo"?(_isResort(a1T)&&_isResort(a2T)):_isResort(a1T));
  const depositAmt=isResortSingle?Math.round(fp/2/1000)*1000:1000000;
  const receiptPaidTotal=useMemo(()=>receiptPayments
    .filter(p=>(p.amount||"").trim()!=="")
    .reduce((s,p)=>s+(Number(String(p.amount).replace(/[,\s]/g,""))||0),0),
    [receiptPayments]);
  const hasReceiptPayments=receiptPaidTotal>0;
  const daysUntilCheckin=a1CI?Math.floor((new Date(a1CI).getTime()-Date.now())/86400000):999;
  const isFullPayment=daysUntilCheckin<60;
  const [forceFullPayment, setForceFullPayment] = useState(false);
  const effectiveFullPayment = isFullPayment || forceFullPayment || dhOnly; // 드림하우스 단독은 전액입금 정책
  // 이번 청구: 예약금 단계(전액입금 아님 & 기납부<예약금)면 예약금 잔여, 아니면 전체 잔여
  const depositStage = !effectiveFullPayment && receiptPaidTotal < depositAmt;
  const additionalDue = Math.max(0, (depositStage ? depositAmt : fp) - receiptPaidTotal);
  function addD(){setBilling(b=>({...b,discounts:[...b.discounts,{id:Date.now(),name:"",amount:0}]}));}
  function rmD(id:number){setBilling(b=>({...b,discounts:b.discounts.filter(d=>d.id!==id)}));}
  function upD(id:number,f:string,v:string|number){setBilling(b=>({...b,discounts:b.discounts.map(d=>d.id===id?{...d,[f]:v}:d)}));}
  function addA(){setBilling(b=>({...b,additions:[...b.additions,{id:Date.now(),name:"",amount:0}]}));}
  function rmA(id:number){setBilling(b=>({...b,additions:b.additions.filter(a=>a.id!==id)}));}
  function upA(id:number,f:string,v:string|number){setBilling(b=>({...b,additions:b.additions.map(a=>a.id===id?{...a,[f]:v}:a)}));}
  function addL(){setBilling(b=>({...b,locals:[...b.locals,{id:Date.now(),name:"",amount:""}]}));}
  function rmL(id:number){setBilling(b=>({...b,locals:b.locals.filter(c=>c.id!==id)}));}
  function upL(id:number,f:string,v:string){setBilling(b=>({...b,locals:b.locals.map(c=>c.id===id?{...c,[f]:v}:c)}));}
  function autoFillLocals(){
    const validStudents=students.filter(s=>s.korName.trim());
    const totalCount=validStudents.length;
    const juniorCount=validStudents.filter(s=>s.grade==="주니어").length;
    const kinderCount=validStudents.filter(s=>s.grade==="킨더").length;
    const kinderStudents=validStudents.filter(s=>s.grade==="킨더");
    const accomWeeks=cm==="combo"?a1W+a2W:a1W;
    const kinderWeeks=accomWeeks||( kinderStudents.length>0?Math.max(...kinderStudents.map(s=>Number(s.academyWeeks)||0)):0);
    const calcKinder=(w:number)=>{if(w<=0)return 0;if(w===4)return 2500;if(w===2)return 1750;return Math.round((w/4)*2500);};
    const kinderAmount=calcKinder(kinderWeeks);
    const base=Date.now();
    const newRows:LC[]=[];
    if(totalCount>0){
      newRows.push({id:base,name:`SSP (필수, ${totalCount}인)`,amount:String(7000*totalCount)});
      newRows.push({id:base+1,name:`SSP-i Card (${totalCount}인)`,amount:String(4000*totalCount)});
    }
    if(juniorCount>0){
      newRows.push({id:base+2,name:`교재비 (주니어)`,amount:"350"});
    }
    if(kinderCount>0&&kinderAmount>0){
      newRows.push({id:base+3,name:`재료비 (킨더, ${kinderWeeks}주 기준)`,amount:String(kinderAmount)});
    }
    setBilling(b=>({
      ...b,
      locals:[
        ...b.locals.filter(l=>
          !l.name?.includes('SSP') &&
          !l.name?.includes('교재비') &&
          !l.name?.includes('재료비')
        ),
        ...newRows
      ]
    }));
  }

  /* ── 학생 헬퍼 ── */
  function addStudent(){if(students.length>=6)return;const monday=(dhOnly&&!acadOpt)?"":(a1CI?getNextMonday(a1CI):"");setStudents([...students,{id:Date.now(),korName:"",engName:"",age:"",grade:"주니어",academyStart:monday,academyEnd:calcAcademyEnd(monday,2),academyWeeks:"2",photo:"O"}]);}
  function rmStudent(id:number){setStudents(students.filter(s=>s.id!==id));}
  function upStudent(id:number,f:string,v:string){
    setStudents(students.map(s=>{
      if(s.id!==id) return s;
      const next={...s,[f]:v};
      if(f==="academyWeeks"&&next.academyStart) next.academyEnd=calcAcademyEnd(next.academyStart,v);
      if(f==="academyStart"&&next.academyWeeks) next.academyEnd=calcAcademyEnd(v,next.academyWeeks);
      return next;
    }));
  }

  /* ── 인보이스 생성 ── */
  function gen(){
    if(!booker.name){alert("예약자명을 입력해주세요.");return;}
    // 견적이 계산됐는데 아직 "인보이스에 적용" 안 됐으면 자동 적용 — 스냅샷에 billing 포함 보장
    let snapOverride:Record<string,unknown>|undefined;
    if(est&&!applied){
      const billItems=[...est.items.map(i=>({label:i.label,price:i.price,season:i.season,accom:i.accom,roomType:i.roomType,weeks:i.weeks,parents:i.parents,kids:i.kids})),...est.extras.map(x=>({label:x.label,price:x.price,season:""}))];
      setBilling(b=>({...b,basePrice:est.total,items:billItems}));
      setApplied(true);
      snapOverride={billing:{...billing,basePrice:est.total,items:billItems},applied:true};
    }
    setPreview(true);setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),100);
    saveSnapshot(snapOverride); // 미리보기 시 현재 폼 데이터를 스냅샷으로 자동 저장 (billing 포함)
  }

  /* ── DB 저장 ── */
  async function saveToDb(){
    if(!bookingId){alert("예약 ID가 없습니다. 관리자 페이지에서 접근해주세요.");return;}
    const totalDiscount=billing.discounts.reduce((s,d)=>s+(Number(d.amount)||0),0);
    const totalAddition=billing.additions.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const {error}=await supabase.from("bookings").update({
      status:"인보이스발행",
      booker_name:booker.name,
      booker_english:booker.englishName,
      students:JSON.stringify(students),
      base_price:billing.basePrice,
      billing_items:billing.items,
      discounts:billing.discounts,
      additions:billing.additions,
      locals:billing.locals,
      total_discount:totalDiscount,
      final_price:billing.basePrice+totalAddition-totalDiscount,
      flight_in:checkin.flightIn,
      flight_out:checkin.flightOut,
      house_no:checkin.houseNo,
      accom_room:checkin.houseNo,
      checkin_date:overallCI||null,
      checkout_date:overallCO||null,
      pickup:checkin.pickup,
      drop_off:checkin.drop,
      pickup_place:checkin.pickupPlace,
      special_request:checkin.specialRequest,
      balance_date:booker.balanceDate||null,
      agency:adminOnly.agency,
      ssp:adminOnly.ssp,
      dh_weeks: a1W,
      jp_weeks: cm==="combo" ? a2W : null,
      accom_weeks: cm==="combo" ? a1W+a2W : a1W,
      updated_at:new Date().toISOString(),
    }).eq("id",bookingId);
    if(error){console.error(error);alert("저장 실패: "+error.message);return;}
    alert("저장 완료!");
  }

  /* ── 이미지 저장 ── */
  async function saveAsImage(elementId:string="invoice-content"){
    const el=document.getElementById(elementId);
    if(!el) return;
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:"#ffffff"});
    const link=document.createElement("a");
    link.download="인보이스_"+(booker.name||reservationNo||"draft")+".png";
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  /* ── 영수증 탭: 드림하우스 등록 — 자동(랜덤) 배정 제거, 직접 선택 or 미배정 등록 ── */
  const [dhModal,setDhModal]=useState<{avail:string[];current:string;ci:string;co:string}|null>(null);
  async function registerDreamhouse(){
    if(!bookingId){alert("예약 ID가 없습니다.");return;}
    const ci=overallCI?.trim()||null;
    const co=overallCO?.trim()||null;
    if(!ci||!co){alert("⚠️ 체크인/체크아웃 날짜가 필요합니다.");return;}
    const avail=await fetchDhAvailRooms(supabase as never,bookingId,ci,co);
    setDhModal({avail,current:(checkin.houseNo||"").trim(),ci,co});
  }
  async function finishDhRegister(room:string|null){
    if(!dhModal)return;
    const {ci,co}=dhModal;
    const upd:Record<string,unknown>={checkin_date:ci,checkout_date:co};
    if(receiptPaidTotal>0)upd.status="영수증발행"; // 금액 미입력 시 상태 유지
    if(room!==null){upd.accom_room=room;upd.house_no=room;}
    const {error}=await supabase.from("bookings").update(upd).eq("id",bookingId);
    if(error){alert("등록 실패: "+error.message);return;}
    setDhRegistered(true);
    if(room!==null)setCheckin(c=>({...c,houseNo:room}));
    setDhModal(null);
    alert(room?("✅ 드림하우스 예약 완료!\n배정 룸: "+room):"✅ 등록 완료 — 룸은 미배정 상태예요.\n직원업무 홈 '확인 필요'와 룸 캘린더에서 배정해주세요.");
  }

  /* ── 영수증 탭: 큐브나인 등록 — 풀억세스/디럭스오션 가용 룸 선택 배정 ── */
  const C9_FA=["103","104","105","106"];
  const C9_DX=["204","205","206","207","208","209","210"];
  const [c9Registered,setC9Registered]=useState(false);
  const [c9Room,setC9Room]=useState("");
  useEffect(()=>{(async()=>{
    if(!bookingId)return;
    if(!(a1T==="cubenine"||(cm==="combo"&&a2T==="cubenine")))return;
    const {data:st}=await supabase.from("app_settings").select("value").eq("key","cube9_room_blocks").maybeSingle();
    const arr=(Array.isArray(st?.value)?st!.value:[]) as {room:string;booking_id?:string}[];
    const mine=arr.find(x=>x.booking_id===bookingId);
    setC9Room(mine?.room||"");
  })();},[bookingId,a1T,a2T,cm]);
  const [c9Modal,setC9Modal]=useState<{availFA:string[];availDX:string[];assigned:string;ci:string;co:string;prefer:string;blocks:{id:string;room:string;name:string;ci:string;co:string;kind?:string;memo?:string;booking_id?:string}[]}|null>(null);
  async function registerCubenine(){
    if(!bookingId){alert("예약 ID가 없습니다.");return;}
    // 예약의 큐브 구간·룸타입 확인 (콤보면 cubenine seg 기준)
    const {data:bk}=await supabase.from("bookings").select("cn_room_type,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout,checkin_date,checkout_date,booker_name").eq("id",bookingId).single();
    if(!bk){alert("예약 정보를 불러오지 못했습니다.");return;}
    let ci=String(bk.checkin_date||"").slice(0,10), co=String(bk.checkout_date||"").slice(0,10);
    if(bk.seg1_type==="cubenine"){ci=String(bk.seg1_checkin||ci).slice(0,10);co=String(bk.seg1_checkout||co).slice(0,10);}
    else if(bk.seg2_type==="cubenine"){ci=String(bk.seg2_checkin||ci).slice(0,10);co=String(bk.seg2_checkout||co).slice(0,10);}
    if(!ci||!co){alert("⚠️ 체크인/체크아웃 날짜가 필요합니다.");return;}
    const {data:st}=await supabase.from("app_settings").select("value").eq("key","cube9_room_blocks").maybeSingle();
    const blocks:(typeof c9Modal extends null?never:never)|{id:string;room:string;name:string;ci:string;co:string;kind?:string;memo?:string;booking_id?:string}[]=Array.isArray(st?.value)?st!.value as never:[];
    const mine=blocks.find(x=>x.booking_id===bookingId);
    const occupied=(room:string)=>blocks.some(x=>x.room===room&&x.booking_id!==bookingId&&x.ci<co&&ci<x.co);
    const availFA=C9_FA.filter(r=>!occupied(r));
    const availDX=C9_DX.filter(r=>!occupied(r));
    const prefer=String(bk.cn_room_type||"").includes("풀")?"FA":"DX";
    setC9Modal({availFA,availDX,assigned:mine?.room||"",ci,co,prefer,blocks});
  }
  async function finishC9Register(room:string|null){
    if(!c9Modal||!bookingId)return;
    const {ci,co,blocks}=c9Modal;
    if(room!==null){
      const next=blocks.filter(x=>x.booking_id!==bookingId);
      next.push({id:Math.random().toString(36).slice(2,10)+Date.now().toString(36),room,name:booker.name||"드림 예약",ci,co,kind:"dream",memo:room&&C9_FA.includes(room)?"풀억세스":"디럭스오션",booking_id:bookingId});
      const {error:e1}=await supabase.from("app_settings").upsert({key:"cube9_room_blocks",value:next},{onConflict:"key"});
      if(e1){alert("룸 배정 저장 실패: "+e1.message);return;}
    }
    if(receiptPaidTotal>0){
      const {error}=await supabase.from("bookings").update({status:"영수증발행"}).eq("id",bookingId);
      if(error){alert("등록 실패: "+error.message);return;}
    }
    setC9Registered(true);if(room!==null)setC9Room(room);setC9Modal(null);
    alert(room?("✅ 큐브나인 예약 완료!\n배정 룸: "+room+"호 ("+(C9_FA.includes(room)?"풀억세스":"디럭스오션")+")"):"✅ 등록 완료 — 룸은 미배정 상태예요.\n큐브나인 예약현황의 '룸 배정 대기'에서 배정해주세요.");
  }

  /* ── 다온맘 공구 할인 자동 추가 (견적 탭과 동일 규칙) ── */
  function applyClosingInv(){
    const w=cm==="combo"?(a1W+a2W):a1W;
    const n=(cP||0)+(cK||0);
    if(!w||!n){alert("기간과 인원을 먼저 설정해주세요.");return;}
    const factor=Math.min(w,4)/4;
    const e=10*factor;const ep=(Number.isInteger(e)?e:e.toFixed(1))+"만";
    const wk=w<4?` · ${w}주 적용`:"";
    const line={id:Date.now(),name:`다온맘 마감임박 할인 (26년 8월 입실·현금) (1인 ${ep}×${n}명${wk})`,amount:Math.round(10*factor*n)*10000};
    setBilling(bl=>{
      const kept=bl.discounts.filter(d=>!String(d.name||"").startsWith("다온맘 마감임박")&&(d.name||d.amount));
      return {...bl,discounts:[...kept,line]};
    });
  }
  function applyDaonInv(cash:boolean){
    const w=cm==="combo"?(a1W+a2W):a1W;
    const n=(cP||0)+(cK||0);
    if(!w||!n){alert("기간과 인원을 먼저 설정해주세요.");return;}
    if(!a1CI){alert("체크인 날짜를 입력해주세요 (입실 시기·시즌 자동 판정).");return;}
    /* 얼리버드·시즌 = 체류 기준 (체류 중간점이 27.3~28.2면 얼리버드, 성수기 주가 과반이면 성수기 단가) */
    const _co=(cm==="combo"?a2CO:a1CO)||a1CI;
    const _midN=Math.floor((new Date(_co).getTime()-new Date(a1CI).getTime())/864e5/2);
    const mid=addDays(a1CI,Math.max(0,_midN));
    const is27=mid>="2027-03-01"&&mid<="2028-02-29";
    const _mx=seasonMixInv(a1CI,Math.max(1,w));
    const pk=_mx.peak>_mx.off;
    const factor=Math.min(w,4)/4;
    const _ep=(p:number)=>{const e=p*factor;return (Number.isInteger(e)?e:e.toFixed(1))+"만";};
    const _wk=w<4?` · ${w}주 적용`:"";
    const eb=is27?(pk?10:20):0;
    const isC9=a1T==="cubenine"||(cm==="combo"&&a2T==="cubenine");
    const lines:{name:string;amount:number}[]=[];
    if(eb>0)lines.push({name:`다온맘 얼리버드 할인 (1인 ${_ep(eb)}×${n}명${_wk})`,amount:Math.round(eb*factor*n)*10000});
    if(cash)lines.push({name:`다온맘 전액입금 할인 (1인 ${_ep(10)}×${n}명${_wk})`,amount:Math.round(10*factor*n)*10000});
    if(cash&&a1CI>="2026-08-01"&&a1CI<="2026-08-31")lines.push({name:`다온맘 마감임박 할인 (26년 8월 입실·현금) (1인 ${_ep(10)}×${n}명${_wk})`,amount:Math.round(10*factor*n)*10000});
    if(isC9)lines.push({name:`다온맘 큐브나인 추가 할인 (1인 ${_ep(10)}×${n}명${_wk})`,amount:Math.round(10*factor*n)*10000});
    setBilling(bl=>{
      const kept=bl.discounts.filter(d=>!String(d.name||"").startsWith("다온맘")&&(d.name||d.amount));
      const added=lines.map((l,i)=>({id:Date.now()+i,name:l.name,amount:l.amount}));
      return {...bl,discounts:[...kept,...added].length?[...kept,...added]:[{id:1,name:"",amount:0}]};
    });
    if(lines.length===0)alert("이 조건(2026 입실·카드)은 다온맘 이벤트 할인이 없어요.\n(1차 시즌가는 패키지 금액에 이미 반영)");
  }

  /* ── 영수증 탭: 지불내역만 저장 (confirmed_at 유지) + 상태→영수증발행 ── */
  async function saveReceiptPayments(){
    if(!bookingId){alert("예약 ID가 없습니다.");return;}
    setSavingReceipt(true);
    try{
      const res=await fetch("/api/invoice/snapshot",{
        method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({booking_id:bookingId,saved_data:collectFormState(),confirmed_at:"keep"}),
      });
      const j=await res.json().catch(()=>null);
      if(!res.ok){alert("저장 실패: "+(j?.error||res.status));setSavingReceipt(false);return;}
      setSnapshotSavedAt(j?.snapshot?.saved_at||new Date().toISOString());
      // 지불내역 저장 시 예약(bookings)의 결제상태·납부금액·총금액도 함께 동기화
      //  (스냅샷에만 저장되면 예약상세·엄마 포털이 계속 미납으로 보이는 버그 방지)
      const hasPayments=receiptPayments.some(p=>(p.amount||"").trim()!=="");
      if(hasPayments){
        const _tDisc=billing.discounts.reduce((s2,d)=>s2+(Number(d.amount)||0),0);
        const _tAdd=billing.additions.reduce((s2,a)=>s2+(Number(a.amount)||0),0);
        const _final=billing.basePrice+_tAdd-_tDisc;
        const _paid=receiptPayments.reduce((s2,p)=>{const n=Number(String(p.amount||"").replace(/[,\s원]/g,""));return s2+(isNaN(n)?0:n);},0);
        const _pStatus=_final>0&&_paid>=_final?"paid":_paid>0?"partial":"unpaid";
        const _upd:Record<string,unknown>={status:"영수증발행",payment_status:_pStatus,paid_amount:_paid,updated_at:new Date().toISOString()};
        if(_final>0)_upd.final_price=_final; // 음수/0 총액은 저장하지 않음 (엄마 포털 마이너스 표시 방지)
        const {error:stErr}=await supabase.from("bookings").update(_upd).eq("id",bookingId);
        if(stErr){console.error("[receipt status update]",stErr);alert("⚠️ 지불내역은 저장되었으나 예약 상태 변경 실패: "+stErr.message);setSavingReceipt(false);return;}
        alert("✅ 지불내역이 저장되었습니다.\n예약 상태: 영수증발행 · 결제: "+(_pStatus==="paid"?"완납":_pStatus==="partial"?"부분납":"미납")+" ("+_paid.toLocaleString()+"원 / "+_final.toLocaleString()+"원)");
      } else {
        alert("✅ 지불내역이 저장되었습니다.");
      }
    }catch{alert("저장 실패");}
    setSavingReceipt(false);
  }

  /* ── 영수증 발행 ── */
  function openReceipt(){
    const totalDiscount=billing.discounts.reduce((s,d)=>s+(Number(d.amount)||0),0);
    const totalAddition=billing.additions.reduce((s,a)=>s+(Number(a.amount)||0),0);
    const finalPrice=billing.basePrice+totalAddition-totalDiscount;
    const payload={
      name:booker.name,englishName:booker.englishName,reservationNo,reservationDate,
      balanceDate:booker.balanceDate,
      accom:billing.items.length>0?billing.items[0].label:"",
      checkInDate:a1CI,checkOutDate:cm==="combo"?addDays(a1CI,(a1W+a2W)*7):addDays(a1CI,a1W*7),
      people:`보호자 ${cP}명 + 아이 ${cK}명`,houseNo:checkin.houseNo,
      pickup:checkin.pickup,drop:checkin.drop,pickupPlace:checkin.pickupPlace,
      flightIn:checkin.flightIn,flightOut:checkin.flightOut,
      packageType:billing.items.map(i=>i.label).join(" + "),
      basePrice:billing.basePrice,totalDiscount,totalAddition,finalPrice,
      students:students.map(s=>({korName:s.korName,engName:s.engName,age:s.age,grade:s.grade,academyStart:s.academyStart,academyEnd:s.academyEnd,academyWeeks:s.academyWeeks,photo:s.photo})),
      note:checkin.specialRequest,agency:adminOnly.agency,ssp:adminOnly.ssp,
      billingItems:billing.items,
      discounts:billing.discounts.filter(d=>d.name),
      additions:billing.additions.filter(a=>a.name),
      locals:billing.locals.filter(l=>l.name&&l.amount),
    };
    sessionStorage.setItem("invoiceData",JSON.stringify(payload));
    window.open("/receipt"+(bookingId?"?id="+bookingId:""),"_blank");
  }

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#fafbff;color:#334155;line-height:1.6;}a{text-decoration:none;color:inherit;}
.fw{max-width:800px;margin:0 auto;padding:40px 24px 60px;}.fh{text-align:center;margin-bottom:32px;}.fh h1{font-size:28px;font-weight:800;margin-bottom:6px;color:#1e293b;}.fh p{font-size:14px;color:#64748b;}
.fs{background:#fff;border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;border:1px solid #e5e7eb;}.fs h2{font-size:16px;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;gap:8px;color:#000;}
.fs-admin{background:linear-gradient(135deg,#fef3c7 0%,#fef9c3 100%);border:1px solid #fde68a;border-radius:16px;padding:24px;box-shadow:0 2px 8px rgba(0,0,0,0.04);margin-bottom:20px;}.fs-admin h2{font-size:16px;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #fcd34d;display:flex;align-items:center;gap:8px;color:#92400e;}
.admin-note{font-size:12px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:8px;margin-bottom:16px;line-height:1.6;}
.f-row{display:flex;gap:12px;margin-bottom:12px;}.f-group{flex:1;}.f-label{display:block;font-size:11px;font-weight:600;color:#64748b;margin-bottom:4px;}
.f-input,.f-select,.f-textarea{width:100%;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;background:#fff;transition:border-color .15s,box-shadow .15s;}.f-input:focus,.f-select:focus,.f-textarea:focus{border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,0.12);}.f-textarea{resize:vertical;min-height:60px;}.f-input.auto{background:#f5f5f5;border-color:#e5e7eb;color:#2563eb;font-weight:600;}
.mt{display:flex;gap:4px;background:#f5f5f5;border-radius:10px;padding:4px;margin-bottom:16px;}.mb{flex:1;padding:10px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:7px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#64748b;transition:all 160ms;}.mb:hover{color:#1e293b;}.mb.ac{background:#1e293b;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);}
.ab{padding:16px;background:#f5f5f5;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;}.ab-l{font-size:12px;font-weight:700;color:#000;margin-bottom:10px;}.cp{text-align:center;padding:4px 0;font-size:22px;font-weight:800;color:#2563eb;}
.er{padding:20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:14px;margin-top:16px;}.erl{font-size:13px;color:#475569;margin-bottom:6px;line-height:1.7;}.erl strong{color:#1e293b;}.erl .dm{color:#94a3b8;font-size:12px;}
.ert{margin-top:12px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:800;}.ert .pr{color:#2563eb;font-size:26px;}
.sb{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:6px;}.sb.pk{background:#fce7f3;color:#be185d;border:1px solid #fbcfe8;}.sb.of{background:#dcfce7;color:#166534;border:1px solid #bbf7d0;}
.ba{width:100%;padding:12px;background:#1e293b;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:12px;transition:opacity 160ms;}.ba:hover{opacity:0.9;}
.ex-box{padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:12px;}.ex-title{font-size:11px;font-weight:700;color:#000;margin-bottom:8px;}.ex-row{display:flex;gap:12px;align-items:flex-end;}
.ne{padding:20px;text-align:center;color:#94a3b8;font-size:13px;background:#fafafa;border:1px dashed #e5e7eb;border-radius:12px;margin-top:16px;}
.dr{display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;}.dr .f-group{flex:2;}.dr .f-group:last-of-type{flex:1;}.bs{padding:7px 14px;font-size:12px;font-weight:700;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.bd{background:#dbeafe;color:#1e40af;border:1px solid #bfdbfe;}.bd:hover{background:#bfdbfe;}.br{background:#fce7f3;color:#9f1239;border:1px solid #fbcfe8;padding:7px 10px;}.br:hover{background:#fbcfe8;}
.bg{width:100%;padding:14px;background:#1e293b;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:8px;transition:opacity 160ms;}.bg:hover{opacity:0.92;}.bl{display:block;text-align:center;margin-top:16px;font-size:13px;color:#64748b;}.bl:hover{color:#2563eb;}
.sc{position:relative;padding:20px;background:#fff;border:1px solid #e5e7eb;border-radius:14px;margin-bottom:12px;box-shadow:0 1px 4px rgba(0,0,0,0.04);}.sc-del{position:absolute;top:10px;right:10px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:8px;cursor:pointer;font-size:14px;font-weight:700;}.sc-del:hover{background:#fecaca;}.sc-num{font-size:12px;font-weight:700;color:#000;margin-bottom:12px;}
.f-hint{font-size:10px;color:#94a3b8;margin-top:2px;}
.iw{max-width:860px;margin:0 auto;padding:40px 24px 60px;}.iv{background:#fff;padding:48px 40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);border-radius:20px;overflow:hidden;}
.it{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding:24px 28px;margin:-48px -40px 32px;background:#fff;border-bottom:1px solid #e5e7eb;border-radius:20px 20px 0 0;}.il{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#1e293b;}.ils{font-size:11px;color:#64748b;font-weight:500;letter-spacing:0.05em;}.itr{text-align:right;}.itr h1{font-family:'Montserrat',sans-serif;font-size:30px;font-weight:900;letter-spacing:0.08em;color:#1e293b;}.itr p{font-size:11px;color:#64748b;margin-top:2px;}
.is{margin-bottom:28px;}.ist{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:#000;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e5e7eb;}
.tb{width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden;}.tb th{font-size:11px;font-weight:700;color:#475569;padding:10px 12px;text-align:left;background:#f5f5f5;border:1px solid #e5e7eb;}.tb td{font-size:13px;padding:11px 12px;border:1px solid #e5e7eb;color:#334155;line-height:1.6;}.tb tbody tr:nth-child(even) td{background:#fafafa;}.tb .lb{font-weight:600;background:#f5f5f5;width:28%;color:#475569;font-size:12px;}.tb .dc{color:#dc2626;font-weight:700;}.tb .tr td{font-weight:800;font-size:15px;background:#f5f5f5;color:#1e293b;}.tb .fr td{font-weight:900;font-size:20px;background:#5b4fff!important;color:#fff!important;padding:14px 12px;border-top:1px solid #5b4fff;box-shadow:inset 0 0 0 1000px #5b4fff!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
.ift{margin-top:32px;padding:20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;font-size:12px;color:#475569;line-height:1.8;word-break:keep-all;}
.pb{display:flex;gap:10px;justify-content:center;margin-top:24px;flex-wrap:wrap;}.pp{padding:12px 32px;background:#1e293b;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pp:hover{opacity:0.92;}.prc{padding:12px 32px;background:#16a34a;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.prc:hover{opacity:0.92;}.psv{padding:12px 32px;background:#dbeafe;color:#1e40af;font-size:14px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.psv:hover{background:#bfdbfe;}.pci{padding:8px 20px;background:#fff;color:#64748b;font-size:12px;font-weight:600;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:8px;}.pci:hover{background:#f5f5f5;color:#1e293b;}.pbk{padding:12px 32px;background:#f5f5f5;color:#475569;font-size:14px;font-weight:600;border:1px solid #e5e7eb;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pbk:hover{background:#e5e7eb;}
@media print{body{background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact;}.no-print{display:none!important;}.iw{padding:0!important;}.iv{box-shadow:none!important;padding:24px!important;border-radius:0!important;}.it{border-radius:0!important;margin:-24px -24px 24px!important;}.tb .fr td,.mb.ac,.ba,.bg,.pp,.prc{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
@media(max-width:600px){.fw{padding:20px 12px 40px;}.f-row{flex-direction:column;gap:8px;}.it{flex-direction:column;gap:12px;}.iv{padding:24px 12px;}.dr{flex-direction:column;gap:8px;}.ex-row{flex-direction:column;gap:8px;align-items:stretch;}.ex-row .f-group{flex:1!important;}.pb{flex-direction:column;gap:8px;align-items:stretch;}.pb button{width:100%;}.iw{padding:20px 8px 40px;}.is table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;}.ba,.bg,.bs,.pp,.psv,.prc,.pbk,.pci,button{min-height:44px;}.fs,.fs-admin{padding:16px 12px;}}
  `}</style>

  {/* ── STEP 25: 리조트용 예약확인서 (영어) ── */}
  {invoiceType==="resort"?(
    <div className="iw">
      <div className="no-print" style={{marginBottom:12}}>
        <button style={{background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0",padding:"8px 16px",fontSize:13,fontWeight:600,borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>router.push("/admin/bookings?tab=list")}>← Back to Bookings</button>
      </div>
      <div className="iv" id="resort-confirmation">
        <div className="it">
          <div><img src="/dream-academy-logo.png" alt="Dream Academy" style={{height:60,width:"auto"}} /></div>
          <div className="itr"><h1 style={{fontSize:22,letterSpacing:"0.05em"}}>RESERVATION<br/>CONFIRMATION</h1><p>Date: {new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})}</p></div>
        </div>

        <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Guest Information</div>
          <table className="tb"><tbody>
            <tr><td className="lb">Guest Name</td><td>{booker.name}</td><td className="lb">English Name</td><td>{booker.englishName||"-"}</td></tr>
            <tr><td className="lb">Reservation No.</td><td>{reservationNo}</td><td className="lb">Reservation Date</td><td>{reservationDate}</td></tr>
          </tbody></table>
        </div>

        <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Stay Details</div>
          <table className="tb"><tbody>
            <tr><td className="lb">{isCommute?"Class Start":"Check-in"}</td><td>{overallCI||"-"}</td><td className="lb">{isCommute?"Class End":"Check-out"}</td><td>{overallCO||"-"}</td></tr>
            {cm==="combo"&&a1CI&&a1CO&&<tr><td className="lb">{_accomEn(a1T)} Check-in</td><td style={{fontWeight:700}}>{a1CI}</td><td className="lb">{_accomEn(a1T)} Check-out</td><td style={{fontWeight:700}}>{a1CO}</td></tr>}
            {cm==="combo"&&a2CI&&a2CO&&<tr><td className="lb">{_accomEn(a2T)} Check-in</td><td style={{fontWeight:700}}>{a2CI}</td><td className="lb">{_accomEn(a2T)} Check-out</td><td style={{fontWeight:700}}>{overallCO||a2CO}</td></tr>}
            <tr><td className="lb">Accommodation</td><td>{isCommute?"통학형 (Day-school only)":(cm==="combo"?al(a1T,a1R)+" + "+al(a2T,a2R):al(a1T,a1R))}</td><td className="lb">Room No.</td><td>{isCommute?"-":(checkin.houseNo||"TBA")}</td></tr>
            <tr><td className="lb">Adults</td><td>{cP}</td><td className="lb">Children</td><td>{cK}</td></tr>
          </tbody></table>
        </div>

        <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Student Details</div>
          <table className="tb"><thead><tr><th>No.</th><th>Name</th><th>Age</th><th>Course</th><th>Start</th><th>End</th></tr></thead><tbody>
            {students.map((s,i)=>(
              <tr key={s.id}><td>{i+1}</td><td>{s.engName||s.korName||"-"}</td><td>{s.age||"-"}</td><td>{s.grade==="킨더"?"Kinder":"Junior"}</td><td>{s.academyStart||"-"}</td><td>{s.academyEnd||calcAcademyEnd(s.academyStart,s.academyWeeks)||"-"}</td></tr>
            ))}
          </tbody></table>
        </div>

        {!isCommute&&<div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Transportation</div>
          <table className="tb"><tbody>
            <tr><td className="lb">Pickup</td><td>{checkin.pickup==="O"?"Yes":"No"}</td><td className="lb">Drop-off</td><td>{checkin.drop==="O"?"Yes":"No"}</td></tr>
            <tr><td className="lb">Flight In</td><td>{checkin.flightIn||"TBA"}</td><td className="lb">Flight Out</td><td>{checkin.flightOut||"TBA"}</td></tr>
            <tr><td className="lb">Pickup Location</td><td>{checkin.pickupPlace||"TBA"}</td><td className="lb">Room Assignment</td><td>{checkin.houseNo||"TBA"}</td></tr>
          </tbody></table>
        </div>}

        {checkin.specialRequest&&(
          <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Special Requests</div>
            <div style={{padding:12,background:"#f8fafc",borderRadius:8,fontSize:13,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{checkin.specialRequest}</div>
          </div>
        )}

        <div style={{marginTop:32,padding:20,background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12,color:"#6b7c93",lineHeight:1.8}}>
          This reservation confirmation is issued by Dream Company Philippines.<br/>
          For any inquiries, please contact us at dreamacademyph@gmail.com
        </div>
      </div>
      <div className="pb no-print">
        <button className="pbk" onClick={()=>router.push("/admin/bookings?tab=list")}>← Back</button>
        <button className="pp" onClick={()=>window.print()}>Print / PDF</button>
        <button style={{padding:"12px 24px",background:"#ea580c",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}
          onClick={()=>{const subject=encodeURIComponent("Reservation Confirmation - "+booker.name+" ("+reservationNo+")");const ciLbl=isCommute?"Class Start":"Check-in";const coLbl=isCommute?"Class End":"Check-out";const body=encodeURIComponent("Dear Resort Team,\n\nPlease find the reservation confirmation for:\n\nGuest: "+(booker.englishName||booker.name)+"\nReservation No: "+reservationNo+"\n"+ciLbl+": "+(overallCI||"TBA")+"\n"+coLbl+": "+(overallCO||"TBA")+"\n\nPlease confirm the booking.\n\nBest regards,\nDream Company Philippines");window.open("mailto:?subject="+subject+"&body="+body);}}>
          Email to Resort
        </button>
      </div>
    </div>
  ):invoiceType==="guest"?(
    <div className="iw">
      <div className="no-print" style={{marginBottom:12}}>
        <button style={{background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0",padding:"8px 16px",fontSize:13,fontWeight:600,borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>router.push("/admin/bookings?tab=list")}>← Back to Bookings</button>
      </div>
      <div className="iv" id="guest-invoice">
        <div className="it">
          <div><img src="/dream-academy-logo.png" alt="Dream Academy" style={{height:60,width:"auto"}} /></div>
          <div className="itr"><h1>INVOICE</h1><p>No. {reservationNo}</p></div>
        </div>

        <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Customer Information</div>
          <table className="tb"><tbody>
            <tr><td className="lb">Guest Name</td><td>{booker.name}</td><td className="lb">English Name</td><td>{booker.englishName||"-"}</td></tr>
            <tr><td className="lb">Reservation No.</td><td>{reservationNo}</td><td className="lb">Date</td><td>{reservationDate}</td></tr>
            <tr><td className="lb">{isCommute?"Class Start":"Check-in"}</td><td>{overallCI?(isCommute?overallCI:`${overallCI} 15:00PM`):"-"}</td><td className="lb">{isCommute?"Class End":"Check-out"}</td><td>{overallCO?(isCommute?overallCO:`${overallCO} ${coTimeText}`):"-"}</td></tr>
            {cm==="combo"&&a1CI&&a1CO&&<tr><td className="lb">{_accomEn(a1T)} Check-in</td><td style={{fontWeight:700}}>{a1CI}</td><td className="lb">{_accomEn(a1T)} Check-out</td><td style={{fontWeight:700}}>{a1CO}</td></tr>}
            {cm==="combo"&&a2CI&&a2CO&&<tr><td className="lb">{_accomEn(a2T)} Check-in</td><td style={{fontWeight:700}}>{a2CI}</td><td className="lb">{_accomEn(a2T)} Check-out</td><td style={{fontWeight:700}}>{overallCO||a2CO}</td></tr>}
            <tr><td className="lb">Accommodation</td><td>{isCommute?"통학형 (Day-school only)":(cm==="combo"?al(a1T,a1R)+" + "+al(a2T,a2R):al(a1T,a1R))}</td><td className="lb">Room No.</td><td>{isCommute?"-":(checkin.houseNo||"TBA")}</td></tr>
          </tbody></table>
        </div>

        {!(dhOnly&&!acadOpt)&&(
        <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Student Information</div>
          <table className="tb"><thead><tr><th>No.</th><th>Name</th><th>Age</th><th>Course</th><th>Start</th><th>End</th></tr></thead><tbody>
            {students.map((s,i)=>{
              const name=s.engName||s.name_en||s.korName||s.name_kr||"-";
              const age=s.age||s.birth_date||"-";
              const courseRaw=s.grade||s.level||"";
              const course=courseRaw==="킨더"?"Kinder":courseRaw==="주니어"?"Junior":(courseRaw||"-");
              const endDisplay=s.academyEnd||calcAcademyEnd(s.academyStart,s.academyWeeks)||"-";
              return <tr key={s.id}><td>{i+1}</td><td>{name}</td><td>{age}</td><td>{course}</td><td>{s.academyStart||"-"}</td><td>{endDisplay}</td></tr>;
            })}
          </tbody></table>
        </div>
        )}

        {!isCommute&&<><div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Billing Details</div>
          {billing.items.length>0&&(
            <table className="tb"><tbody>
              {billing.items.map((item,i)=>(
                <tr key={i}><td>{item.label}{item.season?` (${item.season})`:""}</td><td style={{textAlign:"right"}}>{fmt(item.price)}원</td></tr>
              ))}
              {billing.discounts.filter(d=>d.name).map((d,i)=>(
                <tr key={`d${i}`}><td className="dc">↓ {d.name}</td><td className="dc" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>
              ))}
              {td>0&&(
                <tr className="tr"><td>Total Discount</td><td style={{textAlign:"right",color:"#dc2626"}}>-{fmt(td)}원</td></tr>
              )}
              {billing.additions.filter(a=>a.name).map((a,i)=>(
                <tr key={`a${i}`}><td style={{color:"#16a34a",fontWeight:700}}>↑ {a.name}</td><td style={{textAlign:"right",color:"#16a34a",fontWeight:700}}>+{fmt(Number(a.amount))}원</td></tr>
              ))}
              {ta>0&&(
                <tr className="tr"><td>Total Additions</td><td style={{textAlign:"right",color:"#16a34a"}}>+{fmt(ta)}원</td></tr>
              )}
            </tbody></table>
          )}
          <div style={{marginTop:14,background:"#5b4fff",color:"white",padding:"16px 24px",fontSize:"22px",fontWeight:700,display:"flex",justifyContent:"space-between",alignItems:"center",borderRadius:10}}>
            <span style={{color:"white"}}>Total Amount Due</span>
            <span style={{color:"white"}}>{fmt(fp)}원</span>
          </div>
        </div>

        {fp>0&&(
          <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Payment Schedule</div>
            {effectiveFullPayment?(
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:8}}>
                <span style={{fontWeight:700,color:"#dc2626"}}>Full Payment (Booking Confirmation)</span>
                <span style={{fontWeight:700,color:"#dc2626"}}>{fmt(fp)}원</span>
              </div>
            ):(<>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,marginBottom:8}}>
                <span style={{fontWeight:700,color:"#166534"}}>Deposit (Booking Confirmation)</span>
                <span style={{fontWeight:700,color:"#2563eb"}}>{fmt(depositAmt)}원</span>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px"}}>
                <span style={{color:"#374151"}}>Balance <span style={{fontSize:11,color:"#6b7280"}}>(Due Date: {booker.balanceDate||"2 months before check-in"})</span></span>
                <span style={{fontWeight:600,color:"#2563eb"}}>{fmt(Math.max(0,fp-depositAmt))}원</span>
              </div>
            </>)}
          </div>
        )}

        {billing.locals.filter(c=>c.name||c.amount).length>0&&(
          <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Local Payment <span style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginLeft:6,letterSpacing:0,textTransform:"none"}}>Unit: PHP</span></div>
            <table className="tb"><tbody>
              {billing.locals.filter(c=>c.name||c.amount).map((c,i)=>{
                const raw=String(c.amount);
                const cleaned=raw.replace(/페소|pesos?/gi,"PHP").trim();
                const display=/PHP/i.test(cleaned)?cleaned:`${cleaned} PHP`;
                return <tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{display}</td></tr>;
              })}
            </tbody></table>
          </div>
        )}

        <div style={{fontSize:12,color:"#475569",padding:"16px 20px",background:"#f8fafc",border:"1px solid #e5e7eb",borderRadius:12,marginTop:16}}>
          Please confirm the total amount and refund policy before finalizing your reservation.
        </div></>}

        {isCommute&&(
          <div style={{marginTop:32,padding:"24px 28px",background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:12}}>
            <div style={{fontSize:13,fontWeight:700,color:"#1e293b",marginBottom:12}}>ENROLLMENT CONFIRMATION</div>
            <div style={{fontSize:12,color:"#475569",lineHeight:1.8}}>
              This document confirms that the above-listed student(s) are enrolled in the<br/>
              <b>Dream Academy English Program</b> for the period indicated.<br/><br/>
              <b>School:</b> Dream Academy Philippines<br/>
              <b>Address:</b> Marigondon, Lapu-Lapu City, Philippines<br/>
              <b>Contact:</b> dreamacademyph@gmail.com
            </div>
            <div style={{marginTop:16,paddingTop:12,borderTop:"1px solid #e2e8f0",fontSize:11,color:"#94a3b8",lineHeight:1.6}}>
              Issued by Dream Company Philippines. This document is for enrollment verification purposes only.
            </div>
          </div>
        )}
      </div>
      <div className="pb no-print">
        <button className="pbk" onClick={()=>router.push("/admin/bookings?tab=list")}>← Back to Bookings</button>
        <button style={{padding:"12px 32px",background:"#2563eb",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>saveAsImage("guest-invoice")}>📷 이미지 저장</button>
        <button className="pp" onClick={()=>window.print()}>Print / PDF</button>
      </div>
    </div>
  ):(<>

  {/* ── 서브탭: 인보이스 / 영수증 ── */}
  <div className="iw no-print" style={{paddingTop:24,paddingBottom:0}}>
    <div className="mt" style={{maxWidth:480,margin:"0 auto 8px"}}>
      <button className={`mb${tab==="invoice"?" ac":""}`} onClick={()=>setTab("invoice")}>📄 인보이스</button>
      <button className={`mb${tab==="receipt"?" ac":""}`} onClick={()=>setTab("receipt")}>🧾 영수증</button>
    </div>
  </div>

  {tab==="invoice"?(<>
  {!preview?(<div className="fw"><div style={{marginBottom:"12px"}}><button style={{background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0",padding:"8px 16px",fontSize:"13px",fontWeight:600,borderRadius:"8px",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>router.push("/admin/bookings?tab=list")}>← 예약내역으로</button></div><div className="fh"><h1>인보이스 생성</h1><p>숙소를 선택하면 시즌 요금이 자동 계산됩니다.</p></div>

  {/* ── 섹션1: 패키지 견적 (기존 UI 100% 유지) ── */}
  <div className="fs"><h2>{isCommute?"🚶 통학형 학원비":"패키지 견적 계산"}</h2>
    {isCommute?(
      <div style={{padding:"14px 16px",background:"#eef2ff",border:"1px solid #c7d2fe",borderRadius:10,fontSize:13,color:"#3730a3",lineHeight:1.7}}>
        통학형은 숙소·룸 없이 <b>학원만</b> 등록됩니다. 학원비는 아래 <b>학생 정보</b>의 학생별 기간(주차)으로 자동 계산되며(학생 수 × 단가), 합계는 아래 <b>결제 정보</b>에 표시됩니다. 숙소 선택은 필요 없습니다.
      </div>
    ):(<>
    <div className="mt"><button className={`mb${cm==="single"?" ac":""}`} onClick={()=>setCm("single")}>숙소 1개</button><button className={`mb${cm==="combo"?" ac":""}`} onClick={()=>setCm("combo")}>숙소 2개 조합</button></div>

    {cm==="single"?(<>
      {rSel(a1T,setA1T,a1R,setA1R,a1W,setA1W,a1CI,setA1CI,a1CO,"숙소 선택")}
      <div className="f-row"><div className="f-group"><label className="f-label">보호자</label><select className="f-select" value={cP} onChange={e=>{const p=Number(e.target.value);setCP(p);setCK(Math.min(cK,Math.max(1,mp(a1T)-p)));}}>{[1,2,3].filter(p=>p<mp(a1T)).map(p=><option key={p} value={p}>{p}명</option>)}</select></div><div className="f-group"><label className="f-label">아이</label><select className="f-select" value={cK} onChange={e=>setCK(Number(e.target.value))}>{Array.from({length:Math.max(1,mp(a1T)-cP)},(_,i)=>i+1).map(k=><option key={k} value={k}>{k}명</option>)}</select></div></div>
      <div className="ex-box"><div className="ex-title">추가 인원 (1주일 고정 · {fmt(extraRate(a1T))}원/인)</div><div className="ex-row"><div className="f-group" style={{flex:"0 0 140px"}}><label className="f-label">추가 인원</label><select className="f-select" value={ex1Cnt} onChange={e=>setEx1Cnt(Number(e.target.value))}><option value={0}>0명</option><option value={1}>1명</option><option value={2}>2명</option></select></div>{ex1Cnt>0&&<div style={{fontSize:"13px",fontWeight:700,color:"#1a6fc4",paddingBottom:"2px"}}>+{fmt(extraRate(a1T)*ex1Cnt)}원</div>}</div></div>
    </>):(<>
      <div className="f-row" style={{marginBottom:"16px"}}><div className="f-group"><label className="f-label">보호자 (공통)</label><select className="f-select" value={cP} onChange={e=>{const p=Number(e.target.value);setCP(p);setCK(Math.min(cK,Math.max(1,Math.min(mp(a1T),mp(a2T))-p)));}}>{[1,2,3].filter(p=>p<Math.min(mp(a1T),mp(a2T))).map(p=><option key={p} value={p}>{p}명</option>)}</select></div><div className="f-group"><label className="f-label">아이 (공통)</label><select className="f-select" value={cK} onChange={e=>setCK(Number(e.target.value))}>{Array.from({length:Math.max(1,Math.min(mp(a1T),mp(a2T))-cP)},(_,i)=>i+1).map(k=><option key={k} value={k}>{k}명</option>)}</select></div></div>
      {rSel(a1T,setA1T,a1R,setA1R,a1W,setA1W,a1CI,setA1CI,a1CO,"숙소 A")}
      <div className="ex-box"><div className="ex-title">숙소 A 추가 인원 (1주일 고정 · {fmt(extraRate(a1T))}원/인)</div><div className="ex-row"><div className="f-group" style={{flex:"0 0 140px"}}><label className="f-label">추가 인원</label><select className="f-select" value={ex1Cnt} onChange={e=>setEx1Cnt(Number(e.target.value))}><option value={0}>0명</option><option value={1}>1명</option><option value={2}>2명</option></select></div>{ex1Cnt>0&&<div style={{fontSize:"13px",fontWeight:700,color:"#1a6fc4",paddingBottom:"2px"}}>+{fmt(extraRate(a1T)*ex1Cnt)}원</div>}</div></div>
      <div className="cp">+</div>
      <div style={{position:"relative"}}>
        <button type="button" onClick={()=>{if(!confirm("숙소 B를 삭제하고 숙소 1개 모드로 전환할까요?"))return;setCm("single");setA2W(2);setA2R("디럭스");setEx2Cnt(0);}} style={{position:"absolute",top:14,right:14,zIndex:2,background:"#fee2e2",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:8,padding:"6px 12px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>🗑 숙소 B 삭제</button>
        {rSel(a2T,setA2T,a2R,setA2R,a2W,setA2W,a2CI,null,a2CO,"숙소 B")}
      </div>
      <div className="ex-box"><div className="ex-title">숙소 B 추가 인원 (1주일 고정 · {fmt(extraRate(a2T))}원/인)</div><div className="ex-row"><div className="f-group" style={{flex:"0 0 140px"}}><label className="f-label">추가 인원</label><select className="f-select" value={ex2Cnt} onChange={e=>setEx2Cnt(Number(e.target.value))}><option value={0}>0명</option><option value={1}>1명</option><option value={2}>2명</option></select></div>{ex2Cnt>0&&<div style={{fontSize:"13px",fontWeight:700,color:"#1a6fc4",paddingBottom:"2px"}}>+{fmt(extraRate(a2T)*ex2Cnt)}원</div>}</div></div>
      {cm==="combo"&&(a1W===0||a2W===0)&&(
        <div style={{marginTop:12,padding:12,background:"#fef2f2",border:"1px solid #fca5a5",borderLeft:"4px solid #ef4444",borderRadius:8,color:"#991b1b",fontSize:13,fontWeight:600}}>
          ⚠️ 콤보 모드에서 한쪽 숙소가 0주입니다. 두 숙소의 주수를 모두 입력해야 정확한 인보이스가 발행됩니다. (현재: 숙소 A {a1W}주 + 숙소 B {a2W}주)
        </div>
      )}
    </>)}
    </>)}
  </div>

  {/* ── 섹션2: 예약자 정보 ── */}
  <div className="fs"><h2>예약자 정보</h2>
    <div className="f-row"><div className="f-group"><label className="f-label">예약번호</label><input className="f-input auto" value={reservationNo} readOnly/></div><div className="f-group"><label className="f-label">예약일</label><input className="f-input" type="date" value={reservationDate} onChange={e=>setReservationDate(e.target.value)}/></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">예약자 한글이름</label><input className="f-input" placeholder="홍길동" value={booker.name} onChange={e=>setBooker({...booker,name:e.target.value})}/></div><div className="f-group"><label className="f-label">예약자 영문이름</label><input className="f-input" placeholder="HONG GILDONG" value={booker.englishName} onChange={e=>setBooker({...booker,englishName:e.target.value})}/></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">잔금 납부 예정일</label><input className="f-input" type="date" value={booker.balanceDate} onChange={e=>setBooker({...booker,balanceDate:e.target.value})}/></div><div className="f-group"><label className="f-label">체크아웃 (수정 가능)</label><div style={{display:"flex",gap:6,alignItems:"center"}}><input className="f-input" type="date" value={overallCO} onChange={e=>setDbCheckout(e.target.value)} style={{flex:1}}/><button type="button" onClick={()=>setDbCheckout("")} style={{padding:"8px 12px",fontSize:12,fontWeight:700,background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1",borderRadius:8,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",whiteSpace:"nowrap"}}>자동</button></div><label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"#475569",marginTop:6,cursor:"pointer"}}><input type="checkbox" checked={lateCheckout} onChange={e=>syncLateCheckout(e.target.checked)}/>Late Check-out (22:30pm)</label></div></div>
  </div>

  {/* ── 섹션3: 학생 정보 — 드하 단독(숙소만·아카데미 미등록)은 숨김 ── */}
  {!(dhOnly&&!acadOpt)&&(
  <div className="fs"><h2>학생 정보</h2>
    {students.map((s,idx)=>(
      <div className="sc" key={s.id}>
        {students.length>1&&<button className="sc-del" onClick={()=>rmStudent(s.id)}>X</button>}
        <div className="sc-num">학생 {idx+1}</div>
        <div className="f-row"><div className="f-group"><label className="f-label">한글이름</label><input className="f-input" placeholder="홍민준" value={s.korName} onChange={e=>upStudent(s.id,"korName",e.target.value)} onBlur={async()=>{if(s.korName.trim()&&!s.engName.trim()){const eng=await autofillEngName(s.korName);if(eng)upStudent(s.id,"engName",eng.toUpperCase());}}}/></div><div className="f-group"><label className="f-label">영문이름</label><input className="f-input" placeholder="HONG MINJUN" value={s.engName} onChange={e=>upStudent(s.id,"engName",e.target.value.toUpperCase())}/></div></div>
        <div className="f-row"><div className="f-group"><label className="f-label">나이</label><input className="f-input" type="number" value={s.age} onChange={e=>upStudent(s.id,"age",e.target.value)}/></div><div className="f-group"><label className="f-label">킨더/주니어</label><select className="f-select" value={s.grade} onChange={e=>upStudent(s.id,"grade",e.target.value)}><option value="킨더">킨더</option><option value="주니어">주니어</option></select></div></div>
        <div className="f-row"><div className="f-group"><label className="f-label">아카데미 시작일</label><input className="f-input" type="date" value={s.academyStart} onChange={e=>upStudent(s.id,"academyStart",e.target.value)}/></div><div className="f-group"><label className="f-label">기간</label><select className="f-select" value={s.academyWeeks} onChange={e=>upStudent(s.id,"academyWeeks",e.target.value)}>{Array.from({length:11},(_,i)=>i+2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div><div className="f-group"><label className="f-label">아카데미 종료일 <span style={{fontWeight:400,fontSize:11,color:"#94a3b8"}}>(직접 수정 가능)</span></label><input className="f-input" type="date" value={s.academyEnd} onChange={e=>upStudent(s.id,"academyEnd",e.target.value)}/></div></div>
        <div className="f-row"><div className="f-group"><label className="f-label">사진촬영 허용</label><select className="f-select" value={s.photo} onChange={e=>upStudent(s.id,"photo",e.target.value)}><option value="O">O</option><option value="X">X</option></select><div className="f-hint">{s.photo === "X" ? "사진제공 없음" : "인스타그램 등 SNS 활용 / 미허용 시 별도 사진 제공 없음"}</div></div></div>
      </div>
    ))}
    {students.length<6&&<button className="bs bd" onClick={addStudent}>+ 학생 추가</button>}
  </div>
  )}

  {/* ── 섹션4: 결제 정보 ── */}
  <div className="fs"><h2>결제 정보</h2>
    {est?(<div className="er">
      {est.items.map((item,i)=>(<div className="erl" key={i}>
        <strong>{item.label}</strong>{item.ci&&<> / {fmtDate(item.ci)} ~ {fmtDate(item.co)}</>} <span className={`sb ${item.season==="성수기"?"pk":"of"}`}>{item.season}</span>
        {cm==="combo"&&<><br/><span className="dm">합산 {item.totalW}주 요금({fmt(item.fullPrice)}) × {Math.round(item.ratio*100)}% = </span><strong>{fmt(item.price)}원</strong></>}
        {cm==="single"&&<><br/><strong>{fmt(item.price)}원</strong></>}
      </div>))}
      {est.extras.length>0&&est.extras.map((x,i)=><div className="erl" key={`ex${i}`}><strong>{x.label}</strong>: <strong style={{color:"#d97706"}}>{fmt(x.price)}원</strong></div>)}
      {cm==="combo"&&<div className="erl"><span className="dm">보호자 {cP}명 + 아이 {cK}명</span></div>}
      <div className="ert"><span>총 합계</span><span className="pr">{fmt(est.total)}원</span></div>
      <button className="ba" onClick={applyInv}>인보이스에 적용</button>
    </div>):(<div className="ne">선택하신 조건의 가격 정보가 없습니다.</div>)}
    {billing.items.length>0&&(<div style={{marginBottom:"14px"}}>{billing.items.map((item,i)=><div key={i} style={{fontSize:"13px",color:"#374151",marginBottom:"4px"}}>{item.label} ({item.season}): <strong style={{color:"#1a6fc4"}}>{fmt(item.price)}원</strong></div>)}<div style={{fontSize:"14px",fontWeight:800,marginTop:"8px"}}>합계: {fmt(billing.basePrice)}원</div></div>)}
    {/* 패키지 금액 수동 입력 — applied/items 여부와 무관하게 항상 표시 (수정 모드에서 금액 편집 가능) */}
    <div className="f-row"><div className="f-group"><label className="f-label">패키지 금액 (원)</label><input className="f-input" type="number" value={billing.basePrice||""} onChange={e=>setBilling(b=>({...b,basePrice:Number(e.target.value),items:[]}))}/></div></div>
    <label className="f-label" style={{marginTop:"12px",marginBottom:"8px"}}>할인 항목
      <button type="button" onClick={()=>applyDaonInv(true)} style={{marginLeft:10,padding:"4px 10px",fontSize:11.5,background:"#fef9c3",border:"1px solid #eab308",color:"#854d0e",borderRadius:6,cursor:"pointer",fontWeight:800}}>💛 다온맘 현금</button>
      <button type="button" onClick={()=>applyDaonInv(false)} style={{marginLeft:4,padding:"4px 10px",fontSize:11.5,background:"#fefce8",border:"1px solid #eab308",color:"#854d0e",borderRadius:6,cursor:"pointer",fontWeight:800}}>💛 다온맘 카드</button>
      <button type="button" onClick={applyClosingInv} style={{marginLeft:4,padding:"4px 10px",fontSize:11.5,background:"#fee2e2",border:"1px solid #f87171",color:"#991b1b",borderRadius:6,cursor:"pointer",fontWeight:800}}>⏰ 마감임박</button>
    </label>
    {billing.discounts.map(d=><div className="dr" key={d.id}><div className="f-group"><input className="f-input" placeholder="할인 이름" value={d.name} onChange={e=>upD(d.id,"name",e.target.value)}/></div><div className="f-group"><input className="f-input" type="number" placeholder="금액" value={d.amount||""} onChange={e=>upD(d.id,"amount",Number(e.target.value))}/></div><button className="bs br" onClick={()=>rmD(d.id)}>삭제</button></div>)}
    <button className="bs bd" onClick={addD}>+ 할인 추가</button>
    <label className="f-label" style={{marginTop:"16px",marginBottom:"8px"}}>추가 금액 항목</label>
    {billing.additions.map(a=><div className="dr" key={a.id}><div className="f-group"><input className="f-input" placeholder="추가 항목 이름" value={a.name} onChange={e=>upA(a.id,"name",e.target.value)}/></div><div className="f-group"><input className="f-input" type="number" placeholder="금액" value={a.amount||""} onChange={e=>upA(a.id,"amount",Number(e.target.value))}/></div><button className="bs" style={{background:"#dcfce7",color:"#166534",border:"1px solid #bbf7d0",padding:"7px 10px"}} onClick={()=>rmA(a.id)}>삭제</button></div>)}
    <button className="bs" style={{background:"#dcfce7",color:"#166534",border:"1px solid #bbf7d0"}} onClick={addA}>+ 추가 항목 추가</button>
    <label className="f-label" style={{marginTop:"16px",marginBottom:"8px"}}>현지 지불 항목 <span style={{fontSize:"10px",color:"#94a3b8",fontWeight:400}}>단위: 페소(PHP)</span></label>
    {billing.locals.map(c=><div className="dr" key={c.id}><div className="f-group"><input className="f-input" placeholder="항목명" value={c.name} onChange={e=>upL(c.id,"name",e.target.value)}/></div><div className="f-group"><input className="f-input" placeholder="금액 (예: 7,000 pesos)" value={c.amount} onChange={e=>upL(c.id,"amount",e.target.value)}/>{c.name==="드림하우스 보증금"&&<div className="f-hint">(1주 × 2,000페소 자동계산)</div>}</div><button className="bs br" onClick={()=>rmL(c.id)}>삭제</button></div>)}
    <button className="bs bd" onClick={addL}>+ 현지 지불 항목 추가</button>
    <button type="button" onClick={autoFillLocals} style={{marginLeft:8,padding:"6px 12px",fontSize:12,background:"#3b82f6",color:"#fff",border:"none",borderRadius:6,cursor:"pointer",fontWeight:600}}>🪙 현지지불 자동채움 (학생/기간 기준)</button>
    {a1CI&&(<div style={{marginTop:"14px",padding:"12px 14px",borderRadius:"8px",background:effectiveFullPayment?"#fef2f2":"#f0f7ff",border:effectiveFullPayment?"1px solid #fecaca":"1px solid #bfdbfe",fontSize:"13px"}}>{effectiveFullPayment?(<><span style={{color:"#dc2626",fontWeight:700}}>{isFullPayment?"⚠️ 전액 입금 — 체크인이 2달 미만입니다. ":"💰 전액 입금 — "}전체 금액({fmt(fp)}원)을 납부해 주세요.</span>{!isFullPayment&&(<div style={{marginTop:"8px"}}><label style={{fontSize:"12px",color:"#475569",cursor:"pointer"}}><input type="checkbox" checked={forceFullPayment} onChange={e=>setForceFullPayment(e.target.checked)} style={{marginRight:"6px"}} />💰 전액 입금으로 표시</label></div>)}</>):(<><div style={{marginBottom:"4px"}}><strong>예약금:</strong> {fmt(depositAmt)}원{isResortSingle&&<span style={{fontSize:11,color:"#6b7c93"}}> (리조트 패키지 — 총액의 50%)</span>}</div><div style={{marginBottom:"4px"}}><strong>잔금:</strong> {fmt(Math.max(0,fp-depositAmt))}원{booker.balanceDate?` (납부일: ${booker.balanceDate})`:""}</div><div style={{color:"#6b7c93",fontSize:"11px",marginTop:"6px"}}>※ 예약금 입금 후 예약 확정, 잔금은 입실 2달 전까지 납부</div><div style={{marginTop:"8px"}}><label style={{fontSize:"12px",color:"#475569",cursor:"pointer"}}><input type="checkbox" checked={forceFullPayment} onChange={e=>setForceFullPayment(e.target.checked)} style={{marginRight:"6px"}} />💰 전액 입금으로 표시</label></div></>)}</div>)}
  </div>

  {/* ── 섹션5: 체크인 정보 ── */}
  <div className="fs" id="checkin-section"><h2>체크인 정보</h2>
    <div className="f-row"><div className="f-group"><label className="f-label">픽업</label><select className="f-select" value={checkin.pickup} onChange={e=>setCheckin({...checkin,pickup:e.target.value})}><option value="O">O</option><option value="X">X</option></select></div><div className="f-group"><label className="f-label">드롭</label><select className="f-select" value={checkin.drop} onChange={e=>setCheckin({...checkin,drop:e.target.value})}><option value="O">O</option><option value="X">X</option></select></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">픽업 장소</label><input className="f-input" placeholder="막탄공항 도착 게이트" value={checkin.pickupPlace} onChange={e=>setCheckin({...checkin,pickupPlace:e.target.value})}/></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">항공편 (IN)</label><input className="f-input" placeholder="예: 5J502  ※ 미정 시 공백" value={checkin.flightIn} onChange={e=>setCheckin({...checkin,flightIn:e.target.value})}/></div><div className="f-group"><label className="f-label">항공편 (OUT)</label><input className="f-input" placeholder="나중에 입력 가능" value={checkin.flightOut} onChange={e=>setCheckin({...checkin,flightOut:e.target.value})}/></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">하우스 번호</label><input className="f-input" placeholder="배정 후 입력" value={checkin.houseNo} onChange={e=>setCheckin({...checkin,houseNo:e.target.value})}/></div></div>
    <div className="f-group" style={{marginTop:"4px"}}><label className="f-label">특별 요청사항</label><textarea className="f-textarea" value={checkin.specialRequest} onChange={e=>setCheckin({...checkin,specialRequest:e.target.value})}/></div>
  </div>

  {/* ── 섹션6: 관리자 전용 ── */}
  <div className="fs-admin"><h2>관리자 전용 🔒</h2>
    <div className="admin-note">⚠️ 이 섹션은 내부 기록용입니다. 인보이스/영수증 출력물에 표시되지 않습니다.</div>
    <div className="f-row"><div className="f-group"><label className="f-label">유학원명</label><input className="f-input" placeholder="없으면 개인" value={adminOnly.agency} onChange={e=>setAdminOnly({...adminOnly,agency:e.target.value})}/></div><div className="f-group"><label className="f-label">SSP</label><select className="f-select" value={adminOnly.ssp} onChange={e=>setAdminOnly({...adminOnly,ssp:e.target.value})}><option value="O">O</option><option value="X">X</option></select></div></div>
  </div>

  <button className="bg" onClick={gen}>인보이스 미리보기</button>
  <a href="/admin/bookings?tab=list" className="bl">← 예약내역으로 돌아가기</a>
  </div>):(

  /* ── 인보이스 미리보기 ── */
  <div className="iw">
    {hasSnapshot&&(
      <div className="no-print" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12,padding:"10px 14px",background:confirmedAt?"#ecfdf5":"#f8fafc",border:"1px solid "+(confirmedAt?"#a7f3d0":"#e2e8f0"),borderRadius:8}}>
        <span style={{fontSize:12.5,color:confirmedAt?"#065f46":"#475569",fontWeight:700}}>
          {confirmedAt
            ?<>🔒 확정된 인보이스 · <span style={{color:"#047857"}}>{fmtSavedAt(confirmedAt)}</span></>
            :<>💾 저장된 인보이스 · <span style={{color:"#94a3b8",fontWeight:500}}>{fmtSavedAt(snapshotSavedAt)}</span></>
          }
        </span>
        <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
          <label style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:12,color:"#475569",cursor:"pointer"}}><input type="checkbox" checked={lateCheckout} onChange={e=>{const v=e.target.checked;syncLateCheckout(v);saveSnapshot({lateCheckout:v});}}/>Late Check-out (22:30pm)</label>
          <button onClick={requestEdit} style={{padding:"7px 16px",background:"#fff",color:"#2563eb",border:"1px solid #bfdbfe",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>✏️ 수정하기</button>
          <button onClick={resetInvoice} style={{padding:"7px 14px",background:"#fff",color:"#dc2626",border:"1px solid #fecaca",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>🗑 초기화</button>
          {!confirmedAt&&(
            <button onClick={confirmInvoice} style={{padding:"7px 16px",background:"#16a34a",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>✅ 인보이스 확정</button>
          )}
        </div>
      </div>
    )}
    <div className="iv" id="invoice-content">
      <div className="it"><div><img src="/dream-academy-logo.png" alt="Dream Academy" style={{height:60,width:"auto"}} /></div><div className="itr"><h1>INVOICE</h1><p>No. {reservationNo}</p></div></div>

      <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Customer Information</div><table className="tb"><tbody>
        <tr><td className="lb">예약자명</td><td>{booker.name}</td><td className="lb">영문이름</td><td>{booker.englishName}</td></tr>
        <tr><td className="lb">예약번호</td><td>{reservationNo}</td><td className="lb">예약일</td><td>{reservationDate}</td></tr>
        <tr><td className="lb">{isCommute?"수업시작":"체크인"}</td><td>{overallCI?(isCommute?overallCI:`${overallCI} 15:00PM`):"-"}</td><td className="lb">{isCommute?"수업종료":"체크아웃"}</td><td>{overallCO?(isCommute?overallCO:`${overallCO} ${coTimeText}`):"-"}</td></tr>
            {cm==="combo"&&a1CI&&a1CO&&<tr><td className="lb">{_accomKo(a1T)} 체크인</td><td style={{fontWeight:700}}>{a1CI}</td><td className="lb">{_accomKo(a1T)} 체크아웃</td><td style={{fontWeight:700}}>{a1CO}</td></tr>}
            {cm==="combo"&&a2CI&&a2CO&&<tr><td className="lb">{_accomKo(a2T)} 체크인</td><td style={{fontWeight:700}}>{a2CI}</td><td className="lb">{_accomKo(a2T)} 체크아웃</td><td style={{fontWeight:700}}>{overallCO||a2CO}</td></tr>}
        <tr><td className="lb">패키지</td><td>{billing.items.map(i=>i.label).join(" + ")||(isCommute?`통학형 ${a1W}주`:`${alKo(a1T,a1R)} ${a1W}주`)}</td><td className="lb">인원 구성</td><td>보호자 {cP}명 + 아이 {cK}명</td></tr>
        <tr><td className="lb">잔금납부일</td><td colSpan={3}>{booker.balanceDate||"미정"}</td></tr>
      </tbody></table></div>

      {!(dhOnly&&!acadOpt)&&(<div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Student Information</div><table className="tb"><thead><tr><th>이름(한글)</th><th>영문이름</th><th>나이</th><th>킨더/주니어</th><th>기간</th><th>사진허용</th></tr></thead><tbody>
        {students.map((s,i)=>{const endVal=s.academyEnd||calcAcademyEnd(s.academyStart,s.academyWeeks);return <tr key={i}><td>{s.korName}</td><td>{s.engName}</td><td>{s.age}</td><td>{s.grade}</td><td>{s.academyStart?`${fmtDate(s.academyStart)}~${fmtDate(endVal)} (${s.academyWeeks}주)`:s.academyWeeks+"주"}</td><td>{s.photo}</td></tr>;})}
      </tbody></table></div>)}

      <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Billing Details</div>{!applied&&billing.basePrice===0?<div style={{padding:"16px",fontSize:"13px",color:"#94a3b8",textAlign:"center"}}>견적 계산 후 "인보이스에 적용" 버튼을 눌러주세요</div>:<><table className="tb"><thead><tr><th style={{width:"60%"}}>항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
        {billing.items.length>0?billing.items.map((item,i)=><tr key={i}><td>{item.label}{item.season?` (${item.season})`:""}</td><td style={{textAlign:"right"}}>{fmt(item.price)}원</td></tr>):<tr><td>패키지 금액{!isCommute&&` (${alKo(a1T,a1R)} ${a1W}주)`}</td><td style={{textAlign:"right"}}>{fmt(billing.basePrice)}원</td></tr>}
        {billing.discounts.filter(d=>d.name).map((d,i)=><tr key={i}><td className="dc">↓ {d.name}</td><td className="dc" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>)}
        {td>0&&<tr className="tr"><td>총 할인</td><td style={{textAlign:"right",color:"#dc2626"}}>-{fmt(td)}원</td></tr>}
        {billing.additions.filter(a=>a.name).map((a,i)=><tr key={`a${i}`}><td style={{color:"#16a34a",fontWeight:700}}>↑ {a.name}</td><td style={{textAlign:"right",color:"#16a34a",fontWeight:700}}>+{fmt(Number(a.amount))}원</td></tr>)}
        {ta>0&&<tr className="tr"><td>총 추가</td><td style={{textAlign:"right",color:"#16a34a"}}>+{fmt(ta)}원</td></tr>}
        <tr className="fr"><td style={{background:"#5b4fff",color:"white",fontWeight:700}}>전체 금액</td><td style={{background:"#5b4fff",color:"white",fontWeight:700,textAlign:"right"}}>{fmt(fp)}원</td></tr>
        {fp>0&&(hasReceiptPayments?(
          <>
            {receiptPayments.filter(p=>(p.amount||"").trim()!=="").map((p,i)=>(
              <tr key={`rp${i}`} style={{background:"#f0fdf4"}}>
                <td style={{padding:"10px 12px",color:"#166534",fontWeight:600}}>✅ {p.type} <span style={{fontSize:11,color:"#6b7280",fontWeight:400}}>({p.date})</span></td>
                <td style={{textAlign:"right",padding:"10px 12px",color:"#166534",fontWeight:600}}>−{fmt(Number(String(p.amount).replace(/[,\s]/g,""))||0)}원</td>
              </tr>
            ))}
            <tr style={{background:"#e0f2fe"}}><td style={{padding:"10px 12px",fontWeight:700,color:"#0369a1"}}>기납부 합계</td><td style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#0369a1"}}>−{fmt(receiptPaidTotal)}원</td></tr>
            <tr style={{background:additionalDue===0?"#f0fdf4":"#fff7ed"}}><td style={{padding:"12px",fontWeight:800,color:additionalDue===0?"#166534":"#c2410c",fontSize:14}}>이번 청구 금액{depositStage?" (예약금 기준)":""}</td><td style={{textAlign:"right",padding:"12px",fontWeight:800,color:additionalDue===0?"#166534":"#c2410c",fontSize:14}}>{fmt(additionalDue)}원</td></tr>
          </>
        ):effectiveFullPayment?<tr style={{background:"#fef2f2"}}><td colSpan={2} style={{padding:"10px 12px",fontWeight:700,color:"#dc2626",fontSize:"13px",textAlign:"center"}}>{isFullPayment?"⚠️ 입실 2달 미만 — ":"💰 "}전액 {fmt(fp)}원을 즉시 납부해 주세요.</td></tr>:<><tr style={{background:"#f0fdf4"}}><td style={{padding:"10px 12px",fontWeight:700,color:"#166534"}}>예약금 <span style={{fontSize:11,fontWeight:400}}>(입금 시 예약 확정)</span></td><td style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#166534"}}>{fmt(depositAmt)}원</td></tr><tr style={{background:"#fff7ed"}}><td style={{padding:"10px 12px",fontWeight:700,color:"#ea580c"}}>잔금 <span style={{fontSize:11,fontWeight:400}}>{booker.balanceDate?`(납부일: ${booker.balanceDate})`:""}</span></td><td style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#ea580c"}}>{fmt(Math.max(0,fp-depositAmt))}원</td></tr><tr><td colSpan={2} style={{padding:"10px 12px",fontSize:12,color:"#6b7280",textAlign:"center"}}>※ 예약금 {fmt(depositAmt)}원{isResortSingle?" (총액의 50%)":""} 입금 후 예약이 확정되며, 잔금은 입실 2달 전까지 납부해 주세요.</td></tr></>)}
      </tbody></table>
      {billing.locals.filter(c=>c.name||c.amount).length>0&&<table className="tb" style={{marginTop:"12px"}}><thead><tr><th style={{width:"60%"}}>현지 지불 항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>{billing.locals.filter(c=>c.name||c.amount).map((c,i)=><tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{c.amount}{c.amount.includes("페소")?"":" 페소"}</td></tr>)}</tbody></table>}</>}</div>

      {!isCommute&&<div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Check-in Details</div><table className="tb"><tbody>
        <tr><td className="lb">픽업</td><td>{checkin.pickup}</td><td className="lb">드롭</td><td>{checkin.drop}</td></tr>
        <tr><td className="lb">픽업 장소</td><td>{checkin.pickupPlace||"미정"}</td><td className="lb">하우스 번호</td><td>{checkin.houseNo||"미정"}</td></tr>
        <tr><td className="lb">항공편 (IN)</td><td>{checkin.flightIn||"미정"}</td><td className="lb">항공편 (OUT)</td><td>{checkin.flightOut||"미정"}</td></tr>
        {checkin.specialRequest&&<tr><td className="lb">특별 요청</td><td colSpan={3} style={{whiteSpace:"pre-wrap"}}>{checkin.specialRequest}</td></tr>}
      </tbody></table>
      <div className="no-print" style={{textAlign:"right",marginTop:"8px"}}><button className="pci" onClick={()=>{setPreview(false);setTimeout(()=>document.getElementById("checkin-section")?.scrollIntoView({behavior:"smooth"}),100);}}>체크인 정보 수정</button></div></div>}

      {stayHolidays.length>0&&<div className="is"><div className="ist" style={{color:"#b45309",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Holiday Notice · 휴무일 안내</div>
        <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:10,padding:"12px 16px",fontSize:13,lineHeight:1.8,color:"#78350f"}}>
          <div style={{fontWeight:800,marginBottom:4}}>🏖 체류 기간 중 휴무일 {stayHolidays.length}일</div>
          <div style={{fontWeight:700}}>{stayHolidays.map(h=>{const d=new Date(h.date+"T00:00:00");const DOW=["일","월","화","수","목","금","토"];return `${d.getMonth()+1}/${d.getDate()}(${DOW[d.getDay()]})${h.name?" "+h.name:""}`;}).join(" · ")}</div>
          <div style={{fontSize:12,marginTop:6,color:"#92400e"}}>{HOLIDAY_GUEST_NOTICE}</div>
        </div></div>}

      <div className="ift">안내받으신 총합안내 이용금액 및 환불규정을 꼭 확인 해 주세요.<br/>미확인으로 인한 문제는 책임지지 않습니다.<br/>추가 요청사항이 있다면 추후 안내 부탁드립니다.<br/>해당 청구서에 대한 문의사항이 있으시면 드림컴퍼니로 문의주세요.<br/>감사합니다.</div>
    </div>
    <div className="pb no-print"><button className="pbk" style={{background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0"}} onClick={()=>router.push("/admin/bookings?tab=list")}>← 예약내역으로</button><button className="pp" onClick={()=>window.print()}>PDF 저장 / 인쇄</button><button style={{padding:"12px 32px",background:"#2563eb",color:"#fff",fontSize:"14px",fontWeight:700,border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>saveAsImage()}>📷 이미지 저장</button><button className="prc" onClick={()=>setTab("receipt")}>🧾 영수증 탭으로</button>{bookingId&&<button className="psv" onClick={saveToDb}>저장하기</button>}<button className="pbk" onClick={requestEdit}>수정하기</button></div>
  </div>)}
  </>):(
    /* ── 영수증 탭 ── */
    <div className="iw">
      {!confirmedAt?(
        <div style={{background:"#fff",borderRadius:14,padding:"60px 24px",textAlign:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.05)"}}>
          <div style={{fontSize:48,marginBottom:14}}>🔒</div>
          <div style={{fontSize:17,fontWeight:800,color:"#1a1a2e",marginBottom:8}}>인보이스를 먼저 확정해주세요</div>
          <div style={{fontSize:13,color:"#6b7c93",marginBottom:24,lineHeight:1.6}}>
            영수증은 확정된 인보이스 데이터를 기준으로 발행됩니다.<br/>
            인보이스 탭에서 미리보기 → 확정 후 다시 시도해주세요.
          </div>
          <button onClick={()=>setTab("invoice")} style={{padding:"11px 24px",background:"#1a6fc4",color:"#fff",border:"none",borderRadius:10,fontSize:13.5,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>📄 인보이스 탭으로</button>
        </div>
      ):(<>
        {/* 확정 배너 */}
        <div className="no-print" style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap",marginBottom:12,padding:"10px 14px",background:"#ecfdf5",border:"1px solid #a7f3d0",borderRadius:8}}>
          <span style={{fontSize:12.5,color:"#065f46",fontWeight:700}}>🔒 확정된 인보이스 기준 · <span style={{color:"#047857"}}>{fmtSavedAt(confirmedAt)}</span></span>
          <button onClick={()=>router.push("/admin/bookings?tab=list")} style={{padding:"7px 14px",background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>← 예약내역으로</button>
          <button onClick={()=>setTab("invoice")} style={{padding:"7px 14px",background:"#fff",color:"#1a6fc4",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12.5,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>📄 인보이스 탭으로</button>
        </div>

        {/* 지불내역 에디터 */}
        <div className="no-print" style={{background:"#fff",padding:"18px 22px",boxShadow:"0 2px 12px rgba(0,0,0,0.05)",borderRadius:12,marginBottom:16,borderLeft:"4px solid #1a6fc4"}}>
          <div style={{fontSize:15,fontWeight:800,color:"#1a1a2e",marginBottom:4}}>💰 지불내역 입력</div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <span style={{fontSize:12,color:"#6b7c93"}}>입금받은 내역을 입력하세요. 영수증 하단에 자동으로 표시됩니다.</span>
            <span style={{fontSize:11,color:"#f59e0b",fontWeight:600}}>✏️ 금액·날짜·구분 직접 수정 가능 | ✕ 로 삭제</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"110px 110px 150px 1fr auto",gap:8,marginBottom:6,fontSize:11,color:"#6b7c93",fontWeight:600}}>
            <span>구분</span><span>결제수단</span><span>날짜</span><span>금액 (원)</span><span></span>
          </div>
          {receiptPayments.map(p=>(
            <div key={p.id} style={{display:"grid",gridTemplateColumns:"110px 110px 150px 1fr auto",gap:8,alignItems:"center",marginBottom:8}}>
              <select value={p.type} onChange={e=>setReceiptPayments(prev=>prev.map(x=>x.id===p.id?{...x,type:e.target.value,amount:(x.amount||"").trim()===""?(e.target.value==="예약금"?depositAmt.toLocaleString("ko-KR"):e.target.value==="잔금"&&fp>depositAmt?(fp-depositAmt).toLocaleString("ko-KR"):x.amount):x.amount}:x))} style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff",cursor:"pointer"}}>
                <option value="예약금">예약금</option>
                <option value="잔금">잔금</option>
                <option value="추가입금">추가입금</option>
                <option value="현지결제">현지결제</option>
              </select>
              <select value={(p as unknown as Record<string,string>).method||"무통장"} onChange={e=>setReceiptPayments(prev=>prev.map(x=>x.id===p.id?{...x,method:e.target.value}:x))} style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff",cursor:"pointer"}}>
                <option value="무통장">무통장</option>
                <option value="카드">카드</option>
                <option value="현금">현금</option>
                <option value="페이팔">페이팔</option>
              </select>
              <input type="date" value={p.date} onChange={e=>setReceiptPayments(prev=>prev.map(x=>x.id===p.id?{...x,date:e.target.value}:x))} style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",outline:"none"}}/>
              <input type="text" inputMode="numeric" placeholder="예: 1,000,000" value={p.amount} onChange={e=>{const raw=e.target.value.replace(/[^\d]/g,"");const fmtV=raw?Number(raw).toLocaleString():"";setReceiptPayments(prev=>prev.map(x=>x.id===p.id?{...x,amount:fmtV}:x));}} style={{width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",outline:"none"}}/>
              <button onClick={()=>setReceiptPayments(prev=>{const next=prev.filter(x=>x.id!==p.id);return next.length>0?next:[{id:Date.now(),type:"예약금",date:todayStr,amount:""}];})} style={{background:"#fee2e2",color:"#dc2626",border:"none",borderRadius:6,padding:"8px 12px",cursor:"pointer",fontSize:14}}>✕</button>
            </div>
          ))}
          <button onClick={()=>{const auto=fp>depositAmt?(fp-depositAmt).toLocaleString("ko-KR"):"";setReceiptPayments(prev=>[...prev,{id:Date.now(),type:"잔금",date:todayStr,amount:auto}]);}} style={{width:"100%",background:"#f0f9ff",color:"#1a6fc4",border:"1px dashed #93c5fd",borderRadius:8,padding:"9px 20px",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif",marginTop:4}}>+ 입금 항목 추가</button>
        </div>

        {/* 영수증 본문 */}
        <div className="iv" id="receipt-content">
          <div className="it">
            <div><img src="/dream-academy-logo.png" alt="Dream Academy" style={{height:60,width:"auto"}} /></div>
            <div className="itr"><h1>RECEIPT</h1><p>No. R-{reservationNo}</p></div>
          </div>

          <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Customer Information</div>
            <table className="tb"><tbody>
              <tr><td className="lb">예약자명</td><td>{booker.name}</td><td className="lb">영문이름</td><td>{booker.englishName||"-"}</td></tr>
              <tr><td className="lb">예약번호</td><td>{reservationNo}</td><td className="lb">예약일</td><td>{reservationDate}</td></tr>
              <tr><td className="lb">{isCommute?"수업시작":"체크인"}</td><td>{overallCI?(isCommute?overallCI:`${overallCI} 15:00PM`):"-"}</td><td className="lb">{isCommute?"수업종료":"체크아웃"}</td><td>{overallCO?(isCommute?overallCO:`${overallCO} ${lateCheckout?"22:30pm":"12noon"}`):"-"}</td></tr>
            {cm==="combo"&&a1CI&&a1CO&&<tr><td className="lb">{_accomKo(a1T)} 체크인</td><td style={{fontWeight:700}}>{a1CI}</td><td className="lb">{_accomKo(a1T)} 체크아웃</td><td style={{fontWeight:700}}>{a1CO}</td></tr>}
            {cm==="combo"&&a2CI&&a2CO&&<tr><td className="lb">{_accomKo(a2T)} 체크인</td><td style={{fontWeight:700}}>{a2CI}</td><td className="lb">{_accomKo(a2T)} 체크아웃</td><td style={{fontWeight:700}}>{overallCO||a2CO}</td></tr>}
              <tr><td className="lb">패키지</td><td>{billing.items.map(i=>i.label).join(" + ")||(isCommute?`통학형 ${a1W}주`:`${alKo(a1T,a1R)} ${a1W}주`)}</td><td className="lb">인원 구성</td><td>보호자 {cP}명 + 아이 {cK}명</td></tr>
              <tr><td className="lb">잔금납부일</td><td colSpan={3}>{booker.balanceDate||"미정"}</td></tr>
              {checkin.specialRequest&&<tr><td className="lb">특이사항</td><td colSpan={3} style={{whiteSpace:"pre-wrap"}}>{checkin.specialRequest}</td></tr>}
            </tbody></table>
          </div>

          {students.length>0&&!(dhOnly&&!acadOpt)&&(
            <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Student Information</div>
              <table className="tb"><thead><tr><th>이름(한글)</th><th>영문이름</th><th>나이</th><th>킨더/주니어</th><th>아카데미 기간</th><th>사진허용</th></tr></thead><tbody>
                {students.map((s,i)=>{const endVal=s.academyEnd||calcAcademyEnd(s.academyStart,s.academyWeeks);return <tr key={i}><td>{s.korName}</td><td>{s.engName}</td><td>{s.age}</td><td>{s.grade}</td><td>{s.academyStart?`${fmtDate(s.academyStart)}~${fmtDate(endVal)} (${s.academyWeeks}주)`:s.academyWeeks+"주"}</td><td>{s.photo}</td></tr>;})}
              </tbody></table>
            </div>
          )}

          <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Billing Details</div>
            <table className="tb"><thead><tr><th style={{width:"60%"}}>항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
              {billing.items.length>0
                ?billing.items.map((item,i)=><tr key={i}><td>{item.label}{item.season?` (${item.season})`:""}</td><td style={{textAlign:"right"}}>{fmt(item.price)}원</td></tr>)
                :<tr><td>패키지 금액{!isCommute&&` (${alKo(a1T,a1R)} ${a1W}주)`}</td><td style={{textAlign:"right"}}>{fmt(billing.basePrice)}원</td></tr>}
              {billing.discounts.filter(d=>d.name).map((d,i)=><tr key={`d${i}`}><td className="dc">↓ {d.name}</td><td className="dc" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>)}
              {td>0&&<tr><td style={{fontWeight:600}}>총 할인</td><td style={{textAlign:"right",color:"#dc2626",fontWeight:600}}>-{fmt(td)}원</td></tr>}
              {billing.additions.filter(a=>a.name).map((a,i)=><tr key={`a${i}`}><td style={{color:"#16a34a",fontWeight:700}}>↑ {a.name}</td><td style={{textAlign:"right",color:"#16a34a",fontWeight:700}}>+{fmt(Number(a.amount))}원</td></tr>)}
              <tr className="fr"><td style={{background:"#5b4fff",color:"#fff",fontWeight:800,boxShadow:"inset 0 0 0 1000px #5b4fff",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>총 청구금액</td><td style={{background:"#5b4fff",color:"#fff",fontWeight:800,textAlign:"right",boxShadow:"inset 0 0 0 1000px #5b4fff",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>{fmt(fp)}원</td></tr>
              {hasReceiptPayments?(<>
                <tr style={{background:"#ecfdf5"}}>
                  <td style={{padding:"10px 12px",fontWeight:800,color:"#065f46",boxShadow:"inset 0 0 0 1000px #ecfdf5",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>✅ 납부 완료 <span style={{fontSize:11,fontWeight:500}}>(누적 {receiptPayments.filter(p=>(p.amount||"").trim()!=="").length}건)</span></td>
                  <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:"#065f46",boxShadow:"inset 0 0 0 1000px #ecfdf5",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>{fmt(receiptPaidTotal)}원</td>
                </tr>
                {additionalDue>0&&depositStage&&(
                  <tr style={{background:"#fff7ed"}}>
                    <td style={{padding:"10px 12px",fontWeight:800,color:"#c2410c",boxShadow:"inset 0 0 0 1000px #fff7ed",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>💰 예약금 잔여 <span style={{fontSize:11,fontWeight:500}}>(잔금 납부 시 함께)</span></td>
                    <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:"#c2410c",boxShadow:"inset 0 0 0 1000px #fff7ed",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>{fmt(additionalDue)}원</td>
                  </tr>
                )}
                {additionalDue>0&&!depositStage&&(
                  <tr style={{background:"#fff7ed"}}>
                    <td style={{padding:"10px 12px",fontWeight:800,color:"#c2410c",boxShadow:"inset 0 0 0 1000px #fff7ed",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>💰 추가 결제 필요 <span style={{fontSize:11,fontWeight:500}}>(추가금 = 새 총액 − 기납부액)</span></td>
                    <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:"#c2410c",boxShadow:"inset 0 0 0 1000px #fff7ed",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>{fmt(additionalDue)}원</td>
                  </tr>
                )}
                {fp-receiptPaidTotal>0&&(depositStage||additionalDue===0)?(
                  <tr style={{background:"#eef2ff"}}>
                    <td style={{padding:"10px 12px",fontWeight:800,color:"#3730a3",boxShadow:"inset 0 0 0 1000px #eef2ff",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>📌 잔금 최종 금액 <span style={{fontSize:11,fontWeight:500}}>(총 청구금액 − 납부액{additionalDue>0&&depositStage?" · 예약금 잔여 포함":""})</span></td>
                    <td style={{padding:"10px 12px",textAlign:"right",fontWeight:800,color:"#3730a3",boxShadow:"inset 0 0 0 1000px #eef2ff",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>{fmt(fp-receiptPaidTotal)}원</td>
                  </tr>
                ):fp-receiptPaidTotal<=0?(
                  <tr style={{background:"#f0fdf4"}}>
                    <td colSpan={2} style={{padding:"10px 12px",fontWeight:800,color:"#15803d",textAlign:"center",boxShadow:"inset 0 0 0 1000px #f0fdf4",WebkitPrintColorAdjust:"exact",printColorAdjust:"exact"}}>🎉 전액 납부 완료</td>
                  </tr>
                ):null}
              </>):effectiveFullPayment?(
                <tr style={{background:"#fef2f2"}}><td colSpan={2} style={{padding:"10px 12px",fontWeight:700,color:"#dc2626",fontSize:13,textAlign:"center"}}>{isFullPayment?"⚠️ 입실 2달 미만 — ":"💰 "}전액 {fmt(fp)}원 즉시 납부</td></tr>
              ):(<>
                <tr style={{background:"#f0fdf4"}}>
                  <td style={{padding:"10px 12px",fontWeight:700,color:"#166534"}}>예약금 <span style={{fontSize:11,fontWeight:400}}>(입금 시 예약 확정)</span></td>
                  <td style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#166534"}}>{fmt(depositAmt)}원</td>
                </tr>
                <tr style={{background:"#fff7ed"}}>
                  <td style={{padding:"10px 12px",fontWeight:700,color:"#ea580c"}}>잔금 <span style={{fontSize:11,fontWeight:400}}>{booker.balanceDate?`(납부일: ${booker.balanceDate})`:""}</span></td>
                  <td style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#ea580c"}}>{fmt(Math.max(0,fp-depositAmt))}원</td>
                </tr>
              </>)}
            </tbody></table>
          </div>

          {billing.locals.filter(c=>c.name||c.amount).length>0&&(
            <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>Local Payment <span style={{fontSize:10,color:"#94a3b8",fontWeight:400,marginLeft:6,letterSpacing:0,textTransform:"none"}}>Unit: PHP</span></div>
              <table className="tb"><tbody>
                {billing.locals.filter(c=>c.name||c.amount).map((c,i)=>{
                  const raw=String(c.amount);
                  const cleaned=raw.replace(/페소|pesos?/gi,"PHP").trim();
                  const display=/PHP/i.test(cleaned)?cleaned:`${cleaned} PHP`;
                  return <tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{display}</td></tr>;
                })}
              </tbody></table>
            </div>
          )}

          <div className="is"><div className="ist" style={{color:"#4f46e5",fontSize:"11px",fontWeight:700,letterSpacing:"0.1em",textTransform:"uppercase"}}>지불내역</div>
            <table className="tb"><thead><tr><th style={{width:"25%"}}>구분</th><th style={{width:"35%"}}>결제일</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
              {receiptPayments.filter(p=>p.amount.trim()!=="").length>0
                ?receiptPayments.filter(p=>p.amount.trim()!=="").map(p=>(
                  <tr key={p.id}><td style={{fontWeight:700}}>{p.type}{(p as unknown as Record<string,string>).method&&<span style={{marginLeft:6,fontSize:11,fontWeight:600,color:"#64748b",background:"#f1f5f9",borderRadius:6,padding:"1px 7px"}}>{(p as unknown as Record<string,string>).method}</span>}</td><td>{p.date}</td><td style={{textAlign:"right",fontWeight:700,color:"#1a6fc4"}}>{p.amount}원</td></tr>
                ))
                :<tr><td colSpan={3} style={{textAlign:"center",color:"#94a3b8",fontSize:12,padding:16}}>위 입력란에서 지불내역을 입력해주세요</td></tr>
              }
            </tbody></table>
          </div>

          <div style={{marginTop:32,textAlign:"center",padding:24}}>
            <p style={{fontSize:14,fontWeight:600,color:"#374151",marginBottom:16}}>위 금액을 정히 영수합니다.</p>
            <div style={{display:"inline-flex",width:110,height:110,border:"3px solid #dc2626",borderRadius:"50%",flexDirection:"column",alignItems:"center",justifyContent:"center",color:"#dc2626",transform:"rotate(-8deg)",opacity:0.85}}>
              <div style={{fontFamily:"'Montserrat',sans-serif",fontSize:10,fontWeight:900,letterSpacing:"0.08em"}}>DREAM ACADEMY</div>
              <div style={{fontSize:9,opacity:0.7,marginTop:1}}>Philippines</div>
              <div style={{fontSize:8,fontWeight:600,marginTop:4}}>Official Receipt</div>
            </div>
            <div style={{fontSize:12,color:"#6b7c93",lineHeight:1.9,marginTop:20}}>
              안내받으신 종합안내 이용금액 및 환불 규정을 꼭 확인해주세요<br/>
              미확인으로 인한 문제는 책임 지지않습니다<br/>
              {isCommute?"통학형 프로그램":a1T==="dreamhouse"||cm==="combo"?"드림아카데미 패키지":a1T==="jpark"?"제이파크 패키지":a1T==="cubenine"?"큐브나인 패키지":"드림아카데미 패키지"} 이용금액 전체 결제하였음을 증명합니다<br/>
              해당영수증에 대한 문의사항이 있으시면 드림아카데미로 문의주세요<br/>
              감사합니다
            </div>
          </div>
        </div>

        {/* 영수증 버튼 */}
        <div className="pb no-print">
          <button className="pbk" onClick={()=>setTab("invoice")}>← 인보이스 탭</button>
          <button onClick={saveReceiptPayments} disabled={savingReceipt} style={{padding:"12px 24px",background:"#1a6fc4",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:savingReceipt?"not-allowed":"pointer",fontFamily:"'Noto Sans KR',sans-serif",opacity:savingReceipt?0.6:1}}>💾 {savingReceipt?"저장중...":"지불내역 저장"}</button>
          {(a1T==="dreamhouse"||(cm==="combo"&&a2T==="dreamhouse"))&&<button onClick={registerDreamhouse} disabled={dhRegistered} style={{padding:"12px 24px",background:dhRegistered?"#86efac":"#16a34a",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:dhRegistered?"not-allowed":"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>{dhRegistered?`✅ 하우스 등록완료${(checkin.houseNo||"").trim()?" · "+checkin.houseNo:""}`:"🏠 드림하우스 등록"}</button>}
          {(a1T==="cubenine"||(cm==="combo"&&a2T==="cubenine"))&&<button onClick={registerCubenine} style={{padding:"12px 24px",background:c9Room?"#059669":"#0e7490",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} title={c9Room?"클릭하면 룸 재배정 가능":""}>{c9Room?`✅ 큐브 ${c9Room}호 배정됨`:(c9Registered?"✅ 큐브 등록완료":"🐬 큐브나인 등록")}</button>}
          {dhModal&&(
            <div onClick={()=>setDhModal(null)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9990}}>
              <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:"20px 22px",width:"min(480px,92vw)",boxShadow:"0 12px 40px rgba(0,0,0,0.25)",fontFamily:"'Noto Sans KR',sans-serif",textAlign:"left"}}>
                <div style={{fontSize:15,fontWeight:800,marginBottom:4}}>🏠 드림하우스 룸 배정</div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>자동 배정이 없어졌어요 — 룸을 직접 선택하거나, 미배정으로 등록 후 룸 캘린더에서 배정하세요. ({dhModal.ci} ~ {dhModal.co} 기준 가용 룸)</div>
                {dhModal.current&&(
                  <button onClick={()=>finishDhRegister(dhModal.current)} style={{width:"100%",padding:"9px 0",border:"1.5px solid #16a34a",borderRadius:9,background:"#f0fdf4",color:"#166534",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:10}}>현재 룸 유지하고 등록 — {dhModal.current}</button>
                )}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
                  {dhModal.avail.length===0?<div style={{gridColumn:"1/5",fontSize:12,color:"#dc2626",fontWeight:700}}>⚠️ 이 기간 가용 룸이 없습니다 (미배정으로 등록 후 조정하세요)</div>:
                    dhModal.avail.map(r=>(
                      <button key={r} onClick={()=>finishDhRegister(r)} style={{padding:"8px 0",border:"1px solid #cbd5e1",borderRadius:8,background:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{r.toUpperCase().replace(/^B/,"B")}</button>
                    ))}
                </div>
                <button onClick={()=>finishDhRegister(null)} style={{width:"100%",padding:"9px 0",border:"1px solid #4338ca",borderRadius:9,background:"#eef2ff",color:"#4338ca",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>룸 미배정으로 등록 (나중에 룸 캘린더에서 배정)</button>
                <button onClick={()=>setDhModal(null)} style={{width:"100%",padding:"8px 0",border:"1px solid #e2e8f0",borderRadius:9,background:"#fff",color:"#64748b",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
              </div>
            </div>
          )}
          {c9Modal&&(
            <div onClick={()=>setC9Modal(null)} style={{position:"fixed",inset:0,background:"rgba(15,23,42,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9990}}>
              <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,padding:"20px 22px",width:"min(500px,92vw)",boxShadow:"0 12px 40px rgba(0,0,0,0.25)",fontFamily:"'Noto Sans KR',sans-serif",textAlign:"left"}}>
                <div style={{fontSize:15,fontWeight:800,marginBottom:4}}>🐬 큐브나인 룸 배정</div>
                <div style={{fontSize:12,color:"#64748b",marginBottom:12}}>{c9Modal.ci} ~ {c9Modal.co} 기준 가용 룸 · 예약 룸타입: <b style={{color:c9Modal.prefer==="FA"?"#1d4ed8":"#0e7490"}}>{c9Modal.prefer==="FA"?"풀억세스":"디럭스오션"}</b></div>
                {c9Modal.assigned&&(
                  <div style={{fontSize:12.5,fontWeight:700,color:"#166534",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:8,padding:"7px 10px",marginBottom:10}}>현재 배정: {c9Modal.assigned}호 — 다른 룸을 누르면 재배정돼요</div>
                )}
                <div style={{fontSize:12,fontWeight:800,color:"#1d4ed8",margin:"4px 0 6px"}}>풀 억세스 룸 (103~106){c9Modal.prefer==="FA"?" ← 예약 룸타입":""}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:10}}>
                  {c9Modal.availFA.length===0?<div style={{gridColumn:"1/5",fontSize:12,color:"#dc2626",fontWeight:700}}>이 기간 풀억세스 가용 룸 없음</div>:
                    c9Modal.availFA.map(r=>(
                      <button key={r} onClick={()=>finishC9Register(r)} style={{padding:"8px 0",border:c9Modal.prefer==="FA"?"1.5px solid #1d4ed8":"1px solid #cbd5e1",borderRadius:8,background:c9Modal.assigned===r?"#dbeafe":"#fff",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{r}호</button>
                    ))}
                </div>
                <div style={{fontSize:12,fontWeight:800,color:"#0e7490",margin:"4px 0 6px"}}>디럭스 오션뷰 룸 (204~210){c9Modal.prefer==="DX"?" ← 예약 룸타입":""}</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6,marginBottom:12}}>
                  {c9Modal.availDX.length===0?<div style={{gridColumn:"1/5",fontSize:12,color:"#dc2626",fontWeight:700}}>이 기간 디럭스오션 가용 룸 없음</div>:
                    c9Modal.availDX.map(r=>(
                      <button key={r} onClick={()=>finishC9Register(r)} style={{padding:"8px 0",border:c9Modal.prefer==="DX"?"1.5px solid #0e7490":"1px solid #cbd5e1",borderRadius:8,background:c9Modal.assigned===r?"#cffafe":"#fff",fontWeight:800,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>{r}호</button>
                    ))}
                </div>
                <button onClick={()=>finishC9Register(null)} style={{width:"100%",padding:"9px 0",border:"1px solid #4338ca",borderRadius:9,background:"#eef2ff",color:"#4338ca",fontWeight:800,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:8}}>룸 미배정으로 등록 (예약현황에서 배정)</button>
                <button onClick={()=>setC9Modal(null)} style={{width:"100%",padding:"8px 0",border:"1px solid #e2e8f0",borderRadius:9,background:"#fff",color:"#64748b",fontWeight:700,fontSize:12.5,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
              </div>
            </div>
          )}
          <button className="pp" onClick={()=>window.print()}>🖨 PDF / 인쇄</button>
          <button style={{padding:"12px 24px",background:"#7c3aed",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>saveAsImage("receipt-content")}>📷 이미지 저장</button>
        </div>
      </>)}
    </div>
  )}
  </>)}
  </>);
}
