import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { db, auth } from "./firebase";
import { 
  collection, doc, setDoc, getDoc, onSnapshot, writeBatch, query 
} from "firebase/firestore";
import { 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, setPersistence, browserLocalPersistence, browserSessionPersistence, signOut,
  sendPasswordResetEmail, deleteUser
} from "firebase/auth";
import * as XLSX from "xlsx";
import JSZip from "jszip"; 
import { saveAs } from "file-saver"; 
import Linkify from "linkify-react";
import KoreanLunarCalendar from "korean-lunar-calendar";
import { 
  Save, Upload, HelpCircle, LogOut, Loader, Cloud, Rocket, Calendar, Check, Info, X, 
  RefreshCw, MapPin, UserX, Crown, Search, ChevronDown, ChevronUp, Eye, Pen,
  Briefcase, Clock, Coffee, FileText, Mail, Monitor
} from "lucide-react";
import "./index.css";

// --- 상수 및 유틸 ---
const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MIN_YEAR = 2024;
const MAX_YEAR = 2050;

const generateCalendar = (year, month) => {
  const startDay = new Date(year, month - 1, 1).getDay();
  const lastDate = new Date(year, month, 0).getDate();
  const dates = [];
  for (let i = 0; i < startDay; i++) dates.push(null);
  for (let i = 1; i <= lastDate; i++) dates.push(new Date(year, month - 1, i));
  return dates;
};

const formatDate = (year, month, day) => {
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
};

const addDays = (dateStr, days) => {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return formatDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

// [수정] 텍스트를 줄 단위로 검사해서 '빈 줄'이나 '점(•)만 있는 줄'을 제거하고 합침
const cleanContent = (text) => {
  if (!text) return "";
  
  return text.split('\n')       // 엔터 기준으로 줄을 나눔
    .map(line => line.trimEnd()) // 줄 끝의 공백 제거
    .filter(line => {
      const trimmed = line.trim();
      // 1. 완전히 빈 줄 ("") 제거
      // 2. 점 하나만 있는 줄 ("•") 제거
      return trimmed !== "" && trimmed !== "•"; 
    })
    .join('\n'); // 남은 줄들을 다시 합침
};

// 1. 메인 App 컴포넌트
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;
  return user ? <CalendarApp user={user} /> : <AuthScreen />;
}

// 2. 로딩 화면
function LoadingScreen() {
  const icons = [Calendar, Check, Briefcase, Clock, FileText, Mail, Monitor, Coffee, Rocket];
  const [currentIconIdx, setCurrentIconIdx] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIconIdx((prev) => (prev + 1) % icons.length);
    }, 150);
    return () => clearInterval(interval);
  }, [icons.length]);

  const CurrentIcon = icons[currentIconIdx];

  return (
    <div style={{
      height: '100vh',
      display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
      background: '#f8fafc', gap: '20px'
    }}>
      <div style={{
        width: '80px', height: '80px', background: 'white', borderRadius: '20px',
        boxShadow: '0 10px 25px rgba(124, 58, 237, 0.2)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        animation: 'pulse 1s infinite'
      }}>
        <CurrentIcon size={40} color="#7c3aed" strokeWidth={2.5} />
      </div>
      <div style={{ color: '#64748b', fontWeight: 'bold', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>업무 환경 설정 중</span><span className="dot-pulse">...</span>
      </div>
      <style>{`
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        .dot-pulse { animation: blink 1.5s infinite; }
        @keyframes blink { 0% { opacity: .2; } 20% { opacity: 1; } 100% { opacity: .2; } }
      `}</style>
    </div>
  );
}

// 3. 로그인 화면
function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [autoLogin, setAutoLogin] = useState(true);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      const persistence = autoLogin ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      if (isLogin) await signInWithEmailAndPassword(auth, email, password);
      else await createUserWithEmailAndPassword(auth, email, password);
    } catch (err) { alert("로그인/가입 실패: " + err.message); }
  };
  
  const handleResetPassword = async () => {
    if (!email) return alert("이메일을 입력해주세요.");
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`비밀번호 재설정 메일을 ${email}로 보냈습니다.`);
    } catch (error) { alert("전송 실패: " + error.message); }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-box">
        <h2 style={{textAlign:'center', color:'#1e293b', marginBottom:20}}>📅 일정관리</h2>
        <form onSubmit={handleAuth}>
          <input className="custom-select" style={{width:'100%', marginBottom:10, boxSizing:'border-box'}} 
            type="email" placeholder="이메일" value={email} onChange={e=>setEmail(e.target.value)} required/>
          <input className="custom-select" style={{width:'100%', marginBottom:10, boxSizing:'border-box'}} 
            type="password" placeholder="비밀번호" value={password} onChange={e=>setPassword(e.target.value)} required/>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:15}}>
              <label style={{display:'flex', alignItems:'center', gap:5, fontSize:'0.9rem', color:'#555', cursor:'pointer'}}>
                <input type="checkbox" checked={autoLogin} onChange={e=>setAutoLogin(e.target.checked)} />
                자동 로그인
              </label>
              <button type="button" onClick={handleResetPassword} style={{background:'none', border:'none', color:'#7c3aed', fontSize:'0.85rem', cursor:'pointer', padding:0}}>비밀번호 찾기</button>
          </div>
          <button className="auth-btn">{isLogin ? "로그인" : "회원가입"}</button>
        </form>
        <div style={{marginTop:15, textAlign:'center', fontSize:'0.85rem', cursor:'pointer', color:'#64748b'}} onClick={()=>setIsLogin(!isLogin)}>
          {isLogin ? "계정이 없으신가요? 회원가입" : "로그인하기"}
        </div>
      </div>
    </div>
  );
}

