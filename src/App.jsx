import React, { useState } from "react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

const MIN_AGE = 16;
const MAX_INTRO_LEN = 200;

export default function SubmitForm(){
  const [nickname, setNickname] = useState("");
  const [age, setAge] = useState("");          // 允許空值，不會殘留 0
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

  async function handleSubmit(e){
    e.preventDefault();
    setMsg("");
    if(!canSubmit) return;
    try{
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
      setNickname(""); setAge(""); setIntro(""); setContact(""); setAgree(false);
    }catch{
      setMsg("送出失敗，請稍後再試。");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-4 rounded-2xl bg-white border shadow-sm space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1">稱呼（必填）</label>
        <input
          type="text"
          value={nickname}
          onChange={e=>setNickname(e.target.value)}
          placeholder="例如：阿婷 / Ting / Wan"
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
        <p className="text-xs text-neutral-500 mt-1">僅限 {MIN_AGE}+ 歲投稿。</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">自我介紹（最多 {MAX_INTRO_LEN} 字）</label>
        <textarea
          value={intro}
          onChange={e=>setIntro(e.target.value.slice(0,MAX_INTRO_LEN))}
          rows={5}
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
          required
        />
        <div className="text-xs text-neutral-500 mt-1 text-right">{intro.length} / {MAX_INTRO_LEN}</div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">聯絡方式（選填，IG / Threads / Email 擇一）</label>
        <input
          value={contact}
          onChange={e=>setContact(e.target.value)}
          placeholder="@your_ig 或 @your_threads 或 your@mail.com"
          className="w-full px-3 py-2 rounded-xl border bg-neutral-50"
        />
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} className="mt-1" />
        <span>我已閱讀並同意守則，且保證年齡屬實、內容不含違規事項。</span>
      </label>

      <button disabled={!canSubmit} className="px-4 py-2 rounded-xl bg-neutral-900 text-white disabled:opacity-50">送出投稿（待審）</button>
      {msg && <div className="text-sm text-neutral-700">{msg}</div>}
    </form>
  );
}
