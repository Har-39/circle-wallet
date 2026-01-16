import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    signInAnonymously, 
    onAuthStateChanged,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithCredential, 
    linkWithPopup,
    signOut,
    updateProfile,
    type User
} from 'firebase/auth';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    query, 
    orderBy, 
    onSnapshot, 
    updateDoc, 
    doc, 
    deleteDoc,
    serverTimestamp,
    setDoc,
    getDoc,
    writeBatch,
    getDocs,
    where
} from 'firebase/firestore';

import { 
    Wallet, Plus, Users, ChevronRight, ArrowLeft, Calendar, Lock, 
    Share2, Banknote, Utensils, Train, BedDouble, 
    ShoppingBag, HelpCircle, AlertTriangle, Check, Loader2, Info, 
    ChevronDown, ChevronUp, Image as ImageIcon, 
    LogIn, PlusCircle, LogOut, ShieldCheck, UserCircle, 
    History as HistoryIcon, Pencil, X, ExternalLink, Home,
    ClipboardList, AlertCircle, Trash2, RotateCcw, Camera, Calculator, Edit3, XCircle
} from 'lucide-react';

const firebaseConfig = {
    apiKey: "AIzaSyA6QCDjKaWy6ahnZU4BYv5PC43Lqbexl4g",
    authDomain: "circle-wallet-d0396.firebaseapp.com",
    projectId: "circle-wallet-d0396",
    storageBucket: "circle-wallet-d0396.firebasestorage.app",
    messagingSenderId: "403435940288",
    appId: "1:403435940288:web:d4a217b247f300fb554025",
    measurementId: "G-7XBYPCYSGK"
};

const currentAppId = 'my-circle-wallet-v1';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'ja'; 
const db = getFirestore(app);

const PATHS = {
    circles: () => ['circles'],
    circle: (cid: string) => ['circles', cid],
    members: (cid: string) => ['circles', cid, 'members'],
    member: (cid: string, uid: string) => ['circles', cid, 'members', uid],
    events: (cid: string) => ['circles', cid, 'events'],
    event: (cid: string, eid: string) => ['circles', cid, 'events', eid],
    transactions: (cid: string, eid: string) => ['circles', cid, 'events', eid, 'transactions'],
    transaction: (cid: string, eid: string, tid: string) => ['circles', cid, 'events', eid, 'transactions', tid],
    participants: (cid: string, eid: string) => ['circles', cid, 'events', eid, 'participants'],
    participant: (cid: string, eid: string, uid: string) => ['circles', cid, 'events', eid, 'participants', uid],
    userJoinedCircles: (uid: string) => ['users', uid, 'joined_circles'],
    userJoinedCircle: (uid: string, cid: string) => ['users', uid, 'joined_circles', cid]
};

const getCol = (pathSegments: string[]) => collection(db, 'artifacts', currentAppId, 'public', 'data', ...pathSegments);
const getDocRef = (pathSegments: string[]) => doc(db, 'artifacts', currentAppId, 'public', 'data', ...pathSegments);

const CATEGORIES: { [key: string]: { label: string; color: string; icon: any } } = {
    food: { label: '食費', color: '#F87171', icon: Utensils },
    transport: { label: '交通費', color: '#60A5FA', icon: Train },
    stay: { label: '宿泊費', color: '#818CF8', icon: BedDouble },
    goods: { label: '備品', color: '#34D399', icon: ShoppingBag },
    other: { label: 'その他', color: '#9CA3AF', icon: HelpCircle },
};

const safeFormatDate = (timestamp: any) => {
    try {
        if (timestamp && typeof timestamp.toDate === 'function') {
            return new Date(timestamp.toDate()).toLocaleDateString();
        }
        return '';
    } catch (e) { return ''; }
};

const HISTORY_KEY = 'cw_circle_history';
// ローカルストレージに保存
const saveCircleHistory = (id: string, name: string) => {
    try {
        let current = [];
        try {
            const stored = localStorage.getItem(HISTORY_KEY);
            current = stored ? JSON.parse(stored) : [];
            if (!Array.isArray(current)) current = [];
        } catch { current = []; }

        const next = [{ id, name, lastAccess: Date.now() }, ...current.filter((c: any) => c.id !== id)].slice(0, 10);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch (e) { console.error("History save error", e); }
};
// ローカルストレージから取得
const getCircleHistory = () => {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        const parsed = stored ? JSON.parse(stored) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) { return []; }
};

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
    constructor(props: any) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: any) {
        return { hasError: true, error };
    }
    componentDidCatch(error: any, errorInfo: any) {
        console.error("Uncaught error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div className="p-6 bg-red-50 text-red-900 min-h-screen flex flex-col items-center justify-center text-center">
                    <h1 className="text-xl font-bold mb-4">エラーが発生しました</h1>
                    <div className="bg-white p-4 rounded border border-red-200 text-left overflow-auto max-w-full text-xs font-mono mb-4 w-full">
                        {this.state.error?.toString()}
                    </div>
                    <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold shadow-sm">リセットして再読込</button>
                </div>
            );
        }
        return this.props.children;
    }
}

