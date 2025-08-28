import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  where,
  getDocs,
  limit,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

/**
 * 匿名投稿板（七夕交友／自介投稿）— 單檔 React + Firebase（Firestore + Auth）
 * ------------------------------------------------------------
 * 功能
 * - 投稿表單：年齡（必填、18+）、自介文字（最多 280 字）、聯絡方式（IG/Email/Line 任一，可留空）、守則同意 & 風險告知
 * - 匿名公開牆：只顯示年齡與自介；聯絡方式需按「顯示聯絡方式」才展開（有一層同意彈窗）
 * - 站方審核：投稿預設 approved=false，僅管理者可「通過／下架」
 * - 檢舉：每則可被檢舉；達閾值自動隱藏（可在下方常量調整）
 * - 基礎防濫用：字詞過濾、節流（localStorage），前端長度限制
 *
 * 快速部署
 * 1) Firebase Console 建專案，開 Firestore（原生模式）與 Email/Password Auth。
 * 2) 新增 Web App，複製 config 到下方 firebaseConfig。
 * 3) 在 Firebase Auth 建立管理員帳號（Email/密碼）。把該 Email 填入 ADMIN_EMAILS 常量。
 * 4) 將下方 Firestore 安全規則複製貼上（Console > Firestore > 規則），發布。
 * 5) 用 Vercel / Netlify 部署此單檔（或任何 React 支援的靜態託管）。
 * 6) IG 限動只貼此網站連結，不要貼投稿者帳號。
 *
 * 重要聲明（產品策略）
 * - 年齡要求：預設 18+。
 * - 聯絡方式顯示加一層同意；仍無法 100% 防截圖或原始碼探索，若要更安全，需改為「轉寄制 Relay」或雲端函式授權取回（伺服器端存取）。
 * - 請務必在頁面顯示《守則與免責聲明》。
 */

// ====== 可調整常量 ======
const ADMIN_EMAILS = [
  // 將你的管理員 Email 放進來
  "admin@example.com",
];
const AUTO_HIDE_REPORTS_THRESHOLD = 3; // 檢舉達到此數量自動隱藏
const MIN_AGE = 18; // 最低年齡
const MAX_INTRO_LEN = 280;

// 基本敏感詞（示意，實務建議接外部審核服務）
const BANNED_WORDS = [
  "約炮",
  "騷擾",
  "仇恨",
  "種族歧視",
  "霸凌",
  "毒品",
];

// ====== Firebase 初始化（填你的設定） ======
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

