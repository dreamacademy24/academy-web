import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import {portalDb, workspaceStaffIdentity} from "@/lib/portalAuth";
const validEmail = (v:string) => /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(v);
export async function GET(req:Request) {
 const username=await workspaceStaffIdentity(req);
 if(!username)return NextResponse.json({error:"직원 로그인이 필요합니다."},{status:401});
 const db=portalDb();
 const [settings,staff]=await Promise.all([db.from("app_settings").select("value").eq("key","resort_sender_email:"+username).maybeSingle(),db.from("staff_accounts").select("signature").eq("username",username).maybeSingle()]);
 if(settings.error||staff.error)return NextResponse.json({error:"직원 이메일 조회 실패"},{status:500});
 const senderEmail=String(settings.data?.value?.email || staff.data?.signature?.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || (username==="admin-ceo"?"deskor112@gmail.com":""));
 return NextResponse.json({senderEmail},{headers:{"Cache-Control":"no-store"}});
}

// 리조트 인보이스 이메일 발송 (이미지 첨부)
// 환경변수: MAIL_USER / MAIL_PASS (Namecheap Private Email, 예: admin@dreamacademyph.com)
export async function POST(req: Request) {
  try {
    const username=await workspaceStaffIdentity(req);
    if(!username)return NextResponse.json({error:"직원 로그인이 필요합니다."},{status:401});
    const { to, cc, subject, text, imageBase64, filename, extraAttachments, resort, senderEmail } = await req.json();
    const isCube=resort === "cubenine" || String(to).toLowerCase().includes("cube9resort@gmail.com");
    let finalTo=to, finalCc=cc;
    if(isCube){
      const employee=String(senderEmail||"").trim();
      if(!validEmail(employee))return NextResponse.json({error:"발송 직원의 참조 이메일이 필요합니다."},{status:400});
      const copies=["kimkimsky123@naver.com","deskor112@gmail.com",employee,...String(cc||"").split(/[,;]/).map(s=>s.trim()).filter(Boolean)];
      if(copies.some(v=>!validEmail(v)))return NextResponse.json({error:"참조 이메일 형식을 확인해주세요."},{status:400});
      finalTo="cube9resort@gmail.com"; finalCc=[...new Set(copies.map(v=>v.toLowerCase()))].filter(v=>v!==finalTo).join(", ");
      const saved=await portalDb().from("app_settings").upsert({key:"resort_sender_email:"+username,value:{email:employee}},{onConflict:"key"});
      if(saved.error)return NextResponse.json({error:"직원 이메일 저장 실패"},{status:500});
    }
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    if (!user || !pass) {
      return NextResponse.json(
        { error: "메일 계정이 설정되지 않았습니다. Vercel 환경변수 MAIL_USER / MAIL_PASS를 등록해주세요. (Namecheap Private Email)" },
        { status: 500 },
      );
    }
    if (!to) return NextResponse.json({ error: "받는 이메일 주소가 없습니다." }, { status: 400 });

    const transporter = nodemailer.createTransport({
      host: "mail.privateemail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    const attachments: { filename: string; content: Buffer }[] = imageBase64
      ? [{
          filename: filename || "invoice.png",
          content: Buffer.from(String(imageBase64).replace(/^data:image\/\w+;base64,/, ""), "base64"),
        }]
      : [];
    if (Array.isArray(extraAttachments)) {
      for (const a of extraAttachments) {
        if (!a || !a.dataUrl) continue;
        attachments.push({
          filename: String(a.name || "attachment"),
          content: Buffer.from(String(a.dataUrl).replace(/^data:[^;]+;base64,/, ""), "base64"),
        });
      }
    }

    await transporter.sendMail({
      from: `Dream Company <${user}>`,
      to: finalTo,
      cc: finalCc || undefined,
      subject: subject || "Invoice from Dream Company",
      text: text || "Please find the attached invoice.",
      attachments,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
