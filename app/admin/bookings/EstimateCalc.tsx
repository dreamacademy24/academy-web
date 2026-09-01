"use client";
import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";
import {
  COMMON_EXCLUSIONS,
  INCLUSIONS_DH,
  INCLUSIONS_JP,
  INCLUSIONS_C9,
  INCLUSIONS_COMMUTE,
  type AccomType,
  type PkgItem,
} from "@/lib/packageInfo";
import { fetchDeployedHolidays, holidaysInRange, fmtHolidayList, type HolidayItem } from "@/lib/holidays";

/* ── 가격 테이블 (invoice 동일, [정가, 비수기, 성수기]) ── */
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
  "12-3-3":[40600000,32480000,36540000],
  // 보호자 4명 (엑셀 구성공식 생성: 숙소비+식사비+셔틀+등록비40만+수업료, 2026-08-28)
  "1-4-1":[3040000,2430000,2730000],
  "1-4-2":[3910000,3120000,3510000],
  "2-4-1":[5240000,4190000,4710000],
  "2-4-2":[6720000,5370000,6040000],
  "3-4-1":[7550000,6040000,6800000],
  "3-4-2":[9660000,7720000,8680000],
  "4-4-1":[9490000,7590000,8540000],
  "4-4-2":[12140000,9710000,10920000],
  "5-4-1":[11760000,9400000,10580000],
  "5-4-2":[15070000,12050000,13560000],
  "6-4-1":[14030000,11220000,12620000],
  "6-4-2":[18000000,14400000,16200000],
  "7-4-1":[16300000,13040000,14670000],
  "7-4-2":[20940000,16750000,18840000],
  "8-4-1":[18580000,14860000,16720000],
  "8-4-2":[23890000,19110000,21500000],
  "9-4-1":[20850000,16680000,18760000],
  "9-4-2":[26820000,21450000,24130000],
  "10-4-1":[23120000,18490000,20800000],
  "10-4-2":[29760000,23800000,26780000],
  "11-4-1":[25400000,20320000,22860000],
  "11-4-2":[32700000,26160000,29430000],
  "12-4-1":[27670000,22130000,24900000],
  "12-4-2":[35630000,28500000,32060000]
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

// 통학형 (학원만, 킨더/주니어 동일) — [정가, 비수기, 성수기]
const COMMUTE:Record<number,P3>={
  2:[1000000, 900000, 1000000],
  3:[1390000, 1251000, 1390000],
  4:[1690000, 1521000, 1690000],
  5:[2110000, 1899000, 2110000],
  6:[2530000, 2277000, 2403500],
  7:[2950000, 2522250, 2802500],
  8:[3380000, 2889900, 3211000],
  9:[3810000, 3257550, 3619500],
  10:[4240000, 3625200, 4028000],
  11:[4670000, 3992850, 4436500],
  12:[5100000, 4360500, 4845000],
};

/* ── 유틸 ── */
type Season="list"|"off"|"peak"; // 정가/비수기/성수기
// 견적 calc 전용 확장 타입 — 콤보 + 단독 + 통학 포함. 공유 AccomType은 그대로.
type AccomLocal = AccomType | "dreamhouse_jaypark" | "dreamhouse_cubenine" | "jaypark" | "commute";
const accomLabel:Record<AccomLocal,string>={
  dreamhouse:"드림하우스 단독",
  jpark:"제이파크 단독",
  jaypark:"제이파크 단독",
  cubenine:"큐브나인 단독",
  dreamhouse_jaypark:"드하 + 제이파크",
  dreamhouse_cubenine:"드하 + 큐브나인",
  commute:"통학형",
};
// AccomLocal → packageInfo의 AccomType(3종) 매핑 (콤보/통학 → 단일 baseline)
function toBaseAccom(a: AccomLocal): AccomType {
  if (a === "dreamhouse_jaypark" || a === "jaypark") return "jpark";
  if (a === "dreamhouse_cubenine") return "cubenine";
  if (a === "commute") return "dreamhouse";
  return a as AccomType;
}
const seasonLabel:Record<Season,string>={list:"정가",off:"비수기",peak:"성수기"};

function isPeak(d:string):boolean{
  if(!d) return false;
  const dt=new Date(d),y=dt.getFullYear(),m=dt.getMonth()+1,day=dt.getDate();
  if(y===2027) return (m===7&&day>=18)||(m===8&&day<=30)||(m===12&&day>=19)||m===1||m===2;
  if(y===2028) return m===1||(m===2&&day<=28)||(m===7&&day>=15)||m===8||(m===12&&day>=15);
  return (m===7&&day>=15)||m===8||(m===12&&day>=15)||m===1||m===2;
}
function autoSeason(d:string):Season{ return d?(isPeak(d)?"peak":"off"):"list"; }

