/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import { 
  Users, 
  UserPlus, 
  Settings, 
  TrendingUp, 
  Lock, 
  Unlock, 
  Trash2, 
  ChevronRight, 
  ArrowLeft,
  Wallet,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  Plus,
  RefreshCw,
  Settings2,
  X,
  User as UserIcon,
  Gamepad2,
  Ban,
  Coins,
  Dice5,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface User {
  user_id: number;
  username: string | null;
  full_name: string | null;
  referrer_id: number | null;
  balance: number;
  luck: 'win' | 'lose' | 'default';
  is_kyc: boolean;
  trading_blocked: boolean;
  withdraw_blocked: boolean;
  withdraw_message_type: string | null;
  worker_min_deposit: number;
  is_worker: boolean;
  created_at: string;
  photo_url?: string | null;
}

interface WithdrawTemplate {
  message_type: string;
  title: string;
  description: string;
  icon: string;
  button_text: string;
}

interface DepositRequest {
  id: number;
  user_id: number;
  worker_id: number;
  amount_local: number;
  amount_usd: number;
  currency: string;
  method: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  user?: {
    username: string | null;
    full_name: string | null;
  };
}

// --- Components ---

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const Card: React.FC<CardProps> = ({ children, className, onClick }) => (
  <div 
    onClick={onClick}
    className={cn(
      "bg-surface border border-edge rounded-2xl p-4 transition-all active:scale-[0.98] shadow-sm",
      onClick && "cursor-pointer hover:bg-surface-hover",
      className
    )}
  >
    {children}
  </div>
);

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'success' | 'danger' | 'warning' }) => {
  const variants = {
    default: "bg-elevated text-muted",
    success: "bg-green-500/10 text-green-400",
    danger: "bg-red-500/10 text-red-400",
    warning: "bg-amber-500/10 text-amber-400",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", variants[variant])}>
      {children}
    </span>
  );
};

