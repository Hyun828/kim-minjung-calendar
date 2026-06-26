/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { CalendarIcon, Shield, User, LogIn, LogOut, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import Calendar from './components/Calendar';
import ScheduleModal from './components/ScheduleModal';
import { ToastContainer, useToasts } from './components/Toast';
import { Schedule, ScheduleInput } from './types';

export default function App() {
  const [viewMode, setViewMode] = useState<'guest' | 'host'>('guest');
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Time slot preset values
  const [selectedStartTime, setSelectedStartTime] = useState('09:00');
  const [selectedEndTime, setSelectedEndTime] = useState('09:30');

  // Host Authentication
  const [hostPassword, setHostPassword] = useState('');
  const [isHostAuthenticated, setIsHostAuthenticated] = useState(false);
  const [isVerifyingHost, setIsVerifyingHost] = useState(false);

  // Toast notifications
  const { toasts, addToast, removeToast } = useToasts();

  // Initialize Guest Token
  const getGuestToken = (): string => {
    let token = localStorage.getItem('guest_token');
    if (!token) {
      token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('guest_token', token);
    }
    return token;
  };

  // Fetch schedules
  const fetchSchedules = async () => {
    try {
      const guestToken = getGuestToken();
      const hostToken = localStorage.getItem('host_token') || '';

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Creator-Token': guestToken,
      };

      if (hostToken) {
        headers['Authorization'] = `Bearer ${hostToken}`;
      }

      const res = await fetch('/api/schedules', { headers });
      if (!res.ok) throw new Error('데이터 로딩에 실패했습니다.');
      
      const data = await res.json();
      setSchedules(data);
    } catch (err: any) {
      addToast(err.message || '일정 정보를 불러오지 못했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Load initial configurations
  useEffect(() => {
    // Set selected date to today by default
    const today = new Date();
    const yStr = today.getFullYear();
    const mStr = (today.getMonth() + 1).toString().padStart(2, '0');
    const dStr = today.getDate().toString().padStart(2, '0');
    setSelectedDate(`${yStr}-${mStr}-${dStr}`);

    // Auto-verify host if token saved
    const savedHostToken = localStorage.getItem('host_token');
    if (savedHostToken) {
      setIsHostAuthenticated(true);
    }

    // Parse URL hash if present
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#host') {
        setViewMode('host');
      } else {
        setViewMode('guest');
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  // Sync schedules whenever auth, views or token shifts
  useEffect(() => {
    fetchSchedules();
  }, [viewMode, isHostAuthenticated]);

  // Handle Host Authentication Verify
  const handleHostLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostPassword.trim()) return;

    setIsVerifyingHost(true);
    try {
      const res = await fetch('/api/auth/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: hostPassword }),
      });

      const data = await res.json();
      if (data.success && data.token) {
        localStorage.setItem('host_token', data.token);
        setIsHostAuthenticated(true);
        setHostPassword('');
        addToast('호스트 권한이 인증되었습니다.', 'success');
      } else {
        addToast(data.message || '비밀번호가 올바르지 않습니다.', 'error');
      }
    } catch (err) {
      addToast('인증에 실패했습니다. 서버 연결을 확인해 주세요.', 'error');
    } finally {
      setIsVerifyingHost(false);
    }
  };

  const handleHostLogout = () => {
    localStorage.removeItem('host_token');
    setIsHostAuthenticated(false);
    addToast('호스트에서 로그아웃 되었습니다.', 'info');
  };

  // Handle Schedule Save (Create / Update)
  const handleSaveSchedule = async (input: ScheduleInput, guestPIN?: string) => {
    const guestToken = getGuestToken();
    const hostToken = localStorage.getItem('host_token') || '';
    const isEditing = !!scheduleToEdit;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Creator-Token': guestToken,
    };

    if (viewMode === 'host' && hostToken) {
      headers['Authorization'] = `Bearer ${hostToken}`;
    }

    if (guestPIN) {
      headers['X-Guest-Password'] = guestPIN;
    }

    const url = isEditing ? `/api/schedules/${scheduleToEdit!.id}` : '/api/schedules';
    const method = isEditing ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers,
      body: JSON.stringify(input),
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error || '일정 저장 도중 문제가 발생했습니다.';
      addToast(errMsg, 'error');
      throw new Error(errMsg);
    }

    addToast(isEditing ? '일정이 성공적으로 수정되었습니다.' : '새 일정이 성공적으로 예약되었습니다.', 'success');
    
    // Save creator token if returned
    if (data.creatorToken) {
      localStorage.setItem('guest_token', data.creatorToken);
    }

    // Refresh calendar
    fetchSchedules();
  };

  // Handle Schedule Delete
  const handleDeleteSchedule = async (id: string, guestPIN?: string) => {
    const guestToken = getGuestToken();
    const hostToken = localStorage.getItem('host_token') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Creator-Token': guestToken,
    };

    if (viewMode === 'host' && hostToken) {
      headers['Authorization'] = `Bearer ${hostToken}`;
    }

    if (guestPIN) {
      headers['X-Guest-Password'] = guestPIN;
    }

    const res = await fetch(`/api/schedules/${id}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error || '일정 삭제 도중 문제가 발생했습니다.';
      addToast(errMsg, 'error');
      throw new Error(errMsg);
    }

    addToast('일정이 안전하게 삭제되었습니다.', 'success');
    fetchSchedules();
  };

  // Open slot picker modal helper
  const handleSelectSlot = (startTime: string, endTime: string, schedule: Schedule | null = null) => {
    setScheduleToEdit(schedule);
    setSelectedStartTime(startTime);
    setSelectedEndTime(endTime);
    setIsModalOpen(true);
  };

  const handleToggleViewMode = (mode: 'guest' | 'host') => {
    setViewMode(mode);
    window.location.hash = mode;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* HEADER: System Navigation & Sync Status */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 sm:px-8 flex-shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-sm flex items-center justify-center text-white font-bold text-sm">
            민
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800">김민정 약속앱</h1>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="hidden md:flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100 text-xs font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            로컬 보안 데이터 동기화 완료
          </div>
          
          {/* Mode Switcher Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200/50">
            <button
              onClick={() => handleToggleViewMode('guest')}
              className={`px-3 py-1 sm:px-4 sm:py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === 'guest'
                  ? 'bg-white shadow-sm text-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Guest View
            </button>
            <button
              onClick={() => handleToggleViewMode('host')}
              className={`px-3 py-1 sm:px-4 sm:py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === 'host'
                  ? 'bg-white shadow-sm text-indigo-600'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Host View
            </button>
          </div>
        </div>
      </header>

      {/* BODY CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
        
        {/* Banner notification for Host authentication */}
        {viewMode === 'host' && isHostAuthenticated && (
          <div className="mb-6 p-4 bg-emerald-50 rounded-xl border border-emerald-150 text-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5 text-xs font-semibold">
              <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
              <span>호스트 마스터 계정으로 로그인되어 있습니다. 모든 게스트 일정을 조율할 수 있습니다.</span>
            </div>
            <button
              onClick={handleHostLogout}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-rose-600 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-100 px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              마스터 로그아웃
            </button>
          </div>
        )}

        {/* View switching logic */}
        {viewMode === 'host' && !isHostAuthenticated ? (
          /* Host Authorization login form */
          <div className="max-w-md mx-auto my-12 bg-white rounded-2xl border border-slate-200 shadow-xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 bg-indigo-50 text-indigo-600 rounded-xl mb-2">
                <Shield className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">호스트 비밀번호 관리자 인증</h2>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                이 구역은 마스터 관리자(호스트) 전용 대시보드입니다. 일정을 조회, 추가, 수정 및 삭제하려면 암호를 입력해주세요.
              </p>
            </div>

            <form onSubmit={handleHostLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="password-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wide">비밀번호</label>
                <input
                  id="password-input"
                  type="password"
                  placeholder="기본 비밀번호: admin1234"
                  value={hostPassword}
                  onChange={(e) => setHostPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 focus:bg-white text-slate-800 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl outline-none font-medium text-sm transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifyingHost || !hostPassword.trim()}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-100 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isVerifyingHost ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    인증 코드 확인 중...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    관리자 권한 잠금 해제
                  </>
                )}
              </button>
            </form>
          </div>
        ) : isLoading ? (
          /* Global Loader */
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-xs font-semibold text-slate-400">데이터를 동기화하고 있습니다...</p>
          </div>
        ) : (
          /* Main Calendar Application Interface */
          <div className="space-y-6">
            
            {/* Guide Info Banner */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed text-slate-600">
                {viewMode === 'host' ? (
                  <p>
                    <strong>Host View Active:</strong> 달력에서 날짜를 선택한 뒤, 오른쪽 타임라인에서 원하는 30분 슬롯을 클릭하세요. 이미 예약된 슬롯이라도 중복하여 이중 예약할 수 있으며, 모든 일정을 전적으로 편집 및 삭제할 수 있습니다.
                  </p>
                ) : (
                  <p>
                    <strong>Guest View Active:</strong> 별도의 로그인 없이 누구나 달력을 조회하고 빈 시간에 예약을 잡을 수 있습니다. 이미 다른 게스트가 예약한 시간대(예약불가)는 선택할 수 없지만, <strong>자신이 잡은 예약은 동일한 세션 브라우저를 사용하거나, 예약 시 작성한 4자리 암호를 활용해 언제든지 수정 및 삭제</strong>가 가능합니다.
                  </p>
                )}
              </div>
            </div>

            {/* Calendar & Agenda Panel Workspace */}
            <Calendar
              schedules={schedules}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              onSelectSlot={handleSelectSlot}
              isHost={viewMode === 'host' && isHostAuthenticated}
            />
          </div>
        )}

      </main>

      {/* FOOTER: System stats with occupancy bar */}
      <footer className="h-12 border-t border-slate-200 bg-white flex items-center justify-between px-6 sm:px-8 flex-shrink-0 text-slate-500">
        <div className="text-xs font-medium italic">
          최종 동기화 완료: 방금 전
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">전체 예약 점유율</span>
            <div className="w-24 sm:w-32 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/40">
              <div 
                className="h-full bg-indigo-500 transition-all duration-500" 
                style={{ width: `${Math.min(Math.round((schedules.length / 50) * 100), 100)}%` }}
              ></div>
            </div>
            <span className="text-[10px] text-slate-600 font-bold">
              {Math.min(Math.round((schedules.length / 50) * 100), 100)}%
            </span>
          </div>
        </div>
      </footer>

      {/* SCHEDULE MODAL */}
      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedDate={selectedDate}
        selectedStartTime={selectedStartTime}
        selectedEndTime={selectedEndTime}
        scheduleToEdit={scheduleToEdit}
        isHost={viewMode === 'host' && isHostAuthenticated}
        onSave={handleSaveSchedule}
        onDelete={handleDeleteSchedule}
      />

      {/* TOAST SYSTEM CONTAINER */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}
