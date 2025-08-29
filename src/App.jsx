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

/* ====== 全域未捕捉錯誤保護 ====== */
if (typeof window !== "undefined") {
  window.onunhandledrejection = (e) => {
    console.error("[Unhandled Rejection]", e.reason);
    alert("發生未預期錯誤（可能是權限或網路問題）。請稍後再試。");
  };
}

/* ====== Error Boundary ====== */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: "", stack: "" };
  }
  static getDerivedStateFromError(err) {
    return { hasError: true, message: err?.message || String(err) };
  }
  componentDidCatch(err, info) {
    console.error("[Render Error]", err, info);
    this.setState({ stack: info?.componentStack || "" });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-6">
          <div className="max-w-md w-full p-4 rounded-2xl bg-white border shadow-sm">
            <div className="font-semibold mb-2">糟糕，頁面出錯了</div>
            <div className="text-sm text-red-600 break-words mb-2">
              {this.state.message}
            </div>
            {this.state.stack ? (
              <pre className="text-xs text-neutral-500 whitespace-pre-wrap">
                {this.state.stack}
              </pre>
            ) : null}
            <button
              className="mt-3 px-4 py-2 rounded-xl bg-neutral-900 text-white"
              onClick={() => location.reload()}
            >
              重新整理
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ====== 小工具 ====== */
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

/* ====== Root ====== */
export default function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

/* ====== App（頁面切換：home / feed / submit / admin） ====== */
function App() {
  const user = useAuth();
  const [page, setPage] = useState("home");
  const [posts, setPosts] = useState([]);
  const [pending, setPending] = useState([]);

  // 公開牆
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

  // 待審清單
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

  // 隱藏入口
  useEffect(() => {
    const goIfAdminParam = () => {
      const hash = window.location.hash || "";
      const qs = new URLSearchParams(window.location.search);
      if (hash === "#admin" || qs.get("admin") === "1") setPage("admin");
    };
    goIfAdminParam();
    window.addEventListener("hashchange", goIfAdminParam);
    return () => window.removeEventListener("hashchange", goIfAdminParam);
  }, []);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      {/* 入口頁不需要頂部列，其它頁保留簡潔標頭 */}
      {page !== "home" && (
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
          <div className="max-w-md mx-auto px-6 py-3 flex items-center justify-between">
            <div
              className="font-semibold cursor-pointer"
              onClick={() => setPage("home")}
              title="回入口"
            >
              匿名投稿板 · 七夕特別版
            </div>
            <nav className="flex gap-2 text-sm">
              <button
                className={
                  "px-3 py-2 rounded-full " +
                  (page === "feed"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 hover:bg-neutral-300")
                }
                onClick={() => setPage("feed")}
              >
                看投稿
              </button>
              <button
                className={
                  "px-3 py-2 rounded-full " +
                  (page === "submit"
                    ? "bg-neutral-900 text-white"
                    : "bg-neutral-200 hover:bg-neutral-300")
                }
                onClick={() => setPage("submit")}
              >
                我要投稿
              </button>
              {isAdmin(user) && (
                <button
                  className={
                    "px-3 py-2 rounded-full " +
                    (page === "admin"
                      ? "bg-fuchsia-600 text-white"
                      : "bg-neutral-200 hover:bg-neutral-300")
                  }
                  onClick={() => setPage("admin")}
                >
                  審核區
                </button>
              )}
            </nav>
          </div>
        </header>
      )}

      {/* 入口頁 */}
      {page === "home" && <Landing onGoFeed={() => setPage("feed")} onGoSubmit={() => setPage("submit")} />}

      {/* 看投稿 */}
      {page === "feed" && (
        <main className="max-w-md mx-auto px-6 py-6">
          <Feed posts={posts} />
          <FooterNotice compact />
        </main>
      )}

      {/* 我要投稿（新版版型） */}
      {page === "submit" && (
        <main className="max-w-md mx-auto px-6 py-6">
          <SubmitForm />
          <FooterNotice />
        </main>
      )}

      {/* 審核區 */}
      {page === "admin" &&
        (isAdmin(user) ? (
          <main className="max-w-md mx-auto px-6 py-6">
            <AdminPanel pending={pending} user={user} />
          </main>
        ) : (
          <main className="max-w-md mx-auto px-6 py-6">
            <LoginPanel />
          </main>
        ))}
    </div>
  );
}

/* ====== 入口頁 ====== */
function Landing({ onGoFeed, onGoSubmit }) {
  return (
    <main className="max-w-md mx-auto px-6 pt-12 pb-10 flex flex-col items-center">
      <h1 className="text-center text-xl font-semibold mb-6">
        匿名投稿板 · 七夕特別版
      </h1>

      <div className="flex gap-4 mb-16">
        <button
          onClick={onGoFeed}
          className="px-6 py-3 rounded-full text-2xl bg-neutral-200 hover:bg-neutral-300"
        >
          看投稿
        </button>
        <button
          onClick={onGoSubmit}
          className="px-6 py-3 rounded-full text-2xl bg-neutral-900 text-white"
        >
          我要投稿
        </button>
      </div>

      <div className="w-full">
        <FooterNotice compact />
      </div>
    </main>
  );
}

/* ====== 守則（底部小字） ====== */
function FooterNotice({ compact }) {
  return (
    <div className="mt-6 p-4 rounded-2xl bg-white border shadow-sm">
      <div className={"mb-2 " + (compact ? "text-xs" : "text-sm")}>
        注意事項與聲明（請務必閱讀）
      </div>
      <ul
        className={
          "list-disc pl-5 space-y-1 " + (compact ? "text-[12px]" : "text-sm")
        }
      >
        <li>僅限 {MIN_AGE}+ 歲投稿。</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容。</li>
        <li>顯示聯絡方式即同意公開，請自行評估。</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕。</li>
      </ul>
    </div>
  );
}

/* ====== 投稿表單（新版順序與樣式） ====== */
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
    Number.isInteger(ageNum) &&
    ageNum >= MIN_AGE &&
    nickname.trim().length > 0 &&
    intro.trim().length > 0 &&
    intro.trim().length <= MAX_INTRO_LEN &&
    agree &&
    !busy;

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
      setNickname("");
      setAge("");
      setContact("");
      setIntro("");
      setAgree(false);
    } catch (err) {
      console.error("[addDoc error]", err);
      const detail =
        err?.message?.includes("Missing or insufficient permissions")
          ? "沒有權限寫入資料庫：請檢查 Firestore 規則與專案/網域設定。"
          : err?.message || "送出失敗，請稍後再試。";
      setMsg(detail);
      alert(detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-2xl bg-white border shadow-sm space-y-5"
    >
      {/* 稱呼 */}
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

      {/* 年齡 */}
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

      {/* 聯絡方式（在自介之前） */}
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

      {/* 自我介紹（大框、緊貼標題下） */}
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

      {/* 同意守則 */}
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
        {busy ? "送出中…" : "送出投稿（待審）"}
      </button>

      {msg && (
        <div className="text-sm text-neutral-700 whitespace-pre-wrap">{msg}</div>
      )}
    </form>
  );
}

