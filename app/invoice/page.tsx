"use client";
import { useState, useEffect } from "react";

// ── 시즌 판별 ──
function isPeakSeason(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  if (m === 7 && day >= 15) return true;
  if (m === 8) return true;
  if (m === 12 && day >= 15) return true;
  if (m === 1 || m === 2) return true;
  return false;
}

// ── 드림하우스 [weeks-parents-kids] = [정가, 비수기, 성수기] ──
const DH: Record<string, [number, number, number]> = {
"2-1-2":[4970000,3970000,4470000],"2-2-2":[5550000,4440000,4990000],"2-3-2":[6140000,4910000,5520000],
"3-1-2":[7190000,5750000,6470000],"3-2-2":[8010000,6400000,7200000],"3-3-2":[8840000,7070000,7950000],
"4-1-2":[8950000,7160000,8050000],"4-2-2":[10010000,8000000,9000000],"4-3-2":[11080000,8860000,9970000],
"5-1-2":[11150000,8920000,10030000],"5-2-2":[12460000,9960000,11210000],"5-3-2":[13770000,11010000,12390000],
"6-1-2":[13360000,10680000,12020000],"6-2-2":[14910000,11920000,13410000],"6-3-2":[16460000,13160000,14810000],
"7-1-2":[15570000,12450000,14010000],"7-2-2":[17360000,13880000,15620000],"7-3-2":[19150000,15320000,17230000],
"8-1-2":[17800000,14240000,16020000],"8-2-2":[19830000,15860000,17840000],"8-3-2":[21860000,17480000,19670000],
"9-1-2":[20010000,16000000,18000000],"9-2-2":[22280000,17820000,20050000],"9-3-2":[24550000,19640000,22090000],
"10-1-2":[22220000,17770000,19990000],"10-2-2":[24740000,19790000,22260000],"10-3-2":[27250000,21800000,24520000],
"11-1-2":[24440000,19550000,21990000],"11-2-2":[27190000,21750000,24470000],"11-3-2":[29940000,23950000,26940000],
"12-1-2":[26650000,21320000,23980000],"12-2-2":[29640000,23710000,26670000],"12-3-2":[32640000,26110000,29370000],
};

