"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Stu { korName: string; engName: string; birth: string; }

function MedFormInner() {
  const sp = useSearchParams();
  const bookingId = sp.get("bookingId") || sp.get("id") || "";
  const [students, setStudents] = useState<Stu[]>([]);
  const [booker, setBooker] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!bookingId) { setLoading(false); return; }
    (async () => {
      const { data } = await supabase.from("bookings").select("booker_name, students").eq("id", bookingId).maybeSingle();
      let sts: Stu[] = [];
      if (data) {
        setBooker(data.booker_name || "");
        try {
          const arr = typeof data.students === "string" ? JSON.parse(data.students) : data.students;
          if (Array.isArray(arr)) {
            sts = arr
              .filter((s: any) => String(s?.korName || s?.name_kr || s?.engName || s?.name_en || "").trim())
              .map((s: any) => ({
                korName: (s.korName || s.name_kr || "").trim(),
                engName: (s.engName || s.name_en || "").trim(),
                birth: String(s.age || s.birth_date || "").trim(),
              }));
          }
        } catch { /* ignore */ }
      }
      if (sts.length === 0) {
        const { data: rows } = await supabase.from("students").select("name_kr,name_en,age").eq("booking_id", bookingId);
        sts = (rows || []).map((r: any) => ({ korName: r.name_kr || "", engName: r.name_en || "", birth: String(r.age || "") }));
      }
      if (sts.length === 0) sts = [{ korName: "", engName: "", birth: "" }];
      setStudents(sts);
      setLoading(false);
    })();
  }, [bookingId]);

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontFamily: "sans-serif" }}>불러오는 중...</div>;

  return (<>
    <style>{`
*{margin:0;padding:0;box-sizing:border-box;font-family:'Malgun Gothic','Noto Sans KR',sans-serif}
body{background:#e8eaf1}
.bar{position:sticky;top:0;z-index:10;background:#212a59;color:#fff;padding:12px 20px;display:flex;align-items:center;gap:12px}
.bar b{font-size:15px}
.bar .info{font-size:12.5px;opacity:.85}
.bar button{margin-left:auto;padding:9px 22px;border:none;border-radius:8px;background:#22c55e;color:#fff;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}
.page{width:210mm;min-height:297mm;background:#fff;margin:16px auto;position:relative;page-break-after:always}
.hd{background:#212a59;color:#fff;padding:10mm 12mm 8mm;display:flex;justify-content:space-between;align-items:flex-end}
.hd h1{font-size:27px;font-weight:900}
.hd .sub{font-size:13px;opacity:.85;margin-top:2.5mm}
.hd .brand{text-align:right}
.hd .brand b{font-size:15px;letter-spacing:1px}
.hd .brand div{font-size:10px;opacity:.8}
.wrap{padding:7mm 12mm}
.notice{background:#fdf3d7;border:1.5px solid #f3dfa0;border-radius:3mm;padding:4mm 5.5mm;font-size:13px;color:#7a5104;line-height:1.7}
.notice .tt{font-size:14.5px;font-weight:900}
.notice .sm{font-size:11px;color:#9a7a2e}
h2{font-size:16.5px;color:#212a59;border-bottom:2px solid #212a59;padding-bottom:2mm;margin:6mm 0 3.5mm}
h2 span{font-weight:400;font-size:12.5px;color:#6a7183}
table{width:100%;border-collapse:collapse}
.info-t td{border:1px solid #ccd2dc;padding:3mm;font-size:13.5px;height:12.5mm;vertical-align:middle}
.info-t td.l{background:#f2f4f8;color:#4a5162;width:33mm;font-weight:800;font-size:12.5px}
.info-t td.v{font-weight:700;font-size:14.5px}
.hint{color:#98a0ad;font-size:10px;font-weight:400}
.med th{background:#212a59;color:#fff;font-size:12px;padding:3mm 1mm;font-weight:800}
.med td{border:1px solid #ccd2dc;height:13mm;font-size:12.5px;text-align:center;vertical-align:middle}
.med tr.ex td{background:#eceef5;color:#6a7183;height:9mm;font-size:11px}
.exb{font-size:9px;font-weight:800;color:#8a91a3;margin-right:1.5mm}
.notes{font-size:12.5px;line-height:1.85;color:#333a4b}
.sign{display:flex;gap:9mm;align-items:flex-end;font-size:13.5px;margin-top:5mm}
.sign .ln{border-bottom:1px solid #6a7183;min-width:42mm;display:inline-block;height:6mm}
.ft{position:absolute;bottom:6mm;left:0;right:0;text-align:center;font-size:10px;color:#98a0ad}
@media print{
  @page{size:A4;margin:0}
  body{background:#fff}
  .bar{display:none}
  .page{margin:0;width:auto}
}
    `}</style>

    <div className="bar">
      <b>💊 상비약 복용 안내서</b>
      <span className="info">{booker && `${booker}님 예약 · `}학생 {students.length}명 · 1명당 1장</span>
      <button onClick={() => window.print()}>🖨️ 인쇄</button>
    </div>

    {students.map((st, i) => (
      <div className="page" key={i}>
        <div className="hd">
          <div><h1>상비약 복용 안내서</h1><div className="sub">드림아카데미(학원) 배포 · 보호자 작성 후 제출</div></div>
          <div className="brand"><b>DREAM ACADEMY</b><div>dreamacademyph.com</div></div>
        </div>
        <div className="wrap">
          <div className="notice">
            <span className="tt">이 약들은 꼭 챙겨 보내주세요</span><br />
            <b>✔ 해열제 — 최소 1가지</b> (교차 복용 가능한 <b>2종류까지 권장</b>: 아세트아미노펜 계열 + 이부프로펜 계열)<br />
            <b>✔ 복통약 — 1가지</b> &nbsp;&nbsp; <b>✔ 알레르기가 있는 아이</b>는 <b>알레르기약도 꼭 함께</b> 보내주세요<br />
            <span className="sm">※ 약 표면(병·포장)에도 [아이 이름 + 1회 용량]을 기재해 주세요 · 기재가 없는 약은 임의로 복용시키지 않습니다.</span>
          </div>

          <h2>1. 아이 정보</h2>
          <table className="info-t">
            <tbody>
              <tr>
                <td className="l">아이 이름 (한글)</td><td className="v" style={{ width: "56mm" }}>{st.korName}</td>
                <td className="l">영문 이름</td><td className="v">{st.engName}</td>
              </tr>
              <tr>
                <td className="l">생년월일</td><td className="v">{st.birth}</td>
                <td className="l">체중</td><td>kg &nbsp;<span className="hint">※ 용량 확인에 중요해요</span></td>
              </tr>
              <tr>
                <td className="l">약물 알레르기</td>
                <td colSpan={3}><span className="hint">(예: 특정 항생제·해열제 등 / 없으면 &quot;없음&quot;이라고 적어주세요)</span></td>
              </tr>
              <tr>
                <td className="l">해열제 복용 기준</td>
                <td colSpan={3}>체온 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ℃ 이상일 때 복용을 원해요 &nbsp;<span className="hint">※ 아이마다 기준이 달라 꼭 적어주세요</span></td>
              </tr>
              <tr>
                <td className="l">비상연락처</td>
                <td>보호자 성함/관계 :</td>
                <td className="l" style={{ width: "33mm" }}>연락처</td>
                <td><span className="hint">※ 카톡 ID 불가 — 현지번호/로밍 한국번호 등 바로 통화 가능한 번호</span></td>
              </tr>
            </tbody>
          </table>

          <h2>2. 상비약 목록 <span>— 약마다 한 줄씩 적어주세요</span></h2>
          <table className="med">
            <tbody>
              <tr>
                <th style={{ width: "32%" }}>약 이름 (제품명)</th><th style={{ width: "15%" }}>증상/용도</th>
                <th style={{ width: "12%" }}>1회 용량</th><th style={{ width: "10%" }}>1일 최대</th>
                <th style={{ width: "13%" }}>복용 간격</th><th>비고 (식후 등)</th>
              </tr>
              <tr className="ex">
                <td><span className="exb">예시</span>어린이 타이레놀 시럽</td><td>발열 38℃ 이상</td>
                <td>5 ml</td><td>4회</td><td>4~6시간</td><td>식사 무관</td>
              </tr>
              {[0, 1, 2, 3, 4].map(r => (
                <tr key={r}><td></td><td></td><td></td><td></td><td></td><td></td></tr>
              ))}
            </tbody>
          </table>

          <h2>3. 복용 케어 안내</h2>
          <div className="notes">
            · 아이가 열이나 복통을 호소하면 <b>보호자님께 먼저 안내(연락) 드린 후</b> 기재된 용량으로 복용을 도와드립니다.<br />
            · 단, <b>38℃ 이상 고열</b> 또는 <b>심한 복통</b>을 호소하는 경우에는 연락이 닿지 않아도 <b>학원 판단하에 즉시 복용</b>시켜 드립니다.<br />
            · <b>38℃ 이상 발열 시에는 해열제 복용 후 하원(조퇴)</b>해야 하며, 가정에서 회복 후 등원해 주세요.<br />
            · 기재된 용량·간격 안에서만 복용을 도와드리며, 병원 처방약은 처방전(복약안내문) 사본을 함께 전달해 주세요.<br />
            · 보내주신 상비약은 <b>원에서 보관</b>하며, <b>졸업식 때 돌려드립니다.</b>
          </div>

          <h2>4. 보호자 확인</h2>
          <div className="notes">위 기재 내용과 3번 복용 케어 방침(고열·심한 복통 시 선복용, 38℃ 이상 발열 시 하원)에 동의합니다.</div>
          <div className="sign">
            <span>날짜 : &nbsp;20&nbsp;&nbsp;&nbsp;&nbsp;. &nbsp;&nbsp;&nbsp;&nbsp;. &nbsp;&nbsp;&nbsp;&nbsp;</span>
            <span>보호자 성함 : <span className="ln"></span></span>
            <span>서명 : <span className="ln"></span></span>
          </div>
        </div>
        <div className="ft">DREAM ACADEMY · 아이 1명당 1장씩 작성해 주세요 · 문의: 카카오톡 채널</div>
      </div>
    ))}
  </>);
}

export default function MedFormPage() {
  return <Suspense fallback={null}><MedFormInner /></Suspense>;
}
