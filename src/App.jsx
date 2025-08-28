import React, { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, collection, addDoc, serverTimestamp, query,
  orderBy, onSnapshot, updateDoc, doc, increment, where
} from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "firebase/auth";

const ADMIN_EMAILS = ["wan8ting@gmail.com"];
const AUTO_HIDE_REPORTS_THRESHOLD = 3;
const MIN_AGE = 18;
const MAX_INTRO_LEN = 280;
const BANNED_WORDS = ["約炮","騷擾","仇恨","種族歧視","霸凌","毒品"];

// 你的 Firebase 設定
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

function useAuth(){ const [user,setUser]=useState(null); useEffect(()=>onAuthStateChanged(auth,setUser),[]); return user; }
const isAdmin = (u)=> !!u && ADMIN_EMAILS.includes(u.email||"");
const containsBanned = (t)=> BANNED_WORDS.some(w=>(t||"").toLowerCase().includes(w.toLowerCase()));
function timeSince(ts){ const d=new Date(ts); const diff=(Date.now()-d.getTime())/1000;
  if(diff<60) return `${Math.floor(diff)} 秒前`;
  if(diff<3600) return `${Math.floor(diff/60)} 分鐘前`;
  if(diff<86400) return `${Math.floor(diff/3600)} 小時前`;
  return `${Math.floor(diff/86400)} 天前`; }

export default function App(){
  const user=useAuth();
  const [tab,setTab]=useState("feed");
  const [posts,setPosts]=useState([]);
  const [pending,setPending]=useState([]);

  useEffect(()=>{ // 公開牆
    const q=query(collection(db,"posts"), where("approved","==",true), orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=>{
      const list=snap.docs.map(d=>({id:d.id,...d.data()}))
        .filter(p=>(p.reportsCount||0)<AUTO_HIDE_REPORTS_THRESHOLD);
      setPosts(list);
    });
    return ()=>unsub();
  },[]);

  useEffect(()=>{ if(!isAdmin(user)) return;
    const q=query(collection(db,"posts"), where("approved","==",false), orderBy("createdAt","desc"));
    const unsub=onSnapshot(q,snap=> setPending(snap.docs.map(d=>({id:d.id,...d.data()}))));
    return ()=>unsub();
  },[user]);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">匿名投稿板 · 七夕特別版</div>
          <nav className="flex gap-2 text-sm">
            <button onClick={()=>setTab("feed")}>看投稿</button>
            <button onClick={()=>setTab("submit")}>我要投稿</button>
            {isAdmin(user)&&(<button onClick={()=>setTab("admin")}>審核區</button>)}
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {tab==="submit"&&<SubmitForm/>}
        {tab==="feed"&&<Feed posts={posts}/>}
        {tab==="admin"&&(isAdmin(user)?<AdminPanel pending={pending} user={user}/>:<LoginPanel/>)}
      </main>
    </div>
  );
}

function SubmitForm(){
  const [age,setAge]=useState(18);
  const [intro,setIntro]=useState("");
  const [contact,setContact]=useState("");
  const [agree,setAgree]=useState(false);
  const [msg,setMsg]=useState("");

  const canSubmit = age>=MIN_AGE && intro.trim().length>0 && intro.trim().length<=MAX_INTRO_LEN && agree;

  async function handleSubmit(e){
    e.preventDefault();
    if(!canSubmit) return;
    if(containsBanned(intro)){ setMsg("內容疑似含有不當字詞，請調整後再送出。"); return; }
    try{
      await addDoc(collection(db,"posts"),{
        age, intro:intro.trim(), contact:contact.trim(),
        approved:false, reportsCount:0, createdAt:serverTimestamp(),
      });
      setMsg("已送出！通過審核後會出現在公開牆。");
      setAge(MIN_AGE); setIntro(""); setContact(""); setAgree(false);
    }catch{ setMsg("送出失敗，請稍後再試。"); }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="number" min={MIN_AGE} value={age} onChange={e=>setAge(parseInt(e.target.value||"0",10))} required />
      <textarea value={intro} onChange={e=>setIntro(e.target.value.slice(0,MAX_INTRO_LEN))} required />
      <input type="text" value={contact} onChange={e=>setContact(e.target.value)} placeholder="IG/Email/Line（選填）" />
      <label><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)} /> 同意守則</label>
      <button disabled={!canSubmit}>送出投稿</button>
      {msg && <div>{msg}</div>}
    </form>
  );
}

function Feed({posts}){ if(!posts.length) return <div>目前還沒有公開投稿</div>; return posts.map(p=><PostCard key={p.id} post={p}/>); }
function PostCard({post}){
  const [showContact,setShowContact]=useState(false);
  const created=post.createdAt?.toDate?.()||new Date();
  async function report(){ try{ await updateDoc(doc(db,"posts",post.id),{reportsCount:increment(1)}); alert("已送出檢舉"); }catch{ alert("檢舉失敗"); } }
  return (
    <div>
      <div>{post.age} 歲 · 發佈於 {timeSince(created)} <button onClick={report}>檢舉</button></div>
      <div>{post.intro}</div>
      {post.contact && !showContact ? <button onClick={()=>setShowContact(true)}>顯示聯絡方式</button> : showContact && <div>{post.contact}</div>}
    </div>
  );
}

function LoginPanel(){
  const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [msg,setMsg]=useState("");
  async function login(e){ e.preventDefault(); try{ await signInWithEmailAndPassword(auth,email.trim(),password); }catch{ setMsg("登入失敗"); } }
  return (
    <form onSubmit={login}>
      <input placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
      <input type="password" placeholder="密碼" value={password} onChange={e=>setPassword(e.target.value)} />
      <button>登入</button>
      {msg && <div>{msg}</div>}
    </form>
  );
}

function AdminPanel({pending,user}){
  async function approve(id){ await updateDoc(doc(db,"posts",id),{approved:true}); }
  async function remove(id){ await updateDoc(doc(db,"posts",id),{approved:false}); }
  async function logout(){ await signOut(auth); }
  return (
    <div>
      <div>你好，{user?.email}</div><button onClick={logout}>登出</button>
      {pending.map(p=>(
        <div key={p.id}>
          <div>{p.age} 歲</div>
          <div>{p.intro}</div>
          {p.contact&&<div>{p.contact}</div>}
          <button onClick={()=>approve(p.id)}>通過</button>
          <button onClick={()=>remove(p.id)}>下架</button>
        </div>
      ))}
    </div>
  );
}
