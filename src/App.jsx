import React, { useEffect, useState } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  where,
} from "firebase/firestore";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { db, auth } from "./firebase";

/* ====== 常量 ====== */
const ADMIN_EMAILS = ["wan8ting@gmail.com"];
const MIN_AGE = 16;
const MAX_INTRO_LEN = 200;
const BANNED_WORDS = ["約炮", "騷擾", "仇恨", "種族歧視", "霸凌", "毒品"];

function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}
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

export default function App() {
  const user = useAuth();
  const [tab, setTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    const q = query(
      collection(db, "posts"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin(user)) return;
    const q = query(
      collection(db, "posts"),
      where("approved", "==", false),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) =>
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    const goIfAdminParam = () => {
      const hash = window.location.hash || "";
      const qs = new URLSearchParams(window.location.search);
      if (hash === "#admin" || qs.get("admin") === "1") setTab("admin");
    };
    goIfAdminParam();
    window.addEventListener("hashchange", goIfAdminParam);
    return () => window.removeEventListener("hashchange", goIfAdminParam);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-md mx-auto px-6 py-3 flex items-center justify-between">
          <div className="font-semibold">匿名投稿板 · 七夕特別版</div>
          <nav className="flex gap-3 font-semibold">
            <button
              className={
                "px-6 py-3 rounded-full text-2xl " +
                (tab === "feed"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-200 hover:bg-neutral-300")
              }
              onClick={() => setTab("feed")}
            >
              看投稿
            </button>
            <button
              className={
                "px-6 py-3 rounded-full text-2xl " +
                (tab === "submit"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-200 hover:bg-neutral-300")
              }
              onClick={() => setTab("submit")}
            >
              我要投稿
            </button>
            {isAdmin(user) && (
              <button
                className={
                  "px-5 py-3 rounded-full text-2xl " +
                  (tab === "admin"
                    ? "bg-fuchsia-600 text-white"
                    : "bg-neutral-200 hover:bg-neutral-300")
                }
                onClick={() => setTab("admin")}
              >
                審核區
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-6">
        <SafetyNotice />
        {tab === "submit" && <SubmitForm />}
        {tab === "feed" && <Feed posts={posts} />}
        {tab === "admin" &&
          (isAdmin(user) ? (
            <AdminPanel pending={pending} user={user} />
          ) : (
            <LoginPanel />
          ))}
      </main>
    </div>
  );
}

function SafetyNotice() {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-white border shadow-sm">
      <div className="font-semibold mb-2">注意事項與聲明（請務必閱讀）</div>
      <ul className="list-disc pl-5 space-y-2 text-sm">
        <li>僅限 {MIN_AGE}+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

function SubmitForm() {
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");
  const [intro, setIntro] = useState("");
  const [contact, setContact] = useState("");
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");

  const ageNum = parseInt(age, 10);
  const canSubmit =
    Number.isInteger(ageNum) &&
    ageNum >= MIN_AGE &&
    nickname.trim().length > 0 &&
    intro.trim().length > 0 &&
    intro.trim().length <= MAX_INTRO_LEN &&
    agree;

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");

    if (!Number.isInteger(ageNum) || ageNum < MIN_AGE) {
      alert(`年齡需大於或等於 ${MIN_AGE} 歲！`);
      return;
    }

    if (!canSubmit) return;
    if (containsBanned(intro)) {
      setMsg("內容疑似含有不當字詞，請調整後再送出。");
      return;
    }
    try {
      await addDoc(collection(db, "posts"), {
        nickname: nickname.trim(),
        age: ageNum,
        intro: intro.trim(),
        contact: contact.trim(),
        approved: false,
        reportsCount: 0,
        createdAt: serverTimestamp(),
      });
      setMsg("已送出！通過審核後會出現在公開牆。");
      setNickname("");
      setAge("");
      setIntro("");
      setContact("");
      setAgree(false);
    } catch {
      setMsg("送出失敗，請稍後再試。");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-2xl bg-white border shadow-sm space-y-5"
    >
      <div>
        <label className="block text-sm font-medium mb-1">稱呼（必填）</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例如：VIC、平崎…"
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">年齡（必填）</label>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_AGE}
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder={`請輸入年齡（至少 ${MIN_AGE} ）`}
          className="w-40 px-3 py-2 rounded-xl border bg-neutral-50"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          自我介紹（最多 {MAX_INTRO_LEN} 字）
        </label>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
          rows={6}
          className="w-full px-3 py-3 rounded-xl border bg-neutral-50"
          required
        />
        <div className="text-[11px] text-neutral-500 mt-1 text-right">
          {intro.length} / {MAX_INTRO_LEN}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          聯絡方式（選填，IG / Threads / Email 擇一）
        </label>
        <input
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="@your_ig 或 @your_threads 或 your@mail.com"
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
        />
      </div>

      <label className="flex items-start gap-2 text-sm leading-6">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1"
        />
        <span>我已閱讀並同意守則，且保證年齡屬實、內容不含違規事項。</span>
      </label>

      <button
        disabled={!canSubmit}
        className="w-full px-4 py-3 rounded-2xl bg-neutral-900 text-white text-xl disabled:opacity-50"
      >
        送出投稿（待審）
      </button>
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </form>
  );
}

/* 其他元件（Feed、PostCard、LoginPanel、AdminPanel）保持前版不變 */