// ── 제이파크 [룸-weeks-parents-kids] = [정가, 비수기, 성수기] ──
const JP: Record<string, [number, number, number]> = {
"디럭스-2-1-1":[5560000,4440000,5000000],"디럭스-2-1-2":[7040000,5630000,6330000],"디럭스-2-2-1":[6140000,4910000,5520000],"디럭스-2-1-3":[8530000,6820000,7670000],"디럭스-2-2-2":[7630000,6100000,6860000],
"프리미어-2-1-1":[5700000,4560000,5130000],"프리미어-2-1-2":[7180000,5740000,6460000],"프리미어-2-2-1":[6280000,5020000,5650000],"프리미어-2-1-3":[8670000,6930000,7800000],"프리미어-2-2-2":[7770000,6210000,6990000],
"막탄스윗-2-1-1":[6260000,5000000,5630000],"막탄스윗-2-1-2":[7740000,6190000,6960000],"막탄스윗-2-2-1":[6840000,5470000,6150000],"막탄스윗-2-1-3":[9230000,7380000,8300000],"막탄스윗-2-2-2":[8330000,6660000,7490000],
"디럭스-3-1-1":[8180000,6540000,7360000],"디럭스-3-1-2":[10300000,8240000,9270000],"디럭스-3-2-1":[9010000,7200000,8100000],"디럭스-3-1-3":[12410000,9920000,11160000],"디럭스-3-2-2":[11120000,8890000,10000000],
"프리미어-3-1-1":[8390000,6710000,7550000],"프리미어-3-1-2":[10510000,8400000,9450000],"프리미어-3-2-1":[9220000,7370000,8290000],"프리미어-3-1-3":[12620000,10090000,11350000],"프리미어-3-2-2":[11330000,9060000,10190000],
"막탄스윗-3-1-1":[9230000,7380000,8300000],"막탄스윗-3-1-2":[11350000,9080000,10210000],"막탄스윗-3-2-1":[10060000,8040000,9050000],"막탄스윗-3-1-3":[13460000,10760000,12110000],"막탄스윗-3-2-2":[12170000,9730000,10950000],
"디럭스-4-1-1":[10720000,8570000,9640000],"디럭스-4-1-2":[13370000,10690000,12030000],"디럭스-4-2-1":[11780000,9420000,10600000],"디럭스-4-1-3":[16030000,12820000,14420000],"디럭스-4-2-2":[14440000,11550000,12990000],
"프리미어-4-1-1":[11000000,8800000,9900000],"프리미어-4-1-2":[13650000,10920000,12280000],"프리미어-4-2-1":[12060000,9640000,10850000],"프리미어-4-1-3":[16310000,13040000,14670000],"프리미어-4-2-2":[14720000,11770000,13240000],
"막탄스윗-4-1-1":[12120000,9690000,10900000],"막탄스윗-4-1-2":[14770000,11810000,13290000],"막탄스윗-4-2-1":[13180000,10540000,11860000],"막탄스윗-4-1-3":[17430000,13940000,15680000],"막탄스윗-4-2-2":[15840000,12670000,14250000],
"디럭스-5-1-1":[13370000,10690000,12030000],"디럭스-5-1-2":[16680000,13340000,15010000],"디럭스-5-2-1":[14670000,11730000,13200000],"디럭스-5-1-3":[20000000,16000000,18000000],"디럭스-5-2-2":[17990000,14390000,16190000],
"프리미어-5-1-1":[13720000,10970000,12340000],"프리미어-5-1-2":[17030000,13620000,15320000],"프리미어-5-2-1":[15020000,12010000,13510000],"프리미어-5-1-3":[20350000,16280000,18310000],"프리미어-5-2-2":[18340000,14670000,16500000],
"막탄스윗-5-1-1":[15120000,12090000,13600000],"막탄스윗-5-1-2":[18430000,14740000,16580000],"막탄스윗-5-2-1":[16420000,13130000,14770000],"막탄스윗-5-1-3":[21750000,17400000,19570000],"막탄스윗-5-2-2":[19740000,15790000,17760000],
"디럭스-6-1-1":[16020000,12810000,14410000],"디럭스-6-1-2":[20000000,16000000,18000000],"디럭스-6-2-1":[17570000,14050000,15810000],"디럭스-6-1-3":[23980000,19180000,21580000],"디럭스-6-2-2":[21550000,17240000,19390000],
"프리미어-6-1-1":[16440000,13150000,14790000],"프리미어-6-1-2":[20420000,16330000,18370000],"프리미어-6-2-1":[17990000,14390000,16190000],"프리미어-6-1-3":[24400000,19520000,21960000],"프리미어-6-2-2":[21970000,17570000,19770000],
"막탄스윗-6-1-1":[18120000,14490000,16300000],"막탄스윗-6-1-2":[22100000,17680000,19890000],"막탄스윗-6-2-1":[19670000,15730000,17700000],"막탄스윗-6-1-3":[26080000,20860000,23470000],"막탄스윗-6-2-2":[23650000,18920000,21280000],
"디럭스-7-1-1":[18670000,14930000,16800000],"디럭스-7-1-2":[23310000,18640000,20970000],"디럭스-7-2-1":[20460000,16360000,18410000],"디럭스-7-1-3":[27950000,22360000,25150000],"디럭스-7-2-2":[25100000,20080000,22590000],
"프리미어-7-1-1":[19160000,15320000,17240000],"프리미어-7-1-2":[23800000,19040000,21420000],"프리미어-7-2-1":[20950000,16760000,18850000],"프리미어-7-1-3":[28440000,22750000,25590000],"프리미어-7-2-2":[25590000,20470000,23030000],
"막탄스윗-7-1-1":[21120000,16890000,19000000],"막탄스윗-7-1-2":[25760000,20600000,23180000],"막탄스윗-7-2-1":[22910000,18320000,20610000],"막탄스윗-7-1-3":[30400000,24320000,27360000],"막탄스윗-7-2-2":[27550000,22040000,24790000],
"디럭스-8-1-1":[21340000,17070000,19200000],"디럭스-8-1-2":[26650000,21320000,23980000],"디럭스-8-2-1":[23370000,18690000,21030000],"디럭스-8-1-3":[31960000,25560000,28760000],"디럭스-8-2-2":[28680000,22940000,25810000],
"프리미어-8-1-1":[21900000,17520000,19710000],"프리미어-8-1-2":[27210000,21760000,24480000],"프리미어-8-2-1":[23930000,19140000,21530000],"프리미어-8-1-3":[32520000,26010000,29260000],"프리미어-8-2-2":[29240000,23390000,26310000],
"막탄스윗-8-1-1":[24140000,19310000,21720000],"막탄스윗-8-1-2":[29450000,23560000,26500000],"막탄스윗-8-2-1":[26170000,20930000,23550000],"막탄스윗-8-1-3":[34760000,27800000,31280000],"막탄스윗-8-2-2":[31480000,25180000,28330000],
"디럭스-9-1-1":[23990000,19190000,21590000],"디럭스-9-1-2":[29960000,23960000,26960000],"디럭스-9-2-1":[26260000,21000000,23630000],"디럭스-9-1-3":[35940000,28750000,32340000],"디럭스-9-2-2":[32240000,25790000,29010000],
"프리미어-9-1-1":[24620000,19690000,22150000],"프리미어-9-1-2":[30590000,24470000,27530000],"프리미어-9-2-1":[26890000,21510000,24200000],"프리미어-9-1-3":[36570000,29250000,32910000],"프리미어-9-2-2":[32870000,26290000,29580000],
"막탄스윗-9-1-1":[27140000,21710000,24420000],"막탄스윗-9-1-2":[33110000,26480000,29790000],"막탄스윗-9-2-1":[29410000,23520000,26460000],"막탄스윗-9-1-3":[39090000,31270000,35180000],"막탄스윗-9-2-2":[35390000,28310000,31850000],
"디럭스-10-1-1":[26650000,21320000,23980000],"디럭스-10-1-2":[33280000,26620000,29950000],"디럭스-10-2-1":[29160000,23320000,26240000],"디럭스-10-1-3":[39920000,31930000,35920000],"디럭스-10-2-2":[35800000,28640000,32220000],
"프리미어-10-1-1":[27350000,21880000,24610000],"프리미어-10-1-2":[33980000,27180000,30580000],"프리미어-10-2-1":[29860000,23880000,26870000],"프리미어-10-1-3":[40620000,32490000,36550000],"프리미어-10-2-2":[36500000,29200000,32850000],
"막탄스윗-10-1-1":[30150000,24120000,27130000],"막탄스윗-10-1-2":[36780000,29420000,33100000],"막탄스윗-10-2-1":[32660000,26120000,29390000],"막탄스윗-10-1-3":[43420000,34730000,39070000],"막탄스윗-10-2-2":[39300000,31440000,35370000],
"디럭스-11-1-1":[29300000,23440000,26370000],"디럭스-11-1-2":[36600000,29280000,32940000],"디럭스-11-2-1":[32050000,25640000,28840000],"디럭스-11-1-3":[43900000,35120000,39510000],"디럭스-11-2-2":[39360000,31480000,35420000],
"프리미어-11-1-1":[30070000,24050000,27060000],"프리미어-11-1-2":[37370000,29890000,33630000],"프리미어-11-2-1":[32820000,26250000,29530000],"프리미어-11-1-3":[44670000,35730000,40200000],"프리미어-11-2-2":[40130000,32100000,36110000],
"막탄스윗-11-1-1":[33150000,26520000,29830000],"막탄스윗-11-1-2":[40450000,32360000,36400000],"막탄스윗-11-2-1":[35900000,28720000,32310000],"막탄스윗-11-1-3":[47750000,38200000,42970000],"막탄스윗-11-2-2":[43210000,34560000,38880000],
"디럭스-12-1-1":[31960000,25560000,28760000],"디럭스-12-1-2":[39920000,31930000,35920000],"디럭스-12-2-1":[34950000,27960000,31450000],"디럭스-12-1-3":[47890000,38310000,43100000],"디럭스-12-2-2":[42920000,34330000,38620000],
"프리미어-12-1-1":[32800000,26240000,29520000],"프리미어-12-1-2":[40760000,32600000,36680000],"프리미어-12-2-1":[35790000,28630000,32210000],"프리미어-12-1-3":[48730000,38980000,43850000],"프리미어-12-2-2":[43760000,35000000,39380000],
"막탄스윗-12-1-1":[36160000,28920000,32540000],"막탄스윗-12-1-2":[44120000,35290000,39700000],"막탄스윗-12-2-1":[39150000,31320000,35230000],"막탄스윗-12-1-3":[52090000,41670000,46880000],"막탄스윗-12-2-2":[47120000,37690000,42400000],
};

