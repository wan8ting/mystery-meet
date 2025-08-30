import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
  deleteDoc,
  orderBy
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

/* ---------------- Firebase 設定 ---------------- */
// ⚠️ 請換成你的專案參數
const firebaseConfig = {
  apiKey: "AIzaSyBwSQtQM16W-1FQ4NN1dWaLKjsRx_2W41U",
  authDomain: "mystery-meet.firebaseapp.com",
  projectId: "mystery-meet",
  storageBucket: "mystery-meet.firebasestorage.app",
  messagingSenderId: "648529916541",
  appId: "1:648529916541:web:3c02a7bfa827c32d2b3714",
  measurementId: "G-8KWV1RN1BP"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* 管理員白名單（用 Email 判斷） */
const ADMIN_EMAILS = ["wan8ting@gmail.com"]; // 需要就增加

/* ---------------- App ---------------- */
function App() {
  // route: ''(或#)、#submit、#posts、#admin
  const [route, setRoute] = useState(window.location.hash || "");
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const isAdmin =
    !!user && ADMIN_EMAILS.includes((user.email || "").toLowerCase());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u || null));
    const onHash = () => setRoute(window.location.hash || "");
    window.addEventListener("hashchange", onHash);
    return () => {
      unsub();
      window.removeEventListener("hashchange", onHash);
    };
  }, []);
  useEffect(() => {
  if (route === "#posts") {
    fetchPosts();
  }
}, [route]);