// 4. 캘린더 메인 로직
function CalendarApp({ user }) {
  const [events, setEvents] = useState({});
  const [holidays, setHolidays] = useState({});
  
  const [showHelp, setShowHelp] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [showHeader, setShowHeader] = useState(true);
  
  const [scrollSpeedClass, setScrollSpeedClass] = useState("speed-medium");
  const lastScrollY = useRef(0);

  const [isReady, setIsReady] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  const [focusedDate, setFocusedDate] = useState(null);
  const [mobileEditTarget, setMobileEditTarget] = useState(null);

  const [viewType, setViewType] = useState("specific");
  const [yearType, setYearType] = useState("calendar");
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [endYear, setEndYear] = useState(new Date().getFullYear());
  const [quickYear, setQuickYear] = useState(new Date().getFullYear());
  const [quickMonth, setQuickMonth] = useState(new Date().getMonth() + 1);

  const scrollRef = useRef(null);
  const monthRefs = useRef({});

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, `users/${user.uid}/settings`, "config");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.viewType) setViewType(data.viewType);
          if (data.yearType) setYearType(data.yearType);
          if (data.startYear) setStartYear(data.startYear);
          if (data.endYear) setEndYear(data.endYear);
          if (data.quickYear) setQuickYear(data.quickYear);
          if (data.quickMonth) setQuickMonth(data.quickMonth);
        }
      } catch (e) { console.error(e); } finally { setSettingsLoaded(true); }
    };
    loadSettings();
  }, [user]);

  useLayoutEffect(() => {
    if (settingsLoaded && !isReady) {
      const key = `${quickYear}-${quickMonth}`;
      if (monthRefs.current[key]) {
        monthRefs.current[key].scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      setIsReady(true);
    }
  }, [settingsLoaded, isReady, quickYear, quickMonth]);

  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
    const diff = currentScrollY - lastScrollY.current;
    const absDiff = Math.abs(diff);

    let speed = "speed-medium";
    if (absDiff > 40) speed = "speed-fast";
    else if (absDiff < 10) speed = "speed-slow";
    
    if (scrollSpeedClass !== speed) setScrollSpeedClass(speed);

    if (diff > 5 && currentScrollY > 100) {
      if (isSettingsOpen) setIsSettingsOpen(false);
      else if (!isSettingsOpen && currentScrollY > 150) setShowHeader(false);
    } else if (diff < -5) {
      setShowHeader(true);
    }
    lastScrollY.current = currentScrollY;
  };

  const toggleSettings = () => {
    setIsSettingsOpen(!isSettingsOpen);
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    const saveSettings = async () => {
      try {
        const docRef = doc(db, `users/${user.uid}/settings`, "config");
        await setDoc(docRef, {
          viewType, yearType, startYear, endYear, quickYear, quickMonth
        }, { merge: true });
      } catch (e) { console.error(e); }
    };
    const timer = setTimeout(saveSettings, 1000);
    return () => clearTimeout(timer);
  }, [viewType, yearType, startYear, endYear, quickYear, quickMonth, settingsLoaded, user]);

  useEffect(() => {
    const q = query(collection(db, `users/${user.uid}/calendar`));
    const unsub = onSnapshot(q, (snap) => {
      const ev = {}; const hol = {};
      snap.forEach(doc => {
        const d = doc.data();
        if(d.type === 'holiday') hol[doc.id] = d.name || "휴일";
        if(d.content) ev[doc.id] = d.content;
      });
      setEvents(ev); setHolidays(hol);
    });
    return () => unsub();
  }, [user]);

  const saveEvent = async (date, content) => {
    const ref = doc(db, `users/${user.uid}/calendar`, date);
    await setDoc(ref, { content }, { merge: true });
  };

  const toggleHolidayStatus = async (date) => {
    const isHol = !!holidays[date];
    if (isHol) {
      if(window.confirm("평일로 변경하시겠습니까?")) {
        const ref = doc(db, `users/${user.uid}/calendar`, date);
        await setDoc(ref, { type: 'normal' }, { merge: true });
      }
    } else {
      const name = prompt("휴일 이름을 입력하세요:", "휴일");
      if (name) {
        const ref = doc(db, `users/${user.uid}/calendar`, date);
        await setDoc(ref, { type: 'holiday', name: name }, { merge: true });
      }
    }
  };

  const changeHolidayName = async (date) => {
    const currentName = holidays[date] || "휴일";
    const newName = prompt("휴일 이름을 입력하세요:", currentName);
    if(newName) {
      const ref = doc(db, `users/${user.uid}/calendar`, date);
      await setDoc(ref, { type: 'holiday', name: newName }, { merge: true });
    }
  };

  const handleQuickMove = (y, m) => {
    const targetYear = y || quickYear;
    const targetMonth = m || quickMonth;
    const key = `${targetYear}-${targetMonth}`;
    if(monthRefs.current[key]) {
      monthRefs.current[key].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      alert("설정된 조회 기간 내에 해당 날짜가 없습니다.");
    }
  };

  const handleSaveCurrentPosition = () => {
    alert(`현재 위치(${quickYear}년 ${quickMonth}월)가 시작 화면으로 저장되었습니다.`);
  };

  const handleDeleteAccount = async () => {
    if(!window.confirm("경고: 계정을 삭제하면 모든 데이터가 영구히 삭제됩니다. 정말로 삭제하시겠습니까?")) return;
    try {
        const currentUser = auth.currentUser;
        if (currentUser) {
            await deleteUser(currentUser);
            alert("계정이 삭제되었습니다.");
        }
    } catch (error) {
        if(error.code === 'auth/requires-recent-login') {
            alert("보안을 위해 다시 로그인한 후 삭제해주세요.");
            await signOut(auth);
        } else {
            alert("삭제 실패: " + error.message);
        }
    }
  };

  const handleGenerateHolidays = async () => {
    const currentYear = new Date().getFullYear();
    const endYear = currentYear + 5; 
    
    if(!window.confirm(`${currentYear}년부터 ${endYear}년까지의 공휴일 데이터를 생성하시겠습니까?`)) {
      return;
    }
    setGenerating(true);
    const calendar = new KoreanLunarCalendar();
    let batch = writeBatch(db); 
    let count = 0;
    
    const commitBatch = async () => {
      await batch.commit();
      batch = writeBatch(db);
      count = 0;
    };

    const addHolidayToBatch = async (y, m, d, name) => {
      const dateStr = formatDate(y, m, d);
      const ref = doc(db, `users/${user.uid}/calendar`, dateStr);
      batch.set(ref, { type: 'holiday', name }, { merge: true });
      count++;
      if(count >= 400) await commitBatch();
    };

    try {
      for (let year = currentYear; year <= endYear; year++) {
        await addHolidayToBatch(year, 1, 1, "신정");
        await addHolidayToBatch(year, 3, 1, "삼일절");
        await addHolidayToBatch(year, 5, 5, "어린이날");
        await addHolidayToBatch(year, 6, 6, "현충일");
        await addHolidayToBatch(year, 8, 15, "광복절");
        await addHolidayToBatch(year, 10, 3, "개천절");
        await addHolidayToBatch(year, 10, 9, "한글날");
        await addHolidayToBatch(year, 12, 25, "성탄절");
        const lunarEvents = [{ m: 1, d: 1, name: "설날" }, { m: 4, d: 8, name: "부처님오신날" }, { m: 8, d: 15, name: "추석" }];
        lunarEvents.forEach(h => {
          calendar.setLunarDate(year, h.m, h.d, false);
          const solar = calendar.getSolarCalendar();
          if(h.name === "설날" || h.name === "추석") {
            addHolidayToBatch(solar.year, solar.month, solar.day, h.name);
            const d = new Date(solar.year, solar.month - 1, solar.day);
            const prev = new Date(d); prev.setDate(d.getDate() - 1);
            const next = new Date(d); next.setDate(d.getDate() + 1);
            addHolidayToBatch(prev.getFullYear(), prev.getMonth()+1, prev.getDate(), h.name);
            addHolidayToBatch(next.getFullYear(), next.getMonth()+1, next.getDate(), h.name);
          } else { addHolidayToBatch(solar.year, solar.month, solar.day, h.name); }
        });
      }
      if(count > 0) await commitBatch();
      alert("공휴일 생성이 완료되었습니다!");
    } catch (e) { alert("오류: " + e.message); } 
    finally { setGenerating(false); }
  };

