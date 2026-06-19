import React, { useState } from 'react';
import { useApp, Executive, ExecutiveStatusRecord } from '../context/AppContext';
import { 
  Users, 
  Award, 
  Calendar, 
  MapPin, 
  Activity, 
  History, 
  Edit3, 
  Trash2, 
  Plus, 
  Search, 
  Building, 
  AlertTriangle, 
  CheckCircle2,
  FileText,
  UserCheck
} from 'lucide-react';
import Swal from 'sweetalert2';
import { hasPermission } from '../rbac';

export const ExecutiveStatus: React.FC = () => {
  const { 
    currentUser,
    executives,
    users,
    execStatuses,
    createExecStatus,
    updateExecStatus,
    deleteExecStatus,
    getExecutiveStatus,
    getActingAuthority
  } = useApp();

  if (!currentUser) return null;

  const [activeTab, setActiveTab] = useState<'board' | 'record' | 'history'>('board');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  
  // Form state
  const [form, setForm] = useState({
    executiveId: '',
    status: 'อยู่ปฏิบัติราชการ',
    details: '',
    location: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    note: '',
    actingExecutiveId: ''
  });

  // Filters for history tab
  const [historyFilter, setHistoryFilter] = useState({
    executiveId: '',
    status: '',
    search: ''
  });

  const isWriteAuthorized = hasPermission(currentUser.role, 'exec_status:write');
  const baseDate = new Date().toISOString().slice(0, 10);

  const statusOptions = [
    'อยู่ปฏิบัติราชการ',
    'ไปราชการ',
    'ประชุมภายนอก',
    'อบรม/สัมมนา',
    'ลาป่วย',
    'ลากิจ',
    'ลาพักผ่อน',
    'ลาคลอด',
    'Work From Home',
    'ติดภารกิจ',
    'อื่น ๆ'
  ];

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
      default:
        return 'bg-slate-100 text-slate-850 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-800';
    }
  };

  const getExecAvatar = (name: string) => {
    const matchedUser = users.find(u => u.name === name);
    return matchedUser?.avatarUrl || '';
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.executiveId) {
      Swal.fire('เกิดข้อผิดพลาด', 'กรุณาเลือกผู้บริหาร', 'error');
      return;
    }

    try {
      if (editingRecordId) {
        await updateExecStatus(editingRecordId, form);
        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลสถานะเรียบร้อยแล้ว', 'success');
        setEditingRecordId(null);
      } else {
        await createExecStatus(form);
        Swal.fire('สำเร็จ', 'บันทึกสถานะผู้บริหารเรียบร้อยแล้ว', 'success');
      }
      
      // Reset form
      setForm({
        executiveId: '',
        status: 'อยู่ปฏิบัติราชการ',
        details: '',
        location: '',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        note: '',
        actingExecutiveId: ''
      });
      setActiveTab('board');
    } catch (err: any) {
      Swal.fire('ข้อผิดพลาด', `บันทึกข้อมูลล้มเหลว: ${err.message}`, 'error');
    }
  };

  const handleEditRecord = (record: ExecutiveStatusRecord) => {
    setEditingRecordId(record.id);
    setForm({
      executiveId: record.executiveId,
      status: record.status,
      details: record.details || '',
      location: record.location || '',
      startDate: record.startDate,
      endDate: record.endDate,
      note: record.note || '',
      actingExecutiveId: record.actingExecutiveId || ''
    });
    setActiveTab('record');
  };

  const handleDeleteRecord = (id: string) => {
    Swal.fire({
      title: 'ยืนยันการลบประวัติสถานะ?',
      text: 'การดำเนินการนี้จะลบข้อมูลสถานะและย้อนกลับระบบรักษาการแทนในช่วงเวลาดังกล่าว!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบข้อมูล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteExecStatus(id);
          Swal.fire('ลบแล้ว', 'ลบประวัติสถานะสำเร็จ', 'success');
        } catch (err: any) {
          Swal.fire('ข้อผิดพลาด', `ไม่สามารถลบประวัติได้: ${err.message}`, 'error');
        }
      }
    });
  };

  const handleChangeActing = (exec: Executive, currentStatus: ExecutiveStatusRecord) => {
    if (currentStatus.id.startsWith('default-')) {
      Swal.fire('ไม่สามารถดำเนินการได้', 'ผู้บริหารอยู่ในสถานะอยู่ปฏิบัติราชการ ไม่จำเป็นต้องมีผู้รักษาราชการแทน', 'warning');
      return;
    }

    // Filter candidates who have status 'อยู่ปฏิบัติราชการ' today
    const candidates = executives.filter(
      e => e.id !== exec.id && 
      e.status !== 'Suspended' && 
      getExecutiveStatus(e.id, baseDate).status === 'อยู่ปฏิบัติราชการ'
    );

    const inputOptions: Record<string, string> = {};
    inputOptions[''] = '-- เลือกผู้รักษาราชการแทน (อัตโนมัติตามลำดับ) --';
    candidates.forEach(c => {
      inputOptions[c.id] = `${c.name} (${c.position})`;
    });

    Swal.fire({
      title: 'มอบหมายผู้รักษาราชการแทน',
      html: `
        <div class="text-xs text-slate-500 mb-4 text-left">
          ระบุผู้บริหารที่จะเข้ามาปฏิบัติหน้าที่รักษาราชการแทน <b>${exec.name}</b> ในการจดตารางงานแดชบอร์ดวันนี้
        </div>
      `,
      input: 'select',
      inputOptions: inputOptions,
      inputValue: currentStatus.actingExecutiveId || '',
      showCancelButton: true,
      confirmButtonText: 'บันทึก',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: 'rounded-2xl dark:bg-slate-900 border border-slate-100 dark:border-slate-800',
        title: 'text-sm font-bold text-slate-800 dark:text-white',
        confirmButton: 'bg-enterprise-500 hover:bg-enterprise-600 text-white font-bold rounded-xl text-xs py-2 px-4 shadow-sm',
        cancelButton: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs py-2 px-4 shadow-sm dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700',
        input: 'rounded-xl border border-slate-200 bg-slate-50 text-xs dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 p-2 cursor-pointer focus:outline-none'
      },
      buttonsStyling: false
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const newActingId = result.value || '';
          
          Swal.fire({
            title: 'กำลังบันทึกข้อมูล...',
            allowOutsideClick: false,
            didOpen: () => {
              Swal.showLoading();
            }
          });
          
          await updateExecStatus(currentStatus.id, { actingExecutiveId: newActingId });
          
          Swal.fire({
            title: 'สำเร็จ',
            text: 'เปลี่ยนตัวผู้รักษาราชการแทนเรียบร้อยแล้ว',
            icon: 'success',
            timer: 1500,
            showConfirmButton: false
          });
        } catch (err: any) {
          Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถบันทึกข้อมูลได้: ${err.message}`, 'error');
        }
      }
    });
  };

  // Filtered list of history records
  const filteredHistory = execStatuses.filter(rec => {
    const exec = executives.find(e => e.id === rec.executiveId);
    const execName = exec ? exec.name.toLowerCase() : '';
    const matchesExec = !historyFilter.executiveId || rec.executiveId === historyFilter.executiveId;
    const matchesStatus = !historyFilter.status || rec.status === historyFilter.status;
    const matchesSearch = !historyFilter.search || 
      execName.includes(historyFilter.search.toLowerCase()) ||
      (rec.location || '').toLowerCase().includes(historyFilter.search.toLowerCase()) ||
      (rec.details || '').toLowerCase().includes(historyFilter.search.toLowerCase());
    return matchesExec && matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800 gap-3 text-left">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Activity className="h-5 w-5 text-enterprise-500" />
            <span>สถานะผู้บริหารและผู้รักษาราชการแทน (Executive Status & Acting Authority)</span>
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">จัดการ ตรวจสอบ และติดตามความพร้อมผู้ปฏิบัติราชการของผู้บังคับบัญชา</p>
        </div>

        {/* Tab buttons */}
        <div className="flex overflow-x-auto whitespace-nowrap bg-slate-100 dark:bg-slate-950/40 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80 max-w-full scrollbar-none">
          <button
            onClick={() => setActiveTab('board')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'board' 
                ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>กระดานสถานะผู้บริหาร</span>
          </button>
          
          {isWriteAuthorized && (
            <button
              onClick={() => {
                setActiveTab('record');
                if (!editingRecordId) {
                  setForm({
                    executiveId: '',
                    status: 'อยู่ปฏิบัติราชการ',
                    details: '',
                    location: '',
                    startDate: new Date().toISOString().slice(0, 10),
                    endDate: new Date().toISOString().slice(0, 10),
                    note: '',
                    actingExecutiveId: ''
                  });
                }
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                activeTab === 'record' 
                  ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>{editingRecordId ? 'แก้ไขการบันทึกสถานะ' : 'ลงบันทึกสถานะ'}</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'history' 
                ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>ประวัติสถานะย้อนหลัง</span>
          </button>
        </div>
      </div>

      {/* Main Area */}
      <div className="text-left">
        
        {/* TAB 1: EXECUTIVE BOARD */}
        {activeTab === 'board' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {executives
                .filter(e => e.status !== 'Suspended')
                .sort((a, b) => a.priority - b.priority)
                .map(exec => {
                  const currentStatus = getExecutiveStatus(exec.id, baseDate);
                  const actingAuthority = getActingAuthority(exec.id, baseDate);
                  
                  // Check if this executive is acting for someone else
                  const activeExecs = executives.filter(e => e.status !== 'Suspended');
                  const actingForList = activeExecs.filter(b => 
                    b.priority < exec.priority && 
                    getActingAuthority(b.id, baseDate)?.id === exec.id
                  );

                  return (
                    <div 
                      key={exec.id} 
                      className={`rounded-2xl border bg-white dark:bg-slate-900 shadow-sm p-5 space-y-4 relative flex flex-col justify-between overflow-hidden transition-all duration-200 hover:shadow-md ${
                        currentStatus.status === 'อยู่ปฏิบัติราชการ' 
                          ? 'border-slate-200/80 dark:border-slate-800' 
                          : 'border-amber-200 bg-gradient-to-br from-amber-50/10 to-white dark:border-amber-900/40 dark:from-amber-950/5 dark:to-slate-900'
                      }`}
                    >
                      <div className="space-y-3">
                        {/* Executive Header details */}
                        <div className="flex items-start gap-4">
                          <div className="w-[110px] h-[140px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 border border-slate-200/40 dark:border-slate-700/40 shadow-sm">
                            {exec.avatarUrl || getExecAvatar(exec.name) ? (
                              <img 
                                src={exec.avatarUrl || getExecAvatar(exec.name)} 
                                alt={exec.name} 
                                className="h-full w-full object-cover" 
                                style={{
                                  objectPosition: `${exec.avatarOffsetX ?? 50}% ${exec.avatarOffsetY ?? 50}%`,
                                  transform: `scale(${exec.avatarScale ?? 1.0})`
                                }}
                              />
                            ) : (
                              <span className="text-3xl font-bold text-slate-400">{exec.name.charAt(0)}</span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col justify-between h-[140px] py-0.5 text-left">
                            <div>
                              <h3 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-white truncate">{exec.name}</h3>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 line-clamp-2 leading-tight">{exec.position}</p>
                              <p className="text-[9px] text-slate-450 dark:text-slate-555 mt-1.5 flex items-center gap-0.5">
                                <Building className="h-2.5 w-2.5 flex-shrink-0" />
                                <span className="truncate">{exec.department}</span>
                              </p>
                            </div>
                            
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                              <div className="text-[9px] font-bold text-slate-400">ลำดับรักษาการ: {exec.priority}</div>
                              <div className="flex">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusBadgeClass(currentStatus.status)}`}>
                                  {currentStatus.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Details about status */}
                        {currentStatus.status !== 'อยู่ปฏิบัติราชการ' && exec.priority === 0 && (
                          <div className="p-3 rounded-xl bg-indigo-50/40 border border-indigo-100/60 dark:bg-indigo-950/20 dark:border-indigo-900/30 flex flex-col gap-2 relative">
                            {actingAuthority ? (
                              <div className="flex items-start gap-2">
                                <UserCheck className="h-4 w-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                                <div className="text-[10px] text-slate-700 dark:text-slate-300 flex-1">
                                  <span className="font-semibold text-indigo-600 dark:text-indigo-400">รักษาราชการแทนโดย:</span>
                                  <div className="font-bold mt-0.5">{actingAuthority.name}</div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500">{actingAuthority.position}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 flex-1">
                                  <span className="font-semibold">ไม่มีผู้รักษาราชการแทน</span>
                                  <div className="text-[9px] mt-0.5 text-slate-400">ระบบจะค้นหาตามลำดับโดยอัตโนมัติเมื่อมีผู้บริหารพร้อมปฏิบัติการ</div>
                                </div>
                              </div>
                            )}

                            {isWriteAuthorized && (
                              <button
                                onClick={() => handleChangeActing(exec, currentStatus)}
                                className="absolute right-2 top-2 p-1 text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/60 dark:border-slate-700 shadow-sm cursor-pointer flex items-center justify-center transition-all hover:scale-105"
                                title="เปลี่ยนผู้รักษาราชการแทน"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        
                        {currentStatus.status !== 'อยู่ปฏิบัติราชการ' && (
                          <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-100 dark:bg-amber-950/20 dark:border-amber-900/30 text-[10px] space-y-1 text-slate-600 dark:text-slate-400">
                            {currentStatus.location && (
                              <div className="flex items-start gap-1">
                                <span className="flex-shrink-0">📍</span>
                                <span><b>สถานที่:</b> {currentStatus.location}</span>
                              </div>
                            )}
                            {currentStatus.details && (
                              <div className="flex items-start gap-1">
                                <span className="flex-shrink-0">📝</span>
                                <span><b>รายละเอียด:</b> {currentStatus.details}</span>
                              </div>
                            )}
                            <div className="flex items-start gap-1 text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                              <span>📅</span>
                              <span>ระยะเวลา: {currentStatus.startDate} ถึง {currentStatus.endDate}</span>
                            </div>
                          </div>
                        )}

                        {actingForList.length > 0 && (
                          <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 space-y-1.5">
                            <div className="text-[10px] font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                              <span>รักษาราชการแทนผู้บริหารระดับสูง:</span>
                            </div>
                            <div className="space-y-1">
                              {actingForList.map(a => (
                                <div key={a.id} className="text-[10px] text-slate-700 dark:text-slate-300 pl-4 relative border-l border-emerald-300/40">
                                  <div className="font-bold">{a.name}</div>
                                  <div className="text-[9px] text-slate-400 dark:text-slate-500">{a.position}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* TAB 2: RECORD STATUS FORM */}
        {activeTab === 'record' && isWriteAuthorized && (
          <div className="max-w-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <FileText className="h-4.5 w-4.5 text-enterprise-500" />
              <span>{editingRecordId ? 'แก้ไขข้อมูลบันทึกสถานะผู้บริหาร' : 'ลงบันทึกสถานะผู้ปฏิบัติราชการ'}</span>
            </h3>

            <form onSubmit={handleSaveRecord} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">ผู้บริหาร *</label>
                  <select
                    required
                    value={form.executiveId}
                    onChange={e => setForm({...form, executiveId: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                  >
                    <option value="">-- เลือกผู้บริหาร --</option>
                    {executives
                      .filter(e => e.status !== 'Suspended')
                      .sort((a, b) => a.priority - b.priority)
                      .map(e => (
                        <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">สถานะการปฏิบัติราชการ *</label>
                  <select
                    required
                    value={form.status}
                    onChange={e => setForm({...form, status: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 cursor-pointer"
                  >
                    {statusOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dropdown for specific acting authority selector (Only visible if selected executive priority === 0 and status !== 'อยู่ปฏิบัติราชการ') */}
              {(() => {
                const selectedExec = executives.find(e => e.id === form.executiveId);
                if (selectedExec && selectedExec.priority === 0 && form.status !== 'อยู่ปฏิบัติราชการ') {
                  return (
                    <div className="space-y-1 animate-in slide-in-from-top-2 duration-200">
                      <label className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">
                        ผู้รักษาราชการแทนผู้บริหารสูงสุด
                      </label>
                      <select
                        value={form.actingExecutiveId}
                        onChange={e => setForm({...form, actingExecutiveId: e.target.value})}
                        className="w-full rounded-xl border border-amber-250 bg-amber-50/10 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-amber-900/40 dark:bg-amber-950/10 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="">-- เลือกผู้รักษาราชการแทน (อัตโนมัติตามลำดับ) --</option>
                        {executives
                          .filter(e => e.id !== form.executiveId && e.status !== 'Suspended')
                          .sort((a, b) => a.priority - b.priority)
                          .map(e => (
                            <option key={e.id} value={e.id}>{e.name} ({e.position})</option>
                          ))}
                      </select>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                        * สามารถระบุตัวบุคคลผู้รักษาราชการแทนได้โดยตรง หรือปล่อยว่างไว้เพื่อใช้ระบบรักษาราชการตามลำดับ (priority) อัตโนมัติ
                      </p>
                    </div>
                  );
                }
                return null;
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">วันที่เริ่มต้น *</label>
                  <input
                    type="date"
                    required
                    value={form.startDate}
                    onChange={e => setForm({...form, startDate: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">วันที่สิ้นสุด *</label>
                  <input
                    type="date"
                    required
                    value={form.endDate}
                    onChange={e => setForm({...form, endDate: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">สถานที่ (กรณีไปราชการ / ประชุมภายนอก)</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({...form, location: e.target.value})}
                  placeholder="เช่น โรงแรมเซ็นทารา แกรนด์ กรุงเทพฯ"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">รายละเอียด / หัวข้อภารกิจ</label>
                <textarea
                  value={form.details}
                  onChange={e => setForm({...form, details: e.target.value})}
                  placeholder="เช่น ประชุมหารือความปลอดภัยและมาตรการฉุกเฉินระดับจังหวัด"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  value={form.note}
                  onChange={e => setForm({...form, note: e.target.value})}
                  placeholder="เช่น สามารถติดต่อประสานงานด่วนผ่านเลขาฯ โทร. 081-xxx-xxxx"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => {
                    setEditingRecordId(null);
                    setActiveTab('board');
                  }} 
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-850 dark:text-slate-300"
                >
                  ยกเลิก
                </button>
                <button type="submit" className="rounded-xl bg-enterprise-500 text-white px-5 py-2 text-xs font-semibold hover:bg-enterprise-600">
                  {editingRecordId ? 'แก้ไขข้อมูล' : 'บันทึกข้อมูล'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: HISTORY LOGS */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            
            {/* Search Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800/80">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={historyFilter.search}
                  onChange={e => setHistoryFilter({...historyFilter, search: e.target.value})}
                  placeholder="ค้นหาตามสถานที่ หรือรายละเอียด..."
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-enterprise-500 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div>
                <select
                  value={historyFilter.executiveId}
                  onChange={e => setHistoryFilter({...historyFilter, executiveId: e.target.value})}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-enterprise-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="">ผู้บริหารทั้งหมด</option>
                  {executives
                    .filter(e => e.status !== 'Suspended')
                    .map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                </select>
              </div>

              <div>
                <select
                  value={historyFilter.status}
                  onChange={e => setHistoryFilter({...historyFilter, status: e.target.value})}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-enterprise-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="">สถานะทั้งหมด</option>
                  {statusOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">ผู้บริหาร</th>
                    <th className="p-3">ตำแหน่ง / หน่วยงาน</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3">สถานที่ / รายละเอียด</th>
                    <th className="p-3">วันที่เริ่ม - สิ้นสุด</th>
                    <th className="p-3">ผู้บันทึก</th>
                    {isWriteAuthorized && <th className="p-3 text-right">ดำเนินการ</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">ไม่พบประวัติการเปลี่ยนสถานะ</td>
                    </tr>
                  ) : (
                    filteredHistory.map(rec => {
                      const exec = executives.find(e => e.id === rec.executiveId);
                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/20">
                          <td className="p-3">
                            <div className="font-bold text-slate-750 dark:text-slate-200">{exec ? exec.name : 'ไม่ระบุ'}</div>
                          </td>
                          <td className="p-3 text-slate-500">
                            <div>{exec ? exec.position : ''}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{exec ? exec.department : ''}</div>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusBadgeClass(rec.status)}`}>
                              {rec.status}
                            </span>
                            {rec.actingExecutiveId && (
                              <div className="text-[9px] text-amber-600 dark:text-amber-400 mt-1 font-semibold">
                                ผู้รักษาการ: {executives.find(e => e.id === rec.actingExecutiveId)?.name || 'ไม่พบรายชื่อ'}
                              </div>
                            )}
                          </td>
                          <td className="p-3 max-w-xs">
                            <div className="font-semibold text-slate-700 dark:text-slate-300">{rec.location || '-'}</div>
                            <div className="text-[10px] text-slate-450 dark:text-slate-500 mt-0.5 truncate">{rec.details || ''}</div>
                          </td>
                          <td className="p-3 text-slate-600 font-medium whitespace-nowrap">
                            {rec.startDate} ถึง {rec.endDate}
                          </td>
                          <td className="p-3 text-slate-500">
                            <div>{rec.recordedBy}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">{new Date(rec.recordedAt).toLocaleDateString('th-TH')}</div>
                          </td>
                          {isWriteAuthorized && (
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleEditRecord(rec)}
                                  className="p-1 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300 cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(rec.id)}
                                  className="p-1 rounded bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/60 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredHistory.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-450 dark:text-slate-555 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  ไม่พบข้อมูลประวัติ
                </div>
              ) : (
                filteredHistory.map(rec => {
                  const exec = executives.find(e => e.id === rec.executiveId);
                  return (
                    <div key={rec.id} className="p-4 rounded-2xl border border-slate-200 bg-white dark:border-slate-900 shadow-sm space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <h4 className="font-bold text-slate-800 dark:text-white text-xs sm:text-sm">{exec ? exec.name : 'ไม่ระบุ'}</h4>
                          <p className="text-[10px] text-slate-400 mt-0.5">{exec ? exec.position : ''}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getStatusBadgeClass(rec.status)}`}>
                          {rec.status}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 text-[10px] space-y-1">
                        <div><b>ช่วงเวลา:</b> {rec.startDate} ถึง {rec.endDate}</div>
                        {rec.location && <div><b>สถานที่:</b> {rec.location}</div>}
                        {rec.details && <div className="text-slate-500"><b>ภารกิจ:</b> {rec.details}</div>}
                        {rec.actingExecutiveId && (
                          <div className="text-amber-600 dark:text-amber-400">
                            <b>ผู้รักษาการ:</b> {executives.find(e => e.id === rec.actingExecutiveId)?.name || 'ไม่พบรายชื่อ'}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-between items-center pt-2.5 border-t border-slate-100 dark:border-slate-850">
                        <div className="text-[9px] text-slate-400">บันทึกโดย: {rec.recordedBy}</div>
                        
                        {isWriteAuthorized && (
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => handleEditRecord(rec)}
                              className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-55 text-slate-500 dark:border-slate-800 dark:hover:bg-slate-850 dark:text-slate-300 text-[10px] cursor-pointer"
                            >
                              แก้ไข
                            </button>
                            <button
                              onClick={() => handleDeleteRecord(rec.id)}
                              className="px-2 py-1 rounded border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 text-rose-500 dark:border-rose-900/60 dark:bg-rose-950/20 text-[10px] cursor-pointer"
                            >
                              ลบ
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

      </div>

    </div>
  );
};
