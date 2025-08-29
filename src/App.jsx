import React, { useEffect, useMemo, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "firebase/auth";
import app from "./firebase";

const db = getFirestore(app);
const auth = getAuth(app);

// ✅ 管理員白名單（可填多個）
const ADMIN_EMAILS = ["wan8ting@gmail.com"];

export default function App() {
  const [route, setRoute] = useState(getRoute());
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const isAdmin = useMemo(
    () => !!user && ADMIN_EMAILS.includes((user.email || "").toLowerCase()),
    [user]
  );

  // 簡單 hash 路由
  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // 監聽登入狀態
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    return () => unsub();
  }, []);

  // 讀取公開貼文
  useEffect(() => {
    if (route === "posts" || route === "home") {
      const q = query(
        collection(db, "posts"),
        where("approved", "==", true),
        orderBy("createdAt", "desc")
      );
      const unsub = onSnapshot(q, (snap) => {
        setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      });
      return () => unsub();
    }
  }, [route]);

  // ====== UI ======
  return (
    <div style={S.page}>
      {/* 兩行大標 */}
      <div style={S.titleWrap}>
        <div style={S.titleLine1}>課金派戀愛迷因</div>
        <div style={S.titleLine2}>七夕特別版</div>
      </div>

      {/* 兩顆「藍字、藍邊」按鈕（用 <a role="button"> 避開 button 預設樣式） */}
      <div style={S.btnRow}>
        <a role="button" href="#posts" style={btnBlue}>
          看投稿
        </a>
        <a role="button" href="#submit" style={btnBlue}>
          我要投稿
        </a>
        <a role="button" href="#admin" style={{ ...btnBlue, borderColor: "#9CA3AF", color: "#6B7280" }}>
          審核區
        </a>
      </div>

      {/* 路由頁面 */}
      {route === "home" && <HomeNotice />}
      {route === "posts" && (
        <PublicList posts={posts} isAdmin={isAdmin} onDelete={handleDelete} />
      )}
      {route === "submit" && (
        <div style={S.card}>
          <h2 style={S.cardHeading}>我要投稿</h2>
          {/* 這裡放你原本的投稿表單（略） */}
          <p style={{ color: "#6b7280" }}>（表單保留你現有的實作）</p>
        </div>
      )}
      {route === "admin" && (
        <AdminLogin
          user={user}
          isAdmin={isAdmin}
          errMsg={errMsg}
          onLogin={async (email, pass) => {
            setErrMsg("");
            try {
              await signInWithEmailAndPassword(auth, email, pass);
            } catch (e) {
              setErrMsg(e?.message || "登入失敗");
            }
          }}
        />
      )}
    </div>
  );

  // 刪除貼文（僅 admin UI 會出現按鈕）
  async function handleDelete(id) {
    if (!isAdmin) return;
    const ok = window.confirm("確定刪除此投稿？刪除後無法復原。");
    if (!ok) return;
    try {
      await deleteDoc(doc(db, "posts", id));
    } catch (e) {
      alert("刪除失敗：" + (e?.message || ""));
    }
  }
}

/* ---------- 子元件 ---------- */

