"use client";
import { useState, useRef, useEffect } from "react";
import html2canvas from "html2canvas";

/* ── 가격 테이블 (invoice 동일, [정가, 비수기, 성수기]) ── */
type P3=[number,number,number];
const DH:Record<string,P3>={"2-1-1":[3490000,2790000,3140000],"2-2-1":[4070000,3250000,3660000],"2-1-2":[4970000,3970000,4470000],"2-2-2":[5550000,4440000,4990000],"2-3-2":[6140000,4910000,5520000],"3-1-1":[5070000,4050000,4560000],"3-2-1":[5900000,4720000,5310000],"3-3-1":[6720000,5370000,6040000],"3-1-2":[7190000,5750000,6470000],"3-2-2":[8010000,6400000,7200000],"3-3-2":[8840000,7070000,7950000],"4-1-1":[6290000,5030000,5660000],"4-2-1":[7360000,5880000,6620000],"4-3-1":[8240000,6590000,7420000],"4-1-2":[8950000,7160000,8050000],"4-2-2":[10010000,8000000,9000000],"4-3-2":[11080000,8860000,9970000],"5-1-2":[11150000,8920000,10030000],"5-2-2":[12460000,9960000,11210000],"5-3-2":[13770000,11010000,12390000],"6-1-2":[13360000,10680000,12020000],"6-2-2":[14910000,11920000,13410000],"6-3-2":[16460000,13160000,14810000],"7-1-2":[15570000,12450000,14010000],"7-2-2":[17360000,13880000,15620000],"7-3-2":[19150000,15320000,17230000],"8-1-2":[17800000,14240000,16020000],"8-2-2":[19830000,15860000,17840000],"8-3-2":[21860000,17480000,19670000],"9-1-2":[20010000,16000000,18000000],"9-2-2":[22280000,17820000,20050000],"9-3-2":[24550000,19640000,22090000],"10-1-2":[22220000,17770000,19990000],"10-2-2":[24740000,19790000,22260000],"10-3-2":[27250000,21800000,24520000],"11-1-2":[24440000,19550000,21990000],"11-2-2":[27190000,21750000,24470000],"11-3-2":[29940000,23950000,26940000],"12-1-2":[26650000,21320000,23980000],"12-2-2":[29640000,23710000,26670000],"12-3-2":[32640000,26110000,29370000]};
const JP:Record<string,P3>={"디럭스-2-1-1":[5560000,4440000,5000000],"디럭스-2-1-2":[7040000,5630000,6330000],"디럭스-2-2-1":[6140000,4910000,5520000],"디럭스-2-1-3":[8530000,6820000,7670000],"디럭스-2-2-2":[7630000,6100000,6860000],"프리미어-2-1-1":[5700000,4560000,5130000],"프리미어-2-1-2":[7180000,5740000,6460000],"프리미어-2-2-1":[6280000,5020000,5650000],"프리미어-2-1-3":[8670000,6930000,7800000],"프리미어-2-2-2":[7770000,6210000,6990000],"막탄스윗-2-1-1":[6260000,5000000,5630000],"막탄스윗-2-1-2":[7740000,6190000,6960000],"막탄스윗-2-2-1":[6840000,5470000,6150000],"막탄스윗-2-1-3":[9230000,7380000,8300000],"막탄스윗-2-2-2":[8330000,6660000,7490000],"디럭스-3-1-1":[8180000,6540000,7360000],"디럭스-3-1-2":[10300000,8240000,9270000],"디럭스-3-2-1":[9010000,7200000,8100000],"디럭스-3-1-3":[12410000,9920000,11160000],"디럭스-3-2-2":[11120000,8890000,10000000],"프리미어-3-1-1":[8390000,6710000,7550000],"프리미어-3-1-2":[10510000,8400000,9450000],"프리미어-3-2-1":[9220000,7370000,8290000],"프리미어-3-1-3":[12620000,10090000,11350000],"프리미어-3-2-2":[11330000,9060000,10190000],"막탄스윗-3-1-1":[9230000,7380000,8300000],"막탄스윗-3-1-2":[11350000,9080000,10210000],"막탄스윗-3-2-1":[10060000,8040000,9050000],"막탄스윗-3-1-3":[13460000,10760000,12110000],"막탄스윗-3-2-2":[12170000,9730000,10950000],"디럭스-4-1-1":[10720000,8570000,9640000],"디럭스-4-1-2":[13370000,10690000,12030000],"디럭스-4-2-1":[11780000,9420000,10600000],"디럭스-4-1-3":[16030000,12820000,14420000],"디럭스-4-2-2":[14440000,11550000,12990000],"프리미어-4-1-1":[11000000,8800000,9900000],"프리미어-4-1-2":[13650000,10920000,12280000],"프리미어-4-2-1":[12060000,9640000,10850000],"프리미어-4-1-3":[16310000,13040000,14670000],"프리미어-4-2-2":[14720000,11770000,13240000],"막탄스윗-4-1-1":[12120000,9690000,10900000],"막탄스윗-4-1-2":[14770000,11810000,13290000],"막탄스윗-4-2-1":[13180000,10540000,11860000],"막탄스윗-4-1-3":[17430000,13940000,15680000],"막탄스윗-4-2-2":[15840000,12670000,14250000],"디럭스-5-1-1":[13370000,10690000,12030000],"디럭스-5-1-2":[16680000,13340000,15010000],"디럭스-5-2-1":[14670000,11730000,13200000],"디럭스-5-1-3":[20000000,16000000,18000000],"디럭스-5-2-2":[17990000,14390000,16190000],"프리미어-5-1-1":[13720000,10970000,12340000],"프리미어-5-1-2":[17030000,13620000,15320000],"프리미어-5-2-1":[15020000,12010000,13510000],"프리미어-5-1-3":[20350000,16280000,18310000],"프리미어-5-2-2":[18340000,14670000,16500000],"막탄스윗-5-1-1":[15120000,12090000,13600000],"막탄스윗-5-1-2":[18430000,14740000,16580000],"막탄스윗-5-2-1":[16420000,13130000,14770000],"막탄스윗-5-1-3":[21750000,17400000,19570000],"막탄스윗-5-2-2":[19740000,15790000,17760000],"디럭스-6-1-1":[16020000,12810000,14410000],"디럭스-6-1-2":[20000000,16000000,18000000],"디럭스-6-2-1":[17570000,14050000,15810000],"디럭스-6-1-3":[23980000,19180000,21580000],"디럭스-6-2-2":[21550000,17240000,19390000],"프리미어-6-1-1":[16440000,13150000,14790000],"프리미어-6-1-2":[20420000,16330000,18370000],"프리미어-6-2-1":[17990000,14390000,16190000],"프리미어-6-1-3":[24400000,19520000,21960000],"프리미어-6-2-2":[21970000,17570000,19770000],"막탄스윗-6-1-1":[18120000,14490000,16300000],"막탄스윗-6-1-2":[22100000,17680000,19890000],"막탄스윗-6-2-1":[19670000,15730000,17700000],"막탄스윗-6-1-3":[26080000,20860000,23470000],"막탄스윗-6-2-2":[23650000,18920000,21280000],"디럭스-7-1-1":[18670000,14930000,16800000],"디럭스-7-1-2":[23310000,18640000,20970000],"디럭스-7-2-1":[20460000,16360000,18410000],"디럭스-7-1-3":[27950000,22360000,25150000],"디럭스-7-2-2":[25100000,20080000,22590000],"프리미어-7-1-1":[19160000,15320000,17240000],"프리미어-7-1-2":[23800000,19040000,21420000],"프리미어-7-2-1":[20950000,16760000,18850000],"프리미어-7-1-3":[28440000,22750000,25590000],"프리미어-7-2-2":[25590000,20470000,23030000],"막탄스윗-7-1-1":[21120000,16890000,19000000],"막탄스윗-7-1-2":[25760000,20600000,23180000],"막탄스윗-7-2-1":[22910000,18320000,20610000],"막탄스윗-7-1-3":[30400000,24320000,27360000],"막탄스윗-7-2-2":[27550000,22040000,24790000],"디럭스-8-1-1":[21340000,17070000,19200000],"디럭스-8-1-2":[26650000,21320000,23980000],"디럭스-8-2-1":[23370000,18690000,21030000],"디럭스-8-1-3":[31960000,25560000,28760000],"디럭스-8-2-2":[28680000,22940000,25810000],"프리미어-8-1-1":[21900000,17520000,19710000],"프리미어-8-1-2":[27210000,21760000,24480000],"프리미어-8-2-1":[23930000,19140000,21530000],"프리미어-8-1-3":[32520000,26010000,29260000],"프리미어-8-2-2":[29240000,23390000,26310000],"막탄스윗-8-1-1":[24140000,19310000,21720000],"막탄스윗-8-1-2":[29450000,23560000,26500000],"막탄스윗-8-2-1":[26170000,20930000,23550000],"막탄스윗-8-1-3":[34760000,27800000,31280000],"막탄스윗-8-2-2":[31480000,25180000,28330000],"디럭스-9-1-1":[23990000,19190000,21590000],"디럭스-9-1-2":[29960000,23960000,26960000],"디럭스-9-2-1":[26260000,21000000,23630000],"디럭스-9-1-3":[35940000,28750000,32340000],"디럭스-9-2-2":[32240000,25790000,29010000],"프리미어-9-1-1":[24620000,19690000,22150000],"프리미어-9-1-2":[30590000,24470000,27530000],"프리미어-9-2-1":[26890000,21510000,24200000],"프리미어-9-1-3":[36570000,29250000,32910000],"프리미어-9-2-2":[32870000,26290000,29580000],"막탄스윗-9-1-1":[27140000,21710000,24420000],"막탄스윗-9-1-2":[33110000,26480000,29790000],"막탄스윗-9-2-1":[29410000,23520000,26460000],"막탄스윗-9-1-3":[39090000,31270000,35180000],"막탄스윗-9-2-2":[35390000,28310000,31850000],"디럭스-10-1-1":[26650000,21320000,23980000],"디럭스-10-1-2":[33280000,26620000,29950000],"디럭스-10-2-1":[29160000,23320000,26240000],"디럭스-10-1-3":[39920000,31930000,35920000],"디럭스-10-2-2":[35800000,28640000,32220000],"프리미어-10-1-1":[27350000,21880000,24610000],"프리미어-10-1-2":[33980000,27180000,30580000],"프리미어-10-2-1":[29860000,23880000,26870000],"프리미어-10-1-3":[40620000,32490000,36550000],"프리미어-10-2-2":[36500000,29200000,32850000],"막탄스윗-10-1-1":[30150000,24120000,27130000],"막탄스윗-10-1-2":[36780000,29420000,33100000],"막탄스윗-10-2-1":[32660000,26120000,29390000],"막탄스윗-10-1-3":[43420000,34730000,39070000],"막탄스윗-10-2-2":[39300000,31440000,35370000],"디럭스-11-1-1":[29300000,23440000,26370000],"디럭스-11-1-2":[36600000,29280000,32940000],"디럭스-11-2-1":[32050000,25640000,28840000],"디럭스-11-1-3":[43900000,35120000,39510000],"디럭스-11-2-2":[39360000,31480000,35420000],"프리미어-11-1-1":[30070000,24050000,27060000],"프리미어-11-1-2":[37370000,29890000,33630000],"프리미어-11-2-1":[32820000,26250000,29530000],"프리미어-11-1-3":[44670000,35730000,40200000],"프리미어-11-2-2":[40130000,32100000,36110000],"막탄스윗-11-1-1":[33150000,26520000,29830000],"막탄스윗-11-1-2":[40450000,32360000,36400000],"막탄스윗-11-2-1":[35900000,28720000,32310000],"막탄스윗-11-1-3":[47750000,38200000,42970000],"막탄스윗-11-2-2":[43210000,34560000,38880000],"디럭스-12-1-1":[31960000,25560000,28760000],"디럭스-12-1-2":[39920000,31930000,35920000],"디럭스-12-2-1":[34950000,27960000,31450000],"디럭스-12-1-3":[47890000,38310000,43100000],"디럭스-12-2-2":[42920000,34330000,38620000],"프리미어-12-1-1":[32800000,26240000,29520000],"프리미어-12-1-2":[40760000,32600000,36680000],"프리미어-12-2-1":[35790000,28630000,32210000],"프리미어-12-1-3":[48730000,38980000,43850000],"프리미어-12-2-2":[43760000,35000000,39380000],"막탄스윗-12-1-1":[36160000,28920000,32540000],"막탄스윗-12-1-2":[44120000,35290000,39700000],"막탄스윗-12-2-1":[39150000,31320000,35230000],"막탄스윗-12-1-3":[52090000,41670000,46880000],"막탄스윗-12-2-2":[47120000,37690000,42400000]};
const C9:Record<string,P3>={"디럭스-2-1-1":[4630000,3700000,4160000],"디럭스-2-1-2":[5730000,4580000,5150000],"디럭스-2-2-1":[4830000,3860000,4340000],"디럭스-2-1-3":[6830000,5460000,6140000],"디럭스-2-2-2":[5930000,4740000,5330000],"풀억세스룸-2-1-1":[5020000,4010000,4510000],"풀억세스룸-2-1-2":[6120000,4890000,5500000],"풀억세스룸-2-2-1":[5220000,4170000,4690000],"풀억세스룸-2-1-3":[7220000,5770000,6490000],"풀억세스룸-2-2-2":[6320000,5050000,5680000],"디럭스-3-1-1":[6790000,5430000,6110000],"디럭스-3-1-2":[8330000,6660000,7490000],"디럭스-3-2-1":[7040000,5630000,6330000],"디럭스-3-1-3":[9870000,7890000,8880000],"디럭스-3-2-2":[8580000,6860000,7720000],"풀억세스룸-3-1-1":[7380000,5900000,6640000],"풀억세스룸-3-1-2":[8920000,7130000,8020000],"풀억세스룸-3-2-1":[7630000,6100000,6860000],"풀억세스룸-3-1-3":[10460000,8360000,9410000],"풀억세스룸-3-2-2":[9170000,7330000,8250000],"디럭스-4-1-1":[8860000,7080000,7970000],"디럭스-4-1-2":[10750000,8600000,9670000],"디럭스-4-2-1":[9160000,7320000,8240000],"디럭스-4-1-3":[12640000,10110000,11370000],"디럭스-4-2-2":[11050000,8840000,9940000],"풀억세스룸-4-1-1":[9640000,7710000,8670000],"풀억세스룸-4-1-2":[11530000,9220000,10370000],"풀억세스룸-4-2-1":[9940000,7950000,8940000],"풀억세스룸-4-1-3":[13420000,10730000,12070000],"풀억세스룸-4-2-2":[11830000,9460000,10640000],"디럭스-5-1-1":[11050000,8840000,9940000],"디럭스-5-1-2":[13410000,10720000,12060000],"디럭스-5-2-1":[11400000,9120000,10260000],"디럭스-5-1-3":[15770000,12610000,14190000],"디럭스-5-2-2":[13760000,11000000,12380000],"풀억세스룸-5-1-1":[12030000,9620000,10820000],"풀억세스룸-5-1-2":[14390000,11510000,12950000],"풀억세스룸-5-2-1":[12380000,9900000,11140000],"풀억세스룸-5-1-3":[16750000,13400000,15070000],"풀억세스룸-5-2-2":[14740000,11790000,13260000],"디럭스-6-1-1":[13230000,10580000,11900000],"디럭스-6-1-2":[16060000,12840000,14450000],"디럭스-6-2-1":[13630000,10900000,12260000],"디럭스-6-1-3":[18890000,15110000,17000000],"디럭스-6-2-2":[16460000,13160000,14810000],"풀억세스룸-6-1-1":[14410000,11520000,12960000],"풀억세스룸-6-1-2":[17240000,13790000,15510000],"풀억세스룸-6-2-1":[14810000,11840000,13320000],"풀억세스룸-6-1-3":[20070000,16050000,18060000],"풀억세스룸-6-2-2":[17640000,14110000,15870000],"디럭스-7-1-1":[15420000,12330000,13870000],"디럭스-7-1-2":[18720000,14970000,16840000],"디럭스-7-2-1":[15870000,12690000,14280000],"디럭스-7-1-3":[22020000,17610000,19810000],"디럭스-7-2-2":[19170000,15330000,17250000],"풀억세스룸-7-1-1":[16790000,13430000,15110000],"풀��세스룸-7-1-2":[20090000,16070000,18080000],"풀억세스룸-7-2-1":[17240000,13790000,15510000],"풀억세스룸-7-1-3":[23390000,18710000,21050000],"풀억세스룸-7-2-2":[20540000,16430000,18480000],"디럭스-8-1-1":[17620000,14090000,15850000],"디럭스-8-1-2":[21400000,17120000,19260000],"디럭스-8-2-1":[18120000,14490000,16300000],"디럭스-8-1-3":[25180000,20140000,22660000],"디럭스-8-2-2":[21900000,17520000,19710000],"풀억세스룸-8-1-1":[19190000,15350000,17270000],"풀억세스룸-8-1-2":[22970000,18370000,20670000],"풀억세스룸-8-2-1":[19690000,15750000,17720000],"풀억세스룸-8-1-3":[26750000,21400000,24070000],"풀억세스룸-8-2-2":[23470000,18770000,21120000],"디럭스-9-1-1":[19810000,15840000,17820000],"디럭스-9-1-2":[24060000,19240000,21650000],"디럭스-9-2-1":[20360000,16280000,18320000],"디럭스-9-1-3":[28310000,22640000,25470000],"디럭스-9-2-2":[24610000,19680000,22140000],"풀억세스룸-9-1-1":[21570000,17250000,19410000],"풀억세스룸-9-1-2":[25830000,20660000,23240000],"풀억세스룸-9-2-1":[22120000,17690000,19900000],"풀억세스룸-9-1-3":[30080000,24060000,27070000],"풀억세스룸-9-2-2":[26380000,21100000,23740000],"디럭스-10-1-1":[22000000,17600000,19800000],"디럭스-10-1-2":[26730000,21380000,24050000],"디럭스-10-2-1":[22600000,18080000,20340000],"디럭스-10-1-3":[31450000,25160000,28300000],"디럭스-10-2-2":[27330000,21860000,24590000],"풀억세스룸-10-1-1":[23960000,19160000,21560000],"풀억세스룸-10-1-2":[28690000,22950000,25820000],"풀억세스룸-10-2-1":[24560000,19640000,22100000],"풀억세스룸-10-1-3":[33410000,26720000,30060000],"풀억세스룸-10-2-2":[29290000,23430000,26360000],"디럭스-11-1-1":[24190000,19350000,21770000],"디럭스-11-1-2":[29390000,23510000,26450000],"디럭스-11-2-1":[24840000,19870000,22350000],"디럭스-11-1-3":[34590000,27670000,31130000],"디럭스-11-2-2":[30040000,24030000,27030000],"풀억세스룸-11-1-1":[26350000,21080000,23710000],"풀억세스룸-11-1-2":[31540000,25230000,28380000],"풀억세스룸-11-2-1":[27000000,21600000,24300000],"풀억세스룸-11-1-3":[36740000,29390000,33060000],"풀억세스룸-11-2-2":[32190000,25750000,28970000],"디럭스-12-1-1":[26380000,21100000,23740000],"디럭스-12-1-2":[32050000,25640000,28840000],"디럭스-12-2-1":[27080000,21660000,24370000],"디럭스-12-1-3":[37720000,30170000,33940000],"디럭스-12-2-2":[32750000,26200000,29470000],"풀억세스룸-12-1-1":[28730000,22980000,25850000],"풀억세스룸-12-1-2":[34400000,27520000,30960000],"풀억세스룸-12-2-1":[29430000,23540000,26480000],"풀억세스룸-12-1-3":[40070000,32050000,36060000],"풀억세스룸-12-2-2":[35100000,28080000,31590000]};

