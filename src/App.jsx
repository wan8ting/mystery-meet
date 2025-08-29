import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

/** =========================
 *  🔧 Firebase 設定
 *  ========================= */
const firebaseConfig = {
  apiKey: "你的 apiKey",
  authDomain: "你的 authDomain",
  projectId: "你的 projectId",
  storageBucket: "你的 storageBucket",
  messagingSenderId: "你的 messagingSenderId",
  appId: "你的 appId",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/** 可選：把你的管理員 Email 放這裡（用於顯示刪除等管理操作） */
const ADMIN_EMAILS = ["wan8ting@gmail.com"];

/** 年齡下限 */
const MIN_AGE = 16;

/** 共用樣式 */
const pageWrap = { fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans, sans-serif", padding: 20, textAlign: "center" };
const titleStyle = { margin: "10px 0 20px", lineHeight: 1.3, fontWeight: 800, letterSpacing: "0.04em" };
const navArea = { marginBottom: 30, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" };
const navBtn = {
  padding: "12px 22px",
  fontSize: 18,
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#f6f7f8",
  cursor: "pointer",
};
const blueBtn = {
  width: "100%",
  padding: "12px",
  borderRadius: 12,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontSize: 18,
  fontWeight: 700,
  cursor: "pointer",
};
const card = {
  background: "#fff",
  padding: 16,
  borderRadius: 16,
  margin: "16px auto",
  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
  maxWidth: 640,
  textAlign: "left",
  border: "1px solid #f1f5f9",
};

/** =========================
 *  主元件
 *  ========================= */
export default function App() {
  const [page, setPage] = useState("home"); // home | submit | posts | review（admin）
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  const isAdmin = useMemo(
    () => !!user && ADMIN_EMAILS.includes(user.email || ""),
    [user]
  );

  // 監聽登入狀態
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => setUser(u));
  }, []);

  // Hash route：#admin 顯示 AdminGate（登入後看審核區），其他維持單頁切換
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#admin") {
        setPage("review");
      }
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 取公開貼文
  const fetchApproved = async () => {
    const q = query(collection(db, "posts"), where("approved", "==", true));
    const snap = await getDocs(q);
    setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  // 送出投稿
  const handleSubmit = async (data) => {
    try {
      await addDoc(collection(db, "posts"), {
        nickname: data.nickname,
        age: Number(data.age),
        contact: data.contact,
        intro: data.intro,
        approved: false,
        reportsCount: 0,
        createdAt: serverTimestamp(),
      });
      alert("投稿已送出，待審核通過後才會公開！");
      setPage("home");
    } catch (err) {
      console.error(err);
      alert("送出失敗，請稍後再試");
    }
  };

  return (
    <div style={pageWrap}>
      {/* 標題 */}
      <h1 style={{ ...titleStyle, fontSize: 28 }}>匿名投稿板・七夕特別版</h1>

      {/* 導覽按鈕（文案已更名） */}
      <div style={navArea}>
        <button
          style={navBtn}
          onClick={() => {
            setPage("posts");
            fetchApproved();
          }}
        >
          自介專區
        </button>
        <button style={navBtn} onClick={() => setPage("submit")}>
          我要自介
        </button>
        {/* 管理入口 hash：/#admin（這裡顯示導向按鈕即可） */}
        <a href="#admin" style={{ ...navBtn, textDecoration: "none", color: "#111827" }}>
          管理後台
        </a>
      </div>

      {/* 頁面區塊 */}
      {page === "home" && <Home />}
      {page === "submit" && <SubmitForm onSubmit={handleSubmit} />}
      {page === "posts" && <Posts posts={posts} isAdmin={isAdmin} onDeleted={fetchApproved} />}
      {page === "review" && <AdminGate isAdmin={isAdmin} />}
    </div>
  );
}

/** =========================
 *  首頁：顯示警語守則
 *  ========================= */
function Home() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <SafetyNotice />
    </div>
  );
}