function HomeNotice() {
  return (
    <div style={S.card}>
      <h2 style={S.cardTitle}>注意事項與聲明（請務必閱讀）</h2>
      <ul style={S.list}>
        <li>僅限 16+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估風險。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

function PublicList({ posts, isAdmin, onDelete }) {
  if (!posts?.length) return <p style={S.empty}>目前還沒有公開投稿</p>;
  return (
    <div style={{ width: "100%", maxWidth: 560 }}>
      {posts.map((p) => (
        <div key={p.id} style={S.post}>
          <div style={S.postHeader}>
            <div>
              <span style={S.nickname}>{p.nickname}</span>
              <span style={S.age}>（{p.age} 歲）</span>
            </div>
            {isAdmin && (
              <a
                role="button"
                onClick={() => onDelete(p.id)}
                style={btnDanger}
              >
                刪除
              </a>
            )}
          </div>
          {p.intro && <p style={S.postText}>{p.intro}</p>}
          {p.contact && <p style={S.contact}>{p.contact}</p>}
        </div>
      ))}
    </div>
  );
}

function AdminLogin({ user, isAdmin, errMsg, onLogin }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");

  if (user && isAdmin) {
    return (
      <div style={S.card}>
        <h2 style={S.cardHeading}>管理員已登入</h2>
        <p>你現在在公開列表旁會看到「刪除」按鈕，可直接移除不適合的貼文。</p>
        <a role="button" href="#posts" style={{ ...btnBlue, marginTop: 12 }}>
          前往公開貼文
        </a>
      </div>
    );
  }

  return (
    <div style={S.card}>
      <h2 style={S.cardHeading}>管理員登入</h2>
      <div style={{ display: "grid", gap: 12 }}>
        <label style={S.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@example.com"
          style={S.input}
        />
        <label style={S.label}>密碼</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••"
          style={S.input}
        />
        {errMsg && <div style={{ color: "#DC2626", fontSize: 14 }}>{errMsg}</div>}
        <a
          role="button"
          onClick={() => onLogin(email, pass)}
          style={{ ...btnBlue, background: "#111827", color: "#fff", borderColor: "#111827", textAlign: "center" }}
        >
          登入
        </a>
        <p style={{ color: "#6b7280", fontSize: 13 }}>
          請先在 Firebase Authentication 啟用「電子郵件/密碼」，並建立管理員帳號，
          並把 Email 加到程式的 ADMIN_EMAILS 白名單中。
        </p>
      </div>
    </div>
  );
}

/* ---------- 小工具 ---------- */

function getRoute() {
  const hash = (window.location.hash || "").replace(/^#/, "");
  if (!hash) return "home";
  if (hash === "posts") return "posts";
  if (hash === "submit") return "submit";
  if (hash === "admin") return "admin";
  return "home";
}

/* ---------- 樣式 ---------- */

const S = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px",
    gap: "16px",
    background: "#f9fafb",
    color: "#111827",
  },
  titleWrap: { marginTop: 6, marginBottom: 8, textAlign: "center" },
  titleLine1: { fontSize: 28, fontWeight: 900, lineHeight: 1.1 },
  titleLine2: { fontSize: 24, fontWeight: 800, lineHeight: 1.1, marginTop: 4 },
  btnRow: { display: "flex", gap: 16, marginTop: 6, marginBottom: 8, flexWrap: "wrap" },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  cardTitle: { fontSize: 18, fontWeight: 800, marginBottom: 8 },
  cardHeading: { fontSize: 20, fontWeight: 800, marginBottom: 12 },
  list: {
    margin: 0,
    paddingLeft: 20,
    color: "#374151",
    lineHeight: 1.8,
    fontSize: 16,
  },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 16 },
  post: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    fontSize: 15,
  },
  postHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  nickname: { fontWeight: 700, marginRight: 4 },
  age: { color: "#6b7280", fontWeight: 500 },
  postText: { marginTop: 8, whiteSpace: "pre-wrap" },
  contact: { marginTop: 8, color: "#2563EB", wordBreak: "break-all" },
  label: { fontSize: 14, fontWeight: 700 },
  input: {
    width: "100%",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid #E5E7EB",
    outline: "none",
    fontSize: 16,
    background: "#fff",
  },
};

// 藍字圓角按鈕（用 <a role="button">，避免 button UA 樣式）
const btnBlue = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 28px",
  borderRadius: 9999,
  border: "2px solid #3B82F6",
  color: "#2563EB",
  background: "#FFFFFF",
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.1,
  cursor: "pointer",
  textDecoration: "none",
  userSelect: "none",
  WebkitTapHighlightColor: "transparent",
};

// 管理員刪除按鈕
const btnDanger = {
  ...btnBlue,
  borderColor: "#EF4444",
  color: "#EF4444",
  padding: "8px 16px",
  fontSize: 14,
};
