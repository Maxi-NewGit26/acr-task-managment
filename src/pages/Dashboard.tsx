import React, { useState } from 'react';
import { useApp, Task, RoomBooking, MeetingRoom } from '../context/AppContext';
import { 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Users, 
  MapPin, 
  ShieldAlert, 
  Eye, 
  Sparkles,
  ArrowRight,
  Paperclip
} from 'lucide-react';
import Swal from 'sweetalert2';
import { hasPermission, canEditTask, canCancelTask } from '../rbac';

export const Dashboard: React.FC<{ setActivePage: (page: string) => void }> = ({ setActivePage }) => {
  const { 
    tasks, 
    bookings, 
    rooms, 
    assignments, 
    currentUser, 
    canViewTaskDetail, 
    maskTaskTitle, 
    maskTaskDesc,
    cancelTask,
    executives,
    setEditingTaskId,
    updateTask,
    users,
    getExecutiveStatus,
    getActingAuthority
  } = useApp();

  if (!currentUser) return null;

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<RoomBooking | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; fileUrl: string; fileSize: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [currentTime, setCurrentTime] = useState(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const sliderRef = React.useRef<HTMLDivElement>(null);
  const dragInfo = React.useRef({ isDown: false, startX: 0, scrollLeft: 0, hasMoved: false });

  const handleSliderMouseDown = (e: React.MouseEvent) => {
    if (!sliderRef.current) return;
    dragInfo.current.isDown = true;
    dragInfo.current.startX = e.pageX - sliderRef.current.offsetLeft;
    dragInfo.current.scrollLeft = sliderRef.current.scrollLeft;
    dragInfo.current.hasMoved = false;
    sliderRef.current.style.cursor = 'grabbing';
    sliderRef.current.style.userSelect = 'none';
  };

  const handleSliderMouseLeave = () => {
    if (!dragInfo.current.isDown) return;
    dragInfo.current.isDown = false;
    if (sliderRef.current) {
      sliderRef.current.style.cursor = 'grab';
      sliderRef.current.style.removeProperty('user-select');
    }
  };

  const handleSliderMouseUp = () => {
    if (!dragInfo.current.isDown) return;
    dragInfo.current.isDown = false;
    if (sliderRef.current) {
      sliderRef.current.style.cursor = 'grab';
      sliderRef.current.style.removeProperty('user-select');
    }
  };

  const handleSliderMouseMove = (e: React.MouseEvent) => {
    if (!dragInfo.current.isDown || !sliderRef.current) return;
    e.preventDefault();
    const x = e.pageX - sliderRef.current.offsetLeft;
    const walk = (x - dragInfo.current.startX) * 1.5;
    sliderRef.current.scrollLeft = dragInfo.current.scrollLeft - walk;
    if (Math.abs(x - dragInfo.current.startX) > 5) {
      dragInfo.current.hasMoved = true;
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'สวัสดีตอนเช้า';
    if (hour >= 12 && hour < 16) return 'สวัสดีตอนบ่าย';
    if (hour >= 16 && hour < 21) return 'สวัสดียามเย็น';
    return 'สวัสดีตอนค่ำ';
  };

  const getExecAvatar = (name: string) => {
    const matchedUser = users.find(u => u.name === name);
    return matchedUser?.avatarUrl || '';
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'อยู่ปฏิบัติราชการ':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-900/40';
      case 'ไปราชการ':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200/50 dark:border-blue-900/40';
      case 'ประชุมภายนอก':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-900/40';
      case 'อบรม/สัมมนา':
        return 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-400 border border-sky-200/50 dark:border-sky-900/40';
      case 'ลาป่วย':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200/50 dark:border-rose-900/40';
      case 'ลากิจ':
        return 'bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-400 border border-orange-200/50 dark:border-orange-900/40';
      case 'ลาพักผ่อน':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200/50 dark:border-purple-900/40';
      case 'ติดภารกิจ':
        return 'bg-pink-100 text-pink-850 dark:bg-pink-950/40 dark:text-pink-400 border border-pink-200/50 dark:border-pink-900/40';
      case 'รักษาราชการแทน':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/50 dark:border-amber-900/40';
      default:
        return 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
  };

  const getThaiDateString = (dateObj: Date) => {
    const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
    const months = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const dayName = days[dateObj.getDay()];
    const day = dateObj.getDate();
    const monthName = months[dateObj.getMonth()];
    const year = dateObj.getFullYear() + 543; // Buddhist Era
    return `${dayName}ที่ ${day} ${monthName} ${year}`;
  };

  const getThaiTimeString = (dateObj: Date) => {
    const hoursStr = dateObj.getHours().toString().padStart(2, '0');
    const minutesStr = dateObj.getMinutes().toString().padStart(2, '0');
    return `${hoursStr}:${minutesStr} น.`;
  };

  const isImageFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext || '');
  };

  const isPdfFile = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    return ext === 'pdf';
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 0.25, 0.5));
  const handleResetZoom = () => setZoomLevel(1);

  const handleDownloadFile = async (url: string, fileName: string) => {
    try {
      Swal.fire({
        title: 'กำลังดาวน์โหลด...',
        text: 'กรุณารอสักครู่ขณะระบบเตรียมไฟล์ของคุณ',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch file');
      const blob = await response.blob();
      const localUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = localUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(localUrl);
      Swal.close();
    } catch (err) {
      console.error("Direct download failed, falling back to new window: ", err);
      Swal.close();
      window.open(url, '_blank');
    }
  };
  const handleDeleteAttachment = async (fileName: string) => {
    if (!selectedTask) return;
    
    Swal.fire({
      title: 'ยืนยันการลบไฟล์แนบ?',
      text: `คุณต้องการลบไฟล์ "${fileName}" ออกจากภารกิจนี้ใช่หรือไม่ การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ใช่, ลบไฟล์',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          Swal.fire({
            title: 'กำลังลบไฟล์...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          const remainingAttachments = (selectedTask.attachments || []).filter(a => a.fileName !== fileName);
          
          const res = await updateTask(
            selectedTask.id,
            { attachments: remainingAttachments },
            undefined,
            undefined,
            [],
            remainingAttachments
          );
          
          if (res.success) {
            setSelectedTask(prev => prev ? { ...prev, attachments: remainingAttachments } : null);
            Swal.fire('สำเร็จ!', 'ลบไฟล์แนบเรียบร้อยแล้ว', 'success');
          } else {
            throw new Error(res.error || 'Failed to delete');
          }
        } catch (err: any) {
          console.error("Failed to delete attachment:", err);
          Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถลบไฟล์ได้: ${err.message}`, 'error');
        }
      }
    });
  };
  // Constants
  const baseDate = new Date().toISOString().slice(0, 10);
  const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

  const topExec = executives.find(e => e.priority === 0);
  const topExecStatus = topExec ? getExecutiveStatus(topExec.id, baseDate) : null;
  const topExecActing = topExec ? getActingAuthority(topExec.id, baseDate) : null;
  const displayExec = topExecActing || topExec;

  // RBAC: Filter tasks based on role visibility
  const allTodaysTasks = tasks.filter(t => t.startTime && t.startTime.startsWith(baseDate) && t.status !== 'Cancelled');
  const todaysTasks = allTodaysTasks.filter(t => {
    if (hasPermission(currentUser.role, 'task:view_all')) return true;
    if (canViewTaskDetail(t)) return true;
    // Operational roles: only see tasks where they have assignments
    if (hasPermission(currentUser.role, 'task:view_assigned')) {
      return assignments.some(a => a.taskId === t.id && a.assignedToRole === currentUser.role);
    }
    return t.confidentialityLevel === 'Public' || t.confidentialityLevel === 'Internal';
  });
  const todaysBookings = bookings.filter(b => {
    if (hasPermission(currentUser.role, 'task:view_all')) return b.startTime && b.startTime.startsWith(baseDate) && b.approvalStatus !== 'Rejected';
    // Only show bookings for visible tasks
    const task = tasks.find(t => t.id === b.taskId);
    return b.startTime && b.startTime.startsWith(baseDate) && b.approvalStatus !== 'Rejected' && task && todaysTasks.includes(task);
  });

  // Filter active in-progress tasks (inside start & end time window)
  const inProgressTasks = todaysTasks.filter(t => {
    if (t.status !== 'Scheduled') return false;
    const start = new Date(t.startTime);
    const end = new Date(t.endTime);
    return currentTime >= start && currentTime <= end;
  });

  // KPI Calculations
  const totalTasksToday = todaysTasks.length;
  const activeBookingsToday = todaysBookings.filter(b => b.approvalStatus === 'Approved').length;
  const pendingApprovalsCount = bookings.filter(b => b.approvalStatus === 'Pending').length;
  const pendingAssignmentsToday = assignments.filter(
    a => a.status !== 'Completed' && a.assignedToRole === currentUser.role
  ).length;

  // Render Priority badge
  const getPriorityBadge = (priority: string) => {
    const base = "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center ";
    switch (priority) {
      case 'ด่วนมาก':
        return <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400`}>ด่วนมาก</span>;
      case 'ด่วน':
        return <span className={`${base} bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400`}>ด่วน</span>;
      case 'ภารกิจลับ':
        return <span className={`${base} bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400`}>ภารกิจลับ</span>;
      case 'ประชุมภายใน':
        return <span className={`${base} bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400`}>ประชุมภายใน</span>;
      case 'ประชุมภายนอก':
        return <span className={`${base} bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400`}>ประชุมภายนอก</span>;
      default:
        return <span className={`${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400`}>ปกติ</span>;
    }
  };

  // Render Confidentiality badge
  const getConfBadge = (level: string) => {
    const base = "px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase ";
    switch (level) {
      case 'Secret':
        return <span className={`${base} bg-rose-500 text-white`}>Secret</span>;
      case 'Confidential':
        return <span className={`${base} bg-amber-500 text-white`}>Confidential</span>;
      case 'Internal':
        return <span className={`${base} bg-slate-600 text-white dark:bg-slate-700`}>Internal</span>;
      default:
        return <span className={`${base} bg-emerald-500 text-white`}>Public</span>;
    }
  };

  // Handle Event click from timeline
  const handleEventClick = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const booking = bookings.find(b => b.taskId === taskId);
    setSelectedTask(task);
    setSelectedBooking(booking || null);
  };

  // Timeline position calculators
  const getLeftOffset = (startTimeStr: string) => {
    const time = new Date(startTimeStr);
    const hour = time.getHours();
    const minute = time.getMinutes();
    
    const startHour = 8;
    const totalHours = 11; // 8:00 to 19:00 (11 hours)
    
    const decimalHours = (hour - startHour) + (minute / 60);
    const percentage = (decimalHours / totalHours) * 100;
    return `${Math.max(0, Math.min(percentage, 100))}%`;
  };

  const getWidthPercent = (startTimeStr: string, endTimeStr: string) => {
    const start = new Date(startTimeStr);
    const end = new Date(endTimeStr);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    const totalHours = 11;
    const percentage = (diffHours / totalHours) * 100;
    return `${Math.max(5, Math.min(percentage, 100 - parseFloat(getLeftOffset(startTimeStr))))}%`;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Welcome Card & In-Progress Tasks Section */}
      <div className="space-y-4">
        {/* Welcome Card */}
        <div className="bg-gradient-to-r from-enterprise-600/95 to-indigo-600/95 dark:from-enterprise-700/90 dark:to-indigo-800/90 backdrop-blur-md rounded-2xl p-5 text-white shadow-[0_8px_30px_rgba(9,142,237,0.12)] border border-white/10 flex items-center justify-between relative overflow-hidden select-none">
          <div className="flex items-center gap-4">
            {currentUser.avatarUrl ? (
              <div className="h-14 w-14 rounded-2xl overflow-hidden border border-white/20 bg-white/10 flex items-center justify-center flex-shrink-0">
                <img 
                  src={currentUser.avatarUrl} 
                  alt={currentUser.name} 
                  className="h-full w-full object-cover" 
                  style={{ 
                    objectPosition: `${currentUser.avatarOffsetX ?? 50}% ${currentUser.avatarOffsetY ?? 50}%`,
                    transform: `scale(${currentUser.avatarScale ?? 1.0})`
                  }}
                />
              </div>
            ) : (
              <div className="h-14 w-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-xl font-bold text-white flex-shrink-0">
                {currentUser.name.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold flex flex-wrap items-center gap-1.5 leading-tight">
                <span>{getGreeting()},</span>
                <span>{currentUser.name}</span>
              </h2>
              <span className="bg-amber-400 text-amber-955 text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-block mt-1.5 shadow-sm">
                สิทธิ์: {currentUser.role}
              </span>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end justify-center text-right select-none">
            <span className="text-xl sm:text-2xl font-black text-white tracking-wider drop-shadow-sm">
              {getThaiTimeString(currentTime)}
            </span>
            <span className="text-[10px] sm:text-xs font-semibold text-white/80 mt-1.5 drop-shadow-sm tracking-wide">
              {getThaiDateString(currentTime)}
            </span>
          </div>
          {/* Subtle background glow decorator */}
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-3xl pointer-events-none"></div>
        </div>

        {/* In-Progress Tasks Slider / Carousel */}
        {inProgressTasks.length > 0 ? (
          <div 
            ref={sliderRef}
            onMouseDown={handleSliderMouseDown}
            onMouseLeave={handleSliderMouseLeave}
            onMouseUp={handleSliderMouseUp}
            onMouseMove={handleSliderMouseMove}
            className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-1 select-none active:cursor-grabbing"
            style={{ cursor: 'grab' }}
          >
            {inProgressTasks.map(task => {
                const booking = bookings.find(b => b.taskId === task.id);
                const room = rooms.find(r => r.id === booking?.roomId);
                const formattedTime = `${new Date(task.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${new Date(task.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`;

                return (
                  <div 
                    key={task.id} 
                    onClick={(e) => {
                      if (dragInfo.current.hasMoved) {
                        e.preventDefault();
                        return;
                      }
                      handleEventClick(task.id);
                    }}
                    className={`flex-shrink-0 ${inProgressTasks.length === 1 ? 'w-full' : 'w-[92%] sm:w-[85%] md:w-[450px]'} snap-center bg-gradient-to-r from-enterprise-500/95 to-indigo-600/95 dark:from-enterprise-600/90 dark:to-indigo-700/90 backdrop-blur-md border border-white/10 p-5 text-white flex items-center justify-between shadow-[0_8px_30px_rgba(99,102,241,0.12)] cursor-pointer hover:scale-[1.01] active:scale-95 transition-all duration-200 rounded-2xl`}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-white/20 border border-white/30 flex items-center justify-center text-white flex-shrink-0">
                        <Clock className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase font-bold text-amber-100 tracking-wider">
                          กำลังดำเนินการ • {task.priority}
                        </div>
                        <h3 className="text-sm font-bold text-white mt-0.5 truncate">{maskTaskTitle(task)}</h3>
                        <p className="text-xs text-white/90 truncate mt-1">
                          ⏱️ {formattedTime} น. {room ? `• 📍 ${room.name}` : ''}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-white/80 ml-4 flex-shrink-0" />
                  </div>
                );
              })}
          </div>
        ) : (
          <div 
            onClick={() => setActivePage('Book a Room')}
            className="w-full bg-gradient-to-r from-enterprise-50/70 to-enterprise-100/70 dark:from-enterprise-950/20 dark:to-enterprise-900/20 backdrop-blur-md rounded-2xl p-5 text-enterprise-750 dark:text-enterprise-300 flex items-center justify-between border border-enterprise-200/30 dark:border-enterprise-800/30 cursor-pointer hover:opacity-90 active:scale-99 transition-all duration-150 shadow-[0_8px_30px_rgb(0,0,0,0.015)]"
          >
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-enterprise-100 dark:bg-enterprise-950/40 flex items-center justify-center text-enterprise-600 dark:text-enterprise-400">
                <CheckCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-enterprise-400 tracking-wider">ภารกิจวันนี้</div>
                <h3 className="text-sm font-bold text-enterprise-800 dark:text-enterprise-200 mt-0.5">ไม่มีภารกิจอยู่ระหว่างดำเนินการในขณะนี้</h3>
                <p className="text-xs text-enterprise-550 dark:text-enterprise-400 mt-1">คลิกที่นี่เพื่อจองห้องประชุมหรือเพิ่มภารกิจใหม่</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-enterprise-500/80 ml-4" />
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
        {/* KPI 1 (Pastel Blue) */}
        <div className="relative overflow-hidden flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-[#e8f1fc] dark:bg-[#1a2d42]/45 border border-[#c1d6ec]/50 dark:border-[#1c354e]/30 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:scale-[1.01] transition-all duration-300">
          <div className="relative z-10 text-left">
            <div className="text-[10px] sm:text-xs font-bold text-[#39668f] dark:text-[#a3c2e1] uppercase tracking-wider">ภารกิจวันนี้</div>
            <div className="text-base sm:text-2xl font-bold text-[#1c354e] dark:text-white mt-1">{totalTasksToday} ภารกิจ</div>
          </div>
          <div className="relative z-10 rounded-xl bg-white/60 dark:bg-slate-800/60 p-2 sm:p-3 text-[#39668f] dark:text-[#a3c2e1] shadow-sm">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          {/* Oversized watermark icon */}
          <div className="absolute -right-5 -bottom-7 text-[#6699cc] dark:text-[#a3c2e1] opacity-10 dark:opacity-[0.05] pointer-events-none transform -rotate-12">
            <Calendar className="h-28 w-28" />
          </div>
        </div>

        {/* KPI 2 (Pastel Green) */}
        <div className="relative overflow-hidden flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-[#e6f4ea] dark:bg-[#1a3825]/45 border border-[#c2e7cc]/50 dark:border-[#1e3d29]/30 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:scale-[1.01] transition-all duration-300">
          <div className="relative z-10 text-left">
            <div className="text-[10px] sm:text-xs font-bold text-[#137333] dark:text-[#81c784] uppercase tracking-wider">ห้องประชุมที่จอง</div>
            <div className="text-base sm:text-2xl font-bold text-[#0f5224] dark:text-white mt-1">{activeBookingsToday} ห้อง</div>
          </div>
          <div className="relative z-10 rounded-xl bg-white/60 dark:bg-slate-800/60 p-2 sm:p-3 text-[#137333] dark:text-[#81c784] shadow-sm">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          {/* Oversized watermark icon */}
          <div className="absolute -right-5 -bottom-7 text-[#81c784] dark:text-[#81c784] opacity-10 dark:opacity-[0.05] pointer-events-none transform -rotate-12">
            <CheckCircle className="h-28 w-28" />
          </div>
        </div>

        {/* KPI 3 (Pastel Yellow/Amber) */}
        <div className="relative overflow-hidden flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-[#fef7e0] dark:bg-[#3d331a]/45 border border-[#feefc3]/50 dark:border-[#3a3018]/30 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:scale-[1.01] transition-all duration-300">
          <div className="relative z-10 text-left">
            <div className="text-[10px] sm:text-xs font-bold text-[#b06000] dark:text-[#ffd54f] uppercase tracking-wider">ห้อง VIP รออนุมัติ</div>
            <div className="text-base sm:text-2xl font-bold text-[#7c4300] dark:text-white mt-1">{pendingApprovalsCount} รายการ</div>
          </div>
          <div className="relative z-10 rounded-xl bg-white/60 dark:bg-slate-800/60 p-2 sm:p-3 text-[#b06000] dark:text-[#ffd54f] shadow-sm">
            <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          {/* Oversized watermark icon */}
          <div className="absolute -right-5 -bottom-7 text-[#ffd54f] dark:text-[#ffd54f] opacity-10 dark:opacity-[0.05] pointer-events-none transform -rotate-12">
            <AlertTriangle className="h-28 w-28" />
          </div>
        </div>

        {/* KPI 4 (Pastel Purple) */}
        <div className="relative overflow-hidden flex items-center justify-between p-4 sm:p-5 rounded-2xl bg-[#f3e8fd] dark:bg-[#2d1b4b]/45 border border-[#e9d2fd]/50 dark:border-[#2b1947]/30 shadow-[0_8px_30px_rgb(0,0,0,0.01)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:scale-[1.01] transition-all duration-300">
          <div className="relative z-10 text-left">
            <div className="text-[10px] sm:text-xs font-bold text-[#6200ee] dark:text-[#b388ff] uppercase tracking-wider">งานเตรียมห้อง</div>
            <div className="text-base sm:text-2xl font-bold text-[#4a00b0] dark:text-white mt-1">{pendingAssignmentsToday} งาน</div>
          </div>
          <div className="relative z-10 rounded-xl bg-white/60 dark:bg-slate-800/60 p-2 sm:p-3 text-[#6200ee] dark:text-[#b388ff] shadow-sm">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          {/* Oversized watermark icon */}
          <div className="absolute -right-5 -bottom-7 text-[#b388ff] dark:text-[#b388ff] opacity-10 dark:opacity-[0.05] pointer-events-none transform -rotate-12">
            <Clock className="h-28 w-28" />
          </div>
        </div>
      </div>

      {/* Main Grid: Room Timeline + Daily Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Daily Agenda List (Right 1 col on desktop, stacks on top on mobile) */}
        <div className="space-y-6">
          {topExec && topExecStatus && (
            <div className="rounded-2xl border border-slate-200/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] text-left space-y-4">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-100 dark:border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">สถานะผู้บังคับบัญชา</h3>
                <button 
                  onClick={() => setActivePage('Executive Status')}
                  className="text-[10px] font-bold text-enterprise-500 hover:underline cursor-pointer"
                >
                  ดูทั้งหมด
                </button>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200/40 dark:border-slate-700/40 shadow-sm" style={{ width: '88px', height: '88px' }}>
                  {displayExec && (displayExec.avatarUrl || getExecAvatar(displayExec.name)) ? (
                    <img 
                      src={displayExec.avatarUrl || getExecAvatar(displayExec.name)} 
                      alt={displayExec.name} 
                      className="h-full w-full object-cover" 
                      style={{
                        objectPosition: `${displayExec.avatarOffsetX ?? 50}% ${displayExec.avatarOffsetY ?? 50}%`,
                        transform: `scale(${displayExec.avatarScale ?? 1.0})`
                      }}
                    />
                  ) : (
                    <span className="text-3xl font-bold text-slate-400">{displayExec ? displayExec.name.charAt(0) : ''}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col justify-between h-[88px]">
                  <div>
                    <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate">{displayExec ? displayExec.name : ''}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                      {displayExec ? (topExecActing ? `${displayExec.position} (รักษาราชการแทน)` : displayExec.position) : ''}
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusBadgeClass(topExecActing ? 'รักษาราชการแทน' : topExecStatus.status)}`}>
                      {topExecActing ? 'รักษาราชการแทน' : topExecStatus.status}
                    </span>
                  </div>
                </div>
              </div>

              {topExecStatus.status !== 'อยู่ปฏิบัติราชการ' && (
                <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/60 dark:bg-amber-950/10 dark:border-amber-900/40 space-y-1.5">
                  <div className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                    {topExecActing ? 'ข้อมูลผู้บริหารสูงสุดที่ถูกรักษาราชการแทน:' : 'ข้อมูลการปฏิบัติราชการ/ลา:'}
                  </div>
                  {topExecActing ? (
                    <>
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {topExec.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {topExec.position}
                      </div>
                      <div className="pt-1.5 border-t border-amber-200/40 dark:border-amber-900/20 text-[10px] text-amber-800 dark:text-amber-300 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold">สถานะ:</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold ${getStatusBadgeClass(topExecStatus.status)}`}>
                            {topExecStatus.status}
                          </span>
                        </div>
                        {(topExecStatus.location || topExecStatus.details) && (
                          <div>
                            {topExecStatus.location && `📍 สถานที่: ${topExecStatus.location}`}
                            {topExecStatus.details && ` • ${topExecStatus.details}`}
                          </div>
                        )}
                        {topExecStatus.startDate && (
                          <div className="text-slate-400 dark:text-slate-500 text-[9px] mt-0.5">
                            ช่วงเวลา: {topExecStatus.startDate} ถึง {topExecStatus.endDate}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="text-[10px] text-amber-750 dark:text-amber-300">
                      {topExecStatus.location && `📍 สถานที่: ${topExecStatus.location}`}
                      {topExecStatus.details && ` • ${topExecStatus.details}`}
                      {topExecStatus.startDate && ` (${topExecStatus.startDate} ถึง ${topExecStatus.endDate})`}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)] flex flex-col h-full">
            
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-white">ภารกิจผู้บริหารวันนี้</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">เรียงตามการเริ่มกำหนดการงานวันนี้</p>
            </div>

            <div className="mt-6 space-y-4 flex-1 overflow-y-auto max-h-[400px] pr-1">
              {todaysTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
                  ไม่มีภารกิจลงตารางไว้สำหรับวันนี้
                </div>
              ) : (
                todaysTasks
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .map((task, index) => {
                    const booking = bookings.find(b => b.taskId === task.id);
                    const room = rooms.find(r => r.id === booking?.roomId);
                    const isAuthorized = canViewTaskDetail(task);

                    const cardColorMap = [
                      {
                        bg: "bg-[#e8f1fc]/50 hover:bg-[#e8f1fc]/85 dark:bg-[#1a2d42]/20 dark:hover:bg-[#1a2d42]/35 border-[#c1d6ec]/30 dark:border-[#1c354e]/20",
                        text: "text-[#39668f] dark:text-[#a3c2e1]",
                        title: "text-[#1c354e] dark:text-slate-100"
                      },
                      {
                        bg: "bg-[#e6f4ea]/50 hover:bg-[#e6f4ea]/85 dark:bg-[#1a3825]/20 dark:hover:bg-[#1a3825]/35 border-[#c2e7cc]/30 dark:border-[#1e3d29]/20",
                        text: "text-[#137333] dark:text-[#81c784]",
                        title: "text-[#0f5224] dark:text-slate-100"
                      },
                      {
                        bg: "bg-[#fef7e0]/50 hover:bg-[#fef7e0]/85 dark:bg-[#3d331a]/20 dark:hover:bg-[#3d331a]/35 border-[#feefc3]/30 dark:border-[#3a3018]/20",
                        text: "text-[#b06000] dark:text-[#ffd54f]",
                        title: "text-[#7c4300] dark:text-slate-100"
                      },
                      {
                        bg: "bg-[#f3e8fd]/50 hover:bg-[#f3e8fd]/85 dark:bg-[#2d1b4b]/20 dark:hover:bg-[#2d1b4b]/35 border-[#e9d2fd]/30 dark:border-[#2b1947]/20",
                        text: "text-[#6200ee] dark:text-[#b388ff]",
                        title: "text-[#4a00b0] dark:text-slate-100"
                      }
                    ];
                    
                    const themeColors = cardColorMap[index % cardColorMap.length];

                    return (
                      <div 
                        key={task.id} 
                        onClick={() => handleEventClick(task.id)}
                        className={`p-4 border ${themeColors.bg} transition-all duration-200 cursor-pointer text-left space-y-2 relative overflow-hidden rounded-2xl`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <span className={`text-xs font-bold ${themeColors.title} line-clamp-2`}>
                            {maskTaskTitle(task)}
                          </span>
                          {getConfBadge(task.confidentialityLevel)}
                        </div>

                        {/* Times & Location */}
                        <div className={`space-y-1 text-[10px] ${themeColors.text} font-medium`}>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 opacity-80" />
                            <span>
                              {new Date(task.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                            </span>
                          </div>
                          {booking && (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 opacity-80" />
                              <span>{room?.name || 'ห้องประชุมถูกลบ'} (ชั้น {room?.floor})</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-150/10 dark:border-slate-800/10">
                          {getPriorityBadge(task.priority)}
                          <span className={`text-[9px] ${themeColors.text} font-bold uppercase opacity-85`}>
                            {task.status}
                          </span>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

          </div>
        </div>

        {/* Timeline View (Left 2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200/40 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md p-6 shadow-[0_8px_30px_rgb(0,0,0,0.015)]">
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
              <div>
                <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
                  <span>ตารางเวลาใช้งานห้องประชุมวันนี้</span>
                  <span className="text-xs font-medium text-slate-400">({baseDate})</span>
                </h2>
                <p className="text-xs text-slate-400 dark:text-slate-500">สถานะจองห้องว่างและจัดงานแบบ Real-time</p>
              </div>
              
              <button 
                onClick={() => setActivePage('Book a Room')}
                className="flex items-center gap-1.5 rounded-lg bg-enterprise-500 hover:bg-enterprise-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer shadow-sm shadow-enterprise-500/10"
              >
                <span>จองห้องเพิ่ม</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* Timeline Matrix */}
            <div className="mt-6 overflow-x-auto">
              <div className="min-w-[700px] select-none">
                
                {/* Timeline Header (Hours) */}
                <div className="flex border-b border-slate-100 dark:border-slate-800 pb-2">
                  <div className="w-1/4 text-xs font-bold text-slate-400">ชื่อห้อง / ความจุ</div>
                  <div className="w-3/4 relative flex justify-between px-2 text-[10px] font-bold text-slate-400">
                    {hours.map(h => (
                      <span key={h} className="w-0 text-center relative -left-2">{String(h).padStart(2, '0')}:00</span>
                    ))}
                    <span className="w-0 text-center relative -left-2">19:00</span>
                  </div>
                </div>

                {/* Timeline Rows per room */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 mt-2">
                  {rooms.map(room => {
                    // Get bookings for this room today
                    const roomBookings = todaysBookings.filter(b => b.roomId === room.id);
                    
                    return (
                      <div key={room.id} className="flex py-3.5 items-center">
                        {/* Room label */}
                        <div className="w-1/4 pr-4">
                          <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            {room.isVip && <span className="h-2 w-2 rounded-full bg-amber-500" title="ห้อง VIP"></span>}
                            {room.name}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                            ความจุ: {room.capacity} ที่นั่ง • ชั้น {room.floor}
                          </div>
                        </div>

                        {/* Booking Track */}
                        <div className="w-3/4 relative h-10 bg-slate-50/50 rounded-lg border border-dashed border-slate-200 dark:bg-slate-950/20 dark:border-slate-800/80 overflow-hidden">
                          {/* Hour grid lines */}
                          <div className="absolute inset-0 flex justify-between pointer-events-none px-2">
                            {hours.map(h => (
                              <div key={h} className="h-full border-l border-slate-100 dark:border-slate-800/40"></div>
                            ))}
                            <div></div>
                          </div>

                          {/* Render Events */}
                          {roomBookings.map(booking => {
                            const task = tasks.find(t => t.id === booking.taskId);
                            if (!task) return null;

                            const isAuthorized = canViewTaskDetail(task);
                            const title = maskTaskTitle(task);
                            
                            // Determine style based on priority or status
                            let bgClass = "bg-enterprise-500/10 border-enterprise-500/30 text-enterprise-700 dark:text-enterprise-300";
                            if (booking.approvalStatus === 'Pending') {
                              bgClass = "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300 border-dashed animate-pulse";
                            } else if (task.priority === 'ด่วนมาก') {
                              bgClass = "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300";
                            } else if (task.confidentialityLevel === 'Secret') {
                              bgClass = "bg-purple-500/10 border-purple-500/30 text-purple-700 dark:text-purple-300";
                            }

                            const left = getLeftOffset(booking.startTime);
                            const width = getWidthPercent(booking.startTime, booking.endTime);

                            return (
                              <div
                                key={booking.id}
                                onClick={() => handleEventClick(task.id)}
                                className={`absolute top-1 bottom-1 rounded-md border p-1 px-2 text-[10px] font-semibold transition-all hover:scale-[1.01] hover:shadow-sm cursor-pointer overflow-hidden flex flex-col justify-center leading-normal ${bgClass}`}
                                style={{ left, width }}
                                title={`${title} (${new Date(booking.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })})`}
                              >
                                <div className="truncate font-bold">{title}</div>
                                <div className="text-[8px] opacity-75 truncate">
                                  {booking.approvalStatus === 'Pending' ? '⏱️ รออนุมัติ' : `👤 ${isAuthorized ? task.attendees.length + ' คน' : 'จำกัดสิทธิ์'}`}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-enterprise-500"></span>
                <span>ประชุมทั่วไป</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                <span>ภารกิจด่วนมาก</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                <span>ภารกิจลับ / VIP</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-md border border-dashed border-amber-500 bg-amber-500/10 animate-pulse"></span>
                <span>จองรออนุมัติ</span>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Slide-out Panel / Modal for Task Details */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-enterprise-500" />
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">รายละเอียดภารกิจบูรณาการ</span>
                </div>
                <button 
                  onClick={() => {
                    setSelectedTask(null);
                    setSelectedBooking(null);
                  }}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Title & Confidentiality */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {getConfBadge(selectedTask.confidentialityLevel)}
                  {getPriorityBadge(selectedTask.priority)}
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                  {maskTaskTitle(selectedTask)}
                </h3>
              </div>

              {/* General Time info */}
              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/40 p-4 space-y-2 text-xs border border-slate-100 dark:border-slate-800/80">
                <div className="grid grid-cols-3 font-semibold">
                  <span className="text-slate-400">วันเวลา:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {new Date(selectedTask.startTime).toLocaleDateString('th-TH', { dateStyle: 'long' })}
                    <br />
                    เวลา {new Date(selectedTask.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(selectedTask.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </span>
                </div>
                
                <div className="grid grid-cols-3 font-semibold mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/40">
                  <span className="text-slate-400">ผู้บริหารติดภารกิจ:</span>
                  <span className="col-span-2 text-slate-800 dark:text-slate-200">
                    {executives.find(e => e.id === selectedTask.executiveId)?.name || 'ไม่มีระบุ'}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {executives.find(e => e.id === selectedTask.executiveId)?.position}
                    </div>
                  </span>
                </div>

                {selectedTask.department && (
                  <div className="grid grid-cols-3 font-semibold mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/40">
                    <span className="text-slate-400">หน่วยงาน/แผนก:</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200">{selectedTask.department}</span>
                  </div>
                )}
              </div>

              {/* Detail block */}
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">วัตถุประสงค์ / รายละเอียด</h4>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 bg-slate-50/50 dark:bg-slate-950/20 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60">
                  {maskTaskDesc(selectedTask)}
                </p>
              </div>

              {/* Meeting Attendees */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>ผู้เข้าร่วมประชุม ({canViewTaskDetail(selectedTask) ? selectedTask.attendees.length : 'จำกัดการเข้าถึง'})</span>
                </h4>
                {canViewTaskDetail(selectedTask) && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTask.attendees.map(email => (
                      <span key={email} className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2 py-1 rounded-md font-medium">
                        {email}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Room Booking Details */}
              {selectedBooking && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">ข้อมูลห้องประชุมและบริการเสริม</h4>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-enterprise-50/20 rounded-xl border border-enterprise-500/10 text-xs">
                      <div className="text-slate-400 font-semibold">ห้องประชุมที่จอง:</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mt-1">
                        {rooms.find(r => r.id === selectedBooking.roomId)?.name || 'ไม่พบห้อง'}
                      </div>
                      <div className="text-[9px] text-slate-400 mt-0.5">
                        สถานะอนุมัติ: <b>{selectedBooking.approvalStatus}</b>
                      </div>
                    </div>
                    
                    <div className="p-3 bg-indigo-50/20 rounded-xl border border-indigo-500/10 text-xs">
                      <div className="text-slate-400 font-semibold">รูปแบบจัดโต๊ะ:</div>
                      <div className="font-bold text-indigo-700 dark:text-indigo-300 mt-1">
                        {selectedBooking.layoutStyle}
                      </div>
                    </div>
                  </div>

                  {/* Requested Amenities */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">บริการและอุปกรณ์ที่ขอใช้:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedBooking.requestedAmenities.map(amenity => (
                        <span key={amenity} className="text-[10px] bg-enterprise-50 text-enterprise-700 dark:bg-enterprise-950/40 dark:text-enterprise-400 px-2 py-1 rounded-lg font-semibold">
                          💡 {amenity}
                        </span>
                      ))}
                      {selectedBooking.requestedAmenities.length === 0 && (
                        <span className="text-xs text-slate-400 italic">ไม่มีระบุอุปกรณ์พิเศษ</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Mission Brief Attachments */}
              {selectedTask.attachments && selectedTask.attachments.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Paperclip className="h-4 w-4 text-enterprise-500" />
                    <span>เอกสารแนบกำหนดการประชุม ({selectedTask.attachments.length} ไฟล์)</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.attachments.map((file, idx) => (
                      <div
                        key={idx}
                        onClick={() => {
                          setPreviewFile(file);
                          setZoomLevel(1);
                        }}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:bg-slate-100 dark:hover:bg-slate-900 hover:border-enterprise-500 dark:hover:border-enterprise-500 transition-all cursor-pointer group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-lg flex-shrink-0 group-hover:scale-110 transition-transform">📄</span>
                          <div className="text-left min-w-0">
                            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-enterprise-600 dark:group-hover:text-enterprise-400 transition-colors">
                              {file.fileName}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              ขนาด: {(file.fileSize / 1024).toFixed(1)} KB
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                          <span className="text-[10px] font-bold text-enterprise-500 hover:underline">
                            ดูตัวอย่าง / ดาวน์โหลด
                          </span>
                          {canEditTask(currentUser.role, selectedTask.createdBy, currentUser.id) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAttachment(file.fileName);
                              }}
                              className="text-[10px] font-bold text-rose-500 hover:text-rose-600 hover:underline cursor-pointer"
                              title="ลบไฟล์แนบออกจากภารกิจ"
                            >
                              ลบไฟล์
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Actions Footer */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6 flex flex-col sm:flex-row gap-2">
              <button 
                onClick={() => {
                  setSelectedTask(null);
                  setSelectedBooking(null);
                }}
                className="flex-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 py-2.5 text-xs font-semibold cursor-pointer"
              >
                ปิดหน้าต่าง
              </button>
              
              {selectedTask && canEditTask(currentUser.role, selectedTask.createdBy, currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTaskId(selectedTask.id);
                    setActivePage('Book a Room');
                    setSelectedTask(null);
                    setSelectedBooking(null);
                  }}
                  className="flex-1 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 text-white py-2.5 text-xs font-semibold cursor-pointer"
                >
                  แก้ไขภารกิจ
                </button>
              )}

              {selectedTask && canCancelTask(currentUser.role, selectedTask.createdBy, currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    const id = selectedTask.id;
                    setSelectedTask(null);
                    setSelectedBooking(null);
                    
                    // Show sweetalert warning for cancellation
                    Swal.fire({
                      title: 'คุณต้องการยกเลิกภารกิจ?',
                      text: 'การดำเนินการนี้จะส่งสัญญานยกเลิกไปยังผู้รับผิดชอบจัดสถานที่และคืนห้องประชุมเข้าสู่ระบบทันที',
                      icon: 'warning',
                      showCancelButton: true,
                      confirmButtonText: 'ใช่, ยกเลิกภารกิจ',
                      cancelButtonText: 'ยกเลิก'
                    }).then((result) => {
                      if (result.isConfirmed) {
                        cancelTask(id);
                      }
                    });
                  }}
                  className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white py-2.5 text-xs font-semibold cursor-pointer"
                >
                  ยกเลิกภารกิจนี้
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-4xl flex items-center justify-between pb-4 border-b border-slate-800 text-slate-200 mb-4">
            <div className="min-w-0 flex-1 pr-4">
              <h3 className="text-sm font-bold truncate">{previewFile.fileName}</h3>
              <p className="text-[10px] text-slate-500 mt-0.5">ขนาด: {(previewFile.fileSize / 1024).toFixed(1)} KB</p>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {isImageFile(previewFile.fileName) && (
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 mr-2">
                  <button 
                    type="button"
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-slate-850 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    title="ซูมออก"
                  >
                    ➖
                  </button>
                  <button 
                    type="button"
                    onClick={handleResetZoom}
                    className="px-2.5 py-2 hover:bg-slate-850 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    title="ขนาดจริง 100%"
                  >
                    {Math.round(zoomLevel * 100)}%
                  </button>
                  <button 
                    type="button"
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-slate-850 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                    title="ซูมเข้า"
                  >
                    ➕
                  </button>
                </div>
              )}

              {selectedTask && canEditTask(currentUser.role, selectedTask.createdBy, currentUser.id) && (
                <button
                  type="button"
                  onClick={() => {
                    const fileName = previewFile.fileName;
                    setPreviewFile(null);
                    handleDeleteAttachment(fileName);
                  }}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer mr-1"
                  title="ลบไฟล์แนบออกจากภารกิจ"
                >
                  🗑️ ลบไฟล์
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDownloadFile(previewFile.fileUrl, previewFile.fileName)}
                className="px-3.5 py-2 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-enterprise-500/10"
              >
                <span>📥 ดาวน์โหลด</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setPreviewFile(null);
                  setZoomLevel(1);
                }}
                className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white cursor-pointer transition-colors ml-1"
                title="ปิดการดูตัวอย่าง"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 w-full max-w-4xl bg-slate-900 rounded-3xl border border-slate-800/80 flex items-center justify-center overflow-auto relative p-6 min-h-[350px]">
            {isImageFile(previewFile.fileName) ? (
              <div className="transition-transform duration-150 ease-out" style={{ transform: `scale(${zoomLevel})` }}>
                <img 
                  src={previewFile.fileUrl} 
                  alt={previewFile.fileName} 
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-2xl" 
                />
              </div>
            ) : isPdfFile(previewFile.fileName) ? (
              <iframe 
                src={previewFile.fileUrl} 
                title={previewFile.fileName} 
                className="w-full h-full min-h-[60vh] rounded-2xl border-0 bg-white"
              />
            ) : (
              <div className="text-center p-8 space-y-4 max-w-sm">
                <div className="text-5xl">📦</div>
                <h4 className="text-sm font-bold text-slate-200">ไม่รองรับการแสดงผลตัวอย่างไฟล์ประเภทนี้</h4>
                <p className="text-xs text-slate-400">ระบบไม่สามารถเปิดดูไฟล์นี้นอกเบราว์เซอร์ได้โดยตรง กรุณาใช้ปุ่มดาวน์โหลดด้านบนเพื่อบันทึกไฟล์ลงเครื่อง</p>
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewFile.fileUrl, previewFile.fileName)}
                  className="inline-flex px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold gap-2 justify-center items-center transition-all cursor-pointer border border-slate-700 w-full"
                >
                  <span>📥 ดาวน์โหลดไฟล์ทันที</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
