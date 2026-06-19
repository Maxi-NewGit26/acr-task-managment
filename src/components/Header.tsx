import React, { useState, useEffect } from 'react';
import { useApp, UserRole, User } from '../context/AppContext';
import { 
  Bell, 
  Sun, 
  Moon, 
  Shield, 
  Mail, 
  MessageSquare, 
  AlertCircle, 
  Check, 
  Menu,
  Camera,
  Loader2,
  Phone,
  User as UserIcon,
  X,
  LogOut,
  Move,
  Building,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';
import Swal from 'sweetalert2';

interface HeaderProps {
  activePage: string;
  onMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ activePage, onMenuToggle }) => {
  const { 
    currentUser, 
    notifications, 
    markNotificationRead, 
    markAllNotificationsRead, 
    theme, 
    toggleTheme, 
    setCurrentUserByRole,
    updateUserProfile,
    logout,
    departments
  } = useApp();
  
  if (!currentUser) return null;
  
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleSelector, setShowRoleSelector] = useState(false);

  // Profile Modal States
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileName, setProfileName] = useState(currentUser.name);
  const [profilePhone, setProfilePhone] = useState(currentUser.phone || '');
  const [profileDepartment, setProfileDepartment] = useState(currentUser.department || '');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(currentUser.avatarUrl);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [avatarOffsetX, setAvatarOffsetX] = useState(currentUser.avatarOffsetX ?? 50);
  const [avatarOffsetY, setAvatarOffsetY] = useState(currentUser.avatarOffsetY ?? 50);
  const [avatarScale, setAvatarScale] = useState(currentUser.avatarScale ?? 1.0);

  // Crop/Edit Avatar Modal States
  const [showCropModal, setShowCropModal] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(''); // Base64 or URL
  const [cropOffsetX, setCropOffsetX] = useState(50);
  const [cropOffsetY, setCropOffsetY] = useState(50);
  const [cropScale, setCropScale] = useState(1.0);
  const [cropFile, setCropFile] = useState<File | null>(null); // To upload on confirm
  const [savingCrop, setSavingCrop] = useState(false);

  // Crop Modal Drag states
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const cropDragStart = React.useRef({ x: 0, y: 0, ox: 50, oy: 50 });
  
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  const handleTriggerFileInput = () => {
    fileInputRef.current?.click();
  };

  // Sync form inputs when currentUser updates in real-time
  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfilePhone(currentUser.phone || '');
      setProfileDepartment(currentUser.department || '');
      setProfileAvatarUrl(currentUser.avatarUrl);
      setAvatarOffsetX(currentUser.avatarOffsetX ?? 50);
      setAvatarOffsetY(currentUser.avatarOffsetY ?? 50);
      setAvatarScale(currentUser.avatarScale ?? 1.0);
    }
  }, [currentUser, showProfileModal]);

  // Crop Drag reposition logic
  useEffect(() => {
    if (!isDraggingCrop) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - cropDragStart.current.x;
      const dy = e.clientY - cropDragStart.current.y;
      // 192px is the container size (h-48 = 192px)
      const sensitivity = 100 / cropScale;
      const newX = Math.max(0, Math.min(100, cropDragStart.current.ox - (dx / 192) * sensitivity));
      const newY = Math.max(0, Math.min(100, cropDragStart.current.oy - (dy / 192) * sensitivity));
      setCropOffsetX(newX);
      setCropOffsetY(newY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const dx = e.touches[0].clientX - cropDragStart.current.x;
        const dy = e.touches[0].clientY - cropDragStart.current.y;
        const sensitivity = 100 / cropScale;
        const newX = Math.max(0, Math.min(100, cropDragStart.current.ox - (dx / 192) * sensitivity));
        const newY = Math.max(0, Math.min(100, cropDragStart.current.oy - (dy / 192) * sensitivity));
        setCropOffsetX(newX);
        setCropOffsetY(newY);
      }
    };

    const handleMouseUp = () => {
      setIsDraggingCrop(false);
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
  }, [isDraggingCrop, cropScale]);

  const handleCropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingCrop(true);
    cropDragStart.current = {
      x: e.clientX,
      y: e.clientY,
      ox: cropOffsetX,
      oy: cropOffsetY
    };
  };

  const handleCropTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDraggingCrop(true);
      cropDragStart.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        ox: cropOffsetX,
        oy: cropOffsetY
      };
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setCropFile(file);
      
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
        setCropOffsetX(50);
        setCropOffsetY(50);
        setCropScale(1.0);
        setShowCropModal(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleConfirmCrop = async () => {
    setSavingCrop(true);
    try {
      let finalAvatarUrl = profileAvatarUrl;
      
      // 1. Upload new image if selected
      if (cropFile) {
        setUploadingAvatar(true);
        const fileRef = ref(storage, `avatars/${currentUser.id}_${Date.now()}`);
        await uploadBytes(fileRef, cropFile);
        finalAvatarUrl = await getDownloadURL(fileRef);
      }

      // 2. Immediately save user profile adjustments to Firestore
      const res = await updateUserProfile({
        avatarUrl: finalAvatarUrl,
        avatarOffsetX: cropOffsetX,
        avatarOffsetY: cropOffsetY,
        avatarScale: cropScale
      });

      if (res.success) {
        setProfileAvatarUrl(finalAvatarUrl);
        setAvatarOffsetX(cropOffsetX);
        setAvatarOffsetY(cropOffsetY);
        setAvatarScale(cropScale);
        setShowCropModal(false);
        setCropFile(null);
        
        Swal.fire({
          title: 'อัปเดตสำเร็จ',
          text: 'ปรับรูปภาพประจำตัวเรียบร้อยแล้ว',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } else {
        throw new Error(res.error || 'ไม่สามารถอัปเดตโปรไฟล์ในระบบได้');
      }
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถปรับแต่งรูปภาพ: ${err.message}`, 'error');
    } finally {
      setSavingCrop(false);
      setUploadingAvatar(false);
    }
  };

  const handleRandomizeAvatar = async () => {
    const randomSeed = Math.floor(Math.random() * 10000);
    const newAvatar = `https://api.dicebear.com/7.x/adventurer/svg?seed=${randomSeed}`;
    
    // Update local state preview and reset offsets
    setProfileAvatarUrl(newAvatar);
    setAvatarOffsetX(50);
    setAvatarOffsetY(50);
    setAvatarScale(1.0);
    
    try {
      // Immediately save the randomized avatar and reset offsets to Firestore
      const res = await updateUserProfile({
        avatarUrl: newAvatar,
        avatarOffsetX: 50,
        avatarOffsetY: 50,
        avatarScale: 1.0
      });
      
      if (res.success) {
        Swal.fire({
          title: 'สำเร็จ',
          text: 'สุ่มอวาตาร์ใหม่เรียบร้อยแล้ว',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } else {
        throw new Error(res.error || 'ไม่สามารถสุ่มอวาตาร์ใหม่ได้');
      }
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถอัปเดตอวาตาร์: ${err.message}`, 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName.trim()) {
      Swal.fire('กรุณาระบุชื่อ', 'ชื่อ-นามสกุลไม่สามารถเว้นว่างได้', 'error');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await updateUserProfile({
        name: profileName.trim(),
        phone: profilePhone.trim(),
        department: profileDepartment,
        avatarUrl: profileAvatarUrl,
        avatarOffsetX: avatarOffsetX,
        avatarOffsetY: avatarOffsetY,
        avatarScale: avatarScale
      });
      if (res.success) {
        Swal.fire({
          title: 'บันทึกข้อมูลสำเร็จ',
          text: 'ข้อมูลโปรไฟล์ของคุณได้รับการอัปเดตเรียบร้อยแล้ว',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
        setShowProfileModal(false);
      } else {
        Swal.fire('เกิดข้อผิดพลาด', res.error || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
      }
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', err.message || 'ไม่สามารถบันทึกข้อมูลได้', 'error');
    } finally {
      setSavingProfile(false);
    }
  };
  
  const handleLogout = async () => {
    const result = await Swal.fire({
      title: 'ต้องการออกจากระบบ?',
      text: 'คุณแน่ใจหรือไม่ที่จะออกจากระบบการทำงานในขณะนี้',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      background: theme === 'dark' ? '#0f172a' : '#ffffff',
      color: theme === 'dark' ? '#ffffff' : '#0f172a'
    });

    if (result.isConfirmed) {
      try {
        await logout();
        setShowProfileModal(false);
        Swal.fire({
          title: 'ออกจากระบบสำเร็จ',
          text: 'นำคุณกลับสู่หน้าเข้าสู่ระบบ',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false,
          toast: true,
          position: 'top-end'
        });
      } catch (err: any) {
        Swal.fire('ข้อผิดพลาด', `ไม่สามารถออกจากระบบ: ${err.message}`, 'error');
      }
    }
  };

  const unreadCount = notifications.filter(n => n.status === 'unread').length;

  const rolesList: UserRole[] = [
    'Secretary',
    'Executive',
    'Admin',
    'Super Admin',
    'IT Support',
    'Housekeeping',
    'Facility Officer',
    'General User'
  ];

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4 text-sky-500" />;
      case 'line':
        return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case 'telegram':
        return <MessageSquare className="h-4 w-4 text-blue-400" />;
      default:
        return <AlertCircle className="h-4 w-4 text-enterprise-500" />;
    }
  };

  const getNotifLabel = (type: string) => {
    switch (type) {
      case 'email':
        return 'Email Alert';
      case 'line':
        return 'LINE OA';
      case 'telegram':
        return 'Telegram Bot';
      default:
        return 'System Notification';
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200/40 bg-white/70 px-4 md:px-6 backdrop-blur-md dark:border-slate-800/40 dark:bg-slate-900/70 transition-colors duration-200 shadow-[0_4px_30px_rgba(0,0,0,0.01)]">
        
        {/* Menu Hamburger + Title */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            title="เปิดเมนูด้านข้าง"
          >
            <Menu className="h-4 w-4" />
          </button>
          <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-800 dark:text-white capitalize truncate max-w-[130px] sm:max-w-[200px] md:max-w-none">
            {activePage}
          </h1>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setShowRoleSelector(!showRoleSelector)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 sm:px-3 py-1.5 text-[10px] sm:text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-sm"
            >
              <Shield className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-enterprise-500" />
              <span className="hidden sm:inline">สิทธิ์: {currentUser.role}</span>
              <span className="sm:hidden">{currentUser.role.split(' ')[0]}</span>
            </button>
            
            {showRoleSelector && (
              <div className="absolute right-0 mt-2 w-52 sm:w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="px-2 py-1.5 text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  สลับสิทธิ์เข้าถึง (เพื่อทดสอบระบบ)
                </div>
                <div className="max-h-60 overflow-y-auto">
                  {rolesList.map(r => (
                    <button
                      key={r}
                      onClick={() => {
                        setCurrentUserByRole(r);
                        setShowRoleSelector(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer ${
                        currentUser.role === r 
                          ? 'text-enterprise-600 dark:text-enterprise-440 bg-enterprise-50 dark:bg-enterprise-950/30' 
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <span>{r}</span>
                      {currentUser.role === r && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-all cursor-pointer border border-slate-200/50 dark:border-slate-800/50"
            title="สลับธีม สว่าง/มืด"
          >
            {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 transition-all cursor-pointer border border-slate-200/50 dark:border-slate-800/50"
            >
              <Bell className="h-3.5 w-3.5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
                <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-[10px] sm:text-xs font-bold text-slate-800 dark:text-white">แจ้งเตือนล่าสุด ({unreadCount} ใหม่)</span>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsRead}
                      className="text-[9px] sm:text-[10px] font-semibold text-enterprise-500 hover:underline cursor-pointer"
                    >
                      อ่านทั้งหมด
                    </button>
                  )}
                </div>
                
                <div className="mt-1 max-h-72 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-550">
                      ไม่มีการแจ้งเตือน
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationRead(n.id)}
                        className={`flex gap-3 rounded-lg p-2.5 text-left text-xs transition-colors hover:bg-slate-55 dark:hover:bg-slate-800/50 cursor-pointer ${
                          n.status === 'unread' ? 'bg-slate-50/70 dark:bg-slate-800/20 font-semibold' : ''
                        }`}
                      >
                        <div className="mt-0.5 rounded-full bg-slate-100 p-1.5 dark:bg-slate-800">
                          {getNotifIcon(n.type)}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-550">
                              {getNotifLabel(n.type)}
                            </span>
                            <span className="text-[9px] text-slate-400">
                              {new Date(n.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="text-slate-800 dark:text-slate-200 mt-0.5 font-medium">{n.title}</div>
                          <div className="text-slate-500 dark:text-slate-400 mt-0.5 font-normal line-clamp-2">{n.message}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Info */}
          <div 
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-4 dark:border-slate-800 cursor-pointer hover:opacity-85 select-none transition-all group"
            title="แก้ไขข้อมูลส่วนตัว"
          >
            <div className="h-7 sm:h-8 w-7 sm:w-8 rounded-full overflow-hidden ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-enterprise-500 transition-all flex items-center justify-center">
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
            <div className="hidden md:block text-left">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-enterprise-500 transition-all">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400 dark:text-slate-555">{currentUser.role}</div>
            </div>
          </div>
        </div>
      </header>

      {/* User Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-left flex flex-col">
            
            {/* Modal Header Banner */}
            <div className="h-28 bg-gradient-to-r from-enterprise-500 to-indigo-600 relative flex items-start p-5 pt-6 flex-shrink-0">
              <div className="absolute right-4 top-4">
                <button 
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-full p-1.5 bg-black/20 hover:bg-black/40 text-white cursor-pointer transition-all"
                  title="ปิดหน้าต่าง"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                <span>ข้อมูลส่วนตัวผู้ใช้งาน</span>
              </h3>
            </div>

            <form onSubmit={handleSaveProfile} className="p-6 space-y-5 overflow-y-auto flex-1 font-sans">
              
              {/* Avatar Section */}
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 mt-2 mb-6">
                <div className="relative group">
                  <div 
                    className="h-24 w-24 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-950 border-4 border-white dark:border-slate-900 shadow-md relative group/avatar select-none"
                  >
                    <img 
                      src={profileAvatarUrl} 
                      alt="Avatar Preview" 
                      className="h-full w-full object-cover select-none pointer-events-none"
                      style={{ 
                        objectPosition: `${avatarOffsetX}% ${avatarOffsetY}%`,
                        transform: `scale(${avatarScale})`,
                        userSelect: 'none',
                        pointerEvents: 'none'
                      }}
                    />
                    {uploadingAvatar && (
                      <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center pointer-events-none">
                        <Loader2 className="h-6 w-6 text-enterprise-500 animate-spin" />
                      </div>
                    )}
                  </div>
                  
                  {/* Adjust Existing Avatar Button (Left side) */}
                  <button 
                    type="button"
                    onClick={() => {
                      setCropFile(null); // Adjusting existing
                      setCropImageSrc(profileAvatarUrl);
                      setCropOffsetX(avatarOffsetX);
                      setCropOffsetY(avatarOffsetY);
                      setCropScale(avatarScale);
                      setShowCropModal(true);
                    }}
                    className="absolute bottom-0 left-0 p-1.5 rounded-full bg-slate-600 hover:bg-slate-700 text-white cursor-pointer shadow-lg transition-all border-2 border-white dark:border-slate-900 z-10"
                    title="ปรับตำแหน่งและซูมรูปภาพปัจจุบัน"
                  >
                    <Move className="h-3.5 w-3.5" />
                  </button>

                  {/* Upload New Avatar Button (Right side) */}
                  <button 
                    type="button"
                    onClick={handleTriggerFileInput}
                    className="absolute bottom-0 right-0 p-1.5 rounded-full bg-enterprise-500 hover:bg-enterprise-600 text-white cursor-pointer shadow-lg transition-all border-2 border-white dark:border-slate-900 z-10"
                    title="อัปโหลดรูปภาพใหม่"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden" 
                  />
                </div>

                <div className="text-center sm:text-left flex-1 pb-1">
                  <h4 className="text-sm font-bold text-slate-800 dark:text-white truncate max-w-[160px] sm:max-w-[200px]">
                    {currentUser.name}
                  </h4>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-1">
                    <span className="bg-enterprise-50 text-enterprise-700 dark:bg-enterprise-950/40 dark:text-enterprise-440 text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider flex items-center gap-1">
                      🛡️ {currentUser.role}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 mt-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={handleTriggerFileInput}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 text-[10px] text-enterprise-600 dark:text-enterprise-450 font-bold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                  >
                    📤 อัปโหลดรูป
                  </button>
                  <button
                    type="button"
                    onClick={handleRandomizeAvatar}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-850 text-[10px] text-slate-655 dark:text-slate-400 font-semibold cursor-pointer transition-all flex items-center gap-1 shadow-sm"
                  >
                    🎲 สุ่มอวาตาร์
                  </button>
                </div>
              </div>

              {/* Input Fields */}
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">ชื่อ - นามสกุล</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => setProfileName(e.target.value)}
                      placeholder="ระบุชื่อ-นามสกุล"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-800 dark:text-slate-105 placeholder-slate-400 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all shadow-sm"
                      required
                    />
                    <UserIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-555" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">เบอร์โทรศัพท์ติดต่อ</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={profilePhone}
                      onChange={e => setProfilePhone(e.target.value)}
                      placeholder="ระบุเบอร์โทรศัพท์"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950 px-3 py-2 pl-9 text-xs text-slate-800 dark:text-slate-105 placeholder-slate-400 focus:border-enterprise-500 dark:focus:border-enterprise-500 focus:outline-none transition-all shadow-sm"
                    />
                    <Phone className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 dark:text-slate-555" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">หน่วยงาน / แผนก</label>
                  <div className="relative">
                    <select
                      value={profileDepartment}
                      onChange={e => setProfileDepartment(e.target.value)}
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

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">อีเมลบัญชี (แก้ไขไม่ได้)</label>
                    <input
                      type="email"
                      value={currentUser.email}
                      className="w-full rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-100/50 dark:bg-slate-950/40 px-3 py-2 text-xs text-slate-400 dark:text-slate-555 focus:outline-none cursor-not-allowed"
                      disabled
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-555 uppercase tracking-wider">บทบาทสิทธิ์ (แก้ไขไม่ได้)</label>
                    <input
                      type="text"
                      value={currentUser.role}
                      className="w-full rounded-xl border border-slate-100 dark:border-slate-850 bg-slate-100/50 dark:bg-slate-950/40 px-3 py-2 text-xs text-slate-400 dark:text-slate-555 focus:outline-none cursor-not-allowed"
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-150 dark:border-slate-800 flex flex-col gap-2.5">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowProfileModal(false)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-655 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile || uploadingAvatar}
                    className="flex-1 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 font-semibold py-2.5 text-xs text-white cursor-pointer shadow-lg shadow-enterprise-500/20 transition-all flex justify-center items-center gap-1.5"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <span>บันทึกการเปลี่ยนแปลง</span>
                    )}
                  </button>
                </div>
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/20 dark:text-rose-440 dark:hover:bg-rose-950/30 font-bold py-2.5 text-xs cursor-pointer transition-all flex items-center justify-center gap-2 border border-rose-100 dark:border-rose-900/30"
                >
                  <LogOut className="h-4 w-4" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* User Profile Crop/Edit Modal */}
      {showCropModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 text-left flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950/40">
              <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <Move className="h-4 w-4 text-enterprise-500" />
                <span>ปรับตำแหน่งและซูมรูปภาพ</span>
              </h3>
              <button 
                onClick={() => {
                  setShowCropModal(false);
                  setCropFile(null);
                }}
                className="rounded-full p-1.5 hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-400 dark:text-slate-500 transition-all cursor-pointer"
                title="ปิดหน้าต่าง"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Crop Container */}
            <div className="p-6 flex flex-col items-center gap-6 font-sans">
              {/* Circular Editor Canvas */}
              <div 
                onMouseDown={handleCropMouseDown}
                onTouchStart={handleCropTouchStart}
                className="h-48 w-48 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-950 border-4 border-slate-200 dark:border-slate-800 shadow-md relative select-none touch-none cursor-move flex items-center justify-center"
                style={{ cursor: isDraggingCrop ? 'grabbing' : 'grab' }}
                title="ลากรูปภาพเพื่อเลื่อนปรับตำแหน่ง"
              >
                {cropImageSrc && (
                  <img 
                    src={cropImageSrc} 
                    alt="Crop Preview" 
                    className="h-full w-full object-cover select-none pointer-events-none transition-none"
                    style={{ 
                      objectPosition: `${cropOffsetX}% ${cropOffsetY}%`,
                      transform: `scale(${cropScale})`,
                      userSelect: 'none',
                      pointerEvents: 'none'
                    }}
                  />
                )}

                {savingCrop && (
                  <div className="absolute inset-0 bg-slate-950/70 flex items-center justify-center pointer-events-none">
                    <Loader2 className="h-8 w-8 text-enterprise-500 animate-spin" />
                  </div>
                )}
              </div>

              <div className="w-full text-center space-y-1 select-none">
                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-bold uppercase tracking-wider">ลากเพื่อย้ายตำแหน่งรูปภาพ | ซูมเพื่อขยายภาพ</span>
              </div>

              {/* Slider for Zoom */}
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400 font-semibold px-1 select-none">
                  <span className="flex items-center gap-1"><ZoomOut className="h-3.5 w-3.5 text-slate-400" /> ซูมออก</span>
                  <span className="text-[11px] font-bold text-enterprise-500">{Math.round(cropScale * 100)}%</span>
                  <span className="flex items-center gap-1">ซูมเข้า <ZoomIn className="h-3.5 w-3.5 text-slate-400" /></span>
                </div>
                <input 
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropScale}
                  onChange={e => setCropScale(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-enterprise-500"
                />
              </div>

              {/* Helper Quick Controls */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCropScale(1.0);
                    setCropOffsetX(50);
                    setCropOffsetY(50);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer transition-colors"
                >
                  จัดกึ่งกลาง / รีเซ็ตซูม
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowCropModal(false);
                  setCropFile(null);
                }}
                disabled={savingCrop}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 py-2.5 text-xs font-semibold text-slate-655 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-850 transition-all cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmCrop}
                disabled={savingCrop}
                className="flex-1 rounded-xl bg-enterprise-500 hover:bg-enterprise-600 font-semibold py-2.5 text-xs text-white cursor-pointer shadow-lg shadow-enterprise-500/20 transition-all flex justify-center items-center gap-1.5 disabled:opacity-50"
              >
                {savingCrop ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>ตกลงแก้ไข</span>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
