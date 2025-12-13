import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from "react";
import { db, auth } from "./firebase";
import { 
  collection, doc, setDoc, getDoc, onSnapshot, writeBatch, query, deleteField 
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
  Briefcase, Clock, Coffee, FileText, Mail, Monitor, 
  ArrowUp, ArrowDown, 
  GripVertical, 
  Link, Copy, ExternalLink
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

// [NEW] URL 감지 정규식
const URL_REGEX = /(https?:\/\/[^\s]+)/g;

// [NEW] 링크 렌더러 컴포넌트
function SmartTextRenderer({ text, onLinkClick }) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return (
    <>
      {parts.map((part, i) => {
        if (part.match(URL_REGEX)) {
          return (
            <span key={i} className="link-badge" onClick={(e) => onLinkClick(part, e)}>
              <Link size={12} strokeWidth={2.5} /> 링크
            </span>
          );
        }
        return part;
      })}
    </>
  );
}

// [NEW] 링크 클릭 시 뜨는 메뉴 (복사/이동)
function LinkActionMenu({ url, position, onClose }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    alert("링크가 복사되었습니다!");
    onClose();
  };

  const handleGo = () => {
    window.open(url, '_blank');
    onClose();
  };

  const style = {
    top: position.y + 10,
    left: Math.min(position.x, window.innerWidth - 130)
  };

  return (
    <>
      <div className="modal-overlay" style={{background:'transparent', backdropFilter:'none'}} onClick={onClose} />
      <div className="link-action-menu" style={style}>
        <div className="link-action-item" onClick={handleCopy}><Copy size={14} /> 복사하기</div>
        <div className="link-action-item" onClick={handleGo}><ExternalLink size={14} /> 이동하기</div>
      </div>
    </>
  );
}


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
        <span>Bee:um - 나의 일정 관리 앱 </span><span className="dot-pulse">...</span>
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