// ── 큐브나인 [룸-weeks-parents-kids] = [정가, 비수기, 성수기] ──
const C9: Record<string, [number, number, number]> = {
"디럭스-2-1-1":[4630000,3700000,4160000],"디럭스-2-1-2":[5730000,4580000,5150000],"디럭스-2-2-1":[4830000,3860000,4340000],"디럭스-2-1-3":[6830000,5460000,6140000],"디럭스-2-2-2":[5930000,4740000,5330000],
"풀억세스룸-2-1-1":[5020000,4010000,4510000],"풀억세스룸-2-1-2":[6120000,4890000,5500000],"풀억세스룸-2-2-1":[5220000,4170000,4690000],"풀억세스룸-2-1-3":[7220000,5770000,6490000],"풀억세스룸-2-2-2":[6320000,5050000,5680000],
"디럭스-3-1-1":[6790000,5430000,6110000],"디럭스-3-1-2":[8330000,6660000,7490000],"디럭스-3-2-1":[7040000,5630000,6330000],"디럭스-3-1-3":[9870000,7890000,8880000],"디럭스-3-2-2":[8580000,6860000,7720000],
"풀억세스룸-3-1-1":[7380000,5900000,6640000],"풀억세스룸-3-1-2":[8920000,7130000,8020000],"풀억세스룸-3-2-1":[7630000,6100000,6860000],"풀억세스룸-3-1-3":[10460000,8360000,9410000],"풀억세스룸-3-2-2":[9170000,7330000,8250000],
"디럭스-4-1-1":[8860000,7080000,7970000],"디럭스-4-1-2":[10750000,8600000,9670000],"디럭스-4-2-1":[9160000,7320000,8240000],"디럭스-4-1-3":[12640000,10110000,11370000],"디럭스-4-2-2":[11050000,8840000,9940000],
"풀억세스룸-4-1-1":[9640000,7710000,8670000],"풀억세스룸-4-1-2":[11530000,9220000,10370000],"풀억세스룸-4-2-1":[9940000,7950000,8940000],"풀억세스룸-4-1-3":[13420000,10730000,12070000],"풀억세스룸-4-2-2":[11830000,9460000,10640000],
"디럭스-5-1-1":[11050000,8840000,9940000],"디럭스-5-1-2":[13410000,10720000,12060000],"디럭스-5-2-1":[11400000,9120000,10260000],"디럭스-5-1-3":[15770000,12610000,14190000],"디럭스-5-2-2":[13760000,11000000,12380000],
"풀억세스룸-5-1-1":[12030000,9620000,10820000],"풀억세스룸-5-1-2":[14390000,11510000,12950000],"풀억세스룸-5-2-1":[12380000,9900000,11140000],"풀억세스룸-5-1-3":[16750000,13400000,15070000],"풀억세스룸-5-2-2":[14740000,11790000,13260000],
"디럭스-6-1-1":[13230000,10580000,11900000],"디럭스-6-1-2":[16060000,12840000,14450000],"디럭스-6-2-1":[13630000,10900000,12260000],"디럭스-6-1-3":[18890000,15110000,17000000],"디럭스-6-2-2":[16460000,13160000,14810000],
"풀억세스룸-6-1-1":[14410000,11520000,12960000],"풀억세스룸-6-1-2":[17240000,13790000,15510000],"풀억세스룸-6-2-1":[14810000,11840000,13320000],"풀억세스룸-6-1-3":[20070000,16050000,18060000],"풀억세스룸-6-2-2":[17640000,14110000,15870000],
"디럭스-7-1-1":[15420000,12330000,13870000],"디럭스-7-1-2":[18720000,14970000,16840000],"디럭스-7-2-1":[15870000,12690000,14280000],"디럭스-7-1-3":[22020000,17610000,19810000],"디럭스-7-2-2":[19170000,15330000,17250000],
"풀억세스룸-7-1-1":[16790000,13430000,15110000],"풀억세스룸-7-1-2":[20090000,16070000,18080000],"풀억세스룸-7-2-1":[17240000,13790000,15510000],"풀억세스룸-7-1-3":[23390000,18710000,21050000],"풀억세스룸-7-2-2":[20540000,16430000,18480000],
"디럭스-8-1-1":[17620000,14090000,15850000],"디럭스-8-1-2":[21400000,17120000,19260000],"디럭스-8-2-1":[18120000,14490000,16300000],"디럭스-8-1-3":[25180000,20140000,22660000],"디럭스-8-2-2":[21900000,17520000,19710000],
"풀억세스룸-8-1-1":[19190000,15350000,17270000],"풀억세스룸-8-1-2":[22970000,18370000,20670000],"풀억세스룸-8-2-1":[19690000,15750000,17720000],"풀억세스룸-8-1-3":[26750000,21400000,24070000],"풀억세스룸-8-2-2":[23470000,18770000,21120000],
"디럭스-9-1-1":[19810000,15840000,17820000],"디럭스-9-1-2":[24060000,19240000,21650000],"디럭스-9-2-1":[20360000,16280000,18320000],"디럭스-9-1-3":[28310000,22640000,25470000],"디럭스-9-2-2":[24610000,19680000,22140000],
"풀억세스룸-9-1-1":[21570000,17250000,19410000],"풀억세스룸-9-1-2":[25830000,20660000,23240000],"풀억세스룸-9-2-1":[22120000,17690000,19900000],"풀억세스룸-9-1-3":[30080000,24060000,27070000],"풀억세스룸-9-2-2":[26380000,21100000,23740000],
"디럭스-10-1-1":[22000000,17600000,19800000],"디럭스-10-1-2":[26730000,21380000,24050000],"디럭스-10-2-1":[22600000,18080000,20340000],"디럭스-10-1-3":[31450000,25160000,28300000],"디럭스-10-2-2":[27330000,21860000,24590000],
"풀억세스룸-10-1-1":[23960000,19160000,21560000],"풀억세스룸-10-1-2":[28690000,22950000,25820000],"풀억세스룸-10-2-1":[24560000,19640000,22100000],"풀억세스룸-10-1-3":[33410000,26720000,30060000],"풀억세스룸-10-2-2":[29290000,23430000,26360000],
"디럭스-11-1-1":[24190000,19350000,21770000],"디럭스-11-1-2":[29390000,23510000,26450000],"디럭스-11-2-1":[24840000,19870000,22350000],"디럭스-11-1-3":[34590000,27670000,31130000],"디럭스-11-2-2":[30040000,24030000,27030000],
"풀억세스룸-11-1-1":[26350000,21080000,23710000],"풀억세스룸-11-1-2":[31540000,25230000,28380000],"풀억세스룸-11-2-1":[27000000,21600000,24300000],"풀억세스룸-11-1-3":[36740000,29390000,33060000],"풀억세스룸-11-2-2":[32190000,25750000,28970000],
"디럭스-12-1-1":[26380000,21100000,23740000],"디럭스-12-1-2":[32050000,25640000,28840000],"디럭스-12-2-1":[27080000,21660000,24370000],"디럭스-12-1-3":[37720000,30170000,33940000],"디럭스-12-2-2":[32750000,26200000,29470000],
"풀억세스룸-12-1-1":[28730000,22980000,25850000],"풀억세스룸-12-1-2":[34400000,27520000,30960000],"풀억세스룸-12-2-1":[29430000,23540000,26480000],"풀억세스룸-12-1-3":[40070000,32050000,36060000],"풀억세스룸-12-2-2":[35100000,28080000,31590000],
};

