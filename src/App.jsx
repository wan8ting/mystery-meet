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

// 🔹 你的 Firebase 設定
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

function App() {
  const [page, setPage] = useState("home"); // home, submit, review, posts
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
  }, []);

  const fetchPosts = async () => {
    const q = query(collection(db, "posts"), where("approved", "==", true));
    const querySnapshot = await getDocs(q);
    setPosts(querySnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  const handleSubmit = async (data) => {
    try {
      await addDoc(collection(db, "posts"), {
        nickname: data.nickname,
        age: data.age,
        contact: data.contact,
        intro: data.intro,
        approved: false,
        reportsCount: 0,
        createdAt: serverTimestamp(),
      });
      alert("投稿已送出，待審核通過後才會公開！");
      setPage("home");
    } catch (e) {
      console.error("Error adding document: ", e);
    }
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 20, textAlign: "center" }}>
      <h2 style={{ marginBottom: 20 }}>匿名投稿板・七夕特別版</h2>

      {/* 導覽按鈕 */}
      <div style={{ marginBottom: 30 }}>
        <button
          style={navBtn}
          onClick={() => {
            setPage("posts");
            fetchPosts();
          }}
        >
          看投稿
        </button>
        <button style={navBtn} onClick={() => setPage("submit")}>
          我要投稿
        </button>
        {user && (
          <button style={navBtn} onClick={() => setPage("review")}>
            審核區
          </button>
        )}
      </div>

      {/* 各頁 */}
      {page === "home" && <Home />}
      {page === "submit" && <SubmitForm onSubmit={handleSubmit} />}
      {page === "posts" && <Posts posts={posts} />}
      {page === "review" && user && <Review />}
    </div>
  );
}

// 🔹 導覽按鈕樣式
const navBtn = {
  margin: "0 8px",
  padding: "12px 20px",
  fontSize: 18,
  borderRadius: 24,
  border: "1px solid #ccc",
  background: "#f6f7f8",
  cursor: "pointer",
};

// 🔹 首頁（守則）
function Home() {
  return (
    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "left" }}>
      <h4 style={{ marginBottom: 12 }}>注意事項與聲明（請務必閱讀）</h4>
      <ul>
        <li>僅限 16+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估風險。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

// 🔹 投稿表單
function SubmitForm({ onSubmit }) {
  const MAX_INTRO_LEN = 200;
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [contact, setContact] = useState("");
  const [intro, setIntro] = useState("");
  const [agree, setAgree] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (parseInt(age) < 16) {
      alert("年齡需滿 16 歲以上才能投稿");
      return;
    }
    if (!agree) {
      alert("請勾選並同意守則");
      return;
    }
    onSubmit({ nickname, age, contact, intro });
    setNickname("");
    setAge("");
    setContact("");
    setIntro("");
    setAgree(false);
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
        maxWidth: 480,
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
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label>年齡（必填）</label>
        <input
          type="number"
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
          style={{ ...inputStyle, minHeight: 120 }}
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
        />
        <div style={{ fontSize: 12, color: "#666", textAlign: "right" }}>
          {intro.length}/{MAX_INTRO_LEN}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: 14 }}>
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          我已閱讀並同意守則，且保證年齡屬實、內容不含違規事項。
        </label>
      </div>

      <button
        type="submit"
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: 12,
          border: "none",
          background: "#2563eb",
          color: "#fff",
          fontSize: 18,
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        送出投稿
      </button>
    </form>
  );
}

// 🔹 公開投稿列表
function Posts({ posts }) {
  if (posts.length === 0) return <p>目前還沒有公開投稿，等等再來逛～</p>;

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "left" }}>
      {posts.map((p) => (
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
        </div>
      ))}
    </div>
  );
}

// 🔹 管理員審核頁
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
    <div style={{ maxWidth: 600, margin: "0 auto", textAlign: "left" }}>
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
          <button onClick={() => approvePost(p.id)} style={{ marginRight: 8 }}>
            通過
          </button>
          <button onClick={() => deletePost(p.id)}>刪除</button>
        </div>
      ))}
    </div>
  );
}

export default App;