const Toggle = ({ enabled, onChange, label, loading }: { enabled: boolean; onChange: (val: boolean) => void; label: string; loading?: boolean }) => (
  <div className="flex items-center justify-between py-4 border-b border-edge last:border-0">
    <div className="flex flex-col">
      <span className="text-[15px] font-semibold text-ink">{label}</span>
    </div>
    <button
      disabled={loading}
      onClick={() => {
        console.log(`Toggle clicked: ${label}, current state: ${enabled}`);
        onChange(!enabled);
      }}
      className={cn(
        "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 focus:outline-none",
        enabled ? "bg-dim" : "bg-page",
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      <span
        className={cn(
          "inline-block h-6 w-6 transform rounded-full bg-ink shadow-md transition-transform duration-300",
          enabled ? "translate-x-[22px]" : "translate-x-[2px]"
        )}
      >
        {loading && (
          <RefreshCw className="w-3 h-3 text-dim animate-spin absolute inset-0 m-auto" />
        )}
      </span>
    </button>
  </div>
);

// --- Main App ---

export default function App() {
  const [worker, setWorker] = useState<User | null>(null);
  const [mammoths, setMammoths] = useState<User[]>([]);
  const [templates, setTemplates] = useState<WithdrawTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'mammoths' | 'settings'>('dashboard');
  const [selectedMammoth, setSelectedMammoth] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingField, setIsUpdatingField] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showKeypad, setShowKeypad] = useState<{ active: boolean; value: string; onConfirm: (val: string) => void; title: string }>({
    active: false,
    value: '',
    onConfirm: () => {},
    title: ''
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    // @ts-ignore
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred(type === 'success' ? 'success' : 'error');
    setTimeout(() => setToast(null), 3000);
  };

  const [manualWorkerId, setManualWorkerId] = useState<number | null>(() => {
    const saved = localStorage.getItem('worker_id');
    return saved ? Number(saved) : null;
  });

  const currentWorkerId = useMemo(() => {
    // @ts-ignore
    const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
    return tgId || manualWorkerId;
  }, [manualWorkerId]);

  useEffect(() => {
    // @ts-ignore
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setHeaderColor('#0c0c0e');
      tg.setBackgroundColor('#0c0c0e');
      tg.enableClosingConfirmation();
      
      // Update worker photo if available from TG
      const user = tg.initDataUnsafe?.user;
      if (user?.photo_url && worker && !worker.photo_url) {
        handleUpdateSelf('photo_url', user.photo_url);
      }
    }
  }, [worker]);

  useEffect(() => {
    if (currentWorkerId) {
      fetchInitialData();
      
      // Realtime subscription
      const channel = supabase
        .channel('mammoths-changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'users',
            filter: `referrer_id=eq.${currentWorkerId}`
          },
          (payload) => {
            console.log('Realtime update:', payload);
            fetchInitialData();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } else {
      setLoading(false);
    }
  }, [currentWorkerId]);

  const handleLogin = (id: string) => {
    const numId = Number(id);
    if (!numId) return;
    localStorage.setItem('worker_id', id);
    setManualWorkerId(numId);
  };

  const fetchInitialData = async () => {
    if (!isSupabaseConfigured || !currentWorkerId) {
      setLoading(false);
      return;
    }
    try {
      // 1. Get/Update Worker
      const { data: workerData, error: workerError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', currentWorkerId)
        .single();

      if (workerError && workerError.code !== 'PGRST116') throw workerError;

      if (!workerData) {
        const { data: newWorker } = await supabase
          .from('users')
          .insert([{ user_id: currentWorkerId, is_worker: true, username: 'Worker' }])
          .select()
          .single();
        setWorker(newWorker);
      } else {
        if (!workerData.is_worker) {
          await supabase.from('users').update({ is_worker: true }).eq('user_id', currentWorkerId);
        }
        setWorker(workerData);
      }

      // 2. Load Mammoths
      const { data: mammothData } = await supabase
        .from('users')
        .select('*')
        .eq('referrer_id', currentWorkerId)
        .order('created_at', { ascending: false });
      setMammoths(mammothData || []);

      // 3. Load Templates
      const { data: templateData } = await supabase
        .from('withdraw_message_templates')
        .select('*');
      setTemplates(templateData || []);

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openKeypad = (title: string, initialValue: string, onConfirm: (val: string) => void) => {
    // @ts-ignore
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    setShowKeypad({ active: true, title, value: initialValue, onConfirm });
  };

  const updateMammothField = async (id: number, field: keyof User, value: any) => {
    const fieldKey = `${id}-${field}`;
    console.log(`Updating field: ${fieldKey} to ${value}`);
    setIsUpdatingField(fieldKey);
    // @ts-ignore
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: value })
        .eq('user_id', id);
      
      if (error) throw error;
      
      setMammoths(prev => prev.map(m => m.user_id === id ? { ...m, [field]: value } : m));
      if (selectedMammoth?.user_id === id) {
        setSelectedMammoth(prev => prev ? { ...prev, [field]: value } : null);
      }
      showToast('Обновлено');
    } catch (err) {
      console.error('Update error:', err);
      showToast('Ошибка обновления', 'error');
    } finally {
      setIsUpdatingField(null);
    }
  };

  const handleAddMammoth = async () => {
    const input = addInput.trim();
    if (!input) return;
    setIsAdding(true);
    // @ts-ignore
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('medium');
    try {
      let query = supabase.from('users').select('*');
      const isId = !isNaN(Number(input)) && !input.startsWith('@');
      
      if (isId) {
        query = query.eq('user_id', Number(input));
      } else {
        const username = input.startsWith('@') ? input.slice(1) : input;
        query = query.ilike('username', username);
      }

      const { data, error } = await query.maybeSingle();
      
      if (error) throw error;
      
      if (!data) {
        showToast('Пользователь не найден', 'error');
        return;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ referrer_id: currentWorkerId })
        .eq('user_id', data.user_id);

      if (updateError) throw updateError;
      
      showToast('Мамонт успешно добавлен!');
      setAddInput('');
      setShowAddModal(false);
      fetchInitialData();
    } catch (err) {
      console.error(err);
      showToast('Ошибка при добавлении', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUnassignMammoth = async (id: number) => {
    if (!confirm('Вы уверены, что хотите отвязать этого мамонта?')) return;
    try {
      await supabase.from('users').update({ referrer_id: null }).eq('user_id', id);
      setMammoths(prev => prev.filter(m => m.user_id !== id));
      setSelectedMammoth(null);
      showToast('Мамонт отвязан');
    } catch (err) {
      showToast('Ошибка', 'error');
    }
  };

  const handleUpdateSelf = async (field: keyof User, value: any) => {
    if (!worker) return;
    const fieldKey = `self-${field}`;
    setIsUpdatingField(fieldKey);
    try {
      await supabase.from('users').update({ [field]: value }).eq('user_id', worker.user_id);
      setWorker({ ...worker, [field]: value });
      showToast('Настройки сохранены');
    } catch (err) {
      showToast('Ошибка', 'error');
    } finally {
      setIsUpdatingField(null);
    }
  };

  const filteredMammoths = mammoths.filter(m => 
    (m.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
     m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
     m.user_id.toString().includes(searchQuery))
  );

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6 text-center">
        <div className="max-w-xs space-y-6">
          <div className="w-16 h-16 bg-elevated border border-edge rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Settings2 className="w-8 h-8 text-muted" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-ink">Конфигурация не найдена</h2>
            <p className="text-sm text-dim font-medium">
              Пожалуйста, добавьте <b>VITE_SUPABASE_URL</b> и <b>VITE_SUPABASE_ANON_KEY</b> в настройки Secrets в AI Studio.
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-elevated border border-edge py-4 rounded-xl text-sm font-black text-ink active:scale-95 transition-transform shadow-lg"
          >
            Проверить снова
          </button>
        </div>
      </div>
    );
  }

  if (!currentWorkerId) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center p-6 text-center">
        <div className="max-w-xs w-full space-y-6">
          <div className="w-16 h-16 bg-elevated border border-edge rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <Users className="w-8 h-8 text-muted" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black tracking-tight text-ink">Вход в панель</h2>
            <p className="text-sm text-dim font-medium">Введите ваш Telegram ID для доступа к управлению мамонтами.</p>
          </div>
          <div className="space-y-3">
            <input 
              type="number" 
              id="loginId"
              placeholder="Ваш Telegram ID"
              className="w-full bg-surface border border-edge rounded-xl py-4 px-4 text-center text-lg font-bold text-ink placeholder:text-dim focus:outline-none focus:border-dim transition-colors shadow-inner"
            />
            <button 
              onClick={() => handleLogin((document.getElementById('loginId') as HTMLInputElement).value)}
              className="w-full bg-ink text-page py-4 rounded-xl text-sm font-black active:scale-95 transition-transform shadow-lg"
            >
              Войти
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-8 h-8 text-muted animate-spin" />
          <span className="text-dim text-sm font-bold animate-pulse uppercase tracking-widest">Загрузка...</span>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-page text-ink font-sans selection:bg-elevated">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/95 backdrop-blur-md border-b border-edge px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-elevated border border-edge overflow-hidden flex items-center justify-center shadow-md flex-shrink-0">
            {worker?.photo_url ? (
              <img src={worker.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-ink font-bold text-sm">{worker?.username?.[0]?.toUpperCase() || 'W'}</span>
            )}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none tracking-tight text-ink">PANEL</h1>
            <p className="text-[10px] text-dim font-semibold uppercase tracking-widest mt-0.5">Management</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => { setIsRefreshing(true); fetchInitialData().finally(() => setIsRefreshing(false)); }}
            className={cn("w-10 h-10 rounded-xl bg-elevated border border-edge flex items-center justify-center text-ink active:scale-95 transition-all", isRefreshing && "animate-spin")}
          >
            <RefreshCw className="w-4 h-4 text-muted" />
          </button>
        </div>
      </header>

      <main className="pb-24 px-4 pt-6 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 gap-4">
                <Card className="flex flex-col gap-2 bg-elevated border-edge">
                  <Users className="w-5 h-5 text-muted" />
                  <span className="text-2xl font-black tracking-tighter text-ink">{mammoths.length}</span>
                  <span className="text-[10px] text-dim font-bold uppercase tracking-wider">Мамонтов</span>
                </Card>
                <Card className="flex flex-col gap-2 bg-elevated border-edge">
                  <Wallet className="w-5 h-5 text-muted" />
                  <span className="text-2xl font-black tracking-tighter text-ink">{worker?.balance.toLocaleString()} ₽</span>
                  <span className="text-[10px] text-dim font-bold uppercase tracking-wider">Баланс</span>
                </Card>
              </div>

              <section>
                <h2 className="text-[11px] font-bold text-dim uppercase tracking-widest mb-3 px-1">Быстрые действия</h2>
                <div className="grid grid-cols-2 gap-3">
                  <Card onClick={() => setActiveTab('mammoths')} className="flex flex-col items-center gap-3 py-8 bg-surface border-edge">
                    <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center shadow-inner">
                      <Users className="w-6 h-6 text-muted" />
                    </div>
                    <span className="text-sm font-bold text-ink">Мамонты</span>
                  </Card>
                  <Card onClick={() => setShowAddModal(true)} className="flex flex-col items-center gap-3 py-8 bg-surface border-edge">
                    <div className="w-12 h-12 rounded-2xl bg-elevated flex items-center justify-center shadow-inner">
                      <UserPlus className="w-6 h-6 text-muted" />
                    </div>
                    <span className="text-sm font-bold text-ink">Добавить</span>
                  </Card>
                </div>
              </section>
            </motion.div>
          )}

          {activeTab === 'mammoths' && (
            <motion.div 
              key="mammoths"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dim" />
                <input 
                  type="text" 
                  placeholder="Поиск мамонта..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-surface border border-edge rounded-xl py-4 pl-10 pr-4 text-sm font-medium text-ink placeholder:text-dim focus:outline-none focus:border-dim transition-all shadow-inner"
                />
              </div>

              <div className="space-y-2">
                {filteredMammoths.map(m => (
                  <Card 
                    key={m.user_id} 
                    onClick={() => setSelectedMammoth(m)}
                    className="flex items-center justify-between group py-4 border-edge"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-page border border-edge flex items-center justify-center text-muted font-bold text-lg shadow-inner">
                        {m.username?.[0]?.toUpperCase() || 'M'}
                      </div>
                      <div>
                        <p className="font-bold text-[15px] text-ink">{m.full_name || m.username || 'Без имени'}</p>
                        <p className="text-xs text-dim font-medium">{m.balance.toLocaleString()} ₽</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.withdraw_blocked && <Badge variant="danger">Блок</Badge>}
                      <ChevronRight className="w-5 h-5 text-edge group-hover:text-muted transition-colors" />
                    </div>
                  </Card>
                ))}
                {filteredMammoths.length === 0 && (
                  <div className="text-center py-20">
                    <div className="w-20 h-20 bg-elevated rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-edge">
                      <Users className="w-10 h-10 text-edge" />
                    </div>
                    <p className="text-dim text-sm font-medium">Мамонты не найдены</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <section>
                <h2 className="text-[11px] font-bold text-dim uppercase tracking-widest mb-3 px-1">Мой профиль</h2>
                <Card className="bg-elevated border-edge">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-page border border-edge overflow-hidden flex items-center justify-center text-2xl text-muted font-bold shadow-inner">
                      {worker?.photo_url ? (
                        <img src={worker.photo_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        worker?.username?.[0]?.toUpperCase() || 'W'
                      )}
                    </div>
                    <div>
                      <p className="text-lg font-black tracking-tight text-ink">{worker?.full_name || worker?.username || 'Worker'}</p>
                      <p className="text-sm text-dim font-bold">ID: {worker?.user_id}</p>
                    </div>
                  </div>
                </Card>
              </section>

              <section>
                <h2 className="text-[11px] font-bold text-dim uppercase tracking-widest mb-3 px-1">Управление собой</h2>
                <Card className="divide-y divide-edge bg-elevated border-edge">
                  <div className="py-4 space-y-2">
                    <label className="text-[13px] font-semibold text-dim ml-1">Мой баланс (₽)</label>
                    <button 
                      onClick={() => openKeypad('Мой баланс', (worker?.balance || 0).toString(), (val) => handleUpdateSelf('balance', Number(val)))}
                      className="w-full bg-surface border border-edge rounded-xl py-4 px-4 text-sm font-bold text-ink text-left flex items-center justify-between shadow-inner"
                    >
                      <span>{worker?.balance.toLocaleString()} ₽</span>
                      <ChevronRight className="w-4 h-4 text-edge" />
                    </button>
                  </div>
                  <div className="py-4 space-y-2">
                    <label className="text-[13px] font-semibold text-dim ml-1">Мин. депозит (₽)</label>
                    <button 
                      onClick={() => openKeypad('Мин. депозит', (worker?.worker_min_deposit || 0).toString(), (val) => handleUpdateSelf('worker_min_deposit', Number(val)))}
                      className="w-full bg-surface border border-edge rounded-xl py-4 px-4 text-sm font-bold text-ink text-left flex items-center justify-between shadow-inner"
                    >
                      <span>{worker?.worker_min_deposit.toLocaleString()} ₽</span>
                      <ChevronRight className="w-4 h-4 text-edge" />
                    </button>
                  </div>
                  <Toggle 
                    label="Моя верификация" 
                    enabled={worker?.is_kyc || false} 
                    loading={isUpdatingField === 'self-is_kyc'}
                    onChange={(val) => handleUpdateSelf('is_kyc', val)} 
                  />
                  <div className="py-4 space-y-3">
                    <label className="text-[13px] font-semibold text-dim ml-1">Моя удача</label>
                    <div className="grid grid-cols-3 gap-2">
                      {['win', 'lose', 'default'].map((luck) => (
                        <button
                          key={luck}
                          onClick={() => handleUpdateSelf('luck', luck)}
                          className={cn(
                            "py-3 rounded-xl text-xs font-bold border transition-all active:scale-95",
                            worker?.luck === luck 
                              ? "bg-dim border-muted text-ink shadow-lg shadow-black/40" 
                              : "bg-surface border-edge text-dim"
                          )}
                        >
                          {luck === 'win' ? 'ВИН' : luck === 'lose' ? 'ЛУЗ' : 'РАНДОМ'}
                        </button>
                      ))}
                    </div>
                  </div>
                </Card>
              </section>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mammoth Detail Overlay */}
        <AnimatePresence>
          {selectedMammoth && (
            <motion.div 
              key="mammoth-detail"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-0 z-50 bg-page flex flex-col"
            >
              <header className="bg-surface/80 backdrop-blur-xl border-b border-edge-soft px-4 py-4 flex items-center justify-between">
                <button 
                  onClick={() => setSelectedMammoth(null)}
                  className="w-10 h-10 rounded-xl bg-elevated border border-edge flex items-center justify-center active:scale-90 transition-transform shadow-inner text-ink"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="text-center">
                  <h2 className="text-[15px] font-black leading-none tracking-tight text-ink">{selectedMammoth.full_name || selectedMammoth.username || 'Клиент'}</h2>
                  <p className="text-[10px] text-dim font-bold mt-1 uppercase tracking-wider">ID: {selectedMammoth.user_id}</p>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMammoth.user_id.toString());
                    showToast('ID скопирован');
                  }}
                  className="w-10 h-10 rounded-xl bg-elevated border border-edge flex items-center justify-center active:scale-90 transition-transform shadow-inner"
                  title="Копировать ID"
                  aria-label="Копировать ID"
                >
                  <Copy className="w-4 h-4 text-muted" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto px-4 py-8 space-y-8 pb-32">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-28 h-28 rounded-[2.5rem] bg-surface border border-edge flex items-center justify-center text-4xl text-muted font-bold shadow-2xl shadow-black/60">
                    {selectedMammoth.username?.[0]?.toUpperCase() || <UserIcon className="w-12 h-12" />}
                  </div>
                  <div className="text-center">
                    <p className="text-4xl font-black tracking-tighter text-ink">{selectedMammoth.balance.toLocaleString()} ₽</p>
                    <p className="text-[11px] text-dim font-bold uppercase tracking-[0.3em] mt-2">Баланс клиента</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <section>
                    <h3 className="text-[11px] font-bold text-dim uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                      <Coins className="w-3 h-3" /> Финансы и Удача
                    </h3>
                    <Card className="space-y-6 bg-elevated border-edge">
                      <div className="space-y-2">
                        <label className="text-[13px] font-semibold text-dim ml-1">Изменить баланс</label>
                        <button 
                          onClick={() => openKeypad('Баланс мамонта', selectedMammoth.balance.toString(), (val) => updateMammothField(selectedMammoth.user_id, 'balance', Number(val)))}
                          className="w-full bg-surface border border-edge rounded-xl py-4 px-4 text-sm font-bold text-ink text-left flex items-center justify-between shadow-inner"
                        >
                          <span>{selectedMammoth.balance.toLocaleString()} ₽</span>
                          <ChevronRight className="w-4 h-4 text-edge" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[13px] font-semibold text-dim ml-1">Режим удачи</label>
                        <div className="grid grid-cols-3 gap-2">
                          {['win', 'lose', 'default'].map((luck) => (
                            <button
                              key={luck}
                              onClick={() => updateMammothField(selectedMammoth.user_id, 'luck', luck)}
                              className={cn(
                                "py-3 rounded-xl text-xs font-bold border transition-all active:scale-95",
                                selectedMammoth.luck === luck 
                                  ? "bg-dim border-muted text-ink shadow-lg shadow-black/40" 
                                  : "bg-surface border-edge text-dim"
                              )}
                            >
                              {luck === 'win' ? 'ВИН' : luck === 'lose' ? 'ЛУЗ' : 'РАНДОМ'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </section>

                  <section>
                    <h3 className="text-[11px] font-bold text-dim uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                      <Ban className="w-3 h-3" /> Ограничения
                    </h3>
                    <Card className="divide-y divide-edge bg-elevated border-edge">
                      <Toggle 
                        label="Верификация (KYC)" 
                        enabled={selectedMammoth.is_kyc} 
                        loading={isUpdatingField === `${selectedMammoth.user_id}-is_kyc`}
                        onChange={(val) => updateMammothField(selectedMammoth.user_id, 'is_kyc', val)} 
                      />
                      <Toggle 
                        label="Блок торговли" 
                        enabled={selectedMammoth.trading_blocked} 
                        loading={isUpdatingField === `${selectedMammoth.user_id}-trading_blocked`}
                        onChange={(val) => updateMammothField(selectedMammoth.user_id, 'trading_blocked', val)} 
                      />
                      <Toggle 
                        label="Блок вывода" 
                        enabled={selectedMammoth.withdraw_blocked} 
                        loading={isUpdatingField === `${selectedMammoth.user_id}-withdraw_blocked`}
                        onChange={(val) => updateMammothField(selectedMammoth.user_id, 'withdraw_blocked', val)} 
                      />
                    </Card>
                  </section>

                  <section>
                    <h3 className="text-[11px] font-bold text-dim uppercase tracking-widest mb-3 px-1 flex items-center gap-2">
                      <Dice5 className="w-3 h-3" /> Паста вывода
                    </h3>
                    <Card className="bg-elevated border-edge">
                      <div className="space-y-4">
                        <div className="relative">
                          <select 
                            value={selectedMammoth.withdraw_message_type || ''}
                            onChange={(e) => updateMammothField(selectedMammoth.user_id, 'withdraw_message_type', e.target.value)}
                            className="w-full bg-surface border border-edge rounded-xl py-4 px-4 text-sm font-bold text-ink focus:border-dim outline-none transition-all appearance-none shadow-inner"
                          >
                            <option value="">Не выбрано</option>
                            {templates.map(t => (
                              <option key={t.message_type} value={t.message_type}>{t.title}</option>
                            ))}
                          </select>
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronRight className="w-4 h-4 text-dim rotate-90" />
                          </div>
                        </div>
                        <p className="text-[11px] text-dim leading-relaxed px-1 font-medium italic">
                          Этот текст увидит мамонт при попытке вывода, если он заблокирован.
                        </p>
                      </div>
                    </Card>
                  </section>

                  <div className="pt-6">
                    <button 
                      onClick={() => handleUnassignMammoth(selectedMammoth.user_id)}
                      className="w-full flex items-center justify-center gap-2 bg-red-500/10 border border-red-500/20 rounded-2xl py-5 text-sm font-bold text-red-400 active:bg-red-500/20 transition-all"
                    >
                      <Trash2 className="w-4 h-4" /> Отвязать мамонта
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Mammoth Modal */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowAddModal(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-sm bg-elevated border border-edge rounded-[2rem] p-6 shadow-2xl"
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black tracking-tight text-ink">Добавить</h2>
                  <button onClick={() => setShowAddModal(false)} className="w-8 h-8 rounded-xl bg-surface border border-edge flex items-center justify-center shadow-inner">
                    <X className="w-4 h-4 text-dim" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-dim uppercase tracking-widest ml-1">ID или Username</label>
                    <input 
                      type="text" 
                      placeholder="Напр. 123456789 или @username"
                      value={addInput}
                      onChange={(e) => setAddInput(e.target.value)}
                      className="w-full bg-surface border border-edge rounded-xl py-4 px-4 text-sm font-bold text-ink placeholder:text-dim focus:border-dim outline-none transition-all shadow-inner"
                    />
                  </div>
                  <button 
                    disabled={isAdding}
                    onClick={handleAddMammoth}
                    className="w-full bg-ink text-page py-4 rounded-xl text-sm font-black active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {isAdding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Добавить
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* Custom Keypad */}
        <AnimatePresence>
          {showKeypad.active && (
            <div className="fixed inset-0 z-[300] flex items-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowKeypad(prev => ({ ...prev, active: false }))}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full bg-surface border-t border-edge rounded-t-[2.5rem] p-6 pb-safe-area-inset-bottom shadow-[0_-20px_50px_rgba(0,0,0,0.8)]"
              >
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[11px] font-bold text-dim uppercase tracking-widest">{showKeypad.title}</h3>
                  <button 
                    onClick={() => setShowKeypad(prev => ({ ...prev, active: false }))}
                    className="w-10 h-10 rounded-xl bg-elevated border border-edge flex items-center justify-center shadow-inner text-ink"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="mb-8 text-center">
                  <span className="text-6xl font-black tracking-tighter text-ink">
                    {showKeypad.value || '0'}
                  </span>
                  <span className="text-2xl font-bold text-dim ml-2">₽</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, '.', 0, 'DEL'].map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        // @ts-ignore
                        window.Telegram?.WebApp?.HapticFeedback?.impactOccurred('light');
                        setShowKeypad(prev => {
                          if (key === 'DEL') return { ...prev, value: prev.value.slice(0, -1) };
                          if (key === '.' && prev.value.includes('.')) return prev;
                          if (prev.value.length > 10) return prev;
                          return { ...prev, value: prev.value + key };
                        });
                      }}
                      className={cn(
                        "h-16 rounded-2xl flex items-center justify-center text-2xl font-bold transition-all active:scale-90 shadow-lg",
                        key === 'DEL' ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-elevated text-ink border border-edge"
                      )}
                    >
                      {key === 'DEL' ? <X className="w-6 h-6" /> : key}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => {
                    showKeypad.onConfirm(showKeypad.value || '0');
                    setShowKeypad(prev => ({ ...prev, active: false }));
                  }}
                  className="w-full bg-ink text-page py-5 rounded-2xl text-lg font-black shadow-xl active:scale-95 transition-all"
                >
                  Подтвердить
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[200]"
            >
              <div className={cn(
                "px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 backdrop-blur-xl border",
                toast.type === 'success' ? "bg-green-500/90 border-green-500/20 text-white" : "bg-red-500/90 border-red-500/20 text-white"
              )}>
                {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                <span className="text-sm font-bold">{toast.message}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-md border-t border-edge px-2 pb-safe-area-inset-bottom z-40 shadow-lg">
        <div className="flex items-center justify-around h-16 max-w-2xl mx-auto">
          <NavButton 
            active={activeTab === 'dashboard'} 
            onClick={() => { setActiveTab('dashboard'); setSelectedMammoth(null); }} 
            icon={<TrendingUp className="w-5 h-5" />} 
            label="Главная" 
          />
          <NavButton 
            active={activeTab === 'mammoths'} 
            onClick={() => setActiveTab('mammoths')} 
            icon={<Users className="w-5 h-5" />} 
            label="Мамонты" 
          />
          <NavButton 
            active={false} 
            onClick={() => setShowAddModal(true)} 
            icon={<UserPlus className="w-5 h-5" />} 
            label="Добавить" 
          />
          <NavButton 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
            icon={<Settings className="w-5 h-5" />} 
            label="Настройки" 
          />
        </div>
      </nav>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center justify-center gap-1 transition-all duration-300 relative",
        active ? "text-ink" : "text-dim"
      )}
    >
      {active && (
        <motion.div 
          layoutId="nav-active"
          className="absolute -top-1 w-8 h-0.5 bg-accent rounded-full"
        />
      )}
      <div className={cn("transition-transform duration-300", active && "scale-110")}>
        {icon}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}
