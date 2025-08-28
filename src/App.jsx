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

/* ====== 常量（可依需求調整） ====== */
const ADMIN_EMAILS = ["wan8ting@gmail.com"]; // 管理員白名單
const MIN_AGE = 16;
const MAX_INTRO_LEN = 200;
const BANNED_WORDS = ["約炮", "騷擾", "仇恨", "種族歧視", "霸凌", "毒品"];

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

/* ====== App ====== */
export default function App() {
  const user = useAuth();
  const [tab, setTab] = useState("feed");
  const [posts, setPosts] = useState([]);
  const [pending, setPending] = useState([]);

  // 公開牆：只看 approved=true
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

  // 待審清單：只有管理員訂閱
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

  // 隱藏入口：#admin 或 ?admin=1 直接打開管理頁
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
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">匿名投稿板 · 七夕特別版</div>
          <nav className="flex gap-3 text-base md:text-lg font-semibold">
            <button
              className={
                "px-5 py-2.5 rounded-full " +
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
                "px-5 py-2.5 rounded-full " +
                (tab === "submit"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-200 hover:bg-neutral-300")
              }
              onClick={() => setTab("submit")}
            >
              我要投稿
            </button>

            {/* 只有管理員登入後才顯示審核區按鈕 */}
            {isAdmin(user) ? (
              <button
                className={
                  "px-4 py-2 rounded-full " +
                  (tab === "admin"
                    ? "bg-fuchsia-600 text-white"
                    : "bg-neutral-200 hover:bg-neutral-300")
                }
                onClick={() => setTab("admin")}
              >
                審核區
              </button>
            ) : null}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
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

/* ====== 守則 ====== */
function SafetyNotice() {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-white border shadow-sm">
      <div className="font-semibold mb-2">注意事項與聲明（請務必閱讀）</div>
      <ul className="list-disc pl-5 space-y-1 text-xs">
        <li>僅限 {MIN_AGE}+ 歲投稿</li>
        <li>自介請友善、尊重，不包含歧視、騷擾、成人或違法內容</li>
        <li>顯示聯絡方式即同意公開，請自行評估</li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕</li>
      </ul>
    </div>
  );
}

/* ====== 投稿表單 ====== */
function SubmitForm() {
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState(""); // 允許空值，不會殘留 0
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
      className="p-4 rounded-2xl bg-white border shadow-sm space-y-4"
    >
      {/* 稱呼 */}
      <div>
        <label className="block text-sm font-medium mb-1">稱呼（必填）</label>
        <input
          type="text"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="例如：阿婷 / Ting / Wan"
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
        <p className="text-xs text-neutral-500 mt-1">
          僅限 {MIN_AGE}+ 歲投稿。
        </p>
      </div>

      {/* 自介 */}
      <div>
        <label className="block text-sm font-medium mb-1">
          自我介紹（最多 {MAX_INTRO_LEN} 字）
        </label>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
          rows={5}
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
          required
        />
        <div className="text-xs text-neutral-500 mt-1 text-right">
          {intro.length} / {MAX_INTRO_LEN}
        </div>
      </div>

      {/* 聯絡方式 */}
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

      {/* 同意守則 */}
      <label className="flex items-start gap-2 text-sm">
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
        className="px-4 py-2 rounded-xl bg-neutral-900 text-white disabled:opacity-50"
      >
        送出投稿（待審）
      </button>
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </form>
  );
}

/* ====== 公開牆 ====== */
function Feed({ posts }) {
  if (!posts.length)
    return (
      <div className="text-sm text-neutral-500">
        目前還沒有公開投稿，等等再來逛～
      </div>
    );
  return (
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
      {/* 標頭：稱呼 · 年齡（時間小字淡色） */}
      <div className="mb-2">
        <div className="text-sm font-medium">
          {post.nickname ? `${post.nickname} · ` : ""}
          {post.age} 歲
        </div>
        <div className="text-[11px] text-neutral-400 mt-0.5">
          發佈於 {timeSince(created)}
        </div>
      </div>

      <div className="whitespace-pre-wrap leading-6">{post.intro}</div>

      {/* 聯絡方式 */}
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
        <div className="mt-3 text-xs text-neutral-500">
          投稿者未提供聯絡方式。
        </div>
      )}

      {/* 只有管理員看得到：下架 / 刪除 */}
      {auth.currentUser &&
        ADMIN_EMAILS.includes(auth.currentUser.email || "") && (
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
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function login(e) {
    e.preventDefault();
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch {
      setMsg(
        "登入失敗，請確認帳密或授權網域是否已加入 Firebase Auth。"
      );
    }
  }

  return (
    <form onSubmit={login} className="p-4 rounded-2xl bg-white border shadow-sm">
      <div className="font-semibold mb-2">管理員登入</div>
      <input
        className="w-full px-3 py-2 rounded-xl border bg-neutral-50 mb-2"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full px-3 py-2 rounded-xl border bg-neutral-50 mb-2"
        type="password"
        placeholder="密碼"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-sm">
        登入
      </button>
      {msg && <div className="text-sm mt-2">{msg}</div>}
    </form>
  );
}

function AdminPanel({ pending, user }) {
  async function approve(id) {
    await updateDoc(doc(db, "posts", id), { approved: true });
  }
  async function remove(id) {
    await updateDoc(doc(db, "posts", id), { approved: false });
  }
  async function hardDelete(id) {
    if (confirm("確定要永久刪除這篇投稿嗎？此動作無法復原。")) {
      await deleteDoc(doc(db, "posts", id));
    }
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

      <div className="p-3 rounded-2xl bg-white border shadow-sm">
        <div className="font-semibold mb-2">待審清單（{pending.length}）</div>
        {!pending.length && (
          <div className="text-sm text-neutral-500">目前沒有待審投稿。</div>
        )}
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="p-3 rounded-xl border bg-neutral-50">
              <div className="text-xs text-neutral-500 mb-1">
                {p.nickname ? `${p.nickname} · ` : ""}
                {p.age} 歲
              </div>
              <div className="whitespace-pre-wrap text-sm mb-2">{p.intro}</div>
              {p.contact && (
                <div className="text-xs text-neutral-600 mb-2">
                  聯絡方式：{p.contact}
                </div>
              )}
              <div className="flex gap-2 text-sm">
                <button
                  onClick={() => approve(p.id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white"
                >
                  通過
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="px-3 py-1.5 rounded-xl border"
                >
                  下架
                </button>
                <button
                  onClick={() => hardDelete(p.id)}
                  className="px-3 py-1.5 rounded-xl border text-red-600"
                >
                  刪除
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
