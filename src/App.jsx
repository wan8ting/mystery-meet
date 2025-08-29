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
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

/** 🔧 請填入你的 Firebase 設定 */
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

/** =========================
 *            APP
 *  ========================= */
function App() {
  const [page, setPage] = useState("home"); // home | submit | posts | review
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(window.location.hash || "#home");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || "#home");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const fetchPosts = async () => {
    const q = query(collection(db, "posts"), where("approved", "==", true));
    const snap = await getDocs(q);
    setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

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
      window.location.hash = "#home";
    } catch (e) {
      console.error(e);
      alert("投稿失敗，請稍後再試");
    }
  };

  /** 入口大標 */
  const Title = () => (
    <h1
      style={{
        fontWeight: 800,
        letterSpacing: "2px",
        textAlign: "center",
        margin: "24px 0 10px",
      }}
    >
      匿名投稿板・七夕特別版
    </h1>
  );

  /** 黑白按鈕樣式 */
  const btn = (active) => ({
    padding: "14px 28px",
    fontSize: 20,
    fontWeight: 700,
    borderRadius: 28,
    border: "1px solid #ddd",
    background: active ? "#111" : "#e9eaec",
    color: active ? "#fff" : "#111",
    cursor: "pointer",
    margin: "0 10px",
  });

  /** 若在 /#admin → 直接顯示 AdminGate */
  if (route === "#admin") {
    return (
      <div style={{ padding: 20 }}>
        <Title />
        <AdminGate />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", padding: 20 }}>
      <Title />

      {/* 導覽按鈕（黑白版本） */}
      <div style={{ textAlign: "center", marginBottom: 22 }}>
        <button
          style={btn(page === "posts")}
          onClick={() => {
            setPage("posts");
            fetchPosts();
            window.location.hash = "#home";
          }}
        >
          看投稿
        </button>
        <button
          style={btn(page === "submit")}
          onClick={() => {
            setPage("submit");
            window.location.hash = "#home";
          }}
        >
          我要投稿
        </button>
        {user && (
          <button
            style={btn(page === "review")}
            onClick={() => {
              setPage("review");
              window.location.hash = "#home";
            }}
          >
            審核區
          </button>
        )}
      </div>

      {/* 頁面切換 */}
      {page === "home" && <HomeCard />}
      {page === "submit" && <SubmitForm onSubmit={handleSubmit} />}
      {page === "posts" && <Posts posts={posts} />}
      {page === "review" && user && <Review />}
    </div>
  );
}

/** =========================
 *         首頁守則卡
 *  ========================= */
function HomeCard() {
  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
      }}
    >
      <h3 style={{ marginTop: 0, marginBottom: 10 }}>注意事項與聲明（請務必閱讀）</h3>
      <ul style={{ lineHeight: 1.9, paddingLeft: 22, margin: 0 }}>
        <li>僅限 16+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估風險。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

/** =========================
 *          投稿表單
 *  ========================= */
