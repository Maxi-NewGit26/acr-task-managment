import React, { useState, useEffect } from 'react';
import { useApp, MeetingRoom, Executive, User, UserRole, Department } from '../context/AppContext';
import { 
  Settings, 
  MapPin, 
  Users, 
  Award, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  ShieldAlert,
  Server,
  X,
  Search,
  Lock,
  Key,
  Building,
  Camera,
  Loader2,
  Move
} from 'lucide-react';
import Swal from 'sweetalert2';
import { hasPermission } from '../rbac';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

export const AdminSettings: React.FC = () => {
  const { 
    rooms, 
    executives, 
    users, 
    currentUser,
    createRoom,
    updateRoom,
    deleteRoom,
    createExecutive,
    updateExecutive,
    deleteExecutive,
    adminCreateUser,
    adminUpdateUser,
    adminDeleteUser,
    adminResetUserPassword,
    departments,
    createDepartment,
    updateDepartment,
    deleteDepartment
  } = useApp();

  if (!currentUser) return null;

  const [activeTab, setActiveTab] = useState<'rooms' | 'execs' | 'users' | 'depts'>('rooms');
  
  // Local lists for managing CRUD state synced from context
  const [localRooms, setLocalRooms] = useState<MeetingRoom[]>(rooms);
  const [localExecs, setLocalExecs] = useState<Executive[]>(executives);
  const [localDepts, setLocalDepts] = useState<Department[]>(departments);

  useEffect(() => {
    setLocalRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    setLocalExecs(executives);
  }, [executives]);

  useEffect(() => {
    setLocalDepts(departments);
  }, [departments]);

  // Forms states
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({
    name: '',
    capacity: 15,
    building: 'อาคารอำนวยการ',
    floor: '1',
    isVip: false,
    amenitiesInput: 'Projector, Microphone, Coffee Break'
  });
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    name: '',
    phone: '',
    role: 'General User' as UserRole,
    status: 'Active' as 'Active' | 'Suspended',
    department: ''
  });
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [filterUserRole, setFilterUserRole] = useState<string>('all');

  const formatLastLogin = (isoString?: string) => {
    if (!isoString) return 'ไม่เคยเข้าใช้งาน';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'ไม่ระบุ';
    }
  };

  const getRoleBadgeClass = (role: UserRole) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-amber-100 text-amber-850 dark:bg-amber-950/40 dark:text-amber-405 border border-amber-200 dark:border-amber-900/40';
      case 'Admin':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40';
      case 'Executive':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40';
      case 'Secretary':
        return 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40';
      case 'IT Support':
        return 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-900/40';
      case 'Housekeeping':
        return 'bg-orange-100 text-orange-850 dark:bg-orange-950/40 dark:text-orange-405 border border-orange-200 dark:border-orange-900/40';
      case 'Facility Officer':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-750';
    }
  };

  const getRoleDescription = (role: UserRole) => {
    switch (role) {
      case 'Super Admin':
        return 'ผู้ดูแลระบบสูงสุด: เข้าถึงได้ทุกฟังก์ชัน จัดการการตั้งค่า และตั้งสิทธิ์ระบบได้ทั้งหมด';
      case 'Admin':
        return 'ผู้ดูแลระบบ: จัดการข้อมูลห้องประชุม ผู้บริหาร และผู้ใช้อื่น ๆ ในระบบได้';
      case 'Executive':
        return 'ผู้บริหาร: ดูตารางภารกิจ สรุปรายงาน และอนุมัติการจองห้อง VIP ได้';
      case 'Secretary':
        return 'หน้าห้อง/เลขาฯ: สร้าง แก้ไข ยกเลิก ตารางงานของผู้บริหาร และจองห้องประชุมแทนผู้บริหารได้';
      case 'IT Support':
        return 'เจ้าหน้าที่ไอที: ช่วยดูแลระบบ ข้อมูลห้องประชุม และให้คำแนะนำทางเทคนิค';
      case 'Housekeeping':
        return 'งานแม่บ้าน: ดูรายการจองและเตรียมความพร้อมของห้องประชุม (อาหารว่าง, ทำความสะอาด)';
      case 'Facility Officer':
        return 'งานอำนวยความสะดวก: ดูรายการจอง จัดการอุปกรณ์ เครื่องเสียง และความพร้อมของสถานที่';
      default:
        return 'ผู้ใช้ทั่วไป: ดูปฏิทิน จองห้องประชุมทั่วไป และติดตามสถานะคำขอของตนเองได้';
    }
  };

  const filteredUsers = users.filter(u => {
    const nameStr = u.name || '';
    const emailStr = u.email || '';
    const matchesSearch = nameStr.toLowerCase().includes(searchUserQuery.toLowerCase()) || 
                          emailStr.toLowerCase().includes(searchUserQuery.toLowerCase());
    const matchesRole = filterUserRole === 'all' || u.role === filterUserRole;
    return matchesSearch && matchesRole;
  });

  const [showExecModal, setShowExecModal] = useState(false);
  const [editingExecId, setEditingExecId] = useState<string | null>(null);
  const [execForm, setExecForm] = useState({
    name: '',
    position: '',
    department: 'สำนักงานจังหวัด',
    colorCode: '#3b82f6',
    priority: 0,
    avatarUrl: '',
    avatarOffsetX: 50,
    avatarOffsetY: 50,
    avatarScale: 1.0
  });
  const [uploadingExecAvatar, setUploadingExecAvatar] = useState(false);

  // Drag-to-reposition states for executive avatar
  const [isDraggingExec, setIsDraggingExec] = useState(false);
  const execDragStart = React.useRef({ x: 0, y: 0, ox: 50, oy: 50 });
  const execFileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isDraggingExec) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - execDragStart.current.x;
      const dy = e.clientY - execDragStart.current.y;
      // 144px is the width/height of the h-36 container
      const newX = Math.max(0, Math.min(100, execDragStart.current.ox - (dx / 144) * 100));
      const newY = Math.max(0, Math.min(100, execDragStart.current.oy - (dy / 144) * 100));
      setExecForm(prev => ({
        ...prev,
        avatarOffsetX: newX,
        avatarOffsetY: newY
      }));
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - execDragStart.current.x;
        const dy = e.touches[0].clientY - execDragStart.current.y;
        const newX = Math.max(0, Math.min(100, execDragStart.current.ox - (dx / 144) * 100));
        const newY = Math.max(0, Math.min(100, execDragStart.current.oy - (dy / 144) * 100));
        setExecForm(prev => ({
          ...prev,
          avatarOffsetX: newX,
          avatarOffsetY: newY
        }));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingExec(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: true });
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingExec]);

  const handleExecMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingExec(true);
    execDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: execForm.avatarOffsetX || 50,
      oy: execForm.avatarOffsetY || 50
    };
  };

  const handleExecTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDraggingExec(true);
      execDragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: execForm.avatarOffsetX || 50,
        oy: execForm.avatarOffsetY || 50
      };
    }
  };

  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState({
    name: ''
  });

  const isAdmin = ['Super Admin', 'Admin'].includes(currentUser.role);

  // --- ROOMS CRUD ---
  const handleOpenRoomModal = (room?: MeetingRoom) => {
    if (room) {
      setEditingRoomId(room.id);
      setRoomForm({
        name: room.name,
        capacity: room.capacity,
        building: room.building,
        floor: room.floor,
        isVip: room.isVip,
        amenitiesInput: room.amenities.join(', ')
      });
    } else {
      setEditingRoomId(null);
      setRoomForm({
        name: '',
        capacity: 15,
        building: 'อาคารอำนวยการ',
        floor: '1',
        isVip: false,
        amenitiesInput: 'Projector, Microphone, Coffee Break'
      });
    }
    setShowRoomModal(true);
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const amenities = roomForm.amenitiesInput.split(',').map(a => a.trim()).filter(Boolean);

    try {
      if (editingRoomId) {
        // Edit
        await updateRoom(editingRoomId, {
          name: roomForm.name,
          capacity: roomForm.capacity,
          building: roomForm.building,
          floor: roomForm.floor,
          isVip: roomForm.isVip,
          amenities
        });
        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลห้องประชุมเรียบร้อย', 'success');
      } else {
        // Add
        const newRoomId = `room-${Date.now()}`;
        await createRoom({
          id: newRoomId,
          name: roomForm.name,
          capacity: roomForm.capacity,
          building: roomForm.building,
          floor: roomForm.floor,
          isVip: roomForm.isVip,
          amenities,
          status: 'Available'
        });
        Swal.fire('สำเร็จ', 'เพิ่มห้องประชุมใหม่สำเร็จ', 'success');
      }
      setShowRoomModal(false);
    } catch (err: any) {
      Swal.fire('ข้อผิดพลาด', `ไม่สามารถบันทึกข้อมูลห้องประชุม: ${err.message}`, 'error');
    }
  };

  const handleDeleteRoom = (id: string) => {
    Swal.fire({
      title: 'ต้องการลบห้องประชุม?',
      text: 'การดำเนินการนี้จะไม่สามารถย้อนคืนได้!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteRoom(id);
          Swal.fire('ลบแล้ว', 'ลบห้องประชุมสำเร็จ', 'success');
        } catch (err: any) {
          Swal.fire('ข้อผิดพลาด', `ไม่สามารถลบห้องประชุม: ${err.message}`, 'error');
        }
      }
    });
  };

  // --- EXECS CRUD ---
  const handleOpenExecModal = (exec?: Executive) => {
    if (exec) {
      setEditingExecId(exec.id);
      setExecForm({
        name: exec.name,
        position: exec.position,
        department: exec.department,
        colorCode: exec.colorCode,
        priority: exec.priority ?? 0,
        avatarUrl: exec.avatarUrl || '',
        avatarOffsetX: exec.avatarOffsetX ?? 50,
        avatarOffsetY: exec.avatarOffsetY ?? 50,
        avatarScale: exec.avatarScale ?? 1.0
      });
    } else {
      setEditingExecId(null);
      setExecForm({
        name: '',
        position: '',
        department: 'สำนักงานจังหวัด',
        colorCode: '#3b82f6',
        priority: 0,
        avatarUrl: '',
        avatarOffsetX: 50,
        avatarOffsetY: 50,
        avatarScale: 1.0
      });
    }
    setShowExecModal(true);
  };

  const handleSaveExec = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingExecId) {
        await updateExecutive(editingExecId, {
          name: execForm.name,
          position: execForm.position,
          department: execForm.department,
          colorCode: execForm.colorCode,
          priority: execForm.priority,
          avatarUrl: execForm.avatarUrl,
          avatarOffsetX: execForm.avatarOffsetX,
          avatarOffsetY: execForm.avatarOffsetY,
          avatarScale: execForm.avatarScale
        });
        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลผู้บริหารเรียบร้อย', 'success');
      } else {
        const newExecId = `exec-${Date.now()}`;
        await createExecutive({
          id: newExecId,
          name: execForm.name,
          position: execForm.position,
          department: execForm.department,
          colorCode: execForm.colorCode,
          priority: execForm.priority,
          status: 'Active',
          avatarUrl: execForm.avatarUrl,
          avatarOffsetX: execForm.avatarOffsetX,
          avatarOffsetY: execForm.avatarOffsetY,
          avatarScale: execForm.avatarScale
        });
        Swal.fire('สำเร็จ', 'เพิ่มข้อมูลผู้บริหารสำเร็จ', 'success');
      }
      setShowExecModal(false);
    } catch (err: any) {
      Swal.fire('ข้อผิดพลาด', `ไม่สามารถบันทึกข้อมูลผู้บริหาร: ${err.message}`, 'error');
    }
  };
  const handleExecAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingExecAvatar(true);
      try {
        const uniqueId = editingExecId || `temp_${Date.now()}`;
        const fileRef = ref(storage, `executives/${uniqueId}_avatar_${Date.now()}`);
        await uploadBytes(fileRef, file);
        const downloadUrl = await getDownloadURL(fileRef);
        setExecForm(prev => ({ 
          ...prev, 
          avatarUrl: downloadUrl,
          avatarOffsetX: 50,
          avatarOffsetY: 50,
          avatarScale: 1.0
        }));
        Swal.fire({
          title: 'อัปโหลดภาพสำเร็จ',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } catch (err: any) {
        Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถอัปโหลดรูปภาพ: ${err.message}`, 'error');
      } finally {
        setUploadingExecAvatar(false);
      }
    }
  };

  const handleClearExecAvatar = async () => {
    if (execForm.avatarUrl) {
      try {
        if (execForm.avatarUrl.includes('firebasestorage.googleapis.com')) {
          const imageRef = ref(storage, execForm.avatarUrl);
          await deleteObject(imageRef).catch(e => console.warn("Delete object from storage failed: ", e));
        }
      } catch (err) {
        console.warn("Error deleting executive photo from Storage: ", err);
      }
      setExecForm(prev => ({ 
        ...prev, 
        avatarUrl: '',
        avatarOffsetX: 50,
        avatarOffsetY: 50,
        avatarScale: 1.0
      }));
      Swal.fire({
        title: 'ลบภาพถ่ายเรียบร้อย',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    }
  };
  const handleDeleteExec = (id: string) => {
    Swal.fire({
      title: 'ต้องการลบข้อมูลผู้บริหาร?',
      text: 'การลบชื่อผู้บริหารจะมีผลกับการจับคู่ภารกิจ!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteExecutive(id);
          Swal.fire('ลบแล้ว', 'ลบข้อมูลผู้บริหารสำเร็จ', 'success');
        } catch (err: any) {
          Swal.fire('ข้อผิดพลาด', `ไม่สามารถลบข้อมูลผู้บริหาร: ${err.message}`, 'error');
        }
      }
    });
  };

  // --- DEPTS CRUD ---
  const handleOpenDeptModal = (dept?: Department) => {
    if (dept) {
      setEditingDeptId(dept.id);
      setDeptForm({
        name: dept.name
      });
    } else {
      setEditingDeptId(null);
      setDeptForm({
        name: ''
      });
    }
    setShowDeptModal(true);
  };

  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptForm.name.trim()) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาระบุชื่อหน่วยงาน', 'error');
      return;
    }

    try {
      if (editingDeptId) {
        await updateDepartment(editingDeptId, {
          name: deptForm.name.trim()
        });
        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลหน่วยงานเรียบร้อย', 'success');
      } else {
        const newDeptId = `dept-${Date.now()}`;
        await createDepartment({
          id: newDeptId,
          name: deptForm.name.trim()
        });
        Swal.fire('สำเร็จ', 'เพิ่มหน่วยงานใหม่สำเร็จ', 'success');
      }
      setShowDeptModal(false);
    } catch (err: any) {
      Swal.fire('ข้อผิดพลาด', `ไม่สามารถบันทึกข้อมูลหน่วยงาน: ${err.message}`, 'error');
    }
  };

  const handleDeleteDept = (id: string) => {
    Swal.fire({
      title: 'ต้องการลบข้อมูลหน่วยงาน?',
      text: 'การลบชื่อหน่วยงานอาจมีผลกระทบกับข้อมูลสังกัดของผู้ใช้งาน!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await deleteDepartment(id);
          Swal.fire('ลบแล้ว', 'ลบข้อมูลหน่วยงานสำเร็จ', 'success');
        } catch (err: any) {
          Swal.fire('ข้อผิดพลาด', `ไม่สามารถลบข้อมูลหน่วยงาน: ${err.message}`, 'error');
        }
      }
    });
  };

  // --- USERS CRUD ---
  const handleOpenUserModal = (user?: User) => {
    if (user) {
      setEditingUserId(user.id);
      setUserForm({
        email: user.email,
        name: user.name,
        phone: user.phone || '',
        role: user.role,
        status: user.status || 'Active',
        department: user.department || ''
      });
    } else {
      setEditingUserId(null);
      setUserForm({
        email: '',
        name: '',
        phone: '',
        role: 'General User',
        status: 'Active',
        department: ''
      });
    }
    setShowUserModal(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.email.trim() || !userForm.name.trim()) {
      Swal.fire('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    try {
      if (editingUserId) {
        await adminUpdateUser(editingUserId, {
          name: userForm.name.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role,
          status: userForm.status,
          department: userForm.department
        });
        Swal.fire('สำเร็จ', 'แก้ไขข้อมูลผู้ใช้งานเรียบร้อย', 'success');
      } else {
        const newUserId = `user-${Date.now()}`;
        const defaultAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(userForm.name.trim())}`;
        await adminCreateUser({
          id: newUserId,
          email: userForm.email.trim(),
          name: userForm.name.trim(),
          phone: userForm.phone.trim(),
          role: userForm.role,
          avatarUrl: defaultAvatar,
          status: userForm.status,
          department: userForm.department
        });
        Swal.fire('สำเร็จ', 'เพิ่มผู้ใช้งานใหม่สำเร็จ', 'success');
      }
      setShowUserModal(false);
    } catch (err: any) {
      Swal.fire('ข้อผิดพลาด', `ไม่สามารถบันทึกข้อมูลผู้ใช้งาน: ${err.message}`, 'error');
    }
  };

  const handleResetUserPassword = async (email: string) => {
    const result = await Swal.fire({
      title: 'ส่งอีเมลรีเซ็ตรหัสผ่าน?',
      text: `คุณต้องการส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปยังอีเมล ${email} หรือไม่`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ส่งอีเมล',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#3b82f6',
      cancelButtonColor: '#64748b'
    });

    if (result.isConfirmed) {
      try {
        await adminResetUserPassword(email);
        Swal.fire('สำเร็จ', 'ส่งอีเมลรีเซ็ตรหัสผ่านเรียบร้อยแล้ว', 'success');
      } catch (err: any) {
        Swal.fire('ล้มเหลว', `ไม่สามารถส่งอีเมลได้: ${err.message}`, 'error');
      }
    }
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      Swal.fire('ปฏิเสธการทำงาน', 'คุณไม่สามารถลบสิทธิ์บัญชีของตัวเองได้!', 'error');
      return;
    }

    Swal.fire({
      title: 'ต้องการลบผู้ใช้งาน?',
      text: 'ข้อมูลโปรไฟล์ผู้ใช้รายนี้จะถูกลบออกจากไดเรกทอรีระบบ!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ลบผู้ใช้',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#ef4444'
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await adminDeleteUser(id);
          Swal.fire('ลบแล้ว', 'ลบผู้ใช้งานสำเร็จ', 'success');
        } catch (err: any) {
          Swal.fire('ข้อผิดพลาด', `ไม่สามารถลบผู้ใช้งาน: ${err.message}`, 'error');
        }
      }
    });
  };

  // RBAC: Access guard
  if (!hasPermission(currentUser.role, 'admin:manage_rooms')) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center space-y-4">
        <div className="h-16 w-16 rounded-2xl bg-rose-100 dark:bg-rose-950/30 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-rose-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white">ไม่มีสิทธิ์เข้าถึง</h2>
        <p className="text-xs text-slate-400 max-w-sm">บัญชีสิทธิ์ปัจจุบัน ({currentUser.role}) ไม่มีสิทธิ์เข้าถึงหน้าจัดการระบบ กรุณาติดต่อผู้ดูแลระบบ</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">แผงจัดการตั้งค่าระบบ (Admin Command Center)</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">จัดการข้อมูลโครงสร้างห้องประชุม รายนามผู้บริหาร และบทบาทสิทธิ์บุคลากร</p>
        </div>

        {/* Tab buttons */}
        <div className="flex overflow-x-auto whitespace-nowrap bg-slate-100 dark:bg-slate-950/40 p-1 rounded-xl border border-slate-200/50 dark:border-slate-800/80 max-w-full scrollbar-none">
          <button
            onClick={() => setActiveTab('rooms')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'rooms' 
                ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" />
            <span>ห้องประชุม</span>
          </button>
          <button
            onClick={() => setActiveTab('execs')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'execs' 
                ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Award className="h-3.5 w-3.5" />
            <span>ผู้บริหาร</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'users' 
                ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Users className="h-3.5 w-3.5" />
            <span>ผู้ใช้งาน / สิทธิ์</span>
          </button>
          <button
            onClick={() => setActiveTab('depts')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
              activeTab === 'depts' 
                ? 'bg-white text-enterprise-600 shadow-sm dark:bg-slate-900 dark:text-enterprise-400' 
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
            }`}
          >
            <Building className="h-3.5 w-3.5" />
            <span>หน่วยงาน / แผนก</span>
          </button>
        </div>
      </div>

      {/* Permissions notification */}
      {!isAdmin && (
        <div className="p-4 rounded-xl bg-rose-50/50 border border-rose-200/60 dark:bg-rose-950/10 dark:border-rose-900/60 flex gap-3 text-left">
          <ShieldAlert className="h-5 w-5 text-rose-500 flex-shrink-0" />
          <div className="text-xs text-rose-600 dark:text-rose-400">
            <span className="font-bold">จำกัดสิทธิ์เขียนข้อมูล (Read-Only Mode):</span> บัญชีสิทธิ์ปัจจุบันของคุณคือ <b>{currentUser.role}</b> ซึ่งไม่มีสิทธิ์แอดมินในการแก้ไขโครงสร้างระบบเพื่อความปลอดภัย หากต้องการแก้ไข CRUD ตัวอย่าง กรุณาใช้ระบบเปลี่ยนสิทธิ์ที่แถบ Header ด้านบนเป็น <b>Admin หรือ Super Admin</b>
          </div>
        </div>
      )}

      {/* CONTENT PANELS */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left">
        
        {/* ROOMS CRUD PANEL */}
        {activeTab === 'rooms' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-2">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">รายการห้องประชุมทั้งหมด ({localRooms.length} ห้อง)</div>
                <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">ข้อมูลโครงสร้างสถานที่และสถานะการพร้อมใช้ห้องประชุม</p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleOpenRoomModal()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                  isAdmin ? 'bg-enterprise-500 hover:bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-650 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>สร้างห้องใหม่</span>
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">ห้องประชุม</th>
                    <th className="p-3">ที่ตั้ง / ชั้น</th>
                    <th className="p-3">ความจุที่นั่ง</th>
                    <th className="p-3">สิ่งอำนวยความสะดวก</th>
                    <th className="p-3">ประเภท</th>
                    <th className="p-3">สถานะห้อง</th>
                    <th className="p-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {localRooms.map(room => (
                    <tr key={room.id} className="hover:bg-slate-50/20">
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{room.name}</td>
                      <td className="p-3 text-slate-500">{room.building} (ชั้น {room.floor})</td>
                      <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">{room.capacity} ที่นั่ง</td>
                      <td className="p-3 max-w-xs truncate">
                        <div className="flex flex-wrap gap-1">
                          {room.amenities.map(a => (
                            <span key={a} className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-500">{a}</span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3">
                        {room.isVip ? (
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded-full">VIP Approval</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[9px] font-semibold px-2 py-0.5 rounded-full">Auto Approved</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-500">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          {room.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            disabled={!isAdmin}
                            onClick={() => handleOpenRoomModal(room)}
                            className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300 cursor-pointer transition-all"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={!isAdmin}
                            onClick={() => handleDeleteRoom(room.id)}
                            className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/60 cursor-pointer transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              {localRooms.map(room => (
                <div 
                  key={room.id} 
                  className={`p-4 rounded-2xl border shadow-sm space-y-3 relative transition-all duration-200 hover:shadow-md ${
                    room.isVip 
                      ? 'border-amber-200/70 bg-gradient-to-br from-amber-50/20 to-white dark:border-amber-900/40 dark:from-amber-950/10 dark:to-slate-900' 
                      : 'border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <h4 className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                        {room.name}
                        {room.isVip ? (
                          <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-405 text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-200/50 dark:border-amber-900/30">VIP</span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-[8px] font-semibold px-1.5 py-0.5 rounded border border-slate-200/40 dark:border-slate-700/50">ทั่วไป</span>
                        )}
                      </h4>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <span>📍</span>
                        <span>{room.building} (ชั้น {room.floor})</span>
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100/50 dark:border-emerald-900/10 uppercase">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      {room.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    ความจุ: <span className="font-semibold text-slate-700 dark:text-slate-200">{room.capacity} ที่นั่ง</span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {room.amenities.map(a => (
                      <span key={a} className="text-[9px] bg-slate-100 dark:bg-slate-800/60 px-2 py-0.5 rounded-lg text-slate-500 dark:text-slate-400 font-semibold">{a}</span>
                    ))}
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/85">
                    <button
                      disabled={!isAdmin}
                      onClick={() => handleOpenRoomModal(room)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-250 bg-slate-50 dark:border-slate-800 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>แก้ไข</span>
                    </button>
                    <button
                      disabled={!isAdmin}
                      onClick={() => handleDeleteRoom(room.id)}
                      className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 text-rose-500 dark:border-rose-900/60 dark:bg-rose-950/20 cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>ลบ</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXECUTIVES CRUD PANEL */}
        {activeTab === 'execs' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-2">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">ทำเนียบผู้บริหารองค์กร ({localExecs.length} รายนาม)</div>
                <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">รายนามผู้บริหารสี่ระดับหน่วยงานราชการ</p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleOpenExecModal()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                  isAdmin ? 'bg-enterprise-500 hover:bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มรายชื่อผู้บริหาร</span>
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/20 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3 w-16">รูปภาพ</th>
                    <th className="p-3">ชื่อ - นามสกุล</th>
                    <th className="p-3">ตำแหน่งทางการ</th>
                    <th className="p-3">สำนัก / ฝ่าย</th>
                    <th className="p-3">ลำดับการรักษาราชการแทน</th>
                    <th className="p-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {localExecs.map(exec => (
                    <tr key={exec.id} className="hover:bg-slate-50/20">
                     <td className="p-3">
                        <div className="h-10 w-10 rounded-full p-[2px] shadow-sm flex-shrink-0" style={{ background: exec.colorCode }}>
                          <div className="h-full w-full rounded-full bg-white dark:bg-slate-900 p-[1px] overflow-hidden">
                            {exec.avatarUrl ? (
                              <img 
                                src={exec.avatarUrl} 
                                alt={exec.name} 
                                className="h-full w-full rounded-full object-cover"
                                style={{
                                  objectPosition: `${exec.avatarOffsetX ?? 50}% ${exec.avatarOffsetY ?? 50}%`,
                                  transform: `scale(${exec.avatarScale ?? 1.0})`
                                }}
                              />
                            ) : (
                              <div 
                                className="h-full w-full rounded-full flex items-center justify-center text-white font-bold text-xs shadow-inner"
                                style={{ backgroundColor: exec.colorCode }}
                              >
                                {exec.name.trim().charAt(0) || 'ผู้'}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{exec.name}</td>
                      <td className="p-3 text-slate-500 font-semibold">{exec.position}</td>
                      <td className="p-3 text-slate-500">{exec.department}</td>
                      <td className="p-3">
                        <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                          ลำดับ {exec.priority ?? 0}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            disabled={!isAdmin}
                            onClick={() => handleOpenExecModal(exec)}
                            className="p-1 rounded bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            disabled={!isAdmin}
                            onClick={() => handleDeleteExec(exec.id)}
                            className="p-1 rounded bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/60 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4">
              {localExecs.map(exec => (
                <div key={exec.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white dark:border-slate-800 dark:bg-slate-900 shadow-sm space-y-3 relative flex items-center gap-4">
                  <div className="flex-shrink-0 h-36 w-36 rounded-full p-[2px] shadow-sm" style={{ background: exec.colorCode }}>
                    <div className="h-full w-full rounded-full bg-white dark:bg-slate-900 p-[1px] overflow-hidden">
                      {exec.avatarUrl ? (
                        <img 
                          src={exec.avatarUrl} 
                          alt={exec.name} 
                          className="h-full w-full rounded-full object-cover"
                          style={{
                            objectPosition: `${exec.avatarOffsetX ?? 50}% ${exec.avatarOffsetY ?? 50}%`,
                            transform: `scale(${exec.avatarScale ?? 1.0})`
                          }}
                        />
                      ) : (
                        <div 
                          className="h-full w-full rounded-full flex items-center justify-center text-white font-bold text-4xl shadow-inner"
                          style={{ backgroundColor: exec.colorCode }}
                        >
                          {exec.name.trim().charAt(0) || 'ผู้'}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div>
                      <h4 className="font-bold text-slate-850 dark:text-slate-100 text-xs sm:text-sm">
                        {exec.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {exec.position}
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {exec.department}
                      </p>
                      <div className="mt-1">
                        <span className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[9px] font-bold px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          ลำดับรักษาราชการแทน: {exec.priority ?? 0}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-850">
                      <button
                        disabled={!isAdmin}
                        onClick={() => handleOpenExecModal(exec)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 dark:border-slate-800 dark:hover:bg-slate-850 dark:text-slate-300 cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-40"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        disabled={!isAdmin}
                        onClick={() => handleDeleteExec(exec.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 text-rose-500 dark:border-rose-900/60 dark:bg-rose-950/20 cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* USERS PANEL */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-2">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">การจัดการผู้ใช้งาน & กำหนดสิทธิ์ (User Directory & RBAC)</div>
                <p className="text-[10px] text-slate-450 dark:text-slate-555 mt-0.5">จัดการข้อมูลเจ้าหน้าที่ ปรับสิทธิ์ และสิทธิ์การเข้าถึงเมนูต่างๆ ในระบบ</p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => handleOpenUserModal()}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                  isAdmin ? 'bg-enterprise-500 hover:bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-400 dark:text-slate-650 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มผู้ใช้งานใหม่</span>
              </button>
            </div>

            {/* Search & Filter Bar */}
            <div className="flex flex-col sm:flex-row gap-3 bg-slate-50 dark:bg-slate-950/20 p-3 rounded-2xl border border-slate-100 dark:border-slate-800/80">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={e => setSearchUserQuery(e.target.value)}
                  placeholder="ค้นหาชื่อ หรืออีเมล..."
                  className="w-full pl-9 pr-4 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-enterprise-500 text-slate-800 dark:text-slate-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">กรองสิทธิ์:</span>
                <select
                  value={filterUserRole}
                  onChange={e => setFilterUserRole(e.target.value)}
                  className="px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-enterprise-500 text-slate-800 dark:text-slate-100 cursor-pointer"
                >
                  <option value="all">ทั้งหมด (All Roles)</option>
                  <option value="General User">General User</option>
                  <option value="Secretary">Secretary</option>
                  <option value="Executive">Executive</option>
                  <option value="IT Support">IT Support</option>
                  <option value="Housekeeping">Housekeeping</option>
                  <option value="Facility Officer">Facility Officer</option>
                  <option value="Admin">Admin</option>
                  <option value="Super Admin">Super Admin</option>
                </select>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3">รูปภาพ</th>
                    <th className="p-3">ชื่อเจ้าหน้าที่</th>
                    <th className="p-3">อีเมลติดต่อ</th>
                    <th className="p-3">เบอร์ติดต่อ</th>
                    <th className="p-3">หน่วยงาน / แผนก</th>
                    <th className="p-3">เข้าใช้ล่าสุด</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3">บทบาทระบบ (Role)</th>
                    <th className="p-3 text-right">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-450 dark:text-slate-555 font-medium bg-white dark:bg-slate-900">
                        ไม่พบข้อมูลผู้ใช้งานที่ตรงกับตัวกรอง
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                        <td className="p-3">
                          <img 
                            src={u.avatarUrl} 
                            alt={u.name} 
                            className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800" 
                            style={{
                              objectPosition: `${u.avatarOffsetX ?? 50}% ${u.avatarOffsetY ?? 50}%`
                            }}
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">
                          <div className="flex items-center gap-1">
                            <span>{u.name}</span>
                            {u.id === currentUser.id && (
                              <span className="text-[8px] font-bold px-1.5 py-0.25 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">(คุณ)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-semibold">{u.email}</td>
                        <td className="p-3 text-slate-700 dark:text-slate-300 font-bold">{u.phone || '-'}</td>
                        <td className="p-3 font-semibold text-slate-600 dark:text-slate-400">{u.department || 'ไม่ระบุ'}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-455 font-medium">{formatLastLogin(u.lastLoginAt)}</td>
                        <td className="p-3">
                          {u.status === 'Suspended' ? (
                            <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-455 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/30">
                              Suspended
                            </span>
                          ) : (
                            <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30">
                              Active
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getRoleBadgeClass(u.role)}`}>
                            🛡️ {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end items-center gap-2">
                            <button
                              disabled={!isAdmin}
                              onClick={() => handleResetUserPassword(u.email)}
                              className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/60 cursor-pointer hover:border-amber-400 transition-all text-[10px] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                              title="ส่งอีเมลรีเซ็ตรหัสผ่าน"
                            >
                              <Key className="h-3 w-3" />
                              <span>รีเซ็ต</span>
                            </button>
                            <button
                              disabled={!isAdmin}
                              onClick={() => handleOpenUserModal(u)}
                              className="px-2 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350 cursor-pointer hover:border-enterprise-500 transition-all text-[10px] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                              title="แก้ไขสิทธิ์"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>แก้ไข</span>
                            </button>
                            <button
                              disabled={!isAdmin || u.id === currentUser.id}
                              onClick={() => handleDeleteUser(u.id)}
                              className="px-2 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 text-rose-500 dark:border-rose-900/60 dark:bg-rose-950/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all text-[10px] flex items-center gap-1 font-semibold"
                              title="ลบผู้ใช้งาน"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>ลบ</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              {filteredUsers.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-450 dark:text-slate-555 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  ไม่พบข้อมูลผู้ใช้งานที่ตรงกับตัวกรอง
                </div>
              ) : (
                filteredUsers.map(u => (
                  <div key={u.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 shadow-sm space-y-3 hover:shadow-md transition-all duration-200">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img 
                          src={u.avatarUrl} 
                          alt={u.name} 
                          className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-100 dark:ring-slate-800" 
                          style={{
                            objectPosition: `${u.avatarOffsetX ?? 50}% ${u.avatarOffsetY ?? 50}%`
                          }}
                        />
                        <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                          u.status === 'Suspended' ? 'bg-rose-500' : 'bg-emerald-500'
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1 text-xs sm:text-sm">
                          <span className="truncate">{u.name}</span>
                          {u.id === currentUser.id && (
                            <span className="text-[8px] font-bold px-1.5 py-0.25 rounded bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">(คุณ)</span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-450 dark:text-slate-500 truncate mt-0.5">{u.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-[11px] pt-1">
                      <div>
                        <span className="text-slate-400 block font-semibold">เบอร์ติดต่อ:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold">{u.phone || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-semibold">หน่วยงาน/แผนก:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold truncate block">{u.department || 'ไม่ระบุ'}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400 block font-semibold">เข้าใช้ล่าสุด:</span>
                        <span className="text-slate-700 dark:text-slate-300 font-bold truncate block">{formatLastLogin(u.lastLoginAt)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getRoleBadgeClass(u.role)}`}>
                        🛡️ {u.role}
                      </span>
                      {u.status === 'Suspended' ? (
                        <span className="bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-450 text-[9px] font-bold px-2 py-0.5 rounded-full border border-rose-100 dark:border-rose-900/30 uppercase tracking-wider">
                          Suspended
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-900/30 uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        disabled={!isAdmin}
                        onClick={() => handleResetUserPassword(u.email)}
                        className="px-2 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-600 dark:bg-amber-950/20 dark:border-amber-900/60 cursor-pointer hover:border-amber-400 transition-all text-[10px] flex items-center gap-1 disabled:opacity-40"
                        title="ส่งอีเมลรีเซ็ตรหัสผ่าน"
                      >
                        <Key className="h-3 w-3" />
                        <span>รีเซ็ตรหัส</span>
                      </button>
                      <button
                        disabled={!isAdmin}
                        onClick={() => handleOpenUserModal(u)}
                        className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 cursor-pointer hover:border-enterprise-500 transition-all text-[10px] flex items-center gap-1 disabled:opacity-40"
                        title="แก้ไขข้อมูลและสิทธิ์"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        disabled={!isAdmin || u.id === currentUser.id}
                        onClick={() => handleDeleteUser(u.id)}
                        className="px-2 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/60 cursor-pointer transition-all text-[10px] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="ลบผู้ใช้งาน"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* DEPARTMENTS CRUD PANEL */}
        {activeTab === 'depts' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-2">
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">หน่วยงาน / แผนก ทั้งหมด ({localDepts.length} รายการ)</div>
                <p className="text-[10px] text-slate-400 dark:text-slate-550 mt-0.5">จัดการข้อมูลโครงสร้างหน่วยงาน / แผนก ภายในองค์กร</p>
              </div>
              <button
                disabled={!isAdmin}
                onClick={() => {
                  setEditingDeptId(null);
                  setDeptForm({ name: '' });
                  setShowDeptModal(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-sm cursor-pointer whitespace-nowrap self-start sm:self-auto ${
                  isAdmin ? 'bg-enterprise-500 hover:bg-enterprise-600' : 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Plus className="h-4 w-4" />
                <span>เพิ่มหน่วยงาน</span>
              </button>
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto rounded-2xl border border-slate-150 dark:border-slate-800/80 shadow-sm">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 text-slate-400 dark:text-slate-555 font-bold uppercase tracking-wider text-[10px]">
                    <th className="p-3 w-20">ลำดับ</th>
                    <th className="p-3">ชื่อหน่วยงาน / แผนก</th>
                    <th className="p-3 text-right">ดำเนินการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {localDepts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-slate-450 dark:text-slate-555 font-medium bg-white dark:bg-slate-900">
                        ไม่พบข้อมูลหน่วยงาน / แผนก
                      </td>
                    </tr>
                  ) : (
                    localDepts.map((dept, index) => (
                      <tr key={dept.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-950/20 transition-colors">
                        <td className="p-3 font-semibold text-slate-500 w-20">{index + 1}</td>
                        <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{dept.name}</td>
                        <td className="p-3 text-right">
                          <div className="flex justify-end gap-1.5">
                            <button
                              disabled={!isAdmin}
                              onClick={() => {
                                setEditingDeptId(dept.id);
                                setDeptForm({ name: dept.name });
                                setShowDeptModal(true);
                              }}
                              className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 dark:text-slate-300 cursor-pointer transition-all"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              disabled={!isAdmin}
                              onClick={() => handleDeleteDept(dept.id)}
                              className="p-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-500 dark:bg-rose-950/20 dark:border-rose-900/60 cursor-pointer transition-all"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in duration-300">
              {localDepts.length === 0 ? (
                <div className="col-span-full py-8 text-center text-slate-450 dark:text-slate-555 font-medium bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  ไม่พบข้อมูลหน่วยงาน / แผนก
                </div>
              ) : (
                localDepts.map(dept => (
                  <div key={dept.id} className="p-4 rounded-2xl border border-slate-200/80 bg-white dark:bg-slate-900 shadow-sm space-y-3 hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-850 dark:text-slate-100 flex items-center gap-1.5 text-xs sm:text-sm">
                        <Building className="h-4 w-4 text-slate-400" />
                        <span>{dept.name}</span>
                      </h4>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        disabled={!isAdmin}
                        onClick={() => {
                          setEditingDeptId(dept.id);
                          setDeptForm({ name: dept.name });
                          setShowDeptModal(true);
                        }}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-250 bg-slate-50 dark:border-slate-800 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold"
                      >
                        <Edit3 className="h-3 w-3" />
                        <span>แก้ไข</span>
                      </button>
                      <button
                        disabled={!isAdmin}
                        onClick={() => handleDeleteDept(dept.id)}
                        className="px-2.5 py-1.5 rounded-lg border border-rose-200 bg-rose-50/50 hover:bg-rose-100/50 text-rose-500 dark:border-rose-900/60 dark:bg-rose-950/20 cursor-pointer flex items-center gap-1 text-[10px] disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>

      {/* ROOM MODAL DIALOG */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 text-left shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Server className="h-4 w-4 text-enterprise-500" />
                <span>{editingRoomId ? 'แก้ไขข้อมูลห้องประชุม' : 'เพิ่มห้องประชุมใหม่'}</span>
              </h3>
              <button onClick={() => setShowRoomModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ชื่อห้องประชุม *</label>
                <input
                  type="text"
                  required
                  value={roomForm.name}
                  onChange={e => setRoomForm({...roomForm, name: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">ความจุคน (ที่นั่ง) *</label>
                  <input
                    type="number"
                    required
                    value={roomForm.capacity}
                    onChange={e => setRoomForm({...roomForm, capacity: Number(e.target.value)})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">ชั้น *</label>
                  <input
                    type="text"
                    required
                    value={roomForm.floor}
                    onChange={e => setRoomForm({...roomForm, floor: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">อาคารสถานที่ *</label>
                <select
                  value={roomForm.building}
                  onChange={e => setRoomForm({...roomForm, building: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="อาคารอำนวยการ">อาคารอำนวยการ</option>
                  <option value="อาคารบริการ">อาคารบริการ</option>
                  <option value="หอประชุมใหญ่">หอประชุมใหญ่</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">สิ่งอำนวยความสะดวกประจำห้อง (คั่นด้วยจุลภาค ,)</label>
                <input
                  type="text"
                  value={roomForm.amenitiesInput}
                  onChange={e => setRoomForm({...roomForm, amenitiesInput: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex items-center pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={roomForm.isVip}
                    onChange={e => setRoomForm({...roomForm, isVip: e.target.checked})}
                    className="rounded border-slate-200 text-enterprise-500 focus:ring-enterprise-500 h-3.5 w-3.5"
                  />
                  <span>กำหนดเป็นห้อง VIP (ต้องการการกลั่นกรองอนุมัติใช้ห้อง)</span>
                </label>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowRoomModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-850 dark:text-slate-300">ยกเลิก</button>
                <button type="submit" className="rounded-xl bg-enterprise-500 text-white px-5 py-2 text-xs font-semibold hover:bg-enterprise-600">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXECUTIVES MODAL DIALOG */}
      {showExecModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 text-left shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Award className="h-4 w-4 text-enterprise-500" />
                <span>{editingExecId ? 'แก้ไขข้อมูลผู้บริหาร' : 'เพิ่มรายชื่อผู้บริหารใหม่'}</span>
              </h3>
              <button onClick={() => setShowExecModal(false)} className="text-slate-400 hover:text-slate-650"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSaveExec} className="space-y-4 mt-4">
              {/* Executive Avatar Upload */}
              <div className="flex flex-col items-center justify-center space-y-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">รูปภาพผู้บริหาร</label>
                <div className="relative">
                  <div 
                    onMouseDown={execForm.avatarUrl ? handleExecMouseDown : undefined}
                    onTouchStart={execForm.avatarUrl ? handleExecTouchStart : undefined}
                    className="h-36 w-36 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-center relative shadow-inner select-none touch-none group/avatar"
                    style={{ cursor: execForm.avatarUrl ? (isDraggingExec ? 'grabbing' : 'grab') : 'default' }}
                    title={execForm.avatarUrl ? "ลากที่รูปภาพเพื่อปรับตำแหน่ง" : undefined}
                  >
                    {uploadingExecAvatar ? (
                      <Loader2 className="h-8 w-8 text-enterprise-500 animate-spin" />
                    ) : execForm.avatarUrl ? (
                      <>
                        <img 
                          src={execForm.avatarUrl} 
                          alt="Executive Preview" 
                          className="h-full w-full object-cover select-none pointer-events-none transition-none"
                          style={{ 
                            objectPosition: `${execForm.avatarOffsetX ?? 50}% ${execForm.avatarOffsetY ?? 50}%`,
                            transform: `scale(${execForm.avatarScale ?? 1.0})`,
                            userSelect: 'none',
                            pointerEvents: 'none'
                          }}
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center transition-all select-none pointer-events-none">
                          <Move className="h-6 w-6 text-white animate-pulse" />
                          <span className="text-[9px] text-white font-bold mt-1 text-center px-2">ลากปรับตำแหน่ง</span>
                        </div>
                      </>
                    ) : (
                      <div 
                        onClick={() => execFileInputRef.current?.click()}
                        className="text-center text-slate-400 hover:text-slate-600 dark:text-slate-650 dark:hover:text-slate-450 flex flex-col items-center cursor-pointer p-4 w-full h-full justify-center transition-colors"
                      >
                        <Camera className="h-8 w-8 mb-1" />
                        <span className="text-[10px] font-bold">คลิกอัปโหลดภาพ</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Upload Trigger Button (bottom right of avatar) */}
                  {!uploadingExecAvatar && (
                    <button 
                      type="button"
                      onClick={() => execFileInputRef.current?.click()}
                      className="absolute bottom-0 right-0 p-2 rounded-full bg-enterprise-500 hover:bg-enterprise-600 text-white cursor-pointer shadow-lg transition-all border-2 border-white dark:border-slate-900 z-10"
                      title="เลือกไฟล์รูปภาพ"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  )}
                  <input 
                    ref={execFileInputRef}
                    type="file" 
                    accept="image/*" 
                    onChange={handleExecAvatarChange} 
                    className="hidden" 
                  />
                </div>

                {/* Zoom Control Slider */}
                {execForm.avatarUrl && !uploadingExecAvatar && (
                  <div className="w-full max-w-[240px] space-y-1.5 pt-1 flex flex-col items-center">
                    <div className="flex justify-between items-center w-full text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      <span>ซูมภาพ ({Math.round((execForm.avatarScale || 1.0) * 100)}%)</span>
                      <button
                        type="button"
                        onClick={() => setExecForm(prev => ({ ...prev, avatarScale: 1.0 }))}
                        className="text-enterprise-500 hover:text-enterprise-600 font-bold"
                      >
                        รีเซ็ตซูม
                      </button>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.05"
                      value={execForm.avatarScale || 1.0}
                      onChange={e => setExecForm(prev => ({ ...prev, avatarScale: parseFloat(e.target.value) }))}
                      className="w-full accent-enterprise-500 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
                    />
                  </div>
                )}

                {execForm.avatarUrl && !uploadingExecAvatar && (
                  <button
                    type="button"
                    onClick={handleClearExecAvatar}
                    className="text-[10px] font-bold text-rose-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer pt-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>ลบรูปภาพ</span>
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ชื่อ - นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={execForm.name}
                  onChange={e => setExecForm({...execForm, name: e.target.value})}
                  placeholder="เช่น นายอภิสิทธิ์ วงศ์วิริยะ"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ตำแหน่งหลัก *</label>
                <input
                  type="text"
                  required
                  value={execForm.position}
                  onChange={e => setExecForm({...execForm, position: e.target.value})}
                  placeholder="เช่น ปลัดจังหวัด หรือ รองผู้ว่าราชการจังหวัด"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">สำนัก / ฝ่ายสังกัด *</label>
                <input
                  type="text"
                  required
                  value={execForm.department}
                  onChange={e => setExecForm({...execForm, department: e.target.value})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ลำดับสิทธิ์การรักษาราชการแทน (0-9, 0 = สูงสุด) *</label>
                <input
                  type="number"
                  required
                  min="0"
                  max="9"
                  value={execForm.priority}
                  onChange={e => setExecForm({...execForm, priority: Number(e.target.value)})}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500">หมายเหตุ: ใช้สำหรับเรียงลำดับการตัดสินใจรักษาราชการแทนกรณีผู้บริหารไม่อยู่</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase font-semibold">สีแท็กประจำตัวบนปฏิทิน *</label>
                <input
                  type="color"
                  required
                  value={execForm.colorCode}
                  onChange={e => setExecForm({...execForm, colorCode: e.target.value})}
                  className="h-10 w-24 rounded-lg border border-slate-200 cursor-pointer focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowExecModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-850 dark:text-slate-300">ยกเลิก</button>
                <button type="submit" className="rounded-xl bg-enterprise-500 text-white px-5 py-2 text-xs font-semibold hover:bg-enterprise-600">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* USERS MODAL DIALOG */}
      {showUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-left">
            
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Users className="h-4.5 w-4.5 text-enterprise-500" />
                <span>{editingUserId ? 'แก้ไขข้อมูลและสิทธิ์ผู้ใช้' : 'เพิ่มผู้ใช้งานในระบบใหม่'}</span>
              </h3>
              <button 
                onClick={() => setShowUserModal(false)} 
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-white cursor-pointer transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">อีเมลบัญชี (Email Address) *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    disabled={!!editingUserId}
                    value={userForm.email}
                    onChange={e => setUserForm({...userForm, email: e.target.value})}
                    placeholder="เช่น user@gov.go.th"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed disabled:bg-slate-100 dark:disabled:bg-slate-950/40"
                  />
                  <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                </div>
                {!editingUserId && (
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">หมายเหตุ: อีเมลต้องถูกต้องเพื่อใช้ล็อกอินเข้าระบบ</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">ชื่อ - นามสกุล *</label>
                <input
                  type="text"
                  required
                  value={userForm.name}
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  placeholder="เช่น นายนครินทร์ สมบูรณ์"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">เบอร์โทรศัพท์ติดต่อ</label>
                <input
                  type="text"
                  value={userForm.phone}
                  onChange={e => setUserForm({...userForm, phone: e.target.value})}
                  placeholder="เช่น 089-xxxxxxx"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all shadow-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">หน่วยงาน / แผนก</label>
                <div className="relative">
                  <select
                    value={userForm.department}
                    onChange={e => setUserForm({...userForm, department: e.target.value})}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-800 dark:text-slate-100 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all shadow-sm cursor-pointer"
                  >
                    <option value="">-- เลือกหน่วยงาน / แผนก --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                  <Building className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-555" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">บทบาทสิทธิ์ใช้งาน (Role) *</label>
                <select
                  value={userForm.role}
                  onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all cursor-pointer shadow-sm"
                >
                  <option value="General User">General User (ผู้ใช้ทั่วไป)</option>
                  <option value="Secretary">Secretary (หน้าห้อง/เลขาฯ)</option>
                  <option value="Executive">Executive (ผู้บริหาร)</option>
                  <option value="IT Support">IT Support (เจ้าหน้าที่ไอที)</option>
                  <option value="Housekeeping">Housekeeping (งานแม่บ้าน)</option>
                  <option value="Facility Officer">Facility Officer (งานอำนวยความสะดวก)</option>
                  <option value="Admin">Admin (ผู้ดูแลระบบกลาง)</option>
                  <option value="Super Admin">Super Admin (ผู้ดูแลระบบสูงสุด)</option>
                </select>
                
                {/* Dynamic Role Explanation */}
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850/80 text-[10px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed">
                  💡 {getRoleDescription(userForm.role)}
                </div>
              </div>

              {/* Account Status Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">สถานะบัญชีผู้ใช้งาน (Account Status) *</label>
                <div className="flex gap-4 p-1">
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={userForm.status === 'Active'}
                      onChange={() => setUserForm({...userForm, status: 'Active'})}
                      className="text-enterprise-500 focus:ring-enterprise-500 h-3.5 w-3.5"
                    />
                    <span>ปกติ (Active)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={userForm.status === 'Suspended'}
                      onChange={() => setUserForm({...userForm, status: 'Suspended'})}
                      className="text-rose-500 focus:ring-rose-500 h-3.5 w-3.5"
                    />
                    <span className="text-rose-600 dark:text-rose-400 font-semibold">ระงับการใช้งาน (Suspended)</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setShowUserModal(false)} 
                  className="rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-850 text-slate-650 dark:text-slate-350 transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button 
                  type="submit" 
                  className="rounded-xl bg-enterprise-500 text-white px-5 py-2 text-xs font-semibold hover:bg-enterprise-600 shadow-md hover:shadow-lg shadow-enterprise-500/10 transition-all cursor-pointer"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEPARTMENTS MODAL DIALOG */}
      {showDeptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 text-left shadow-2xl border border-slate-200 dark:bg-slate-900 dark:border-slate-800 animate-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                <Building className="h-4 w-4 text-enterprise-500" />
                <span>{editingDeptId ? 'แก้ไขข้อมูลหน่วยงาน' : 'เพิ่มหน่วยงานใหม่'}</span>
              </h3>
              <button onClick={() => setShowDeptModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>

            <form onSubmit={handleSaveDept} className="space-y-4 mt-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">ชื่อหน่วยงาน / แผนก *</label>
                <input
                  type="text"
                  required
                  value={deptForm.name}
                  onChange={e => setDeptForm({ name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-800 focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button type="button" onClick={() => setShowDeptModal(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-slate-850 dark:text-slate-300">ยกเลิก</button>
                <button type="submit" className="rounded-xl bg-enterprise-500 text-white px-5 py-2 text-xs font-semibold hover:bg-enterprise-600">บันทึกข้อมูล</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
