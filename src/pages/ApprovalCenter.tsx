import React, { useState } from 'react';
import { useApp, RoomBooking, Task } from '../context/AppContext';
import { 
  CheckSquare, 
  XSquare, 
  Clock, 
  MapPin, 
  Calendar, 
  MessageSquare, 
  ShieldCheck, 
  User, 
  Award,
  BookOpen
} from 'lucide-react';
import Swal from 'sweetalert2';
import { hasPermission } from '../rbac';

export const ApprovalCenter: React.FC = () => {
  const { 
    bookings, 
    tasks, 
    rooms, 
    users, 
    executives,
    approveBooking, 
    rejectBooking, 
    currentUser,
    canViewTaskDetail,
    maskTaskTitle
  } = useApp();

  if (!currentUser) return null;

  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('Pending');

  // Can the current user perform approval actions?
  const canApprove = hasPermission(currentUser.role, 'booking:approve_vip');

  // Filtered list
  const filteredBookings = bookings.filter(b => {
    // Only care about VIP rooms or larger requests requiring approval (in this system, room.isVip determines if it needs approval)
    const room = rooms.find(r => r.id === b.roomId);
    if (!room?.isVip) return false;

    if (filterStatus === 'All') return true;
    return b.approvalStatus === filterStatus;
  });

  const handleApprove = (bookingId: string) => {
    Swal.fire({
      title: 'อนุมัติคำขอใช้ห้อง VIP',
      input: 'textarea',
      inputLabel: 'ความเห็น / ข้อสังเกตเพิ่มเติม (ไม่บังคับ)',
      inputPlaceholder: 'ระบุคำแนะนำสำหรับแม่บ้านหรือฝ่ายอำนวยความสะดวกที่นี่...',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันอนุมัติ',
      cancelButtonText: 'ยกเลิก',
      inputAttributes: {
        'aria-label': 'ความเห็นเพิ่มเติม'
      }
    }).then((result) => {
      if (result.isConfirmed) {
        approveBooking(bookingId, result.value || 'อนุมัติเรียบร้อยตามคำขอ');
      }
    });
  };

  const handleReject = (bookingId: string) => {
    Swal.fire({
      title: 'ปฏิเสธคำขอใช้ห้อง VIP',
      input: 'textarea',
      inputLabel: 'ระบุเหตุผลการปฏิเสธคำขอ (จำเป็น) *',
      inputPlaceholder: 'เช่น ห้องประชุมติดภารกิจผู้ตรวจราชการกระทรวง หรือ มีงานด่วนภารกิจลับซ้อน...',
      showCancelButton: true,
      confirmButtonText: 'ยืนยันปฏิเสธการจอง',
      cancelButtonText: 'ยกเลิก',
      inputValidator: (value) => {
        if (!value) {
          return 'กรุณากรอกเหตุผลประกอบการปฏิเสธ!';
        }
      }
    }).then((result) => {
      if (result.isConfirmed) {
        rejectBooking(bookingId, result.value);
      }
    });
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Approved':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900';
      case 'Rejected':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900';
      default:
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">ศูนย์พิจารณาอนุมัติห้องประชุม VIP</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">จัดการคำขอกลั่นกรองสิทธิ์ใช้งานห้องพิเศษและห้องรับรองระดับสูง</p>
        </div>

        {/* Status Tab buttons */}
        <div className="flex bg-slate-100 dark:bg-slate-950/40 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80">
          {(['Pending', 'Approved', 'Rejected', 'All'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setFilterStatus(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterStatus === tab 
                  ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              {tab === 'Pending' ? '📥 รออนุมัติ' : tab === 'Approved' ? '✅ อนุมัติแล้ว' : tab === 'Rejected' ? '❌ ปฏิเสธ' : '📋 ทั้งหมด'}
            </button>
          ))}
        </div>
      </div>

      {/* Warning/Permissions Notice */}
      {!canApprove && (
        <div className="p-4 rounded-xl bg-slate-100 border border-slate-200/80 dark:bg-slate-900 dark:border-slate-800 flex gap-3 text-left">
          <BookOpen className="h-5 w-5 text-slate-500 flex-shrink-0" />
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-slate-700 dark:text-slate-300">โหมดมุมมองอ่านอย่างเดียว (Read-only):</span> บัญชีสิทธิ์ปัจจุบันของคุณ ({currentUser.role}) ไม่มีอำนาจพิจารณาคำขอจองห้อง VIP หากคุณต้องการจำลองการกดอนุมัติ/ปฏิเสธ กรุณาใช้ตัวเลือกสลับสิทธิ์ด้านบนเป็น <b>Admin, Super Admin หรือ Executive</b>
          </div>
        </div>
      )}

      {/* Grid listing requests */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredBookings.map(booking => {
          const task = tasks.find(t => t.id === booking.taskId);
          if (!task) return null;

          const room = rooms.find(r => r.id === booking.roomId);
          const requester = users.find(u => u.id === task.createdBy);
          const exec = executives.find(e => e.id === task.executiveId);

          const title = maskTaskTitle(task);
          const isAuthorized = canViewTaskDetail(task);

          return (
            <div 
              key={booking.id} 
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow relative overflow-hidden"
            >
              
              {/* Top Row: Room & Status */}
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{room?.name}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyle(booking.approvalStatus)}`}>
                  {booking.approvalStatus === 'Pending' ? 'รอพิจารณา' : booking.approvalStatus === 'Approved' ? 'อนุมัติใช้งาน' : 'ปฏิเสธคำขอ'}
                </span>
              </div>

              {/* Middle Section: Task Brief */}
              <div className="space-y-3">
                {/* Title */}
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">หัวข้อภารกิจบูรณาการ</div>
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">{title}</div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 gap-3 text-[10px] bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold block">ผู้จอง/ขอใช้</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                      <User className="h-3 w-3 text-slate-400" />
                      {requester?.name || 'ไม่ทราบชื่อ'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-slate-400 font-semibold block">ผู้บริหารที่เข้าร่วม</span>
                    <span className="text-enterprise-600 dark:text-enterprise-400 font-bold flex items-center gap-1">
                      <Award className="h-3 w-3 text-enterprise-500" />
                      {exec?.name || 'ไม่มีผู้บริหารหลัก'}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-slate-200/30 dark:border-slate-800/20 space-y-1">
                    <span className="text-slate-400 font-semibold block">วันเวลาจอง</span>
                    <span className="text-slate-700 dark:text-slate-300 font-bold flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-slate-400" />
                      {new Date(booking.startTime).toLocaleDateString('th-TH', { dateStyle: 'short' })} • {new Date(booking.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(booking.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                    </span>
                  </div>
                </div>

                {/* Amenities Requested */}
                <div className="space-y-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">บริการ/อุปกรณ์ที่ร้องขอ</span>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {booking.requestedAmenities.map(a => (
                      <span key={a} className="text-[9px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 px-2 py-0.5 rounded">
                        💡 {a}
                      </span>
                    ))}
                    {booking.requestedAmenities.length === 0 && (
                      <span className="text-[9px] text-slate-400 italic">ไม่มีขออุปกรณ์เพิ่มเติม</span>
                    )}
                  </div>
                </div>

                {/* Comment display if exists */}
                {booking.comment && (
                  <div className="p-2.5 rounded-lg bg-slate-100/50 border border-slate-200/50 text-[10px] text-slate-500 dark:bg-slate-950/40 dark:border-slate-800/80 dark:text-slate-400 flex items-start gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-slate-400 flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300">หมายเหตุพิจารณา:</span> {booking.comment}
                    </div>
                  </div>
                )}

              </div>

              {/* Bottom Row: Actions (Only active on Pending + Admin checks) */}
              {booking.approvalStatus === 'Pending' && (
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 mt-2">
                  <button
                    disabled={!canApprove}
                    onClick={() => handleApprove(booking.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                      canApprove 
                        ? 'bg-enterprise-500 hover:bg-enterprise-600 text-white' 
                        : 'bg-slate-100 text-slate-400 dark:bg-slate-850 cursor-not-allowed'
                    }`}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>อนุมัติใช้ห้อง</span>
                  </button>
                  <button
                    disabled={!canApprove}
                    onClick={() => handleReject(booking.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                      canApprove 
                        ? 'border-rose-200 hover:bg-rose-50 text-rose-600 dark:border-rose-900/60 dark:hover:bg-rose-950/10' 
                        : 'border-slate-200 text-slate-400 dark:border-slate-800 cursor-not-allowed'
                    }`}
                  >
                    <XSquare className="h-4 w-4" />
                    <span>ปฏิเสธ</span>
                  </button>
                </div>
              )}

            </div>
          );
        })}

        {filteredBookings.length === 0 && (
          <div className="col-span-2 py-16 text-center text-xs text-slate-400 bg-white border border-slate-200/80 rounded-2xl dark:bg-slate-900 dark:border-slate-800">
            ไม่พบรายการคำขอใช้ห้องในสถานะนี้
          </div>
        )}
      </div>

    </div>
  );
};