/* ── 유틸 ── */
type AccomType="dreamhouse"|"jpark"|"cubenine";
type Season="list"|"off"|"peak"; // 정가/비수기/성수기
const accomLabel:Record<AccomType,string>={dreamhouse:"드림하우스",jpark:"제이파크",cubenine:"큐브나인"};
const seasonLabel:Record<Season,string>={list:"정가",off:"비수기",peak:"성수기"};

function isPeak(d:string):boolean{
  if(!d) return false;
  const dt=new Date(d),m=dt.getMonth()+1,day=dt.getDate();
  return (m===7&&day>=15)||m===8||(m===12&&day>=15)||m===1||m===2;
}
function autoSeason(d:string):Season{ return d?(isPeak(d)?"peak":"off"):"list"; }

function lookup(t:AccomType,r:string,w:number,p:number,k:number):P3|null{
  if(t==="dreamhouse") return DH[`${w}-${p}-${k}`]??null;
  if(t==="jpark") return JP[`${r}-${w}-${p}-${k}`]??null;
  return C9[`${r}-${w}-${p}-${k}`]??null;
}
function pickPrice(e:P3,s:Season):number{ return s==="off"?e[1]:s==="peak"?e[2]:e[0]; }
function won(n:number){return n.toLocaleString("ko-KR")+"원";}

