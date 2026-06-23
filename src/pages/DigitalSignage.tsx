import React, { useState, useEffect } from 'react';
import { useApp, MeetingRoom, Task, RoomBooking } from '../context/AppContext';
import { Tv, Clock, Calendar, Shield, MapPin, EyeOff, CheckCircle, ChevronLeft, Maximize, Minimize } from 'lucide-react';
import { getLocalYYYYMMDD } from '../utils/dateUtils';

export const DigitalSignage: React.FC = () => {
  const { rooms, bookings, tasks } = useApp();
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [time, setTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Clock Ticker & Fullscreen listener
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      clearInterval(timer);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.error("Error toggling fullscreen: ", err);
    }
  };

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);

  // Compute meetings for selected room today
  // Date target: today
  const targetDateStr = getLocalYYYYMMDD();

  const roomBookingsToday = bookings
    .filter(b => b.roomId === selectedRoomId && b.startTime.startsWith(targetDateStr) && b.approvalStatus === 'Approved')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Find Current Active Meeting
  const currentBooking = roomBookingsToday.find(b => {
    const start = new Date(b.startTime);
    const end = new Date(b.endTime);
    return time >= start && time < end;
  });

  const nextBookings = roomBookingsToday.filter(b => {
    const start = new Date(b.startTime);
    return start > time;
  });

  const currentTask = currentBooking ? tasks.find(t => t.id === currentBooking.taskId) : null;

  // Calculate meeting progress dynamically
  let progressPercent = 0;
  let remainingMinutes = 0;
  if (currentBooking) {
    const start = new Date(currentBooking.startTime).getTime();
    const end = new Date(currentBooking.endTime).getTime();
    const now = time.getTime();
    const total = end - start;
    const elapsed = now - start;
    if (total > 0) {
      progressPercent = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    }
    remainingMinutes = Math.max(0, Math.round((end - now) / (1000 * 60)));
  }

  // Masking specifically for Kiosk Display
  const getMaskedTitleKiosk = (task: Task) => {
    if (task.confidentialityLevel === 'Secret' || task.confidentialityLevel === 'Confidential') {
      return 'Reserved (การประชุมลับภายใน)';
    }
    return task.title;
  };

  const getMaskedExecutiveKiosk = (task: Task) => {
    if (task.confidentialityLevel === 'Secret' || task.confidentialityLevel === 'Confidential') {
      return 'ผู้บริหารระดับสูง';
    }
    return 'ดร.สมชาย วิเศษศักดิ์'; // Governor Mock
  };

  if (!selectedRoomId) {
    return (
      <div className="max-w-2xl mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="rounded-xl bg-enterprise-500 p-2.5 text-white">
            <Tv className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">เลือกเครื่องรับตารางหน้าห้องประชุม (Digital Signage)</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500">จำลองหน้าจอ Kiosk หรือ Tablet ติดหน้าห้องประชุมเพื่ออัปเดตตารางเรียลไทม์</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-xs font-bold text-slate-500">กรุณาเลือกห้องประชุมที่ติดตั้งอุปกรณ์หน้าห้อง:</label>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {rooms.map(room => (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className="p-5 rounded-xl border border-slate-200 text-left hover:border-enterprise-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{room.name}</div>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                    {room.building} • ชั้น {room.floor}
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-enterprise-500 mt-4 inline-flex items-center gap-1">
                  <span>เปิดโหมดป้ายหน้าห้อง</span>
                  <span>→</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const isOccupied = !!currentBooking;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col select-none font-sans overflow-hidden">
      
      {/* LED STATUS BAR */}
      <div className={`h-4 w-full shadow-lg ${isOccupied ? 'bg-rose-500 shadow-rose-500/20' : 'bg-emerald-500 shadow-emerald-500/20'}`}></div>

      {/* SIGNAGE CONTAINER */}
      <div className="flex-1 flex flex-col p-8 md:p-12 justify-between">
        
        {/* TOP BAR: Room details & Clock */}
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-4 text-left">
            <button
              onClick={() => setSelectedRoomId('')}
              className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 cursor-pointer text-slate-400 hover:text-white transition-colors"
              title="กลับหน้าจอการเลือกห้อง"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{selectedRoom?.name}</h1>
                {selectedRoom?.isVip && (
                  <span className="bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase">VIP Room</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1">
                <MapPin className="h-4 w-4" />
                <span>{selectedRoom?.building} • ชั้น {selectedRoom?.floor} • ความจุ {selectedRoom?.capacity} ที่นั่ง</span>
              </div>
            </div>
          </div>

          {/* Clock */}
          <div className="text-right">
            <div className="text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums">
              {time.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wider">
              {time.toLocaleDateString('th-TH', { dateStyle: 'full' })}
            </div>
          </div>
        </div>

        {/* MIDDLE SECTION: MAIN DISPLAY */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch my-8">
          
          {/* Main Status card (Left 2 cols) */}
          <div className="lg:col-span-2 rounded-3xl bg-slate-900 border border-slate-800/80 p-8 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden">
            {/* Status indicator badge */}
            <div className="absolute top-8 right-8 flex items-center gap-2">
              <span className={`h-3.5 w-3.5 rounded-full ${isOccupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`}></span>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {isOccupied ? 'Occupied (กำลังใช้งาน)' : 'Vacant (ห้องว่าง)'}
              </span>
            </div>

            {isOccupied && currentTask ? (
              <div className="space-y-6 flex-1 flex flex-col justify-center">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                    {currentTask.confidentialityLevel === 'Secret' && <EyeOff className="h-4.5 w-4.5 text-rose-500" />}
                    <span>การประชุมขณะนี้ (Current Meeting)</span>
                  </div>
                  
                  <h2 className="text-2xl md:text-4xl font-extrabold text-white leading-snug pt-2">
                    {getMaskedTitleKiosk(currentTask)}
                  </h2>
                </div>

                {/* Meet details */}
                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ผู้บริหารที่ใช้ห้อง</span>
                    <div className="text-base font-bold text-slate-300">{getMaskedExecutiveKiosk(currentTask)}</div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">ช่วงเวลาประชุม</span>
                    <div className="text-base font-bold text-slate-300">
                      {new Date(currentBooking.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(currentBooking.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase">
                    <span>ความก้าวหน้าการใช้ห้อง</span>
                    <span>{progressPercent}% (เหลืออีก {remainingMinutes} นาที)</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${progressPercent}%` }}></div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center space-y-4">
                <div className="rounded-full bg-emerald-500/10 p-6 text-emerald-500 border border-emerald-500/20">
                  <CheckCircle className="h-12 w-12" />
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-white">ห้องนี้ไม่มีรายการจองขณะนี้</h2>
                  <p className="text-xs text-slate-400 mt-1">พร้อมใช้งานสำหรับการจองแบบเร่งด่วน</p>
                </div>
              </div>
            )}

          </div>

          {/* Agenda view (Right 1 col) */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800/80 p-8 flex flex-col justify-between text-left shadow-2xl">
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest pb-3 border-b border-slate-800 flex items-center gap-1.5">
                <Calendar className="h-4.5 w-4.5 text-enterprise-500" />
                <span>กำหนดการถัดไป (Upcoming)</span>
              </h3>

              <div className="space-y-4">
                {nextBookings.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 italic">
                    ไม่มีวาระการประชุมอื่นในวันนี้
                  </div>
                ) : (
                  nextBookings.map(b => {
                    const t = tasks.find(task => task.id === b.taskId);
                    if (!t) return null;

                    return (
                      <div key={b.id} className="p-3 bg-slate-950 rounded-2xl border border-slate-850/60 space-y-2">
                        <div className="text-[10px] text-enterprise-400 font-bold">
                          ⏱️ {new Date(b.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </div>
                        <div className="text-xs font-bold text-slate-200 line-clamp-1">
                          {getMaskedTitleKiosk(t)}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          ผู้รับผิดชอบ: {getMaskedExecutiveKiosk(t)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Bottom Kiosk Notice */}
            <div className="text-[9px] text-slate-500 leading-relaxed pt-4 border-t border-slate-800">
              * ข้อมูลความปลอดภัยถูกจัดเก็บตามมาตรฐานความลับของสำนักงาน การเปิดเผยตารางเวลาจะถูกจำกัดเฉพาะวาระสาธารณะภายนอกเท่านั้น
            </div>
          </div>

        </div>

        {/* BOTTOM BAR: Amenity overview */}
        <div className="flex justify-between items-center border-t border-slate-900 pt-6">
          <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
            อุปกรณ์ประจำห้องประชุม
          </div>
          <div className="flex gap-2">
            {selectedRoom?.amenities.map(a => (
              <span key={a} className="text-[10px] bg-slate-900 border border-slate-800 text-slate-400 px-3 py-1 rounded-full font-bold">
                {a === 'Video Conference' ? '📹 Video' : a === 'Coffee Break' ? '☕ Catering' : a}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* Fullscreen Toggle Floating Button */}
      <div className="fixed bottom-36 right-8 md:right-12 z-[60]">
        <button
          onClick={toggleFullscreen}
          className="p-3.5 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer shadow-lg shadow-black/40 transition-all hover:scale-105 active:scale-95 flex items-center justify-center animate-in fade-in duration-300"
          title={isFullscreen ? "ออกจากโหมดเต็มจอ" : "แสดงผลเต็มจอ"}
        >
          {isFullscreen ? (
            <Minimize className="h-5 w-5" />
          ) : (
            <Maximize className="h-5 w-5" />
          )}
        </button>
      </div>

    </div>
  );
};