// 4. 캘린더 메인 로직 (V19: 메인 스크롤 회전 위치 고정 & 모든 기능 통합)
function CalendarApp({ user }) {
  const [events, setEvents] = useState({});
  const [holidays, setHolidays] = useState({});
  
  const [showHelp, setShowHelp] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  
  const [undoStack, setUndoStack] = useState([]); 
  const [holidayModalData, setHolidayModalData] = useState(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(true);
  const [showHeader, setShowHeader] = useState(true);
  const [scrollSpeedClass, setScrollSpeedClass] = useState("speed-medium");
  
  const lastScrollY = useRef(0);
  const [isReady, setIsReady] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  
  // 현재 보고 있는 달 추적
  const visibleMonthId = useRef(null);

  const [focusedDate, setFocusedDate] = useState(null);
  const [mobileEditTarget, setMobileEditTarget] = useState(null);

  // [NEW] 링크 메뉴 상태
  const [linkMenu, setLinkMenu] = useState(null);

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
    
    if (diff > 5 && currentScrollY > 100) {
      if (isSettingsOpen) setIsSettingsOpen(false);
      else if (!isSettingsOpen && currentScrollY > 150) setShowHeader(false);
    } else if (diff < -5) {
      setShowHeader(true);
    }
    lastScrollY.current = currentScrollY;

    for (const key in monthRefs.current) {
        const el = monthRefs.current[key];
        if (el) {
            if (el.offsetTop + el.offsetHeight > currentScrollY + 80) { 
                visibleMonthId.current = key;
                break;
            }
        }
    }
  };

  useEffect(() => {
    const handleResize = () => {
        if (visibleMonthId.current && monthRefs.current[visibleMonthId.current]) {
            monthRefs.current[visibleMonthId.current].scrollIntoView({ behavior: 'auto', block: 'start' });
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleSettings = () => setIsSettingsOpen(!isSettingsOpen);

  useEffect(() => {
    if (!settingsLoaded) return;
    const timer = setTimeout(async () => {
      try {
        await setDoc(doc(db, `users/${user.uid}/settings`, "config"), {
          viewType, yearType, startYear, endYear, quickYear, quickMonth
        }, { merge: true });
      } catch (e) { console.error(e); }
    }, 1000);
    return () => clearTimeout(timer);
  }, [viewType, yearType, startYear, endYear, quickYear, quickMonth, settingsLoaded, user]);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, `users/${user.uid}/calendar`)), (snap) => {
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

  const handleUndo = async () => {
    if (undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    const ref = doc(db, `users/${user.uid}/calendar`, lastAction.date);
    
    if (lastAction.type === 'content') {
        await setDoc(ref, { content: lastAction.prevContent }, { merge: true });
    } else if (lastAction.type === 'holiday') {
        if (lastAction.prevType === 'normal') {
             await setDoc(ref, { type: 'normal', name: deleteField() }, { merge: true });
        } else {
             await setDoc(ref, { type: 'holiday', name: lastAction.prevName }, { merge: true });
        }
    }
    setUndoStack(prev => prev.slice(0, -1));
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); handleUndo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack]);

  const saveEvent = async (date, content) => {
    const prevContent = events[date] || "";
    if (prevContent === content) return;
    setUndoStack(prev => [...prev, { type: 'content', date, prevContent }]);
    await setDoc(doc(db, `users/${user.uid}/calendar`, date), { content }, { merge: true });
  };

  const openHolidayModal = (date) => {
    setHolidayModalData({ date, currentName: holidays[date] || "" });
  };

  const handleSaveHoliday = async (date, name) => {
    const prevType = holidays[date] ? 'holiday' : 'normal';
    const prevName = holidays[date] || "";
    setUndoStack(prev => [...prev, { type: 'holiday', date, prevType, prevName }]);

    const ref = doc(db, `users/${user.uid}/calendar`, date);
    if (name) await setDoc(ref, { type: 'holiday', name }, { merge: true });
    else await setDoc(ref, { type: 'normal', name: deleteField() }, { merge: true });
    setHolidayModalData(null);
  };

  const handleQuickMove = (y, m) => {
    const targetYear = y || quickYear; const targetMonth = m || quickMonth;
    const key = `${targetYear}-${targetMonth}`;
    if(monthRefs.current[key]) {
        visibleMonthId.current = key;
        monthRefs.current[key].scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else alert("설정된 조회 기간 내에 해당 날짜가 없습니다.");
  };

  const handleSaveCurrentPosition = () => alert(`현재 위치(${quickYear}년 ${quickMonth}월)가 시작 화면으로 저장되었습니다.`);
  
  const handleDeleteAccount = async () => {
    if(!window.confirm("경고: 계정 삭제 시 모든 데이터가 삭제됩니다.")) return;
    try { await deleteUser(auth.currentUser); alert("계정 삭제됨"); } 
    catch (e) { alert("로그인 후 다시 시도하세요."); await signOut(auth); }
  };

  const handleGenerateHolidays = async () => {
    alert("공휴일 생성 기능 실행"); 
  };
  const handleUpload = (e) => { };

  // [NEW] 링크 클릭 핸들러
  const handleLinkClick = (url, e) => {
    e.stopPropagation();
    setLinkMenu({ url, x: e.clientX, y: e.clientY });
  };

  const renderCalendar = () => {
    const years = viewType === 'all' 
      ? Array.from({length: MAX_YEAR-MIN_YEAR+1}, (_, i) => MIN_YEAR + i)
      : Array.from({length: endYear-startYear+1}, (_, i) => startYear + i);

    return years.map(year => {
      let months = [];
      if (yearType === 'academic') {
        months = [...Array.from({length: 10}, (_, i) => ({ y: year, m: i + 3 })), ...Array.from({length: 2}, (_, i) => ({ y: year + 1, m: i + 1 }))];
      } else {
        months = Array.from({length: 12}, (_, i) => ({ y: year, m: i + 1 }));
      }

      return (
        <div key={year}>
          {months.map(({y, m}) => (
             <MonthView 
               key={`${y}-${m}`} year={y} month={m} 
               events={events} holidays={holidays}
               focusedDate={focusedDate} setFocusedDate={setFocusedDate}
               onMobileEdit={(d, r) => setMobileEditTarget({ id: d, rect: r })}
               onNavigate={(d, dir) => {
                 let add = 0;
                 if (dir==='RIGHT') add=1; else if (dir==='DOWN') add=7;
                 else if (dir==='LEFT') add=-1; else if (dir==='UP') add=-7;
                 setFocusedDate(addDays(d, add));
               }}
               saveEvent={saveEvent} 
               onHolidayClick={openHolidayModal} 
               setRef={(el) => monthRefs.current[`${y}-${m}`] = el}
               onLinkClick={handleLinkClick}
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
          <div className="title-group"><Calendar size={18} color="#7c3aed"/> <span className="title-text">일정 관리</span><span className="sync-badge">{settingsLoaded ? "동기화됨" : "..."}</span></div>
          <div style={{display:'flex', gap:8, alignItems:'center', flexShrink: 0}}>
             <div className="email-marquee-container"><span className="email-text">{user.email}</span></div>
             <button className="btn-pill btn-danger" onClick={handleDeleteAccount}><UserX size={14}/></button>
             <button className="btn-pill btn-dark" onClick={()=>signOut(auth)}><LogOut size={14}/></button>
          </div>
        </div>
        <button className="settings-handle" onClick={toggleSettings}>{isSettingsOpen ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}</button>
        <div className={`header-settings-drawer ${isSettingsOpen ? 'open' : ''}`}>
           <div className="menu-row">
            <div className="radio-group">
              <label><input type="radio" checked={viewType === 'specific'} onChange={()=>setViewType('specific')} />기간</label>
              <label><input type="radio" checked={viewType === 'all'} onChange={()=>setViewType('all')} />전체</label>
            </div>
            <div className="radio-group" style={{marginLeft:10}}>
              <label><input type="radio" checked={yearType === 'calendar'} onChange={()=>setYearType('calendar')} />연도</label>
              <label><input type="radio" checked={yearType === 'academic'} onChange={()=>setYearType('academic')} />학년도</label>
            </div>
            {viewType === 'specific' && (
              <div style={{display:'flex', gap:5, alignItems:'center', marginLeft:10}}>
                <select className="custom-select" value={startYear} onChange={e=>setStartYear(Number(e.target.value))}>{Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
                <span>~</span>
                <select className="custom-select" value={endYear} onChange={e=>setEndYear(Number(e.target.value))}>{Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
              </div>
            )}
           </div>
           <div className="menu-row" style={{justifyContent:'space-between'}}>
            <div style={{display:'flex', alignItems:'center', gap:5, fontSize:'0.85rem'}}>
              <Rocket size={14} color="#64748b"/>
              <select className="custom-select" value={quickYear} onChange={e=>setQuickYear(Number(e.target.value))}>{Array.from({length:30},(_,i)=>2024+i).map(y=><option key={y} value={y}>{y}</option>)}</select>
              <select className="custom-select" value={quickMonth} onChange={e=>setQuickMonth(Number(e.target.value))}>{Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>{m}월</option>)}</select>
              <button className="btn-pill btn-purple" onClick={()=>handleQuickMove()}>Go</button>
              <button className="btn-pill" onClick={handleSaveCurrentPosition}><MapPin size={14} /></button>
            </div>
            <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end'}}>
              <button className="btn-pill" onClick={()=>setShowSearchModal(true)}><Search size={14}/> 검색</button>
              <button className="btn-pill" onClick={handleGenerateHolidays} disabled={generating}>{generating ? <Loader size={14} className="spin"/> : <RefreshCw size={14}/>} 공휴일</button>
              <button className="btn-pill" onClick={()=>setShowHelp(true)}><HelpCircle size={14}/>도움말</button>
              <label className="btn-pill" style={{cursor:'pointer'}}><Upload size={14}/>복구<input type="file" hidden multiple accept=".xlsx" onChange={handleUpload}/></label>
              <button className="btn-pill btn-green" onClick={() => setShowBackupModal(true)}><Save size={14}/>백업</button>
            </div>
          </div>
        </div>
      </div>

      {!isReady && <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:200}}><Loader className="spin" size={30} color="#7c3aed"/></div>}
     
      <div className="main-scroll-area" ref={scrollRef} onScroll={handleScroll} style={{opacity: isReady ? 1 : 0, paddingTop: '10px'}}>
        {renderCalendar()}
      </div>

      {showHelp && <Modal onClose={()=>setShowHelp(false)} title="도움말"><HelpContent/></Modal>}
      {showBackupModal && <BackupModal onClose={()=>setShowBackupModal(false)} events={events} holidays={holidays}/>}
      {showSearchModal && <SearchModal onClose={()=>setShowSearchModal(false)} events={events} onGo={handleQuickMove}/>}
      
      {undoStack.length > 0 && (
        <div className="undo-toast" onClick={handleUndo}>
            <RefreshCw size={16} style={{transform:'scaleX(-1)'}}/> 실행 취소
        </div>
      )}

      {holidayModalData && (
        <HolidayModal data={holidayModalData} onClose={() => setHolidayModalData(null)} onSave={handleSaveHoliday} />
      )}
      
      {mobileEditTarget && (
         <MobileSliderModal
           initialDate={mobileEditTarget.id}
           events={events}
           holidays={holidays}
           onClose={() => setMobileEditTarget(null)}
           onSave={saveEvent}
           onLinkClick={handleLinkClick}
         />
       )}

      {linkMenu && (
        <LinkActionMenu 
          url={linkMenu.url} 
          position={{ x: linkMenu.x, y: linkMenu.y }} 
          onClose={() => setLinkMenu(null)} 
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


// [MobileSliderModal]
function MobileSliderModal({ initialDate, events, holidays, onClose, onSave, onLinkClick }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [isOpening, setIsOpening] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  
  const trackRef = useRef(null);
  const cardRefs = useRef([null, null, null, null, null]); 
  const rafId = useRef(null);
  
  const dragState = useRef({ start: 0, startTime: 0, currentTranslate: 0, isAnimating: false, isDragging: false });
  const layoutMetrics = useRef({ itemWidth: 0, initialTranslate: 0 });

  const prev2Date = addDays(currentDate, -2);
  const prev1Date = addDays(currentDate, -1);
  const next1Date = addDays(currentDate, 1);
  const next2Date = addDays(currentDate, 2);
  const cardDates = [prev2Date, prev1Date, currentDate, next1Date, next2Date];

  const updateCardStyles = useCallback((currentTrackPosition) => {
    if (isClosing) return;
    const { itemWidth, initialTranslate } = layoutMetrics.current;
    if (itemWidth === 0) return;
    const trackOffsetFromIdealCenter = currentTrackPosition - initialTranslate;
    
    for (let i = 0; i < cardRefs.current.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        if (isOpening && i === 2) { el.style.transform = ''; el.style.opacity = ''; continue; }
        
        const idealCardOffset = (i - 2) * itemWidth; 
        let distance = idealCardOffset + trackOffsetFromIdealCenter;
        distance = Math.max(-itemWidth, Math.min(itemWidth, distance));
        const normFactor = Math.abs(distance) / itemWidth; 
        let effectiveFactor = (i === 2) ? normFactor : (normFactor > 1 ? 1 : normFactor);
        const scale = 1.0 - (effectiveFactor * 0.05);
        let opacity = (i === 2) ? 1.0 - (effectiveFactor * 0.5) : 1.0 - (Math.pow(effectiveFactor, 3) * 0.5);

        el.style.transition = 'none'; 
        el.style.transform = `scale(${scale})`;
        el.style.opacity = opacity;
    }
  }, [isOpening, isClosing]);

  const updateLayout = useCallback(() => {
    const screenWidth = window.innerWidth;
    const cardContentVW = screenWidth * 0.75;
    const cardContentWidth = Math.min(cardContentVW, 360); 
    const cardMargin = screenWidth * 0.025;
    const itemSlotWidth = cardContentWidth + (2 * cardMargin); 
    const initialTranslate = (screenWidth / 2) - (itemSlotWidth * 2) - (itemSlotWidth / 2);
    
    layoutMetrics.current = { itemWidth: itemSlotWidth, initialTranslate };
    if (trackRef.current) {
        trackRef.current.style.transition = 'none';
        trackRef.current.style.transform = `translateX(${initialTranslate}px)`;
        updateCardStyles(initialTranslate);
    }
  }, [updateCardStyles]);

  useEffect(() => {
    if (!isOpening) updateLayout();
  }, [isOpening, updateLayout]);

  useEffect(() => {
    updateLayout();
    const handleResize = () => { if (rafId.current) cancelAnimationFrame(rafId.current); updateLayout(); };
    window.addEventListener('resize', handleResize);
    const openingTimer = setTimeout(() => setIsOpening(false), 500);
    return () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      clearTimeout(openingTimer);
      window.removeEventListener('resize', handleResize);
    };
  }, [updateLayout]);

  const setTrackPosition = (position, durationStr = null) => {
    if (!trackRef.current) return;
    trackRef.current.style.transition = durationStr ? `transform ${durationStr} ease-out` : 'none';
    trackRef.current.style.transform = `translateX(${position}px)`;
  };

  const handleTouchStart = (e) => {
    if (dragState.current.isAnimating) return;
    if (rafId.current) cancelAnimationFrame(rafId.current);
    dragState.current.start = e.touches[0].clientX;
    dragState.current.startTime = Date.now();
    const style = window.getComputedStyle(trackRef.current).transform;
    const matrix = style.match(/matrix.*\((.+)\)/);
    dragState.current.currentTranslate = matrix ? parseFloat(matrix[1].split(', ')[4]) : 0;
    dragState.current.isDragging = false;
  };

  const handleTouchMove = (e) => {
    if (dragState.current.start === 0) return;
    const diff = e.touches[0].clientX - dragState.current.start;
    const newTrackPosition = dragState.current.currentTranslate + diff;
    if (Math.abs(diff) > 5) dragState.current.isDragging = true;
    setTrackPosition(newTrackPosition, null); 
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => updateCardStyles(newTrackPosition));
  };

  const handleTouchEnd = (e) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    if (!dragState.current.isDragging) { dragState.current.start = 0; return; }
    
    dragState.current.isAnimating = true;
    const endTime = Date.now();
    const duration = endTime - dragState.current.startTime;
    const distanceMoved = e.changedTouches[0].clientX - dragState.current.start;
    const velocity = Math.abs(distanceMoved / duration);
    const animDuration = velocity > 0.5 ? '0.2s' : '0.3s';

    const style = window.getComputedStyle(trackRef.current).transform;
    const matrix = style.match(/matrix.*\((.+)\)/);
    const currentTrackPosition = matrix ? parseFloat(matrix[1].split(', ')[4]) : 0;
    
    const movedDist = currentTrackPosition - layoutMetrics.current.initialTranslate;
    const { itemWidth, initialTranslate } = layoutMetrics.current;
    
    const threshold = itemWidth / 4; 
    let dateDirection = 0; 
    let trackOffset = 0;
    const activeThreshold = velocity > 0.5 ? threshold * 0.5 : threshold;

    if (movedDist < -activeThreshold) { dateDirection = 1; trackOffset = -itemWidth; } 
    else if (movedDist > activeThreshold) { dateDirection = -1; trackOffset = itemWidth; }
    
    const targetTranslate = initialTranslate + trackOffset; 
    setTrackPosition(targetTranslate, animDuration);

    cardRefs.current.forEach((el, idx) => {
        if (!el) return;
        el.style.transition = `transform ${animDuration} ease-out, opacity ${animDuration} ease-out`;
        let targetScale = 0.95; let targetOpacity = 0.5;
        let isActiveTarget = false;
        if (dateDirection === 0 && idx === 2) isActiveTarget = true; 
        else if (dateDirection === 1 && idx === 3) isActiveTarget = true; 
        else if (dateDirection === -1 && idx === 1) isActiveTarget = true; 
        if (isActiveTarget) { targetScale = 1.0; targetOpacity = 1.0; } else if (idx !== 2) { targetOpacity = 0.5; }
        el.style.transform = `scale(${targetScale})`;
        el.style.opacity = targetOpacity;
    });

    setTimeout(() => {
      if (dateDirection !== 0) setCurrentDate(prev => addDays(prev, dateDirection)); 
      cardRefs.current.forEach(el => { if (el) { el.style.transform = ''; el.style.opacity = ''; el.style.transition = ''; } });
      setTrackPosition(initialTranslate, false);
      dragState.current = { ...dragState.current, start: 0, startTime: 0, isAnimating: false };
    }, parseFloat(animDuration) * 1000);
  };

  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 250); };
  const containerClass = `slider-track ${isClosing ? 'slider-closing' : ''} ${isOpening ? 'slider-opening' : ''}`;

  return (
    <div className="mobile-slider-overlay" onClick={handleClose}>
      <div ref={trackRef} className={containerClass} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        {cardDates.map((dateStr, idx) => (
          <div className="mobile-card-wrapper" key={dateStr}>
            <div onClick={(e) => e.stopPropagation()} style={{width:'100%'}}>
              <MobileCard
                key={dateStr}
                cardRef={(el) => cardRefs.current[idx] = el}
                isActive={idx === 2} 
                dateStr={dateStr}
                content={events[dateStr]}
                holidayName={holidays[dateStr]}
                onSave={onSave}
                onClose={handleClose}
                onLinkClick={onLinkClick} 
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MobileCard({ dateStr, isActive, content, holidayName, onSave, onClose, cardRef, onLinkClick }) {
  const [temp, setTemp] = useState(content || "• ");
  const [isViewMode, setIsViewMode] = useState(true);
  
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  
  const dragRef = useRef({ startY: 0, originalStartIndex: 0, currentIndex: 0, itemHeight: 0, list: [] });
  const textareaRef = useRef(null);

  useEffect(() => { setTemp(content || "• "); }, [dateStr, content]);

  useEffect(() => {
    if (!isViewMode && isActive && textareaRef.current) {
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
          textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
        }
      }, 50);
    }
  }, [isViewMode, isActive]);

  const handleSaveInternal = (overrideContent = null) => {
    const contentToSave = overrideContent !== null ? overrideContent : temp;
    const cleaned = cleanContent(contentToSave);
    if (cleaned !== content) onSave(dateStr, cleaned);
    setTemp(cleaned || "• ");
  };

  const handleSwitchToEdit = () => {
    let currentVal = temp;
    if (!currentVal || currentVal.trim() === "") currentVal = "• ";
    else {
      const trimmed = currentVal.trimEnd();
      if (!trimmed.endsWith("•")) currentVal = trimmed + "\n• ";
      else currentVal = trimmed + " ";
    }
    setTemp(currentVal);
    setIsViewMode(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      textareaRef.current.blur();
      setIsViewMode(true);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const val = temp;
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newVal = val.substring(0, start) + "\n• " + val.substring(end);
      setTemp(newVal);
      setTimeout(() => { if(textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 3; }, 0);
    }
  };

  // [수정된 모바일 터치 드래그 로직 - 손가락 따라다니기 구현]
  const handleTouchStart = (e, index) => {
    if (!isViewMode) return;
    const touch = e.touches[0];
    const targetRow = e.currentTarget.closest('.task-line');
    
    // 높이 계산 (소수점 오차 방지를 위해 반올림)
    const rect = targetRow.getBoundingClientRect();
    const itemHeight = Math.round(rect.height);

    const currentLines = temp.split('\n').filter(l => l.trim() !== "" && l.trim() !== "•");

    setIsDragging(true);
    setDraggingIdx(index);
    
    // 드래그 중 스크롤 방지
    document.body.style.overflow = 'hidden';

    // 기준점(startY)은 "최초 터치 지점"으로 고정
    dragRef.current = { 
      startY: touch.clientY, 
      originalStartIndex: index,
      currentIndex: index, 
      itemHeight: itemHeight, 
      list: [...currentLines] 
    };
    
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
  };

  const handleTouchMove = (e) => {
    if (!dragRef.current) return;
    if (e.cancelable) e.preventDefault(); // 스크롤 차단
    
    const touch = e.touches[0];
    const { startY, itemHeight, originalStartIndex, currentIndex, list } = dragRef.current;
    
    const totalDeltaY = touch.clientY - startY;
    const moveSteps = Math.round(totalDeltaY / itemHeight);
    const newTargetIndex = originalStartIndex + moveSteps;
    
    if (newTargetIndex >= 0 && newTargetIndex < list.length && newTargetIndex !== currentIndex) {
        const newList = [...list];
        const [movedItem] = newList.splice(currentIndex, 1);
        newList.splice(newTargetIndex, 0, movedItem);
        setTemp(newList.join('\n'));
        setDraggingIdx(newTargetIndex);
        dragRef.current.currentIndex = newTargetIndex;
        dragRef.current.list = newList;
    }

    const indexChange = dragRef.current.currentIndex - originalStartIndex;
    const visualOffset = totalDeltaY - (indexChange * itemHeight);
    setDragOffset(visualOffset);
  };

  const handleTouchEnd = () => {
    window.removeEventListener('touchmove', handleTouchMove);
    window.removeEventListener('touchend', handleTouchEnd);
    document.body.style.overflow = '';
    setIsDragging(false);
    setDraggingIdx(null);
    setDragOffset(0);
    handleSaveInternal(dragRef.current.list.join('\n'));
  };

  const toggleLine = (idx, e) => {
    e.stopPropagation();
    const lines = temp.split('\n');
    const displayLines = lines.filter(l => l.trim() !== "" && l.trim() !== "•");
    const targetContent = displayLines[idx];
    const originalIdx = lines.findIndex(l => l === targetContent);
    if(originalIdx === -1) return;
    if (lines[originalIdx].trim().startsWith('✔')) lines[originalIdx] = lines[originalIdx].replace('✔', '•');
    else lines[originalIdx] = lines[originalIdx].replace('•', '✔').replace(/^([^✔•])/, '✔ $1');
    const newVal = lines.join('\n');
    setTemp(newVal);
    onSave(dateStr, newVal);
  };

  const dateObj = new Date(dateStr);
  const dayName = DAYS[dateObj.getDay()];
  const displayLines = temp ? temp.split('\n').filter(l => l.trim() !== "" && l.trim() !== "•") : [];

  return (
    <div ref={cardRef} className={`mobile-card-item ${isActive ? 'active' : ''}`}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>
            {dateStr.split('-').slice(1).join('/')} ({dayName})
          </span>
          {holidayName && <span className="holiday-badge">{holidayName}</span>}
        </div>
        {!isViewMode && isActive && (
           <button onClick={(e)=>{ e.stopPropagation(); handleSaveInternal(); setIsViewMode(true); }} 
            style={{ border: 'none', background: 'transparent', color: '#10b981', cursor: 'pointer' }}>
            <Check size={24} />
          </button>
        )}
      </div>
      <div className="card-body">
        {isViewMode ? (
          <div className="mobile-view-area" onClick={handleSwitchToEdit}>
            {displayLines.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>터치하여 할 일 입력</div>
            ) : (
              displayLines.map((line, i) => {
                const isDone = line.trim().startsWith('✔');
                const isDraggingItem = isDragging && draggingIdx === i;
                return (
                  <div key={i} className={`task-line ${isDraggingItem ? 'dragging' : ''}`}
                       style={{ transform: isDraggingItem ? `translateY(${dragOffset}px)` : 'none' }}>
                    
                    {/* 왼쪽 핸들 */}
                    <div className="drag-handle" onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, i); }} 
                         onClick={e=>e.stopPropagation()} style={{display:'flex', opacity:1}}>
                       <GripVertical size={18} />
                    </div>
                    
                    <div className={`mobile-bullet ${isDone ? 'checked' : ''}`} onClick={(e) => toggleLine(i, e)}>
                      {isDone ? '✔' : '•'}
                    </div>
                    
                    {/* 링크 렌더러 사용 */}
                    <span className={`mobile-view-text ${isDone ? 'completed' : ''}`}>
                       <SmartTextRenderer text={line.replace(/^[✔•]\s*/, '')} onLinkClick={onLinkClick} />
                    </span>

                    {/* 오른쪽 핸들 */}
                    <div className="drag-handle" onTouchStart={(e) => { e.stopPropagation(); handleTouchStart(e, i); }} 
                         onClick={e=>e.stopPropagation()} style={{display:'flex', opacity:1, marginLeft:'auto'}}>
                       <GripVertical size={18} />
                    </div>

                  </div>
                );
              })
            )}
            <div style={{flex: 1, minHeight: '50px'}} />
          </div>
        ) : (
          <textarea ref={textareaRef} className="mobile-textarea" value={temp}
            onChange={(e) => setTemp(e.target.value)} onBlur={() => handleSaveInternal()}
            onKeyDown={handleKeyDown} placeholder="• 할 일을 입력하세요" />
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

function MonthView({ year, month, events, holidays, focusedDate, setFocusedDate, onNavigate, onMobileEdit, saveEvent, onHolidayClick, setRef, onLinkClick }) {
  const dates = generateCalendar(year, month);
  return (
    <div className="month-container" ref={setRef}>
      <div className="month-header-bar">{year}년 {month}월</div>
      <div className="month-grid">
        {DAYS.map((d, i) => <div key={d} className={`day-header ${i===0?'day-sun':i===6?'day-sat':''}`}>{d}</div>)}
        {dates.map((d, i) => {
          if(!d) return <div key={`empty-${i}`} className="date-cell" style={{background:'#fafafa'}}></div>;
          const dateStr = formatDate(year, month, d.getDate());
          return <DateCell 
            key={dateStr} 
            date={d} 
            dateStr={dateStr} 
            content={events[dateStr]||""} 
            holidayName={holidays[dateStr]} 
            isSun={d.getDay()===0} 
            isSat={d.getDay()===6} 
            focusedDate={focusedDate} 
            setFocusedDate={setFocusedDate} 
            onNavigate={onNavigate} 
            onMobileEdit={onMobileEdit}
            onSave={saveEvent} 
            onHolidayClick={onHolidayClick}
            onLinkClick={onLinkClick} // [추가]
          />;
        })}
      </div>
    </div>
  );
}

function DateCell({ date, dateStr, content, holidayName, isSun, isSat, focusedDate, setFocusedDate, onNavigate, onMobileEdit, onSave, onHolidayClick, onLinkClick }) {
  const [localContent, setLocalContent] = useState(content);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOffset, setDragOffset] = useState(0);
  
  const textareaRef = useRef(null);
  const isEditing = focusedDate === dateStr;
  const ignoreClickRef = useRef(false);
  
  const dragRef = useRef({ startY: 0, originalStartIndex: 0, currentIndex: 0, itemHeight: 0, list: [] });

  useEffect(() => {
    if (!isDragging && !isEditing) setLocalContent(content);
  }, [content, isDragging, isEditing]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleBlur = () => {
    setFocusedDate(null);
    const cleaned = cleanContent(localContent);
    if (cleaned !== content) onSave(dateStr, cleaned);
    setLocalContent(cleaned || "");
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      textareaRef.current.blur();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const val = localContent;
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const newVal = val.substring(0, start) + "\n• " + val.substring(end);
      setLocalContent(newVal);
      setTimeout(() => {
        if(textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 3;
      }, 0);
    } else if (e.key === 'Escape') {
      setLocalContent(content);
      setFocusedDate(null);
    }
  };

  const handleDragStart = (e, index) => {
    if (e.button !== 0 || window.innerWidth <= 850 || isEditing) return;
    e.stopPropagation();
    e.preventDefault();

    const currentLines = localContent.split('\n');
    if (currentLines.length <= 1) return;

    const targetRow = e.currentTarget.closest('.task-line');
    const rect = targetRow.getBoundingClientRect();

    setIsDragging(true);
    setDraggingIndex(index);
    
    dragRef.current = {
      startY: e.clientY,
      originalStartIndex: index,
      currentIndex: index,
      itemHeight: rect.height,
      list: [...currentLines]
    };
    
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (!dragRef.current) return;
    
    const totalDeltaY = e.clientY - dragRef.current.startY;
    const itemHeight = dragRef.current.itemHeight || 24;
    const moveSteps = Math.round(totalDeltaY / itemHeight);
    const newTargetIndex = dragRef.current.originalStartIndex + moveSteps;
    const list = dragRef.current.list;

    if (newTargetIndex >= 0 && newTargetIndex < list.length && newTargetIndex !== dragRef.current.currentIndex) {
        const newList = [...list];
        const [movedItem] = newList.splice(dragRef.current.currentIndex, 1);
        newList.splice(newTargetIndex, 0, movedItem);

        setLocalContent(newList.join('\n'));
        setDraggingIndex(newTargetIndex);
        dragRef.current.currentIndex = newTargetIndex;
        dragRef.current.list = newList;
    }

    const indexChange = dragRef.current.currentIndex - dragRef.current.originalStartIndex;
    const visualOffset = totalDeltaY - (indexChange * itemHeight);
    setDragOffset(visualOffset);
  };

  const handleDragEnd = () => {
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);
    setIsDragging(false);
    setDraggingIndex(null);
    setDragOffset(0);
    ignoreClickRef.current = true;
    setTimeout(() => { ignoreClickRef.current = false; }, 200);
    const finalText = dragRef.current.list.join('\n');
    if (finalText !== content) onSave(dateStr, finalText);
  };

  const handleCellClick = (e) => {
    if (window.innerWidth <= 850) {
      const rect = e.currentTarget.getBoundingClientRect();
      onMobileEdit(dateStr, rect);
      return;
    }
    if (!ignoreClickRef.current && !isEditing) { 
      let nextContent = localContent;
      if (!nextContent || nextContent.trim() === "") nextContent = "• ";
      else nextContent = nextContent.trimEnd() + "\n• ";
      setLocalContent(nextContent); 
      setFocusedDate(dateStr); 
    }
  };

  const handleLineClick = (e, index) => {
    if (window.innerWidth <= 850) return;
    e.stopPropagation();
    if (ignoreClickRef.current) return;
    if (!isEditing) setFocusedDate(dateStr);
  };

  const toggleLine = (idx, e) => {
    if (window.innerWidth <= 850) return;
    e.stopPropagation(); 
    if (ignoreClickRef.current) return;
    const lines = localContent.split('\n');
    if (lines[idx].trim().startsWith('✔')) lines[idx] = lines[idx].replace('✔', '•');
    else lines[idx] = lines[idx].replace('•', '✔').replace(/^([^✔•])/, '✔ $1');
    const newContent = lines.join('\n');
    setLocalContent(newContent);
    onSave(dateStr, newContent);
  };

  const lines = localContent ? localContent.split('\n') : [];
  const isAllDone = lines.length > 0 && lines.every(l => l.trim().startsWith('✔'));

  return (
    <div className={`date-cell ${isSun?'bg-sun':isSat?'bg-sat':''} ${holidayName?'bg-holiday':''}`} 
      onClick={handleCellClick} style={{ position: 'relative' }}>
      <div className="date-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className={`date-num ${isSun?'text-sun':isSat?'text-blue':''} ${holidayName?'text-sun':''}`} onClick={(e)=>{e.stopPropagation(); onHolidayClick(dateStr);}}>
            {date.getDate()}
          </span>
          {isAllDone && <Crown size={14} color="#f59e0b" fill="#f59e0b"/>}
        </div>
        {holidayName && <span className="holiday-badge" onClick={(e)=>{e.stopPropagation(); onHolidayClick(dateStr);}}>{holidayName}</span>}
      </div>

      {isEditing && (
        <button onMouseDown={(e) => e.preventDefault()} onClick={(e) => { e.stopPropagation(); handleBlur(); }} 
           style={{position:'absolute',top:5,right:5,border:'none',background:'transparent',cursor:'pointer',color:'#10b981'}}>
          <Check size={16} strokeWidth={3} />
        </button>
      )}

      <div className="task-content">
        {isEditing ? (
          <textarea ref={textareaRef} className="cell-input" 
            value={localContent} onChange={e=>setLocalContent(e.target.value)} 
            onBlur={handleBlur} onKeyDown={handleKeyDown}
          />
        ) : (
          <div className="task-wrapper">
            {lines.map((l, i) => {
              if (!l.trim()) return null; 
              const done = l.trim().startsWith('✔');
              const isDraggingItem = isDragging && draggingIndex === i;
              return (
                <div key={i} className={`task-line ${isDraggingItem ? 'dragging' : ''}`}
                  style={{ transform: isDraggingItem ? `translateY(${dragOffset}px)` : 'none' }}
                  onClick={(e) => handleLineClick(e, i)}
                >
                  <div className="drag-handle" onMouseDown={(e) => handleDragStart(e, i)} onClick={e=>e.stopPropagation()}><GripVertical size={14} /></div>
                  <span className={`bullet ${done?'checked':''}`} onClick={(e)=>toggleLine(i, e)} style={{cursor:'pointer'}}>{done?"✔":"•"}</span>
                  <span className={`task-text-truncated ${done?'completed-text':''}`}>
                    <SmartTextRenderer text={l.replace(/^[•✔]\s*/,'')} onLinkClick={onLinkClick} />
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


// [App.js] HolidayModal 컴포넌트 (최근 기록 삭제 기능 추가)
function HolidayModal({ data, onClose, onSave }) {
  const [name, setName] = useState(data.currentName);
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    const loaded = JSON.parse(localStorage.getItem("recentHolidays") || "[]");
    setRecent(loaded);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      // 중복 제거 및 최신순 정렬
      const newRecent = [name, ...recent.filter(r => r !== name)].slice(0, 5);
      localStorage.setItem("recentHolidays", JSON.stringify(newRecent));
    }
    onSave(data.date, name);
  };

  // [NEW] 최근 기록 삭제 함수
  const handleDeleteRecent = (e, targetName) => {
    e.stopPropagation(); // 태그 클릭(이름 입력) 방지
    const newRecent = recent.filter(r => r !== targetName);
    setRecent(newRecent);
    localStorage.setItem("recentHolidays", JSON.stringify(newRecent));
  };

  const deleteHoliday = () => {
    if(window.confirm("평일로 변경하시겠습니까?")) onSave(data.date, null);
  };

  return (
    <Modal onClose={onClose} title="휴일 설정">
      <form onSubmit={handleSubmit}>
        <div style={{marginBottom: 15, fontWeight:'bold', color:'#333'}}>{data.date}</div>
        <input 
          className="custom-select" style={{width:'100%', padding:'10px', marginBottom:'15px'}} 
          placeholder="휴일 이름" value={name} onChange={e => setName(e.target.value)} autoFocus
        />
        {recent.length > 0 && (
          <div style={{marginBottom: 20}}>
            <div style={{fontSize:'0.8rem', color:'#94a3b8', marginBottom:5}}>최근 입력:</div>
            <div style={{display:'flex', flexWrap:'wrap'}}>
              {recent.map((r, i) => (
                <div key={i} className="recent-tag" onClick={() => setName(r)}>
                  {r}
                  {/* 삭제 버튼 (X) */}
                  <span className="recent-delete-btn" onClick={(e) => handleDeleteRecent(e, r)}>✕</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:'flex', gap:10, justifyContent:'flex-end'}}>
          {data.currentName && <button type="button" className="btn-pill btn-danger" onClick={deleteHoliday}>삭제</button>}
          <button type="submit" className="btn-pill btn-purple">저장</button>
        </div>
      </form>
    </Modal>
  );
}

export default App;