import React from 'react';
import { useApp } from '../context/AppContext';
import { hasPermission } from '../rbac';
import { 
  LayoutDashboard, 
  Calendar, 
  PlusCircle, 
  CheckSquare, 
  BarChart3, 
  Tv, 
  Settings, 
  Sliders,
  X,
  Activity,
  LogOut
} from 'lucide-react';
import Swal from 'sweetalert2';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, isOpen, onClose }) => {
  const { bookings, currentUser, logout, theme } = useApp();
  if (!currentUser) return null;

  // Count pending approvals
  const pendingApprovalsCount = bookings.filter(b => b.approvalStatus === 'Pending').length;

  const menuItems = [
    { name: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5" />, label: 'แดชบอร์ด' },
    { name: 'Calendar', icon: <Calendar className="h-5 w-5" />, label: 'ปฏิทินภารกิจ' },
    { name: 'Book a Room', icon: <PlusCircle className="h-5 w-5" />, label: 'ลงภารกิจ / จองห้อง' },
    { 
      name: 'Approval Center', 
      icon: <CheckSquare className="h-5 w-5" />, 
      label: 'ศูนย์อนุมัติห้อง', 
      badge: ['Super Admin', 'Admin', 'Executive'].includes(currentUser.role) && pendingApprovalsCount > 0 ? pendingApprovalsCount : undefined 
    },
    { name: 'Reports', icon: <BarChart3 className="h-5 w-5" />, label: 'รายงานวิเคราะห์' },
    { name: 'Digital Signage', icon: <Tv className="h-5 w-5" />, label: 'ป้ายหน้าห้องประชุม' },
    { name: 'Executive Status', icon: <Activity className="h-5 w-5" />, label: 'สถานะผู้บริหาร' },
    { name: 'Admin Settings', icon: <Settings className="h-5 w-5" />, label: 'จัดการข้อมูลระบบ' }
  ];

  const visibleMenuItems = menuItems.filter(item => {
    const permMap: Record<string, string> = {
      'Dashboard': 'menu:dashboard',
      'Calendar': 'menu:calendar', 
      'Book a Room': 'menu:book_room',
      'Approval Center': 'menu:approval_center',
      'Reports': 'menu:reports',
      'Digital Signage': 'menu:digital_signage',
      'Executive Status': 'menu:exec_status',
      'Admin Settings': 'menu:admin_settings',
    };
    const perm = permMap[item.name];
    return perm ? hasPermission(currentUser.role, perm as any) : true;
  });

  const handleNavigation = (pageName: string) => {
    setActivePage(pageName);
    if (onClose) onClose(); // Auto-close sidebar on click for mobile
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
        if (onClose) onClose();
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

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpen && (
        <div 
          onClick={onClose}
          className="lg:hidden fixed inset-0 z-30 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-200"
        ></div>
      )}

      {/* Sidebar Panel */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200/40 bg-white/70 dark:border-slate-800/40 dark:bg-slate-900/70 backdrop-blur-md transition-transform duration-300 ease-in-out lg:translate-x-0 shadow-[0_8px_30px_rgb(0,0,0,0.02)] ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {/* Brand Header */}
        <div className="flex h-16 items-center justify-between px-6 border-b border-slate-200/40 dark:border-slate-800/40">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Task & Facility Logo" className="h-9 w-9 rounded-xl object-contain drop-shadow-md" />
            <div className="text-left">
              <div className="text-xs font-bold leading-tight text-slate-800 dark:text-white uppercase tracking-wider">Task & Facility</div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500">ระบบตารางงานและจองห้อง</div>
            </div>
          </div>

          {/* Close button on Mobile */}
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 space-y-1.5 px-4 py-6">
          {visibleMenuItems.map(item => {
            const isActive = activePage === item.name;
            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item.name)}
                className={`group flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-enterprise-500 text-white shadow-lg shadow-enterprise-500/10'
                    : 'text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-500 dark:group-hover:text-slate-300'}`}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                
                {item.badge !== undefined && (
                  <span className={`flex h-5 min-w-5 items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                    isActive 
                      ? 'bg-white text-enterprise-600' 
                      : 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Log Out Button */}
        <div className="px-4 py-2 border-t border-slate-200/40 dark:border-slate-800/40">
          <button
            onClick={handleLogout}
            className="group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:text-rose-450 dark:hover:bg-rose-955/20 cursor-pointer transition-all"
          >
            <LogOut className="h-5 w-5 text-rose-500 group-hover:text-rose-600 dark:text-rose-450 transition-colors" />
            <span>ออกจากระบบ</span>
          </button>
        </div>

        {/* Footer Info */}
        <div className="p-4 border-t border-slate-200/40 dark:border-slate-800/40 bg-white/20 dark:bg-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-enterprise-100 p-2 text-enterprise-600 dark:bg-enterprise-950/40 dark:text-enterprise-400">
              <Sliders className="h-4 w-4" />
            </div>
            <div className="text-left overflow-hidden">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">Vibe Coding Mode</div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500 truncate">Enterprise Solution v1.0.0</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
