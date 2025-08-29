import React, { useEffect, useState } from "react";
import {
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot,
  updateDoc, deleteDoc, doc, where
} from "firebase/firestore";
import {
  onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "firebase/auth";
import { db, auth } from "./firebase";

/* ===== 常量 ===== */
const ADMIN_EMAILS = ["wan8ting@gmail.com"];
const MIN_AGE = 16;
const MAX_INTRO_LEN = 200;
const BANNED_WORDS = ["約炮", "騷擾", "仇恨", "種族歧視", "霸凌", "毒品"];

/* ===== 小工具 ===== */
const isAdmin = (u) => !!u && ADMIN_EMAILS.includes(u.email || "");
const containsBanned = (t) =>
  BANNED_WORDS.some((w) => (t || "").toLowerCase().includes(w.toLowerCase()));
function timeSince(ts) {
  const d = new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
}
function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

/* ===== Hash Router（#home / #feed / #submit / #admin） ===== */
function useHashPage() {
  const getHash = () => (window.location.hash?.slice(1) || "home");
  const [page, setPage] = useState(getHash());

  useEffect(() => {
    // 預設導向 #home
    if (!window.location.hash) {
      window.location.hash = "home";
      setPage("home");
    }
    const onChange = () => setPage(getHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const nav = (to) => { window.location.hash = to; setPage(to); };
  return [page, nav];
}

/* ===== App ===== */
export default function App() {
  const user = useAuth();
  const [page, nav] = useHashPage();
  const [posts, setPosts] = useState([]);
  const [pending, setPending] = useState([]);

  // 公開牆
  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, []);

  // 待審
  useEffect(() => {
    if (!isAdmin(user)) return;
    const q = query(
      collection(db, "posts"),
      where("approved", "==", false),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, (snap) =>
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
  }, [user]);

  // 入口頁不顯示 header，其它頁顯示簡潔頂欄
  return (
    <div style={{ minHeight: "100vh", background: "#fafafa", color: "#111" }}>
      {page !== "home" && (
        <div style={{
          position: "sticky", top: 0, zIndex: 10, backdropFilter: "saturate(180%) blur(10px)",
          background: "rgba(255,255,255,.85)", borderBottom: "1px solid #eee"
        }}>
          <div style={{ maxWidth: 720, margin: "0 auto", padding: "12px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600, cursor: "pointer" }} onClick={() => nav("home")}>
              匿名投稿板 · 七夕特別版
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Pill onClick={() => nav("feed")} active={page==="feed"}>看投稿</Pill>
              <Pill onClick={() => nav("submit")} active={page==="submit"}>我要投稿</Pill>
              {isAdmin(user) && <Pill onClick={() => nav("admin")} active={page==="admin"} tone="pink">審核區</Pill>}
            </div>
          </div>
        </div>
      )}

      {/* 入口頁 */}
      {page === "home" && <Landing nav={nav} />}

      {/* 看投稿 */}
      {page === "feed" && (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
          <Feed posts={posts} />
          <FooterNotice compact />
        </main>
      )}

      {/* 投稿頁 */}
      {page === "submit" && (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
          <SubmitForm />
          <FooterNotice />
        </main>
      )}

      {/* 審核區 */}
      {page === "admin" && (
        <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
          {isAdmin(user) ? <AdminPanel pending={pending} user={user} /> : <LoginPanel />}
        </main>
      )}
    </div>
  );
}

/* ===== UI 小元件 ===== */
function Pill({ children, onClick, active, tone }) {
  const activeStyle = active
    ? { background: tone==="pink" ? "#d946ef" : "#111", color: "#fff" }
    : { background: "#e5e7eb", color: "#111" };
  return (
    <button onClick={onClick} style={{
      ...activeStyle, border: "none", borderRadius: 999, padding: "8px 14px",
      fontSize: 14, fontWeight: 600
    }}>{children}</button>
  );
}

/* ===== 入口頁（置中兩顆大按鈕） ===== */
function Landing({ nav }) {
  return (
    <main style={{
      maxWidth: 720, margin: "0 auto", padding: "48px 16px 24px",
      display: "flex", flexDirection: "column", alignItems: "center"
    }}>
      <h1 style={{ textAlign: "center", fontSize: 24, fontWeight: 700, marginBottom: 24 }}>
        匿名投稿板 · 七夕特別版
      </h1>

      <div style={{ display: "flex", gap: 16, marginBottom: 40 }}>
        <button onClick={() => nav("feed")} style={bigBtn(false)}>看投稿</button>
        <button onClick={() => nav("submit")} style={bigBtn(true)}>我要投稿</button>
      </div>

      <div style={{ width: "100%" }}>
        <FooterNotice compact />
      </div>
    </main>
  );
}

const bigBtn = (primary) => ({
  padding: "12px 18px",
  borderRadius: 999,
  fontSize: 24,
  fontWeight: 700,
  border: "none",
  background: primary ? "#111" : "#e5e7eb",
  color: primary ? "#fff" : "#111",
});

/* ===== 守則 ===== */
function FooterNotice({ compact }) {
  return (
    <div style={{
      marginTop: 16, padding: 16, borderRadius: 16, background: "#fff",
      border: "1px solid #eee", boxShadow: "0 1px 2px rgba(0,0,0,.03)"
    }}>
      <div style={{ marginBottom: 8, fontSize: compact ? 12 : 14 }}>
        注意事項與聲明（請務必閱讀）
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: compact ? 12 : 14, lineHeight: 1.7 }}>
        <li>僅限 {MIN_AGE}+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

/* ===== 投稿表單（順序&驗證） ===== */
function SubmitForm() {
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [intro, setIntro] = useState("");
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const ageNum = parseInt(age, 10);
  const canSubmit =
    Number.isInteger(ageNum) && ageNum >= MIN_AGE &&
    nickname.trim() && intro.trim() && intro.length <= MAX_INTRO_LEN &&
    agree && !busy;

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (!Number.isInteger(ageNum) || ageNum < MIN_AGE) {
      alert(`年齡需大於或等於 ${MIN_AGE} 歲！`);
      return;
    }
    if (containsBanned(intro)) {
      setMsg("內容疑似含有不當字詞，請調整後再送出。");
      return;
    }
    setBusy(true);
    try {
      await addDoc(collection(db, "posts"), {
        nickname: nickname.trim(),
        age: ageNum,
        contact: contact.trim(),
        intro: intro.trim(),
        approved: false,
        reportsCount: 0,
        createdAt: serverTimestamp(),
      });
      setMsg("已送出！通過審核後會出現在公開牆。");
      setNickname(""); setAge(""); setContact(""); setIntro(""); setAgree(false);
    } catch (err) {
      console.error(err);
      const detail = err?.message?.includes("Missing or insufficient permissions")
        ? "沒有權限寫入資料庫：請檢查 Firestore 規則與網域設定。"
        : (err?.message || "送出失敗，請稍後再試。");
      setMsg(detail);
      alert(detail);
    } finally {
      setBusy(false);
    }
  }

  const label = { fontSize: 14, fontWeight: 600, marginBottom: 6 };
  const input = { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#f6f7f8" };
  const card = { padding: 16, borderRadius: 16, background: "#fff", border: "1px solid #eee", boxShadow: "0 1px 2px rgba(0,0,0,.03)" };

  return (
    <form onSubmit={handleSubmit} style={{ ...card, display: "grid", gap: 16 }}>
      {/* 稱呼 */}
      <div>
        <div style={label}>稱呼（必填）</div>
        <input
          style={input}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例如：VIC、平崎…"
          required
        />
      </div>

      {/* 年齡 */}
      <div>
        <div style={label}>年齡（必填）</div>
        <input
          style={{ ...input, width: 160 }}
          type="number"
          inputMode="numeric"
          min={MIN_AGE}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder={`請輸入年齡（至少 ${MIN_AGE} ）`}
          required
        />
      </div>

      {/* 聯絡方式 */}
      <div>
        <div style={label}>聯絡方式（選填，IG / Threads / Email 擇一）</div>
        <input
          style={input}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="@your_ig 或 @your_threads 或 your@mail.com"
        />
      </div>

      {/* 自我介紹（大框） */}
      <div>
        <div style={label}>自我介紹（最多 {MAX_INTRO_LEN} 字）</div>
        <textarea
          style={{ ...input, minHeight: 160 }}
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
          required
        />
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, textAlign: "right" }}>
          {intro.length} / {MAX_INTRO_LEN}
        </div>
      </div>

      {/* 同意守則 */}
      <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14, lineHeight: 1.6 }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>我已閱讀並同意守則，且保證年齡屬實、內容不含違規事項。</span>
      </label>

      <button
        disabled={!canSubmit}
        style={{
          width: "100%", padding: "14px 16px", borderRadius: 16,
          background: "#111", color: "#fff", fontSize: 18, fontWeight: 700, border: "none",
          opacity: canSubmit ? 1 : .5
        }}
      >
        {busy ? "送出中…" : "送出投稿（待審）"}
      </button>

      {msg && <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{msg}</div>}
    </form>
  );
}

/* ===== 公開牆 ===== */
function Feed({ posts }) {
  return posts.length === 0 ? (
    <div style={{ textAlign: "center", fontSize: 14, color: "#6b7280" }}>
      目前還沒有公開投稿，等等再來逛～
    </div>
  ) : (
    <div style={{ display: "grid", gap: 16 }}>
      {posts.map((p) => <PostCard key={p.id} post={p} />)}
    </div>
  );
}
function PostCard({ post }) {
  const [showContact, setShowContact] = useState(false);
  const created = post.createdAt?.toDate?.() || new Date();

  async function adminUnapprove() {
    await updateDoc(doc(db, "posts", post.id), { approved: false });
    alert("已下架。");
  }
  async function adminDelete() {
    if (confirm("確定要永久刪除這篇投稿嗎？此動作無法復原。")) {
      await deleteDoc(doc(db, "posts", post.id));
      alert("已刪除。");
    }
  }

  return (
    <div style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid #eee", boxShadow: "0 1px 2px rgba(0,0,0,.03)" }}>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 14, fontWeight: 600 }}>
          {post.nickname ? `${post.nickname} · ` : ""}{post.age} 歲
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af" }}>發佈於 {timeSince(created)}</div>
      </div>

      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.7 }}>{post.intro}</div>

      {post.contact ? (
        <div style={{ marginTop: 12 }}>
          {!showContact ? (
            <button onClick={() => setShowContact(true)} style={{
              padding: "8px 12px", borderRadius: 12, background: "#111", color: "#fff", border: "none", fontSize: 14
            }}>
              顯示聯絡方式
            </button>
          ) : (
            <div style={{ padding: 12, borderRadius: 12, background: "#f3f4f6", border: "1px solid #e5e7eb", fontSize: 14 }}>
              聯絡方式：<span style={{ fontWeight: 600 }}>{post.contact}</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>投稿者未提供聯絡方式。</div>
      )}

      {auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email || "") && (
        <div style={{ marginTop: 12, display: "flex", gap: 8, fontSize: 14 }}>
          <button onClick={adminUnapprove} style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid #e5e7eb" }}>下架</button>
          <button onClick={adminDelete} style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid #e5e7eb", color: "#dc2626" }}>刪除</button>
        </div>
      )}
    </div>
  );
}

/* ===== 管理員登入 / 審核 ===== */
function LoginPanel() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  async function handleLogin(e) {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, email, pw); }
    catch (err) { console.error(err); setMsg("登入失敗"); alert("登入失敗，請確認帳密與允許登入網域。"); }
  }
  const card = { padding: 16, borderRadius: 16, background: "#fff", border: "1px solid #eee", boxShadow: "0 1px 2px rgba(0,0,0,.03)" };
  const input = { width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #ddd", background: "#f6f7f8" };
  return (
    <form onSubmit={handleLogin} style={{ ...card, display: "grid", gap: 12 }}>
      <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="管理員 Email" />
      <input style={input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="密碼" />
      <button style={{ padding: "10px 12px", borderRadius: 12, background: "#111", color: "#fff", border: "none" }}>
        登入
      </button>
      {msg && <div style={{ fontSize: 14, color: "#dc2626" }}>{msg}</div>}
    </form>
  );
}

function AdminPanel({ pending, user }) {
  async function approvePost(id) { await updateDoc(doc(db, "posts", id), { approved: true }); }
  async function deletePost(id) { await deleteDoc(doc(db, "posts", id)); }
  async function logout() { await signOut(auth); }
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, color: "#6b7280" }}>
        <div>你好，{user?.email}（管理員）</div>
        <button onClick={logout} style={{ textDecoration: "underline" }}>登出</button>
      </div>
      {pending.length === 0 ? (
        <div style={{ textAlign: "center", fontSize: 14, color: "#6b7280" }}>沒有待審核的投稿</div>
      ) : pending.map((p) => (
        <div key={p.id} style={{ padding: 16, borderRadius: 16, background: "#fff", border: "1px solid #eee" }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{p.nickname} · {p.age} 歲</div>
          <div style={{ whiteSpace: "pre-wrap", fontSize: 14, marginBottom: 8 }}>{p.intro}</div>
          {p.contact && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>聯絡：{p.contact}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => approvePost(p.id)} style={{ padding: "6px 10px", borderRadius: 12, background: "#16a34a", color: "#fff", border: "none" }}>通過</button>
            <button onClick={() => deletePost(p.id)} style={{ padding: "6px 10px", borderRadius: 12, border: "1px solid #e5e7eb", color: "#dc2626" }}>刪除</button>
          </div>
        </div>
      ))}
    </div>
  );
}