const fetchPosts = async () => {
  setLoadingPosts(true);
  try {
    const q = query(
      collection(db, "posts"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );
    const querySnapshot = await getDocs(q);
    setPosts(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  } finally {
    setLoadingPosts(false);
  }
};

const handleSubmit = async (data) => {
  try {
    await addDoc(collection(db, "posts"), {
      nickname: data.nickname,
      age: Number(data.age),
      contact: data.contact?.trim(), || null,
      intro: data.intro,
      approved: false,
      reportsCount: 0,
      createdAt: serverTimestamp(),
    });
    alert("投稿已送出，待審核通過後才會公開！");
    window.location.hash = ""; // 回首頁
    return true;
  } catch (e) {
    console.error("Error adding document: ", e);
    // 讓子層能 catch 到錯誤
    throw e;
  }
};

  const handleDeletePublic = async (id) => {
    if (!isAdmin) return;
    if (!window.confirm("確定要刪除此公開投稿？刪除後無法復原")) return;
    await deleteDoc(doc(db, "posts", id));
    fetchPosts();
  };

  /* -------- 專屬 /#admin Gate：未登入顯示登入；登入且為白名單顯示審核 -------- */
  if (route === "#admin") {
    return (
      <Shell>
        <AdminGate
          user={user}
          isAdmin={isAdmin}
          onLoggedIn={() => (window.location.hash = "#admin")}
        />
      </Shell>
    );
  }

  /* -------- 其餘頁面（一般使用者） -------- */
  return (
    <Shell>
      {/* 兩行標題 */}
      <HeaderTitle />

      {/* 導覽按鈕（藍字圓角），不顯示「審核區」 */}
      <div style={navWrap}>
        <a href="#posts" style={navBtnBlue} onClick={fetchPosts}>
          自介專區
        </a>
        <a href="#submit" style={navBtnBlue}>
          我要自介
        </a>
      </div>

      {/* 路由切換 */}
      {(!route || route === "#") && <Home />}

      {route === "#submit" && <SubmitForm onSubmit={handleSubmit} />}

    {route === "#posts" && (
  <Posts
    posts={posts}
    isAdmin={isAdmin}
    onDelete={handleDeletePublic}
    loading={loadingPosts}
  />
)}
    </Shell>
  );
}

/* ---------------- 外層框架 ---------------- */
function Shell({ children }) {
  return (
    <div
      style={{
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans TC', 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        padding: 20,
        textAlign: "center",
      }}
    >
      {children}
    </div>
  );
}

function HeaderTitle() {
  return (
    <div style={{ marginTop: 4, marginBottom: 12 }}>
      <div style={{ fontWeight: 900, fontSize: 28, lineHeight: 1.1 }}>課金派戀愛迷因</div>
      <div style={{ fontWeight: 800, fontSize: 24, lineHeight: 1.1, marginTop: 4 }}>
        七夕特別版
      </div>
    </div>
  );
}

/* ---------------- 樣式 ---------------- */
const navWrap = {
  marginBottom: 24,
  display: "flex",
  gap: 12,
  justifyContent: "center",
  flexWrap: "wrap",
};

const navBtnBlue = {
  display: "inline-block",
  textDecoration: "none",
  margin: "0 6px",
  padding: "14px 22px",
  fontSize: 18,
  borderRadius: 9999,
  border: "2px solid #3B82F6",
  background: "#ffffff",
  color: "#2563EB",
  fontWeight: 800,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

/* ---------------- 首頁（守則） ---------------- */
function Home() {
  return (
    <div
      style={{
        maxWidth: 680,
        margin: "0 auto",
        textAlign: "left",
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <h4 style={{ marginBottom: 12 }}>注意事項與聲明（請務必閱讀）</h4>
      <ul style={{ lineHeight: 1.8 }}>
        <li>僅限 16+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意別人聯繫，請自行評估。</li>
        <li>若遇不當內容，或網站有問題，請私訊 @peenkymemes 。</li>
      </ul>
    </div>
  );
}

/* ---------------- 投稿表單 ---------------- */
function SubmitForm({ onSubmit }) {
  const MAX_INTRO_LEN = 200;
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [intro, setIntro] = useState("");
  const [agree, setAgree] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const ageNum = parseInt(age, 10);
    if (Number.isNaN(ageNum) || ageNum < 16) {
      setErr("年齡需滿 16 歲以上才能投稿");
      return;
    }
    if (!agree) {
      setErr("請勾選並同意守則");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ nickname, age: ageNum, contact, intro });
      // 成功會在父層 alert 並導回首頁；這裡不用再重置
    } catch (e) {
      // 會顯示更明確的錯誤，而不是看起來「沒反應」
      setErr(e?.message || "送出失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "#f6f7f8",
    marginTop: 4,
    fontSize: 16,
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "#fff",
        padding: "20px",
        borderRadius: 16,
        maxWidth: 520,
        margin: "20px auto",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        textAlign: "left",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <label>稱呼（必填）</label>
        <input
          style={inputStyle}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例如：VIC、平崎..."
          required
          disabled={submitting}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>年齡（必填）</label>
        <input
          type="number"
          style={inputStyle}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="未滿16勿填"
          required
          disabled={submitting}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>聯絡方式（選填，IG / Threads / Email...）</label>
        <input
          style={inputStyle}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="@your_ig 或 @your_threads 或 your@mail.com"
          disabled={submitting}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>自我介紹（最多 200 字）</label>
        <textarea
          style={{ ...inputStyle, minHeight: 120 }}
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
          disabled={submitting}
        />
        <div style={{ fontSize: 12, color: "#666", textAlign: "right" }}>
          {intro.length}/{MAX_INTRO_LEN}
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 14 }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            style={{ marginRight: 8 }}
            disabled={submitting}
          />
          我已閱讀並同意守則，內容不含違規事項。
        </label>
      </div>

      {err && (
        <div style={{ color: "#DC2626", marginBottom: 12, fontSize: 14 }}>
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: submitting ? "#93c5fd" : "#2563eb",
          color: "#fff",
          fontSize: 18,
          fontWeight: "bold",
          cursor: submitting ? "not-allowed" : "pointer",
          transition: "background .2s",
        }}
      >
        {submitting ? "送出中…" : "送出投稿"}
      </button>
    </form>
  );
}

/* ---------------- 公開投稿列表（含管理員刪除） ---------------- */
function Posts({ posts, isAdmin, onDelete, loading }) {
  if (loading) return <p>載入中…</p>;
  if (!loading && posts.length === 0) return <p>目前還沒有公開投稿，等等再來逛～</p>;
  // 下面維持原樣

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "left" }}>
      {posts.map((p) => (
        <div
          key={p.id}
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
            position: "relative",
          }}
        >
          {/* 管理員刪除 */}
          {isAdmin && (
            <button
              onClick={() => onDelete(p.id)}
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                border: "2px solid #EF4444",
                color: "#EF4444",
                background: "#fff",
                borderRadius: 9999,
                padding: "6px 12px",
                fontWeight: 800,
                cursor: "pointer",
              }}
              title="刪除此帖"
            >
              刪除
            </button>
          )}

          <p style={{ marginRight: isAdmin ? 80 : 0 }}>
            <b>{p.nickname}</b>（{p.age} 歲）
          </p>
          {p.intro && <p style={{ whiteSpace: "pre-wrap" }}>{p.intro}</p>}
          {p.contact && (
            <p style={{ fontSize: 14, color: "#555" }}>📩 {p.contact}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------------- 審核頁 ---------------- */
function Review() {
  const [pending, setPending] = useState([]);

  const fetchPending = async () => {
    const q = query(collection(db, "posts"), where("approved", "==", false));
    const querySnapshot = await getDocs(q);
    setPending(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const approvePost = async (id) => {
    await updateDoc(doc(db, "posts", id), { approved: true });
    fetchPending();
  };

  const deletePost = async (id) => {
    await deleteDoc(doc(db, "posts", id));
    fetchPending();
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "left" }}>
      <h4>待審核投稿</h4>
      {pending.length === 0 && <p>目前沒有待審核的投稿</p>}
      {pending.map((p) => (
        <div
          key={p.id}
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}
        >
          <p>
            <b>{p.nickname}</b>（{p.age} 歲）
          </p>
          <p>{p.intro}</p>
          {p.contact && (
            <p style={{ fontSize: 14, color: "#555" }}>📩 {p.contact}</p>
          )}
          <div style={{ marginTop: 8 }}>
            <button onClick={() => approvePost(p.id)} style={{ marginRight: 8 }}>
              通過
            </button>
            <button onClick={() => deletePost(p.id)}>刪除</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- AdminGate（專屬 /#admin） ---------------- */
function AdminGate({ user, isAdmin, onLoggedIn }) {
  // 未登入 → 顯示登入；登入但非白名單 → 提示不是管理員；登入且是白名單 → 審核頁
  if (!user) return <AdminLogin onLoggedIn={onLoggedIn} />;

  if (!isAdmin) {
    return (
      <>
        <HeaderTitle />
        <div
          style={{
            maxWidth: 440,
            margin: "0 auto",
            background: "#fff",
            padding: 20,
            borderRadius: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            textAlign: "left",
          }}
        >
          <p style={{ color: "#DC2626" }}>此帳號不是管理員，無法檢視審核頁。</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => signOut(auth)}
              style={{ ...navBtnBlue, borderColor: "#9CA3AF", color: "#6B7280" }}
            >
              登出
            </button>
            <a href="#" style={navBtnBlue}>回首頁</a>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <HeaderTitle />
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <a href="#" style={navBtnBlue}>回首頁</a>
          <button
            onClick={() => signOut(auth)}
            style={{ ...navBtnBlue, borderColor: "#111827", color: "#111827" }}
          >
            登出
          </button>
        </div>
      </div>
      <Review />
    </>
  );
}

/* ---------------- 管理員登入 ---------------- */
function AdminLogin({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const login = async () => {
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      onLoggedIn && onLoggedIn();
    } catch (e) {
      setErr(e?.message || "登入失敗");
    }
  };

  return (
    <>
      <HeaderTitle />
      <div
        style={{
          maxWidth: 420,
          margin: "0 auto",
          textAlign: "left",
          background: "#fff",
          borderRadius: 16,
          padding: 20,
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ marginTop: 0 }}>管理員登入</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            style={inputBox}
          />
          <label>密碼</label>
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="••••••••"
            style={inputBox}
          />
          {err && <div style={{ color: "#DC2626", fontSize: 14 }}>{err}</div>}
          <button
            onClick={login}
            style={{
              ...navBtnBlue,
              background: "#111827",
              color: "#fff",
              borderColor: "#111827",
            }}
          >
            登入
          </button>
          <p style={{ color: "#6b7280", fontSize: 13 }}>
            請先在 Firebase Authentication 啟用「電子郵件/密碼」，並建立管理員帳號。
          </p>
        </div>
        <div style={{ marginTop: 12 }}>
          <a href="#" style={navBtnBlue}>回首頁</a>
        </div>
      </div>
    </>
  );
}

const inputBox = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  fontSize: 16,
};

export default App;
