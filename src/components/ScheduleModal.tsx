/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Calendar, Clock, MapPin, AlignLeft, User, Key, Trash2 } from 'lucide-react';
import { Schedule, ScheduleInput } from '../types';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  selectedStartTime?: string;
  selectedEndTime?: string;
  scheduleToEdit: Schedule | null;
  isHost: boolean;
  onSave: (input: ScheduleInput, guestPIN?: string) => Promise<void>;
  onDelete?: (id: string, guestPIN?: string) => Promise<void>;
}

// Generate 30-minute intervals from 09:00 to 18:00
const TIME_OPTIONS: string[] = [];
for (let hour = 9; hour <= 18; hour++) {
  const hStr = hour.toString().padStart(2, '0');
  TIME_OPTIONS.push(`${hStr}:00`);
  if (hour < 18) {
    TIME_OPTIONS.push(`${hStr}:30`);
  }
}

export default function ScheduleModal({
  isOpen,
  onClose,
  selectedDate,
  selectedStartTime = '09:00',
  selectedEndTime = '09:30',
  scheduleToEdit,
  isHost,
  onSave,
  onDelete,
}: ScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('09:30');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [verificationPIN, setVerificationPIN] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPINInput, setShowPINInput] = useState(false);

  // Initialize values when opening or editing
  useEffect(() => {
    if (isOpen) {
      if (scheduleToEdit) {
        setTitle(scheduleToEdit.title);
        setDate(scheduleToEdit.date);
        setStartTime(scheduleToEdit.startTime);
        setEndTime(scheduleToEdit.endTime);
        setLocation(scheduleToEdit.location || '');
        setDescription(scheduleToEdit.description || '');
        setGuestName(scheduleToEdit.guestName || '');
        setGuestPassword(scheduleToEdit.guestPassword || '');
        setVerificationPIN('');
        setShowPINInput(false);
      } else {
        setTitle('');
        setDate(selectedDate);
        setStartTime(selectedStartTime);
        setEndTime(selectedEndTime);
        setLocation('');
        setDescription('');
        setGuestName('');
        setGuestPassword('');
        setVerificationPIN('');
        setShowPINInput(false);
      }
    }
  }, [isOpen, scheduleToEdit, selectedDate, selectedStartTime, selectedEndTime]);

  // Adjust end time automatically to be at least 30 mins after start time
  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    const startIdx = TIME_OPTIONS.indexOf(val);
    const currentEndIdx = TIME_OPTIONS.indexOf(endTime);
    if (startIdx >= currentEndIdx && startIdx < TIME_OPTIONS.length - 1) {
      setEndTime(TIME_OPTIONS[startIdx + 1]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const input: ScheduleInput = {
        title,
        date,
        startTime,
        endTime,
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        guestName: !isHost ? (guestName.trim() || '게스트') : undefined,
        guestPassword: !isHost ? (guestPassword.trim() || undefined) : undefined,
      };

      await onSave(input, verificationPIN || undefined);
      onClose();
    } catch (err) {
      // Handled by parent with toast
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    if (!scheduleToEdit || !onDelete) return;

    // For guests, if the schedule has a password, we require them to verify it
    if (!isHost && scheduleToEdit.hasPassword && !showPINInput) {
      setShowPINInput(true);
      return;
    }

    setIsSubmitting(true);
    try {
      await onDelete(scheduleToEdit.id, verificationPIN || undefined);
      onClose();
    } catch (err) {
      // Handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = title.trim().length > 0 && date;

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="schedule-modal-overlay" className="fixed inset-0 z-40 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative z-50 w-full max-w-md overflow-hidden bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800">
                {scheduleToEdit ? '일정 수정' : '새 일정 예약'}
              </h3>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Event Title */}
              <div className="space-y-1.5">
                <label htmlFor="title-input" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  일정명 <span className="text-rose-500">*</span>
                </label>
                <input
                  id="title-input"
                  type="text"
                  required
                  placeholder="예: 프로젝트 미팅, 스터디, 식사 약속"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all outline-none font-medium text-sm"
                />
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="date-input" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    날짜
                  </label>
                  <input
                    id="date-input"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none text-sm transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    시간 선택
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      id="start-time-select"
                      aria-label="시작 시간"
                      value={startTime}
                      onChange={(e) => handleStartTimeChange(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    >
                      {TIME_OPTIONS.slice(0, -1).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <span className="text-slate-400 text-xs">~</span>
                    <select
                      id="end-time-select"
                      aria-label="종료 시간"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    >
                      {TIME_OPTIONS.filter((t) => TIME_OPTIONS.indexOf(t) > TIME_OPTIONS.indexOf(startTime)).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1.5">
                <label htmlFor="location-input" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  장소
                </label>
                <input
                  id="location-input"
                  type="text"
                  placeholder="온라인 Zoom, 강남역 카페 등 (선택)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all outline-none text-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label htmlFor="description-textarea" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
                  메모 / 설명
                </label>
                <textarea
                  id="description-textarea"
                  rows={2}
                  placeholder="상세 내용을 적어주세요 (선택)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white text-slate-800 border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl transition-all outline-none text-sm resize-none"
                />
              </div>

              {/* Guest Fields (Only shown if NOT Host, i.e., creating as Guest) */}
              {!isHost && !scheduleToEdit && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                  <div className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-indigo-500" /> 게스트 예약자 정보
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="guest-name-input" className="block text-[10px] font-bold text-slate-400 uppercase">예약자명</label>
                      <input
                        id="guest-name-input"
                        type="text"
                        placeholder="홍길동"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="guest-pin-input" className="block text-[10px] font-bold text-slate-400 uppercase flex items-center gap-0.5">
                        <Key className="w-2.5 h-2.5" /> 수정/삭제 비밀번호 (4자리 PIN)
                      </label>
                      <input
                        id="guest-pin-input"
                        type="password"
                        maxLength={4}
                        placeholder="1234"
                        value={guestPassword}
                        onChange={(e) => setGuestPassword(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-1.5 bg-white text-slate-800 border border-slate-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Verification Section for Guest Edits */}
              {!isHost && scheduleToEdit && (scheduleToEdit.hasPassword || scheduleToEdit.guestPassword) && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 space-y-2">
                  <label htmlFor="verification-pin-input" className="block text-xs font-bold text-amber-800 uppercase flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" /> 본인 확인 비밀번호
                  </label>
                  <p className="text-[11px] text-amber-700">
                    일정을 수정하거나 삭제하려면 최초 등록 시 입력한 4자리 비밀번호를 입력해주세요.
                  </p>
                  <input
                    id="verification-pin-input"
                    type="password"
                    maxLength={4}
                    placeholder="비밀번호 4자리"
                    value={verificationPIN}
                    onChange={(e) => setVerificationPIN(e.target.value.replace(/\D/g, ''))}
                    className="w-full max-w-[120px] px-3 py-1.5 bg-white text-slate-800 border border-amber-200 rounded-lg text-xs outline-none focus:border-amber-500 transition-colors"
                  />
                </div>
              )}

              {/* Show PIN verification block if Guest attempts Delete and verification PIN is required */}
              {showPINInput && (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 space-y-2">
                  <label htmlFor="delete-pin-input" className="block text-xs font-bold text-rose-800 uppercase flex items-center gap-1">
                    <Key className="w-3.5 h-3.5" /> 삭제 비밀번호 입력
                  </label>
                  <p className="text-[11px] text-rose-700">
                    본 일정을 정말로 삭제하시겠습니까? 비밀번호 4자리를 입력해주세요.
                  </p>
                  <div className="flex gap-2">
                    <input
                      id="delete-pin-input"
                      type="password"
                      maxLength={4}
                      placeholder="비밀번호 4자리"
                      value={verificationPIN}
                      onChange={(e) => setVerificationPIN(e.target.value.replace(/\D/g, ''))}
                      className="w-full max-w-[120px] px-3 py-1.5 bg-white text-slate-800 border border-rose-200 rounded-lg text-xs outline-none focus:border-rose-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={handleDeleteClick}
                      disabled={isSubmitting || verificationPIN.length < 4}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      삭제 확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPINInput(false)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors"
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}

              {/* Footer Buttons inside the scroll container */}
              <div className="pt-4 flex items-center justify-between gap-3 border-t border-slate-100">
                {scheduleToEdit && onDelete && !showPINInput && (
                  <button
                    type="button"
                    onClick={handleDeleteClick}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 disabled:text-rose-300 rounded-xl text-xs font-bold transition-all border border-rose-100"
                  >
                    <Trash2 className="w-4 h-4" />
                    일정 삭제
                  </button>
                )}
                
                <div className="flex-1 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200/80 active:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-all"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting || showPINInput}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-100 transition-all flex items-center gap-1.5"
                  >
                    {isSubmitting ? '저장 중...' : (scheduleToEdit ? '수정 완료' : '예약 등록')}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
