import React, { useState, useEffect } from 'react';
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
    writeBatch
} from 'firebase/firestore';

import { 
    Wallet, Plus, Users, ChevronRight, ArrowLeft, Calendar, Lock, 
    Share2, Banknote, Utensils, Train, BedDouble, 
    ShoppingBag, HelpCircle, AlertTriangle, Check, Loader2, Info, 
    ChevronDown, ChevronUp, Image as ImageIcon, 
    LogIn, PlusCircle, LogOut, ShieldCheck, UserCircle, 
    History as HistoryIcon, Pencil, X, ExternalLink, Home // RotateCcw削除
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

        // 重複削除して先頭に追加
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
                    <p className="mb-2 text-sm">以下の内容を教えてください：</p>
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

// DebugResetButton削除

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

const EventAlbumRow = ({ event, onClick }: any) => {
    const dateStr = safeFormatDate(event.createdAt);

    return (
        <div onClick={onClick} className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer active:scale-[0.98] transition-transform">
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

const OnboardingScreen = ({ onCreate, onJoin, isProcessing, onGoogleLogin, user }: any) => {
    const [mode, setMode] = useState('selection');
    const [inputCircleId, setInputCircleId] = useState('');
    const [inputName, setInputName] = useState(user?.displayName || '');
    const [myCircles, setMyCircles] = useState<any[]>([]); 

    // ★修正: データベース(Firestore) と ブラウザ履歴(LocalStorage) をマージして表示
    useEffect(() => {
        // 1. ローカル履歴を取得
        const localHistory = getCircleHistory();

        if (!user) {
            setMyCircles(localHistory);
            return;
        }

        // 2. データベースの履歴を取得してマージ
        const q = query(getCol(PATHS.userJoinedCircles(user.uid)), orderBy('joinedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const cloudHistory = snap.docs.map(d => ({ id: d.id, ...d.data() }));

            // IDが重複しないようにマージ（クラウド優先）
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
                
                {/* ★追加: 履歴リスト（DB + ローカルのマージ） */}
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
    const [myRole, setMyRole] = useState<string | null>(null); // 'admin' | 'member' | 'guest'
    
    const [circleInfo, setCircleInfo] = useState<any>(null);
    const [events, setEvents] = useState<any[]>([]);
    const [members, setMembers] = useState<any[]>([]);
    
    // Event Detail State
    const [transactions, setTransactions] = useState<any[]>([]);
    const [participants, setParticipants] = useState<any[]>([]); // Guests for event
    
    const [loading, setLoading] = useState(true);
    const [showAddEvent, setShowAddEvent] = useState(false);
    
    // showAddTransaction を boolean ではなく、モード文字列で管理するように変更
    const [transactionModalMode, setTransactionModalMode] = useState<string | null>(null);
    
    const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);
    
    // ★追加: 名前編集用のState
    const [isEditingName, setIsEditingName] = useState(false);
    const [editingName, setEditingName] = useState('');
    
    // ★追加: アプリ内ブラウザ検知
    const [isInAppBrowser, setIsInAppBrowser] = useState(false);

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

    // Helper to ensure we have a user (auto sign in anonymously if needed)
    const ensureUser = async () => {
        return new Promise<User>((resolve, reject) => {
            const unsubscribe = onAuthStateChanged(auth, (u) => {
                if (u) {
                    unsubscribe();
                    resolve(u);
                } else {
                    // User is null, try to sign in anonymously
                    signInAnonymously(auth).catch((error) => {
                        unsubscribe();
                        reject(error);
                    });
                }
            }, reject);
        });
    };

    // --- 1. Auth & Initial URL Check ---
    useEffect(() => {
        const init = async () => {
            const params = new URLSearchParams(window.location.search);
            const urlCircleId = params.get('circle');
            const urlEventId = params.get('event');

            if (urlCircleId) setCircleId(urlCircleId);
            if (urlEventId) setCurrentEventId(urlEventId);

            try {
                if (!auth.currentUser) {
                    await signInAnonymously(auth);
                }
            } catch (e) { console.error(e); }
        };
        init();
        return onAuthStateChanged(auth, (u) => {
            setUser(u);
            if(u) setLoading(false); 
            else if (!u) {
                setTimeout(() => setLoading(false), 500); 
            }
        });
    }, []);

    // --- 2. Circle Data Listener ---
    useEffect(() => {
        if (!user || !circleId) {
            if (user && !circleId) setLoading(false); 
            return;
        }

        setLoading(true);
        // Listen Circle Info
        const unsubCircle = onSnapshot(getDocRef(PATHS.circle(circleId)), (doc) => {
            if (doc.exists()) setCircleInfo(doc.data());
            else {
                setCircleId(null); 
                showToast("サークルが見つかりません", 'error');
            }
            setLoading(false);
        });

        // Listen Members (to determine role)
        const unsubMembers = onSnapshot(getCol(PATHS.members(circleId)), (snap) => {
            const mems = snap.docs.map(d => d.data());
            setMembers(mems);
            if (user) {
                const me = mems.find(m => m.uid === user.uid);
                setMyRole(me ? me.role : 'guest');
            }
        });

        // Listen Events
        const unsubEvents = onSnapshot(query(getCol(PATHS.events(circleId)), orderBy('createdAt', 'desc')), (snap) => {
            setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubCircle(); unsubMembers(); unsubEvents(); };
    }, [user, circleId]);

    // --- 3. Event Detail Listener (Only when currentEventId is set) ---
    useEffect(() => {
        if (!user || !circleId || !currentEventId) return;

        // Listen Transactions
        const unsubTrans = onSnapshot(query(getCol(PATHS.transactions(circleId, currentEventId)), orderBy('timestamp', 'desc')), (snap) => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        // Listen Participants (Guest Users specific to this event)
        const unsubPart = onSnapshot(getCol(PATHS.participants(circleId, currentEventId)), (snap) => {
            setParticipants(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });

        return () => { unsubTrans(); unsubPart(); };
    }, [user, circleId, currentEventId]);


    // --- Actions ---

    // ★修正: Googleログイン時のエラー処理を強化（credential-already-in-useの自動解決）
    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        try {
            if (user && user.isAnonymous) {
                // 匿名ユーザーの場合、アカウントを連携（現在のデータを維持）
                await linkWithPopup(user, provider);
                showToast("Googleアカウントと連携しました！", "success");
            } else {
                // 既に連携済み、またはログアウト状態からのログイン
                await signInWithPopup(auth, provider);
                showToast("ログインしました", "success");
            }
        } catch (error: any) {
            if (error.code === 'auth/credential-already-in-use') {
                // アカウント重複エラーの場合、確認なしで強制的にアカウントを切り替える
                if (error.credential) {
                     try {
                        await signInWithCredential(auth, error.credential);
                        showToast("アカウントを切り替えました", "success");
                    } catch (e: any) {
                        showToast("ログインエラー: " + e.message, "error");
                    }
                } else {
                    // クレデンシャルが取得できない場合のフォールバック（再度ポップアップ）
                    try {
                        await signInWithPopup(auth, provider);
                        showToast("アカウントを切り替えました", "success");
                    } catch (e: any) {
                        // キャンセルされた場合などは静かに無視
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
            // Ensure user is signed in
            const currentUser = await ensureUser();

            const newCircleId = Math.floor(100000 + Math.random() * 900000).toString();
            const batch = writeBatch(db);

            const name = "新しいサークル"; // デフォルト名

            // 1. Circle Doc
            batch.set(getDocRef(PATHS.circle(newCircleId)), {
                circleId: newCircleId,
                createdAt: serverTimestamp(),
                createdBy: currentUser.uid,
                name
            });

            // 2. Admin Member
            batch.set(getDocRef(PATHS.member(newCircleId, currentUser.uid)), {
                uid: currentUser.uid,
                displayName: currentUser.displayName || "管理者", 
                role: "admin",
                joinedAt: serverTimestamp()
            });

            // 3. General Accounting Event (Auto-created)
            batch.set(getDocRef(PATHS.event(newCircleId, 'general')), {
                title: "サークル費（一般会計）",
                feePerPerson: 0,
                createdAt: serverTimestamp(),
                status: 'active'
            });

            // ★追加: ユーザーごとの参加リストにも保存
            batch.set(getDocRef(PATHS.userJoinedCircle(currentUser.uid, newCircleId)), {
                name,
                joinedAt: serverTimestamp()
            });

            await batch.commit();
            setCircleId(newCircleId);
            saveCircleHistory(newCircleId, name); // ★履歴保存
            showToast(`サークル作成完了！ID: ${newCircleId}`, 'success');
        } catch (e: any) {
            showToast("作成失敗: " + e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleJoinCircle = async (inputCircleId: string, inputName: string) => {
        setIsSubmitting(true);
        try {
            const id = inputCircleId.trim();
            if(!id) throw new Error("IDを入力してください");

            let currentUser = auth.currentUser;
            
            const circleRef = getDocRef(PATHS.circle(id));
            
            let snap;
            let retryCount = 0;
            const maxRetries = 2;

            while (retryCount <= maxRetries) {
                try {
                    if (!auth.currentUser || retryCount > 0) {
                        if (auth.currentUser) await signOut(auth);
                        await signInAnonymously(auth);
                        await new Promise(r => setTimeout(r, 1000));
                        currentUser = auth.currentUser;
                    }
                    
                    if (!currentUser) throw new Error("認証に失敗しました。リロードしてください。");

                    snap = await getDoc(circleRef);
                    break;

                } catch (err: any) {
                    console.error(`Join Read Error (Attempt ${retryCount}):`, err);
                    if (err.code === 'permission-denied') {
                        retryCount++;
                        if (retryCount > maxRetries) {
                             throw new Error("アクセス権エラーが解決しません。ブラウザをリロードするか、新しいタブで開いてお試しください。");
                        }
                        showToast(`認証情報を更新中...(${retryCount}/${maxRetries})`, 'info');
                        await new Promise(r => setTimeout(r, 1500));
                    } else {
                        throw err;
                    }
                }
            }

            // ★修正: snapがundefinedの場合も考慮する
            if (!snap || !snap.exists()) throw new Error("サークルが見つかりません");

            const circleData = snap.data();
            saveCircleHistory(id, circleData?.name || "サークル"); // ★履歴保存

            // ★ユーザープロフィール（名前）の更新
            if (currentUser && inputName) {
                try {
                    await updateProfile(currentUser, { displayName: inputName });
                } catch (e) {
                    console.error("Profile update failed", e);
                }
            }

            // 3. Add as Member if not exists
            if (currentUser) {
                const memberRef = getDocRef(PATHS.member(id, currentUser.uid));
                const memSnap = await getDoc(memberRef);
                if (!memSnap.exists()) {
                    await setDoc(memberRef, {
                        uid: currentUser.uid,
                        // ★入力された名前を優先使用
                        displayName: inputName || currentUser.displayName || "メンバー",
                        role: "member",
                        joinedAt: serverTimestamp()
                    });
                }

                // ★追加: ユーザーごとの参加リストにも保存（Firestore）
                await setDoc(getDocRef(PATHS.userJoinedCircle(currentUser.uid, id)), {
                    name: circleData?.name || "サークル",
                    joinedAt: serverTimestamp()
                });
            }
            setCircleId(id);
            showToast("参加しました", 'success');
        } catch (e: any) {
            showToast(e.message, 'error');
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ★追加: サークル名更新機能
    const handleUpdateCircleName = async () => {
        if (!editingName.trim()) return;
        setIsSubmitting(true);
        try {
            const batch = writeBatch(db);
            // 1. サークル情報の更新
            batch.update(getDocRef(PATHS.circle(circleId!)), {
                name: editingName.trim()
            });
            // 2. 自分の参加リストの表示名も更新（自分の分だけ）
            if (user) {
                batch.update(getDocRef(PATHS.userJoinedCircle(user.uid, circleId!)), {
                    name: editingName.trim()
                });
            }
            await batch.commit();
            setIsEditingName(false);
            showToast("サークル名を変更しました", 'success');
        } catch (e: any) {
            showToast("変更失敗: " + e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const createEvent = async (e: any) => {
        e.preventDefault();
        if (myRole !== 'admin') return;
        const title = e.target.title.value;
        const fee = parseInt(e.target.feePerPerson.value);
        
        setIsSubmitting(true);
        try {
            await addDoc(getCol(PATHS.events(circleId!)), {
                title, feePerPerson: fee, createdAt: serverTimestamp(), status: 'active'
            });
            setShowAddEvent(false);
            showToast("イベントを作成しました", 'success');
        } catch (e: any) { showToast(e.message, 'error'); } 
        finally { setIsSubmitting(false); }
    };

    const addTransaction = async (e: any) => {
        e.preventDefault();
        if (!currentEventId || !user) return;
        
        const form = e.target;
        const amountVal = form.amount.value;
        const desc = form.description.value;
        
        if (currentEventId === 'general' && myRole !== 'admin') {
            showToast("管理者権限がありません", 'error');
            return;
        }

        if (!amountVal || !desc) { showToast("金額と内容を入力してください", 'error'); return; }
        const amount = parseInt(amountVal);
        const cat = form.category?.value || 'other';
        
        let type = form.type?.value || 'expense';
        if (transactionModalMode === 'admin_direct') {
            type = 'admin_expense';
        }

        setIsSubmitting(true);
        try {
            let userName = "不明";
            if (myRole === 'guest') {
                userName = "ゲスト"; 
            } else {
                const me = members.find(m => m.uid === user.uid);
                userName = me ? me.displayName : (user.displayName || "メンバー");
            }

            const isAdminDirect = type === 'admin_expense';

            await addDoc(getCol(PATHS.transactions(circleId!, currentEventId)), {
                userId: user.uid,
                userName,
                type,
                description: desc,
                timestamp: serverTimestamp(),
                summary: {
                    totalAmount: amount,
                    primaryCategory: cat,
                    hasReceipt: type === 'expense',
                    isReimbursed: isAdminDirect
                }
            });
            setTransactionModalMode(null);
            showToast("記録しました", 'success');
        } catch(e: any) { showToast(e.message, 'error'); }
        finally { setIsSubmitting(false); }
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
                let userName = "不明";
                if (myRole === 'guest') {
                     const guest = participants.find(p => p.id === user!.uid);
                     userName = guest ? guest.displayName : "ゲスト";
                } else {
                     const me = members.find(m => m.uid === user!.uid);
                     userName = me ? me.displayName : (user!.displayName || "メンバー");
                }

                await addDoc(getCol(PATHS.transactions(circleId!, currentEventId)), {
                    userId: user.uid,
                    userName,
                    type: 'collection',
                    description: '会費',
                    timestamp: serverTimestamp(),
                    summary: {
                        totalAmount: eventFee,
                        primaryCategory: 'other',
                        hasReceipt: false,
                        isReimbursed: false
                    }
                });
                showToast("支払いを記録しました", 'success');
            }
        } catch (e: any) {
            showToast("エラー: " + e.message, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // ★修正: transactionIdの型を string | null に変更
    const toggleMemberPayment = async (targetUid: string, targetName: string, eventFee: number, isPaid: boolean, transactionId: string | null) => {
        if (myRole !== 'admin' || !currentEventId) return;
        try {
            if (isPaid && transactionId) {
                await deleteDoc(getDocRef(PATHS.transaction(circleId!, currentEventId, transactionId)));
                showToast(`${targetName}さんの支払いをキャンセル`, 'info');
            } else {
                await addDoc(getCol(PATHS.transactions(circleId!, currentEventId)), {
                    userId: targetUid,
                    userName: targetName,
                    type: 'collection',
                    description: '会費',
                    timestamp: serverTimestamp(),
                    summary: {
                        totalAmount: eventFee,
                        primaryCategory: 'other',
                        hasReceipt: false,
                        isReimbursed: false
                    }
                });
                showToast(`${targetName}さんを支払い済みにしました`, 'success');
            }
        } catch (e: any) {
            showToast("エラー: " + e.message, 'error');
        }
    };

    const promptSettleEvent = (event: any, balance: number) => {
        if (!user) return;
        setConfirmModal({
            isOpen: true,
            title: "イベントの終了・反映",
            message: (
                <span>
                    イベント「<span className="font-bold">{event.title}</span>」を終了します。<br/><br/>
                    現在の残高: <span className={balance >= 0 ? "font-bold text-green-600" : "font-bold text-red-600"}>
                        {balance >= 0 ? '+' : ''}¥{balance.toLocaleString()}
                    </span><br/>
                    この金額がサークル費（一般会計）に反映され、<br/>
                    イベントは「終了」ステータスになります。<br/><br/>
                    よろしいですか？
                </span>
            ) as any,
            action: async () => {
                const batch = writeBatch(db);
                
                const eventRef = getDocRef(PATHS.event(circleId!, event.id));
                batch.update(eventRef, { 
                    status: 'closed', 
                    settledAmount: balance, 
                    closedAt: serverTimestamp() 
                });

                const generalTransRef = doc(getCol(PATHS.transactions(circleId!, 'general')));
                batch.set(generalTransRef, {
                    userId: user.uid,
                    userName: "システム",
                    type: balance >= 0 ? 'general_income' : 'general_expense',
                    description: `イベント「${event.title}」の精算`,
                    timestamp: serverTimestamp(),
                    summary: {
                        totalAmount: Math.abs(balance),
                        primaryCategory: 'other',
                        hasReceipt: false,
                        isReimbursed: false
                    }
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

    if (loading) return <LoadingScreen />;

    return (
        <ErrorBoundary>
            {/* ★ここから: メインのAppコンポーネントの中身 */}
            {/* 警告バー: アプリ内ブラウザ検知 */}
            {isInAppBrowser && (
                <div className="fixed top-0 left-0 right-0 z-[10000] bg-red-600 text-white p-3 text-center text-xs font-bold shadow-lg animate-in slide-in-from-top-full">
                    <p className="flex items-center justify-center gap-1"><AlertTriangle size={14}/> Googleログイン制限</p>
                    <p className="mt-1">現在のブラウザ（LINE/Instagram等）ではGoogleログインができません。</p>
                    <p className="mt-1">右下のメニュー等から<br/><span className="underline font-bold text-yellow-300">「デフォルトのブラウザで開く（Safari/Chrome）」</span>を選んでください。</p>
                </div>
            )}

            {/* 1. Onboarding (No CircleId) */}
            {!circleId && (
                <>
                    {/* ★DebugResetButton 削除済み */}
                    <OnboardingScreen 
                        onCreate={handleCreateCircle} 
                        onJoin={handleJoinCircle} 
                        isProcessing={isSubmitting} 
                        onGoogleLogin={handleGoogleLogin}
                        user={user}
                    />
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

                // ★追加: 支出履歴用のフィルタ
                const allExpenses = transactions.filter(t => 
                    t.type === 'expense' || 
                    t.type === 'admin_expense' || 
                    t.type === 'general_expense'
                );

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
                        {/* ★DebugResetButton 削除済み */}
                        <div className="bg-white px-6 py-4 shadow-sm sticky top-0 z-10 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <button onClick={() => setCurrentEventId(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full active:scale-95 transition-transform"><ArrowLeft size={20} /></button>
                                <div>
                                    <h1 className="text-lg font-bold truncate max-w-[200px] flex items-center gap-2">
                                        {event.title}
                                        {isClosed && <span className="text-[10px] bg-gray-600 text-white px-1.5 py-0.5 rounded">終了済</span>}
                                    </h1>
                                </div>
                            </div>
                            <button onClick={() => {
                                const url = `${window.location.origin}${window.location.pathname}?circle=${circleId}&event=${currentEventId}`;
                                navigator.clipboard.writeText(url);
                                showToast("イベントURLをコピーしました", 'success');
                            }} className="bg-gray-100 p-2 rounded-full text-gray-600"><Share2 size={18}/></button>
                        </div>

                        <div className="p-4 space-y-6">
                            <section>
                                <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">イベント収支</h3>
                                <div className="bg-gray-800 rounded-2xl p-6 text-white text-center shadow-lg relative overflow-hidden">
                                    <p className="text-gray-400 text-sm mb-1">{isGeneral ? 'サークル残高' : '残高'}</p>
                                    <div className={`text-4xl font-bold mb-2 ${stats.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {stats.balance >= 0 ? '+' : ''} ¥{stats.balance.toLocaleString()}
                                    </div>
                                    <div className="flex justify-center gap-4 text-xs text-gray-400 mb-4">
                                        <span>収入: ¥{stats.income.toLocaleString()}</span>
                                        <span>支出: ¥{stats.expense.toLocaleString()}</span>
                                    </div>
                                    {isAdmin && (
                                        <div className="mt-4 border-t border-white/10 pt-4">
                                            {!isGeneral ? (
                                                !isClosed ? (
                                                    <button 
                                                        onClick={() => {
                                                            promptSettleEvent(event, stats.balance);
                                                        }}
                                                        className="w-full bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg font-bold text-sm transition-all border border-white/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                                                    >
                                                        <Lock size={14} /> サークル費へ反映して終了
                                                    </button>
                                                ) : (
                                                    <div className="w-full bg-gray-700/50 text-gray-400 py-2 rounded-lg font-bold text-sm border border-gray-600 flex items-center justify-center gap-2 cursor-not-allowed">
                                                        <Check size={14} /> 反映・終了済み
                                                    </div>
                                                )
                                            ) : (
                                                <div className="text-xs text-center text-gray-500">
                                                    ※サークル費自体の反映操作は不要です
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none"><Wallet size={120} /></div>
                                </div>
                            </section>

                            {isAdmin && !isGeneral && !isClosed && (
                                <section>
                                    <button onClick={() => setTransactionModalMode('admin_direct')} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 active:scale-95 flex flex-col items-center gap-1 hover:bg-indigo-700 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <Wallet size={20} />
                                            <span>管理者の支出 (ホリエモン)</span>
                                        </div>
                                        <span className="text-[10px] opacity-80 font-normal">※サークル費から直接支払う場合</span>
                                    </button>
                                </section>
                            )}

                            {!isGeneral && (
                                <section>
                                    <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">集金状況</h3>
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                        <div className="p-5 border-b border-gray-100">
                                            <div className="flex justify-between items-center mb-4">
                                                <div>
                                                    <p className="text-xs text-gray-400">会費</p>
                                                    <p className="text-xl font-bold text-gray-800">¥{event.feePerPerson.toLocaleString()}</p>
                                                </div>
                                                <button 
                                                    onClick={() => toggleMyPayment(event.feePerPerson)}
                                                    disabled={isSubmitting || isClosed}
                                                    className={`px-6 py-3 rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center gap-2 ${hasPaid ? 'bg-green-500 text-white shadow-green-200' : 'bg-white border-2 border-indigo-600 text-indigo-600'} ${isClosed ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {hasPaid ? <><Check size={20}/> 支払い済み</> : '支払った'}
                                                </button>
                                            </div>
                                            <div className="text-xs text-center text-gray-400">
                                                ボタンを押すと「支払い済み」になります
                                            </div>
                                        </div>
                                        
                                        <div className="bg-gray-50/50">
                                            <button 
                                                onClick={() => setIsParticipantListOpen(!isParticipantListOpen)}
                                                className="w-full p-3 text-center text-xs font-bold text-gray-500 flex items-center justify-center gap-1 hover:bg-gray-100 transition-colors"
                                            >
                                                {isParticipantListOpen ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                                みんなの状況 ({paymentStatusList.filter(p => p.paid).length}/{paymentStatusList.length} 済)
                                            </button>
                                            
                                            {isParticipantListOpen && (
                                                <div className="max-h-[200px] overflow-y-auto border-t border-gray-100">
                                                    {paymentStatusList.map((p, idx) => (
                                                        <div key={idx} className="p-3 border-b border-gray-100 flex items-center justify-between px-5 last:border-0">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${p.paid ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                                                    {p.displayName.charAt(0)}
                                                                </div>
                                                                <span className={`text-sm ${p.uid === user?.uid ? 'font-bold' : ''}`}>{p.displayName}</span>
                                                            </div>
                                                            {p.paid ? (
                                                                isAdmin && !isClosed ? (
                                                                    <button onClick={() => toggleMemberPayment(p.uid, p.displayName, event.feePerPerson, true, p.transactionId)} className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold hover:bg-green-200">済 (解除)</button>
                                                                ) : (
                                                                    <span className="text-[10px] bg-green-100 text-green-600 px-2 py-0.5 rounded font-bold">済</span>
                                                                )
                                                            ) : (
                                                                isAdmin && !isClosed ? (
                                                                    <button onClick={() => toggleMemberPayment(p.uid, p.displayName, event.feePerPerson, false, null)} className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded hover:bg-indigo-100 hover:text-indigo-600">未払い</button>
                                                                ) : (
                                                                    <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded">未</span>
                                                                )
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </section>
                            )}

                            <section>
                                <div className="flex justify-between items-end mb-2 ml-1">
                                    <h3 className="text-xs font-bold text-gray-500">立て替えリスト</h3>
                                </div>
                                <div className="bg-white rounded-2xl shadow-sm border border-indigo-100 overflow-hidden">
                                    {(!isGeneral || isAdmin) && !isClosed && (
                                        <div className="p-4 bg-indigo-50/50 border-b border-indigo-50">
                                            <button 
                                                onClick={() => setTransactionModalMode('regular')} 
                                                className="w-full py-3 bg-white border border-indigo-100 text-indigo-600 hover:bg-indigo-50 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer active:scale-95 shadow-sm"
                                            >
                                                <Plus size={18} /> 
                                                {isGeneral ? '入出金を記録' : '立て替えを追加'}
                                            </button>
                                            {!isGeneral && (
                                                <p className="text-[10px] text-center text-gray-400 mt-2">
                                                    ※管理者も個人で立て替えた場合はここから追加してください
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <div className="max-h-[300px] overflow-y-auto">
                                        {unreimbursedExpenses.length > 0 ? (
                                            <div className="divide-y divide-gray-50">
                                                {unreimbursedExpenses.map(t => (
                                                    <div key={t.id} className="p-4 flex justify-between items-center bg-white">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-gray-800">{t.description}</span>
                                                                {t.summary.primaryCategory && CATEGORIES[t.summary.primaryCategory] && <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{backgroundColor: CATEGORIES[t.summary.primaryCategory].color}}>{CATEGORIES[t.summary.primaryCategory].label}</span>}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                <span className="font-bold text-indigo-600">{t.userName}</span> が立替
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-bold text-gray-800">¥{t.summary.totalAmount.toLocaleString()}</span>
                                                            {isAdmin && !isClosed && (
                                                                <button onClick={() => {
                                                                    setConfirmModal({
                                                                        isOpen: true, title: "返金の完了確認",
                                                                        message: (<span><span className="font-bold">{t.userName}</span> さんへの<br/><span className="text-xl font-bold text-indigo-600">¥{t.summary.totalAmount.toLocaleString()}</span> の返金を完了しますか？<br/><span className="text-xs text-gray-400">※サークル費（現金など）から手渡した後に押してください</span></span>) as any,
                                                                        action: async () => {
                                                                            const ref = getDocRef(PATHS.transaction(circleId!, currentEventId, t.id));
                                                                            await updateDoc(ref, { "summary.isReimbursed": true });
                                                                        }
                                                                    });
                                                                }} className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold hover:bg-indigo-200">精算</button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-6 text-center text-xs text-gray-400">未精算の立て替えはありません</div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* ★追加: 5. 支出履歴 (All Expenses History) */}
                            <section>
                                <h3 className="text-xs font-bold text-gray-500 mb-2 ml-1">支出の履歴</h3>
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    {allExpenses.length > 0 ? (
                                        <div className="divide-y divide-gray-50">
                                            {allExpenses.map(t => (
                                                <div key={t.id} className="p-4 flex justify-between items-center">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-gray-800">{t.description}</span>
                                                            {t.summary.primaryCategory && CATEGORIES[t.summary.primaryCategory] && (
                                                                <span className="text-[10px] px-1.5 py-0.5 rounded text-white" style={{backgroundColor: CATEGORIES[t.summary.primaryCategory].color}}>
                                                                    {CATEGORIES[t.summary.primaryCategory].label}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 flex gap-2">
                                                            <span>{safeFormatDate(t.timestamp)}</span>
                                                            <span>•</span>
                                                            <span>{t.userName}</span>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-bold text-gray-800 block">¥{t.summary.totalAmount.toLocaleString()}</span>
                                                        {t.summary.isReimbursed && <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">精算済</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-xs text-gray-400">まだ支出はありません</div>
                                    )}
                                </div>
                            </section>
                        </div>

                        {transactionModalMode && (
                            <div className="fixed inset-0 bg-black/60 z-[5000] flex items-end sm:items-center justify-center sm:p-4">
                                <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-6 animate-in slide-in-from-bottom-10">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        {transactionModalMode === 'admin_direct' ? (
                                            <><Wallet className="text-indigo-600"/> 管理者の支出 (ホリエモン)</>
                                        ) : (
                                            '記録を追加'
                                        )}
                                    </h2>
                                    <form onSubmit={addTransaction} className="space-y-4">
                                        {transactionModalMode === 'admin_direct' && (
                                            <div className="bg-indigo-50 p-3 rounded-lg text-xs text-indigo-700 mb-4">
                                                <strong>※サークル費からの直接支払いです</strong><br/>
                                                誰かの立て替えではなく、サークルの資金から管理者が支払った場合に記録します（精算不要）。
                                            </div>
                                        )}
                                        {transactionModalMode === 'regular' && (
                                            isGeneral ? (
                                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                                    <label className="flex-1 cursor-pointer"><input type="radio" name="type" value="general_income" defaultChecked className="peer sr-only"/><div className="text-center py-2 text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-green-600 peer-checked:shadow-sm rounded">収入</div></label>
                                                    <label className="flex-1 cursor-pointer"><input type="radio" name="type" value="general_expense" className="peer sr-only"/><div className="text-center py-2 text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-red-600 peer-checked:shadow-sm rounded">支出</div></label>
                                                </div>
                                            ) : (
                                                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                                                    <label className="flex-1 cursor-pointer"><input type="radio" name="type" value="expense" defaultChecked className="peer sr-only"/><div className="text-center py-2 text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-red-600 peer-checked:shadow-sm rounded">立替払い</div></label>
                                                    {isAdmin && <label className="flex-1 cursor-pointer"><input type="radio" name="type" value="collection" className="peer sr-only"/><div className="text-center py-2 text-sm font-bold text-gray-500 peer-checked:bg-white peer-checked:text-green-600 peer-checked:shadow-sm rounded">集金</div></label>}
                                                </div>
                                            )
                                        )}
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">金額</label><input name="amount" type="number" className="w-full border rounded-xl p-3 text-lg font-bold" required /></div>
                                        <div><label className="block text-xs font-bold text-gray-500 mb-1">内容</label><input name="description" className="w-full border rounded-xl p-3" placeholder={isGeneral ? "例: 部費繰越" : "例: ホテル代、タクシー代"} required /></div>
                                        {!isGeneral && <div><label className="block text-xs font-bold text-gray-500 mb-1">カテゴリ</label><select name="category" className="w-full border rounded-xl p-3 bg-white">{Object.entries(CATEGORIES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}</select></div>}
                                        <button type="submit" disabled={isSubmitting} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold active:scale-95">{isSubmitting ? <Loader2 className="animate-spin"/> : '追加'}</button>
                                        <button type="button" onClick={() => setTransactionModalMode(null)} className="w-full py-3 text-gray-500 font-bold">キャンセル</button>
                                    </form>
                                </div>
                            </div>
                        )}
                        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                        <ConfirmModal 
                            isOpen={confirmModal.isOpen} 
                            title={confirmModal.title} 
                            message={confirmModal.message} 
                            onConfirm={executeConfirmAction} 
                            onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} 
                            isProcessing={isProcessingAction}
                        />
                    </div>
                );
            })()}

            {/* 3. Circle Dashboard (Default) */}
            {circleId && !currentEventId && (
                <div className="min-h-screen bg-slate-50 pb-20">
                    {/* ★DebugResetButton 削除済み */}
                    <header className="bg-white px-6 py-6 shadow-sm sticky top-0 z-10">
                        <div className="flex justify-between items-center mb-4 relative z-20">
                            <div className="flex-1 min-w-0 mr-2">
                                {/* ★修正: サークル名編集モード */}
                                {isEditingName ? (
                                    <div className="flex items-center gap-2">
                                        <input 
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            className="text-xl font-bold text-gray-800 border-b-2 border-indigo-600 outline-none bg-transparent w-full"
                                            autoFocus
                                        />
                                        <button onClick={handleUpdateCircleName} disabled={isSubmitting} className="p-1 bg-indigo-100 text-indigo-600 rounded"><Check size={18}/></button>
                                        <button onClick={() => setIsEditingName(false)} className="p-1 bg-gray-100 text-gray-500 rounded"><X size={18}/></button>
                                    </div>
                                ) : (
                                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                        <Users size={24} className="text-indigo-600 flex-shrink-0"/>
                                        <span className="truncate">{circleInfo?.name || '読み込み中...'}</span>
                                        {myRole === 'admin' && (
                                            <button 
                                                onClick={() => { setEditingName(circleInfo?.name || ''); setIsEditingName(true); }} 
                                                className="text-gray-400 hover:text-indigo-600 flex-shrink-0"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                        )}
                                    </h1>
                                )}
                                <div className="text-xs text-gray-400 mt-1 font-mono">ID: {circleId}</div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                <span className={`text-[10px] px-2 py-1 rounded font-bold ${myRole === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>{myRole === 'admin' ? '管理者' : 'メンバー'}</span>
                                <button onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?circle=${circleId}`);
                                    showToast("サークルURLをコピーしました", 'success');
                                }} className="bg-gray-100 p-2 rounded-full"><Share2 size={16}/></button>
                                {/* ★修正: ログアウトボタンを「ホーム（サークル退出）」に変更 */}
                                <button onClick={() => { 
                                    setCircleId(null); 
                                    setCurrentEventId(null);
                                    window.history.pushState({}, '', window.location.pathname);
                                    showToast("サークル選択画面に戻りました", 'info');
                                }} className="bg-gray-100 p-2 rounded-full"><Home size={16}/></button>
                            </div>
                        </div>
                        
                        <div onClick={() => setCurrentEventId('general')} className="bg-gradient-to-r from-gray-800 to-gray-700 rounded-2xl p-4 text-white shadow-lg relative overflow-hidden cursor-pointer active:scale-95 transition-transform">
                            <div className="relative z-10 flex justify-between items-center">
                                <div>
                                    <p className="text-gray-400 text-xs font-bold mb-1"><Banknote size={12} className="inline mr-1"/>サークル費 (一般会計)</p>
                                    <p className="text-sm font-bold text-gray-300">入出金を管理 &rarr;</p>
                                </div>
                                <div className="bg-white/10 p-2 rounded-full"><ChevronRight className="text-white"/></div>
                            </div>
                        </div>
                    </header>

                    <div className="p-6">
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

                    {showAddEvent && (
                        <div className="fixed inset-0 bg-black/60 z-[5000] flex items-center justify-center p-4">
                            <div className="bg-white rounded-2xl w-full max-w-sm p-6">
                                <h2 className="text-xl font-bold mb-4">新規イベント作成</h2>
                                <form onSubmit={createEvent} className="space-y-4">
                                    <div><label className="block text-sm font-medium text-gray-700">イベント名</label><input name="title" className="w-full border rounded-lg p-2" required /></div>
                                    <div><label className="block text-sm font-medium text-gray-700">会費 (1人あたり)</label><input name="feePerPerson" type="number" className="w-full border rounded-lg p-2" required /></div>
                                    <div className="flex gap-2 pt-2">
                                        <button type="button" onClick={() => setShowAddEvent(false)} disabled={isSubmitting} className="flex-1 py-2 text-gray-500 disabled:opacity-50 active:scale-95">キャンセル</button>
                                        <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg font-bold disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95">{isSubmitting && <Loader2 className="animate-spin h-4 w-4"/>} 作成</button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
                    <ConfirmModal 
                        isOpen={confirmModal.isOpen} 
                        title={confirmModal.title} 
                        message={confirmModal.message} 
                        onConfirm={executeConfirmAction} 
                        onCancel={() => setConfirmModal({...confirmModal, isOpen: false})} 
                        isProcessing={isProcessingAction}
                    />
                </div>
            )}
        </ErrorBoundary>
    );
}
