import React, { useEffect, useState } from "react";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import app from "./firebase";

const db = getFirestore(app);
const auth = getAuth(app);

export default function App() {
  const [page, setPage] = useState("home");
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    if (page === "posts") {
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
  }, [page]);

  return (
    <div style={styles.page}>
      {/* 內嵌樣式：不依賴 Tailwind / 其他 CSS */}
      <style>{cssReset + cssButtons}</style>

      <h1 style={styles.title}>匿名投稿板・七夕特別版</h1>

      {/* 兩顆「藍字」按鈕 */}
      <div style={styles.buttonRow}>
        <button className="btn-blue" onClick={() => setPage("posts")}>
          看投稿
        </button>
        <button className="btn-blue" onClick={() => setPage("submit")}>
          我要投稿
        </button>
      </div>

      {/* 內容 */}
      {page === "home" && (
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>注意事項與聲明（請務必閱讀）</h2>
          <ul style={styles.list}>
            <li>僅限 16+ 歲投稿。</li>
            <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
            <li>顯示聯絡方式即同意公開，請自行評估風險。</li>
            <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
          </ul>
        </div>
      )}

      {page === "posts" && (
        <div style={{ width: "100%", maxWidth: 560 }}>
          {posts.length === 0 ? (
            <p style={styles.empty}>目前還沒有公開投稿</p>
          ) : (
            posts.map((p) => (
              <div key={p.id} style={styles.post}>
                <div style={styles.postHeader}>
                  <span style={styles.nickname}>{p.nickname}</span>
                  <span style={styles.age}>（{p.age} 歲）</span>
                </div>
                {p.intro && <p style={styles.postText}>{p.intro}</p>}
                {p.contact && (
                  <p style={styles.contact}>{p.contact}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {page === "submit" && (
        <div style={styles.card}>
          <h2 style={styles.cardHeading}>我要投稿</h2>
          {/* 你原本的投稿表單放這裡（未變更） */}
          <p style={{ color: "#6b7280" }}>（表單內容維持你現有的）</p>
        </div>
      )}
    </div>
  );
}

/* ===== CSS（直接注入，不靠 Tailwind） ===== */
const cssReset = `
  *, *::before, *::after { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body { margin: 0; background:#f9fafb; color:#111827; }
`;

const cssButtons = `
  .btn-blue {
    display:inline-flex;
    align-items:center;
    justify-content:center;
    padding: 14px 28px;
    border-radius: 9999px;
    border: 2px solid #3B82F6;        /* 藍色描邊 */
    color: #2563EB;                    /* 藍色文字 */
    background: #ffffff;
    font-size: 20px;
    font-weight: 700;
    cursor: pointer;
    transition: all .15s ease;
    min-width: 140px;
  }
  .btn-blue:active {
    transform: translateY(1px);
  }
  .btn-blue:hover {
    background: #F8FAFF;              /* 微淡藍底 */
  }
  @media (min-width: 768px) {
    .btn-blue { font-size: 22px; padding: 16px 32px; }
  }
`;

/* ===== Inline styles ===== */
const styles = {
  page: {
    minHeight: "100vh",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "24px",
    gap: "16px",
  },
  title: {
    fontSize: "28px",
    fontWeight: 800,
    margin: "8px 0 12px",
  },
  buttonRow: {
    display: "flex",
    gap: "16px",
    marginBottom: "16px",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "#fff",
    borderRadius: 16,
    padding: 20,
    boxShadow: "0 4px 14px rgba(0,0,0,0.06)",
  },
  cardTitle: { fontSize: 16, fontWeight: 700, marginBottom: 8 },
  cardHeading: { fontSize: 20, fontWeight: 800, marginBottom: 8 },
  list: {
    margin: 0,
    paddingLeft: 20,
    color: "#374151",
    lineHeight: 1.8,
    fontSize: 14,
  },
  empty: { textAlign: "center", color: "#6b7280", marginTop: 16 },
  post: {
    background: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
    fontSize: 14,
  },
  postHeader: { fontWeight: 600 },
  nickname: { marginRight: 4 },
  age: { color: "#6b7280", fontWeight: 500 },
  postText: { marginTop: 8, whiteSpace: "pre-wrap" },
  contact: { marginTop: 8, color: "#2563EB", wordBreak: "break-all" },
};
