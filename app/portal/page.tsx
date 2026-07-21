"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PortalPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [portalId, setPortalId] = useState('');
  const [portalPw, setPortalPw] = useState('');

  async function loginWithId() {
    if (!portalId.trim() || !portalPw.trim()) {
      setError('아이디와 비밀번호를 입력해주세요.'); return;
    }
    setLoading(true); setError('');
    const email = `${portalId.trim()}@dreamacademyph.com`;
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password: portalPw });
    if (authError) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      setLoading(false); return;
    }
    const bookingRes = await fetch('/api/portal/find-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.user.id })
    });
    const bookingData = bookingRes.ok ? await bookingRes.json() : null;
    const booking = bookingData?.booking;

    if (typeof window !== 'undefined') {
      localStorage.setItem('portalSession', JSON.stringify({
        booking_id: booking?.id || '',
        booking_number: booking?.reservation_no || '',
        guest_name: booking?.booker_name || portalId,
        check_in_date: booking?.check_in || '',
        status: booking?.status || '',
        auth_type: 'supabase',
        expires: Date.now() + 24 * 60 * 60 * 1000
      }));
    }
    setLoading(false);
    router.push('/portal/dashboard');
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/portal/dashboard");
      }
    });
  }, [router]);

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 50%,#1a6fc4 100%);min-height:100vh}
.pt-w{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.pt-card{background:#fff;border-radius:24px;padding:48px 36px;width:100%;max-width:420px;box-shadow:0 24px 80px rgba(0,0,0,0.3);text-align:center}
.pt-logo{font-family:'Montserrat',sans-serif;font-size:28px;font-weight:900;color:#1a6fc4;margin-bottom:4px;letter-spacing:-0.5px}
.pt-sub{font-size:14px;color:#6b7c93;margin-bottom:36px}
.pt-label{display:block;text-align:left;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px}
.pt-input{width:100%;padding:14px 16px;border:2px solid #e2e8f0;border-radius:12px;font-size:15px;font-family:inherit;outline:none;transition:border-color 200ms;margin-bottom:18px}
.pt-input:focus{border-color:#1a6fc4;box-shadow:0 0 0 3px rgba(26,111,196,0.1)}
.pt-input::placeholder{color:#cbd5e1}
.pt-btn{width:100%;padding:16px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:16px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;transition:opacity 200ms;margin-top:8px}
.pt-btn:hover{opacity:0.9}
.pt-btn:disabled{opacity:0.5;cursor:not-allowed}
.pt-err{margin-top:16px;padding:12px 16px;background:#fef2f2;color:#dc2626;border-radius:10px;font-size:13px;font-weight:600;border:1px solid #fecaca}
.pt-footer{margin-top:28px;font-size:12px;color:#94a3b8}
.pt-footer a{color:#1a6fc4;text-decoration:none;font-weight:600}.pt-footer a:hover{text-decoration:underline}
.pt-hint{font-size:11px;color:#94a3b8;text-align:left;margin-top:-12px;margin-bottom:14px}
@media(max-width:500px){.pt-card{padding:36px 24px;border-radius:20px}.pt-input,.pt-btn{min-height:50px;font-size:16px}}
    `}</style>
    <div className="pt-w">
      <div className="pt-card">
        <div className="pt-logo">DREAM ACADEMY</div>
        <div className="pt-sub">예약 조회 포털</div>
        <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'4px',marginBottom:'14px'}}>
          드림아카데미에서 발급받은 아이디로 로그인하세요
        </div>

          <div style={{display:'flex', flexDirection:'column', gap:12}}>
            <div>
              <label style={{fontSize:13, color:'#374151', display:'block', marginBottom:4}}>아이디</label>
              <input
                value={portalId}
                onChange={e => setPortalId(e.target.value)}
                placeholder="예) SJH0105"
                style={{width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:15, boxSizing:'border-box'}}
              />
            </div>
            <div>
              <label style={{fontSize:13, color:'#374151', display:'block', marginBottom:4}}>비밀번호</label>
              <input
                type="password"
                value={portalPw}
                onChange={e => setPortalPw(e.target.value)}
                onKeyDown={e => e.key==='Enter' && loginWithId()}
                placeholder="비밀번호 입력"
                style={{width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:15, boxSizing:'border-box'}}
              />
            </div>
            {error && <p style={{color:'#dc2626', fontSize:13, margin:0}}>{error}</p>}
            <button
              onClick={loginWithId}
              disabled={loading}
              style={{width:'100%', padding:'12px', background:'#7c3aed', color:'white', border:'none', borderRadius:8, fontSize:16, fontWeight:600, cursor:'pointer'}}
            >
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </div>

        <div className="pt-footer">
          <a href="/">← 드림아카데미 홈으로</a>
        </div>
      </div>
    </div>
  </>);
}