function lookup(t:AccomLocal,r:string,w:number,p:number,k:number):P3|null{
  const half=(e:P3):P3=>[Math.round(e[0]/2),Math.round(e[1]/2),Math.round(e[2]/2)];
  // 통학형: 학원만 (룸타입 무관). 가격표는 아이 1명 기준 → 아이 수만큼 곱함. 1주 미지원 시 2주의 절반 fallback.
  if(t==="commute"){
    const kids=Math.max(1,k||1);
    const mul=(e:P3):P3=>[e[0]*kids,e[1]*kids,e[2]*kids];
    if(COMMUTE[w]) return mul(COMMUTE[w]);
    if(w===1&&COMMUTE[2]) return mul(half(COMMUTE[2]));
    return null;
  }
  // 단독 jaypark은 jpark 가격 테이블의 별칭
  if(t==="jaypark") return lookup("jpark", r, w, p, k);
  // 콤보: 두 숙소 가격 합산 (같은 주수로 각각 lookup)
  if(t==="dreamhouse_jaypark"){
    const dh=lookup("dreamhouse","",w,p,k);
    const jp=lookup("jpark",r,w,p,k);
    if(!dh||!jp) return null;
    return [dh[0]+jp[0], dh[1]+jp[1], dh[2]+jp[2]];
  }
  if(t==="dreamhouse_cubenine"){
    const dh=lookup("dreamhouse","",w,p,k);
    const c9=lookup("cubenine",r,w,p,k);
    if(!dh||!c9) return null;
    return [dh[0]+c9[0], dh[1]+c9[1], dh[2]+c9[2]];
  }
  // 단독: dreamhouse / jpark / cubenine
  if(t==="dreamhouse"){const e=DH[`${w}-${p}-${k}`];if(e)return e;if(w===1){const e2=DH[`2-${p}-${k}`];if(e2)return half(e2);}return null;}
  if(t==="jpark"){const e=JP[`${r}-${w}-${p}-${k}`];if(e)return e;if(w===1){const e2=JP[`${r}-2-${p}-${k}`];if(e2)return half(e2);}return null;}
  const e=C9[`${r}-${w}-${p}-${k}`];if(e)return e;if(w===1){const e2=C9[`${r}-2-${p}-${k}`];if(e2)return half(e2);}return null;
}
function pickPrice(e:P3,s:Season):number{ return s==="off"?e[1]:s==="peak"?e[2]:e[0]; }
/* 주 시작일 기준 혼합 시즌: 각 주(체크인+7i)의 시즌 판정. 섞이면 {off,peak} 주수 반환 */
function weekAllPeak(ds:string):boolean{
  // 주 시작~끝(6일 뒤)이 모두 성수기일 때만 성수기 주 — 걸친 주는 비수기 적용 (2026-07-30 메이 확정)
  const e=new Date(ds+"T00:00:00"); e.setDate(e.getDate()+6);
  const es=`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}-${String(e.getDate()).padStart(2,"0")}`;
  return isPeak(ds)&&isPeak(es);
}
function seasonMix(checkin:string,w:number):{off:number;peak:number}|null{
  if(!checkin||!w||w<1) return null;
  let off=0,peak=0;
  for(let i=0;i<w;i++){
    const d=new Date(checkin+"T00:00:00"); d.setDate(d.getDate()+i*7);
    const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if(weekAllPeak(ds)) peak++; else off++;
  }
  return (off>0&&peak>0)?{off,peak}:null;
}
/* 혼합 시즌 가격: 주당가(해당 주수 시즌가/주수) × 시즌별 주수 합 */
function blendPrice(e:P3,checkin:string,w:number,season:Season):{price:number;mix:{off:number;peak:number}|null}{
  if(season==="list") return {price:e[0],mix:null};
  const mix=seasonMix(checkin,w);
  if(!mix){
    // 혼합 아님 — 단, 체크인 있으면 주 단위 판정으로 시즌 재확정 (걸친 주만 있으면 비수기)
    if(checkin&&w>=1){const allPeak=weekAllPeak(checkin);return {price:pickPrice(e,allPeak?"peak":"off"),mix:null};}
    return {price:pickPrice(e,season),mix:null};
  }
  const offWk=Math.round(e[1]/w), peakWk=Math.round(e[2]/w);
  return {price:offWk*mix.off+peakWk*mix.peak,mix};
}
function won(n:number){return n.toLocaleString("ko-KR")+"원";}

interface ExtraItem{id:number;name:string;amount:number;}
interface PlanState{
  accom:AccomLocal; roomType:string; weeks:number; checkin:string; season:Season;
  parents:number; kids:number;
  extras:ExtraItem[]; discounts:ExtraItem[];
  // 콤보 (드하+JP / 드하+C9) 전용
  dhRoom:string; dhWeeks:number;
  subRoom:string; subWeeks:number;
}

function isCombo(a:AccomLocal):boolean{
  return a==="dreamhouse_jaypark"||a==="dreamhouse_cubenine";
}
function totalWeeks(p:PlanState):number{
  return isCombo(p.accom)?(p.dhWeeks+p.subWeeks):p.weeks;
}

const defaultPlan=(accom:AccomLocal="dreamhouse"):PlanState=>({
  accom,
  roomType:(accom==="dreamhouse"||accom==="commute")?"":"디럭스",
  weeks:4, checkin:"", season:"list",
  parents:1, kids:2, extras:[], discounts:[],
  dhRoom:"디럭스", dhWeeks:2,
  subRoom:"디럭스", subWeeks:2,
});

interface ComboBreakdown{
  weeks:number; weekly:number; price:number; label:string; room:string;
}
interface CalcResult{
  listPrice:number; seasonPrice:number; extraSum:number; discountSum:number;
  finalPrice:number; saving:number;
  mix?:{off:number;peak:number}|null;
  breakdown?:{ dh:ComboBreakdown; sub:ComboBreakdown };
}

function calcPlan(p:PlanState):CalcResult|null{
  const extraSum=p.extras.reduce((s,x)=>s+(x.amount||0),0);
  const discountSum=p.discounts.reduce((s,x)=>s+(x.amount||0),0);

  if(isCombo(p.accom)){
    const subType:AccomLocal = p.accom==="dreamhouse_jaypark"?"jpark":"cubenine";
    const subLabel = subType==="jpark"?"제이파크":"큐브나인";
    const dhFour = lookup("dreamhouse","",4,p.parents,p.kids);
    const subFour = lookup(subType,p.subRoom,4,p.parents,p.kids);
    if(!dhFour||!subFour) return null;
    const sIdx = p.season==="off"?1:p.season==="peak"?2:0;
    const dhWeeklyList = Math.round(dhFour[0]/4);
    const subWeeklyList = Math.round(subFour[0]/4);
    // 구간별 주 시작일로 시즌 판정 (드하 먼저 → 서브 숙소)
    const wkOf=(four:P3,ds:string)=>Math.round(four[p.season==="list"?0:(weekAllPeak(ds)?2:1)]/4);
    const dAt=(base:string,off:number)=>{const t=new Date(base+"T00:00:00");t.setDate(t.getDate()+off*7);return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;};
    let dhPrice=0, subPrice=0, mixOff=0, mixPeak=0;
    if(p.checkin&&p.season!=="list"){
      for(let i=0;i<p.dhWeeks;i++){const ds=dAt(p.checkin,i);dhPrice+=wkOf(dhFour,ds);weekAllPeak(ds)?mixPeak++:mixOff++;}
      for(let i=0;i<p.subWeeks;i++){const ds=dAt(p.checkin,p.dhWeeks+i);subPrice+=wkOf(subFour,ds);weekAllPeak(ds)?mixPeak++:mixOff++;}
    }else{
      dhPrice=Math.round(dhFour[sIdx]/4)*p.dhWeeks;
      subPrice=Math.round(subFour[sIdx]/4)*p.subWeeks;
    }
    const comboMix=(mixOff>0&&mixPeak>0)?{off:mixOff,peak:mixPeak}:null;
    const dhWeekly=p.dhWeeks?Math.round(dhPrice/p.dhWeeks):0;
    const subWeekly=p.subWeeks?Math.round(subPrice/p.subWeeks):0;
    const seasonPrice = dhPrice+subPrice;
    const listPrice = dhWeeklyList*p.dhWeeks + subWeeklyList*p.subWeeks;
    const finalPrice = seasonPrice+extraSum-discountSum;
    return {
      listPrice, seasonPrice, extraSum, discountSum, finalPrice,
      saving:listPrice-finalPrice, mix:comboMix,
      breakdown:{
        dh:{weeks:p.dhWeeks,weekly:dhWeekly,price:dhPrice,label:"드림하우스",room:p.dhRoom},
        sub:{weeks:p.subWeeks,weekly:subWeekly,price:subPrice,label:subLabel,room:p.subRoom},
      },
    };
  }

  const e=lookup(p.accom,p.roomType,p.weeks,p.parents,p.kids);
  if(!e) return null;
  const listPrice=e[0];
  const bl=blendPrice(e,p.checkin,p.weeks,p.season);
  const seasonPrice=bl.price;
  const finalPrice=seasonPrice+extraSum-discountSum;
  return {listPrice,seasonPrice,extraSum,discountSum,finalPrice,saving:listPrice-finalPrice,mix:bl.mix};
}