const handleUpload = (e) => {
    const files = Array.from(e.target.files);
    if(files.length === 0) return;
    
    // 파일 처리 결과를 저장할 임시 스토어
    const tempStore = {};

    // Promise.all을 사용하여 모든 파일 처리가 끝날 때까지 기다립니다.
    const filePromises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (ev) => {
          try {
            const wb = XLSX.read(ev.target.result, { type: 'binary' });
            const sheetName = wb.SheetNames[0]; // 시트 이름은 첫 번째 시트를 사용
            const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
            
            for(let i=1; i<rows.length; i++) {
              const [date, content, isCompleted, holidayName] = rows[i];
              if(!date) continue; // 날짜가 없으면 건너뛰기
              
              if(!tempStore[date]) tempStore[date] = { lines: [], holiday: null };
              
              if(holidayName && holidayName.toString().trim() !== "") {
                  tempStore[date].holiday = holidayName.toString().trim();
              }
              
              if(content && content.toString().trim() !== "") {
                const prefix = isCompleted === true || isCompleted.toString().toUpperCase() === "TRUE" ? "✔ " : "• ";
                tempStore[date].lines.push(prefix + content.toString().trim());
              }
            }
            resolve();
          } catch (error) {
            console.error("File read or parse error:", error);
            reject(error);
          }
        };
        reader.onerror = reject;
        reader.readAsBinaryString(file);
      });
    });

    // 모든 파일 처리가 완료된 후 DB 커밋
    Promise.all(filePromises)
      .then(async () => {
        const batch = writeBatch(db);
        Object.entries(tempStore).forEach(([date, data]) => {
          const ref = doc(db, `users/${user.uid}/calendar`, date);
          const updateData = {};
          
          if(data.holiday) { 
            updateData.type = 'holiday'; 
            updateData.name = data.holiday; 
          }
          
          // cleanContent를 사용하여 빈 불릿 제거 후 저장
          const cleanedContent = cleanContent(data.lines.join('\n'));
          
          if(cleanedContent.length > 0) {
            updateData.content = cleanedContent;
          }

          if(Object.keys(updateData).length > 0) {
            batch.set(ref, updateData, { merge: true });
          } else {
             // 만약 복구된 내용이 아무것도 없다면 (예: 날짜만 있고 내용/휴일정보 없음)
             // 기존 데이터를 유지하기 위해 아무것도 안 함 (merge: true 기본 동작)
          }
        });

        // 🌟 최종 커밋 보장 🌟
        if (Object.keys(tempStore).length > 0) {
           await batch.commit();
        }
        
        alert("복구 완료!");
      })
      .catch((error) => {
        console.error("Batch commit failed:", error);
        alert("복구 실패: 파일 처리 중 오류가 발생했습니다. (Console 확인)");
      });
  };

  const handleMobileNavigate = (currentDate, daysToAdd) => {
    const nextDate = addDays(currentDate, daysToAdd);
    setMobileEditTarget(prev => ({ ...prev, id: nextDate }));
  };

  const renderCalendar = () => {
    const years = viewType === 'all' 
      ? Array.from({length: MAX_YEAR-MIN_YEAR+1}, (_, i) => MIN_YEAR + i)
      : Array.from({length: endYear-startYear+1}, (_, i) => startYear + i);

    return years.map(year => {
      let months = [];
      if (yearType === 'academic') {
        const firstPart = Array.from({length: 10}, (_, i) => ({ y: year, m: i + 3 })); 
        const secondPart = Array.from({length: 2}, (_, i) => ({ y: year + 1, m: i + 1 }));
        months = [...firstPart, ...secondPart];
      } else {
        months = Array.from({length: 12}, (_, i) => ({ y: year, m: i + 1 }));
      }

      return (
        <div key={year}>
          {months.map(({y, m}) => (
             <MonthView 
               key={`${y}-${m}`} 
               year={y} month={m} 
               events={events} holidays={holidays}
               focusedDate={focusedDate} setFocusedDate={setFocusedDate}
               onMobileEdit={(d, r) => setMobileEditTarget({ id: d, rect: r })}
               onNavigate={(d, dir) => {
                 let add = 0;
                 if (dir==='RIGHT') add=1; else if (dir==='DOWN') add=7;
                 else if (dir==='LEFT') add=-1; else if (dir==='UP') add=-7;
                 const next = addDays(d, add);
                 setFocusedDate(next);
               }}
               saveEvent={saveEvent} 
               toggleHolidayStatus={toggleHolidayStatus} changeHolidayName={changeHolidayName}
               setRef={(el) => monthRefs.current[`${y}-${m}`] = el}
             />
          ))}
        </div>
      );
    });
  };

  return (
    <div className="app-container">
      <div className={`top-bar-fixed-container ${!showHeader ? 'hidden' : ''} ${scrollSpeedClass}`}>
        <div className="top-bar">
          <div className="title-group">
            <Calendar size={18} color="#7c3aed"/> 
            <span className="title-text">일정 관리</span>
            <span className="sync-badge">
              {settingsLoaded ? "동기화됨" : "..."}
            </span>
          </div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexShrink: 0}}>
             <div className="email-marquee-container">
               <span className="email-text">{user.email}</span>
             </div>
             <button className="btn-pill btn-danger" onClick={handleDeleteAccount} title="계정 삭제">
               <UserX size={14}/>
             </button>
             <button className="btn-pill btn-dark" onClick={()=>signOut(auth)}>
               <LogOut size={14}/>
             </button>
          </div>
        </div>

        <button className="settings-handle" onClick={toggleSettings} title="설정 열기/닫기">
           {isSettingsOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
        </button>

        <div className={`header-settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
          <div className="menu-row">
            <div className="radio-group">
              <label><input type="radio" checked={viewType === 'specific'} onChange={()=>setViewType('specific')} />기간</label>
              <label><input type="radio" checked={viewType === 'all'} onChange={()=>setViewType('all')} />전체</label>
            </div>
            <div className="radio-group" style={{marginLeft:10}}>
              <label><input type="radio" checked={yearType === 'calendar'} onChange={()=>setYearType('calendar')} />연도(1월~12월)</label>
              <label><input type="radio" checked={yearType === 'academic'} onChange={()=>setYearType('academic')} />학년도(3월~2월)</label>
            </div>
            {viewType === 'specific' && (
              <div style={{display:'flex', gap:5, alignItems:'center', marginLeft:10}}>
                <select className="custom-select" value={startYear} onChange={e=>setStartYear(Number(e.target.value))}>
                  {Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}
                </select>
                <span>~</span>
                <select className="custom-select" value={endYear} onChange={e=>setEndYear(Number(e.target.value))}>
                  {Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="menu-row" style={{justifyContent:'space-between'}}>
            <div style={{display:'flex', alignItems:'center', gap:5, fontSize:'0.85rem'}}>
              <Rocket size={14} color="#64748b"/>
              <select className="custom-select" value={quickYear} onChange={e=>setQuickYear(Number(e.target.value))}>
                 {Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}
              </select>
              <select className="custom-select" value={quickMonth} onChange={e=>setQuickMonth(Number(e.target.value))}>
                 {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}
              </select>
              <button className="btn-pill btn-purple" onClick={()=>handleQuickMove()}>Go</button>
              <button className="btn-pill" onClick={handleSaveCurrentPosition} title="현재 위치 저장"><MapPin size={14} /></button>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end'}}>
              <button className="btn-pill" onClick={()=>setShowSearchModal(true)} title="일정 검색">
                <Search size={14}/> 검색
              </button>
              <button className="btn-pill" onClick={handleGenerateHolidays} disabled={generating}>
                {generating ? <Loader size={14} className="spin"/> : <RefreshCw size={14}/>} 
                공휴일
              </button>
              <button className="btn-pill" onClick={()=>setShowHelp(true)}>
                <HelpCircle size={14}/>도움말
              </button>
              <label className="btn-pill" style={{cursor:'pointer'}}>
                <Upload size={14}/>복구
                <input type="file" hidden multiple accept=".xlsx" onChange={handleUpload}/>
              </label>
              <button className="btn-pill btn-green" onClick={() => setShowBackupModal(true)}>
                <Save size={14}/>백업
              </button>
            </div>
          </div>
        </div>
      </div>

      {!isReady && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:200}}><Loader className="spin" size={30} color="#7c3aed"/></div>}
     
      {/* 2. 메인 스크롤 영역 (달력) */}
      <div className="main-scroll-area" ref={scrollRef} onScroll={handleScroll} style={{opacity: isReady ? 1 : 0, paddingTop: '10px'}}>
        {renderCalendar()}
      </div>

      {showHelp && <Modal onClose={()=>setShowHelp(false)} title="도움말"><HelpContent/></Modal>}
      {showBackupModal && <BackupModal onClose={()=>setShowBackupModal(false)} events={events} holidays={holidays}/>}
      {showSearchModal && <SearchModal onClose={()=>setShowSearchModal(false)} events={events} onGo={handleQuickMove}/>}
      
      // App 함수 내부 return 문 안쪽
      {mobileEditTarget && (
         <MobileSliderModal
           initialDate={mobileEditTarget.id}
           events={events}
           holidays={holidays}
           onClose={() => setMobileEditTarget(null)}
           onSave={saveEvent}
         />
       )}

    </div>
  );
}

function CardSlider() {
  // CardSlider는 이제 App.js 내부에 통합되었습니다.
  const [activeIndex, setActiveIndex] = useState(2); 
  const items = [0, 1, 2, 3, 4, 5, 6, 7]; 

  const getCardClass = (index) => {
    const length = items.length;
    let diff = index - activeIndex;

    if (diff > length / 2) diff -= length;
    if (diff < -length / 2) diff += length;

    if (diff === 0) return 'card-item active';
    if (diff === -1) return 'card-item prev';
    if (diff === 1) return 'card-item next';
    if (diff < -1) return 'card-item hide-left';
    return 'card-item hide-right';
  };

  const handlePrev = () => {
    setActiveIndex((prev) => (prev - 1 + items.length) % items.length);
  };

  const handleNext = () => {
    setActiveIndex((prev) => (prev + 1) % items.length);
  };

  return (
    <div className="gallery-container">
      <ul className="cards-list">
        {items.map((item, index) => (
          <li key={index} className={getCardClass(index)}>
            {item}
          </li>
        ))}
      </ul>
      <div className="slider-actions">
        <button className="slider-btn" onClick={handlePrev}>PREV</button>
        <button className="slider-btn next" onClick={handleNext}>NEXT</button>
      </div>
    </div>
  );
}

// [App.js] MobileSliderModal 컴포넌트 (최종 수정본)
function MobileSliderModal({ initialDate, events, holidays, onClose, onSave }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [isClosing, setIsClosing] = useState(false);
  
  // 상태 관리
  const [touchStart, setTouchStart] = useState(null);
  const [touchCurrent, setTouchCurrent] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  
  // 화면 너비
  const winWidth = window.innerWidth;

  // 날짜 준비 (이전 - 현재 - 다음)
  const prevDate = addDays(currentDate, -1);
  const nextDate = addDays(currentDate, 1);
  const cardDates = [prevDate, currentDate, nextDate];

  // 터치 시작
  const handleTouchStart = (e) => {
    if (isAnimating) return;
    setTouchStart(e.touches[0].clientX);
    setTouchCurrent(e.touches[0].clientX);
  };

  // 터치 이동
  const handleTouchMove = (e) => {
    if (touchStart === null || isAnimating) return;
    setTouchCurrent(e.touches[0].clientX);
  };

  // 터치 종료
  const handleTouchEnd = () => {
    if (touchStart === null || isAnimating) return;

    const distance = touchCurrent - touchStart;
    const threshold = winWidth * 0.25; // 25% 이상 밀면 넘어감

    if (distance > threshold) {
      // 오른쪽으로 스와이프 -> 이전 날짜로 (Prev)
      navigate(-1);
    } else if (distance < -threshold) {
      // 왼쪽으로 스와이프 -> 다음 날짜로 (Next)
      navigate(1);
    } else {
      // 제자리로 복귀
      navigate(0);
    }
    
    // 터치 상태 초기화는 애니메이션이 시작된 후 처리
    setTouchStart(null);
    setTouchCurrent(null);
  };

  const navigate = (direction) => {
    setIsAnimating(true); // 애니메이션 시작 잠금

    // 1. 목표 위치 설정 (CSS transition이 작동함)
    // direction: -1(Prev), 0(Stay), 1(Next)
    // 기본위치(-winWidth)에서 direction * winWidth 만큼 이동
    // 예: Next(1)이면 -winWidth - winWidth = -2winWidth (왼쪽으로 이동)
    const targetTranslate = -winWidth - (direction * winWidth);
    
    // DOM 조작을 위해 state 대신 style 객체 업데이트 방식을 씀 (리렌더링 최소화)
    const track = document.getElementById('slider-track');
    if(track) {
      track.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
      track.style.transform = `translateX(${targetTranslate}px)`;
    }

    // 2. 애니메이션 종료 후 (0.3초 뒤) 데이터 변경 및 위치 리셋
    setTimeout(() => {
      if (direction !== 0) {
        setCurrentDate(prev => addDays(prev, direction));
      }
      
      // 트랙 위치를 '소리소문없이' 중앙(-winWidth)으로 리셋
      if(track) {
        track.style.transition = 'none'; // 애니메이션 끄기 (중요!)
        track.style.transform = `translateX(${-winWidth}px)`;
      }
      
      setIsAnimating(false); // 잠금 해제
    }, 300);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  };

  // 렌더링 시 현재 위치 계산
  // 터치 중(touchStart !== null)일 때: 실시간 드래그 반영
  // 아닐 때: JS 애니메이션(navigate 함수)에서 제어하므로 초기값만 설정
  let currentTranslate = -winWidth; // 기본값: 가운데(-100vw)
  let transitionStyle = 'none';

  if (touchStart !== null && touchCurrent !== null) {
    const diff = touchCurrent - touchStart;
    currentTranslate = -winWidth + diff;
    transitionStyle = 'none'; // 드래그 중엔 즉각 반응
  }

  // navigate 함수 실행 중에는 style 속성이 inline으로 덮어씌워지므로
  // 여기서는 '드래그 중'일 때만 style을 강제하면 됨.
  // 하지만 React 렌더링 사이클과 DOM 조작이 섞이면 꼬일 수 있으므로
  // isAnimating일 때는 렌더링 결과가 무시되도록 조건부 스타일링을 합니다.

  return (
    <div className="mobile-slider-overlay" onClick={handleClose}>
      <div 
        id="slider-track"
        className={`slider-track ${isClosing ? 'slider-closing' : 'slider-opening'}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          // 애니메이션 중이 아닐 때만 React가 위치 제어 (드래그 지원)
          // 애니메이션 중일 때는 navigate() 함수가 직접 style을 제어함
          transform: !isAnimating ? `translateX(${currentTranslate}px)` : undefined,
          transition: !isAnimating ? transitionStyle : undefined
        }}
      >
        {cardDates.map((dateStr, idx) => {
          // idx 1이 항상 현재(가운데)
          const isActive = (idx === 1);
          return (
            <div className="mobile-card-wrapper" key={`${dateStr}-${idx}`}>
              <MobileCard
                dateStr={dateStr}
                isActive={isActive}
                content={events[dateStr]}
                holidayName={holidays[dateStr]}
                onSave={onSave}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// [새로운 컴포넌트 2] 개별 카드 UI
function MobileCard({ dateStr, isActive, content, holidayName, onSave }) {
  const [temp, setTemp] = useState(content || "• ");
  const [isViewMode, setIsViewMode] = useState(true);
  const textareaRef = useRef(null);

  // 날짜가 바뀌면 내용 동기화
  useEffect(() => { setTemp(content || "• "); setIsViewMode(true); }, [dateStr, content]);

  // View 모드 -> Edit 모드 시 포커스
  useEffect(() => {
    if (!isViewMode && textareaRef.current && isActive) {
      const len = textareaRef.current.value.length;
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isViewMode, isActive]);

  const handleBlur = () => {
    const cleaned = cleanContent(temp);
    if (cleaned !== content) onSave(dateStr, cleaned);
  };

  const toggleLine = (idx) => {
    if (!isActive) return; // 활성 카드만 조작 가능
    const lines = temp.split('\n');
    const line = lines[idx];
    if (line.trim().startsWith('✔')) lines[idx] = line.replace('✔', '•');
    else lines[idx] = line.replace('•', '✔').replace(/^([^✔•])/, '✔ $1');
    const newContent = lines.join('\n');
    setTemp(newContent);
    onSave(dateStr, newContent);
  };

  const handleViewClick = () => {
    if (!isActive) return; // 활성 카드만 클릭 가능
    let nextVal = temp;
    if (!temp || temp.trim() === "" || temp.trim() === "•") nextVal = "• "; 
    else nextVal = temp + "\n• "; 
    setTemp(nextVal);
    setIsViewMode(false);
  };

  return (
    <div className={`mobile-card-item ${isActive ? 'active' : ''}`}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{dateStr}</span>
          {holidayName && <span className="holiday-badge">{holidayName}</span>}
        </div>
        {isActive && !isViewMode && (
          <button onMouseDown={(e)=>e.preventDefault()} onClick={()=>setIsViewMode(true)} style={{border:'none', background:'none', color:'#7c3aed'}}>
            <Check size={24}/>
          </button>
        )}
      </div>

      <div className="card-body">
        {isViewMode ? (
          <div className="mobile-view-area" onClick={handleViewClick}>
             {(!temp || cleanContent(temp) === "") ? (
                <div style={{color:'#ccc', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column'}}>
                  <div>터치하여 일정 입력</div>
                </div>
             ) : (
               temp.split('\n').map((line, i) => {
                 if (!line.trim()) return null;
                 const isDone = line.trim().startsWith('✔');
                 return (
                   <div key={i} className="task-line" style={{padding:'8px 0', borderBottom:'1px solid #f8fafc'}}>
                     <span className={`bullet ${isDone?'checked':''}`} onClick={(e)=>{e.stopPropagation(); toggleLine(i);}} style={{fontSize:'1.2rem', padding:'0 10px'}}>
                       {isDone ? "✔" : "•"}
                     </span>
                     <span className={isDone?'completed-text':''} style={{flex:1}}>
                        <Linkify options={{target:'_blank'}}>{line.replace(/^[•✔]\s*/, '')}</Linkify>
                     </span>
                   </div>
                 );
               })
             )}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="mobile-textarea"
            value={temp}
            onChange={(e) => setTemp(e.target.value)}
            onBlur={handleBlur}
            disabled={!isActive} // 비활성 카드는 입력 불가
          />
        )}
      </div>
    </div>
  );
}

// 7. SearchModal
function SearchModal({ onClose, events, onGo }) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!keyword.trim()) { setResults([]); return; }
    const res = [];
    Object.entries(events).forEach(([date, content]) => {
      if (content && typeof content === 'string' && content.includes(keyword)) {
        res.push({ date, content });
      }
    });
    res.sort((a,b) => new Date(a.date) - new Date(b.date));
    setResults(res);
  }, [keyword, events]);

  return (
    <Modal onClose={onClose} title="일정 검색">
      <input 
        className="custom-select" style={{width:'100%', padding:'10px', marginBottom:'15px'}} 
        placeholder="검색어를 입력하세요..." value={keyword} onChange={e=>setKeyword(e.target.value)} autoFocus
      />
      <div style={{maxHeight:'300px', overflowY:'auto'}}>
        {results.length === 0 ? <div style={{textAlign:'center', color:'#999'}}>결과가 없습니다.</div> :
          results.map((r, i) => (
            <div key={i} className="search-item" onClick={() => {
              const [y, m] = r.date.split('-');
              onGo(Number(y), Number(m));
              onClose();
            }}>
              <div className="search-date">{r.date}</div>
              <div className="search-text">{r.content.replace(/\n/g, ' ')}</div>
            </div>
          ))
        }
      </div>
    </Modal>
  );
}

// 8. HelpContent
function HelpContent() {
  return (
    <ul className="help-list">
      <li><span className="key-badge">입력</span> <b>Enter</b>를 누르면 자동으로 글머리 기호(•)가 생깁니다.</li>
      <li><span className="key-badge">저장</span> <b>Ctrl + Enter</b>를 누르면 즉시 저장됩니다.</li>
      <li><span className="key-badge">이동</span> 입력창 끝에서 <b>방향키</b>로 다른 날짜로 이동합니다.</li>
      <li><span className="key-badge">취소</span> <b>Esc</b>를 누르면 수정 사항이 취소됩니다.</li>
      <li><span className="key-badge">완료</span> 일정 앞의 <b>글머리(•)</b>를 클릭하면 완료(✔) 처리됩니다.</li>
      <li><span className="key-badge">설정</span> 상단 <b>▼ 탭</b>을 누르면 검색/백업 메뉴가 열립니다.</li>
      <li><span className="key-badge">모바일</span> 카드를 좌우로 쓸어넘기면 날짜가 이동합니다.</li>
    </ul>
  );
}

// 9. BackupModal
function BackupModal({ onClose, events, holidays }) {
  const [sYear, setSYear] = useState(new Date().getFullYear());
  const [sMonth, setSMonth] = useState(1);
  const [eYear, setEYear] = useState(new Date().getFullYear());
  const [eMonth, setEMonth] = useState(12);
  const [processing, setProcessing] = useState(false);

  const handleDownload = async () => {
    setProcessing(true);
    const zip = new JSZip();
    let cnt = 0;
    let cY = sYear, cM = sMonth;
    while(cY < eYear || (cY===eYear && cM<=eMonth)) {
      const mStr = String(cM).padStart(2,'0');
      const prefix = `${cY}-${mStr}`;
      const wsData = [["Date","Content","Completed","HolidayName"]];
      let hasData = false;
      const last = new Date(cY, cM, 0).getDate();
      for(let d=1; d<=last; d++) {
        const key = `${prefix}-${String(d).padStart(2,'0')}`;
        const c = events[key]; const h = holidays[key];
        if(c||h) {
          hasData=true;
          if(h && !c) wsData.push([key,"","",h]);
          else if(c) c.split('\n').forEach((l,i)=>wsData.push([key,l.replace(/^[•✔]\s*/,""),l.trim().startsWith('✔')?"TRUE":"FALSE", (i===0&&h)?h:""]));
        }
      }
      if(hasData) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), "Schedule");
        zip.file(`${cY}년_${mStr}월.xlsx`, XLSX.write(wb,{bookType:"xlsx",type:"array"}));
        cnt++;
      }
      cM++; if(cM>12){cM=1; cY++;}
    }
    if(cnt===0) { alert("데이터 없음"); setProcessing(false); return; }
    saveAs(await zip.generateAsync({type:"blob"}), "백업.zip");
    setProcessing(false); onClose();
  };

  return (
    <Modal onClose={onClose} title="백업 (Excel)">
      <div style={{display:'flex',justifyContent:'center',gap:10, marginBottom:10}}>
        <select className="custom-select" value={sYear} onChange={e=>setSYear(Number(e.target.value))}>{Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
        <select className="custom-select" value={sMonth} onChange={e=>setSMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}</select>
        <span>~</span>
        <select className="custom-select" value={eYear} onChange={e=>setEYear(Number(e.target.value))}>{Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
        <select className="custom-select" value={eMonth} onChange={e=>setEMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}</select>
      </div>
      <button className="auth-btn" onClick={handleDownload} disabled={processing}>{processing?"진행중...":"다운로드"}</button>
    </Modal>
  );
}

// 10. Modal
function Modal({ onClose, title, children }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box animate__animated animate__fadeInDown" style={{animationDuration:'0.3s'}} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{display:'flex',alignItems:'center',gap:8}}><Info size={20} color="#7c3aed"/><span>{title}</span></div>
          <X size={20} style={{cursor:'pointer'}} onClick={onClose}/>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// 11. MonthView
function MonthView({ year, month, events, holidays, focusedDate, setFocusedDate, onNavigate, onMobileEdit, saveEvent, toggleHolidayStatus, changeHolidayName, setRef }) {
  const dates = generateCalendar(year, month);
  return (
    <div className="month-container" ref={setRef}>
      <div className="month-header-bar">{year}년 {month}월</div>
      <div className="month-grid">
        {DAYS.map((d, i) => <div key={d} className={`day-header ${i===0?'day-sun':i===6?'day-sat':''}`}>{d}</div>)}
        {dates.map((d, i) => {
          if(!d) return <div key={`empty-${i}`} className="date-cell" style={{background:'#fafafa'}}></div>;
          const dateStr = formatDate(year, month, d.getDate());
          return <DateCell key={dateStr} date={d} dateStr={dateStr} content={events[dateStr]||""} holidayName={holidays[dateStr]} 
            isSun={d.getDay()===0} isSat={d.getDay()===6} focusedDate={focusedDate} setFocusedDate={setFocusedDate} onNavigate={onNavigate} onMobileEdit={onMobileEdit}
            onSave={saveEvent} onToggleHolidayStatus={toggleHolidayStatus} onChangeHolidayName={changeHolidayName}/>
        })}
      </div>
    </div>
  );
}

// 12. DateCell (PC용 체크버튼, 스크롤 자동 이동, 불릿 자동 추가 포함)
function DateCell({ date, dateStr, content, holidayName, isSun, isSat, focusedDate, setFocusedDate, onNavigate, onMobileEdit, onSave, onToggleHolidayStatus, onChangeHolidayName }) {
  const [temp, setTemp] = useState(content);
  const textareaRef = useRef(null);
  
  const isAllDone = content && content.split('\n').every(l => l.trim().startsWith('✔'));
  const isEditing = focusedDate === dateStr;

  useEffect(() => { if (!isEditing) setTemp(content); }, [content, isEditing]);

  useEffect(() => {
    if (isEditing) {
      setTimeout(() => { 
        if(textareaRef.current) { 
          const el = textareaRef.current;
          el.focus(); 
          el.setSelectionRange(el.value.length, el.value.length); 
          el.scrollTop = el.scrollHeight;
        } 
      }, 50);
    }
  }, [isEditing]);

  const handleClick = (e) => {
    if (window.innerWidth <= 768) {
      const rect = e.currentTarget.getBoundingClientRect();
      onMobileEdit(dateStr, rect); 
    } else {
      if(!isEditing) { 
        const nextContent = (content && content.trim().length > 0) ? content + "\n• " : "• ";
        setTemp(nextContent); 
        setFocusedDate(dateStr); 
      }
    }
  };

  const handleBlur = () => {
    setFocusedDate(null);
    const cleaned = cleanContent(temp);
    if(cleaned !== content) onSave(dateStr, cleaned);
  };

  const handleFinish = (e) => {
    e.stopPropagation(); 
    setFocusedDate(null);
    const cleaned = cleanContent(temp);
    if(cleaned !== content) onSave(dateStr, cleaned);
  };

  const handleKeyDown = (e) => {
    if(e.key === 'Enter') {
      if(e.ctrlKey) e.target.blur();
      else { 
        e.preventDefault(); 
        const v = e.target.value; 
        const s = e.target.selectionStart; 
        setTemp(v.substring(0, s) + "\n• " + v.substring(s)); 
        setTimeout(() => {
          e.target.setSelectionRange(s+3, s+3);
          e.target.scrollTop = e.target.scrollHeight; 
        }, 0);
      }
    } else if(e.key==='Escape') { 
      setFocusedDate(null); 
      setTemp(content); 
    } else {
      const { selectionStart, value } = e.target;
      if(e.key==='ArrowRight' && selectionStart===value.length) { e.preventDefault(); onNavigate(dateStr,'RIGHT'); }
      else if(e.key==='ArrowDown' && selectionStart===value.length) { e.preventDefault(); onNavigate(dateStr,'DOWN'); }
      else if(e.key==='ArrowLeft' && selectionStart===0) { e.preventDefault(); onNavigate(dateStr,'LEFT'); }
      else if(e.key==='ArrowUp' && selectionStart===0) { e.preventDefault(); onNavigate(dateStr,'UP'); }
    }
  };

  const toggleLine = (idx) => {
    const lines = content.split('\n');
    if(lines[idx].trim().startsWith('✔')) lines[idx] = lines[idx].replace('✔', '•');
    else lines[idx] = lines[idx].replace('•', '✔').replace(/^([^✔•])/, '✔ $1');
    onSave(dateStr, lines.join('\n'));
  };

  return (
    <div 
      className={`date-cell ${isSun?'bg-sun':isSat?'bg-sat':''} ${holidayName?'bg-holiday':''}`} 
      onClick={handleClick}
      style={{ position: 'relative' }}
    >
      <div className="date-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span 
            className={`date-num ${isSun?'text-sun':isSat?'text-blue':''} ${holidayName?'text-sun':''}`} 
            onClick={(e)=>{e.stopPropagation();onToggleHolidayStatus(dateStr);}}
          >
            {date.getDate()}
          </span>
          {isAllDone && <Crown size={14} color="#f59e0b" fill="#f59e0b"/>}
        </div>
        
        {holidayName && (
          <span 
            className="holiday-badge" 
            onClick={(e)=>{e.stopPropagation();onChangeHolidayName(dateStr);}}
          >
            {holidayName}
          </span>
        )}
      </div>

      {isEditing && (
        <button
          onMouseDown={(e) => e.preventDefault()} 
          onClick={handleFinish}
          style={{
            position: 'absolute', top: '4px', right: '4px', zIndex: 10,
            background: '#7c3aed', color: 'white', border: 'none', borderRadius: '50%',
            width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
          }}
          title="입력 완료"
        >
          <Check size={10} strokeWidth={3} />
        </button>
      )}

      <div className="task-content">
        {isEditing ? 
          <textarea 
            ref={textareaRef} 
            className="cell-input" 
            value={temp} 
            onChange={e=>setTemp(e.target.value)} 
            onBlur={handleBlur} 
            onKeyDown={handleKeyDown}
          /> :
          <div className="task-wrapper">
            {content.split('\n').map((l, i) => {
              if(!l.trim()) return null; 
              const done = l.trim().startsWith('✔');
              return (
                <div key={i} className="task-line">
                  <span 
                    className={`bullet ${done?'checked':''}`} 
                    onClick={(e)=>{e.stopPropagation(); toggleLine(i);}}
                  >
                    {done?"✔":"•"}
                  </span>
                  <span className={done?'completed-text':''}>
                    <Linkify options={{target:'_blank'}}>
                      {l.replace(/^[•✔]\s*/,'')}</Linkify>
                  </span>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>
  );
}

export default App;