function SubmitForm({ onSubmit }) {
  const MAX_INTRO_LEN = 200;
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [intro, setIntro] = useState("");
  const [agree, setAgree] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    const nAge = parseInt(age, 10);
    if (!Number.isFinite(nAge) || nAge < 16) {
      alert("年齡需滿 16 歲以上才能投稿");
      return;
    }
    if (!agree) {
      alert("請勾選並同意守則");
      return;
    }
    onSubmit({ nickname, age: nAge, contact, intro });
    setNickname("");
    setAge("");
    setContact("");
    setIntro("");
    setAgree(false);
  };

  const inputStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #ddd",
    background: "#f6f7f8",
    marginTop: 6,
    fontSize: 16,
  };

  return (
    <form
      onSubmit={submit}
      style={{
        background: "#fff",
        padding: 20,
        borderRadius: 16,
        maxWidth: 520,
        margin: "20px auto",
        boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
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
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>年齡（必填）</label>
        <input
          type="number"
          inputMode="numeric"
          style={inputStyle}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="請輸入年齡（至少 16）"
          required
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>聯絡方式（選填，IG / Threads / Email 擇一）</label>
        <input
          style={inputStyle}
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="@your_ig 或 @your_threads 或 your@mail.com"
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>自我介紹（最多 200 字）</label>
        <textarea
          style={{ ...inputStyle, minHeight: 140, resize: "vertical" }}
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
        />
        <div style={{ fontSize: 12, color: "#666", textAlign: "right", marginTop: 4 }}>
          {intro.length}/{MAX_INTRO_LEN}
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

      <button
        type="submit"
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: 12,
          border: "none",
          background: "#111",
          color: "#fff",
          fontSize: 18,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        送出投稿
      </button>
    </form>
  );
}

/** =========================
 *        公開投稿列表
 *  ========================= */
function Posts({ posts }) {
  if (!posts || posts.length === 0)
    return <p style={{ textAlign: "center" }}>目前還沒有公開投稿，等等再來逛～</p>;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      {posts.map((p) => (
        <div
          key={p.id}
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            textAlign: "left",
          }}
        >
          <p style={{ margin: "0 0 6px" }}>
            <b>{p.nickname}</b>（{p.age} 歲）
          </p>
          {p.intro && <p style={{ margin: "0 0 6px" }}>{p.intro}</p>}
          {p.contact && (
            <p style={{ fontSize: 14, color: "#555", margin: 0 }}>📩 {p.contact}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/** =========================
 *         管理員審核頁
 *  ========================= */
function Review() {
  const [pending, setPending] = useState([]);

  const load = async () => {
    const q = query(collection(db, "posts"), where("approved", "==", false));
    const snap = await getDocs(q);
    setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    await updateDoc(doc(db, "posts", id), { approved: true });
    await load();
  };

  const remove = async (id) => {
    await deleteDoc(doc(db, "posts", id));
    await load();
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h3 style={{ textAlign: "left" }}>待審核投稿</h3>
      {pending.length === 0 && <p>目前沒有待審核的投稿</p>}
      {pending.map((p) => (
        <div
          key={p.id}
          style={{
            background: "#fff",
            padding: 16,
            borderRadius: 12,
            marginBottom: 16,
            boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
            textAlign: "left",
          }}
        >
          <p style={{ margin: "0 0 6px" }}>
            <b>{p.nickname}</b>（{p.age} 歲）
          </p>
          {p.intro && <p style={{ margin: "0 0 6px" }}>{p.intro}</p>}
          {p.contact && (
            <p style={{ fontSize: 14, color: "#555", margin: 0 }}>📩 {p.contact}</p>
          )}
          <div style={{ marginTop: 10 }}>
            <button
              onClick={() => approve(p.id)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#e9fbe9",
                marginRight: 8,
                cursor: "pointer",
              }}
            >
              通過
            </button>
            <button
              onClick={() => remove(p.id)}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                border: "1px solid #ddd",
                background: "#ffecec",
                cursor: "pointer",
              }}
            >
              刪除
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** =========================
 *       AdminGate（/#admin）
 *  ========================= */
function AdminGate() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const login = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (error) {
      setErr(error?.message || "登入失敗");
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  if (loading) return <p style={{ textAlign: "center" }}>載入中…</p>;

  if (user) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto" }}>
        <div style={{ textAlign: "right", marginBottom: 10 }}>
          <span style={{ marginRight: 8, color: "#666", fontSize: 14 }}>
            {user.email}
          </span>
          <button
            onClick={logout}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid #ddd",
              background: "#f6f7f8",
              cursor: "pointer",
            }}
          >
            登出
          </button>
        </div>
        <Review />
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: 420,
        margin: "18px auto",
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 6px 24px rgba(0,0,0,0.06)",
      }}
    >
      <h3 style={{ textAlign: "center", marginTop: 0 }}>管理員登入</h3>
      <form onSubmit={login}>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f6f7f8",
            }}
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>密碼</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #ddd",
              background: "#f6f7f8",
            }}
          />
        </div>

        {err && <p style={{ color: "crimson", marginBottom: 8 }}>{err}</p>}

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "#111",
            color: "#fff",
            fontSize: 16,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          登入
        </button>
      </form>

      <p style={{ fontSize: 12, color: "#666", marginTop: 10, textAlign: "center" }}>
        請先在 Firebase Authentication 啟用「電子郵件/密碼」，並建立管理員帳號。
      </p>
    </div>
  );
}

export default App;