export default function EstimateCalc(){
  const resultRef=useRef<HTMLDivElement>(null);
  const MAX_PLANS = 5;
  const DEFAULT_ACCOM_ROTATION: AccomLocal[] = ["dreamhouse","jaypark","cubenine","dreamhouse","jaypark"];
  const [plans,setPlans]=useState<PlanState[]>([defaultPlan("dreamhouse")]);
  const [holidays,setHolidays]=useState<HolidayItem[]>([]);
  useEffect(()=>{ fetchDeployedHolidays().then(setHolidays).catch(()=>{}); },[]);
  /* 🏫 방학 수업료 자동 차감 — 견적 기간에 평일 휴무가 걸리면 자동으로 '학원 방학 수업료 제외' 반영 (직원 누락 방지, 2026-08-28) */
  useEffect(()=>{
    if(!holidays.length)return;
    setPlans(prev=>{
      let changed=false;
      const next=prev.map(p=>{
        const kept=p.discounts.filter(d=>!d.name.startsWith("학원 방학 수업료 제외"));
        const line=computeHolidayLine(p);
        const desired=line?[...kept,{id:(p.discounts.find(d=>d.name.startsWith("학원 방학 수업료 제외"))?.id)||Date.now(),...line}]:kept;
        const cur=p.discounts.map(d=>d.name+"|"+d.amount).join("~");
        const des=desired.map(d=>d.name+"|"+d.amount).join("~");
        if(cur!==des){changed=true;return {...p,discounts:desired};}
        return p;
      });
      return changed?next:prev;
    });
  // 체크인·주수·아이수·숙소·휴일이 바뀔 때만 재계산 (무한루프 방지: 변경 없으면 prev 반환)
  },[holidays,plans.map(p=>`${p.checkin}|${p.accom}|${p.weeks}|${p.dhWeeks}|${p.subWeeks}|${p.kids}`).join(",")]);

  function up(idx:number,patch:Partial<PlanState>){
    setPlans(prev=>prev.map((p,i)=>{
      if(i!==idx) return p;
      const next={...p,...patch};
      if(patch.accom){
        next.roomType=(patch.accom==="dreamhouse"||patch.accom==="commute")?"":"디럭스";
        next.parents=1; next.kids=2; next.weeks=4;
        next.dhRoom="디럭스"; next.dhWeeks=2;
        next.subRoom="디럭스"; next.subWeeks=2;
      }
      return next;
    }));
  }
  function setCheckinAndSeason(idx:number,date:string){
    setPlans(prev=>prev.map((p,i)=>i===idx?{...p,checkin:date,season:autoSeason(date)}:p));
  }
  /* 방학(평일 휴무) 수업료 차감 — 순수 계산 (alert 없음, 자동/수동 공용) */
  function computeHolidayLine(p:PlanState):{name:string;amount:number}|null{
    const w=totalWeeks(p);
    const kids=Number(p.kids)||0;
    if(!p.checkin||!w||!kids)return null;
    const co=(()=>{const t=new Date(p.checkin+"T00:00:00");t.setDate(t.getDate()+(p.accom==="commute"?(w-1)*7+4:w*7));return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;})();
    const hs=holidaysInRange(holidays,p.checkin,co).filter(h=>{const d=new Date(h.date+"T00:00:00").getDay();return d>=1&&d<=5;});
    if(!hs.length)return null;
    const base=COMMUTE[w]||(w===1?[500000,450000,500000]:COMMUTE[12]);
    const days=w*5;
    const perOff=Math.round(base[1]/days), perPeak=Math.round(base[2]/days);
    let sum=0;const parts:string[]=[];
    for(const h of hs){const pk=isPeak(h.date);sum+=(pk?perPeak:perOff)*kids;parts.push(h.date.slice(5).replace("-","/")+(pk?"·성수기":"·비수기"));}
    return {name:`학원 방학 수업료 제외 (${parts.join(", ")} × 아이 ${kids}명 · ${w}주 단가 기준)`,amount:sum};
  }
  function applyHolidayDeduct(idx:number){
    const p=plans[idx];
    if(!p.checkin){alert("체크인 날짜를 먼저 입력해주세요.");return;}
    if(!totalWeeks(p)){alert("기간을 먼저 설정해주세요.");return;}
    if(!(Number(p.kids)||0)){alert("아이 인원을 먼저 설정해주세요 (수업료는 아이 기준).");return;}
    const line=computeHolidayLine(p);
    if(!line){alert("체류 기간 내 평일 휴무일이 없어요. (주말 휴무는 수업료 차감 대상 아님)");return;}
    const kept=p.discounts.filter(d=>!d.name.startsWith("학원 방학 수업료 제외"));
    up(idx,{discounts:[...kept,{id:Date.now(),...line}]});
  }
  function applyClosing(idx:number){
    const p=plans[idx];
    const w=totalWeeks(p);
    const n=(p.parents||0)+(p.kids||0);
    if(!w||!n){alert("기간과 인원을 먼저 설정해주세요.");return;}
    const factor=Math.min(w,4)/4;
    const e=10*factor;const ep=(Number.isInteger(e)?e:e.toFixed(1))+"만";
    const wk=w<4?` · ${w}주 적용`:"";
    const line={id:Date.now(),name:`다온맘 마감임박 할인 (26년 8월 입실·현금) (1인 ${ep}×${n}명${wk})`,amount:Math.round(10*factor*n)*10000};
    const kept=p.discounts.filter(d=>!d.name.startsWith("다온맘 마감임박"));
    up(idx,{discounts:[...kept,line]});
  }
  function applyDaon(idx:number,cash:boolean){
    const p=plans[idx];
    const w=totalWeeks(p);
    const n=(p.parents||0)+(p.kids||0);
    if(!w||!n){alert("기간과 인원을 먼저 설정해주세요.");return;}
    const ci=(p.checkin||"").slice(0,10);
    /* 얼리버드 = 체류 중간점 기준 (2/28 입실 등 경계 케이스 포함) */
    const _mid=(()=>{if(!ci)return ci;const dt=new Date(ci+"T00:00:00");dt.setDate(dt.getDate()+Math.floor(w*7/2));return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getDate()).padStart(2,"0")}`;})();
    const is27=_mid>="2027-03-01"&&_mid<="2028-02-29";
    if(!ci){alert("체크인 날짜를 입력하면 입실 시기(얼리버드 대상)가 자동 판정돼요.");}
    const season=p.season;
    if(season==="list"){alert("시즌(비수기/성수기)을 먼저 선택해주세요.");return;}
    const factor=Math.min(w,4)/4;
    const _ep=(p:number)=>{const e=p*factor;return (Number.isInteger(e)?e:e.toFixed(1))+"만";};
    const _wk=w<4?` · ${w}주 적용`:"";
    /* 얼리버드 = 주별 가중 — 비수기 주 20만/4주 · 성수기 주 10만/4주 (혼합 체류는 주별 합산, 4주 초과는 4주분 상한) */
    let ebOffW=0,ebPeakW=0;
    if(ci){for(let i=0;i<w;i++){const _d=new Date(ci+"T00:00:00");_d.setDate(_d.getDate()+i*7);const _ds=_d.getFullYear()+"-"+String(_d.getMonth()+1).padStart(2,"0")+"-"+String(_d.getDate()).padStart(2,"0");if(weekAllPeak(_ds))ebPeakW++;else ebOffW++;}}
    else if(season==="peak")ebPeakW=w;else ebOffW=w;
    const ebPer=is27?(ebOffW*20+ebPeakW*10)/4*(Math.min(w,4)/w):0;
    const lines:{name:string;amount:number}[]=[];
    if(ebPer>0){const _pt=Number.isInteger(ebPer)?String(ebPer):ebPer.toFixed(1);const _seg=(ebOffW>0&&ebPeakW>0)?"비수기 "+ebOffW+"주+성수기 "+ebPeakW+"주 · ":(ebPeakW>0?"성수기 · ":"비수기 · ");lines.push({name:"다온맘 얼리버드 할인 ("+_seg+"1인 "+_pt+"만×"+n+"명)",amount:Math.round(ebPer*n*10000)});}
    if(cash)lines.push({name:`다온맘 전액입금 할인 (1인 ${_ep(10)}×${n}명${_wk})`,amount:Math.round(10*factor*n)*10000});
    if(cash&&ci>="2026-08-01"&&ci<="2026-08-31")lines.push({name:`다온맘 마감임박 할인 (26년 8월 입실·현금) (1인 ${_ep(10)}×${n}명${_wk})`,amount:Math.round(10*factor*n)*10000});
    if(String(p.accom).includes("cubenine"))lines.push({name:`다온맘 큐브나인 추가 할인 (1인 ${_ep(10)}×${n}명${_wk})`,amount:Math.round(10*factor*n)*10000});
    const kept=p.discounts.filter(d=>!d.name.startsWith("다온맘"));
    const added=lines.map((l,i)=>({id:Date.now()+i,name:l.name,amount:l.amount}));
    up(idx,{discounts:[...kept,...added]});
    if(lines.length===0)alert("이 조건(2026 입실·카드)은 다온맘 이벤트 할인이 없어요.\n(1차 시즌가는 이미 견적 가격에 반영돼 있습니다)");
  }
  function addItem(idx:number,field:"extras"|"discounts"){
    setPlans(prev=>prev.map((p,i)=>i===idx?{...p,[field]:[...p[field],{id:Date.now()+Math.floor(Math.random()*1000),name:"",amount:0}]}:p));
  }
  function rmItem(idx:number,field:"extras"|"discounts",itemId:number){
    setPlans(prev=>prev.map((p,i)=>i===idx?{...p,[field]:p[field].filter(it=>it.id!==itemId)}:p));
  }
  function setItem(idx:number,field:"extras"|"discounts",itemId:number,patch:Partial<ExtraItem>){
    setPlans(prev=>prev.map((p,i)=>i===idx?{...p,[field]:p[field].map(it=>it.id===itemId?{...it,...patch}:it)}:p));
  }
  // '발행일' / 파일명용 — mount 후 자정을 넘어가도 화면 포커스/인터벌로 자동 갱신
  const [now,setNow]=useState<Date>(()=>new Date());
  useEffect(()=>{
    const update=()=>setNow(new Date());
    document.addEventListener("visibilitychange",update);
    window.addEventListener("focus",update);
    const id=setInterval(update,60_000);
    return()=>{
      document.removeEventListener("visibilitychange",update);
      window.removeEventListener("focus",update);
      clearInterval(id);
    };
  },[]);
  const todayFmt=now.toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"});
  const todayFile=now.toISOString().slice(0,10).replace(/-/g,"");

  function planName(p:PlanState){
    if(isCombo(p.accom)){
      const subLabel = p.accom==="dreamhouse_jaypark"?"제이파크":"큐브나인";
      return `드림하우스 ${p.dhWeeks}주 + ${subLabel} ${subLabel==="제이파크"?p.subRoom+" 가든뷰":p.subRoom} ${p.subWeeks}주`;
    }
    return accomLabel[p.accom]+(p.roomType?` ${p.roomType}${(p.accom==="jaypark"||p.accom==="jpark")?" 가든뷰":""}`:"");
  }
  function fmtDate(d:string){if(!d)return"";const dt=new Date(d);return `${dt.getFullYear()}.${dt.getMonth()+1}.${dt.getDate()}`;}
  function calcCheckout(checkin:string, weeks:number, commute?:boolean){
    if(!checkin) return "";
    const d=new Date(checkin);
    if(isNaN(d.getTime())) return "";
    d.setDate(d.getDate()+(commute?(weeks-1)*7+4:weeks*7));
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const dd=String(d.getDate()).padStart(2,"0");
    return `${y}-${m}-${dd}`;
  }

  async function saveImage(){
    const el=resultRef.current;
    if(!el) return;
    const canvas=await html2canvas(el,{scale:2,backgroundColor:"#ffffff",useCORS:true});
    const link=document.createElement("a");
    link.download=`dream_estimate_${todayFile}.png`;
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  function seasonBadge(s:Season){
    const cfg:Record<Season,{bg:string;color:string;border:string}>={
      list:{bg:"#f1f5f9",color:"#64748b",border:"#e2e8f0"},
      off:{bg:"#eff6ff",color:"#1d4ed8",border:"#bfdbfe"},
      peak:{bg:"#fef2f2",color:"#dc2626",border:"#fecaca"},
    };
    const c=cfg[s];
    return <span style={{display:"inline-block",padding:"2px 10px",borderRadius:10,fontSize:11,fontWeight:700,background:c.bg,color:c.color,border:`1px solid ${c.border}`}}>{seasonLabel[s]}</span>;
  }

  /* ── 입력 폼 ── */
  function renderInput(plan:PlanState,idx:number,label:string){
    const detected=autoSeason(plan.checkin);
    return(
      <div style={{flex:1,minWidth:300,background:"#fff",borderRadius:12,padding:20,border:"1px solid #e2e8f0"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1a6fc4",marginBottom:14,paddingBottom:8,borderBottom:"2px solid #1a6fc4"}}>{label}</div>
        {/* 숙소 */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <label style={{flex:1}}><span style={lbl}>숙소</span>
            <select style={sel} value={plan.accom} onChange={e=>up(idx,{accom:e.target.value as AccomLocal})}>
              <option value="dreamhouse">드림하우스 단독</option>
              <option value="dreamhouse_jaypark">드하 + 제이파크</option>
              <option value="dreamhouse_cubenine">드하 + 큐브나인</option>
              <option value="jaypark">제이파크 단독</option>
              <option value="cubenine">큐브나인 단독</option>
              <option value="commute">통학형</option>
            </select></label>
          {/* 단독: 룸타입 한 칸 */}
          {(plan.accom==="jpark"||plan.accom==="jaypark")&&<label style={{flex:1}}><span style={lbl}>룸타입</span>
            <select style={sel} value={plan.roomType} onChange={e=>up(idx,{roomType:e.target.value})}>
              <option value="디럭스">디럭스 가든뷰</option><option value="프리미어">프리미어 가든뷰</option><option value="막탄스윗">막탄스윗 가든뷰</option>
            </select></label>}
          {plan.accom==="cubenine"&&<label style={{flex:1}}><span style={lbl}>룸타입</span>
            <select style={sel} value={plan.roomType} onChange={e=>up(idx,{roomType:e.target.value})}>
              <option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option>
            </select></label>}
        </div>

        {/* 콤보: 각 숙소별 룸타입 + 기간 */}
        {isCombo(plan.accom) && (
          <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:10,padding:12,marginBottom:8}}>
            <div style={{fontSize:11,fontWeight:700,color:"#1a6fc4",marginBottom:8,letterSpacing:"0.02em"}}>🏨 숙소별 룸타입 · 기간</div>
            {/* 드림하우스 */}
            <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-end"}}>
              <div style={{minWidth:70,fontSize:12,fontWeight:700,color:"#475569",padding:"9px 0"}}>드림하우스</div>
              <label style={{flex:1}}><span style={lbl}>룸타입</span>
                <select style={sel} value={plan.dhRoom} onChange={e=>up(idx,{dhRoom:e.target.value})}>
                  <option value="디럭스">디럭스</option>
                  <option value="슈페리어">슈페리어</option>
                </select></label>
              <label style={{flex:1}}><span style={lbl}>기간</span>
                <select style={sel} value={plan.dhWeeks} onChange={e=>up(idx,{dhWeeks:Number(e.target.value)})}>
                  {Array.from({length:12},(_,i)=>i+1).filter(w=>w>=2).map(w=><option key={w} value={w}>{w}주</option>)}
                </select></label>
            </div>
            {/* 제이파크 or 큐브나인 */}
            <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
              <div style={{minWidth:70,fontSize:12,fontWeight:700,color:"#475569",padding:"9px 0"}}>{plan.accom==="dreamhouse_jaypark"?"제이파크":"큐브나인"}</div>
              <label style={{flex:1}}><span style={lbl}>룸타입</span>
                <select style={sel} value={plan.subRoom} onChange={e=>up(idx,{subRoom:e.target.value})}>
                  {plan.accom==="dreamhouse_jaypark" ? (<>
                    <option value="디럭스">디럭스 가든뷰</option><option value="프리미어">프리미어 가든뷰</option><option value="막탄스윗">막탄스윗 가든뷰</option>
                  </>) : (<>
                    <option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option>
                  </>)}
                </select></label>
              <label style={{flex:1}}><span style={lbl}>기간</span>
                <select style={sel} value={plan.subWeeks} onChange={e=>up(idx,{subWeeks:Number(e.target.value)})}>
                  {Array.from({length:12},(_,i)=>i+1).map(w=><option key={w} value={w}>{w}주</option>)}
                </select></label>
            </div>
            <div style={{marginTop:8,paddingTop:8,borderTop:"1px dashed #cbd5e1",fontSize:12,fontWeight:700,color:"#1a1a2e",textAlign:"right"}}>
              총 기간: <span style={{color:"#1a6fc4"}}>{plan.dhWeeks+plan.subWeeks}주</span>
              <span style={{color:"#94a3b8",fontWeight:500,marginLeft:6}}>(드하 {plan.dhWeeks}주 + {plan.accom==="dreamhouse_jaypark"?"JP":"C9"} {plan.subWeeks}주)</span>
            </div>
          </div>
        )}

        {/* 기간 (단독) / 체크인 */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          {!isCombo(plan.accom) && (
            <label style={{flex:1}}><span style={lbl}>기간</span>
              <select style={sel} value={plan.weeks} onChange={e=>up(idx,{weeks:Number(e.target.value)})}>
                {Array.from({length:12},(_,i)=>i+1).map(w=><option key={w} value={w}>{w}주</option>)}
              </select></label>
          )}
          <label style={{flex:1}}><span style={lbl}>체크인 날짜</span>
            <input style={sel} type="date" value={plan.checkin} onChange={e=>setCheckinAndSeason(idx,e.target.value)}/>
            {plan.checkin&&<div style={{marginTop:4,fontSize:12,color:"#6b7280"}}>{plan.accom==="commute"?"수업종료 (월~금)":"체크아웃"}: {calcCheckout(plan.checkin,totalWeeks(plan),plan.accom==="commute")}</div>}
          </label>
        </div>
        {/* 자동판별 + 시즌 수동선택 */}
        <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <span style={lbl}>자동 판별</span>
            <div style={{padding:"8px 0"}}>{plan.checkin?seasonBadge(detected):<span style={{fontSize:12,color:"#94a3b8"}}>날짜를 입력하세요</span>}</div>
          </div>
          <label style={{flex:1}}><span style={lbl}>시즌 (수동 변경 가능)</span>
            <select style={{...sel,fontWeight:600,color:plan.season==="peak"?"#dc2626":plan.season==="off"?"#1d4ed8":"#64748b"}} value={plan.season} onChange={e=>up(idx,{season:e.target.value as Season})}>
              <option value="list">정가</option><option value="off">비수기</option><option value="peak">성수기</option>
            </select></label>
        </div>
        {/* 보호자 / 아이 */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          {plan.accom !== "commute" && (
          <label style={{flex:1}}><span style={lbl}>보호자</span>
            <select style={sel} value={plan.parents} onChange={e=>up(idx,{parents:Number(e.target.value)})}>
              {(plan.accom==="dreamhouse"?[1,2,3,4]:[1,2,3]).map(n=><option key={n} value={n}>{n}명</option>)}
            </select></label>
          )}
          <label style={{flex:1}}><span style={lbl}>아이</span>
            <select style={sel} value={plan.kids} onChange={e=>up(idx,{kids:Number(e.target.value)})}>
              {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}명</option>)}
            </select></label>
        </div>
        {/* 추가항목 */}
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"#6b7c93"}}>추가항목</span>
            <button style={addBtnS} onClick={()=>addItem(idx,"extras")}>+ 추가</button>
          </div>
          {plan.extras.map((item)=>(
            <div key={item.id} style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <input style={{...inp,flex:1}} placeholder="항목명" value={item.name} onChange={e=>setItem(idx,"extras",item.id,{name:e.target.value})}/>
              <input style={{...inp,width:100}} type="number" placeholder="금액" value={item.amount||""} onChange={e=>setItem(idx,"extras",item.id,{amount:Number(e.target.value)})}/>
              <button style={delBtnS} onClick={()=>rmItem(idx,"extras",item.id)}>×</button>
            </div>
          ))}
        </div>
        {/* 할인항목 */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"#dc2626"}}>할인항목</span>
            <span style={{display:"flex",gap:4}}>
              <button style={{...addBtnS,background:"#fef9c3",border:"1px solid #eab308",color:"#854d0e"}} onClick={()=>applyDaon(idx,true)}>💛 다온맘 현금</button>
              <button style={{...addBtnS,background:"#fefce8",border:"1px solid #eab308",color:"#854d0e"}} onClick={()=>applyDaon(idx,false)}>💛 다온맘 카드</button>
              <button style={{...addBtnS,background:"#fee2e2",border:"1px solid #f87171",color:"#991b1b"}} onClick={()=>applyClosing(idx)}>⏰ 마감임박</button>
              <button style={{...addBtnS,background:"#e0f2fe",border:"1px solid #38bdf8",color:"#075985"}} onClick={()=>applyHolidayDeduct(idx)}>🏫 방학 수업료</button>
              <button style={addBtnS} onClick={()=>addItem(idx,"discounts")}>+ 추가</button>
            </span>
          </div>
          {plan.discounts.map((item)=>(
            <div key={item.id} style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <input style={{...inp,flex:1}} placeholder="항목명" value={item.name} onChange={e=>setItem(idx,"discounts",item.id,{name:e.target.value})}/>
              <input style={{...inp,width:100}} type="number" placeholder="금액" value={item.amount||""} onChange={e=>setItem(idx,"discounts",item.id,{amount:Number(e.target.value)})}/>
              <button style={delBtnS} onClick={()=>rmItem(idx,"discounts",item.id)}>×</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── 출력 카드 ── */
  function renderCard(plan:PlanState,r:ReturnType<typeof calcPlan>,label:string,onRemove?:()=>void){
    if(!r) return(
      <div style={{flex:1,minWidth:280,background:"#f8fafc",borderRadius:12,padding:32,textAlign:"center",color:"#94a3b8",fontSize:13,border:"1px solid #e2e8f0",position:"relative"}}>
        {onRemove&&<button onClick={onRemove} className="no-print" style={{position:"absolute",top:8,right:8,background:"transparent",border:"none",color:"#ef4444",fontSize:18,cursor:"pointer",lineHeight:1,fontFamily:"'Noto Sans KR',sans-serif"}} title="이 안 제거">×</button>}
        {label}: 가격 정보 없음<br/>조건을 변경해주세요.
      </div>
    );
    const hasExtras=plan.extras.filter(e=>e.name&&e.amount).length>0;
    const hasDiscounts=plan.discounts.filter(e=>e.name&&e.amount).length>0;
    const showStrike=r.listPrice!==r.finalPrice;
    return(
      <div style={{flex:1,minWidth:280,background:"#fff",borderRadius:12,padding:24,border:"1px solid #e2e8f0",position:"relative"}}>
        {onRemove&&<button onClick={onRemove} className="no-print" style={{position:"absolute",top:8,right:8,background:"transparent",border:"none",color:"#ef4444",fontSize:18,cursor:"pointer",lineHeight:1,fontFamily:"'Noto Sans KR',sans-serif"}} title="이 안 제거">×</button>}
        {/* 카드 헤더 */}
        <div style={{textAlign:"center",marginBottom:16,paddingBottom:14,borderBottom:"2px solid #1a6fc4"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#1a1a2e",marginBottom:4}}>{label}</div>
          <div style={{fontSize:13,fontWeight:600,color:"#1a6fc4",marginBottom:4}}>{planName(plan)} · 총 {totalWeeks(plan)}주</div>
          {plan.checkin && (
            <div style={{fontSize:12,color:"#475569",marginBottom:4}}>{plan.accom==="commute"?"수업시작":"체크인"}: {plan.checkin} / {plan.accom==="commute"?"수업종료":"체크아웃"}: {calcCheckout(plan.checkin,totalWeeks(plan),plan.accom==="commute")}</div>
          )}
          <div style={{marginBottom:4}}>{seasonBadge(plan.season)}</div>
          <div style={{fontSize:12,color:"#6b7c93"}}>{plan.accom!=="commute" ? `보호자 ${plan.parents}명 + 아이 ${plan.kids}명` : `아이 ${plan.kids}명`}</div>
        </div>

        {/* 콤보 숙소별 내역 */}
        {r.breakdown && (
          <div style={{background:"#f8fafc",border:"1px solid #e2e8f0",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"4px 0",fontSize:13}}>
              <span style={{color:"#374151"}}>
                {r.breakdown.dh.label} {r.breakdown.dh.room} <span style={{color:"#94a3b8",fontWeight:500}}>· {r.breakdown.dh.weeks}주</span>
              </span>
              <span style={{fontWeight:700,color:"#1a1a2e"}}>{won(r.breakdown.dh.price)}</span>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"4px 0",fontSize:13}}>
              <span style={{color:"#374151"}}>
                {r.breakdown.sub.label} {r.breakdown.sub.label==="제이파크"?r.breakdown.sub.room+" 가든뷰":r.breakdown.sub.room} <span style={{color:"#94a3b8",fontWeight:500}}>· {r.breakdown.sub.weeks}주</span>
              </span>
              <span style={{fontWeight:700,color:"#1a1a2e"}}>{won(r.breakdown.sub.price)}</span>
            </div>
            <div style={{marginTop:4,fontSize:10.5,color:"#94a3b8",textAlign:"right"}}>
              주당 단가 = 해당 숙소 4주 금액 ÷ 4
            </div>
          </div>
        )}

        {/* 정가 취소선 */}
        {showStrike&&(
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:13}}>
            <span style={{color:"#94a3b8"}}>정가</span>
            <span style={{textDecoration:"line-through",color:"#94a3b8"}}>{won(r.listPrice)}</span>
          </div>
        )}

        {/* 시즌가 */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:14}}>
          <span style={{color:"#374151"}}>{r.mix?`혼합 시즌 (비수기 ${r.mix.off}주 + 성수기 ${r.mix.peak}주)`:seasonLabel[plan.season]+" 가격"}</span>
          <span style={{fontWeight:600,color:"#1a1a2e"}}>{won(r.seasonPrice)}</span>
        </div>
        {plan.discounts.some(d=>d.name.startsWith("학원 방학 수업료 제외"))&&(
          <div style={{margin:"6px 0",padding:"7px 11px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:11.5,color:"#1e40af",fontWeight:600}}>
            🏫 이 견적 기간에 학원 <b>방학(휴무일)</b>이 포함되어 아래에 <b>수업료 차감</b>이 자동 반영되었어요.
          </div>
        )}

        {/* 추가항목 */}
        {hasExtras&&<>
          {plan.extras.filter(e=>e.name&&e.amount).map((e,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13}}>
              <span style={{color:"#6b7c93"}}>+ {e.name}</span>
              <span style={{color:"#1a6fc4",fontWeight:600}}>+{won(e.amount)}</span>
            </div>
          ))}
        </>}

        {/* 구분선 */}
        {(hasExtras||hasDiscounts)&&<div style={{borderTop:"1px dashed #e2e8f0",margin:"8px 0"}}/>}

        {/* 할인항목 */}
        {hasDiscounts&&<>
          {plan.discounts.filter(e=>e.name&&e.amount).map((e,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",fontSize:13}}>
              <span style={{color:"#6b7c93"}}>- {e.name}</span>
              <span style={{color:"#dc2626",fontWeight:600}}>-{won(e.amount)}</span>
            </div>
          ))}
          <div style={{borderTop:"1px dashed #e2e8f0",margin:"8px 0"}}/>
        </>}

        {/* 최종가 */}
        <div style={{borderTop:"2px solid #1a1a2e",marginTop:6,paddingTop:14}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <span style={{fontSize:16,fontWeight:800,color:"#1a1a2e"}}>💛 최종 할인가</span>
            <span style={{fontSize:24,fontWeight:800,color:"#1a6fc4"}}>{won(r.finalPrice)}</span>
          </div>
          {r.saving>0&&(
            <div style={{textAlign:"right",marginTop:4,fontSize:12,fontWeight:600,color:"#059669"}}>
              정가 대비 {won(r.saving)} 할인
            </div>
          )}
        </div>
      </div>
    );
  }

  return(
    <>
      {/* ── 입력 ── */}
      <div className="no-print">
        <div style={{display:"flex",gap:16,flexWrap:"wrap",marginBottom:12}}>
          {plans.map((p,i)=>(
            <div key={i} style={{flex:"1 1 300px",minWidth:300,display:"flex"}}>{renderInput(p,i,`${i+1}안 설정`)}</div>
          ))}
        </div>
        {plans.length<MAX_PLANS&&(
          <div style={{textAlign:"center",marginBottom:20}}>
            <button onClick={()=>{
              const nextAccom=DEFAULT_ACCOM_ROTATION[plans.length]??"dreamhouse";
              setPlans(prev=>[...prev,defaultPlan(nextAccom)]);
            }} style={{padding:"10px 24px",fontSize:13,fontWeight:700,borderRadius:8,border:"1px solid #e2e8f0",background:"#eff6ff",color:"#1a6fc4",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>
              + {plans.length+1}안 추가하기
            </button>
          </div>
        )}
      </div>

      {/* ── 출력 ── */}
      <div id="estimate-result" ref={resultRef} style={{background:"#fff",borderRadius:14,padding:36,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:24,fontWeight:800,color:"#1a6fc4",letterSpacing:"-0.02em",marginBottom:2}}>Dream Academy Philippines</div>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>맞춤 견적서</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>발행일: {todayFmt}</div>
        </div>

        <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
          {plans.map((p,i)=>{
            const r=calcPlan(p);
            const onRemove=i>=1?()=>setPlans(prev=>prev.filter((_,idx)=>idx!==i)):undefined;
            return <div key={i} style={{flex:"1 1 280px",minWidth:280,display:"flex"}}>{renderCard(p,r,`${i+1}안`,onRemove)}</div>;
          })}
        </div>

        {/* 패키지 포함/불포함 박스 영역 */}
        <div style={{display:"flex",gap:16,marginTop:32,marginBottom:24,flexWrap:"wrap"}}>
          {plans.map((p, i) => {
            // accom 값 → 표시할 sub 패키지 박스 목록
            const subBoxes: { label: string; items: PkgItem[] }[] = [];
            if (p.accom === "dreamhouse_jaypark") {
              subBoxes.push({ label: "드림하우스", items: INCLUSIONS_DH });
              subBoxes.push({ label: "제이파크", items: INCLUSIONS_JP });
            } else if (p.accom === "dreamhouse_cubenine") {
              subBoxes.push({ label: "드림하우스", items: INCLUSIONS_DH });
              subBoxes.push({ label: "큐브나인", items: INCLUSIONS_C9 });
            } else if (p.accom === "jpark" || p.accom === "jaypark") {
              subBoxes.push({ label: "제이파크 단독", items: INCLUSIONS_JP });
            } else if (p.accom === "cubenine") {
              subBoxes.push({ label: "큐브나인 단독", items: INCLUSIONS_C9 });
            } else if (p.accom === "commute") {
              subBoxes.push({ label: "통학형", items: INCLUSIONS_COMMUTE });
            } else {
              // dreamhouse 단독
              subBoxes.push({ label: "드림하우스 단독", items: INCLUSIONS_DH });
            }
            return (
              <div key={i} style={{
                flex:"1 1 320px",
                minWidth:280,
                padding:20,
                background:"#fff",
                border:"1px solid #e5e7eb",
                borderRadius:12,
                boxShadow:"0 1px 2px rgba(0,0,0,0.04)",
              }}>
                <div style={{fontSize:15,fontWeight:700,marginBottom:14,color:"#111"}}>
                  📦 {i+1}안 · {accomLabel[p.accom]} 패키지 포함 사항
                </div>
                {subBoxes.map((box, bi) => (
                  <div key={bi} style={{marginBottom:subBoxes.length>1?14:0}}>
                    {subBoxes.length > 1 && (
                      <div style={{fontSize:13,fontWeight:700,color:"#1a6fc4",marginBottom:8,paddingBottom:4,borderBottom:"1px solid #e5e7eb"}}>
                        · {box.label}
                      </div>
                    )}
                    {box.items.map((it, idx) => (
                      <div key={idx} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
                        <span style={{fontSize:17,lineHeight:"22px",flexShrink:0}}>{it.icon}</span>
                        <div style={{fontSize:12.5,lineHeight:"20px"}}>
                          <span style={{fontWeight:600,color:"#111"}}>{it.title}</span>
                          {it.desc && <span style={{color:"#6b7280"}}> · {it.desc}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}

          <div style={{
            flex:"1 1 320px",
            minWidth:280,
            padding:20,
            background:"#fef2f2",
            border:"1px solid #fecaca",
            borderLeft:"4px solid #ef4444",
            borderRadius:12,
          }}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:14,color:"#991b1b"}}>
              ⚠️ 불포함 사항 <span style={{fontSize:12,fontWeight:500,color:"#7f1d1d"}}>(별도 비용)</span>
            </div>
            {COMMON_EXCLUSIONS.map((it, idx) => (
              <div key={idx} style={{display:"flex",gap:10,marginBottom:10,alignItems:"flex-start"}}>
                <span style={{fontSize:17,lineHeight:"22px",flexShrink:0}}>{it.icon}</span>
                <div style={{fontSize:12.5,lineHeight:"20px"}}>
                  <span style={{fontWeight:600,color:"#991b1b"}}>{it.title}</span>
                  <span style={{color:"#7f1d1d"}}> · {it.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {(()=>{
          const hits = plans.flatMap(p=>p.checkin?holidaysInRange(holidays,p.checkin,calcCheckout(p.checkin,totalWeeks(p))):[]);
          const uniq=[...new Map(hits.map(h=>[h.date,h])).values()].sort((a,b)=>a.date.localeCompare(b.date));
          if(uniq.length===0) return null;
          return (
            <div style={{marginBottom:12,padding:"14px 18px",background:"#fffbeb",border:"1.5px solid #fcd34d",borderRadius:10}}>
              <div style={{fontSize:13,fontWeight:800,color:"#b45309",marginBottom:7}}>🏖 체류 기간 중 휴무일 안내 — {fmtHolidayList(uniq)}</div>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <div style={{fontSize:12,color:"#b91c1c",background:"#fef2f2",borderRadius:6,padding:"6px 10px",fontWeight:600}}>✕ 휴무일에는 수업 · 헬퍼 · 셔틀 · 관리실이 운영되지 않아요</div>
                <div style={{fontSize:12,color:"#065f46",background:"#ecfdf5",borderRadius:6,padding:"6px 10px",fontWeight:600}}>✓ 식사는 정상 제공됩니다</div>
                <div style={{fontSize:12,color:"#92400e",background:"#fff7ed",borderRadius:6,padding:"6px 10px",fontWeight:600}}>! 휴무일에 대한 별도 환불 · 보강은 없습니다</div>
              </div>
            </div>
          );
        })()}

        <div style={{padding:"14px 20px",background:"#f8fafc",borderRadius:10,textAlign:"center",fontSize:12,color:"#6b7c93",lineHeight:1.8}}>
          ※ 할인 금액은 언제든 변경될 수 있습니다.
        </div>
      </div>

      {/* ── 버튼 ── */}
      <div className="no-print" style={{marginTop:16,textAlign:"center"}}>
        <button onClick={saveImage} style={{padding:"12px 32px",width:"100%",minHeight:44,background:"#1a6fc4",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>
          📷 이미지 저장
        </button>
      </div>
    </>
  );
}

const lbl:React.CSSProperties={display:"block",fontSize:11,fontWeight:600,color:"#6b7c93",marginBottom:4};
const sel:React.CSSProperties={width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff"};
const inp:React.CSSProperties={padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",outline:"none"};
const addBtnS:React.CSSProperties={padding:"3px 10px",fontSize:11,fontWeight:600,color:"#1a6fc4",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"};
const delBtnS:React.CSSProperties={padding:"3px 8px",fontSize:14,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,cursor:"pointer",lineHeight:1};
