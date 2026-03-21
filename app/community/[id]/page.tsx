"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Post } from "../data";

interface Comment {
  id: number;
  post_id: number;
  author_name: string;
  content: string;
  created_at: string;
}

export default function CommunityDetailPage() {
  const params = useParams();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentForm, setCommentForm] = useState({ author_name: "", content: "" });
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const nav = document.getElementById("mainNav");
      if (nav) {
        nav.style.boxShadow =
          window.scrollY > 20
            ? "0 2px 20px rgba(0,0,0,0.1)"
            : "0 1px 3px rgba(0,0,0,0.08)";
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    async function fetchPost() {
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", Number(params.id))
        .single();

      if (!error && data) {
        setPost(data);
      }
      setLoading(false);
    }
    fetchPost();
    fetchComments();
  }, [params.id]);

  async function fetchComments() {
    const { data } = await supabase
      .from("comments")
      .select("*")
      .eq("post_id", Number(params.id))
      .order("created_at", { ascending: true });

    if (data) setComments(data);
  }

  async function handleLike() {
    if (!post || liked) return;
    const newLikes = post.likes + 1;
    const { error } = await supabase
      .from("posts")
      .update({ likes: newLikes })
      .eq("id", post.id);

    if (!error) {
      setPost({ ...post, likes: newLikes });
      setLiked(true);
    }
  }

  async function handleCommentSubmit() {
    if (!commentForm.author_name.trim() || !commentForm.content.trim()) {
      alert("작성자와 내용을 모두 입력해주세요.");
      return;
    }
    setCommentSubmitting(true);
    const { error } = await supabase.from("comments").insert({
      post_id: Number(params.id),
      author_name: commentForm.author_name.trim(),
      content: commentForm.content.trim(),
    });
    if (error) {
      alert("댓글 등록에 실패했습니다.");
    } else {
      setCommentForm({ author_name: "", content: "" });
      await fetchComments();
    }
    setCommentSubmitting(false);
  }

  function formatDate(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  if (loading) {
    return (
      <div style={{ padding: "160px 40px 80px", textAlign: "center", fontFamily: "'Noto Sans KR',sans-serif", color: "#6b7c93" }}>
        불러오는 중...
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ padding: "160px 40px 80px", textAlign: "center", fontFamily: "'Noto Sans KR',sans-serif" }}>
        <h2>게시글을 찾을 수 없습니다.</h2>
        <a href="/community" style={{ color: "#1a6fc4", marginTop: "20px", display: "inline-block" }}>← 목록으로 돌아가기</a>
      </div>
    );
  }

  return (
    <>
      <style>{`
        :root {
          --blue:#1a6fc4; --blue-dark:#0d3d7a; --blue-light:#eaf3fb;
          --sky:#29a9e0; --yellow:#f5a623; --orange:#FF6B35;
          --white:#fff; --off:#f8fafc; --text:#1a1a2e; --muted:#6b7c93;
          --stroke:#e2e8f0;
        }
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        body{font-family:'Noto Sans KR',sans-serif;color:var(--text);background:var(--white);overflow-x:hidden;}
        a{text-decoration:none;color:inherit;}

        /* NAV */
        nav{position:fixed;top:0;left:0;right:0;z-index:300;height:66px;display:flex;align-items:center;padding:0 40px;background:rgba(255,255,255,0.97);backdrop-filter:blur(12px);border-bottom:1px solid var(--stroke);box-shadow:0 1px 3px rgba(0,0,0,0.08);gap:0;}
        .logo{font-family:'Montserrat',sans-serif;font-size:20px;font-weight:800;color:var(--text);flex-shrink:0;margin-right:32px;}
        .logo .D{color:var(--sky);} .logo .A{color:var(--yellow);}
        .nav-center{display:flex;align-items:center;flex:1;}
        .nav-center>a,.nav-dd>a{color:#374151;font-size:14px;font-weight:500;padding:0 14px;height:66px;display:flex;align-items:center;gap:4px;transition:color 160ms;white-space:nowrap;}
        .nav-center>a:hover,.nav-dd>a:hover{color:var(--blue);}
        .nav-active{color:var(--blue)!important;font-weight:700!important;}
        .nav-dd{position:relative;}
        .nav-dd-arrow{font-size:10px;transition:transform 200ms;}
        .nav-dd:hover .nav-dd-arrow{transform:rotate(180deg);}
        .nav-dd-menu{position:absolute;top:66px;left:0;background:var(--white);min-width:165px;border:1px solid var(--stroke);border-top:2px solid var(--blue);box-shadow:0 8px 24px rgba(0,0,0,0.1);opacity:0;pointer-events:none;transform:translateY(-6px);transition:all 180ms;}
        .nav-dd:hover .nav-dd-menu{opacity:1;pointer-events:all;transform:translateY(0);}
        .nav-dd-menu a{display:block;padding:11px 18px;font-size:13.5px;color:#374151;border-bottom:1px solid var(--stroke);transition:background 140ms,color 140ms;}
        .nav-dd-menu a:last-child{border-bottom:none;}
        .nav-dd-menu a:hover{background:var(--blue-light);color:var(--blue);}
        .nav-right{display:flex;align-items:center;flex-shrink:0;}
        .nav-cta{background:var(--blue);color:var(--white);font-size:13.5px;font-weight:600;padding:9px 20px;border-radius:4px;transition:background 160ms;}
        .nav-cta:hover{background:var(--blue-dark);}
        .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;background:none;border:none;}
        .hamburger span{width:22px;height:2px;background:var(--text);display:block;}
        .mob-nav{display:none;position:fixed;top:66px;left:0;right:0;background:var(--white);z-index:299;padding:16px 24px 24px;flex-direction:column;border-top:1px solid var(--stroke);box-shadow:0 8px 24px rgba(0,0,0,0.1);}
        .mob-nav.open{display:flex;}
        .mob-nav a{padding:12px 0;color:#374151;font-size:14px;border-bottom:1px solid var(--stroke);}

        /* DETAIL */
        .detail-sec{padding:100px 60px 80px;max-width:800px;margin:0 auto;}
        .detail-back{display:inline-flex;align-items:center;gap:6px;font-size:13px;color:var(--muted);margin-bottom:24px;transition:color 140ms;}
        .detail-back:hover{color:var(--blue);}
        .detail-header{border-bottom:2px solid var(--text);padding-bottom:20px;margin-bottom:0;}
        .detail-title{font-size:24px;font-weight:800;line-height:1.35;margin-bottom:14px;word-break:keep-all;}
        .detail-meta{display:flex;gap:20px;font-size:12.5px;color:var(--muted);}
        .detail-meta span{display:flex;align-items:center;gap:4px;}
        .detail-body{padding:32px 0;border-bottom:1px solid var(--stroke);font-size:14.5px;color:#374151;line-height:2;white-space:pre-wrap;word-break:keep-all;min-height:200px;}
        .detail-actions{padding:24px 0;display:flex;align-items:center;justify-content:center;gap:16px;border-bottom:1px solid var(--stroke);}
        .like-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 24px;background:#fef2f2;color:#dc2626;font-size:14px;font-weight:700;border-radius:24px;border:1px solid #fecaca;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:all 160ms;}
        .like-btn:hover{background:#fee2e2;border-color:#fca5a5;}
        .like-btn.liked{background:#dc2626;color:var(--white);border-color:#dc2626;cursor:default;}

        /* COMMENTS */
        .comments-sec{padding:32px 0;}
        .comments-title{font-size:16px;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px;}
        .comments-title .cnt{font-size:14px;color:var(--blue);font-weight:700;}
        .comment-write{background:#f8fafc;border:1px solid var(--stroke);border-radius:12px;padding:20px;margin-bottom:24px;}
        .comment-write-row{display:flex;gap:10px;margin-bottom:10px;align-items:center;}
        .comment-author-input{width:140px;padding:8px 12px;border:1px solid var(--stroke);border-radius:6px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;}
        .comment-author-input:focus{border-color:var(--blue);}
        .comment-content-input{flex:1;padding:8px 12px;border:1px solid var(--stroke);border-radius:6px;font-size:13px;font-family:'Noto Sans KR',sans-serif;outline:none;resize:none;min-height:60px;}
        .comment-content-input:focus{border-color:var(--blue);}
        .comment-submit{padding:8px 20px;background:var(--blue);color:var(--white);font-size:13px;font-weight:600;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;transition:background 160ms;align-self:flex-end;}
        .comment-submit:hover{background:var(--blue-dark);}
        .comment-submit:disabled{background:#94a3b8;cursor:not-allowed;}
        .comment-list{display:flex;flex-direction:column;gap:0;}
        .comment-item{padding:16px 0;border-bottom:1px solid var(--stroke);}
        .comment-item:last-child{border-bottom:none;}
        .comment-head{display:flex;align-items:center;gap:10px;margin-bottom:6px;}
        .comment-name{font-size:13px;font-weight:700;color:var(--text);}
        .comment-time{font-size:11px;color:#94a3b8;font-family:'Montserrat',sans-serif;}
        .comment-text{font-size:13.5px;color:#374151;line-height:1.7;white-space:pre-wrap;word-break:keep-all;}
        .no-comments{text-align:center;padding:32px;color:#94a3b8;font-size:13px;}

        .detail-footer{padding:24px 0;display:flex;justify-content:center;}
        .list-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 28px;background:#f1f5f9;color:var(--text);font-size:13px;font-weight:600;border-radius:6px;border:1px solid var(--stroke);transition:background 140ms;}
        .list-btn:hover{background:#e2e8f0;}

        /* FOOTER */
        footer{background:#1e293b;padding:40px 60px 24px;border-top:1px solid rgba(255,255,255,0.07);}
        .footer-inner{max-width:1200px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px;}
        .flogo{font-family:'Montserrat',sans-serif;font-size:18px;font-weight:800;color:var(--white);}
        .flogo .D{color:#5dc8f0;} .flogo .A{color:var(--yellow);}
        .flinks{display:flex;gap:20px;flex-wrap:wrap;}
        .flinks a{font-size:13px;color:rgba(255,255,255,0.45);transition:color 150ms;}
        .flinks a:hover{color:rgba(255,255,255,0.85);}
        .fcopy{font-size:11.5px;color:rgba(255,255,255,0.2);font-family:'Montserrat',sans-serif;margin-top:16px;max-width:1200px;margin-left:auto;margin-right:auto;}

        @media(max-width:1024px){
          nav{padding:0 24px;} .nav-center{display:none;} .nav-right{display:none;} .hamburger{display:flex;}
          .detail-sec{padding:90px 24px 60px;}
          .detail-title{font-size:20px;}
          .comment-write-row{flex-direction:column;}
          .comment-author-input{width:100%;}
          .footer-inner{flex-direction:column;align-items:flex-start;}
        }
      `}</style>

      {/* NAV */}
      <nav id="mainNav">
        <a href="/" className="logo"><span className="D">D</span>ream<span className="A">A</span>cademy</a>
        <div className="nav-center">
          <div className="nav-dd">
            <a href="#">커리큘럼 <span className="nav-dd-arrow">▾</span></a>
            <div className="nav-dd-menu">
              <a href="/junior">주니어 커리큘럼</a>
              <a href="/kinder">킨더 커리큘럼</a>
            </div>
          </div>
          <a href="/package">올인원패키지</a>
          <div className="nav-dd">
            <a href="#">숙소 <span className="nav-dd-arrow">▾</span></a>
            <div className="nav-dd-menu">
              <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
              <a href="/accommodation/jpark">제이파크</a>
              <a href="/accommodation/cubenine">큐브나인</a>
            </div>
          </div>
          <a href="/playdream">플레이드림</a>
          <a href="/apply">패키지서비스신청</a>
          <a href="/notice">공지사항</a>
          <a href="/community" className="nav-active">커뮤니티</a>
        </div>
        <div className="nav-right">
          <a href="/login" style={{color:"#374151",fontSize:"13.5px",fontWeight:600,marginRight:"10px"}}>로그인</a><a href="http://pf.kakao.com/_Yuhxhn/chat" className="nav-cta" target="_blank" rel="noopener noreferrer">상담하기</a>
        </div>
        <button className="hamburger" onClick={() => setMobileNavOpen((v) => !v)}>
          <span></span><span></span><span></span>
        </button>
      </nav>

      {/* MOBILE NAV */}
      <div className={`mob-nav${mobileNavOpen ? " open" : ""}`}>
        <a href="/junior">주니어 커리큘럼</a>
        <a href="/kinder">킨더 커리큘럼</a>
        <a href="/package">올인원패키지</a>
        <a href="/accommodation/dreamhouse">드림하우스 (독채)</a>
        <a href="/accommodation/jpark">제이파크</a>
        <a href="/accommodation/cubenine">큐브나인</a>
        <a href="/playdream">플레이드림</a>
        <a href="/apply">패키지서비스신청</a>
        <a href="/notice">공지사항</a>
        <a href="/community" style={{ color: "var(--blue)", fontWeight: 700 }}>▶ 커뮤니티</a>
        <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기 →</a>
      </div>

      {/* DETAIL */}
      <div className="detail-sec">
        <a href="/community" className="detail-back">← 목록으로</a>
        <div className="detail-header">
          <h1 className="detail-title">{post.title}</h1>
          <div className="detail-meta">
            <span>✍️ {post.author_name}</span>
            <span>📅 {formatDate(post.created_at)}</span>
            <span>♥ {post.likes}</span>
          </div>
        </div>
        <div className="detail-body">{post.content}</div>
        <div className="detail-actions">
          <button className={`like-btn${liked ? " liked" : ""}`} onClick={handleLike}>
            {liked ? "♥ 좋아요 완료" : `♡ 좋아요 ${post.likes}`}
          </button>
        </div>

        {/* COMMENTS */}
        <div className="comments-sec">
          <div className="comments-title">💬 댓글 <span className="cnt">{comments.length}</span></div>

          <div className="comment-write">
            <div className="comment-write-row">
              <input
                className="comment-author-input"
                placeholder="작성자"
                value={commentForm.author_name}
                onChange={(e) => setCommentForm({ ...commentForm, author_name: e.target.value })}
              />
            </div>
            <textarea
              className="comment-content-input"
              placeholder="댓글을 입력하세요"
              value={commentForm.content}
              onChange={(e) => setCommentForm({ ...commentForm, content: e.target.value })}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button
                className="comment-submit"
                disabled={commentSubmitting}
                onClick={handleCommentSubmit}
              >
                {commentSubmitting ? "등록 중..." : "댓글 등록"}
              </button>
            </div>
          </div>

          <div className="comment-list">
            {comments.length === 0 ? (
              <div className="no-comments">아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</div>
            ) : (
              comments.map((c) => (
                <div className="comment-item" key={c.id}>
                  <div className="comment-head">
                    <span className="comment-name">{c.author_name}</span>
                    <span className="comment-time">{formatDateTime(c.created_at)}</span>
                  </div>
                  <div className="comment-text">{c.content}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="detail-footer">
          <a href="/community" className="list-btn">📋 목록으로 돌아가기</a>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <span className="flogo"><span className="D">D</span>ream<span className="A">A</span>cademy</span>
          <div className="flinks">
            <a href="/">홈</a>
            <a href="/junior">주니어 커리큘럼</a>
            <a href="/kinder">킨더 커리큘럼</a>
            <a href="/package">올인원패키지</a>
            <a href="/notice">공지사항</a>
            <a href="/community">커뮤니티</a>
            <a href="http://pf.kakao.com/_Yuhxhn/chat" target="_blank" rel="noopener noreferrer">상담하기</a>
          </div>
        </div>
        <div className="fcopy">© 2026 Dream Academy by Dream Company. All rights reserved. · Cebu, Philippines</div>
        <div style={{textAlign:"right",maxWidth:1200,margin:"8px auto 0"}}><a href="/admin" style={{fontSize:"20px",color:"#fff",fontWeight:900,textDecoration:"none"}}>관리자</a></div>
      </footer>
    </>
  );
}