type AccomType = "" | "dreamhouse" | "jpark" | "cubenine";
const accomLabels: Record<string, string> = { dreamhouse: "드림하우스", jpark: "제이파크", cubenine: "큐브나인" };

interface Discount { id: number; name: string; amount: number; }
interface LocalCharge { id: number; name: string; amount: string; }

function fmt(n: number) { return n.toLocaleString("ko-KR"); }

export default function InvoicePage() {
  // 견적 계산기
  const [accom, setAccom] = useState<AccomType>("");
  const [roomType, setRoomType] = useState("");
  const [weeks, setWeeks] = useState(2);
  const [parents, setParents] = useState(1);
  const [kids, setKids] = useState(2);

  // 고객
  const [customer, setCustomer] = useState({
    name: "", reservationNo: "", reservationDate: "", checkInDate: "", checkInTime: "15:00",
    checkOutDate: "", checkOutTime: "12:00", packageType: "", people: "", englishName: "",
  });
  // 결제
  const [billing, setBilling] = useState({ basePrice: 0 });
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [localCharges, setLocalCharges] = useState<LocalCharge[]>([]);
  // 체크인
  const [checkIn, setCheckIn] = useState({
    pickup: "O", drop: "O", flightIn: "", flightOut: "", bedSetting: "", usim: "", houseNo: "", specialRequest: "",
  });
  const [showPreview, setShowPreview] = useState(false);

  // 견적 자동 계산
  useEffect(() => {
    if (!accom) return;
    const peak = isPeakSeason(customer.checkInDate);
    let key = "";
    let label = "";
    if (accom === "dreamhouse") {
      key = `${weeks}-${parents}-${kids}`;
      label = `드림하우스 ${weeks}주`;
      const entry = DH[key];
      if (entry) {
        setBilling({ basePrice: peak ? entry[2] : entry[1] });
      }
    } else if (accom === "jpark") {
      key = `${roomType}-${weeks}-${parents}-${kids}`;
      label = `제이파크 ${roomType} ${weeks}주`;
      const entry = JP[key];
      if (entry) {
        setBilling({ basePrice: peak ? entry[2] : entry[1] });
      }
    } else if (accom === "cubenine") {
      key = `${roomType}-${weeks}-${parents}-${kids}`;
      label = `큐브나인 ${roomType} ${weeks}주`;
      const entry = C9[key];
      if (entry) {
        setBilling({ basePrice: peak ? entry[2] : entry[1] });
      }
    }
    setCustomer((c) => ({
      ...c,
      packageType: label,
      people: `보호자 ${parents}명 + 아이 ${kids}명`,
    }));
  }, [accom, roomType, weeks, parents, kids, customer.checkInDate]);

  function maxWeeks() { return accom === "dreamhouse" ? 12 : accom === "jpark" ? 12 : 12; }
  function maxPeople() { return accom === "dreamhouse" ? 6 : 4; }

  function addDiscount() { setDiscounts([...discounts, { id: Date.now(), name: "", amount: 0 }]); }
  function removeDiscount(id: number) { setDiscounts(discounts.filter((d) => d.id !== id)); }
  function updateDiscount(id: number, f: string, v: string | number) { setDiscounts(discounts.map((d) => d.id === id ? { ...d, [f]: v } : d)); }
  function addLocalCharge() { setLocalCharges([...localCharges, { id: Date.now(), name: "", amount: "" }]); }
  function removeLocalCharge(id: number) { setLocalCharges(localCharges.filter((c) => c.id !== id)); }
  function updateLocalCharge(id: number, f: string, v: string) { setLocalCharges(localCharges.map((c) => c.id === id ? { ...c, [f]: v } : c)); }

  const totalDiscount = discounts.reduce((s, d) => s + (Number(d.amount) || 0), 0);
  const finalPrice = billing.basePrice - totalDiscount;
  const season = isPeakSeason(customer.checkInDate) ? "성수기" : "비수기";

  function handleGenerate() {
    if (!customer.name) { alert("예약자명을 입력해주세요."); return; }
    setShowPreview(true);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  }

  return (
    <>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
        a{text-decoration:none;color:inherit;}
        .form-wrap{max-width:800px;margin:0 auto;padding:40px 24px 60px;}
        .form-header{text-align:center;margin-bottom:32px;}
        .form-header h1{font-size:28px;font-weight:800;margin-bottom:6px;}
        .form-header p{font-size:14px;color:#6b7c93;}
        .form-section{background:#fff;border-radius:14px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px;}
        .form-section h2{font-size:16px;font-weight:800;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid #1a1a2e;display:flex;align-items:center;gap:8px;}
        .f-row{display:flex;gap:12px;margin-bottom:12px;}
        .f-group{flex:1;}
        .f-label{display:block;font-size:11px;font-weight:600;color:#6b7c93;margin-bottom:4px;}
        .f-input,.f-select,.f-textarea{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;}
        .f-input:focus,.f-select:focus,.f-textarea:focus{border-color:#1a6fc4;}
        .f-textarea{resize:vertical;min-height:60px;}
        .f-select{background:#fff;}
        .f-input.auto{background:#f0f7ff;border-color:#bfdbfe;color:#1a6fc4;font-weight:600;}
        .season-badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;margin-left:8px;}
        .season-badge.peak{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}
        .season-badge.off{background:#ecfdf5;color:#059669;border:1px solid #a7f3d0;}
        .disc-row{display:flex;gap:8px;align-items:flex-end;margin-bottom:8px;}
        .disc-row .f-group{flex:2;}
        .disc-row .f-group:last-of-type{flex:1;}
        .btn-sm{padding:6px 14px;font-size:12px;font-weight:700;border-radius:6px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-add{background:#eaf3fb;color:#1a6fc4;border:1px solid #bfdbfe;}
        .btn-add:hover{background:#dbeafe;}
        .btn-rm{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;padding:6px 10px;}
        .btn-rm:hover{background:#fee2e2;}
        .btn-generate{width:100%;padding:14px;background:#1a6fc4;color:#fff;font-size:15px;font-weight:700;border:none;border-radius:10px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-top:8px;}
        .btn-generate:hover{background:#0d3d7a;}
        .back-link{display:block;text-align:center;margin-top:16px;font-size:13px;color:#6b7c93;}
        .back-link:hover{color:#1a6fc4;}
        .invoice-wrap{max-width:800px;margin:0 auto;padding:40px 24px 60px;}
        .invoice{background:#fff;padding:48px 40px;box-shadow:0 2px 20px rgba(0,0,0,0.08);}
        .inv-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:32px;padding-bottom:20px;border-bottom:3px solid #1a1a2e;}
        .inv-logo{font-family:'Montserrat',sans-serif;font-size:22px;font-weight:900;color:#1a1a2e;}
        .inv-logo-sub{font-size:11px;color:#6b7c93;font-weight:400;letter-spacing:0.05em;}
        .inv-title{text-align:right;}
        .inv-title h1{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:900;letter-spacing:0.08em;color:#1a6fc4;}
        .inv-title p{font-size:11px;color:#6b7c93;margin-top:2px;}
        .inv-section{margin-bottom:28px;}
        .inv-section-title{font-family:'Montserrat',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1a6fc4;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #e2e8f0;}
        .inv-table{width:100%;border-collapse:collapse;}
        .inv-table th{font-size:11px;font-weight:700;color:#6b7c93;padding:8px 12px;text-align:left;background:#f8fafc;border:1px solid #e2e8f0;}
        .inv-table td{font-size:13px;padding:10px 12px;border:1px solid #e2e8f0;color:#1a1a2e;}
        .inv-table .label{font-weight:600;background:#fafbfc;width:30%;color:#374151;font-size:12px;}
        .inv-table .discount{color:#dc2626;font-weight:600;}
        .inv-table .total-row td{font-weight:800;font-size:14px;background:#f0f7ff;}
        .inv-table .final-row td{font-weight:800;font-size:15px;background:#1a6fc4;color:#fff;}
        .inv-footer{margin-top:32px;padding:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#6b7c93;line-height:1.8;word-break:keep-all;}
        .print-btns{display:flex;gap:10px;justify-content:center;margin-top:24px;}
        .btn-print{padding:12px 32px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-print:hover{background:#0d3d7a;}
        .btn-back{padding:12px 32px;background:#f1f5f9;color:#1a1a2e;font-size:14px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
        .btn-back:hover{background:#e2e8f0;}
        @media print{body{background:#fff!important;}.no-print{display:none!important;}.invoice-wrap{padding:0!important;}.invoice{box-shadow:none!important;padding:24px!important;}}
        @media(max-width:600px){.f-row{flex-direction:column;gap:12px;}.inv-top{flex-direction:column;gap:12px;}.invoice{padding:24px 16px;}.disc-row{flex-direction:column;gap:8px;}}
      `}</style>

      {!showPreview ? (
        <div className="form-wrap">
          <div className="form-header">
            <h1>인보이스 생성</h1>
            <p>숙소를 선택하면 시즌 요금이 자동 계산됩니다.</p>
          </div>

          {/* 견적 계산기 */}
          <div className="form-section">
            <h2>패키지 견적 계산</h2>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">숙소</label>
                <select className="f-select" value={accom} onChange={(e) => { setAccom(e.target.value as AccomType); setRoomType(e.target.value === "jpark" ? "디럭스" : e.target.value === "cubenine" ? "디럭스" : ""); setWeeks(2); setParents(1); setKids(2); }}>
                  <option value="">선택안함 (직접 입력)</option>
                  <option value="dreamhouse">드림하우스</option>
                  <option value="jpark">제이파크</option>
                  <option value="cubenine">큐브나인</option>
                </select>
              </div>
              {(accom === "jpark" || accom === "cubenine") && (
                <div className="f-group">
                  <label className="f-label">룸타입</label>
                  <select className="f-select" value={roomType} onChange={(e) => setRoomType(e.target.value)}>
                    {accom === "jpark" ? <><option value="디럭스">디럭스</option><option value="프리미어">프리미어</option><option value="막탄스윗">막탄스윗</option></> : <><option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option></>}
                  </select>
                </div>
              )}
            </div>
            {accom && (
              <div className="f-row">
                <div className="f-group">
                  <label className="f-label">기간</label>
                  <select className="f-select" value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
                    {Array.from({ length: maxWeeks() - 1 }, (_, i) => i + 2).map((w) => <option key={w} value={w}>{w}주</option>)}
                  </select>
                </div>
                <div className="f-group">
                  <label className="f-label">보호자</label>
                  <select className="f-select" value={parents} onChange={(e) => { const p = Number(e.target.value); setParents(p); setKids(Math.min(kids, maxPeople() - p)); }}>
                    {[1, 2, 3].filter((p) => p < maxPeople()).map((p) => <option key={p} value={p}>{p}명</option>)}
                  </select>
                </div>
                <div className="f-group">
                  <label className="f-label">아이</label>
                  <select className="f-select" value={kids} onChange={(e) => setKids(Number(e.target.value))}>
                    {Array.from({ length: maxPeople() - parents }, (_, i) => i + 1).map((k) => <option key={k} value={k}>{k}명</option>)}
                  </select>
                </div>
              </div>
            )}
            {accom && customer.checkInDate && (
              <div style={{ fontSize: "13px", color: "#6b7c93", marginTop: "4px" }}>
                적용 시즌: <span className={`season-badge ${isPeakSeason(customer.checkInDate) ? "peak" : "off"}`}>{season}</span>
                {billing.basePrice > 0 && <span style={{ marginLeft: "12px", fontWeight: 700, color: "#1a6fc4" }}>{fmt(billing.basePrice)}원</span>}
              </div>
            )}
          </div>

          {/* 고객 정보 */}
          <div className="form-section">
            <h2>고객 정보</h2>
            <div className="f-row">
              <div className="f-group"><label className="f-label">예약자명</label><input className="f-input" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">영문이름</label><input className="f-input" placeholder="HONG GILDONG" value={customer.englishName} onChange={(e) => setCustomer({ ...customer, englishName: e.target.value })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">예약번호</label><input className="f-input" value={customer.reservationNo} onChange={(e) => setCustomer({ ...customer, reservationNo: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">예약일</label><input className="f-input" type="date" value={customer.reservationDate} onChange={(e) => setCustomer({ ...customer, reservationDate: e.target.value })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">체크인 날짜</label><input className="f-input" type="date" value={customer.checkInDate} onChange={(e) => setCustomer({ ...customer, checkInDate: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">체크인 시간</label><input className="f-input" type="time" value={customer.checkInTime} onChange={(e) => setCustomer({ ...customer, checkInTime: e.target.value })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">체크아웃 날짜</label><input className="f-input" type="date" value={customer.checkOutDate} onChange={(e) => setCustomer({ ...customer, checkOutDate: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">체크아웃 시간</label><input className="f-input" type="time" value={customer.checkOutTime} onChange={(e) => setCustomer({ ...customer, checkOutTime: e.target.value })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">패키지 종류{accom && " (자동)"}</label><input className={`f-input${accom ? " auto" : ""}`} value={customer.packageType} onChange={(e) => setCustomer({ ...customer, packageType: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">인원 구성{accom && " (자동)"}</label><input className={`f-input${accom ? " auto" : ""}`} value={customer.people} onChange={(e) => setCustomer({ ...customer, people: e.target.value })} /></div>
            </div>
          </div>

          {/* 결제 정보 */}
          <div className="form-section">
            <h2>결제 정보</h2>
            <div className="f-row">
              <div className="f-group">
                <label className="f-label">패키지 금액 (원){accom && " — 자동 계산됨"}</label>
                <input className={`f-input${accom ? " auto" : ""}`} type="number" value={billing.basePrice || ""} onChange={(e) => setBilling({ basePrice: Number(e.target.value) })} />
              </div>
            </div>
            <label className="f-label" style={{ marginTop: "12px", marginBottom: "8px" }}>할인 항목</label>
            {discounts.map((d) => (
              <div className="disc-row" key={d.id}>
                <div className="f-group"><input className="f-input" placeholder="할인 이름" value={d.name} onChange={(e) => updateDiscount(d.id, "name", e.target.value)} /></div>
                <div className="f-group"><input className="f-input" type="number" placeholder="금액" value={d.amount || ""} onChange={(e) => updateDiscount(d.id, "amount", Number(e.target.value))} /></div>
                <button className="btn-sm btn-rm" onClick={() => removeDiscount(d.id)}>삭제</button>
              </div>
            ))}
            <button className="btn-sm btn-add" onClick={addDiscount}>+ 할인 추가</button>
            <label className="f-label" style={{ marginTop: "16px", marginBottom: "8px" }}>현지 지불 항목</label>
            {localCharges.map((c) => (
              <div className="disc-row" key={c.id}>
                <div className="f-group"><input className="f-input" placeholder="항목명" value={c.name} onChange={(e) => updateLocalCharge(c.id, "name", e.target.value)} /></div>
                <div className="f-group"><input className="f-input" placeholder="금액 (예: 7,000 pesos)" value={c.amount} onChange={(e) => updateLocalCharge(c.id, "amount", e.target.value)} /></div>
                <button className="btn-sm btn-rm" onClick={() => removeLocalCharge(c.id)}>삭제</button>
              </div>
            ))}
            <button className="btn-sm btn-add" onClick={addLocalCharge}>+ 현지 지불 항목 추가</button>
          </div>

          {/* 체크인 정보 */}
          <div className="form-section">
            <h2>체크인 정보</h2>
            <div className="f-row">
              <div className="f-group"><label className="f-label">픽업 여부</label><select className="f-select" value={checkIn.pickup} onChange={(e) => setCheckIn({ ...checkIn, pickup: e.target.value })}><option value="O">O</option><option value="X">X</option></select></div>
              <div className="f-group"><label className="f-label">드롭 여부</label><select className="f-select" value={checkIn.drop} onChange={(e) => setCheckIn({ ...checkIn, drop: e.target.value })}><option value="O">O</option><option value="X">X</option></select></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">항공편 (IN)</label><input className="f-input" placeholder="예) 5J 123" value={checkIn.flightIn} onChange={(e) => setCheckIn({ ...checkIn, flightIn: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">항공편 (OUT)</label><input className="f-input" placeholder="예) 5J 456" value={checkIn.flightOut} onChange={(e) => setCheckIn({ ...checkIn, flightOut: e.target.value })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">베드 세팅</label><input className="f-input" placeholder="예) 킹1 + 싱글1" value={checkIn.bedSetting} onChange={(e) => setCheckIn({ ...checkIn, bedSetting: e.target.value })} /></div>
              <div className="f-group"><label className="f-label">USIM</label><input className="f-input" placeholder="예) 30일 요금제" value={checkIn.usim} onChange={(e) => setCheckIn({ ...checkIn, usim: e.target.value })} /></div>
            </div>
            <div className="f-row">
              <div className="f-group"><label className="f-label">하우스 번호</label><input className="f-input" placeholder="예) 드림하우스 5호" value={checkIn.houseNo} onChange={(e) => setCheckIn({ ...checkIn, houseNo: e.target.value })} /></div>
            </div>
            <div className="f-group" style={{ marginTop: "4px" }}>
              <label className="f-label">특별 요청사항</label>
              <textarea className="f-textarea" value={checkIn.specialRequest} onChange={(e) => setCheckIn({ ...checkIn, specialRequest: e.target.value })} />
            </div>
          </div>

          <button className="btn-generate" onClick={handleGenerate}>인보이스 생성</button>
          <a href="/" className="back-link">← 홈으로 돌아가기</a>
        </div>
      ) : (
        <div className="invoice-wrap">
          <div className="invoice">
            <div className="inv-top">
              <div><div className="inv-logo">DREAM COMPANY</div><div className="inv-logo-sub">Philippines</div></div>
              <div className="inv-title"><h1>INVOICE</h1>{customer.reservationNo && <p>No. {customer.reservationNo}</p>}</div>
            </div>
            <div className="inv-section">
              <div className="inv-section-title">Customer Information</div>
              <table className="inv-table"><tbody>
                <tr><td className="label">예약자명</td><td>{customer.name}</td><td className="label">영문이름</td><td>{customer.englishName}</td></tr>
                <tr><td className="label">예약번호</td><td>{customer.reservationNo}</td><td className="label">예약일</td><td>{customer.reservationDate}</td></tr>
                <tr><td className="label">체크인</td><td>{customer.checkInDate} {customer.checkInTime}</td><td className="label">체크아웃</td><td>{customer.checkOutDate} {customer.checkOutTime}</td></tr>
                <tr><td className="label">패키지</td><td>{customer.packageType}</td><td className="label">인원 구성</td><td>{customer.people}</td></tr>
              </tbody></table>
            </div>
            <div className="inv-section">
              <div className="inv-section-title">Billing Details</div>
              <table className="inv-table"><thead><tr><th style={{width:"60%"}}>항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
                <tr><td>패키지 금액 ({season})</td><td style={{textAlign:"right"}}>{fmt(billing.basePrice)}원</td></tr>
                {discounts.filter((d) => d.name).map((d, i) => <tr key={i}><td className="discount">↓ {d.name}</td><td className="discount" style={{textAlign:"right"}}>-{fmt(Number(d.amount))}원</td></tr>)}
                {totalDiscount > 0 && <tr className="total-row"><td>총 할인</td><td style={{textAlign:"right",color:"#dc2626"}}>-{fmt(totalDiscount)}원</td></tr>}
                <tr className="final-row"><td>청구 금액</td><td style={{textAlign:"right"}}>{fmt(finalPrice)}원</td></tr>
              </tbody></table>
              {localCharges.filter((c) => c.name).length > 0 && (
                <table className="inv-table" style={{marginTop:"12px"}}><thead><tr><th style={{width:"60%"}}>현지 지불 항목</th><th style={{width:"40%",textAlign:"right"}}>금액</th></tr></thead><tbody>
                  {localCharges.filter((c) => c.name).map((c, i) => <tr key={i}><td>{c.name}</td><td style={{textAlign:"right"}}>{c.amount}</td></tr>)}
                </tbody></table>
              )}
            </div>
            <div className="inv-section">
              <div className="inv-section-title">Check In Details</div>
              <table className="inv-table"><tbody>
                <tr><td className="label">픽업</td><td>{checkIn.pickup}</td><td className="label">드롭</td><td>{checkIn.drop}</td></tr>
                <tr><td className="label">항공편 (IN)</td><td>{checkIn.flightIn}</td><td className="label">항공편 (OUT)</td><td>{checkIn.flightOut}</td></tr>
                <tr><td className="label">베드 세팅</td><td>{checkIn.bedSetting}</td><td className="label">USIM</td><td>{checkIn.usim}</td></tr>
                <tr><td className="label">하우스 번호</td><td colSpan={3}>{checkIn.houseNo}</td></tr>
                {checkIn.specialRequest && <tr><td className="label">특별 요청</td><td colSpan={3} style={{whiteSpace:"pre-wrap"}}>{checkIn.specialRequest}</td></tr>}
              </tbody></table>
            </div>
            <div className="inv-footer">
              안내받으신 총합안내 이용금액 및 환불규정을 꼭 확인 해 주세요.<br/>
              미확인으로 인한 문제는 책임지지 않습니다.<br/>
              추가 요청사항이 있다면 추후 안내 부탁드립니다.<br/>
              해당 청구서에 대한 문의사항이 있으시면 드림아카데미로 문의주세요.<br/>
              감사합니다.
            </div>
          </div>
          <div className="print-btns no-print">
            <button className="btn-print" onClick={() => window.print()}>PDF 저장 / 인쇄</button>
            <button className="btn-back" onClick={() => setShowPreview(false)}>수정하기</button>
          </div>
        </div>
      )}
    </>
  );
}
