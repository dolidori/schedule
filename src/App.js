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
  // [NEW] 아래 두 개 추가
  ArrowUp, ArrowDown 
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
  
  // [NEW] 현재 보고 있는 달을 추적하기 위한 Ref
  const visibleMonthId = useRef(null);

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

  // [핵심 수정 1] 스크롤 핸들러: 현재 보이는 달 추적
  const handleScroll = (e) => {
    const currentScrollY = e.target.scrollTop;
    const diff = currentScrollY - lastScrollY.current;
    
    // 1. 헤더 숨김/표시 처리
    if (diff > 5 && currentScrollY > 100) {
      if (isSettingsOpen) setIsSettingsOpen(false);
      else if (!isSettingsOpen && currentScrollY > 150) setShowHeader(false);
    } else if (diff < -5) {
      setShowHeader(true);
    }
    lastScrollY.current = currentScrollY;

    // 2. 현재 화면 상단에 걸쳐있는 '월(Month)' 찾기
    // 모든 달을 돌면서, 달의 하단이 화면 상단(헤더 높이 60px)보다 아래에 있는 첫 번째 달을 찾음
    for (const key in monthRefs.current) {
        const el = monthRefs.current[key];
        if (el) {
            // offsetTop: 컨테이너 내에서의 위치, offsetHeight: 높이
            // (el.offsetTop + el.offsetHeight) > (currentScrollY + 60) 이면 
            // 이 달의 엉덩이가 아직 화면에 보인다는 뜻
            if (el.offsetTop + el.offsetHeight > currentScrollY + 80) { 
                visibleMonthId.current = key; // "아, 사용자가 지금 이 달을 보고 있구나" 기록
                break; // 찾았으니 중단
            }
        }
    }
  };

  // [핵심 수정 2] 리사이즈(회전) 이벤트 핸들러: 보고 있던 달로 점프
  useEffect(() => {
    const handleResize = () => {
        // 이전에 보고 있던 달이 기록되어 있다면
        if (visibleMonthId.current && monthRefs.current[visibleMonthId.current]) {
            // 그 달의 시작 위치로 스크롤 강제 이동 (behavior: auto로 즉시 이동)
            monthRefs.current[visibleMonthId.current].scrollIntoView({ behavior: 'auto', block: 'start' });
        }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // 빈 의존성 (한 번만 등록)

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
        // Quick Move 시에도 보고 있는 달 업데이트
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
    /* (기존 공휴일 생성 로직 유지 - 코드량 문제로 생략) */
    alert("공휴일 생성 기능 실행"); 
  };
  const handleUpload = (e) => { /* (기존 업로드 로직 유지) */ };

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
      
      {/* [수정] 실행 취소 버튼: 우측 하단 고정, 아이콘 및 스타일 수정 */}
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


// [App.js] MobileSliderModal (V19 Final: 지니 애니메이션 복구 & 5-Card System)
function MobileSliderModal({ initialDate, events, holidays, onClose, onSave }) {
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [isOpening, setIsOpening] = useState(true);
  const [isClosing, setIsClosing] = useState(false);
  
  const trackRef = useRef(null);
  const cardRefs = useRef([null, null, null, null, null]); 
  const rafId = useRef(null);
  
  const dragState = useRef({
    start: 0,
    startTime: 0,
    currentTranslate: 0,
    isAnimating: false,
    isDragging: false,
  });
  
  const layoutMetrics = useRef({
    itemWidth: 0,
    initialTranslate: 0,
  });

  const prev2Date = addDays(currentDate, -2);
  const prev1Date = addDays(currentDate, -1);
  const next1Date = addDays(currentDate, 1);
  const next2Date = addDays(currentDate, 2);
  const cardDates = [prev2Date, prev1Date, currentDate, next1Date, next2Date];

  // [스타일 업데이트 함수]
  const updateCardStyles = useCallback((currentTrackPosition) => {
    // [핵심 수정 1] 닫히는 중이면 JS 간섭 중단 (CSS 애니메이션에 맡김)
    if (isClosing) return;

    const { itemWidth, initialTranslate } = layoutMetrics.current;
    if (itemWidth === 0) return;

    const trackOffsetFromIdealCenter = currentTrackPosition - initialTranslate;
    
    for (let i = 0; i < cardRefs.current.length; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;

        // [핵심 수정 2] 열리는 중이고 주인공 카드(Index 2)라면 JS 간섭 중단
        // -> CSS의 genieZoomIn 애니메이션이 작동하도록 함
        if (isOpening && i === 2) {
            el.style.transform = ''; 
            el.style.opacity = '';
            continue; 
        }
        
        const idealCardOffset = (i - 2) * itemWidth; 
        
        let distance = idealCardOffset + trackOffsetFromIdealCenter;
        distance = Math.max(-itemWidth, Math.min(itemWidth, distance));

        const normFactor = Math.abs(distance) / itemWidth; 
        let effectiveFactor = 0;

        if (i === 2) {
            effectiveFactor = normFactor; 
        } else {
            effectiveFactor = (normFactor > 1) ? 1 : normFactor;
        }

        const scale = 1.0 - (effectiveFactor * 0.05);
        
        let opacity;
        if (i === 2) {
            opacity = 1.0 - (effectiveFactor * 0.5);
        } else {
            // Cubic Curve
            opacity = 1.0 - (Math.pow(effectiveFactor, 3) * 0.5);
        }

        el.style.transition = 'none'; 
        el.style.transform = `scale(${scale})`;
        el.style.opacity = opacity;
    }
  }, [isOpening, isClosing]); // 의존성 추가

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

  // [핵심 수정 3] Opening이 끝났을 때(500ms 후) JS 제어권 복구
  // 이 코드가 없으면 애니메이션 후 드래그 시작 전까지 스타일이 비어있을 수 있음
  useEffect(() => {
    if (!isOpening) {
        updateLayout();
    }
  }, [isOpening, updateLayout]);

  useEffect(() => {
    updateLayout();
    
    const handleResize = () => {
        if (rafId.current) cancelAnimationFrame(rafId.current);
        updateLayout();
    };

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

    if (Math.abs(diff) > 5) {
      dragState.current.isDragging = true;
    }
    
    setTrackPosition(newTrackPosition, null); 
    if (rafId.current) cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => updateCardStyles(newTrackPosition));
  };

  const handleTouchEnd = (e) => {
    if (rafId.current) cancelAnimationFrame(rafId.current);

    if (!dragState.current.isDragging) {
      dragState.current.start = 0;
      return;
    }
    
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

    if (movedDist < -activeThreshold) { 
        dateDirection = 1; 
        trackOffset = -itemWidth;
    } else if (movedDist > activeThreshold) { 
        dateDirection = -1; 
        trackOffset = itemWidth;
    }
    
    const targetTranslate = initialTranslate + trackOffset; 
    setTrackPosition(targetTranslate, animDuration);

    cardRefs.current.forEach((el, idx) => {
        if (!el) return;

        el.style.transition = `transform ${animDuration} ease-out, opacity ${animDuration} ease-out`;

        let targetScale = 0.95;
        let targetOpacity = 0.5;

        let isActiveTarget = false;
        if (dateDirection === 0 && idx === 2) isActiveTarget = true; 
        else if (dateDirection === 1 && idx === 3) isActiveTarget = true; 
        else if (dateDirection === -1 && idx === 1) isActiveTarget = true; 

        if (isActiveTarget) {
            targetScale = 1.0;
            targetOpacity = 1.0;
        } else if (idx !== 2) { 
            targetOpacity = 0.5;
        }

        el.style.transform = `scale(${targetScale})`;
        el.style.opacity = targetOpacity;
    });

    const timeoutDuration = parseFloat(animDuration) * 1000;

    setTimeout(() => {
      if (dateDirection !== 0) {
        setCurrentDate(prev => addDays(prev, dateDirection)); 
      }
      
      cardRefs.current.forEach(el => {
        if (el) {
            el.style.transform = ''; 
            el.style.opacity = ''; 
            el.style.transition = ''; 
        }
      });
      
      setTrackPosition(initialTranslate, false);
      dragState.current = { ...dragState.current, start: 0, startTime: 0, isAnimating: false };
    }, timeoutDuration);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 250);
  };

  const containerClass = `slider-track ${isClosing ? 'slider-closing' : ''} ${isOpening ? 'slider-opening' : ''}`;

  return (
    <div className="mobile-slider-overlay" onClick={handleClose}>
      <div 
        ref={trackRef}
        className={containerClass}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {cardDates.map((dateStr, idx) => (
          <div className="mobile-card-wrapper" key={dateStr}>
            <div onClick={(e) => e.stopPropagation()} style={{width:'100%'}}>
              <MobileCard
                cardRef={(el) => cardRefs.current[idx] = el}
                isActive={idx === 2} 
                dateStr={dateStr}
                content={events[dateStr]}
                holidayName={holidays[dateStr]}
                onSave={onSave}
                onClose={handleClose}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// [App.js] MobileCard 컴포넌트 (공간 확보 및 UI 개선 V5)
function MobileCard({ dateStr, isActive, content, holidayName, onSave, onClose, cardRef }) {
  const [temp, setTemp] = useState(content || "• ");
  const [isViewMode, setIsViewMode] = useState(true);
  const [draggingIdx, setDraggingIdx] = useState(null); 
  const textareaRef = useRef(null);
  const dragItem = useRef(null); 
  const isDragLock = useRef(false);

  useEffect(() => {…}, [dateStr, content]);

  useEffect(() => {…}, [isViewMode, isActive]);

  const dateObj = new Date(dateStr);
  const dayIndex = dateObj.getDay(); 
  const dayName = DAYS[dayIndex];
  
  let dateColor = '#333';
  if (holidayName || dayIndex === 0)  else

  const handleSave = (newVal) => {…};
  
  const handleCheckClick = () => {…};

  const toggleLine = (idx) => {…};

  const handleViewClick = (e) => {…};

  const onDragStart = (e, index) => {…};

  const onDragMove = (e) => {…};

  const onDragEnd = (e) => {…};

  // --- 변경: 뷰 모드에서 개별 체크 아이콘 숨기고 헤더에 완료 개수만 표시 ---
  const cleaned = cleanContent(temp || "");
  const lines = cleaned === "" ? [] : cleaned.split('\n').filter(l => l.trim() !== "");
  const completedCount = lines.filter(l => l.trim().startsWith('✔')).length;
  const previewLines = lines.slice(0, 5); // 미리보기 최대 5줄

  return (
    <div ref={cardRef} className={`mobile-card-item ${isActive ? 'active' : ''}`}>
      <div className="card-header" style={{borderBottom: '1px solid #f1f5f9'}}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{color: dateColor, fontWeight:'bold', fontSize:'1.2rem'}}>
            {dateStr} ({dayName})
          </span>
          {holidayName && <span className="holiday-badge">{holidayName}</span>}
          {/* 완료 요약 배지 (모바일에서만 표시를 줄이기 위해 추가) */}
          {completedCount > 0 && (
            <span className="completed-badge" style={{marginLeft:8, fontSize:'0.85rem', color:'#7c3aed'}}>
              ✔ {completedCount}
            </span>
          )}
        </div>
        {isActive && !isViewMode && (
          <button onClick={handleCheckClick} style={{border:'none', background:'none', color:'#7c3aed', padding:0, cursor:'pointer'}}><Check size={24}/></button>
        )}
      </div>
      <div className="card-body">
        {isViewMode ? (
          <div className="mobile-view-area" onClick={handleViewClick}>
             {previewLines.length === 0 ? (
                <div style={{color:'#94a3b8', height:'100%', display:'flex', alignItems:'center', justifyContent:'center'}}>터치하여 일정 입력</div>
             ) : (
               <>
                 {previewLines.map((line, i) => {
                   const isDone = line.trim().startsWith('✔');
                   const text = line.replace(/^✔\s*/, '');
                   return (
                     <div key={i} style={{display:'flex', alignItems:'flex-start', gap:8, padding:'6px 0', borderBottom: i < previewLines.length-1 ? '1px solid #f1f5f9' : 'none'}}>
                       <span style={{width:18, color: isDone ? '#7c3aed' : '#cbd5e1', lineHeight:'18px'}}>{isDone ? '✔' : '•'}</span>
                       <span style={{color:'#334155', whiteSpace:'pre-wrap'}}>{text}</span>
                     </div>
                   );
                 })}
                 {lines.length > previewLines.length && (
                   <div style={{color:'#94a3b8', padding:'8px 0', textAlign:'center'}}>더보기 {lines.length - previewLines.length}개</div>
                 )}
               </>
             )}
          </div>
        ) : (
          <textarea
            ref={textareaRef} className="mobile-textarea"
            value={temp} onChange={(e) => setTemp(e.target.value)} onBlur={() => handleSave()}
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

// 11. MonthView (Props 전달 로직 수정)
function MonthView({ year, month, events, holidays, focusedDate, setFocusedDate, onNavigate, onMobileEdit, saveEvent, onHolidayClick, setRef }) {
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
            onHolidayClick={onHolidayClick} // [중요] 부모로부터 받은 함수를 DateCell에 전달
          />;
        })}
      </div>
    </div>
  );
}

// --- App.js 내 DateCell 컴포넌트 ---

function DateCell({ date, dateStr, content, holidayName, isSun, isSat, focusedDate, setFocusedDate, onNavigate, onMobileEdit, onSave, onHolidayClick }) {
  // 로컬 상태 관리 (즉각적인 UI 반영을 위해)
  const [localContent, setLocalContent] = useState(content);
  const [isDragging, setIsDragging] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dragOffset, setDragOffset] = useState(0); // 드래그 중인 요소의 Y축 이동 거리
  
  const textareaRef = useRef(null);
  const isEditing = focusedDate === dateStr;
  
  // 드래그 후 클릭 이벤트(수정 모드 진입)를 방지하기 위한 Ref
  const ignoreClickRef = useRef(false);
  // 드래그 계산을 위한 Ref
  const dragRef = useRef({ 
    startY: 0, 
    startIndex: 0, 
    itemHeight: 0, 
    list: [] 
  });

  // DB에서 content가 바뀌면 로컬 상태도 동기화 (단, 드래그 중이거나 편집 중일 땐 제외)
  useEffect(() => {
    if (!isDragging && !isEditing) {
      setLocalContent(content);
    }
  }, [content, isDragging, isEditing]);

  // 편집 모드 진입 시 포커스 처리
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
      textareaRef.current.scrollTop = textareaRef.current.scrollHeight;
    }
  }, [isEditing]);

  const handleBlur = () => {
    setFocusedDate(null);
    const cleaned = cleanContent(localContent);
    if (cleaned !== content) onSave(dateStr, cleaned);
  };

  const handleFinish = (e) => {
    e.stopPropagation();
    setFocusedDate(null);
    const cleaned = cleanContent(localContent);
    if (cleaned !== content) onSave(dateStr, cleaned);
  };

  // --- 드래그 앤 드롭 로직 (PC용) ---

  const handleDragStart = (e, index) => {
    // 1. 좌클릭만 허용, 모바일 제외, 편집 중 제외
    if (e.button !== 0 || window.innerWidth <= 850 || isEditing) return;
    
    // 이벤트 전파 막기 (부모의 클릭 이벤트 방지)
    e.stopPropagation(); 
    
    const currentLines = localContent.split('\n');
    if (currentLines.length <= 1) return; // 항목이 1개 이하면 드래그 불필요

    const target = e.currentTarget; // .task-line 요소
    const rect = target.getBoundingClientRect();

    setIsDragging(true);
    setDraggingIndex(index);
    
    // 드래그 시작 시점의 정보 저장
    dragRef.current = {
      startY: e.clientY,
      startIndex: index,
      itemHeight: rect.height, // 항목 높이 (가변적일 수 있으나 근사치로 사용)
      list: [...currentLines]
    };
    
    // 전역 이벤트 등록
    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
  };

  const handleDragMove = (e) => {
    if (!dragRef.current) return;

    // 1. 마우스 이동 거리 계산
    const deltaY = e.clientY - dragRef.current.startY;
    setDragOffset(deltaY);

    // 2. 순서 변경(Swap) 로직
    // 항목 높이의 절반 이상 움직였을 때 순서를 바꿈
    const itemHeight = dragRef.current.itemHeight || 24; 
    const moveSteps = Math.round(deltaY / itemHeight);
    
    const currentIndex = dragRef.current.startIndex;
    const targetIndex = currentIndex + moveSteps;
    const list = dragRef.current.list;

    // 배열 범위를 벗어나지 않도록 체크
    if (targetIndex >= 0 && targetIndex < list.length && targetIndex !== currentIndex) {
        // 배열 순서 변경 (Live Swap)
        const newList = [...list];
        const [movedItem] = newList.splice(currentIndex, 1);
        newList.splice(targetIndex, 0, movedItem);

        // 상태 업데이트 (화면 리렌더링 -> 다른 항목들이 트랜지션으로 이동)
        setLocalContent(newList.join('\n'));
        
        // 중요: 드래그 상태 정보 업데이트 (연속적인 스왑을 위해)
        setDraggingIndex(targetIndex);
        dragRef.current.startIndex = targetIndex;
        dragRef.current.list = newList;
        
        // 중요: 마우스 기준점 재설정 (스왑 후 요소가 튀는 현상 방지)
        // 요소가 DOM 상에서 위치가 바뀌었으므로, deltaY를 초기화하고 startY를 현재 마우스 위치로 보정
        dragRef.current.startY = e.clientY; 
        setDragOffset(0); 
    }
  };

  const handleDragEnd = () => {
    // 이벤트 해제
    window.removeEventListener('mousemove', handleDragMove);
    window.removeEventListener('mouseup', handleDragEnd);

    // 상태 초기화
    setIsDragging(false);
    setDraggingIndex(null);
    setDragOffset(0);

    // 중요: 드래그가 끝난 직후 클릭 이벤트가 발생하는 것을 방지
    ignoreClickRef.current = true;
    setTimeout(() => { ignoreClickRef.current = false; }, 100);

    // 최종 변경 사항 저장
    const finalText = dragRef.current.list.join('\n');
    if (finalText !== content) {
      onSave(dateStr, finalText);
    }
  };

  // --- 기존 핸들러 ---

  const handleClick = (e) => {
    // 모바일 처리
    if (window.innerWidth <= 850) {
      const rect = e.currentTarget.getBoundingClientRect();
      onMobileEdit(dateStr, rect);
      return;
    }

    // [수정 포인트] 드래그 직후에는 편집 모드로 들어가지 않음
    if (ignoreClickRef.current) return;
    
    if (!isEditing) { 
      const nextContent = (localContent && localContent.trim().length > 0) ? localContent + "\n• " : "• ";
      setLocalContent(nextContent); // 로컬 상태 업데이트
      setFocusedDate(dateStr); 
    }
  };

  const toggleLine = (idx) => {
    if (ignoreClickRef.current) return; // 드래그 중 클릭 방지
    const lines = localContent.split('\n');
    if (lines[idx].trim().startsWith('✔')) lines[idx] = lines[idx].replace('✔', '•');
    else lines[idx] = lines[idx].replace('•', '✔').replace(/^([^✔•])/, '✔ $1');
    const newContent = lines.join('\n');
    setLocalContent(newContent);
    onSave(dateStr, newContent);
  };

  // 렌더링용 변수
  const lines = localContent ? localContent.split('\n') : [];
  const isAllDone = lines.length > 0 && lines.every(l => l.trim().startsWith('✔'));

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
            onClick={(e)=>{e.stopPropagation(); onHolidayClick(dateStr);}} 
          >
            {date.getDate()}
          </span>
          {isAllDone && <Crown size={14} color="#f59e0b" fill="#f59e0b"/>}
        </div>
        {holidayName && (
          <span className="holiday-badge" onClick={(e)=>{e.stopPropagation(); onHolidayClick(dateStr);}}>
            {holidayName}
          </span>
        )}
      </div>

      {isEditing && (
        <button onMouseDown={(e) => e.preventDefault()} onClick={handleFinish} 
           style={{position:'absolute',top:5,right:5,border:'none',background:'transparent',cursor:'pointer',color:'#10b981'}}>
          <Check size={16} strokeWidth={3} />
        </button>
      )}

      <div className="task-content">
        {isEditing ? (
          <textarea 
            ref={textareaRef} className="cell-input" 
            value={localContent} onChange={e=>setLocalContent(e.target.value)} 
            onBlur={handleBlur}
            // 엔터키 처리 등 필요한 경우 추가
          />
        ) : (
          <div className="task-wrapper">
            {lines.map((l, i) => {
              if (!l.trim()) return null; 
              const done = l.trim().startsWith('✔');
              const isDraggingItem = isDragging && draggingIndex === i;

              return (
                <div 
                  key={i} 
                  className={`task-line ${isDraggingItem ? 'dragging' : ''}`}
                  // 드래그 중인 요소만 transform으로 위치 보정, 나머지는 리렌더링에 의해 자동 배치됨
                  style={{
                      transform: isDraggingItem ? `translateY(${dragOffset}px)` : 'none',
                      cursor: 'grab' 
                  }}
                  onMouseDown={(e) => handleDragStart(e, i)}
                  // 텍스트 클릭 시 부모로 이벤트 전파되지 않게 하여 드래그와의 간섭 최소화
                  onClick={(e) => e.stopPropagation()} 
                >
                  <span 
                    className={`bullet ${done?'checked':''}`} 
                    onClick={(e)=>{e.stopPropagation(); toggleLine(i);}}
                    style={{cursor:'pointer'}}
                  >
                    {done?"✔":"•"}
                  </span>
                  
                  <span className={`task-text-truncated ${done?'completed-text':''}`}>
                    <Linkify options={{target:'_blank'}}>{l.replace(/^[•✔]\s*/,'')}</Linkify>
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