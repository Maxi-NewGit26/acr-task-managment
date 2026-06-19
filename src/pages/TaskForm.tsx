import React, { useState, useEffect } from 'react';
import { useApp, UserRole, PriorityLevel, ConfidentialityLevel } from '../context/AppContext';
import { 
  AlertTriangle, 
  Check, 
  Users, 
  MapPin, 
  Clock, 
  Sparkles, 
  Shield, 
  Paperclip,
  CheckSquare,
  Coffee,
  Tv,
  ListTodo,
  Building
} from 'lucide-react';
import Swal from 'sweetalert2';
import { hasPermission, canEditTask } from '../rbac';

export const TaskForm: React.FC<{ setActivePage: (page: string) => void }> = ({ setActivePage }) => {
  const { 
    executives, 
    rooms, 
    createTask, 
    updateTask,
    checkScheduleConflict, 
    getSmartRecommendations,
    currentUser,
    tasks,
    bookings,
    assignments,
    editingTaskId,
    setEditingTaskId,
    departments
  } = useApp();

  if (!currentUser) return null;

  // Task Form State
  const [title, setTitle] = useState('');
  const [executiveId, setExecutiveId] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('ปกติ');
  const [confidentialityLevel, setConfidentialityLevel] = useState<ConfidentialityLevel>('Internal');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [description, setDescription] = useState('');
  const [attendeesInput, setAttendeesInput] = useState('');
  const [department, setDepartment] = useState(currentUser.department || '');
  
  // Room Booking Toggles
  const [requireRoom, setRequireRoom] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [layoutStyle, setLayoutStyle] = useState<'U-Shape' | 'Classroom' | 'Theater' | 'Standard'>('Standard');
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  
  // Attachment Files State
  const [filesToUpload, setFilesToUpload] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<{ fileName: string; fileUrl: string; fileSize: number }[]>([]);

  // Room Filters State
  const [filterCapacity, setFilterCapacity] = useState(0);
  const [filterBuilding, setFilterBuilding] = useState('');
  const [filterVipOnly, setFilterVipOnly] = useState(false);

  // Filtered Rooms List to render
  const filteredRoomsList = rooms.filter(room => {
    if (filterCapacity > 0 && room.capacity < filterCapacity) return false;
    if (filterBuilding && room.building !== filterBuilding) return false;
    if (filterVipOnly && !room.isVip) return false;
    return true;
  });

  // Conflicts & Recommendations State
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [roomRecommendations, setRoomRecommendations] = useState<any[]>([]);
  const [timeRecommendations, setTimeRecommendations] = useState<any[]>([]);

  // Auto-delegate subtask choices
  const [delegateIT, setDelegateIT] = useState(false);
  const [delegateHousekeeping, setDelegateHousekeeping] = useState(false);
  const [delegateCatering, setDelegateCatering] = useState(false);

  // Computed Date Time Strings
  const fullStartISO = `${startDate}T${startTime}:00`;
  const fullEndISO = `${endDate}T${endTime}:00`;

  // Load editing task info if preset
  useEffect(() => {
    if (editingTaskId) {
      const taskToEdit = tasks.find(t => t.id === editingTaskId);
      if (taskToEdit) {
        setTitle(taskToEdit.title);
        setExecutiveId(taskToEdit.executiveId);
        setPriority(taskToEdit.priority);
        setConfidentialityLevel(taskToEdit.confidentialityLevel);
        
        if (taskToEdit.startTime) {
          const sParts = taskToEdit.startTime.split('T');
          setStartDate(sParts[0]);
          setStartTime(sParts[1] ? sParts[1].substring(0, 5) : '09:00');
        }
        if (taskToEdit.endTime) {
          const eParts = taskToEdit.endTime.split('T');
          setEndDate(eParts[0]);
          setEndTime(eParts[1] ? eParts[1].substring(0, 5) : '10:30');
        }
        
        setDescription(taskToEdit.description);
        setAttendeesInput(taskToEdit.attendees ? taskToEdit.attendees.join(', ') : '');

        const booking = bookings.find(b => b.taskId === editingTaskId);
        if (booking) {
          setRequireRoom(true);
          setSelectedRoomId(booking.roomId);
          setLayoutStyle(booking.layoutStyle);
          setSelectedAmenities(booking.requestedAmenities || []);
        } else {
          setRequireRoom(false);
          setSelectedRoomId('');
          setLayoutStyle('Standard');
          setSelectedAmenities([]);
        }

        const taskAssignments = assignments.filter(a => a.taskId === editingTaskId);
        setDelegateIT(taskAssignments.some(a => a.assignedToRole === 'IT Support'));
        setDelegateHousekeeping(taskAssignments.some(a => a.assignedToRole === 'Housekeeping' && a.title.includes('จัดสถานที่')));
        setDelegateCatering(taskAssignments.some(a => a.assignedToRole === 'Housekeeping' && a.title.includes('อาหารว่าง')));
        setExistingAttachments(taskToEdit.attachments || []);
        setDepartment(taskToEdit.department || '');
      }
    } else {
      // Clear/Reset for creation
      setTitle('');
      setExecutiveId('');
      setPriority('ปกติ');
      setConfidentialityLevel('Internal');
      const presetDate = localStorage.getItem('tf_form_preset_date') || '';
      setStartDate(presetDate);
      setEndDate(presetDate);
      localStorage.removeItem('tf_form_preset_date');
      setStartTime('');
      setEndTime('');
      setDescription('');
      setAttendeesInput('');
      setRequireRoom(false);
      setSelectedRoomId('');
      setLayoutStyle('Standard');
      setSelectedAmenities([]);
      setDelegateIT(false);
      setDelegateHousekeeping(false);
      setDelegateCatering(false);
      setExistingAttachments([]);
      setDepartment(currentUser.department || '');
    }
  }, [editingTaskId, tasks, bookings, assignments, executives]);

  // Watch fields to trigger real-time availability evaluation
  useEffect(() => {
    if (!startDate || !startTime || !endDate || !endTime || !executiveId) {
      setConflictWarning(null);
      setRoomRecommendations([]);
      setTimeRecommendations([]);
      return;
    }

    // 1. Check Conflicts
    const conflict = checkScheduleConflict(
      fullStartISO, 
      fullEndISO, 
      requireRoom ? selectedRoomId : undefined, 
      executiveId
    );

    if (conflict.hasConflict) {
      if (conflict.execConflict) {
        setConflictWarning(`⚠️ ผู้บริหารติดภารกิจซ้อน: "${conflict.execConflict.conflictingTaskTitle}"`);
      } else if (conflict.roomConflict) {
        setConflictWarning(`⚠️ ห้องประชุมถูกจองแล้ว: "${conflict.roomConflict.conflictingTaskTitle}"`);
      }
    } else {
      setConflictWarning(null);
    }

    // 2. Fetch Smart Suggestions if conflict or if no room selected yet
    const currentRoom = rooms.find(r => r.id === selectedRoomId);
    const reqCapacity = filterCapacity || 0;
    const reqAmenities = selectedAmenities;
    const reqVip = filterVipOnly || currentRoom?.isVip || false;

    const recommendations = getSmartRecommendations(
      fullStartISO,
      fullEndISO,
      reqCapacity,
      reqAmenities,
      reqVip,
      executiveId
    );

    setRoomRecommendations(recommendations.rooms);
    setTimeRecommendations(recommendations.times);

  }, [
    startDate, 
    startTime, 
    endDate, 
    endTime, 
    executiveId, 
    requireRoom, 
    selectedRoomId, 
    filterCapacity, 
    selectedAmenities, 
    filterVipOnly
  ]);

  // Removed default executive watcher to avoid triggering conflicts on empty form

  // Set default room if requireRoom is true and no room is selected
  useEffect(() => {
    if (requireRoom && !selectedRoomId && filteredRoomsList.length > 0) {
      setSelectedRoomId(filteredRoomsList[0].id);
    }
  }, [requireRoom, selectedRoomId, filteredRoomsList.length]);

  // Handle Amenity Selection
  const toggleAmenity = (amenity: string) => {
    setSelectedAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      setFilesToUpload(prev => [...prev, ...selected]);
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาระบุชื่อหัวข้อภารกิจ', 'error');
      return;
    }

    if (!executiveId) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาระบุผู้บริหารผู้รับผิดชอบ', 'error');
      return;
    }

    if (requireRoom && !selectedRoomId) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาเลือกห้องประชุมที่ต้องการจอง', 'error');
      return;
    }

    const startDT = new Date(fullStartISO);
    const endDT = new Date(fullEndISO);
    if (endDT <= startDT) {
      Swal.fire('ข้อผิดพลาด', 'เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่มต้น', 'error');
      return;
    }

    // Prepare attendees
    const attendees = attendeesInput
      ? attendeesInput.split(',').map(email => email.trim()).filter(Boolean)
      : [];

    // Prepare bookings parameter
    const bookingParam = requireRoom && selectedRoomId
      ? {
          roomId: selectedRoomId,
          startTime: fullStartISO,
          endTime: fullEndISO,
          requestedAmenities: selectedAmenities,
          layoutStyle: layoutStyle
        }
      : undefined;

    // Prepare subtasks (assignments) parameter based on checkboxes
    const subtasks: any[] = [];
    if (delegateIT) {
      subtasks.push({
        title: `จัดระบบเชื่อมต่อห้องประชุมออนไลน์ / อุปกรณ์เสียง และเทคโนโลยีบริการ`,
        assignedToRole: 'IT Support',
        dueDate: fullStartISO
      });
    }
    if (delegateHousekeeping) {
      subtasks.push({
        title: `จัดสถานที่ห้องประชุมในรูปแบบ ${layoutStyle} และทำความสะอาดเตรียมความพร้อม`,
        assignedToRole: 'Housekeeping',
        dueDate: fullStartISO
      });
    }
    if (delegateCatering) {
      subtasks.push({
        title: `จัดเตรียมอาหารว่าง เครื่องดื่ม กาแฟรับประทานช่วงพักเบรก`,
        assignedToRole: 'Housekeeping',
        dueDate: fullStartISO
      });
    }

    let result;
    if (editingTaskId) {
      result = await updateTask(
        editingTaskId,
        {
          title,
          description,
          startTime: fullStartISO,
          endTime: fullEndISO,
          executiveId,
          confidentialityLevel,
          priority,
          attendees,
          department
        },
        bookingParam,
        subtasks,
        filesToUpload,
        existingAttachments
      );
    } else {
      result = await createTask(
        {
          title,
          description,
          startTime: fullStartISO,
          endTime: fullEndISO,
          executiveId,
          confidentialityLevel,
          priority,
          attendees,
          status: 'Scheduled',
          department
        },
        bookingParam,
        filesToUpload,
        subtasks
      );
    }

    if (result.success) {
      if (editingTaskId) {
        setEditingTaskId(null);
      }
      Swal.fire({
        title: 'บันทึกสำเร็จ!',
        text: editingTaskId
          ? 'แก้ไขรายละเอียดภารกิจเรียบร้อยแล้ว'
          : (requireRoom 
            ? 'ลงทะเบียนภารกิจพร้อมจองห้องประชุมเรียบร้อย' 
            : 'ลงทะเบียนตารางภารกิจผู้บริหารสำเร็จ'),
        icon: 'success',
        confirmButtonText: 'กลับไปยังหน้าแดชบอร์ด'
      }).then(() => {
        setActivePage('Dashboard');
      });
    } else {
      Swal.fire('เกิดข้อผิดพลาด', result.error || 'ไม่สามารถบันทึกรายการได้', 'error');
    }
  };

  // Suggest Apply Helpers
  const applySuggestedRoom = (roomId: string) => {
    setSelectedRoomId(roomId);
    Swal.fire({
      title: 'แนะนำห้องประชุมสำเร็จ',
      text: `เลือกใช้ห้องประชุมที่กำหนดแล้ว`,
      icon: 'success',
      timer: 800,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };

  const applySuggestedTime = (rec: { startTime: string; endTime: string }) => {
    setStartDate(rec.startTime.split('T')[0]);
    setStartTime(rec.startTime.split('T')[1]);
    setEndDate(rec.endTime.split('T')[0]);
    setEndTime(rec.endTime.split('T')[1]);
    Swal.fire({
      title: 'ปรับเวลาสำเร็จ',
      text: 'ปรับเปลี่ยนช่วงเวลาตามระบบแนะนำแล้ว',
      icon: 'success',
      timer: 800,
      showConfirmButton: false,
      toast: true,
      position: 'top-end'
    });
  };



  // RBAC: Access guard
  const isEditing = !!editingTaskId;
  const taskToEdit = isEditing ? tasks.find(t => t.id === editingTaskId) : null;
  const hasAccess = isEditing
    ? (taskToEdit && canEditTask(currentUser.role, taskToEdit.createdBy, currentUser.id))
    : hasPermission(currentUser.role, 'task:create');

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center">
          <AlertTriangle className="h-8 w-8 text-rose-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-xs text-slate-400 max-w-sm">บัญชีสิทธิ์ปัจจุบัน ({currentUser.role}) ไม่มีสิทธิ์{isEditing ? 'แก้ไขภารกิจนี้' : 'สร้างภารกิจหรือจองห้องประชุม'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex pb-4 border-b border-slate-200/60 dark:border-slate-800">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">
            {editingTaskId ? 'แก้ไขรายละเอียดตารางงาน / จองห้องประชุม' : 'เพิ่มภารกิจผู้บริหารและจองทรัพยากรห้องประชุม'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {editingTaskId ? 'แก้ไขรายละเอียดข้อมูลภารกิจผู้บริหารและการจองห้องประชุมในแบบฟอร์ม' : 'กรอกข้อมูลตารางงานผู้บริหารและเชื่อมประสานการจองห้องในหนึ่งขั้นตอนเดียว'}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
        
        {/* Core Task Form (Left 2 columns) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
            
            <h3 className="text-sm font-bold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="h-4 w-4 text-enterprise-500" />
              <span>ข้อมูลภารกิจพื้นฐาน (Executive Mission Brief)</span>
            </h3>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">หัวข้อภารกิจ / การประชุม *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="เช่น ประชุมคณะทำงานเตรียมรับการตรวจราชการ..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
                required
              />
            </div>

            {/* Exec & Priority & Confidentiality */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ผู้บริหารผู้รับผิดชอบ *</label>
                <select
                  value={executiveId}
                  onChange={e => setExecutiveId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all cursor-pointer"
                >
                  <option value="">-- เลือกผู้บริหารผู้รับผิดชอบ --</option>
                  {executives.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ระดับความสำคัญ *</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as PriorityLevel)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all cursor-pointer"
                >
                  <option value="ปกติ">ปกติ (Normal)</option>
                  <option value="ด่วน">ด่วน (Urgent)</option>
                  <option value="ด่วนมาก">ด่วนมาก (Critical)</option>
                  <option value="ภารกิจลับ">ภารกิจลับ (Secret Task)</option>
                  <option value="ประชุมภายใน">ประชุมภายใน</option>
                  <option value="ประชุมภายนอก">ประชุมภายนอก</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">ระดับการจำกัดสิทธิ์ข้อมูล *</label>
                <select
                  value={confidentialityLevel}
                  onChange={e => setConfidentialityLevel(e.target.value as ConfidentialityLevel)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all cursor-pointer"
                >
                  <option value="Public">Public (เปิดเผยต่อสาธารณะ)</option>
                  <option value="Internal">Internal (ใช้ภายในองค์กร)</option>
                  <option value="Confidential">Confidential (จำกัดเฉพาะกลุ่ม)</option>
                  <option value="Secret">Secret (ลับระดับสูง)</option>
                </select>
              </div>
            </div>

            {/* Date & Time Pickers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">วันที่เริ่ม *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">เวลาเริ่ม *</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">วันที่สิ้นสุด *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">เวลาสิ้นสุด *</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
                  required
                />
              </div>
            </div>

            {/* Conflict Warnings & Suggested Times (อยู่ข้างล่างการเลือกวันเวลา) */}
            {conflictWarning && (
              <div className="space-y-4 pt-2">
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-950/40 dark:bg-rose-950/10 text-left space-y-2">
                  <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="h-4 w-4 animate-bounce" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">พบปัญหาเวลางานทับซ้อน</h4>
                  </div>
                  <p className="text-xs text-rose-600 dark:text-rose-300 leading-relaxed font-semibold">
                    {conflictWarning}
                  </p>
                  <div className="text-[10px] text-rose-500">
                    ระบบแนะนำให้ปรับเวลา หรือเลือกใช้ห้องอื่นที่ยังว่างด้านล่าง
                  </div>
                </div>

                {timeRecommendations.length > 0 && (
                  <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-white pb-1.5 border-b border-slate-200/60 dark:border-slate-800">
                      <Clock className="h-3.5 w-3.5 text-enterprise-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">เวลาว่างแนะนำ (เมื่อเลื่อนกำหนดการ)</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {timeRecommendations.map((rec, index) => (
                        <div
                          key={index}
                          onClick={() => applySuggestedTime(rec)}
                          className="p-3 rounded-xl border border-slate-200 bg-white hover:border-enterprise-500 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-850 cursor-pointer transition-all flex justify-between items-center shadow-sm"
                        >
                          <div className="flex-1">
                            <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 line-clamp-1">{rec.note}</div>
                            <div className="text-[8px] text-slate-400 mt-0.5">
                              {new Date(rec.startTime).toLocaleDateString('th-TH', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <span className="text-[9px] font-bold text-enterprise-500 hover:underline ml-2">ใช้เวลานี้</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Success Display (when all info is filled and there's no conflict) - อยู่ข้างล่างการเลือกวันเวลา */}
            {startDate && startTime && endDate && endTime && executiveId && !conflictWarning && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 dark:border-emerald-950/40 dark:bg-emerald-950/10 text-left space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <Check className="h-4 w-4 rounded-full bg-emerald-500 text-white p-0.5" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">กำหนดเวลาว่างพร้อมจอง</h4>
                </div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 leading-relaxed font-semibold">
                  ไม่พบความขัดแย้งของตารางผู้บริหารและตารางการใช้ห้องประชุมในช่วงเวลานี้
                </p>
              </div>
            )}

            {/* Attendees */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-slate-400" />
                <span>ผู้เข้าร่วมประชุม (ระบุข้อความ เช่น ชื่อหรือหน่วยงาน คั่นด้วยเครื่องหมายจุลภาค , )</span>
              </label>
              <input
                type="text"
                value={attendeesInput}
                onChange={e => setAttendeesInput(e.target.value)}
                placeholder="เช่น  สว.งาน7, พ.ต.ท.คิดดี, หน.สภ. เฝ้าฟังฯ"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">รายละเอียดภารกิจ / วาระการประชุม</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="ระบุวาระการประชุม รายละเอียดงาน หรือวาระการประชุมลับเฉพาะที่ต้องการบันทึก..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all resize-none"
              ></textarea>
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                <span>เอกสารแนบกำหนดการประชุม (Mission Brief attachments)</span>
              </label>
              <div className="flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20 rounded-xl p-4 transition-all">
                <div className="text-center space-y-1">
                  <input
                    type="file"
                    multiple
                    id="file-upload"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="file-upload" className="text-xs text-enterprise-500 hover:text-enterprise-600 font-bold cursor-pointer inline-flex items-center gap-1.5">
                    <span>เลือกไฟล์เพื่อแนบ...</span>
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">รองรับ PDF, Word, Excel, รูปภาพ ไม่เกิน 10MB</p>
                </div>
              </div>
              
              {/* Render existing attached files (editing mode) */}
              {existingAttachments.length > 0 && (
                <div className="space-y-1.5 pt-1.5">
                  <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500">ไฟล์แนบเดิมในระบบ:</div>
                  <div className="flex flex-wrap gap-2">
                    {existingAttachments.map((file, i) => (
                      <span key={i} className="text-[10px] bg-enterprise-50/40 text-enterprise-700 border border-enterprise-200/40 dark:bg-enterprise-950/20 dark:text-enterprise-300 dark:border-enterprise-900/30 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
                        <span>📄 {file.fileName} ({(file.fileSize / 1024).toFixed(1)} KB)</span>
                        <button type="button" onClick={() => setExistingAttachments(prev => prev.filter((_, idx) => idx !== i))} className="text-[10px] hover:text-rose-500 font-bold ml-1" title="ลบไฟล์แนบเดิม">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Render new files to upload */}
              {filesToUpload.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1.5">
                  {filesToUpload.map((file, i) => (
                    <span key={i} className="text-[10px] bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 px-2.5 py-1 rounded-lg font-medium inline-flex items-center gap-1.5">
                      <span>📄 {file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
                      <button type="button" onClick={() => setFilesToUpload(prev => prev.filter((_, idx) => idx !== i))} className="text-[10px] hover:text-rose-500 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Department (หน่วยงาน / แผนก) */}
            <div className="space-y-1.5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-slate-400" />
                <span>หน่วยงาน / แผนก *</span>
              </label>
              {['Super Admin', 'Admin', 'Secretary'].includes(currentUser.role) ? (
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-all cursor-pointer"
                >
                  <option value="">-- เลือกหน่วยงาน / แผนก --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={department || 'ไม่ระบุ'}
                  disabled
                  className="w-full rounded-xl border border-slate-100 bg-slate-100/50 px-4 py-2.5 text-xs text-slate-400 dark:border-slate-850 dark:bg-slate-950/40 focus:outline-none cursor-not-allowed"
                />
              )}
            </div>

          </div>

          {/* Room Selection Area Toggle */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-5">
            
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-enterprise-500" />
                <span>การจัดสรรทรัพยากรห้องประชุม</span>
              </h3>
              
              {/* Checkbox toggle */}
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireRoom}
                  onChange={e => setRequireRoom(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:width-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-enterprise-500"></div>
                <span className="ml-2 text-xs font-bold text-slate-700 dark:text-slate-300">ต้องการจองห้องประชุม</span>
              </label>
            </div>

            {requireRoom && (
              <div className="space-y-5 animate-in fade-in duration-200">
                {/* Room Filter Section */}
                <div className="p-4 bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-100 dark:border-slate-800 space-y-3.5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">ตัวกรองคุณสมบัติห้องที่ต้องการ</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">จำนวนที่นั่งอย่างน้อย</label>
                      <input
                        type="number"
                        value={filterCapacity || ''}
                        onChange={e => setFilterCapacity(Number(e.target.value))}
                        placeholder="เช่น 15"
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400">อาคาร / สถานที่</label>
                      <select
                        value={filterBuilding}
                        onChange={e => setFilterBuilding(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 focus:outline-none"
                      >
                        <option value="">ทั้งหมด</option>
                        <option value="อาคารอำนวยการ">อาคารอำนวยการ</option>
                        <option value="อาคารบริการ">อาคารบริการ</option>
                        <option value="หอประชุมใหญ่">หอประชุมใหญ่</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-5">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filterVipOnly}
                          onChange={e => setFilterVipOnly(e.target.checked)}
                          className="rounded text-enterprise-500 focus:ring-enterprise-500 h-3.5 w-3.5"
                        />
                        <span>ห้อง VIP เท่านั้น (ต้องอนุมัติ)</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Rooms selection grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredRoomsList.map(room => {
                    const isSelected = selectedRoomId === room.id;
                    return (
                      <div
                        key={room.id}
                        onClick={() => setSelectedRoomId(room.id)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all hover:bg-slate-50/50 dark:hover:bg-slate-850/40 relative flex flex-col justify-between ${
                          isSelected 
                            ? 'border-enterprise-500 bg-enterprise-50/10 ring-2 ring-enterprise-500/20 dark:border-enterprise-400 dark:bg-enterprise-950/10' 
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                              {room.name}
                              {room.isVip && <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[8px] font-bold px-1 py-0.5 rounded">VIP</span>}
                            </span>
                            {isSelected && <span className="rounded-full bg-enterprise-500 text-white p-0.5"><Check className="h-3 w-3" /></span>}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <span>ความจุ: <b>{room.capacity} ที่นั่ง</b></span>
                            <span>•</span>
                            <span>{room.building} (ชั้น {room.floor})</span>
                          </div>
                        </div>

                        {/* Amenities badges */}
                        <div className="flex flex-wrap gap-1 mt-3">
                          {room.amenities.slice(0, 3).map(a => (
                            <span key={a} className="text-[8px] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 px-1.5 py-0.5 rounded">
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {filteredRoomsList.length === 0 && (
                    <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                      ไม่พบห้องประชุมตามตัวกรองที่เลือก
                    </div>
                  )}
                </div>

                {/* Extra Options: Table Layout & Amenities request */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                  {/* Table Layout */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">รูปแบบการจัดวางโต๊ะประชุม</label>
                    <select
                      value={layoutStyle}
                      onChange={e => setLayoutStyle(e.target.value as any)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-xs text-slate-800 focus:border-enterprise-500 focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                    >
                      <option value="Standard">Standard (มาตรฐาน)</option>
                      <option value="U-Shape">U-Shape (เกือกม้า)</option>
                      <option value="Classroom">Classroom (ห้องเรียน)</option>
                      <option value="Theater">Theater (โรงละคร)</option>
                    </select>
                  </div>

                  {/* Amenities checklist */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400">อุปกรณ์และสิ่งอำนวยความสะดวกที่ขอเพิ่ม</label>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {['Projector', 'Video Conference', 'Microphone', 'Coffee Break', 'Lunch', 'Live Streaming'].map(a => {
                        const isChecked = selectedAmenities.includes(a);
                        return (
                          <label key={a} className="flex items-center gap-2 text-slate-600 dark:text-slate-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleAmenity(a)}
                              className="rounded border-slate-200 text-enterprise-500 focus:ring-enterprise-500 h-3.5 w-3.5"
                            />
                            <span>{a === 'Coffee Break' ? '☕ ของว่าง' : a === 'Lunch' ? '🍽️ อาหารเที่ยง' : a}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Quick Auto-Delegation subtasks */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            
            <h3 className="text-sm font-bold text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <ListTodo className="h-4 w-4 text-enterprise-500" />
              <span>การมอบหมายงานเตรียมการอัตโนมัติ (Delegate Tasks)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-medium text-slate-600 dark:text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-100 dark:border-slate-800/80 rounded-xl hover:bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={delegateIT}
                  onChange={e => setDelegateIT(e.target.checked)}
                  className="rounded text-enterprise-500 focus:ring-enterprise-500 h-4 w-4"
                />
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-slate-200">งานเทคโนโลยี (IT)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">มอบ IT Support เปิดระบบ</div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-100 dark:border-slate-800/80 rounded-xl hover:bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={delegateHousekeeping}
                  onChange={e => setDelegateHousekeeping(e.target.checked)}
                  className="rounded text-enterprise-500 focus:ring-enterprise-500 h-4 w-4"
                />
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-slate-200">งานจัดสถานที่</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">มอบแม่บ้านจัดรูปโต๊ะ</div>
                </div>
              </label>

              <label className="flex items-center gap-2 cursor-pointer p-3 border border-slate-100 dark:border-slate-800/80 rounded-xl hover:bg-slate-50/50">
                <input
                  type="checkbox"
                  checked={delegateCatering}
                  onChange={e => setDelegateCatering(e.target.checked)}
                  className="rounded text-enterprise-500 focus:ring-enterprise-500 h-4 w-4"
                />
                <div className="text-left">
                  <div className="font-bold text-slate-800 dark:text-slate-200">งานเครื่องดื่มอาหาร</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">จัดเตรียมกาแฟ/ของว่าง</div>
                </div>
              </label>
            </div>

          </div>
        </div>

        {/* Sidebar Alerts & Recommendations (Right 1 column) */}
        <div className="space-y-6">
          


          {/* Smart Recommendation - Alternative Rooms */}
          {requireRoom && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left space-y-4">
              <div className="flex items-center gap-1.5 text-slate-800 dark:text-white pb-2 border-b border-slate-100 dark:border-slate-800">
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
                <h4 className="text-xs font-bold uppercase tracking-wider">ห้องประชุมทางเลือก (ห้องที่ว่าง)</h4>
              </div>
              
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {roomRecommendations.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">
                    ไม่มีห้องทดแทนที่ตรงเงื่อนไขในช่วงเวลานี้
                  </div>
                ) : (
                  roomRecommendations.map(room => (
                    <div
                      key={room.id}
                      onClick={() => applySuggestedRoom(room.id)}
                      className="p-2.5 rounded-xl border border-slate-100 hover:border-enterprise-500 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-850 cursor-pointer transition-all flex justify-between items-center"
                    >
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">{room.name}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">ความจุ: {room.capacity} ที่นั่ง • ชั้น {room.floor}</div>
                      </div>
                      <span className="text-[9px] font-bold text-enterprise-500 hover:underline">เลือกใช้</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Submit panel */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-3.5">
            <button
              type="submit"
              className="w-full rounded-xl bg-enterprise-500 hover:bg-enterprise-600 text-white font-bold py-3 text-xs cursor-pointer shadow-lg shadow-enterprise-500/20 transition-all flex justify-center items-center gap-2"
            >
              <span>{editingTaskId ? 'บันทึกการแก้ไข' : 'ลงทะเบียนตารางงาน'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (editingTaskId) setEditingTaskId(null);
                setActivePage('Dashboard');
              }}
              className="w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 py-2.5 text-xs font-bold cursor-pointer transition-all"
            >
              ยกเลิก
            </button>
          </div>

        </div>

      </form>
    </div>
  );
};