interface ExtraItem{name:string;amount:number;}
interface PlanState{
  accom:AccomType; roomType:string; weeks:number; checkin:string; season:Season;
  parents:number; kids:number;
  extras:ExtraItem[]; discounts:ExtraItem[];
}

const defaultPlan=(accom:AccomType="dreamhouse"):PlanState=>({
  accom, roomType:accom==="dreamhouse"?"":"디럭스", weeks:4, checkin:"", season:"list",
  parents:1, kids:2, extras:[], discounts:[],
});

function calcPlan(p:PlanState){
  const e=lookup(p.accom,p.roomType,p.weeks,p.parents,p.kids);
  if(!e) return null;
  const listPrice=e[0];
  const seasonPrice=pickPrice(e,p.season);
  const extraSum=p.extras.reduce((s,x)=>s+(x.amount||0),0);
  const discountSum=p.discounts.reduce((s,x)=>s+(x.amount||0),0);
  const finalPrice=seasonPrice+extraSum-discountSum;
  return {listPrice,seasonPrice,extraSum,discountSum,finalPrice,saving:listPrice-finalPrice};
}

export default function EstimateCalc(){
  const resultRef=useRef<HTMLDivElement>(null);
  const [p1,setP1]=useState<PlanState>(defaultPlan("dreamhouse"));
  const [p2,setP2]=useState<PlanState>(defaultPlan("jpark"));
  const [show2,setShow2]=useState(false);

  function up(setter:React.Dispatch<React.SetStateAction<PlanState>>,patch:Partial<PlanState>){
    setter(prev=>{
      const next={...prev,...patch};
      if(patch.accom){ next.roomType=patch.accom==="dreamhouse"?"":"디럭스"; next.parents=1; next.kids=2; next.weeks=4; }
      return next;
    });
  }
  function setCheckinAndSeason(setter:React.Dispatch<React.SetStateAction<PlanState>>,date:string){
    setter(prev=>({...prev,checkin:date,season:autoSeason(date)}));
  }
  function addItem(setter:React.Dispatch<React.SetStateAction<PlanState>>,field:"extras"|"discounts"){
    setter(prev=>({...prev,[field]:[...prev[field],{name:"",amount:0}]}));
  }
  function rmItem(setter:React.Dispatch<React.SetStateAction<PlanState>>,field:"extras"|"discounts",idx:number){
    setter(prev=>({...prev,[field]:prev[field].filter((_,i)=>i!==idx)}));
  }
  function setItem(setter:React.Dispatch<React.SetStateAction<PlanState>>,field:"extras"|"discounts",idx:number,patch:Partial<ExtraItem>){
    setter(prev=>({...prev,[field]:prev[field].map((item,i)=>i===idx?{...item,...patch}:item)}));
  }

  const r1=calcPlan(p1), r2=show2?calcPlan(p2):null;
  const todayFmt=new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"});
  const todayFile=new Date().toISOString().slice(0,10).replace(/-/g,"");

  function planName(p:PlanState){return accomLabel[p.accom]+(p.roomType?` ${p.roomType}`:"");}
  function fmtDate(d:string){if(!d)return"";const dt=new Date(d);return `${dt.getFullYear()}.${dt.getMonth()+1}.${dt.getDate()}`;}

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
  function renderInput(plan:PlanState,setter:React.Dispatch<React.SetStateAction<PlanState>>,label:string){
    const detected=autoSeason(plan.checkin);
    return(
      <div style={{flex:1,minWidth:300,background:"#fff",borderRadius:12,padding:20,border:"1px solid #e2e8f0"}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1a6fc4",marginBottom:14,paddingBottom:8,borderBottom:"2px solid #1a6fc4"}}>{label}</div>
        {/* 숙소 / 룸타입 */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <label style={{flex:1}}><span style={lbl}>숙소</span>
            <select style={sel} value={plan.accom} onChange={e=>up(setter,{accom:e.target.value as AccomType})}>
              <option value="dreamhouse">드림하우스</option><option value="jpark">제이파크</option><option value="cubenine">큐브나인</option>
            </select></label>
          {plan.accom==="jpark"&&<label style={{flex:1}}><span style={lbl}>룸타입</span>
            <select style={sel} value={plan.roomType} onChange={e=>up(setter,{roomType:e.target.value})}>
              <option value="디럭스">디럭스</option><option value="프리미어">프리미어</option><option value="막탄스윗">막탄스윗</option>
            </select></label>}
          {plan.accom==="cubenine"&&<label style={{flex:1}}><span style={lbl}>룸타입</span>
            <select style={sel} value={plan.roomType} onChange={e=>up(setter,{roomType:e.target.value})}>
              <option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option>
            </select></label>}
        </div>
        {/* 기간 / 체크인 */}
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <label style={{flex:1}}><span style={lbl}>기간</span>
            <select style={sel} value={plan.weeks} onChange={e=>up(setter,{weeks:Number(e.target.value)})}>
              {Array.from({length:11},(_,i)=>i+2).map(w=><option key={w} value={w}>{w}주</option>)}
            </select></label>
          <label style={{flex:1}}><span style={lbl}>체크인 날짜</span>
            <input style={sel} type="date" value={plan.checkin} onChange={e=>setCheckinAndSeason(setter,e.target.value)}/></label>
        </div>
        {/* 자동판별 + 시즌 수동선택 */}
        <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <span style={lbl}>자동 판별</span>
            <div style={{padding:"8px 0"}}>{plan.checkin?seasonBadge(detected):<span style={{fontSize:12,color:"#94a3b8"}}>날짜를 입력하세요</span>}</div>
          </div>
          <label style={{flex:1}}><span style={lbl}>시즌 (수동 변경 가능)</span>
            <select style={{...sel,fontWeight:600,color:plan.season==="peak"?"#dc2626":plan.season==="off"?"#1d4ed8":"#64748b"}} value={plan.season} onChange={e=>up(setter,{season:e.target.value as Season})}>
              <option value="list">정가</option><option value="off">비수기</option><option value="peak">성수기</option>
            </select></label>
        </div>
        {/* 보호자 / 아이 */}
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <label style={{flex:1}}><span style={lbl}>보호자</span>
            <select style={sel} value={plan.parents} onChange={e=>up(setter,{parents:Number(e.target.value)})}>
              {[1,2,3].map(n=><option key={n} value={n}>{n}명</option>)}
            </select></label>
          <label style={{flex:1}}><span style={lbl}>아이</span>
            <select style={sel} value={plan.kids} onChange={e=>up(setter,{kids:Number(e.target.value)})}>
              {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}명</option>)}
            </select></label>
        </div>
        {/* 추가항목 */}
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"#6b7c93"}}>추가항목</span>
            <button style={addBtnS} onClick={()=>addItem(setter,"extras")}>+ 추가</button>
          </div>
          {plan.extras.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <input style={{...inp,flex:1}} placeholder="항목명" value={item.name} onChange={e=>setItem(setter,"extras",i,{name:e.target.value})}/>
              <input style={{...inp,width:100}} type="number" placeholder="금액" value={item.amount||""} onChange={e=>setItem(setter,"extras",i,{amount:Number(e.target.value)})}/>
              <button style={delBtnS} onClick={()=>rmItem(setter,"extras",i)}>×</button>
            </div>
          ))}
        </div>
        {/* 할인항목 */}
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"#dc2626"}}>할인항목</span>
            <button style={addBtnS} onClick={()=>addItem(setter,"discounts")}>+ 추가</button>
          </div>
          {plan.discounts.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:6,marginBottom:4,flexWrap:"wrap"}}>
              <input style={{...inp,flex:1}} placeholder="항목명" value={item.name} onChange={e=>setItem(setter,"discounts",i,{name:e.target.value})}/>
              <input style={{...inp,width:100}} type="number" placeholder="금액" value={item.amount||""} onChange={e=>setItem(setter,"discounts",i,{amount:Number(e.target.value)})}/>
              <button style={delBtnS} onClick={()=>rmItem(setter,"discounts",i)}>×</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── 출력 카드 ── */
  function renderCard(plan:PlanState,r:ReturnType<typeof calcPlan>,label:string){
    if(!r) return(
      <div style={{flex:1,minWidth:280,background:"#f8fafc",borderRadius:12,padding:32,textAlign:"center",color:"#94a3b8",fontSize:13,border:"1px solid #e2e8f0"}}>
        {label}: 가격 정보 없음<br/>조건을 변경해주세요.
      </div>
    );
    const hasExtras=plan.extras.filter(e=>e.name&&e.amount).length>0;
    const hasDiscounts=plan.discounts.filter(e=>e.name&&e.amount).length>0;
    const showStrike=r.listPrice!==r.finalPrice;
    return(
      <div style={{flex:1,minWidth:280,background:"#fff",borderRadius:12,padding:24,border:"1px solid #e2e8f0"}}>
        {/* 카드 헤더 */}
        <div style={{textAlign:"center",marginBottom:16,paddingBottom:14,borderBottom:"2px solid #1a6fc4"}}>
          <div style={{fontSize:16,fontWeight:800,color:"#1a1a2e",marginBottom:4}}>{label}</div>
          <div style={{fontSize:13,fontWeight:600,color:"#1a6fc4",marginBottom:4}}>{planName(plan)} · {plan.weeks}주{plan.checkin?` · ${fmtDate(plan.checkin)}`:""}</div>
          <div style={{marginBottom:4}}>{seasonBadge(plan.season)}</div>
          <div style={{fontSize:12,color:"#6b7c93"}}>보호자 {plan.parents}명 + 아이 {plan.kids}명</div>
        </div>

        {/* 정가 취소선 */}
        {showStrike&&(
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:13}}>
            <span style={{color:"#94a3b8"}}>정가</span>
            <span style={{textDecoration:"line-through",color:"#94a3b8"}}>{won(r.listPrice)}</span>
          </div>
        )}

        {/* 시즌가 */}
        <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",fontSize:14}}>
          <span style={{color:"#374151"}}>{seasonLabel[plan.season]} 가격</span>
          <span style={{fontWeight:600,color:"#1a1a2e"}}>{won(r.seasonPrice)}</span>
        </div>

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
          {renderInput(p1,setP1,"1안 설정")}
          {show2&&renderInput(p2,setP2,"2안 설정")}
        </div>
        <div style={{textAlign:"center",marginBottom:20}}>
          <button onClick={()=>setShow2(!show2)} style={{padding:"10px 24px",fontSize:13,fontWeight:700,borderRadius:8,border:"1px solid #e2e8f0",background:show2?"#fef2f2":"#eff6ff",color:show2?"#dc2626":"#1a6fc4",cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>
            {show2?"2안 제거":"+ 2안 추가하기"}
          </button>
        </div>
      </div>

      {/* ── 출력 ── */}
      <div id="estimate-result" ref={resultRef} style={{background:"#fff",borderRadius:14,padding:36,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{fontSize:24,fontWeight:800,color:"#1a6fc4",letterSpacing:"-0.02em",marginBottom:2}}>Dream Academy Philippines</div>
          <div style={{fontSize:14,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>맞춤 견적서</div>
          <div style={{fontSize:11,color:"#94a3b8"}}>발행일: {todayFmt}</div>
        </div>

        <div style={{display:"flex",gap:16,marginBottom:24,flexWrap:"wrap"}}>
          {renderCard(p1,r1,"1안")}
          {show2&&renderCard(p2,r2,"2안")}
        </div>

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
