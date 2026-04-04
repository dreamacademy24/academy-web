"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import html2canvas from "html2canvas";

/* ── 유틸 함수 (100% 기존 유지) ── */
function isPeak(d: string): boolean {
  if (!d) return false;
  const dt = new Date(d), m = dt.getMonth()+1, day = dt.getDate();
  return (m===7&&day>=15)||m===8||(m===12&&day>=15)||m===1||m===2;
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

/* ── 요금 테이블 (100% 기존 유지) ── */
type P3=[number,number,number];
const DH:Record<string,P3>={"2-1-2":[4970000,3970000,4470000],"2-2-2":[5550000,4440000,4990000],"2-3-2":[6140000,4910000,5520000],"3-1-2":[7190000,5750000,6470000],"3-2-2":[8010000,6400000,7200000],"3-3-2":[8840000,7070000,7950000],"4-1-2":[8950000,7160000,8050000],"4-2-2":[10010000,8000000,9000000],"4-3-2":[11080000,8860000,9970000],"5-1-2":[11150000,8920000,10030000],"5-2-2":[12460000,9960000,11210000],"5-3-2":[13770000,11010000,12390000],"6-1-2":[13360000,10680000,12020000],"6-2-2":[14910000,11920000,13410000],"6-3-2":[16460000,13160000,14810000],"7-1-2":[15570000,12450000,14010000],"7-2-2":[17360000,13880000,15620000],"7-3-2":[19150000,15320000,17230000],"8-1-2":[17800000,14240000,16020000],"8-2-2":[19830000,15860000,17840000],"8-3-2":[21860000,17480000,19670000],"9-1-2":[20010000,16000000,18000000],"9-2-2":[22280000,17820000,20050000],"9-3-2":[24550000,19640000,22090000],"10-1-2":[22220000,17770000,19990000],"10-2-2":[24740000,19790000,22260000],"10-3-2":[27250000,21800000,24520000],"11-1-2":[24440000,19550000,21990000],"11-2-2":[27190000,21750000,24470000],"11-3-2":[29940000,23950000,26940000],"12-1-2":[26650000,21320000,23980000],"12-2-2":[29640000,23710000,26670000],"12-3-2":[32640000,26110000,29370000]};
const JP:Record<string,P3>={"디럭스-2-1-1":[5560000,4440000,5000000],"디럭스-2-1-2":[7040000,5630000,6330000],"디럭스-2-2-1":[6140000,4910000,5520000],"디럭스-2-1-3":[8530000,6820000,7670000],"디럭스-2-2-2":[7630000,6100000,6860000],"프리미어-2-1-1":[5700000,4560000,5130000],"프리미어-2-1-2":[7180000,5740000,6460000],"프리미어-2-2-1":[6280000,5020000,5650000],"프리미어-2-1-3":[8670000,6930000,7800000],"프리미어-2-2-2":[7770000,6210000,6990000],"막탄스윗-2-1-1":[6260000,5000000,5630000],"막탄스윗-2-1-2":[7740000,6190000,6960000],"막탄스윗-2-2-1":[6840000,5470000,6150000],"막탄스윗-2-1-3":[9230000,7380000,8300000],"막탄스윗-2-2-2":[8330000,6660000,7490000],"디럭스-3-1-1":[8180000,6540000,7360000],"디럭스-3-1-2":[10300000,8240000,9270000],"디럭스-3-2-1":[9010000,7200000,8100000],"디럭스-3-1-3":[12410000,9920000,11160000],"디럭스-3-2-2":[11120000,8890000,10000000],"프리미어-3-1-1":[8390000,6710000,7550000],"프리미어-3-1-2":[10510000,8400000,9450000],"프리미어-3-2-1":[9220000,7370000,8290000],"프리미어-3-1-3":[12620000,10090000,11350000],"프리미어-3-2-2":[11330000,9060000,10190000],"막탄스윗-3-1-1":[9230000,7380000,8300000],"막탄스윗-3-1-2":[11350000,9080000,10210000],"막탄스윗-3-2-1":[10060000,8040000,9050000],"막탄스윗-3-1-3":[13460000,10760000,12110000],"막탄스윗-3-2-2":[12170000,9730000,10950000],"디럭스-4-1-1":[10720000,8570000,9640000],"디럭스-4-1-2":[13370000,10690000,12030000],"디럭스-4-2-1":[11780000,9420000,10600000],"디럭스-4-1-3":[16030000,12820000,14420000],"디럭스-4-2-2":[14440000,11550000,12990000],"프리미어-4-1-1":[11000000,8800000,9900000],"프리미어-4-1-2":[13650000,10920000,12280000],"프리미어-4-2-1":[12060000,9640000,10850000],"프리미어-4-1-3":[16310000,13040000,14670000],"프리미어-4-2-2":[14720000,11770000,13240000],"막탄스윗-4-1-1":[12120000,9690000,10900000],"막탄스윗-4-1-2":[14770000,11810000,13290000],"막탄스윗-4-2-1":[13180000,10540000,11860000],"막탄스윗-4-1-3":[17430000,13940000,15680000],"막탄스윗-4-2-2":[15840000,12670000,14250000],"디럭스-5-1-1":[13370000,10690000,12030000],"디럭스-5-1-2":[16680000,13340000,15010000],"디럭스-5-2-1":[14670000,11730000,13200000],"디럭스-5-1-3":[20000000,16000000,18000000],"디럭스-5-2-2":[17990000,14390000,16190000],"프리미어-5-1-1":[13720000,10970000,12340000],"프리미어-5-1-2":[17030000,13620000,15320000],"프리미어-5-2-1":[15020000,12010000,13510000],"프리미어-5-1-3":[20350000,16280000,18310000],"프리미어-5-2-2":[18340000,14670000,16500000],"막탄스윗-5-1-1":[15120000,12090000,13600000],"막탄스윗-5-1-2":[18430000,14740000,16580000],"막탄스윗-5-2-1":[16420000,13130000,14770000],"막탄스윗-5-1-3":[21750000,17400000,19570000],"막탄스윗-5-2-2":[19740000,15790000,17760000],"디럭스-6-1-1":[16020000,12810000,14410000],"디럭스-6-1-2":[20000000,16000000,18000000],"디럭스-6-2-1":[17570000,14050000,15810000],"디럭스-6-1-3":[23980000,19180000,21580000],"디럭스-6-2-2":[21550000,17240000,19390000],"프리미어-6-1-1":[16440000,13150000,14790000],"프리미어-6-1-2":[20420000,16330000,18370000],"프리미어-6-2-1":[17990000,14390000,16190000],"프리미어-6-1-3":[24400000,19520000,21960000],"프리미어-6-2-2":[21970000,17570000,19770000],"막탄스윗-6-1-1":[18120000,14490000,16300000],"막탄스윗-6-1-2":[22100000,17680000,19890000],"막탄스윗-6-2-1":[19670000,15730000,17700000],"막탄스윗-6-1-3":[26080000,20860000,23470000],"막탄스윗-6-2-2":[23650000,18920000,21280000],"디럭스-7-1-1":[18670000,14930000,16800000],"디럭스-7-1-2":[23310000,18640000,20970000],"디럭스-7-2-1":[20460000,16360000,18410000],"디럭스-7-1-3":[27950000,22360000,25150000],"디럭스-7-2-2":[25100000,20080000,22590000],"프리미어-7-1-1":[19160000,15320000,17240000],"프리미어-7-1-2":[23800000,19040000,21420000],"프리미어-7-2-1":[20950000,16760000,18850000],"프리미어-7-1-3":[28440000,22750000,25590000],"프리미어-7-2-2":[25590000,20470000,23030000],"막탄스윗-7-1-1":[21120000,16890000,19000000],"막탄스윗-7-1-2":[25760000,20600000,23180000],"막탄스윗-7-2-1":[22910000,18320000,20610000],"막탄스윗-7-1-3":[30400000,24320000,27360000],"막탄스윗-7-2-2":[27550000,22040000,24790000],"디럭스-8-1-1":[21340000,17070000,19200000],"디럭스-8-1-2":[26650000,21320000,23980000],"디럭스-8-2-1":[23370000,18690000,21030000],"디럭스-8-1-3":[31960000,25560000,28760000],"디럭스-8-2-2":[28680000,22940000,25810000],"프리미어-8-1-1":[21900000,17520000,19710000],"프리미어-8-1-2":[27210000,21760000,24480000],"프리미어-8-2-1":[23930000,19140000,21530000],"프리미어-8-1-3":[32520000,26010000,29260000],"프리미어-8-2-2":[29240000,23390000,26310000],"막탄스윗-8-1-1":[24140000,19310000,21720000],"막탄스윗-8-1-2":[29450000,23560000,26500000],"막탄스윗-8-2-1":[26170000,20930000,23550000],"막탄스윗-8-1-3":[34760000,27800000,31280000],"막탄스윗-8-2-2":[31480000,25180000,28330000],"디럭스-9-1-1":[23990000,19190000,21590000],"디럭스-9-1-2":[29960000,23960000,26960000],"디럭스-9-2-1":[26260000,21000000,23630000],"디럭스-9-1-3":[35940000,28750000,32340000],"디럭스-9-2-2":[32240000,25790000,29010000],"프리미어-9-1-1":[24620000,19690000,22150000],"프리미어-9-1-2":[30590000,24470000,27530000],"프리미어-9-2-1":[26890000,21510000,24200000],"프리미어-9-1-3":[36570000,29250000,32910000],"프리미어-9-2-2":[32870000,26290000,29580000],"막탄스윗-9-1-1":[27140000,21710000,24420000],"막탄스윗-9-1-2":[33110000,26480000,29790000],"막탄스윗-9-2-1":[29410000,23520000,26460000],"막탄스윗-9-1-3":[39090000,31270000,35180000],"막탄스윗-9-2-2":[35390000,28310000,31850000],"디럭스-10-1-1":[26650000,21320000,23980000],"디럭스-10-1-2":[33280000,26620000,29950000],"디럭스-10-2-1":[29160000,23320000,26240000],"디럭스-10-1-3":[39920000,31930000,35920000],"디럭스-10-2-2":[35800000,28640000,32220000],"프리미어-10-1-1":[27350000,21880000,24610000],"프리미어-10-1-2":[33980000,27180000,30580000],"프리미어-10-2-1":[29860000,23880000,26870000],"프리미어-10-1-3":[40620000,32490000,36550000],"프리미어-10-2-2":[36500000,29200000,32850000],"막탄스윗-10-1-1":[30150000,24120000,27130000],"막탄스윗-10-1-2":[36780000,29420000,33100000],"막탄스윗-10-2-1":[32660000,26120000,29390000],"막탄스윗-10-1-3":[43420000,34730000,39070000],"막탄스윗-10-2-2":[39300000,31440000,35370000],"디럭스-11-1-1":[29300000,23440000,26370000],"디럭스-11-1-2":[36600000,29280000,32940000],"디럭스-11-2-1":[32050000,25640000,28840000],"디럭스-11-1-3":[43900000,35120000,39510000],"디럭스-11-2-2":[39360000,31480000,35420000],"프리미어-11-1-1":[30070000,24050000,27060000],"프리미어-11-1-2":[37370000,29890000,33630000],"프리미어-11-2-1":[32820000,26250000,29530000],"프리미어-11-1-3":[44670000,35730000,40200000],"프리미어-11-2-2":[40130000,32100000,36110000],"막탄스윗-11-1-1":[33150000,26520000,29830000],"막탄스윗-11-1-2":[40450000,32360000,36400000],"막탄스윗-11-2-1":[35900000,28720000,32310000],"막탄스윗-11-1-3":[47750000,38200000,42970000],"막탄스윗-11-2-2":[43210000,34560000,38880000],"디럭스-12-1-1":[31960000,25560000,28760000],"디럭스-12-1-2":[39920000,31930000,35920000],"디럭스-12-2-1":[34950000,27960000,31450000],"디럭스-12-1-3":[47890000,38310000,43100000],"디럭스-12-2-2":[42920000,34330000,38620000],"프리미어-12-1-1":[32800000,26240000,29520000],"프리미어-12-1-2":[40760000,32600000,36680000],"프리미어-12-2-1":[35790000,28630000,32210000],"프리미어-12-1-3":[48730000,38980000,43850000],"프리미어-12-2-2":[43760000,35000000,39380000],"막탄스윗-12-1-1":[36160000,28920000,32540000],"막탄스윗-12-1-2":[44120000,35290000,39700000],"막탄스윗-12-2-1":[39150000,31320000,35230000],"막탄스윗-12-1-3":[52090000,41670000,46880000],"막탄스윗-12-2-2":[47120000,37690000,42400000]};
const C9:Record<string,P3>={"디럭스-2-1-1":[4630000,3700000,4160000],"디럭스-2-1-2":[5730000,4580000,5150000],"디럭스-2-2-1":[4830000,3860000,4340000],"디럭스-2-1-3":[6830000,5460000,6140000],"디럭스-2-2-2":[5930000,4740000,5330000],"풀억세스룸-2-1-1":[5020000,4010000,4510000],"풀억세스룸-2-1-2":[6120000,4890000,5500000],"풀억세스룸-2-2-1":[5220000,4170000,4690000],"풀억세스룸-2-1-3":[7220000,5770000,6490000],"풀억세스룸-2-2-2":[6320000,5050000,5680000],"디럭스-3-1-1":[6790000,5430000,6110000],"디럭스-3-1-2":[8330000,6660000,7490000],"디럭스-3-2-1":[7040000,5630000,6330000],"디럭스-3-1-3":[9870000,7890000,8880000],"디럭스-3-2-2":[8580000,6860000,7720000],"풀억세스룸-3-1-1":[7380000,5900000,6640000],"풀억세스룸-3-1-2":[8920000,7130000,8020000],"풀억세스룸-3-2-1":[7630000,6100000,6860000],"풀억세스룸-3-1-3":[10460000,8360000,9410000],"풀억세스룸-3-2-2":[9170000,7330000,8250000],"디럭스-4-1-1":[8860000,7080000,7970000],"디럭스-4-1-2":[10750000,8600000,9670000],"디럭스-4-2-1":[9160000,7320000,8240000],"디럭스-4-1-3":[12640000,10110000,11370000],"디럭스-4-2-2":[11050000,8840000,9940000],"풀억세스룸-4-1-1":[9640000,7710000,8670000],"풀억세스룸-4-1-2":[11530000,9220000,10370000],"풀억세스룸-4-2-1":[9940000,7950000,8940000],"풀억세스룸-4-1-3":[13420000,10730000,12070000],"풀억세스룸-4-2-2":[11830000,9460000,10640000],"디럭스-5-1-1":[11050000,8840000,9940000],"디럭스-5-1-2":[13410000,10720000,12060000],"디럭스-5-2-1":[11400000,9120000,10260000],"디럭스-5-1-3":[15770000,12610000,14190000],"디럭스-5-2-2":[13760000,11000000,12380000],"풀억세스룸-5-1-1":[12030000,9620000,10820000],"풀억세스룸-5-1-2":[14390000,11510000,12950000],"풀억세스룸-5-2-1":[12380000,9900000,11140000],"풀억세스룸-5-1-3":[16750000,13400000,15070000],"풀억세스룸-5-2-2":[14740000,11790000,13260000],"디럭스-6-1-1":[13230000,10580000,11900000],"디럭스-6-1-2":[16060000,12840000,14450000],"디럭스-6-2-1":[13630000,10900000,12260000],"디럭스-6-1-3":[18890000,15110000,17000000],"디럭스-6-2-2":[16460000,13160000,14810000],"풀억세스룸-6-1-1":[14410000,11520000,12960000],"풀억세스룸-6-1-2":[17240000,13790000,15510000],"풀억세스룸-6-2-1":[14810000,11840000,13320000],"풀억세스룸-6-1-3":[20070000,16050000,18060000],"풀억세스룸-6-2-2":[17640000,14110000,15870000],"디럭스-7-1-1":[15420000,12330000,13870000],"디럭스-7-1-2":[18720000,14970000,16840000],"디럭스-7-2-1":[15870000,12690000,14280000],"디럭스-7-1-3":[22020000,17610000,19810000],"디럭스-7-2-2":[19170000,15330000,17250000],"풀억세스룸-7-1-1":[16790000,13430000,15110000],"풀억세스룸-7-1-2":[20090000,16070000,18080000],"풀억세스룸-7-2-1":[17240000,13790000,15510000],"풀억세스룸-7-1-3":[23390000,18710000,21050000],"풀억세스룸-7-2-2":[20540000,16430000,18480000],"디럭스-8-1-1":[17620000,14090000,15850000],"디럭스-8-1-2":[21400000,17120000,19260000],"디럭스-8-2-1":[18120000,14490000,16300000],"디럭스-8-1-3":[25180000,20140000,22660000],"디럭스-8-2-2":[21900000,17520000,19710000],"풀억세스룸-8-1-1":[19190000,15350000,17270000],"풀억세스룸-8-1-2":[22970000,18370000,20670000],"풀억세스룸-8-2-1":[19690000,15750000,17720000],"풀억세스룸-8-1-3":[26750000,21400000,24070000],"풀억세스룸-8-2-2":[23470000,18770000,21120000],"디럭스-9-1-1":[19810000,15840000,17820000],"디럭스-9-1-2":[24060000,19240000,21650000],"디럭스-9-2-1":[20360000,16280000,18320000],"디럭스-9-1-3":[28310000,22640000,25470000],"디럭스-9-2-2":[24610000,19680000,22140000],"풀억세스룸-9-1-1":[21570000,17250000,19410000],"풀억세스룸-9-1-2":[25830000,20660000,23240000],"풀억세스룸-9-2-1":[22120000,17690000,19900000],"풀억세스룸-9-1-3":[30080000,24060000,27070000],"풀억세스룸-9-2-2":[26380000,21100000,23740000],"디럭스-10-1-1":[22000000,17600000,19800000],"디럭스-10-1-2":[26730000,21380000,24050000],"디럭스-10-2-1":[22600000,18080000,20340000],"디럭스-10-1-3":[31450000,25160000,28300000],"디럭스-10-2-2":[27330000,21860000,24590000],"풀억세스룸-10-1-1":[23960000,19160000,21560000],"풀억세스룸-10-1-2":[28690000,22950000,25820000],"풀억세스룸-10-2-1":[24560000,19640000,22100000],"풀억세스룸-10-1-3":[33410000,26720000,30060000],"풀억세스룸-10-2-2":[29290000,23430000,26360000],"디럭스-11-1-1":[24190000,19350000,21770000],"디럭스-11-1-2":[29390000,23510000,26450000],"디럭스-11-2-1":[24840000,19870000,22350000],"디럭스-11-1-3":[34590000,27670000,31130000],"디럭스-11-2-2":[30040000,24030000,27030000],"풀억세스룸-11-1-1":[26350000,21080000,23710000],"풀억세스룸-11-1-2":[31540000,25230000,28380000],"풀억세스룸-11-2-1":[27000000,21600000,24300000],"풀억세스룸-11-1-3":[36740000,29390000,33060000],"풀억세스룸-11-2-2":[32190000,25750000,28970000],"디럭스-12-1-1":[26380000,21100000,23740000],"디럭스-12-1-2":[32050000,25640000,28840000],"디럭스-12-2-1":[27080000,21660000,24370000],"디럭스-12-1-3":[37720000,30170000,33940000],"디럭스-12-2-2":[32750000,26200000,29470000],"풀억세스룸-12-1-1":[28730000,22980000,25850000],"풀억세스룸-12-1-2":[34400000,27520000,30960000],"풀억세스룸-12-2-1":[29430000,23540000,26480000],"풀억세스룸-12-1-3":[40070000,32050000,36060000],"풀억세스룸-12-2-2":[35100000,28080000,31590000]};

/* ── 견적 계산 함수 (100% 기존 유지) ── */
type AT=""| "dreamhouse"|"jpark"|"cubenine";
function lk(t:AT,r:string,w:number,p:number,k:number):P3|null{if(t==="dreamhouse")return DH[`${w}-${p}-${k}`]??null;if(t==="jpark")return JP[`${r}-${w}-${p}-${k}`]??null;return C9[`${r}-${w}-${p}-${k}`]??null;}
function sp(e:P3,pk:boolean){return pk?e[2]:e[1];}
function al(t:AT,r:string){return t==="dreamhouse"?"드림하우스":t==="jpark"?`제이파크 ${r}`:`큐브나인 ${r}`;}
function fmt(n:number){return n.toLocaleString("ko-KR");}
function mp(t:AT){return t==="dreamhouse"?6:4;}
function extraRate(t:AT){return t==="cubenine"?250000:340000;}

/* ── 타입 ── */
interface Disc{id:number;name:string;amount:number}
interface LC{id:number;name:string;amount:string}
interface StudentInfo{id:number;korName:string;engName:string;age:string;grade:string;classType:string;academyStart:string;academyEnd:string;academyWeeks:string;photo:string}

const todayStr = new Date().toISOString().slice(0,10);
const todayCompact = todayStr.replace(/-/g,"");

export default function InvoicePageWrapper(){ return <Suspense><InvoicePageInner/></Suspense>; }

function InvoicePageInner(){
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("id");
  const assigneeParam = searchParams.get("assignee") || "";
  const [dbLoaded, setDbLoaded] = useState(false);

  /* ── 견적 상태 (기존 유지) ── */
  const [cm,setCm]=useState<"single"|"combo">("single");
  const [a1T,setA1T]=useState<AT>("dreamhouse");
  const [a1R,setA1R]=useState("디럭스");
  const [a1W,setA1W]=useState(2);
  const [a1CI,setA1CI]=useState("");
  const [a2T,setA2T]=useState<AT>("jpark");
  const [a2R,setA2R]=useState("디럭스");
  const [a2W,setA2W]=useState(2);
  const [cP,setCP]=useState(1);
  const [cK,setCK]=useState(2);
  const [ex1Cnt,setEx1Cnt]=useState(0);
  const [ex2Cnt,setEx2Cnt]=useState(0);

  const a1CO=a1CI?addDays(a1CI,a1W*7):"";
  const a2CI=cm==="combo"?a1CO:"";
  const a2CO=a2CI?addDays(a2CI,a2W*7):"";
  const overallCI=a1CI;
  const overallCO=cm==="combo"?a2CO:a1CO;

  /* ── 새 상태 ── */
  const [preview,setPreview]=useState(false);
  const [reservationNo,setReservationNo]=useState(()=>"DA-"+todayCompact+"-"+Math.floor(Math.random()*900+100));
  const [reservationDate,setReservationDate]=useState(todayStr);
  const [booker,setBooker]=useState({name:"",englishName:"",balanceDate:""});
  const [students,setStudents]=useState<StudentInfo[]>([{id:1,korName:"",engName:"",age:"",grade:"주니어",classType:"종일",academyStart:"",academyEnd:"",academyWeeks:"2",photo:"O"}]);
  const [billing,setBilling]=useState({basePrice:0,items:[] as{label:string;price:number;season:string}[],discounts:[{id:1,name:"",amount:0}] as Disc[],locals:[{id:1,name:"SSP / SSP I card",amount:""},{id:2,name:"드림하우스 보증금",amount:""}] as LC[]});
  const [checkin,setCheckin]=useState({pickup:"O",drop:"O",pickupPlace:"",flightIn:"",flightOut:"",houseNo:"",specialRequest:""});
  const [adminOnly,setAdminOnly]=useState({agency:"",ssp:"O"});

  /* ── 학생 academyStart 자동동기화 ── */
  useEffect(()=>{
    if(!a1CI||dbLoaded) return;
    setStudents(prev=>prev.map(s=>({...s,academyStart:a1CI,academyEnd:s.academyWeeks?addDays(a1CI,Number(s.academyWeeks)*7):""})));
  },[a1CI,dbLoaded]);

  /* ── DB에서 예약 로드 ── */
  useEffect(()=>{
    if(!bookingId) return;
    supabase.from("bookings").select("*").eq("id",bookingId).single().then(({data})=>{
      if(!data) return;
      setBooker({name:data.booker_name,englishName:data.booker_english||"",balanceDate:data.balance_date||""});
      const sts=typeof data.students==="string"?JSON.parse(data.students):data.students;
      if(sts&&sts.length>0) setStudents(sts.map((s:any,i:number)=>({...s,id:i+1,academyStart:s.academyStart||"",academyEnd:s.academyEnd||"",academyWeeks:s.academyWeeks||"2",photo:s.photo||"O"})));
      setCheckin(c=>({...c,pickup:data.pickup||"O",drop:data.drop_off||"O",pickupPlace:data.pickup_place||"",flightIn:data.flight_in||"",flightOut:data.flight_out||"",houseNo:data.house_no||"",specialRequest:data.special_request||""}));
      setAdminOnly({agency:data.agency||"개인",ssp:data.ssp||"O"});
      if(data.checkin_date) setA1CI(data.checkin_date);
      if(data.accom_weeks) setA1W(data.accom_weeks);
      if(data.base_price>0){
        const items=typeof data.billing_items==="string"?JSON.parse(data.billing_items):(data.billing_items||[]);
        const discs=typeof data.discounts==="string"?JSON.parse(data.discounts):(data.discounts||[]);
        const locs=typeof data.locals==="string"?JSON.parse(data.locals):(data.locals||[]);
        setBilling({basePrice:data.base_price,items,discounts:discs.length>0?discs:[{id:1,name:"",amount:0}],locals:locs.length>0?locs:[{id:1,name:"SSP / SSP I card",amount:""},{id:2,name:"드림하우스 보증금",amount:""}]});
      }
      if(data.reservation_no) setReservationNo(data.reservation_no);
      if(data.reservation_date) setReservationDate(data.reservation_date);
      setDbLoaded(true);
    });
  },[bookingId]);

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

  /* ── 숙소 기간 → 학생 기간 자동동기화 ── */
  useEffect(()=>{
    const totalWeeks=cm==="combo"?a1W+a2W:a1W;
    setStudents(prev=>prev.map(s=>({
      ...s,
      academyWeeks:String(totalWeeks),
      academyEnd:s.academyStart?addDays(s.academyStart,totalWeeks*7):""
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

  /* ── 드림하우스 보증금 자동계산 ── */
  useEffect(()=>{
    const totalWeeks=cm==="combo"?a1W+a2W:a1W;
    const deposit=totalWeeks*2000;
    setBilling(b=>({...b,locals:b.locals.map(l=>l.name==="드림하우스 보증금"?{...l,amount:String(deposit)}:l)}));
  },[a1W,a2W,cm]);

  /* ── 견적 useMemo (100% 기존 유지) ── */
  const est=useMemo(()=>{
    const extras:{label:string;price:number}[]=[];
    if(cm==="single"){
      const e=lk(a1T,a1R,a1W,cP,cK);if(!e)return null;
      const pk=isPeak(a1CI);const price=sp(e,pk);
      if(ex1Cnt>0)extras.push({label:`추가 인원 ${ex1Cnt}명 × 1주`,price:extraRate(a1T)*ex1Cnt});
      const extTotal=extras.reduce((s,x)=>s+x.price,0);
      return{total:price+extTotal,extras,items:[{label:al(a1T,a1R)+" "+a1W+"주",price,fullPrice:price,ratio:1,totalW:a1W,ci:a1CI,co:a1CO,season:pk?"성수기":"비수기"}]};
    }
    const tw=a1W+a2W;
    const e1=lk(a1T,a1R,tw,cP,cK),e2=lk(a2T,a2R,tw,cP,cK);if(!e1||!e2)return null;
    const pk1=isPeak(a1CI),pk2=isPeak(a2CI);
    const f1=sp(e1,pk1),f2=sp(e2,pk2);
    const p1=Math.round(f1*(a1W/tw)),p2=Math.round(f2*(a2W/tw));
    if(ex1Cnt>0)extras.push({label:`${al(a1T,a1R)} 추가 ${ex1Cnt}명 × 1주`,price:extraRate(a1T)*ex1Cnt});
    if(ex2Cnt>0)extras.push({label:`${al(a2T,a2R)} 추가 ${ex2Cnt}명 × 1주`,price:extraRate(a2T)*ex2Cnt});
    const extTotal=extras.reduce((s,x)=>s+x.price,0);
    return{total:p1+p2+extTotal,extras,items:[
      {label:al(a1T,a1R)+" "+a1W+"주",price:p1,fullPrice:f1,ratio:a1W/tw,totalW:tw,ci:a1CI,co:a1CO,season:pk1?"성수기":"비수기"},
      {label:al(a2T,a2R)+" "+a2W+"주",price:p2,fullPrice:f2,ratio:a2W/tw,totalW:tw,ci:a2CI,co:a2CO,season:pk2?"성수기":"비수기"},
    ]};
  },[cm,a1T,a1R,a1W,a1CI,a2T,a2R,a2W,a2CI,cP,cK,ex1Cnt,ex2Cnt]);

  function applyInv(){
    if(!est)return;
    const billItems=[...est.items.map(i=>({label:i.label,price:i.price,season:i.season})),...est.extras.map(x=>({label:x.label,price:x.price,season:""}))];
    setBilling(b=>({...b,basePrice:est.total,items:billItems}));
  }

  /* ── 견적 선택 UI (기존 유지) ── */
  function rSel(t:AT,sT:(v:AT)=>void,r:string,sR:(v:string)=>void,w:number,sW:(v:number)=>void,ciVal:string,sCI:((v:string)=>void)|null,coVal:string,label:string){
    return(<div className="ab"><div className="ab-l">{label}</div><div className="f-row">
      <div className="f-group"><label className="f-label">숙소</label><select className="f-select" value={t} onChange={e=>{const v=e.target.value as AT;sT(v);sR(v==="jpark"?"디럭스":v==="cubenine"?"디럭스":"");sW(2);}}><option value="dreamhouse">드림하우스</option><option value="jpark">제이파크</option><option value="cubenine">큐브나인</option></select></div>
      {(t==="jpark"||t==="cubenine")&&<div className="f-group"><label className="f-label">룸타입</label><select className="f-select" value={r} onChange={e=>sR(e.target.value)}>{t==="jpark"?<><option value="디럭스">디럭스</option><option value="프리미어">프리미어</option><option value="막탄스윗">막탄스윗</option></>:<><option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option></>}</select></div>}
      <div className="f-group"><label className="f-label">기간</label><select className="f-select" value={w} onChange={e=>sW(Number(e.target.value))}>{Array.from({length:11},(_,i)=>i+2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div>
    </div><div className="f-row">
      <div className="f-group"><label className="f-label">체크인</label>{sCI?<input className="f-input" type="date" value={ciVal} onChange={e=>sCI(e.target.value)}/>:<input className="f-input auto" type="date" value={ciVal} readOnly/>}</div>
      <div className="f-group"><label className="f-label">체크아웃 (자동)</label><input className="f-input auto" value={coVal} readOnly/></div>
    </div></div>);
  }

  /* ── 할인/현지비용 헬퍼 ── */
  const td=billing.discounts.reduce((s,d)=>s+(Number(d.amount)||0),0);
  const fp=billing.basePrice-td;
  const daysUntilCheckin=a1CI?Math.floor((new Date(a1CI).getTime()-Date.now())/86400000):999;
  const isFullPayment=daysUntilCheckin<60;
  function addD(){setBilling(b=>({...b,discounts:[...b.discounts,{id:Date.now(),name:"",amount:0}]}));}
  function rmD(id:number){setBilling(b=>({...b,discounts:b.discounts.filter(d=>d.id!==id)}));}
  function upD(id:number,f:string,v:string|number){setBilling(b=>({...b,discounts:b.discounts.map(d=>d.id===id?{...d,[f]:v}:d)}));}
  function addL(){setBilling(b=>({...b,locals:[...b.locals,{id:Date.now(),name:"",amount:""}]}));}
  function rmL(id:number){setBilling(b=>({...b,locals:b.locals.filter(c=>c.id!==id)}));}
  function upL(id:number,f:string,v:string){setBilling(b=>({...b,locals:b.locals.map(c=>c.id===id?{...c,[f]:v}:c)}));}

  /* ── 학생 헬퍼 ── */
  function addStudent(){if(students.length>=6)return;setStudents([...students,{id:Date.now(),korName:"",engName:"",age:"",grade:"주니어",classType:"종일",academyStart:a1CI,academyEnd:a1CI?addDays(a1CI,2*7):"",academyWeeks:"2",photo:"O"}]);}
  function rmStudent(id:number){setStudents(students.filter(s=>s.id!==id));}
  function upStudent(id:number,f:string,v:string){
    setStudents(students.map(s=>{
      if(s.id!==id) return s;
      const next={...s,[f]:v};
      if(f==="academyWeeks"&&next.academyStart) next.academyEnd=addDays(next.academyStart,Number(v)*7);
      if(f==="academyStart"&&next.academyWeeks) next.academyEnd=addDays(v,Number(next.academyWeeks)*7);
      return next;
    }));
  }

  /* ── 인보이스 생성 ── */
  function gen(){
    if(!booker.name){alert("예약자명을 입력해주세요.");return;}
    setPreview(true);setTimeout(()=>window.scrollTo({top:0,behavior:"smooth"}),100);
  }

  /* ── DB 저장 ── */
  async function saveToDb(){
    if(!bookingId){alert("예약 ID가 없습니다. 관리자 페이지에서 접근해주세요.");return;}
    const totalDiscount=billing.discounts.reduce((s,d)=>s+(Number(d.amount)||0),0);
    await supabase.from("bookings").update({
      status:"인보이스발행",
      booker_name:booker.name,
      booker_english:booker.englishName,
      students:JSON.stringify(students),
      base_price:billing.basePrice,
      billing_items:billing.items,
      discounts:billing.discounts,
      locals:billing.locals,
      total_discount:totalDiscount,
      final_price:billing.basePrice-totalDiscount,
      flight_in:checkin.flightIn,
      flight_out:checkin.flightOut,
      house_no:checkin.houseNo,
      pickup:checkin.pickup,
      drop_off:checkin.drop,
      pickup_place:checkin.pickupPlace,
      special_request:checkin.specialRequest,
      balance_date:booker.balanceDate||null,
      agency:adminOnly.agency,
      ssp:adminOnly.ssp,
      updated_at:new Date().toISOString(),
    }).eq("id",bookingId);
    alert("저장 완료!");
  }

  /* ── 이미지 저장 ── */
  async function saveAsImage(){
    const el=document.getElementById("invoice-content");
    if(!el) return;
    const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:"#ffffff"});
    const link=document.createElement("a");
    link.download="인보이스_"+(booker.name||"draft")+".png";
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  /* ── 영수증 발행 ── */
  function openReceipt(){
    const totalDiscount=billing.discounts.reduce((s,d)=>s+(Number(d.amount)||0),0);
    const finalPrice=billing.basePrice-totalDiscount;
    const payload={
      name:booker.name,englishName:booker.englishName,reservationNo,reservationDate,
      balanceDate:booker.balanceDate,
      accom:billing.items.length>0?billing.items[0].label:"",
      checkInDate:a1CI,checkOutDate:cm==="combo"?addDays(a1CI,(a1W+a2W)*7):addDays(a1CI,a1W*7),
      people:`보호자 ${cP}명 + 아이 ${cK}명`,houseNo:checkin.houseNo,
      pickup:checkin.pickup,drop:checkin.drop,pickupPlace:checkin.pickupPlace,
      flightIn:checkin.flightIn,flightOut:checkin.flightOut,
      packageType:billing.items.map(i=>i.label).join(" + "),
      basePrice:billing.basePrice,totalDiscount,finalPrice,
      students:students.map(s=>({korName:s.korName,engName:s.engName,age:s.age,grade:s.grade,classType:s.classType,academyStart:s.academyStart,academyEnd:s.academyEnd,academyWeeks:s.academyWeeks,photo:s.photo})),
      note:checkin.specialRequest,agency:adminOnly.agency,ssp:adminOnly.ssp,
      billingItems:billing.items,
      discounts:billing.discounts.filter(d=>d.name),
      locals:billing.locals.filter(l=>l.name&&l.amount),
    };
    sessionStorage.setItem("invoiceData",JSON.stringify(payload));
    window.open("/receipt"+(bookingId?"?id="+bookingId:""),"_blank");
  }

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}a{text-decoration:none;color:inherit;}
.fw{max-width:800px;margin:0 auto;padding:40px 24px 60px;}.fh{text-align:center;margin-bottom:32px;}.fh h1{font-size:28px;font-weight:800;margin-bottom:6px;}.fh p{font-size:14px;color:#6b7c93;}
.fs{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}.fs h2{font-size:16px;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #1a1a2e;display:flex;align-items:center;gap:8px;}
.fs-admin{background:#fff8e1;border:1px solid #f59e0b;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}.fs-admin h2{font-size:16px;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #f59e0b;display:flex;align-items:center;gap:8px;}
.admin-note{font-size:12px;color:#92400e;background:#fef3c7;padding:8px 12px;border-radius:6px;margin-bottom:16px;}
.f-row{display:flex;gap:12px;margin-bottom:12px;}.f-group{flex:1;}.f-label{display:block;font-size:11px;font-weight:600;color:#6b7c93;margin-bottom:4px;}
.f-input,.f-select,.f-textarea{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;}.f-input:focus,.f-select:focus,.f-textarea:focus{border-color:#1a6fc4;}.f-textarea{resize:vertical;min-height:60px;}.f-select{background:#fff;}.f-input.auto{background:#f0f7ff;border-color:#bfdbfe;color:#1a6fc4;font-weight:600;}
.mt{display:flex;gap:4px;background:#f1f5f9;border-radius:8px;padding:3px;margin-bottom:16px;}.mb{flex:1;padding:10px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 160ms;}.mb:hover{color:#1a1a2e;}.mb.ac{background:#1a6fc4;color:#fff;box-shadow:0 2px 6px rgba(26,111,196,0.3);}
.ab{padding:16px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;}.ab-l{font-size:12px;font-weight:700;color:#1a6fc4;margin-bottom:10px;}.cp{text-align:center;padding:4px 0;font-size:20px;font-weight:800;color:#1a6fc4;}
.er{padding:20px;background:#f0f7ff;border:1px solid #bfdbfe;border-radius:10px;margin-top:16px;}.erl{font-size:13px;color:#374151;margin-bottom:6px;line-height:1.6;}.erl strong{color:#1a1a2e;}.erl .dm{color:#94a3b8;font-size:12px;}
.ert{margin-top:12px;padding-top:12px;border-top:2px solid #1a6fc4;display:flex;justify-content:space-between;align-items:center;font-size:16px;font-weight:800;}.ert .pr{color:#1a6fc4;}
.sb{display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;margin-left:6px;}.sb.pk{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}.sb.of{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;}
.ba{width:100%;padding:12px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:12px;transition:background 160ms;}.ba:hover{background:#0d3d7a;}
.ex-box{padding:14px 16px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:12px;}.ex-title{font-size:11px;font-weight:600;color:#6b7c93;margin-bottom:8px;}.ex-row{display:flex;gap:12px;align-items:flex-end;}
.ne{padding:20px;text-align:center;color:#94a3b8;font-size:13px;background:#fafbfc;border:1px solid #e2e8f0;border-radius:10px;margin-top:16px;}
.dr{display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;}.dr .f-group{flex:2;}.dr .f-group:last-of-type{flex:1;}.bs{padding:6px 14px;font-size:12px;font-weight:700;border-radius:6px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.bd{background:#eaf3fb;color:#1a6fc4;border:1px solid #bfdbfe;}.bd:hover{background:#dbeafe;}.br{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:6px 10px;}.br:hover{background:#fee2e2;}
.bg{width:100%;padding:14px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:8px;}.bg:hover{background:#0d3d7a;}.bl{display:block;text-align:center;margin-top:16px;font-size:13px;color:#6b7c93;}.bl:hover{color:#1a6fc4;}
.sc{position:relative;padding:20px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:12px;}.sc-del{position:absolute;top:10px;right:10px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:6px;cursor:pointer;font-size:14px;font-weight:700;}.sc-del:hover{background:#fee2e2;}.sc-num{font-size:12px;font-weight:700;color:#1a6fc4;margin-bottom:12px;}
.f-hint{font-size:10px;color:#94a3b8;margin-top:2px;}
.iw{max-width:860px;margin:0 auto;padding:40px 24px 60px;}.iv{background:#fff;padding:48px 40px;box-shadow:0 2px 20px rgba(0,0,0,0.08);}
.it{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1a2e;}.il{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#1a1a2e;}.ils{font-size:11px;color:#6b7c93;font-weight:400;letter-spacing:0.05em;}.itr{text-align:right;}.itr h1{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:900;letter-spacing:0.08em;color:#1a6fc4;}.itr p{font-size:11px;color:#6b7c93;margin-top:2px;}
.is{margin-bottom:28px;}.ist{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;}
.tb{width:100%;border-collapse:collapse;}.tb th{font-size:11px;font-weight:700;color:#6b7c93;padding:8px 12px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;}.tb td{font-size:13px;padding:10px 12px;border:1px solid #e2e8f0;color:#1a1a2e;}.tb .lb{font-weight:600;background:#fafbfc;width:28%;color:#374151;font-size:12px;}.tb .dc{color:#dc2626;font-weight:600;}.tb .tr td{font-weight:800;font-size:14px;background:#f0f7ff;}.tb .fr td{font-weight:800;font-size:15px;background:#1a6fc4;color:#fff;}
.ift{margin-top:32px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#6b7c93;line-height:1.8;word-break:keep-all;}
.pb{display:flex;gap:10px;justify-content:center;margin-top:24px;}.pp{padding:12px 32px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pp:hover{background:#0d3d7a;}.prc{padding:12px 32px;background:#16a34a;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.prc:hover{background:#15803d;}.psv{padding:12px 32px;background:#64748b;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.psv:hover{background:#475569;}.pci{padding:8px 20px;background:#fff;color:#6b7c93;font-size:12px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:8px;}.pci:hover{background:#f1f5f9;color:#1a1a2e;}.pbk{padding:12px 32px;background:#f1f5f9;color:#1a1a2e;font-size:14px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}.pbk:hover{background:#e2e8f0;}
@media print{body{background:#fff!important;}.no-print{display:none!important;}.iw{padding:0!important;}.iv{box-shadow:none!important;padding:24px!important;}}
@media(max-width:600px){.fw{padding:20px 12px 40px;}.f-row{flex-direction:column;gap:8px;}.it{flex-direction:column;gap:12px;}.iv{padding:24px 12px;}.dr{flex-direction:column;gap:8px;}.ex-row{flex-direction:column;gap:8px;align-items:stretch;}.ex-row .f-group{flex:1!important;}.pb{flex-direction:column;gap:8px;align-items:stretch;}.pb button{width:100%;}.iw{padding:20px 8px 40px;}.is table{display:block;overflow-x:auto;-webkit-overflow-scrolling:touch;}.ba,.bg,.bs,.pp,.psv,.prc,.pbk,.pci,button{min-height:44px;}.fs,.fs-admin{padding:16px 12px;}}
  `}</style>

  {!preview?(<div className="fw"><div style={{marginBottom:"12px"}}><button style={{background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0",padding:"8px 16px",fontSize:"13px",fontWeight:600,borderRadius:"8px",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={()=>window.location.href="/admin"}>← 예약 목록</button></div><div className="fh"><h1>인보이스 생성</h1><p>숙소를 선택하면 시즌 요금이 자동 계산됩니다.</p></div>

  {/* ── 섹션1: 패키지 견적 (기존 UI 100% 유지) ── */}
  <div className="fs"><h2>패키지 견적 계산</h2>
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
      {rSel(a2T,setA2T,a2R,setA2R,a2W,setA2W,a2CI,null,a2CO,"숙소 B")}
      <div className="ex-box"><div className="ex-title">숙소 B 추가 인원 (1주일 고정 · {fmt(extraRate(a2T))}원/인)</div><div className="ex-row"><div className="f-group" style={{flex:"0 0 140px"}}><label className="f-label">추가 인원</label><select className="f-select" value={ex2Cnt} onChange={e=>setEx2Cnt(Number(e.target.value))}><option value={0}>0명</option><option value={1}>1명</option><option value={2}>2명</option></select></div>{ex2Cnt>0&&<div style={{fontSize:"13px",fontWeight:700,color:"#1a6fc4",paddingBottom:"2px"}}>+{fmt(extraRate(a2T)*ex2Cnt)}원</div>}</div></div>
    </>)}

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
  </div>

  {/* ── 섹션2: 예약자 정보 ── */}
  <div className="fs"><h2>예약자 정보</h2>
    <div className="f-row"><div className="f-group"><label className="f-label">예약번호</label><input className="f-input auto" value={reservationNo} readOnly/></div><div className="f-group"><label className="f-label">예약일</label><input className="f-input" type="date" value={reservationDate} onChange={e=>setReservationDate(e.target.value)}/></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">예약자 한글이름</label><input className="f-input" placeholder="홍길동" value={booker.name} onChange={e=>setBooker({...booker,name:e.target.value})}/></div><div className="f-group"><label className="f-label">예약자 영문이름</label><input className="f-input" placeholder="HONG GILDONG" value={booker.englishName} onChange={e=>setBooker({...booker,englishName:e.target.value})}/></div></div>
    <div className="f-row"><div className="f-group"><label className="f-label">잔금 납부 예정일</label><input className="f-input" type="date" value={booker.balanceDate} onChange={e=>setBooker({...booker,balanceDate:e.target.value})}/></div><div className="f-group"></div></div>
  </div>

  {/* ── 섹션3: 학생 정보 ── */}
  <div className="fs"><h2>학생 정보</h2>
    {students.map((s,idx)=>(
      <div className="sc" key={s.id}>
        {students.length>1&&<button className="sc-del" onClick={()=>rmStudent(s.id)}>X</button>}
        <div className="sc-num">학생 {idx+1}</div>
        <div className="f-row"><div className="f-group"><label className="f-label">한글이름</label><input className="f-input" placeholder="홍민준" value={s.korName} onChange={e=>upStudent(s.id,"korName",e.target.value)}/></div><div className="f-group"><label className="f-label">영문이름</label><input className="f-input" placeholder="HONG MINJUN" value={s.engName} onChange={e=>upStudent(s.id,"engName",e.target.value.toUpperCase())}/></div></div>
        <div className="f-row"><div className="f-group"><label className="f-label">나이</label><input className="f-input" type="number" value={s.age} onChange={e=>upStudent(s.id,"age",e.target.value)}/></div><div className="f-group"><label className="f-label">킨더/주니어</label><select className="f-select" value={s.grade} onChange={e=>upStudent(s.id,"grade",e.target.value)}><option value="킨더">킨더</option><option value="주니어">주니어</option></select></div><div className="f-group"><label className="f-label">오전/종일</label><select className="f-select" value={s.classType} onChange={e=>upStudent(s.id,"classType",e.target.value)}><option value="오전">오전</option><option value="종일">종일</option></select></div></div>
        <div className="f-row"><div className="f-group"><label className="f-label">아카데미 시작일</label><input className="f-input" type="date" value={s.academyStart} onChange={e=>upStudent(s.id,"academyStart",e.target.value)}/></div><div className="f-group"><label className="f-label">기간</label><select className="f-select" value={s.academyWeeks} onChange={e=>upStudent(s.id,"academyWeeks",e.target.value)}>{Array.from({length:11},(_,i)=>i+2).map(v=><option key={v} value={v}>{v}주</option>)}</select></div><div className="f-group"><label className="f-label">아카데미 종료일</label><input className="f-input auto" type="date" value={s.academyEnd} readOnly/></div></div>
        <div className="f-row"><div className="f-group"><label className="f-label">사진촬영 허용</label><select className="f-select" value={s.photo} onChange={e=>upStudent(s.id,"photo",e.target.value)}><option value="O">O</option><option value="X">X</option></select><div className="f-hint">인스타그램 등 SNS 활용 / 미허용 시 별도 사진 제공 없음</div></div></div>
      </div>
    ))}
    {students.length<6&&<button className="bs bd" onClick={addStudent}>+ 학생 추가</button>}
  </div>

  {/* ── 섹션4: 결제 정보 ── */}
  <div className="fs"><h2>결제 정보</h2>
    {billing.items.length>0?(<div style={{marginBottom:"14px"}}>{billing.items.map((item,i)=><div key={i} style={{fontSize:"13px",color:"#374151",marginBottom:"4px"}}>{item.label} ({item.season}): <strong style={{color:"#1a6fc4"}}>{fmt(item.price)}원</strong></div>)}<div style={{fontSize:"14px",fontWeight:800,marginTop:"8px"}}>합계: {fmt(billing.basePrice)}원</div></div>):(<div className="f-row"><div className="f-group"><label className="f-label">패키지 금액 (원)</label><input className="f-input" type="number" value={billing.basePrice||""} onChange={e=>setBilling(b=>({...b,basePrice:Number(e.target.value),items:[]}))}/></div></div>)}
    <label className="f-label" style={{marginTop:"12px",marginBottom:"8px"}}>할인 항목</label>
    {billing.discounts.map(d=><div className="dr" key={d.id}><div className="f-group"><input className="f-input" placeholder="할인 이름" value={d.name} onChange={e=>upD(d.id,"name",e.target.value)}/></div><div className="f-group"><input className="f-input" type="number" placeholder="금액" value={d.amount||""} onChange={e=>upD(d.id,"amount",Number(e.target.value))}/></div><button className="bs br" onClick={()=>rmD(d.id)}>삭제</button></div>)}
    <button className="bs bd" onClick={addD}>+ 할인 추가</button>
    <label className="f-label" style={{marginTop:"16px",marginBottom:"8px"}}>현지 지불 항목 <span style={{fontSize:"10px",color:"#94a3b8",fontWeight:400}}>단위: 페소(PHP)</span></label>
    {billing.locals.map(c=><div className="dr" key={c.id}><div className="f-group"><input className="f-input" placeholder="항목명" value={c.name} onChange={e=>upL(c.id,"name",e.target.value)}/></div><div className="f-group"><input className="f-input" placeholder="금액 (예: 7,000 pesos)" value={c.amount} onChange={e=>upL(c.id,"amount",e.target.value)}/>{c.name==="드림하우스 보증금"&&<div className="f-hint">(1주 × 2,000페소 자동계산)</div>}</div><button className="bs br" onClick={()=>rmL(c.id)}>삭제</button></div>)}
    <button className="bs bd" onClick={addL}>+ 현지 지불 항목 추가</button>
    {a1CI&&(<div style={{marginTop:"14px",padding:"12px 14px",borderRadius:"8px",background:isFullPayment?"#fef2f2":"#f0f7ff",border:isFullPayment?"1px solid #fecaca":"1px solid #bfdbfe",fontSize:"13px"}}>{isFullPayment?(<span style={{color:"#dc2626",fontWeight:700}}>⚠️ 전액 입금 — 체크인이 2달 미만입니다. 전체 금액({fmt(fp)}원)을 납부해 주세요.</span>):(<><div style={{marginBottom:"4px"}}><strong>예약금:</strong> 1,000,000원</div><div style={{marginBottom:"4px"}}><strong>잔금:</strong> {fmt(fp>1000000?fp-1000000:0)}원{booker.balanceDate?` (납부일: ${booker.balanceDate})`:""}</div><div style={{color:"#6b7c93",fontSize:"11px",marginTop:"6px"}}>※ 예약금 입금 후 예약 확정, 잔금은 입실 2달 전까지 납부</div></>)}</div>)}
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
  <a href="/" className="bl">← 홈으로 돌아가기</a>
  </div>):(

  /* ── 인보이스 미리보기 ── */
  <div className="iw">
    <div className="iv" id="invoice-content">
      <div className="it"><div><div className="il">DREAM COMPANY</div><div className="ils">Philippines</div></div><div className="itr"><h1>INVOICE</h1><p>No. {reservationNo}</p></div></div>

      <div className="is"><div className="ist">Customer Information</div><table className="tb"><tbody>
        <tr><td className="lb">예약자명</td><td>{booker.name}</td><td className="lb">영문이름</td><td>{booker.englishName}</td></tr>
        <tr><td className="lb">예약번호</td><td>{reservationNo}</td><td className="lb">예약일</td><td>{reservationDate}</td></tr>
        <tr><td className="lb">체크인</td><td>{overallCI}</td><td className="lb">체크아웃</td><td>{overallCO}</td></tr>
        <tr><td className="lb">패키지</td><td>{billing.items.map(i=>i.label).join(" + ")||"수동입력"}</td><td className="lb">인원 구성</td><td>보호자 {cP}명 + 아이 {cK}명</td></tr>
        <tr><td className="lb">잔금납부일</td><td colSpan={3}>{booker.balanceDate||"미정"}</td></tr>
      </tbody></table></div>

      <div className="is"><div className="ist">Student Information</div><table className="tb"><thead><tr><th>이름(한글)</th><th>영문이름</th><th>나이</th><th>킨더/주니어</th><th>오전/종일</th><th>아카데미 기간</th><th>사진허용</th></tr></thead><tbody>
        {students.map((s,i)=><tr key={i}><td>{s.korName}</td><td>{s.engName}</td><td>{s.age}</td><td>{s.grade}</td><td>{s.classType}</td><td>{s.academyStart?`${fmtDate(s.academyStart)}~${fmtDate(s.academyEnd)} (${s.academyWeeks}주)`:s.academyWeeks+"주"}</td><td>{s.photo}</td></tr>)}
      </tbody></table></div>

      <div className="is"><div className="ist">Billing Details</div><table className="tb"><thead><tr><th style={{width:"60%"}}>항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
        {billing.items.length>0?billing.items.map((item,i)=><tr key={i}><td>{item.label}{item.season?` (${item.season})`:""}</td><td style={{textAlign:"right"}}>{fmt(item.price)}원</td></tr>):<tr><td>패키지 금액</td><td style={{textAlign:"right"}}>{fmt(billing.basePrice)}원</td></tr>}
        {billing.discounts.filter(d=>d.name).map((d,i)=><tr key={i}><td className="dc">↓ {d.name}</td><td className="dc" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>)}
        {td>0&&<tr className="tr"><td>총 할인</td><td style={{textAlign:"right",color:"#dc2626"}}>-{fmt(td)}원</td></tr>}
        <tr className="fr"><td>전체 금액</td><td style={{textAlign:"right"}}>{fmt(fp)}원</td></tr>
        {fp>0&&(isFullPayment?<tr style={{background:"#fef2f2"}}><td colSpan={2} style={{padding:"10px 12px",fontWeight:700,color:"#dc2626",fontSize:"13px",textAlign:"center"}}>⚠️ 입실 2달 미만 — 전액 {fmt(fp)}원을 즉시 납부해 주세요.</td></tr>:<><tr style={{background:"#f0fdf4"}}><td style={{padding:"10px 12px",fontWeight:700,color:"#166534"}}>예약금 (입금 시 예약 확정)</td><td style={{textAlign:"right",padding:"10px 12px",fontWeight:700,color:"#166534"}}>1,000,000원</td></tr><tr><td style={{padding:"10px 12px",fontSize:"13px",color:"#374151"}}>잔금 (납부일: {booker.balanceDate||"입실 2달 전"})</td><td style={{textAlign:"right",padding:"10px 12px",fontSize:"13px",fontWeight:600}}>{fmt(fp>1000000?fp-1000000:0)}원</td></tr><tr><td colSpan={2} style={{padding:"8px 12px",fontSize:"11px",color:"#6b7c93",background:"#f8fafc"}}>※ 예약금 1,000,000원 입금 후 예약이 확정되며, 잔금은 입실 2달 전까지 납부해 주세요.</td></tr></>)}
      </tbody></table>
      {billing.locals.filter(c=>c.name&&c.amount).length>0&&<table className="tb" style={{marginTop:"12px"}}><thead><tr><th style={{width:"60%"}}>현지 지불 항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>{billing.locals.filter(c=>c.name&&c.amount).map((c,i)=><tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{c.amount}{(c.name.includes("SSP")||c.name.includes("보증금"))?" 페소":""}</td></tr>)}</tbody></table>}</div>

      <div className="is"><div className="ist">Check-in Details</div><table className="tb"><tbody>
        <tr><td className="lb">픽업</td><td>{checkin.pickup}</td><td className="lb">드롭</td><td>{checkin.drop}</td></tr>
        <tr><td className="lb">픽업 장소</td><td>{checkin.pickupPlace||"미정"}</td><td className="lb">하우스 번호</td><td>{checkin.houseNo||"미정"}</td></tr>
        <tr><td className="lb">항공편 (IN)</td><td>{checkin.flightIn||"미정"}</td><td className="lb">항공편 (OUT)</td><td>{checkin.flightOut||"미정"}</td></tr>
        {checkin.specialRequest&&<tr><td className="lb">특별 요청</td><td colSpan={3} style={{whiteSpace:"pre-wrap"}}>{checkin.specialRequest}</td></tr>}
      </tbody></table>
      <div className="no-print" style={{textAlign:"right",marginTop:"8px"}}><button className="pci" onClick={()=>{setPreview(false);setTimeout(()=>document.getElementById("checkin-section")?.scrollIntoView({behavior:"smooth"}),100);}}>체크인 정보 수정</button></div></div>

      <div className="ift">안내받으신 총합안내 이용금액 및 환불규정을 꼭 확인 해 주세요.<br/>미확인으로 인한 문제는 책임지지 않습니다.<br/>추가 요청사항이 있다면 추후 안내 부탁드립니다.<br/>해당 청구서에 대한 문의사항이 있으시면 드림아카데미로 문의주세요.<br/>감사합니다.</div>
    </div>
    <div className="pb no-print"><button className="pbk" style={{background:"#fff",color:"#6b7c93",border:"1px solid #e2e8f0"}} onClick={()=>window.location.href="/admin"}>← 예약 목록</button><button className="pp" onClick={()=>window.print()}>PDF 저장 / 인쇄</button><button style={{padding:"12px 32px",background:"#7c3aed",color:"#fff",fontSize:"14px",fontWeight:700,border:"none",borderRadius:"8px",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}} onClick={saveAsImage}>📷 이미지 저장</button><button className="prc" onClick={openReceipt}>영수증 발행</button>{bookingId&&<button className="psv" onClick={saveToDb}>저장하기</button>}<button className="pbk" onClick={()=>setPreview(false)}>수정하기</button></div>
  </div>)}
  </>);
}