// DebugResetButton Definition
const DebugResetButton = () => {
    const handleLocalReset = async () => {
        if (window.confirm("【デバッグ】ログアウトして初期画面（オンボーディング）に戻りますか？\n※ローカルのログイン情報のみ削除されます")) {
            await auth.signOut();
            window.localStorage.removeItem('cw_guest_id');
            window.localStorage.removeItem('cw_admin_session');
            window.localStorage.removeItem('cw_joined_circle_id');
            window.localStorage.removeItem('cw_guest_name');
            window.location.reload(); 
        }
    };

    const handleDbReset = async () => {
        if (window.confirm("【危険】サークル設定(ID/PASS)を削除しますか？\n\nこれにより新しいサークルを作成できるようになります。\n※イベントデータ自体は残りますが、管理画面からは見えなくなります。")) {
            try {
                await deleteDoc(doc(db, 'artifacts', currentAppId, 'public', 'data', 'circle_settings', 'info'));
                alert("サークル設定を削除しました。リロードします。");
                window.location.reload();
            } catch (e: any) {
                alert("削除に失敗しました: " + e.message);
            }
        }
    };

    return (
        <div className="fixed top-20 right-4 z-[9999] flex flex-col gap-2 items-end">
            <button 
                type="button"
                onClick={handleLocalReset}
                className="bg-gray-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
                <RotateCcw size={12} /> Local Reset
            </button>
            <button 
                type="button"
                onClick={handleDbReset}
                className="bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full shadow-lg opacity-80 hover:opacity-100 transition-opacity flex items-center gap-1"
            >
                <Trash2 size={12} /> Delete Circle
            </button>
        </div>
    );
};

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error' | 'info', onClose: () => void }) => {
    useEffect(() => { const timer = setTimeout(onClose, 5000); return () => clearTimeout(timer); }, [onClose]);
    const bgColors = { success: 'bg-green-600', error: 'bg-red-500', info: 'bg-gray-800' };
    return (
        <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[10000] flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-in slide-in-from-bottom-4 fade-in duration-300 ${bgColors[type]} w-[90%] max-w-md border-2 border-white/20`}>
            {type === 'success' && <Check size={24} />} {type === 'error' && <AlertTriangle size={24} />} {type === 'info' && <Info size={24} />}
            <span className="text-base">{message}</span>
        </div>
    );
};

const LoadingScreen = ({ message = "読み込み中..." }) => (
    <div className="flex items-center justify-center h-screen bg-slate-50 flex-col gap-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-gray-500 font-bold">{message}</p>
    </div>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, isProcessing }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-[6000] flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl transform transition-all scale-100 border border-gray-100">
                <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
                <div className="text-sm text-gray-600 mb-6 whitespace-pre-wrap leading-relaxed">{message}</div>
                <div className="flex gap-3">
                    <button type="button" onClick={onCancel} disabled={isProcessing} className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 disabled:opacity-50 active:scale-95 transition-transform">キャンセル</button>
                    <button type="button" onClick={onConfirm} disabled={isProcessing} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 disabled:opacity-50 flex justify-center items-center gap-2 active:scale-95 transition-transform">
                        {isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : '実行する'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// 精算用のモーダル
const SettlementModal = ({ isOpen, event, settlementData, onConfirm, onCancel, isProcessing }: any) => {
    const [settlementMode, setSettlementMode] = useState<'distribute' | 'carryover'>('distribute');

    if (!isOpen) return null;
    const { totalIncome, totalExpense, surplus, perPersonSurplus, list } = settlementData;

    return (
        <div className="fixed inset-0 bg-black/80 z-[6000] flex items-center justify-center p-4 animate-in fade-in duration-200 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 bg-indigo-600 text-white">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Calculator size={20}/> 会計の終了・精算</h3>
                    <div className="text-xs opacity-80 mt-1">{event.title}</div>
                </div>
                
                <div className="p-5 overflow-y-auto">
                    <div className="bg-gray-50 p-4 rounded-xl mb-4 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-gray-500">集まった会費</span> <span className="font-bold">¥{totalIncome.toLocaleString()}</span></div>
                        <div className="flex justify-between text-sm"><span className="text-gray-500">かかった経費</span> <span className="font-bold text-red-500">-¥{totalExpense.toLocaleString()}</span></div>
                        <div className="border-t border-gray-200 my-2 pt-2 flex justify-between font-bold">
                            <span>{surplus >= 0 ? '余剰金 (黒字)' : '不足金 (赤字)'}</span> <span className={surplus >= 0 ? "text-green-600" : "text-red-500"}>¥{surplus.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* 余剰金・不足金の扱い選択エリア */}
                    <div className="mb-6">
                        <p className="text-xs font-bold text-gray-500 mb-2">
                            {surplus >= 0 ? '余剰金の扱い' : '不足分の扱い'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setSettlementMode('distribute')}
                                className={`p-3 rounded-lg border text-xs font-bold transition-all ${settlementMode === 'distribute' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                {surplus >= 0 ? (
                                    <>全員に分配<br/>(キャッシュバック)</>
                                ) : (
                                    <>全員から徴収<br/>(追加支払い)</>
                                )}
                            </button>
                            <button 
                                onClick={() => setSettlementMode('carryover')}
                                className={`p-3 rounded-lg border text-xs font-bold transition-all ${settlementMode === 'carryover' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            >
                                {surplus >= 0 ? (
                                    <>サークル費に繰越<br/>(貯金する)</>
                                ) : (
                                    <>サークル費から補填<br/>(残高から引く)</>
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 text-right">
                            {settlementMode === 'distribute' ? (
                                surplus >= 0 
                                    ? `1人あたり ¥${perPersonSurplus.toLocaleString()} 返金されます`
                                    : `1人あたり ¥${Math.abs(perPersonSurplus).toLocaleString()} 追加で集めます`
                            ) : (
                                surplus >= 0
                                    ? `サークル残高に ¥${surplus.toLocaleString()} 追加されます`
                                    : `サークル残高から ¥${Math.abs(surplus).toLocaleString()} 支払われます`
                            )}
                        </p>
                    </div>

                    <h4 className="text-sm font-bold text-gray-700 mb-3 ml-1">精算リスト（誰にいくら渡すか）</h4>
                    <div className="space-y-2 mb-4">
                        {list.map((item: any, idx: number) => {
                            // モードによって表示額を変える
                            // distributeモード: 立替返金 + 分配金
                            // carryoverモード : 立替返金のみ (分配金は0扱い)
                            const displayDistribution = settlementMode === 'distribute' ? item.distribution : 0;
                            const displayTotal = item.reimbursement + displayDistribution;

                            return (
                                <div key={idx} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg bg-white shadow-sm">
                                    <div>
                                        <div className="font-bold text-gray-800 text-sm">{item.name}</div>
                                        <div className="text-[10px] text-gray-400">
                                            立替返金: ¥{item.reimbursement.toLocaleString()}
                                            {settlementMode === 'distribute' && item.distribution !== 0 && ` / ${surplus >= 0 ? '分配' : '徴収'}: ¥${item.distribution.toLocaleString()}`}
                                        </div>
                                    </div>
                                    <div className={`text-lg font-bold ${displayTotal >= 0 ? 'text-indigo-600' : 'text-red-500'}`}>
                                        {displayTotal >= 0 ? '' : '徴収 '}¥{Math.abs(displayTotal).toLocaleString()}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-800 mb-4 flex gap-2">
                        <Info size={16} className="flex-shrink-0"/>
                        <span>
                            「確定して終了」を押すとイベントが終了します。
                            {settlementMode === 'distribute' 
                                ? (surplus >= 0 ? '残高は分配されるため、サークル費には追加されません。' : '不足分は参加者が負担するため、サークル費からは引かれません。')
                                : (surplus >= 0 ? '残高はサークル費（一般会計）に追加されます。' : '不足分はサークル費（一般会計）から支払われます。')}
                        </span>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                    <button onClick={onCancel} disabled={isProcessing} className="flex-1 py-3 bg-white text-gray-600 border border-gray-200 rounded-xl font-bold hover:bg-gray-100 active:scale-95 transition-transform">閉じる</button>
                    <button onClick={() => onConfirm(settlementMode)} disabled={isProcessing} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg active:scale-95 transition-transform flex justify-center items-center gap-2">
                        {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : '確定して終了'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const EventAlbumRow = ({ event, onClick }: any) => {
    const dateStr = safeFormatDate(event.createdAt);
    const hasPassword = event.password && event.password.length > 0;

    return (
        <div onClick={onClick} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform relative">
             {hasPassword && (
                <div className="absolute top-2 right-2 text-indigo-500 bg-indigo-50 p-1.5 rounded-full border border-indigo-100">
                    <Lock size={12} />
                </div>
            )}
            <div className="relative w-36 h-24 flex-shrink-0 rounded-xl overflow-hidden shadow-md bg-gray-100">
                {event.coverImageUrl ? <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white"><ImageIcon size={24} className="opacity-80" /></div>}
                {event.id === 'general' && <div className="absolute inset-0 bg-black/30 flex items-center justify-center font-bold text-white text-xs">サークル費</div>}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center h-24 py-1">
                <h3 className={`font-bold text-lg truncate mb-2 leading-tight ${event.status === 'closed' ? 'text-gray-400' : 'text-gray-800'}`}>{event.title}</h3>
                <div className="mt-auto space-y-1">
                    {event.id !== 'general' && <p className="text-sm text-gray-600 font-bold flex items-center gap-1"><span className="text-xs font-normal text-gray-400">会費</span>¥{event.feePerPerson.toLocaleString()}</p>}
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 font-medium"><Calendar size={12} /><span>{dateStr}</span></div>
                </div>
            </div>
            <ChevronRight className="text-gray-200" size={24} />
        </div>
    );
};

// --- Helpers ---
const resizeImage = (file: File, maxWidth: number, quality: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } else {
                    reject(new Error("Canvas context is null"));
                }
            };
            img.onerror = (error) => reject(error);
        };
        reader.onerror = (error) => reject(error);
    });
};

const OnboardingScreen = ({ onCreate, onJoin, isProcessing, onGoogleLogin, user }: any) => {
    const [mode, setMode] = useState('selection');
    const [inputCircleId, setInputCircleId] = useState('');
    const [inputName, setInputName] = useState(user?.displayName || '');
    const [myCircles, setMyCircles] = useState<any[]>([]); 

    useEffect(() => {
        const localHistory = getCircleHistory();
        if (!user) {
            setMyCircles(localHistory);
            return;
        }
        const q = query(getCol(PATHS.userJoinedCircles(user.uid)), orderBy('joinedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const cloudHistory = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const cloudIds = new Set(cloudHistory.map(c => c.id));
            const uniqueLocal = localHistory.filter((l: any) => !cloudIds.has(l.id));
            setMyCircles([...cloudHistory, ...uniqueLocal]);
        });
        return () => unsubscribe();
    }, [user]);
    
    const isAnonymous = !user || user.isAnonymous;
    const isLoggedIn = !!user;

    const handleJoinSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputCircleId.trim()) return;
        await onJoin(inputCircleId, inputName);
    };

    const GoogleLoginButton = () => {
        return (
            <button 
                onClick={onGoogleLogin} 
                className={`absolute top-4 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold shadow-md transition-all active:scale-95 ${isAnonymous ? 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50' : 'bg-white text-indigo-600 border border-indigo-100'}`}
            >
                {isAnonymous ? (
                    <>
                        <svg className="w-4 h-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                        {isLoggedIn ? '連携・ログイン' : 'Googleでログイン'}
                    </>
                ) : (
                    <>
                        <ShieldCheck size={14} className="text-green-500"/>
                        {user.displayName || '連携済み'}
                        <span className="ml-1 text-[10px] text-red-400 underline" onClick={(e) => { e.stopPropagation(); auth.signOut(); }}>ログアウト</span>
                    </>
                )}
            </button>
        );
    };

    if (mode === 'join') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative">
                <GoogleLoginButton />
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-xl p-8 animate-in slide-in-from-right-4 duration-300">
                    <button onClick={() => setMode('selection')} className="mb-6 flex items-center text-gray-400 hover:text-gray-600 transition-colors"><ArrowLeft size={20} /><span className="text-sm font-bold ml-1">戻る</span></button>
                    <div className="text-center mb-6">
                        <div className="bg-indigo-100 w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"><LogIn className="w-7 h-7 text-indigo-600" /></div>
                        <h2 className="text-xl font-bold text-gray-800">サークルに参加</h2>
                        <p className="text-xs text-gray-500 mt-2">共有されたIDを入力して参加します</p>
                    </div>
                    <form onSubmit={handleJoinSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">あなたの名前</label>
                            <div className="relative">
                                <UserCircle className="absolute left-3 top-3 text-gray-400" size={20} />
                                <input 
                                    type="text" 
                                    value={inputName} 
                                    onChange={(e) => setInputName(e.target.value)} 
                                    placeholder="例: たなか" 
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 font-bold" 
                                    required 
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 ml-1">サークルID</label>
                            <input 
                                type="text" 
                                value={inputCircleId} 
                                onChange={(e) => setInputCircleId(e.target.value)} 
                                placeholder="例: 123456" 
                                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 font-mono text-lg tracking-widest text-center" 
                                required 
                            />
                        </div>
                        <button type="submit" disabled={isProcessing} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 flex justify-center items-center gap-2 active:scale-95 shadow-lg shadow-indigo-200 mt-2">
                            {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : '参加する'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center p-6 relative">
            <GoogleLoginButton />
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-8 text-center animate-in zoom-in-95 duration-300">
                <div className="mb-8">
                    <div className="bg-indigo-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-md"><Wallet className="w-10 h-10 text-indigo-600" /></div>
                    <h1 className="text-2xl font-bold text-gray-800">サークル財布</h1>
                    <p className="text-xs font-bold text-indigo-500 tracking-wider mt-1 uppercase">Circle Wallet</p>
                </div>
                <div className="space-y-3">
                    <button onClick={onCreate} disabled={isProcessing} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70 group">{isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : <PlusCircle size={20} className="group-hover:scale-110 transition-transform"/>} 新しいサークルを作る</button>
                    <button onClick={() => setMode('join')} disabled={isProcessing} className="w-full py-4 bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-100 rounded-xl font-bold transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-70"><LogIn size={20} className="text-gray-400"/> 既存サークルに参加</button>
                </div>
                
                {myCircles.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-gray-100">
                        <p className="text-xs font-bold text-gray-400 mb-3 flex items-center justify-center gap-1"><HistoryIcon size={12}/> 参加中のサークル</p>
                        <div className="space-y-2">
                            {myCircles.map(h => (
                                <button key={h.id} onClick={() => onJoin(h.id, inputName)} disabled={isProcessing} className="w-full p-3 bg-gray-50 hover:bg-indigo-50 rounded-xl border border-gray-100 flex items-center justify-between group active:scale-95 transition-all text-left">
                                    <div>
                                        <div className="font-bold text-sm text-gray-700 group-hover:text-indigo-700">{h.name || "名称未設定"}</div>
                                        <div className="text-[10px] text-gray-400 font-mono">ID: {h.id}</div>
                                    </div>
                                    <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400"/>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {!isAnonymous && user && (
                    <div className="mt-6 p-3 bg-green-50 rounded-xl border border-green-100 text-xs text-green-700 text-left">
                        <div className="font-bold flex items-center gap-1 mb-1"><ShieldCheck size={14}/> アカウント保護中</div>
                        機種変更時は、新しい端末で同じGoogleアカウントでログインすることでデータを引き継げます。
                    </div>
                )}
            </div>
        </div>
    );
};

export default function App() {
    const [user, setUser] = useState<User | null>(null);
    const [circleId, setCircleId] = useState<string | null>(null);
    const [currentEventId, setCurrentEventId] = useState<string | null>(null);
    const [myRole, setMyRole] = useState<string | null>(null); 
    const [viewMode, setViewMode] = useState<'dashboard' | 'accounting'>('dashboard'); // View管理
    
    const [circleInfo, setCircleInfo] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    
    // Accounting Data State
    const [accountingData, setAccountingData] = useState<{unpaid: any[], unreimbursed: any[]}>({ unpaid: [], unreimbursed: [] });
    const [isAccountingLoading, setIsAccountingLoading] = useState(false);

    // Event Detail State
    const [transactions, setTransactions] = useState<any[]>([]);
    const [participants, setParticipants] = useState<any[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [showAddEvent, setShowAddEvent] = useState(false);
    const [transactionModalMode, setTransactionModalMode] = useState<string | null>(null);
    const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingName, setEditingName] = useState('');
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);
    
    // ★追加: 編集用State
    const [editingTransaction, setEditingTransaction] = useState<any>(null);

    // ★追加: 精算モーダル用
    const [settlementData, setSettlementData] = useState<any>(null);
    const [showSettlementModal, setShowSettlementModal] = useState(false);

    // ★追加: 新規イベント作成時の画像State
    const [newEventImage, setNewEventImage] = useState<string | null>(null);

    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        if (ua.includes('line') || ua.includes('instagram') || ua.includes('facebook') || ua.includes('twitter')) {
            setIsInAppBrowser(true);
        }
    }, []);
    
    const [toast, setToast] = useState<{message: string, type: 'success'|'error'|'info'} | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isProcessingAction, setIsProcessingAction] = useState(false);
    const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', action: async () => {} });

    const showToast = (message: string, type: 'success'|'error'|'info' = 'success') => setToast({ message, type });

    const executeConfirmAction = async () => {
        if (!confirmModal.action) return;
        setIsProcessingAction(true);
        try {
            await confirmModal.action();
            setConfirmModal({ ...confirmModal, isOpen: false });
        } catch (error: any) {
            console.error(error);
            showToast(`エラー: ${error.message}`, 'error');
        } finally {
            setIsProcessingAction(false);
        }
    };

    // Helper to ensure we have a user
    const ensureUser = async () => {
        return new Promise<User>((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (u) => {
                if (u) {
                    unsubscribe();
                    resolve(u);
                } else {
                    signInAnonymously(auth).catch((error) => {
                        unsubscribe();
                        reject(error);
                    });
                }
            }, reject);
        });
    };

    // Auth & Init
    useEffect(() => {
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlCircleId = params.get('circle');
            const urlEventId = params.get('event');
            if (urlCircleId) setCircleId(urlCircleId);
            if (urlEventId) setCurrentEventId(urlEventId);
            try {
                if (!auth.currentUser) await signInAnonymously(auth);
            } catch (e) { console.error(e); }
        };
        init();
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            if(u) setLoading(false);
            else if (!u) setTimeout(() => setLoading(false), 500);
        });
    }, []);

    // Circle Data Listener
    useEffect(() => {
        if (!user || !circleId) {
            if (user && !circleId) setLoading(false);
            return;
        }
        setLoading(true);
        const unsubCircle = onSnapshot(getDocRef(PATHS.circle(circleId)), (doc) => {
            if (doc.exists()) setCircleInfo(doc.data());
            else {
                setCircleId(null);
                showToast("サークルが見つかりません", 'error');
            }
            setLoading(false);
        });

        const unsubMembers = onSnapshot(getCol(PATHS.members(circleId)), (snap) => {
            const mems = snap.docs.map(d => d.data());
            setMembers(mems);
            if (user) {
                const me = mems.find(m => m.uid === user.uid);
                setMyRole(me ? me.role : 'guest');
            }
        });

        const unsubEvents = onSnapshot(query(getCol(PATHS.events(circleId)), orderBy('createdAt', 'desc')), (snap) => {
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubCircle(); unsubMembers(); unsubEvents(); };
    }, [user, circleId]);

    // Event Detail Listener
    useEffect(() => {
        if (!user || !circleId || !currentEventId) return;
        const unsubTrans = onSnapshot(query(getCol(PATHS.transactions(circleId, currentEventId)), orderBy('timestamp', 'desc')), (snap) => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        const unsubPart = onSnapshot(getCol(PATHS.participants(circleId, currentEventId)), (snap) => {
            setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => { unsubTrans(); unsubPart(); };
    }, [user, circleId, currentEventId]);

    // ★追加: 会計データの集計関数
    const fetchAccountingData = async () => {
        if (!circleId || events.length === 0) return;
        setIsAccountingLoading(true);
        try {
            const unpaidList: any[] = [];
            const unreimbursedList: any[] = [];
            const reimbursementMap: {[key: string]: any} = {};
            const activeEvents = events.filter(e => e.status === 'active' && e.id !== 'general');
            
            for (const ev of activeEvents) {
                const [transSnap, partSnap] = await Promise.all([
                    getDocs(getCol(PATHS.transactions(circleId, ev.id))),
                    getDocs(getCol(PATHS.participants(circleId, ev.id)))
                ]);
                const evTrans = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                const evParts = partSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const checkUnpaid = (uid: string, name: string, isGuest: boolean) => {
                    const hasPaid = evTrans.some((t: any) => t.type === 'collection' && t.userId === uid);
                    if (!hasPaid) unpaidList.push({ uid, name, event: ev, isGuest });
                };
                members.forEach((m: any) => checkUnpaid(m.uid, m.displayName, false));
                evParts.forEach((p: any) => checkUnpaid(p.id, p.displayName, true));

                evTrans.filter((t: any) => t.type === 'expense' && !t.summary.isReimbursed).forEach((t: any) => {
                    const key = `${ev.id}_${t.userId}`;
                    if (!reimbursementMap[key]) {
                        reimbursementMap[key] = {
                            user: { uid: t.userId, displayName: t.userName },
                            event: ev,
                            total: 0,
                            items: []
                        };
                    }
                    reimbursementMap[key].total += t.summary.totalAmount;
                    reimbursementMap[key].items.push(t);
                });
            }
            setAccountingData({ unpaid: unpaidList, unreimbursed: Object.values(reimbursementMap) });
        } catch (e) {
            console.error(e);
            showToast("データの集計に失敗しました", 'error');
        } finally {
            setIsAccountingLoading(false);
        }
    };

    useEffect(() => {
        if (viewMode === 'accounting' && circleId) {
            fetchAccountingData();
        }
    }, [viewMode, circleId, events]); 

    // Actions
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            if (user && user.isAnonymous) {
                await linkWithPopup(user, provider);
                showToast("Googleアカウントと連携しました！", "success");
            } else {
                await signInWithPopup(auth, provider);
                showToast("ログインしました", "success");
            }
        } catch (error: any) {
            if (error.code === 'auth/credential-already-in-use') {
                if (window.confirm("このGoogleアカウントは既に別のユーザーで使用されています。アカウントを切り替えますか？\n(現在の未連携データは失われる可能性があります)")) {
                    try {
                        // 既存のcredentialでサインインし直す
                        if (error.credential) {
                             await signInWithCredential(auth, error.credential);
                             showToast("アカウントを切り替えました", "success");
                        } else {
                             // credentialがない場合は再度ポップアップでサインイン（このときはlinkではなくsignIn）
                             await signInWithPopup(auth, provider);
                             showToast("アカウントを切り替えました", "success");
                        }
                    } catch (signInError: any) {
                        showToast("ログインエラー: " + signInError.message, "error");
                    }
                }
            } else {
                showToast("エラー: " + error.message, "error");
            }
        }
    };

    const handleCreateCircle = async () => {
        setIsSubmitting(true);
        try {
            const currentUser = await ensureUser();
            const newCircleId = Math.floor(100000 + Math.random() * 900000).toString();
            const batch = writeBatch(db);
            const name = "新しいサークル";
            batch.set(getDocRef(PATHS.circle(newCircleId)), { circleId: newCircleId, createdAt: serverTimestamp(), createdBy: currentUser.uid, name });
            batch.set(getDocRef(PATHS.member(newCircleId, currentUser.uid)), { uid: currentUser.uid, displayName: currentUser.displayName || "管理者", role: "admin", joinedAt: serverTimestamp() });
            batch.set(getDocRef(PATHS.event(newCircleId, 'general')), { title: "サークル費（一般会計）", feePerPerson: 0, createdAt: serverTimestamp(), status: 'active' });
            batch.set(getDocRef(PATHS.userJoinedCircle(currentUser.uid, newCircleId)), { name, joinedAt: serverTimestamp() });
            await batch.commit();
            setCircleId(newCircleId);
            saveCircleHistory(newCircleId, name);
            showToast(`サークル作成完了！ID: ${newCircleId}`, 'success');
        } catch (e: any) { showToast("作成失敗: " + e.message, 'error'); } finally { setIsSubmitting(false); }
    };

    const handleJoinCircle = async (inputCircleId: string, inputName: string) => {
        setIsSubmitting(true);
        try {
            const id = inputCircleId.trim();
            if(!id) throw new Error("IDを入力してください");
            let currentUser = auth.currentUser;
            const circleRef = getDocRef(PATHS.circle(id));
            let snap = await getDoc(circleRef);
            
            if (!snap.exists()) throw new Error("サークルが見つかりません");
            const circleData = snap.data();
            saveCircleHistory(id, circleData?.name || "サークル");

            if (currentUser && inputName) {
                try { await updateProfile(currentUser, { displayName: inputName }); } catch (e) {}
            }
            if (currentUser) {
                const memberRef = getDocRef(PATHS.member(id, currentUser.uid));
                const memSnap = await getDoc(memberRef);
                if (!memSnap.exists()) {
                    await setDoc(memberRef, { uid: currentUser.uid, displayName: inputName || currentUser.displayName || "メンバー", role: "member", joinedAt: serverTimestamp() });
                }
                await setDoc(getDocRef(PATHS.userJoinedCircle(currentUser.uid, id)), { name: circleData?.name || "サークル", joinedAt: serverTimestamp() });
            }
            setCircleId(id);
            showToast("参加しました", 'success');
        } catch (e: any) { showToast(e.message, 'error'); } finally { setIsSubmitting(false); }
    };

    const handleUpdateCircleName = async () => {
        if (!editingName.trim()) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            batch.update(getDocRef(PATHS.circle(circleId!)), { name: editingName.trim() });
            if (user) { batch.update(getDocRef(PATHS.userJoinedCircle(user.uid, circleId!)), { name: editingName.trim() }); }
            await batch.commit();
            setIsEditingName(false);
            showToast("サークル名を変更しました", 'success');
        } catch (e: any) { showToast("変更失敗: " + e.message, 'error'); } finally { setIsSubmitting(false); }
    };
    
    // ★追加: 新規イベント作成時の画像選択ハンドラ
    const handleNewEventImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        try {
            const base64 = await resizeImage(file, 800, 0.7);
            setNewEventImage(base64);
        } catch (error) {
            console.error("Image process error", error);
            showToast("画像の処理に失敗しました", 'error');
        }
    };

    const createEvent = async (e: any) => {
        e.preventDefault();
        if (myRole !== 'admin') return;
        const title = e.target.title.value;
        const fee = parseInt(e.target.feePerPerson.value);
        const password = e.target.password.value; // Pass
        
        setIsSubmitting(true);
        try {
            await addDoc(getCol(PATHS.events(circleId!)), { 
                title, 
                feePerPerson: fee, 
                password: password.trim() || "", // Save password
                createdAt: serverTimestamp(), 
                status: 'active',
                coverImageUrl: newEventImage // Save image
            });
            setShowAddEvent(false);
            setNewEventImage(null); // Reset image
            showToast("イベントを作成しました", 'success');
        } catch (e: any) { showToast(e.message, 'error'); } finally { setIsSubmitting(false); }
    };

    const addTransaction = async (e: any) => {
        e.preventDefault();
        if (!currentEventId || !user) return;
        const form = e.target;
        const amountVal = form.amount.value;
        const desc = form.description.value;
        if (currentEventId === 'general' && myRole !== 'admin') { showToast("管理者権限がありません", 'error'); return; }
        if (!amountVal || !desc) { showToast("金額と内容を入力してください", 'error'); return; }
        const amount = parseInt(amountVal);
        const cat = form.category?.value || 'other';
        let type = form.type?.value || 'expense';
        if (transactionModalMode === 'admin_direct') type = 'admin_expense';
        setIsSubmitting(true);
        try {
            const me = members.find(m => m.uid === user.uid);
            const userName = me ? me.displayName : (user.displayName || "メンバー");
            const isAdminDirect = type === 'admin_expense';
            await addDoc(getCol(PATHS.transactions(circleId!, currentEventId)), {
                userId: user.uid, userName, type, description: desc, timestamp: serverTimestamp(),
                summary: { totalAmount: amount, primaryCategory: cat, hasReceipt: type === 'expense', isReimbursed: isAdminDirect }
            });
            setTransactionModalMode(null);
            showToast("記録しました", 'success');
        } catch(e: any) { showToast(e.message, 'error'); } finally { setIsSubmitting(false); }
    };
    
    // ★追加: トランザクション更新機能
    const handleUpdateTransaction = async (e: any) => {
        e.preventDefault();
        if (!editingTransaction || !currentEventId || !circleId) return;
        const form = e.target;
        const amount = parseInt(form.amount.value);
        const description = form.description.value;
        const category = form.category ? form.category.value : 'other';
        
        setIsSubmitting(true);
        try {
            const ref = getDocRef(PATHS.transaction(circleId, currentEventId, editingTransaction.id));
            await updateDoc(ref, {
                description,
                "summary.totalAmount": amount,
                "summary.primaryCategory": category
            });
            setEditingTransaction(null);
            showToast("更新しました", 'success');
        } catch (error: any) {
            console.error(error);
            showToast("更新エラー: " + error.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    // ★追加: トランザクション削除機能
    const promptDeleteTransaction = (id: string) => {
        setConfirmModal({
            isOpen: true,
            title: "記録の削除",
            message: "この記録を取り消しますか？\nこの操作は元に戻せません。",
            action: async () => {
                const targetEvId = currentEventId || 'general';
                await deleteDoc(getDocRef(PATHS.transaction(circleId!, targetEvId, id)));
                showToast("削除しました", 'success');
            }
        });
    };

    const toggleMyPayment = async (eventFee: number) => {
        if (!user || !currentEventId) return;
        const myPayment = transactions.find(t => t.type === 'collection' && t.userId === user.uid);
        setIsSubmitting(true);
        try {
            if (myPayment) {
                await deleteDoc(getDocRef(PATHS.transaction(circleId!, currentEventId, myPayment.id)));
                showToast("支払いをキャンセルしました", 'info');
            } else {
                const me = members.find(m => m.uid === user!.uid);
                const userName = me ? me.displayName : (user!.displayName || "メンバー");
                await addDoc(getCol(PATHS.transactions(circleId!, currentEventId)), {
                    userId: user.uid, userName, type: 'collection', description: '会費', timestamp: serverTimestamp(),
                    summary: { totalAmount: eventFee, primaryCategory: 'other', hasReceipt: false, isReimbursed: false }
                });
                showToast("支払いを記録しました", 'success');
            }
        } catch (e: any) { showToast("エラー: " + e.message, 'error'); } finally { setIsSubmitting(false); }
    };

    const toggleMemberPayment = async (targetUid: string, targetName: string, eventFee: number, isPaid: boolean, transactionId: string | null) => {
        if (myRole !== 'admin' || !currentEventId) return;
        try {
            if (isPaid && transactionId) {
                await deleteDoc(getDocRef(PATHS.transaction(circleId!, currentEventId, transactionId)));
                showToast(`${targetName}さんの支払いをキャンセル`, 'info');
            } else {
                await addDoc(getCol(PATHS.transactions(circleId!, currentEventId)), {
                    userId: targetUid, userName: targetName, type: 'collection', description: '会費', timestamp: serverTimestamp(),
                    summary: { totalAmount: eventFee, primaryCategory: 'other', hasReceipt: false, isReimbursed: false }
                });
                showToast(`${targetName}さんを支払い済みにしました`, 'success');
            }
        } catch (e: any) { showToast("エラー: " + e.message, 'error'); }
    };
    
    // ★追加: 立て替えの精算完了アクション
    const markExpenseReimbursed = async (eventId: string, transactionId: string, userName: string) => {
        if (myRole !== 'admin') return;
        if (!window.confirm(`${userName}さんへの返金を完了しましたか？`)) return;
        
        try {
            const ref = getDocRef(PATHS.transaction(circleId!, eventId, transactionId));
            await updateDoc(ref, { "summary.isReimbursed": true });
            
            // 画面を更新するために再フェッチ（簡易的）
            if (viewMode === 'accounting') fetchAccountingData();
            
            showToast("返金完了を記録しました", 'success');
        } catch (e: any) {
             showToast("エラー: " + e.message, 'error');
        }
    };

    const handleSettleEvent = (event: any, balance: number) => {
        // 全参加者（メンバー+ゲスト）のリストを作成（重複排除）
        const allParticipantsMap = new Map();
        members.forEach(m => allParticipantsMap.set(m.uid, m.displayName));
        participants.forEach(p => allParticipantsMap.set(p.id, p.displayName));
        
        // ★修正: 会費を払った人のセット（割り勘の分母）
        const paidMemberIds = new Set(transactions.filter(t => t.type === 'collection').map(t => t.userId));
        const participantCount = paidMemberIds.size;
        
        // ★修正: 立替がある人のセット（返金の対象者）
        // (type='expense' かつ 未精算のもの)
        const creditorIds = new Set(transactions.filter(t => t.type === 'expense' && !t.summary.isReimbursed).map(t => t.userId));
        
        // ★修正: 精算リストに載せるべき対象者は、「会費を払った人」または「立替がある人」
        const targetUserIds = new Set([...paidMemberIds, ...creditorIds]);

        if (participantCount === 0 && targetUserIds.size === 0) {
            showToast("精算対象となるデータがありません（会費支払いや立替がありません）", 'error');
            return;
        }

        const totalIncome = transactions.filter(t => t.type === 'collection' || t.type === 'general_income').reduce((s, t) => s + (t.summary?.totalAmount || 0), 0);
        const totalExpense = transactions.filter(t => t.type === 'expense' || t.type === 'general_expense' || t.type === 'admin_expense').reduce((s, t) => s + (t.summary?.totalAmount || 0), 0);
        const surplus = totalIncome - totalExpense; // 残高
        
        // 1人あたりの分配額 (切り捨て) - 会費を払った人で割る
        // 参加費支払者が0人の場合（ありえないはずだが）は0にする
        const perPersonSurplus = participantCount > 0 ? Math.floor(surplus / participantCount) : 0;

        // 未精算の立替経費を集計
        const reimbursementMap: {[uid: string]: number} = {};
        transactions.filter(t => t.type === 'expense' && !t.summary.isReimbursed).forEach(t => {
            reimbursementMap[t.userId] = (reimbursementMap[t.userId] || 0) + t.summary.totalAmount;
        });

        // リスト作成
        const settlementList: any[] = [];
        targetUserIds.forEach(uid => {
            const name = allParticipantsMap.get(uid) || "不明なユーザー";
            const reimbursement = reimbursementMap[uid] || 0; // 立替返金
            
            // 分配金は、会費を払った人のみ対象とする
            const distribution = paidMemberIds.has(uid) ? perPersonSurplus : 0; 
            
            settlementList.push({
                uid,
                name,
                reimbursement,
                distribution,
                totalTransfer: reimbursement + distribution // 最終的に渡す額
            });
        });
        
        // ソート: 受け取る額が多い順
        settlementList.sort((a, b) => b.totalTransfer - a.totalTransfer);

        setSettlementData({
            totalIncome,
            totalExpense,
            surplus,
            perPersonSurplus,
            list: settlementList
        });
        setShowSettlementModal(true);
    };
    
    // ★修正: 精算確定処理 (分岐ロジック追加)
    const confirmSettlement = async (mode: 'distribute' | 'carryover') => {
        if (!user || !currentEventId || !settlementData) return;
        setIsProcessingAction(true);
        try {
            const batch = writeBatch(db);
            const eventRef = getDocRef(PATHS.event(circleId!, currentEventId));
            
            // 1. イベントをクローズ (残高情報も記録)
            batch.update(eventRef, { 
                status: 'closed', 
                settledAmount: settlementData.surplus, 
                settlementMode: mode, // モードも記録
                closedAt: serverTimestamp() 
            });

            // 2. 未精算の立替を全て精算済みにする
            transactions.filter(t => t.type === 'expense' && !t.summary.isReimbursed).forEach(t => {
                const ref = getDocRef(PATHS.transaction(circleId!, currentEventId, t.id));
                batch.update(ref, { "summary.isReimbursed": true });
            });
            
            // 3. 一般会計への反映 (繰越モードの場合のみ)
            if (mode === 'carryover') {
                const generalTransRef = doc(getCol(PATHS.transactions(circleId!, 'general')));
                batch.set(generalTransRef, {
                    userId: user.uid, 
                    userName: "システム", 
                    type: settlementData.surplus >= 0 ? 'general_income' : 'general_expense',
                    description: `イベント「${events.find(e => e.id === currentEventId)?.title}」の繰越金`, 
                    timestamp: serverTimestamp(),
                    summary: { 
                        totalAmount: Math.abs(settlementData.surplus), 
                        primaryCategory: 'other', 
                        hasReceipt: false, 
                        isReimbursed: false 
                    }
                });
            } else {
                // 分配モードの場合は、一般会計には記録しない（または0円記録とするなど運用によるが、今回は記録なし）
            }
            
            await batch.commit();
            setShowSettlementModal(false);
            showToast(mode === 'distribute' ? "精算を完了しました (分配)" : "精算を完了しました (繰越)", 'success');
        } catch (e: any) {
            showToast("エラー: " + e.message, 'error');
        } finally {
            setIsProcessingAction(false);
        }
    };

    const promptSettleEvent = (event: any, balance: number) => {
         if (!user) return;
        setConfirmModal({
            isOpen: true, title: "イベントの終了・反映",
            message: `イベント「${event.title}」を終了します。\n現在の残高: ${balance}円\nサークル費に反映しますか？`,
            action: async () => {
                const batch = writeBatch(db);
                const eventRef = getDocRef(PATHS.event(circleId!, event.id));
                batch.update(eventRef, { status: 'closed', settledAmount: balance, closedAt: serverTimestamp() });
                const generalTransRef = doc(getCol(PATHS.transactions(circleId!, 'general')));
                batch.set(generalTransRef, {
                    userId: user.uid, userName: "システム", type: balance >= 0 ? 'general_income' : 'general_expense',
                    description: `イベント「${event.title}」の精算`, timestamp: serverTimestamp(),
                    summary: { totalAmount: Math.abs(balance), primaryCategory: 'other', hasReceipt: false, isReimbursed: false }
                });
                await batch.commit();
                showToast("サークル費に反映しました", 'success');
            }
        });
    };

    const calculateCurrentEventStats = () => {
        const exps = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.summary?.totalAmount || 0), 0);
        const adminExps = transactions.filter(t => t.type === 'admin_expense').reduce((s, t) => s + (t.summary?.totalAmount || 0), 0);
        const cols = transactions.filter(t => t.type === 'collection' || t.type === 'general_income').reduce((s, t) => s + (t.summary?.totalAmount || 0), 0);
        const g_exps = transactions.filter(t => t.type === 'general_expense').reduce((s, t) => s + (t.summary?.totalAmount || 0), 0);
        return { income: cols, expense: exps + g_exps + adminExps, balance: cols - (exps + g_exps + adminExps) };
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, targetEventId: string) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        
        setIsSubmitting(true);
        try {
            const base64 = await resizeImage(file, 800, 0.7);
            await updateDoc(getDocRef(PATHS.event(circleId!, targetEventId)), {
                coverImageUrl: base64
            });
            showToast("写真を更新しました", 'success');
        } catch (error) {
            console.error("Upload Error", error);
            showToast("画像の処理に失敗しました", 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <LoadingScreen />;

    return (
        <ErrorBoundary>
            {isInAppBrowser && <div className="fixed top-0 left-0 right-0 z-[10000] bg-red-600 text-white p-3 text-center text-xs font-bold">アプリ内ブラウザではGoogleログインができません。Safari/Chromeで開いてください。</div>}

            {/* 1. Onboarding */}
            {!circleId && (
                <>
                    <OnboardingScreen onCreate={handleCreateCircle} onJoin={handleJoinCircle} isProcessing={isSubmitting} onGoogleLogin={handleGoogleLogin} user={user} />
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                </>
            )}

            {/* 2. Event Detail View */}
            {circleId && currentEventId && (() => {
                 const event = events.find(e => e.id === currentEventId);
                if (!event) return <div className="p-10 text-center">イベントが見つかりません <button onClick={() => setCurrentEventId(null)} className="text-blue-500 underline">戻る</button></div>;
                const stats = calculateCurrentEventStats();
                const isGeneral = currentEventId === 'general';
                const isAdmin = myRole === 'admin';
                const isClosed = event.status === 'closed';
                const myExpenses = transactions.filter(t => t.userId === user?.uid && t.type === 'expense');
                const unreimbursedExpenses = transactions.filter(t => t.type === 'expense' && !t.summary.isReimbursed);
                const allExpenses = transactions.filter(t => t.type === 'expense' || t.type === 'admin_expense' || t.type === 'general_expense');
                const paymentStatusList: any[] = members.map(m => {
                    const payment = transactions.find(t => t.type === 'collection' && t.userId === m.uid);
                    return { ...m, paid: !!payment, amount: payment ? payment.summary.totalAmount : 0, transactionId: payment?.id };
                });
                participants.forEach(p => {
                    const payment = transactions.find(t => t.type === 'collection' && t.userId === p.id);
                    paymentStatusList.push({ uid: p.id, displayName: p.displayName, role: 'guest', paid: !!payment || p.paid, amount: payment ? payment.summary.totalAmount : 0, transactionId: payment?.id });
                });
                const myPaymentStatus = transactions.find(t => t.type === 'collection' && t.userId === user?.uid);
                const hasPaid = !!myPaymentStatus;

                return (
                    <div className="min-h-screen bg-slate-50 pb-24">
                        <div className="bg-white px-6 py-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
                             <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentEventId(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"><ArrowLeft size={20} /></button>
                                <h1 className="text-lg font-bold truncate max-w-[200px]">{event.title}</h1>
                            </div>
                        </div>
                        
                        <div className="p-4 space-y-6">
                            {/* 画像設定エリア (管理者かつ一般会計以外) */}
                            {isAdmin && !isGeneral && (
                                <div className="mb-4 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                                    <h3 className="text-xs font-bold text-gray-500 mb-3 flex items-center gap-1">
                                        <Camera size={14} /> イベント写真設定
                                    </h3>
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-24 h-16 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0">
                                            {event.coverImageUrl ? (
                                                <img src={event.coverImageUrl} className="w-full h-full object-cover" alt="Event Cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-300"><ImageIcon size={20}/></div>
                                            )}
                                        </div>
                                        <label className="flex-1 cursor-pointer">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={(e) => handleImageUpload(e, event.id)}
                                                disabled={isSubmitting}
                                            />
                                            <div className="bg-indigo-50 text-indigo-600 text-sm font-bold py-2 px-4 rounded-lg text-center hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2">
                                                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4"/> : <Camera size={16} />}
                                                {event.coverImageUrl ? '写真を変更' : '写真を選択'}
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                             <section>
                                <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">イベント収支</h3>
                                <div className="bg-gray-800 rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden">
                                    <p className="text-gray-400 text-sm mb-1">{isGeneral ? 'サークル残高' : '残高'}</p>
                                    <div className={`text-4xl font-bold mb-2 ${stats.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.balance >= 0 ? '+' : ''} ¥{stats.balance.toLocaleString()}</div>
                                    <div className="flex justify-center gap-4 text-xs text-gray-400 mb-4"><span>収入: ¥{stats.income.toLocaleString()}</span><span>支出: ¥{stats.expense.toLocaleString()}</span></div>
                                    {isAdmin && !isGeneral && !isClosed && (
                                        <button 
                                            onClick={() => handleSettleEvent(event, stats.balance)} 
                                            className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-bold text-sm border border-white/20 flex items-center justify-center gap-2"
                                        >
                                            <Calculator size={16}/> 会計を終了 (精算)
                                        </button>
                                    )}
                                </div>
                             </section>

                             {isAdmin && !isGeneral && !isClosed && <button onClick={() => setTransactionModalMode('admin_direct')} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg active:scale-95">管理者の支出 (直接)</button>}

                             {!isGeneral && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">集金状況</h3>
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="p-5 border-b border-gray-100">
                                            <div className="flex justify-between items-center mb-4">
                                                <div><p className="text-xs text-gray-400">会費</p><p className="text-xl font-bold text-gray-800">¥{event.feePerPerson.toLocaleString()}</p></div>
                                                <button onClick={() => toggleMyPayment(event.feePerPerson)} disabled={isSubmitting || isClosed} className={`px-6 py-3 rounded-xl font-bold shadow-md active:scale-95 ${hasPaid ? 'bg-green-500 text-white' : 'bg-white border-2 border-indigo-600 text-indigo-600'}`}>{hasPaid ? '支払い済み' : '支払った'}</button>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsParticipantListOpen(!isParticipantListOpen)} className="w-full p-3 text-center text-xs font-bold text-gray-500 hover:bg-gray-100">みんなの状況 ({paymentStatusList.filter(p => p.paid).length}/{paymentStatusList.length} 済)</button>
                                        {isParticipantListOpen && <div className="max-h-[200px] overflow-y-auto border-t border-gray-100">{paymentStatusList.map((p, idx) => (<div key={idx} className="p-3 border-b border-gray-100 flex justify-between px-5"><span className={p.uid === user?.uid ? 'font-bold' : ''}>{p.displayName}</span>{p.paid ? (isAdmin && !isClosed ? <button onClick={() => toggleMemberPayment(p.uid, p.displayName, event.feePerPerson, true, p.transactionId)} className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">済 (解除)</button> : <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">済</span>) : (isAdmin && !isClosed ? <button onClick={() => toggleMemberPayment(p.uid, p.displayName, event.feePerPerson, false, null)} className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded">未払い</button> : <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded">未</span>)}</div>))}</div>}
                                    </div>
                                </section>
                             )}

                             <section>
                                <div className="flex justify-between items-end mb-2 ml-1"><h3 className="text-xs font-bold text-gray-500">立て替えリスト</h3></div>
                                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                                    {(!isGeneral || isAdmin) && !isClosed && <div className="p-4 bg-indigo-50/50 border-b border-indigo-50"><button onClick={() => setTransactionModalMode('regular')} className="w-full py-3 bg-white border border-indigo-100 text-indigo-600 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm"><Plus size={18}/> {isGeneral ? '入出金を記録' : '立て替えを追加'}</button></div>}
                                    <div className="max-h-[300px] overflow-y-auto">
                                        {unreimbursedExpenses.length > 0 ? (
                                            <div className="divide-y divide-gray-50">
                                                {unreimbursedExpenses.map(t => (
                                                    <div key={t.id} className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1"><span className="font-bold text-gray-800">{t.description}</span></div>
                                                            <div className="text-xs text-gray-500"><span className="font-bold text-indigo-600">{t.userName}</span> が立替</div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold text-gray-800">¥{t.summary.totalAmount.toLocaleString()}</span>
                                                            {(isAdmin || t.userId === user?.uid) && !isClosed && (
                                                                <button onClick={() => setEditingTransaction(t)} className="text-gray-400 hover:text-indigo-600 p-1"><Edit3 size={16} /></button>
                                                            )}
                                                            {isAdmin && !isClosed && <button onClick={() => {
                                                                setConfirmModal({
                                                                    isOpen: true, title: "返金の完了確認",
                                                                    message: `${t.userName}さんへの ¥${t.summary.totalAmount.toLocaleString()} の返金を完了しますか？`,
                                                                    action: async () => { const ref = getDocRef(PATHS.transaction(circleId!, currentEventId, t.id)); await updateDoc(ref, { "summary.isReimbursed": true }); }
                                                                });
                                                            }} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">精算</button>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : <div className="p-6 text-center text-xs text-gray-400">未精算の立て替えはありません</div>}
                                    </div>
                                </div>
                             </section>
                             
                             <section>
                                 <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">支出の履歴</h3>
                                 <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden max-h-[200px] overflow-y-auto">
                                     {allExpenses.map(t => (
                                         <div key={t.id} className="p-4 border-b border-gray-50 flex justify-between items-center">
                                             <div><div className="font-bold text-sm">{t.description}</div><div className="text-xs text-gray-500">{safeFormatDate(t.timestamp)} • {t.userName}</div></div>
                                             <div className="flex items-center gap-2">
                                                <div className="text-right"><span className="font-bold block">¥{t.summary.totalAmount.toLocaleString()}</span>{t.summary.isReimbursed && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">精算済</span>}</div>
                                                {(isAdmin || t.userId === user?.uid) && !isClosed && (
                                                     <div className="flex gap-1 ml-2">
                                                         <button onClick={() => setEditingTransaction(t)} className="text-gray-400 hover:text-indigo-600 p-1"><Edit3 size={16} /></button>
                                                         <button onClick={() => promptDeleteTransaction(t.id)} className="text-gray-300 hover:text-red-400 p-1"><XCircle size={16}/></button>
                                                     </div>
                                                )}
                                             </div>
                                         </div>
                                     ))}
                                 </div>
                             </section>

                        </div>
                        {transactionModalMode && (
                             <div className="fixed inset-0 bg-black/60 z-[5000] flex items-end sm:items-center justify-center sm:p-4">
                                <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6">
                                    <h2 className="text-lg font-bold mb-4">{transactionModalMode === 'admin_direct' ? '管理者の支出' : '立て替えを追加'}</h2>
                                    <form onSubmit={addTransaction} className="space-y-4">
                                        {transactionModalMode === 'regular' && (
                                             <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                                 <label className="flex-1 cursor-pointer"><input type="radio" name="type" value="expense" defaultChecked className="peer sr-only"/><div className="text-center py-2 text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-red-600 peer-checked:shadow-sm rounded">立替払い</div></label>
                                             </div>
                                        )}
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">金額</label><input name="amount" type="number" className="w-full border rounded-xl p-3 text-lg font-bold" required /></div>
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">内容</label><input name="description" className="w-full border rounded-xl p-3" required /></div>
                                        {!isGeneral && <div><label className="block text-xs font-bold text-gray-500 mb-1">カテゴリ</label><select name="category" className="w-full border rounded-xl p-3 bg-white">{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>}
                                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold active:scale-95">{isSubmitting ? <Loader2 className="animate-spin"/> : '追加'}</button>
                                        <button type="button" onClick={() => setTransactionModalMode(null)} className="w-full py-3 text-gray-500 font-bold">キャンセル</button>
                                    </form>
                                </div>
                             </div>
                        )}
                        
                        {/* 編集モーダル */}
                        {editingTransaction && (
                            <div className="fixed inset-0 bg-black/60 z-[5000] flex items-center justify-center p-4">
                                <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                                    <h2 className="text-lg font-bold mb-4">記録を編集</h2>
                                    <form onSubmit={handleUpdateTransaction} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">金額</label>
                                            <input name="amount" type="number" defaultValue={editingTransaction.summary.totalAmount} className="w-full border rounded-xl p-3 text-lg font-bold" required />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">内容</label>
                                            <input name="description" type="text" defaultValue={editingTransaction.description} className="w-full border rounded-xl p-3" required />
                                        </div>
                                        {!isGeneral && editingTransaction.summary.primaryCategory && (
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">カテゴリ</label>
                                                <select name="category" defaultValue={editingTransaction.summary.primaryCategory} className="w-full border rounded-xl p-3 bg-white">
                                                    {Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
                                                </select>
                                            </div>
                                        )}
                                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold active:scale-95">
                                            {isSubmitting ? <Loader2 className="animate-spin" /> : '更新'}
                                        </button>
                                        <button type="button" onClick={() => setEditingTransaction(null)} className="w-full py-3 text-gray-500 font-bold">キャンセル</button>
                                    </form>
                                </div>
                            </div>
                        )}

                        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                        
                        {/* ★追加: 精算モーダル */}
                        <SettlementModal 
                            isOpen={showSettlementModal}
                            event={event}
                            settlementData={settlementData}
                            onConfirm={confirmSettlement}
                            onCancel={() => setShowSettlementModal(false)}
                            isProcessing={isProcessingAction}
                        />
                        <ConfirmModal isOpen={confirmModal.isOpen} title={confirmModal.title} message={confirmModal.message} onConfirm={executeConfirmAction} onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} isProcessing={isProcessingAction} />
                    </div>
                );
            })()}

            {/* 3. Circle Dashboard & Accounting View */}
            {circleId && !currentEventId && (
                <div className="min-h-screen bg-slate-50 pb-20">
                    <header className="bg-white px-6 py-6 shadow-sm sticky top-0 z-10">
                        <div className="flex justify-between items-center mb-4 relative z-20">
                            <div className="flex-1 min-w-0 mr-2">
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="text-xl font-bold text-gray-800 border-b-2 border-indigo-600 outline-none bg-transparent w-full" autoFocus />
                                        <button onClick={handleUpdateCircleName} disabled={isSubmitting} className="p-1 bg-indigo-100 text-indigo-600 rounded"><Check size={18}/></button>
                                        <button onClick={() => setIsEditingName(false)} className="p-1 bg-gray-100 text-gray-500 rounded"><X size={18}/></button>
                                    </div>
                                ) : (
                                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Users size={24} className="text-indigo-600 flex-shrink-0"/>
                                        <span className="truncate">{circleInfo?.name || '読み込み中...'}</span>
                                        {myRole === 'admin' && <button onClick={() => { setEditingName(circleInfo?.name || ''); setIsEditingName(true); }} className="text-gray-400 hover:text-indigo-600 flex-shrink-0"><Pencil size={16} /></button>}
                                    </h1>
                                )}
                                <div className="text-xs text-gray-400 mt-1 font-mono">ID: {circleId}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${myRole === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{myRole === 'admin' ? '管理者' : 'メンバー'}</span>
                                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?circle=${circleId}`); showToast("サークルURLをコピーしました", 'success'); }} className="bg-gray-100 p-2 rounded-full"><Share2 size={16}/></button>
                                {/* Removed pushState call */}
                                <button onClick={() => { setCircleId(null); setCurrentEventId(null); showToast("サークル選択画面に戻りました", 'info'); }} className="bg-gray-100 p-2 rounded-full"><Home size={16}/></button>
                            </div>
                        </div>
                    </header>

                    {/* ★Viewの切り替え */}
                    {viewMode === 'accounting' ? (
                        // 会計タスク確認画面
                        <div className="p-6">
                            <button onClick={() => setViewMode('dashboard')} className="mb-4 flex items-center text-gray-500 hover:text-gray-700"><ArrowLeft size={16} className="mr-1"/> ダッシュボードに戻る</button>
                            <h2 className="text-lg font-bold mb-4">会計タスク確認</h2>
                            
                            {isAccountingLoading ? <div className="text-center p-4"><Loader2 className="animate-spin inline"/> 集計中...</div> : (
                                <div className="space-y-6">
                                    <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
                                        <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-2"><AlertCircle className="text-orange-600" size={20} /><h2 className="font-bold text-orange-800">未入金リスト</h2></div>
                                        {accountingData.unpaid.length === 0 ? <div className="p-6 text-center text-gray-400 text-sm">未入金はありません</div> : (
                                            <div className="divide-y divide-gray-100">
                                                {accountingData.unpaid.map((item, idx) => (
                                                    <div key={idx} className="p-4 flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-gray-800">{item.name}</div>
                                                            <div className="text-xs text-gray-500">{item.event.title}</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-red-500">¥{item.event.feePerPerson.toLocaleString()}</span
>                                                            {myRole === 'admin' && (
                                                                <button onClick={() => {
                                                                    // 簡易的にFirestoreを更新
                                                                    const transRef = getCol(PATHS.transactions(circleId, item.event.id));
                                                                    addDoc(transRef, {
                                                                        userId: item.uid, userName: item.name, type: 'collection', description: '会費', timestamp: serverTimestamp(),
                                                                        summary: { totalAmount: item.event.feePerPerson, primaryCategory: 'other', hasReceipt: false, isReimbursed: false }
                                                                    }).then(() => {
                                                                        showToast("受領済みにしました", 'success');
                                                                        fetchAccountingData(); // 再取得
                                                                    });
                                                                }} className="text-[10px] bg-green-100 text-green-600 px-2 py-1 rounded font-bold">受領する</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                                        <div className="bg-indigo-50 p-4 border-b border-indigo-100 flex items-center gap-2"><Banknote className="text-indigo-600" size={20} /><h2 className="font-bold text-indigo-800">未精算リスト (立て替え)</h2></div>
                                        {accountingData.unreimbursed.length === 0 ? <div className="p-6 text-center text-gray-400 text-sm">未精算はありません</div> : (
                                            <div className="divide-y divide-gray-100">
                                                {accountingData.unreimbursed.map((item, idx) => (
                                                    <div key={idx} className="p-4 flex justify-between items-center">
                                                        <div>
                                                            <div className="font-bold text-gray-800">{item.user.displayName}</div>
                                                            <div className="text-xs text-gray-500">{item.event.title} ({item.items.length}件)</div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-indigo-600">¥{item.total.toLocaleString()}</span>
                                                            {myRole === 'admin' && (
                                                                <button onClick={() => {
                                                                    // 一括精算
                                                                    const batch = writeBatch(db);
                                                                    item.items.forEach((t: any) => {
                                                                        const ref = getDocRef(PATHS.transaction(circleId, item.event.id, t.id));
                                                                        batch.update(ref, { "summary.isReimbursed": true });
                                                                    });
                                                                    batch.commit().then(() => {
                                                                        showToast("精算完了を記録しました", 'success');
                                                                        fetchAccountingData();
                                                                    });
                                                                }} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">精算する</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        // 通常ダッシュボード
                        <div className="p-6">
                            {/* 1. Circle Funds (General Accounting) - Moved to top */}
                            <div onClick={() => setCurrentEventId('general')} className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-transform mb-6">
                                <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                        <p className="text-gray-400 text-xs font-bold mb-1"><Banknote size={12} className="inline mr-1"/>サークル費 (一般会計)</p>
                                        <p className="text-sm font-bold text-gray-300">入出金を管理 &rarr;</p>
                                    </div>
                                    <div className="bg-white/10 p-2 rounded-full"><ChevronRight className="text-white"/></div>
                                </div>
                            </div>

                            {/* 2. Accounting Tasks (Admin Only) - Moved below Circle Funds */}
                            {myRole === 'admin' && (
                                <button onClick={() => setViewMode('accounting')} className="w-full mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between shadow-sm active:scale-95 transition-transform">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-orange-100 p-2 rounded-full text-orange-600"><ClipboardList size={20}/></div>
                                        <div className="text-left">
                                            <div className="font-bold text-orange-900">会計タスク確認</div>
                                            <div className="text-xs text-orange-600">未払いや未精算を一括チェック</div>
                                        </div>
                                    </div>
                                    <ChevronRight className="text-orange-300"/>
                                </button>
                            )}

                            {/* 3. Event List */}
                            <div className="flex justify-between items-end mb-4">
                                <h2 className="font-bold text-gray-700">イベント一覧</h2>
                                {myRole === 'admin' && <button onClick={() => setShowAddEvent(true)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full font-bold active:scale-95">+ 新規作成</button>}
                            </div>
                            
                            <div className="space-y-3">
                                {events.filter(e => e.id !== 'general').map(event => (
                                    <EventAlbumRow key={event.id} event={event} onClick={() => setCurrentEventId(event.id)} />
                                ))}
                                {events.filter(e => e.id !== 'general').length === 0 && (
                                    <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-2xl border border-dashed border-gray-200">
                                        まだイベントがありません
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {showAddEvent && (
                        <div className="fixed inset-0 bg-black/60 z-[5000] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                                <h2 className="text-xl font-bold mb-4">新規イベント作成</h2>
                                <form onSubmit={createEvent} className="space-y-4">
                                    <div><label className="block text-sm font-medium text-gray-700">イベント名</label><input name="title" className="w-full border rounded-lg p-2" required /></div>
                                    <div><label className="block text-sm font-medium text-gray-700">会費 (1人あたり)</label><input name="feePerPerson" type="number" className="w-full border rounded-lg p-2" required /></div>
                                    <div><label className="block text-sm font-medium text-gray-700">参加パスワード (任意)</label><input name="password" type="text" className="w-full border rounded-lg p-2" placeholder="空欄なら誰でも参加可能" /></div>
                                    {/* 画像選択エリア */}
                                    <div className="flex justify-center mb-4">
                                        <label className="cursor-pointer group relative w-full">
                                            <input 
                                                type="file" 
                                                accept="image/*" 
                                                className="hidden" 
                                                onChange={handleNewEventImageSelect}
                                            />
                                            <div className={`w-full h-32 rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden transition-colors ${newEventImage ? 'border-indigo-300 bg-gray-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'}`}>
                                                {newEventImage ? (
                                                    <img src={newEventImage} alt="Preview" className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="text-center p-4">
                                                        <Camera className="w-8 h-8 text-gray-300 mx-auto mb-1 group-hover:text-indigo-400 transition-colors" />
                                                        <span className="text-xs text-gray-400 font-bold group-hover:text-indigo-500">写真を設定</span>
                                                    </div>
                                                )}
                                                {newEventImage && (
                                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <span className="text-white text-xs font-bold bg-black/50 px-2 py-1 rounded-full flex items-center gap-1">
                                                            <Camera size={12}/> 変更
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </label>
                                    </div>
                                    
                                    <div className="flex gap-2 pt-2">
                                        <button type="button" onClick={() => {setShowAddEvent(false); setNewEventImage(null);}} disabled={isSubmitting} className="flex-1 py-2 text-gray-500 disabled:opacity-50 active:scale-95">キャンセル</button>
                                        <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">{isSubmitting && <Loader2 className="animate-spin h-4 w-4"/>} 作成</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                </div>
            )}
        </ErrorBoundary>
    );
}