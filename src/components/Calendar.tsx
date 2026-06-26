/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, Lock, Plus, User, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Schedule } from '../types';

interface CalendarProps {
  schedules: Schedule[];
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  onSelectSlot: (startTime: string, endTime: string, scheduleToEdit?: Schedule | null) => void;
  isHost: boolean;
}

// Convert "HH:MM" to minutes for slot collision helpers
function timeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

// Format date to "YYYY-MM-DD" local string helper
function formatDateString(year: number, month: number, day: number): string {
  const mStr = (month + 1).toString().padStart(2, '0');
  const dStr = day.toString().padStart(2, '0');
  return `${year}-${mStr}-${dStr}`;
}

// Time slots to display in agenda (30-minute blocks from 09:00 to 24:00)
const AGENDA_SLOTS: { start: string; end: string }[] = [];
for (let hour = 9; hour < 24; hour++) {
  const hStr = hour.toString().padStart(2, '0');
  const hNextStr = (hour + 1).toString().padStart(2, '0');
  
  AGENDA_SLOTS.push({ start: `${hStr}:00`, end: `${hStr}:30` });
  AGENDA_SLOTS.push({ start: `${hStr}:30`, end: `${hNextStr}:00` });
}

export default function Calendar({
  schedules,
  selectedDate,
  setSelectedDate,
  onSelectSlot,
  isHost,
}: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get start and end of the monthly grid
  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday, 6 is Saturday
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Prev & Next Month handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(formatDateString(today.getFullYear(), today.getMonth(), today.getDate()));
  };

  // Generate grid array
  const daysGrid: { day: number | null; dateString: string | null }[] = [];
  
  // Fill empty leading cells
  for (let i = 0; i < startDayOfWeek; i++) {
    daysGrid.push({ day: null, dateString: null });
  }

  // Fill active days
  for (let d = 1; d <= totalDaysInMonth; d++) {
    daysGrid.push({
      day: d,
      dateString: formatDateString(year, month, d),
    });
  }

  // Helper: Count schedules on a specific date
  const getSchedulesForDate = (dateStr: string) => {
    return schedules.filter((s) => s.date === dateStr);
  };

  // Selected date parsed details
  const [selYear, selMonth, selDay] = selectedDate.split('-').map(Number);
  const selDateObj = new Date(selYear, selMonth - 1, selDay);
  const dayNameKorean = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'][selDateObj.getDay()];

  // Active date's events
  const selectedDaySchedules = schedules.filter((s) => s.date === selectedDate);

  // Check if a schedule overlaps with a 30-minute block
  const getSchedulesOverlappingSlot = (start: string, end: string) => {
    const startMins = timeToMinutes(start);
    const endMins = timeToMinutes(end);
    
    return selectedDaySchedules.filter((s) => {
      const sStartMins = timeToMinutes(s.startTime);
      const sEndMins = timeToMinutes(s.endTime);
      return Math.max(sStartMins, startMins) < Math.min(sEndMins, endMins);
    });
  };

  return (
    <div id="calendar-workspace-grid" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* LEFT: Monthly Calendar Grid (Span 7) */}
      <div id="monthly-calendar-container" className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 space-y-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CalendarIcon className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">
              {year}년 {month + 1}월
            </h2>
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-50 border border-slate-200/60 text-slate-600 hover:text-slate-900 rounded-lg transition-all"
              aria-label="이전 달"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 border border-slate-200/60 text-slate-600 hover:text-slate-900 rounded-lg transition-all"
            >
              오늘
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-50 border border-slate-200/60 text-slate-600 hover:text-slate-900 rounded-lg transition-all"
              aria-label="다음 달"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of Week Headers */}
        <div className="grid grid-cols-7 text-center border-b border-slate-100 pb-2">
          {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
            <span
              key={day}
              className={`text-xs font-bold ${
                idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-blue-500' : 'text-slate-400'
              }`}
            >
              {day}
            </span>
          ))}
        </div>

        {/* Calendar Cells Grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {daysGrid.map((cell, idx) => {
            const isSelected = cell.dateString === selectedDate;
            const daySchedules = cell.dateString ? getSchedulesForDate(cell.dateString) : [];
            const isToday = cell.dateString === formatDateString(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

            return (
              <div
                key={idx}
                className="aspect-square relative flex flex-col items-center justify-between rounded-md overflow-hidden transition-all"
              >
                {cell.day ? (
                  <button
                    onClick={() => cell.dateString && setSelectedDate(cell.dateString)}
                    className={`w-full h-full flex flex-col items-center justify-start pt-2 pb-1 rounded-lg transition-all relative border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100 font-semibold'
                        : isToday
                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100/70 border-indigo-200 font-bold'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/60'
                    }`}
                  >
                    {/* Day number */}
                    <span className="text-xs sm:text-sm font-semibold">
                      {cell.day}
                    </span>

                    {/* Bookings badge indicator */}
                    {daySchedules.length > 0 && (
                      <div className="absolute bottom-1.5 flex flex-col items-center gap-0.5 w-full px-1 overflow-hidden">
                        {/* Dot representation for screen readers or small layouts */}
                        <div className="flex gap-0.5 justify-center flex-wrap">
                          {daySchedules.slice(0, 3).map((schedule) => (
                            <span
                              key={schedule.id}
                              className={`w-1.5 h-1.5 rounded-full ${
                                isSelected
                                  ? 'bg-white'
                                  : schedule.creatorRole === 'host'
                                  ? 'bg-amber-500'
                                  : 'bg-indigo-500'
                              }`}
                            />
                          ))}
                        </div>
                        {/* Mobile counter */}
                        <span
                          className={`text-[9px] scale-90 font-bold leading-none mt-0.5 ${
                            isSelected ? 'text-indigo-150' : 'text-slate-400'
                          } hidden sm:inline`}
                        >
                          {daySchedules.length}개
                        </span>
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="w-full h-full bg-slate-100/40 rounded-lg border border-slate-100/50" />
                )}
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[11px] text-slate-400 justify-end pt-3 border-t border-slate-50">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            호스트 지정 일정
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
            게스트 예약일정
          </span>
        </div>
      </div>

      {/* RIGHT: Selected Day's 30-Minute Timeline Agenda (Span 5) */}
      <div id="timeline-agenda-container" className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex flex-col h-[600px] overflow-hidden">
        {/* Date Title Banner */}
        <div className="border-b border-slate-100 pb-4 shrink-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">선택된 날짜</div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-1.5">
            {selMonth}월 {selDay}일 ({dayNameKorean})
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            {selectedDaySchedules.length > 0
              ? `등록된 일정 ${selectedDaySchedules.length}개`
              : '등록된 일정이 없습니다. 편한 시간대를 선택해 일정을 추가해보세요!'}
          </p>
        </div>

        {/* 30-min Grid Scroll Area */}
        <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-2.5">
          {AGENDA_SLOTS.map((slot) => {
            const overlapping = getSchedulesOverlappingSlot(slot.start, slot.end);
            const isBooked = overlapping.length > 0;
            
            // Check if user is host or has editable item
            const myEditableItem = overlapping.find((s) => s.isEditable);
            const hasMyBooking = !!myEditableItem;

            return (
              <div
                key={`${slot.start}-${slot.end}`}
                className="flex items-center gap-4 group/slot"
              >
                {/* Time range label */}
                <div className="w-24 shrink-0 flex items-center gap-1 text-slate-400 font-mono text-xs font-semibold">
                  <Clock className="w-3.5 h-3.5 text-slate-300" />
                  <span>{slot.start} ~ {slot.end}</span>
                </div>

                {/* Booking status block */}
                <div className="flex-1">
                  {isBooked ? (
                    <div className="flex flex-col gap-1">
                      {overlapping.map((item) => {
                        const canEdit = item.isEditable;
                        const isHostItem = item.creatorRole === 'host';

                        return (
                          <div
                            key={item.id}
                            onClick={() => (isHost || canEdit) && onSelectSlot(item.startTime, item.endTime, item)}
                            className={`flex items-center justify-between px-4 py-2.5 rounded-xl border transition-all ${
                              canEdit
                                ? 'bg-indigo-50/70 border-indigo-100 hover:bg-indigo-50/90 hover:border-indigo-200 cursor-pointer text-indigo-950'
                                : isHostItem
                                ? 'bg-amber-50/60 border-amber-100 text-amber-900'
                                : 'bg-slate-50/80 border-slate-100 text-slate-500'
                            }`}
                          >
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold truncate">
                                {isHostItem ? '[공지] ' : ''}{item.title}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                {isHostItem ? (
                                  <span className="flex items-center gap-0.5 text-amber-600 font-medium bg-amber-100/60 px-1 py-0.5 rounded">
                                    <ShieldCheck className="w-2.5 h-2.5" /> 호스트
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-0.5">
                                    <User className="w-2.5 h-2.5" /> {item.guestName || '게스트'}
                                  </span>
                                )}
                                {item.location && <span className="truncate">• {item.location}</span>}
                              </div>
                            </div>

                            {/* Actions / Status badges */}
                            {canEdit ? (
                              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/60 px-1.5 py-0.5 rounded-lg">
                                내 예약 (수정)
                              </span>
                            ) : isHost ? (
                              <span className="text-[10px] font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 px-1.5 py-0.5 rounded-lg transition-colors cursor-pointer">
                                수정 (마스터)
                              </span>
                            ) : (
                              <span className="flex items-center gap-0.5 text-[10px] text-slate-400 font-medium bg-slate-100 px-1.5 py-0.5 rounded-lg">
                                <Lock className="w-2.5 h-2.5" /> 예약불가
                              </span>
                            )}
                          </div>
                        );
                      })}

                      {/* Overlap scheduler escape hatch ONLY for Host */}
                      {isHost && (
                        <button
                          onClick={() => onSelectSlot(slot.start, slot.end, null)}
                          className="flex items-center justify-center gap-1 w-full py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 rounded-lg text-[10px] font-bold border border-dashed border-amber-300 transition-all cursor-pointer"
                        >
                          <Plus className="w-3 h-3" /> 다른 일정 추가 등록 (호스트 중복 예약 허용)
                        </button>
                      )}
                    </div>
                  ) : (
                    /* FREE (Bookable) Slot */
                    <button
                      onClick={() => onSelectSlot(slot.start, slot.end, null)}
                      className="w-full text-left flex items-center justify-between px-4 py-3 bg-white hover:bg-slate-50 border border-dashed border-slate-200 hover:border-indigo-400 rounded-xl text-slate-400 hover:text-indigo-600 cursor-pointer transition-all"
                    >
                      <span className="text-xs font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 opacity-0 group-hover/slot:opacity-100 transition-opacity" />
                        예약 가능 시간대
                      </span>
                      <Plus className="w-4 h-4 text-slate-300 group-hover/slot:text-indigo-500 group-hover/slot:translate-x-0.5 transition-all" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