/* ====== 公開牆 ====== */
function Feed({ posts }) {
  return posts.length === 0 ? (
    <div className="text-center text-sm text-neutral-500">
      目前還沒有公開投稿，等等再來逛～
    </div>
  ) : (
    <div className="space-y-4">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
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
    <div className="p-4 rounded-2xl bg-white border shadow-sm">
      <div className="mb-2">
        <div className="text-sm font-medium">
          {post.nickname ? `${post.nickname} · ` : ""}
          {post.age} 歲
        </div>
        <div className="text-[10px] text-neutral-400 mt-0.5">
          發佈於 {timeSince(created)}
        </div>
      </div>

      <div className="whitespace-pre-wrap leading-6">{post.intro}</div>

      {post.contact ? (
        <div className="mt-3">
          {!showContact ? (
            <button
              onClick={() => setShowContact(true)}
              className="px-4 py-2 rounded-xl bg-neutral-900 text-white text-sm md:text-base"
            >
              顯示聯絡方式
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-neutral-100 border text-sm">
              聯絡方式：<span className="font-semibold">{post.contact}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3 text-xs text-neutral-500">投稿者未提供聯絡方式。</div>
      )}

      {auth.currentUser && ADMIN_EMAILS.includes(auth.currentUser.email || "") && (
        <div className="mt-3 flex gap-2 text-sm">
          <button
            onClick={adminUnapprove}
            className="px-3 py-1.5 rounded-xl border"
          >
            下架
          </button>
          <button
            onClick={adminDelete}
            className="px-3 py-1.5 rounded-xl border text-red-600"
          >
            刪除
          </button>
        </div>
      )}
    </div>
  );
}

/* ====== 管理員登入 / 審核 ====== */
function LoginPanel() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, pw);
    } catch (err) {
      console.error("[login error]", err);
      setMsg("登入失敗");
      alert("登入失敗，請確認帳密與允許登入網域。");
    }
  }

  return (
    <form
      onSubmit={handleLogin}
      className="p-4 bg-white rounded-xl border shadow-sm space-y-3"
    >
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="管理員 Email"
        className="w-full px-3 py-2 rounded-xl border"
      />
      <input
        type="password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        placeholder="密碼"
        className="w-full px-3 py-2 rounded-xl border"
      />
      <button className="w-full px-3 py-2 bg-neutral-900 text-white rounded-xl">
        登入
      </button>
      {msg && <div className="text-sm text-red-600">{msg}</div>}
    </form>
  );
}

function AdminPanel({ pending, user }) {
  async function approvePost(id) {
    await updateDoc(doc(db, "posts", id), { approved: true });
  }
  async function deletePost(id) {
    await deleteDoc(doc(db, "posts", id));
  }
  async function logout() {
    await signOut(auth);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-600">
          你好，{user?.email}（管理員）
        </div>
        <button onClick={logout} className="text-sm underline">
          登出
        </button>
      </div>

      {pending.length === 0 ? (
        <div className="text-center text-sm text-neutral-500">
          沒有待審核的投稿
        </div>
      ) : (
        pending.map((p) => (
          <div key={p.id} className="p-4 rounded-2xl bg-white border shadow-sm">
            <div className="text-sm font-medium mb-1">
              {p.nickname} · {p.age} 歲
            </div>
            <div className="whitespace-pre-wrap text-sm mb-2">{p.intro}</div>
            {p.contact && (
              <div className="text-xs text-neutral-500 mb-2">
                聯絡：{p.contact}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => approvePost(p.id)}
                className="px-3 py-1.5 rounded-xl border bg-green-600 text-white"
              >
                通過
              </button>
              <button
                onClick={() => deletePost(p.id)}
                className="px-3 py-1.5 rounded-xl border text-red-600"
              >
                刪除
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
