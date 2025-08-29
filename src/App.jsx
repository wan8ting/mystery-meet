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
      <h1 style={styles.title}>匿名投稿板・七夕特別版</h1>

      {/* 兩顆藍字按鈕（使用行內樣式 → 一定覆蓋成功） */}
      <div style={styles.buttonRow}>
        <button type="button" style={btnBlue} onClick={() => setPage("posts")}>
          看投稿
        </button>
        <button type="button" style={btnBlue} onClick={() => setPage("submit")}>
          我要投稿
        </button>
      </div>

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
                {p.contact && <p style={styles.contact}>{p.contact}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {page === "submit" && (
        <div style={styles.card}>
          <h2 style={styles.cardHeading}>我要投稿</h2>
          {/* 這裡維持你的原本表單（略） */}
          <p style={{ color: "#6b7280" }}>（表單內容沿用你現有的）</p>
        </div>
      )}
    </div>
  );
}

/* —— 行內樣式（按鈕藍字＋藍邊，iOS/Safari 不會還原成系統樣式）—— */
const btnBlue = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "14px 28px",
  borderRadius: 9999,
  border: "2px solid #3B82F6", // 藍色描邊
  color: "#2563EB",             // 藍色文字
  background: "#FFFFFF",
  fontSize: 20,
  fontWeight: 800,
  cursor: "pointer",
  lineHeight: 1.1,
  // 關閉預設外觀（iOS/Safari/Chrome）
  appearance: "none",
  WebkitAppearance: "none",
  MozAppearance: "none",
  // 防止其他全域樣式蓋掉
  outline: "none",
  boxShadow: "none",
  textDecoration: "none",
};

const styles = {
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
  title: {
    fontSize: 28,
    fontWeight: 800,
    margin: "8px 0 12px",
    textAlign: "center",
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
    fontSize: 16,
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