// ====== 小工具 ======
function useAuth() {
  const [user, setUser] = useState(null);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

function isAdmin(user) {
  return !!user && ADMIN_EMAILS.includes(user.email || "");
}

function containsBanned(text) {
  const t = (text || "").toLowerCase();
  return BANNED_WORDS.some((w) => t.includes(w.toLowerCase()));
}

function timeSince(ts) {
  const d = new Date(ts);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

// ====== 主元件 ======
export default function App() {
  const user = useAuth();
  const [tab, setTab] = useState("feed"); // feed | submit | admin
  const [posts, setPosts] = useState([]);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    // 公開牆（只看 approved=true 且 reportsCount < 閾值）
    const q = query(
      collection(db, "posts"),
      where("approved", "==", true),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((p) => (p.reportsCount || 0) < AUTO_HIDE_REPORTS_THRESHOLD);
      setPosts(list);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!isAdmin(user)) return;
    const q = query(
      collection(db, "posts"),
      where("approved", "==", false),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setPending(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">匿名投稿板 · 七夕特別版</div>
          <nav className="flex gap-2 text-sm">
            <button
              className={
                "px-3 py-1.5 rounded-full " +
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
                "px-3 py-1.5 rounded-full " +
                (tab === "submit"
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-200 hover:bg-neutral-300")
              }
              onClick={() => setTab("submit")}
            >
              我要投稿
            </button>
            {isAdmin(user) ? (
              <button
                className={
                  "px-3 py-1.5 rounded-full " +
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
        {tab === "admin" && isAdmin(user) && (
          <AdminPanel pending={pending} user={user} />
        )}
        {tab === "admin" && !isAdmin(user) && <LoginPanel />}
      </main>

      <footer className="max-w-3xl mx-auto px-4 pb-10 text-xs text-neutral-500">
        <hr className="my-6" />
        <p>
          本服務僅做匿名自介分享與配對意向展示，不保證真實性與結果。若遇不當行為，請截圖保留證據並立即檢舉／封鎖對方。
        </p>
      </footer>
    </div>
  );
}

// ====== 元件：守則與免責 ======
function SafetyNotice() {
  return (
    <div className="mb-6 p-4 rounded-2xl bg-white border shadow-sm">
      <div className="font-semibold mb-2">守則與免責（請務必閱讀）</div>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>僅限 {MIN_AGE}+ 歲投稿。請如實填寫年齡。</li>
        <li>自介請友善、尊重、不包含歧視、騷擾、成人或違法內容。</li>
        <li>
          為降低曝險，<span className="font-semibold">限動請只貼本平台連結</span>
          ，不要直接公開投稿者帳號。
        </li>
        <li>
          顯示聯絡方式前會再提示一次同意事項；顯示後即等同公開，請自行評估風險。
        </li>
        <li>若遇不當內容，請使用每則貼文的「檢舉」按鈕，我們會優先處理。</li>
      </ul>
    </div>
  );
}

// ====== 元件：投稿表單 ======
function SubmitForm() {
  const [age, setAge] = useState(18);
  const [intro, setIntro] = useState("");
  const [contact, setContact] = useState("");
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const canSubmit =
    age >= MIN_AGE &&
    intro.trim().length > 0 &&
    intro.trim().length <= MAX_INTRO_LEN &&
    agree;

  function tooFrequent() {
    const last = parseInt(localStorage.getItem("lastSubmitAt") || "0", 10);
    return Date.now() - last < 10 * 60 * 1000; // 10 分鐘
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg("");
    if (!canSubmit) return;
    if (tooFrequent()) {
      setMsg("投稿太頻繁，請稍後再試（每 10 分鐘一次）。");
      return;
    }
    if (containsBanned(intro)) {
      setMsg("內容疑似含有不當字詞，請調整後再送出。");
      return;
    }
    try {
      setLoading(true);
      await addDoc(collection(db, "posts"), {
        age,
        intro: intro.trim(),
        contact: contact.trim(), // 會被隱藏，按鈕同意後才顯示（前端控制）
        approved: false, // 預設需審核
        reportsCount: 0,
        createdAt: serverTimestamp(),
      });
      localStorage.setItem("lastSubmitAt", String(Date.now()));
      setAge(MIN_AGE);
      setIntro("");
      setContact("");
      setAgree(false);
      setMsg("已送出！通過審核後會出現在公開牆。");
    } catch (e) {
      console.error(e);
      setMsg("送出失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 rounded-2xl bg-white border shadow-sm space-y-4"
    >
      <div>
        <label className="block text-sm font-medium mb-1">年齡（必填）</label>
        <input
          type="number"
          min={MIN_AGE}
          value={age}
          onChange={(e) => setAge(parseInt(e.target.value || "0", 10))}
          className="w-32 px-3 py-2 rounded-xl border bg-neutral-50"
          required
        />
        <p className="text-xs text-neutral-500 mt-1">僅限 {MIN_AGE}+ 歲投稿。</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          自我介紹（最多 {MAX_INTRO_LEN} 字）
        </label>
        <textarea
          value={intro}
          onChange={(e) => setIntro(e.target.value.slice(0, MAX_INTRO_LEN))}
          rows={5}
          placeholder="範例：台北設計系、喜歡跑步與看漫畫，性格外向，想找一起去看展的朋友～"
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
          required
        />
        <div className="text-xs text-neutral-500 mt-1 text-right">
          {intro.length} / {MAX_INTRO_LEN}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          聯絡方式（選填，IG/Email/Line 三擇一）
        </label>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="@your_ig 或 your@mail.com 或 LineID"
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
        />
        <p className="text-xs text-neutral-500 mt-1">
          你的聯絡方式不會直接顯示，對方需按「顯示聯絡方式」並同意守則才會看到。
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={agree}
          onChange={(e) => setAgree(e.target.checked)}
          className="mt-1"
        />
        <span>
          我已閱讀並同意守則與免責，且保證年齡屬實、內容不含違規事項。
        </span>
      </label>

      <button
        disabled={!canSubmit || loading}
        className="px-4 py-2 rounded-xl bg-neutral-900 text-white disabled:opacity-50"
      >
        {loading ? "送出中…" : "送出投稿（待審）"}
      </button>
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </form>
  );
}

// ====== 元件：公開牆 ======
function Feed({ posts }) {
  if (!posts.length)
    return (
      <div className="text-sm text-neutral-500">目前還沒有公開投稿，等等再來逛～</div>
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const created = post.createdAt?.toDate?.() || new Date();

  async function report() {
    try {
      await updateDoc(doc(db, "posts", post.id), {
        reportsCount: increment(1),
      });
      alert("已送出檢舉，我們會盡快處理，謝謝你。\n（累積到一定數量會自動隱藏）");
    } catch (e) {
      alert("檢舉失敗，請稍後再試");
    }
  }

  return (
    <div className="p-4 rounded-2xl bg-white border shadow-sm">
      <div className="flex items-center justify-between text-xs text-neutral-500 mb-2">
        <div>
          {post.age} 歲 · 發佈於 {timeSince(created)}
        </div>
        <button onClick={report} className="hover:underline">
          檢舉
        </button>
      </div>
      <div className="whitespace-pre-wrap leading-6">{post.intro}</div>

      {post.contact ? (
        <div className="mt-3">
          {!showContact ? (
            <button
              onClick={() => setConfirmOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white text-sm"
            >
              顯示聯絡方式
            </button>
          ) : (
            <div className="p-3 rounded-xl bg-neutral-100 border text-sm">
              聯絡方式：<span className="font-semibold">{post.contact}</span>
            </div>
          )}
          {confirmOpen && (
            <ConfirmReveal
              onClose={() => setConfirmOpen(false)}
              onConfirm={() => {
                setShowContact(true);
                setConfirmOpen(false);
              }}
            />
          )}
        </div>
      ) : (
        <div className="mt-3 text-xs text-neutral-500">
          投稿者未提供聯絡方式。若有興趣，請自行留言或轉發此卡片詢問。
        </div>
      )}
    </div>
  );
}

function ConfirmReveal({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
      <div className="max-w-sm w-full rounded-2xl bg-white border shadow-xl p-4">
        <div className="font-semibold mb-2">顯示聯絡方式前的提醒</div>
        <ul className="text-sm list-disc pl-5 space-y-1 mb-4">
          <li>聯絡方式一旦顯示，等同公開，請勿惡意散播或騷擾。</li>
          <li>請以尊重、友善方式私訊；對方若無回應，請勿持續打擾。</li>
          <li>若發現不當內容，請使用檢舉按鈕通知管理。</li>
        </ul>
        <div className="flex justify-end gap-2 text-sm">
          <button onClick={onClose} className="px-3 py-1.5 rounded-xl border">
            取消
          </button>
          <button
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white"
          >
            我同意，顯示
          </button>
        </div>
      </div>
    </div>
  );
}

// ====== 元件：管理員登入與審核 ======
function LoginPanel() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");

  async function login(e) {
    e.preventDefault();
    setMsg("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setMsg("登入失敗，請確認帳密或權限。");
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
              <div className="text-xs text-neutral-500 mb-1">{p.age} 歲</div>
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
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-neutral-500">
        提醒：若要更嚴格的安全／匿名保障（例如真正的「聯絡資訊不在前端、需持權杖取回」或「由平台代轉訊息」），請新增 Cloud Functions
        以 token 方式後端取回聯絡資訊，或改為 relay 模式（對象填寫自己的 IG，系統寄信給投稿者，由投稿者決定是否回覆）。
      </div>
    </div>
  );
}

/*
====================== Firestore 安全規則（請貼到 Console 發布） ======================
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if resource.data.approved == true && (resource.data.reportsCount < %AUTO_HIDE%);
      // 允許任何人新增投稿，但只能寫入限定欄位，且強制 approved=false 與 reportsCount=0
      allow create: if request.time < timestamp.date(2100,1,1) &&
        request.resource.data.keys().hasOnly(['age','intro','contact','approved','reportsCount','createdAt']) &&
        request.resource.data.age >= %MIN_AGE% &&
        request.resource.data.approved == false &&
        request.resource.data.reportsCount == 0;

      // 只有管理員可以將 approved 改成 true/false
      allow update, delete: if request.auth != null &&
        request.auth.token.email in [%ADMIN_EMAILS%];

      // 任何人可檢舉：僅允許 reportsCount 遞增 1
      allow update: if request.resource.data.diff(resource.data).changedKeys().hasOnly(['reportsCount']) &&
        request.resource.data.reportsCount == resource.data.reportsCount + 1;
    }
  }
}
// 貼上前請用實際值替換：
// %AUTO_HIDE% -> 對應 AUTO_HIDE_REPORTS_THRESHOLD（例如 3）
// %MIN_AGE% -> 對應 MIN_AGE（例如 18）
// %ADMIN_EMAILS% -> 以逗號分隔並加雙引號，例如 "you@your.com","teammate@your.com"
=======================================================================================
*/
