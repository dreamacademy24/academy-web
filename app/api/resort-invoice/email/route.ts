import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// 리조트 인보이스 이메일 발송 (이미지 첨부)
// 환경변수: MAIL_USER / MAIL_PASS (Namecheap Private Email, 예: admin@dreamacademyph.com)
export async function POST(req: Request) {
  try {
    const { to, cc, subject, text, imageBase64, filename, extraAttachments } = await req.json();
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
      to,
      cc: cc || undefined,
      subject: subject || "Invoice from Dream Company",
      text: text || "Please find the attached invoice.",
      attachments,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
}
