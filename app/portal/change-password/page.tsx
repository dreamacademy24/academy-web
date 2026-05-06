'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleChange() {
    if (!newPw || newPw.length < 6) { setMsg('새 비밀번호는 6자 이상이어야 합니다.'); return; }
    if (newPw !== confirm) { setMsg('비밀번호가 일치하지 않습니다.'); return; }
    setLoading(true); setMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { setMsg('변경 실패: ' + error.message); }
    else { setMsg('✅ 비밀번호가 변경되었습니다!'); }
    setLoading(false);
  }

  return (
    <div style={{minHeight:'100vh', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center'}}>
      <div style={{background:'white', borderRadius:16, padding:32, width:360, boxShadow:'0 4px 20px rgba(0,0,0,0.08)'}}>
        <button onClick={() => router.back()} style={{background:'none', border:'none', color:'#6b7280', cursor:'pointer', marginBottom:16, fontSize:13}}>← 뒤로</button>
        <h2 style={{margin:'0 0 24px', fontSize:20, fontWeight:700}}>비밀번호 변경</h2>
        <div style={{display:'flex', flexDirection:'column', gap:12}}>
          <div>
            <label style={{fontSize:13, color:'#374151', display:'block', marginBottom:4}}>새 비밀번호</label>
            <input type="password" value={newPw} onChange={e=>setNewPw(e.target.value)}
              placeholder="6자 이상" style={{width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, boxSizing:'border-box'}} />
          </div>
          <div>
            <label style={{fontSize:13, color:'#374151', display:'block', marginBottom:4}}>비밀번호 확인</label>
            <input type="password" value={confirm} onChange={e=>setConfirm(e.target.value)}
              onKeyDown={e=>e.key==='Enter' && handleChange()}
              placeholder="동일하게 입력" style={{width:'100%', padding:'10px 12px', border:'1px solid #d1d5db', borderRadius:8, fontSize:14, boxSizing:'border-box'}} />
          </div>
          {msg && <p style={{fontSize:13, color: msg.includes('✅') ? '#16a34a' : '#dc2626', margin:0}}>{msg}</p>}
          <button onClick={handleChange} disabled={loading}
            style={{width:'100%', padding:'12px', background:'#7c3aed', color:'white', border:'none', borderRadius:8, fontSize:15, fontWeight:600, cursor:'pointer'}}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </div>
      </div>
    </div>
  );
}
