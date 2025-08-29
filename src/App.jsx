import React, { useState, useEffect } from "react";
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
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
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
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setPosts(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    }
  }, [page]);

  return (
    <div className="min-h-screen flex flex-col items-center p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-6">匿名投稿板・七夕特別版</h1>

      {/* 藍字按鈕區 */}
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setPage("posts")}
          className="px-6 py-3 rounded-full border border-blue-500 text-blue-500 text-lg font-semibold"
        >
          看投稿
        </button>
        <button
          onClick={() => setPage("submit")}
          className="px-6 py-3 rounded-full border border-blue-500 text-blue-500 text-lg font-semibold"
        >
          我要投稿
        </button>
      </div>

      {/* 頁面切換 */}
      {page === "home" && (
        <div className="bg-white shadow-md rounded-xl p-6 max-w-md w-full">
          <h2 className="text-md font-semibold mb-2">注意事項與聲明（請務必閱讀）</h2>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
            <li>僅限 16+ 歲投稿。</li>
            <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
            <li>顯示聯絡方式即同意公開，請自行評估風險。</li>
            <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
          </ul>
        </div>
      )}

      {page === "posts" && (
        <div className="max-w-md w-full">
          {posts.length === 0 ? (
            <p className="text-gray-500 text-center">目前還沒有公開投稿</p>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                className="bg-white shadow rounded-lg p-4 mb-4 text-sm"
              >
                <p>
                  <span className="font-semibold">{post.nickname}</span>（
                  {post.age} 歲）
                </p>
                <p className="mt-2">{post.intro}</p>
                {post.contact && (
                  <p className="mt-2 text-blue-600">{post.contact}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {page === "submit" && (
        <div className="bg-white shadow-md rounded-xl p-6 max-w-md w-full">
          <h2 className="text-lg font-semibold mb-4">我要投稿</h2>
          {/* 表單放這裡（省略，保持你原本的內容） */}
        </div>
      )}
    </div>
  );
}
