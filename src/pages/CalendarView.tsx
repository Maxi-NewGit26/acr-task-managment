import React, { useState, useRef, useEffect } from 'react';
import { useApp, Task, RoomBooking, MeetingRoom } from '../context/AppContext';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import { Printer, ShieldAlert, MapPin, Clock, Users, Plus, Calendar, Paperclip } from 'lucide-react';
import Swal from 'sweetalert2';
import { hasPermission, canEditTask, canCancelTask } from '../rbac';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getLocalYYYYMMDD } from '../utils/dateUtils';

export const CalendarView: React.FC<{ setActivePage: (page: string) => void }> = ({ setActivePage }) => {
  const { 
    tasks, 
    bookings, 
    rooms, 
    executives, 
    canViewTaskDetail, 
    maskTaskTitle, 
    maskTaskDesc,
    currentUser,
    assignments,
    cancelTask,
    setEditingTaskId,
    updateTask
  } = useApp();

  if (!currentUser) return null;

  // RBAC: Filter tasks based on role visibility
  const visibleTasks = tasks.filter(t => {
    if (hasPermission(currentUser.role, 'task:view_all')) return true;
    if (canViewTaskDetail(t)) return true;
    // Operational roles: only see tasks where they have assignments
    if (hasPermission(currentUser.role, 'task:view_assigned')) {
      return assignments.some(a => a.taskId === t.id && a.assignedToRole === currentUser.role);
    }
    return t.confidentialityLevel === 'Public' || t.confidentialityLevel === 'Internal';
  });

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<RoomBooking | null>(null);
  const [previewFile, setPreviewFile] = useState<{ fileName: string; fileUrl: string; fileSize: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

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

  const printRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Date focused state - default to current local date
  const [focusedDate, setFocusedDate] = useState(getLocalYYYYMMDD());

  // Responsive mobile state
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Transform Tasks into FullCalendar Events
  const calendarEvents = visibleTasks
    .filter(t => t.status !== 'Cancelled')
    .map(task => {
      const exec = executives.find(e => e.id === task.executiveId);
      const booking = bookings.find(b => b.taskId === task.id);
      const room = rooms.find(r => r.id === booking?.roomId);
      
      const title = maskTaskTitle(task);
      const label = `${task.priority === 'ด่วนมาก' ? '🔴 ' : ''}${title} (${exec?.name || ''})`;

      return {
        id: task.id,
        title: label,
        start: task.startTime,
        end: task.endTime,
        backgroundColor: exec?.colorCode || '#3b82f6',
        borderColor: exec?.colorCode || '#3b82f6',
        extendedProps: {
          task,
          booking,
          room,
          exec
        }
      };
    });

  // Handle Event Click
  const handleEventClick = (info: any) => {
    const { task, booking } = info.event.extendedProps;
    setSelectedTask(task);
    setSelectedBooking(booking || null);
  };

  // Handle Date Click cell
  const handleDateClick = (arg: any) => {
    setFocusedDate(arg.dateStr);
    
    // Smooth scroll to the list below on mobile
    if (isMobile) {
      setTimeout(() => {
        const element = document.getElementById('daily-agenda-list-section');
        element?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  // Export/Print Daily Agenda - Opens preview modal
  const handlePrintDaily = () => {
    setIsPreviewModalOpen(true);
  };

  // Actual print trigger
  const triggerPrint = () => {
    window.print();
  };

  const prepareElementForCapture = (element: HTMLElement) => {
    const originalStyles = {
      position: element.style.position,
      left: element.style.left,
      top: element.style.top,
      width: element.style.width,
      boxShadow: element.style.boxShadow,
      border: element.style.border,
      borderRadius: element.style.borderRadius,
      zIndex: element.style.zIndex,
    };

    element.style.position = 'fixed';
    element.style.left = '-9999px';
    element.style.top = '0';
    element.style.width = '1120px'; // A4 landscape width representation
    element.style.boxShadow = 'none';
    element.style.border = 'none';
    element.style.borderRadius = '0';
    element.style.zIndex = '99999';

    return () => {
      element.style.position = originalStyles.position;
      element.style.left = originalStyles.left;
      element.style.top = originalStyles.top;
      element.style.width = originalStyles.width;
      element.style.boxShadow = originalStyles.boxShadow;
      element.style.border = originalStyles.border;
      element.style.borderRadius = originalStyles.borderRadius;
      element.style.zIndex = originalStyles.zIndex;
    };
  };

  // Download as PDF
  const downloadPDF = async () => {
    try {
      Swal.fire({
        title: 'กำลังสร้างไฟล์ PDF...',
        text: 'กรุณารอสักครู่ขณะระบบจัดทำเอกสาร PDF',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const element = previewRef.current;
      if (!element) throw new Error('ไม่พบข้อมูลตารางรายงาน');

      const restoreStyles = prepareElementForCapture(element);

      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for high-quality text rendering
        useCORS: true,
        logging: false,
      });

      restoreStyles();

      const imgWidth = 297; // A4 landscape size in mm (width)
      const pageHeight = 210; // A4 landscape size in mm (height)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      const doc = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape
      let position = 0;
      const imgData = canvas.toDataURL('image/jpeg', 0.95);

      doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        doc.addPage();
        doc.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      doc.save(`Daily_Agenda_${printDate}.pdf`);

      Swal.close();
      Swal.fire({
        title: 'ดาวน์โหลด PDF สำเร็จ!',
        text: `บันทึกไฟล์รายงานประจำวันที่ ${formatThaiDate(printDate)} เรียบร้อยแล้ว`,
        icon: 'success',
        confirmButtonText: 'ตกลง'
      });
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      Swal.close();
      Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถสร้างไฟล์ PDF ได้: ${error.message}`, 'error');
    }
  };

  // Download as Image (PNG/JPG)
  const downloadImage = async (format: 'png' | 'jpeg') => {
    try {
      Swal.fire({
        title: 'กำลังสร้างรูปภาพ...',
        text: 'กรุณารอสักครู่ขณะระบบแปลงตารางรายงานเป็นรูปภาพ',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const element = previewRef.current;
      if (!element) throw new Error('ไม่พบข้อมูลตารางรายงาน');

      const restoreStyles = prepareElementForCapture(element);

      const canvas = await html2canvas(element, {
        scale: 2, // 2x scale for high resolution
        useCORS: true,
        logging: false,
      });

      restoreStyles();

      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      const imgData = canvas.toDataURL(mimeType, 0.95);
      const link = document.createElement('a');
      link.href = imgData;
      link.download = `Daily_Agenda_${printDate}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      Swal.close();
      Swal.fire({
        title: 'ดาวน์โหลดรูปภาพสำเร็จ!',
        text: `บันทึกรูปภาพตารางรายงานประจำวันที่ ${formatThaiDate(printDate)} ในรูปแบบ ${format.toUpperCase()} เรียบร้อยแล้ว`,
        icon: 'success',
        confirmButtonText: 'ตกลง'
      });
    } catch (error: any) {
      console.error('Error downloading image:', error);
      Swal.close();
      Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถสร้างรูปภาพได้: ${error.message}`, 'error');
    }
  };

  const getPriorityBadge = (priority: string) => {
    const base = "px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center ";
    switch (priority) {
      case 'ด่วนมาก':
        return <span className={`${base} bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400`}>ด่วนมาก</span>;
      case 'ด่วน':
        return <span className={`${base} bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400`}>ด่วน</span>;
      case 'ภารกิจลับ':
        return <span className={`${base} bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400`}>ภารกิจลับ</span>;
      default:
        return <span className={`${base} bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400`}>ปกติ</span>;
    }
  };

  const getConfBadge = (level: string) => {
    const base = "px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider uppercase ";
    switch (level) {
      case 'Secret':
        return <span className={`${base} bg-rose-500 text-white`}>Secret</span>;
      case 'Confidential':
        return <span className={`${base} bg-amber-500 text-white`}>Confidential</span>;
      default:
        return <span className={`${base} bg-emerald-500 text-white`}>Public</span>;
    }
  };

  // Format date for Thai headers
  const formatThaiDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  // Get tasks for active focused date
  const focusedDateTasks = visibleTasks
    .filter(t => t.startTime && t.startTime.startsWith(focusedDate) && t.status !== 'Cancelled')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  // Print-oriented task lists
  const [printDate, setPrintDate] = useState(focusedDate);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  useEffect(() => {
    setPrintDate(focusedDate);
  }, [focusedDate]);

  const printTasks = visibleTasks
    .filter(t => t.startTime && t.startTime.startsWith(printDate) && t.status !== 'Cancelled')
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const renderPrintableDocument = () => {
    return (
      <div 
        className="bg-white text-black p-10 text-left saraban-font"
      >
        {/* Header Section */}
        <div className="text-center pb-2 mb-3">
          <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">รายงานตารางปฏิบัติราชการและภารกิจผู้บริหารประจำวัน</h1>
          <p className="text-[10px] text-slate-500 mt-1 font-bold tracking-wider uppercase font-sans">
            ระบบบริหารจัดการภารกิจบูรณาการ • Integrated Task & Facility Management System
          </p>
          
          {/* Elegant Divider Line */}
          <div className="flex items-center justify-center gap-1.5 mt-2.5">
            <div className="h-[2px] bg-slate-900 w-24 rounded-full" />
            <div className="h-[5px] w-[5px] bg-amber-500 rounded-full" />
            <div className="h-[2px] bg-slate-900 w-24 rounded-full" />
          </div>

          <div className="mt-3 flex justify-center">
            <span className="inline-flex items-center justify-center text-[11px] text-slate-850 font-extrabold bg-slate-100 border border-slate-250 px-4 py-1 h-7 rounded-full shadow-sm leading-none">
              <span className="-translate-y-[1.5px] inline-block">
                {new Date(printDate).toLocaleDateString('th-TH', { dateStyle: 'full' })}
              </span>
            </span>
          </div>
        </div>

        {/* Main Table */}
        <table className="w-full border-collapse text-[11px] rounded-lg overflow-hidden shadow-sm printable-table-custom">
          <thead>
            <tr className="bg-slate-900 text-white font-bold text-[10px] tracking-wider uppercase">
              <th className="p-3 w-[12%] text-center">เวลา</th>
              <th className="p-3 w-[18%] text-left">ผู้บริหาร</th>
              <th className="p-3 w-[32%] text-left">หัวข้อภารกิจ / รายละเอียด</th>
              <th className="p-3 w-[15%] text-left">สถานที่ / ห้องประชุม</th>
              <th className="p-3 w-[13%] text-left">ผู้เข้าร่วมประชุม</th>
              <th className="p-3 w-[10%] text-center">หน่วยงาน/แผนก</th>
            </tr>
          </thead>
          <tbody>
            {printTasks.map((task, idx) => {
              const exec = executives.find(e => e.id === task.executiveId);
              const booking = bookings.find(b => b.taskId === task.id);
              const room = rooms.find(r => r.id === booking?.roomId);
              const title = maskTaskTitle(task);
              const desc = maskTaskDesc(task);

              return (
                <tr 
                  key={task.id} 
                  className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/60 transition-colors`}
                >
                  <td className="p-3 font-bold text-center text-slate-900 bg-slate-50/20">
                    {new Date(task.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                  </td>
                  <td className="p-3 font-bold text-slate-900">
                    <div className="text-slate-900">{exec?.name}</div>
                    <div className="text-[9px] font-normal text-slate-500 mt-0.5">{exec?.position}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-bold text-slate-900">{title}</div>
                    {desc && <div className="text-[10px] text-slate-500 mt-1 whitespace-pre-line leading-relaxed">{desc}</div>}
                  </td>
                  <td className="p-3 text-slate-800">
                    {room ? (
                      <div className="font-semibold text-slate-900 flex items-start gap-1">
                        <span className="flex-shrink-0">🏢</span>
                        <div>
                          <div>{room.name}</div>
                          <div className="text-[9px] text-slate-500 font-normal mt-0.5">ชั้น {room.floor}</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">ไม่ได้ใช้ห้องประชุม</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-800">
                    {task.attendees && task.attendees.length > 0 ? (
                      <div className="flex flex-col gap-1.5 text-[9.5px] text-slate-700 font-normal leading-normal">
                        {task.attendees.map((att, index) => (
                          <div key={index} className="break-all" title={att}>
                            • {att}
                          </div>
                        ))}
                      </div>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="p-3 text-center text-slate-800 bg-slate-50/10">
                    {task.department || exec?.department || '-'}
                  </td>
                </tr>
              );
            })}
            {printTasks.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                  ไม่มีรายการภารกิจสำหรับวันนี้
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Footer Page Meta (visible on print/preview) */}
        <div className="mt-8 pt-4 border-t border-slate-400 flex justify-between items-center text-[10px] text-slate-400 font-medium">
          <span>ออกรายงานโดยระบบอัตโนมัติเมื่อ: {new Date().toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' })} น.</span>
          <span>เอกสารชั้นความลับทั่วไป • หน้า 1 จาก 1</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Calendar Header Control */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">ปฏิทินภารกิจและตารางผู้บริหาร</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">จัดการข้อมูลภารกิจ ตรวจสอบคิวห้องประชุมและการทับซ้อน</p>
        </div>

        <div className="flex items-center gap-2 relative">
          <input
            type="date"
            value={printDate}
            onChange={(e) => setPrintDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-750 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 cursor-pointer shadow-sm"
          />
          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-350 cursor-pointer shadow-sm transition-all"
          >
            <Printer className="h-4 w-4 text-enterprise-500" />
            <span>ดูตัวอย่างและออกรายงาน</span>
          </button>
        </div>
      </div>

      {/* Main Calendar View Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Calendar Widget (Left 2 cols on desktop, full width on mobile) */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200/80 bg-white p-3 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <FullCalendar
            key={isMobile ? 'mobile-calendar' : 'desktop-calendar'}
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            initialDate={focusedDate}
            headerToolbar={{
              left: 'prev,next',
              center: 'title',
              right: isMobile ? '' : 'dayGridMonth,timeGridWeek,timeGridDay,listWeek'
            }}
            locale="th"
            events={calendarEvents}
            eventClick={handleEventClick}
            dateClick={handleDateClick}
            height={isMobile ? 'auto' : '650px'}
            expandRows={true}
            slotMinTime="08:00:00"
            slotMaxTime="19:00:00"
            nowIndicator={true}
          />
        </div>

        {/* Dynamic Daily List (Right 1 col, stacks underneath on mobile) */}
        <div id="daily-agenda-list-section" className="space-y-4 text-left">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-enterprise-500 flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>ตารางประจำวัน</span>
                </span>
                <h3 className="text-xs sm:text-sm font-extrabold text-slate-800 dark:text-white mt-1">
                  {formatThaiDate(focusedDate)}
                </h3>
              </div>
              
              <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold px-2 py-0.5 rounded-full">
                {focusedDateTasks.length} งาน
              </span>
            </div>

            {/* List items */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {focusedDateTasks.map(task => {
                const booking = bookings.find(b => b.taskId === task.id);
                const room = rooms.find(r => r.id === booking?.roomId);
                const exec = executives.find(e => e.id === task.executiveId);

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task);
                      setSelectedBooking(booking || null);
                    }}
                    className="p-3.5 rounded-xl border border-slate-100 hover:border-enterprise-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer transition-all space-y-2 relative"
                  >
                    <div className="flex justify-between items-start gap-1">
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 line-clamp-2">
                        {maskTaskTitle(task)}
                      </div>
                      {getConfBadge(task.confidentialityLevel)}
                    </div>

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 space-y-1">
                      <div className="flex items-center gap-1 font-medium">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        <span>
                          เวลา {new Date(task.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - {new Date(task.endTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">ผู้บริหาร: <b>{exec?.name}</b></span>
                      </div>
                      {booking && (
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">สถานที่: {room?.name} (ชั้น {room?.floor})</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-1.5 border-t border-slate-100 dark:border-slate-800">
                      {getPriorityBadge(task.priority)}
                      <span className="text-[9px] text-slate-400 uppercase font-semibold">
                        {task.status}
                      </span>
                    </div>
                  </div>
                );
              })}

              {focusedDateTasks.length === 0 && (
                <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500 italic space-y-2">
                  <div className="text-2xl">🗒️</div>
                  <div>ไม่มีภารกิจผู้บริหารในวันดังกล่าว</div>
                </div>
              )}
            </div>

            {/* Quick add button for the focused date */}
            {['Admin', 'Super Admin', 'Secretary'].includes(currentUser.role) && (
              <button
                type="button"
                onClick={() => {
                  // Simply redirect and pass date. In a real React router, we'd use state.
                  // For this sandbox SPA, we can update localstorage or simulate a click to Book a Room page
                  // Let's hook a click to let TaskForm handle focused Date.
                  Swal.fire({
                    title: 'สร้างภารกิจใหม่?',
                    text: `ต้องการสร้างภารกิจในวันที่ ${formatThaiDate(focusedDate)} หรือไม่`,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'ใช่, ไปหน้ากรอกฟอร์ม'
                  }).then((result) => {
                    if (result.isConfirmed) {
                      // Navigate via direct click simulation or window trigger (we let App handle it)
                      // In a real app we pass state, for this mock we can write date to localStorage so TaskForm pulls it
                      localStorage.setItem('tf_form_preset_date', focusedDate);
                      const btnBook = document.querySelectorAll('button');
                      btnBook.forEach(b => {
                        if (b.innerText.includes('ลงภารกิจ / จองห้อง') || b.innerText.includes('Book a Room')) {
                          b.click();
                        }
                      });
                    }
                  });
                }}
                className="w-full rounded-xl border border-dashed border-slate-200 hover:border-enterprise-500 bg-slate-50/50 hover:bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 py-3 text-xs font-semibold cursor-pointer transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มภารกิจสำหรับวันที่ {new Date(focusedDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
              </button>
            )}

          </div>
        </div>

      </div>

      {/* Slide-out Panel for Event Details */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200">
          <div className="h-full w-full max-w-lg bg-white p-6 shadow-2xl dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 overflow-y-auto flex flex-col justify-between animate-in slide-in-from-right duration-200">
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-enterprise-500" />
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">รายละเอียดตารางผู้บริหาร</span>
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

              {/* Time Details */}
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
                  <span className="col-span-2 text-slate-800 dark:text-slate-200 font-bold text-enterprise-600 dark:text-enterprise-400">
                    {executives.find(e => e.id === selectedTask.executiveId)?.name || 'ไม่มีระบุ'}
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {executives.find(e => e.id === selectedTask.executiveId)?.position}
                    </div>
                  </span>
                </div>

                {selectedTask.department && (
                  <div className="grid grid-cols-3 font-semibold mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-800/40">
                    <span className="text-slate-400">หน่วยงาน/แผนก:</span>
                    <span className="col-span-2 text-slate-800 dark:text-slate-200 font-semibold">{selectedTask.department}</span>
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

              {/* Attendees */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="h-4 w-4" />
                  <span>ผู้เข้าร่วมประชุม ({canViewTaskDetail(selectedTask) ? selectedTask.attendees.length : 'จำกัดการเข้าถึง'})</span>
                </h4>
                {canViewTaskDetail(selectedTask) && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTask.attendees.map(email => (
                      <span key={email} className="text-[10px] bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 px-2.5 py-1 rounded-md font-medium">
                        {email}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Room details */}
              {selectedBooking && (
                <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/85">
                  <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">รายละเอียดการจองห้องประชุม</h4>
                  
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
                    <div className="text-[10px] font-bold text-slate-400 uppercase">บริการและอุปกรณ์ที่จอง:</div>
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

      {/* Print Preview Modal */}
      {isPreviewModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-4 md:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-slate-100 dark:bg-slate-950 w-full max-w-6xl h-[90vh] rounded-3xl shadow-2xl flex flex-col md:flex-row overflow-hidden border border-slate-200 dark:border-slate-800">
            
            {/* Left Side: Document Preview Canvas */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-500/10 dark:bg-slate-900/40 flex justify-center items-start">
              <div 
                ref={previewRef}
                className="bg-white text-black p-8 md:p-12 shadow-lg border border-slate-250 w-full max-w-[297mm] min-h-[210mm] text-left font-sans rounded-sm"
              >
                {renderPrintableDocument()}
              </div>
            </div>

            {/* Right Side: Control & Actions Panel */}
            <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">เครื่องมือออกรายงาน</h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    ตรวจสอบตัวอย่างเอกสารทางซ้ายมือ และเลือกรูปแบบดาวน์โหลดที่คุณต้องการ
                  </p>
                </div>

                <div className="space-y-2.5">
                  <button
                    onClick={() => {
                      triggerPrint();
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
                  >
                    <span>🖨️</span>
                    <span>พิมพ์รายงาน (Print Dialog)</span>
                  </button>

                  <button
                    onClick={downloadPDF}
                    className="w-full py-2.5 px-4 rounded-xl bg-enterprise-600 hover:bg-enterprise-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-enterprise-600/10"
                  >
                    <span>📄</span>
                    <span>ดาวน์โหลดเป็นไฟล์ PDF</span>
                  </button>

                  <button
                    onClick={() => downloadImage('png')}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-emerald-600/10"
                  >
                    <span>🖼️</span>
                    <span>ดาวน์โหลดเป็นรูปภาพ PNG</span>
                  </button>

                  <button
                    onClick={() => downloadImage('jpeg')}
                    className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md shadow-indigo-600/10"
                  >
                    <span>🖼️</span>
                    <span>ดาวน์โหลดเป็นรูปภาพ JPG</span>
                  </button>
                </div>
              </div>

              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="w-full mt-6 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 text-xs font-bold cursor-pointer transition-all"
              >
                ปิดหน้าต่างตัวอย่าง
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Hidden PDF/Print Area */}
      <div className="hidden print:block" ref={printRef}>
        {renderPrintableDocument()}
      </div>
      
      {/* Dynamic print stylesheet */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');
        
        .saraban-font {
          font-family: 'Sarabun', sans-serif !important;
        }

        .printable-table-custom {
          border-collapse: collapse !important;
          border: 1.5px solid #475569 !important;
        }
        .printable-table-custom th,
        .printable-table-custom td {
          border: 1.5px solid #475569 !important;
        }

        @media print {
          @page {
            size: landscape;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          .print\\:block, .print\\:block * {
            visibility: visible;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
          }
          html, body {
            height: auto !important;
            overflow: hidden !important;
          }
        }
      `}</style>

    </div>
  );
};