/** 警語區塊（✅ 已放回首頁使用） */
function SafetyNotice() {
  return (
    <div style={card}>
      <div style={{ fontWeight: 700, marginBottom: 10 }}>注意事項與聲明（請務必閱讀）</div>
      <ul style={{ paddingLeft: 20, lineHeight: 1.8, margin: 0 }}>
        <li>僅限 {MIN_AGE}+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

/** =========================
 *  投稿表單
 *  ========================= */
function SubmitForm({ onSubmit }) {
  const MAX = 200;
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [intro, setIntro] = useState("");
  const [agree, setAgree] = useState(false);

  const input = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
    fontSize: 16,
    outline: "none",
  };

  const onSend = (e) => {
    e.preventDefault();
    if (!nickname.trim()) return alert("請填寫稱呼");
    if (!age || Number(age) < MIN_AGE) return alert(`年齡需滿 ${MIN_AGE} 歲以上才能投稿`);
    if (!agree) return alert("請勾選並同意守則");
    onSubmit({ nickname: nickname.trim(), age: Number(age), contact: contact.trim(), intro: intro.trim() });
    setNickname("");
    setAge("");
    setContact("");
    setIntro("");
    setAgree(false);
  };

  return (
    <form onSubmit={onSend} style={{ ...card, padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <label>稱呼（必填）</label>
        <input
          style={{ ...input, marginTop: 6 }}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例如：VIC、平崎..."
          required
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label>年齡（必填）</label>
        <input
          type="number"
          style={{ ...input, marginTop: 6 }}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder={`請輸入年齡（至少 ${MIN_AGE} ）`}
          required
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label>聯絡方式（選填，IG / Threads / Email 擇一）</label>
        <input
          style={{ ...input, marginTop: 6 }}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="@your_ig 或 @your_threads 或 your@mail.com"
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label>自我介紹（最多 200 字）</label>
        <textarea
          style={{ ...input, marginTop: 6, minHeight: 120 }}
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX))}
        />
        <div style={{ fontSize: 12, color: "#6b7280", textAlign: "right" }}>
          {intro.length}/{MAX}
        </div>
      </div>

      <label style={{ display: "block", marginBottom: 16, fontSize: 14 }}>
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          style={{ marginRight: 8 }}
        />
        我已閱讀並同意守則，且保證年齡屬實、內容不含違規事項。
      </label>

      <button type="submit" style={blueBtn}>送出投稿</button>
    </form>
  );
}

/** =========================
 *  公開自介列表
 *  ========================= */
function Posts({ posts, isAdmin, onDeleted }) {
  if (!posts || posts.length === 0) {
    return <p style={{ color: "#6b7280" }}>目前還沒有公開投稿，等等再來逛～</p>;
  }

  const remove = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("確定要刪除這則公開自介嗎？")) return;
    await deleteDoc(doc(db, "posts", id));
    onDeleted?.();
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {posts.map((p) => (
        <div key={p.id} style={card}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            {p.nickname}（{p.age} 歲）
          </p>
          {p.intro && <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{p.intro}</p>}
          {p.contact && (
            <p style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>📩 {p.contact}</p>
          )}
          {isAdmin && (
            <div style={{ marginTop: 8 }}>
              <button
                onClick={() => remove(p.id)}
                style={{
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: "1px solid #ef4444",
                  background: "#fff",
                  color: "#ef4444",
                  cursor: "pointer",
                }}
              >
                刪除
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** =========================
 *  AdminGate：/#admin 使用
 *  未登入 → 顯示登入表單；已登入 → 顯示審核頁並可登出
 *  ========================= */
function AdminGate({ isAdmin }) {
  const [u, setU] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (me) => setU(me)), []);

  if (!u) return <AdminLoginForm />;

  return (
    <div>
      <div style={{ marginBottom: 10, color: "#64748b" }}>
        已登入：{u.email}　·　
        <button
          onClick={() => signOut(auth)}
          style={{ border: "none", background: "transparent", color: "#2563eb", cursor: "pointer" }}
        >
          登出
        </button>
      </div>
      <Review />
    </div>
  );
}

function AdminLoginForm() {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pwd);
    } catch (e2) {
      console.error(e2);
      setErr(e2?.message || "登入失敗，請稍後再試。");
    }
  };

  return (
    <form onSubmit={submit} style={{ ...card, maxWidth: 480 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, textAlign: "center" }}>管理員登入</h3>
      <div style={{ marginBottom: 10 }}>
        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", marginTop: 6 }}
          required
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <label>密碼</label>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 12, border: "1px solid #e5e7eb", marginTop: 6 }}
          required
        />
      </div>
      {err && <div style={{ color: "#ef4444", fontSize: 14, marginBottom: 10 }}>{err}</div>}
      <button type="submit" style={blueBtn}>登入</button>
      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 8 }}>
        請先在 Firebase Authentication 建立管理員帳號（Email/Password）。
      </div>
    </form>
  );
}

/** =========================
 *  審核頁（待審核清單）
 *  ========================= */
function Review() {
  const [pending, setPending] = useState([]);

  const load = async () => {
    const qy = query(collection(db, "posts"), where("approved", "==", false));
    const snap = await getDocs(qy);
    setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    await updateDoc(doc(db, "posts", id), { approved: true });
    load();
  };
  const remove = async (id) => {
    if (!window.confirm("確定刪除此筆投稿？")) return;
    await deleteDoc(doc(db, "posts", id));
    load();
  };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <h3 style={{ textAlign: "left" }}>待審核投稿</h3>
      {pending.length === 0 && (
        <div style={{ ...card, textAlign: "center" }}>目前沒有待審核的投稿</div>
      )}
      {pending.map((p) => (
        <div key={p.id} style={card}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            {p.nickname}（{p.age} 歲）
          </p>
          {p.intro && <p style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>{p.intro}</p>}
          {p.contact && (
            <p style={{ fontSize: 14, color: "#475569", marginTop: 6 }}>📩 {p.contact}</p>
          )}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button
              onClick={() => approve(p.id)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #22c55e", background: "#16a34a", color: "#fff", cursor: "pointer" }}
            >
              通過
            </button>
            <button
              onClick={() => remove(p.id)}
              style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", cursor: "pointer" }}
            >
              刪除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
