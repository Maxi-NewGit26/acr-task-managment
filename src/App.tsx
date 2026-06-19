import { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CalendarView } from './pages/CalendarView';
import { TaskForm } from './pages/TaskForm';
import { ApprovalCenter } from './pages/ApprovalCenter';
import { Reports } from './pages/Reports';
import { DigitalSignage } from './pages/DigitalSignage';
import { AdminSettings } from './pages/AdminSettings';
import { ExecutiveStatus } from './pages/ExecutiveStatus';
import { LayoutDashboard, Calendar, PlusCircle, CheckSquare, Menu } from 'lucide-react';
import { hasPermission } from './rbac';

function AppContent() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { bookings, currentUser, loadingAuth } = useApp();

  const pendingApprovalsCount = bookings.filter(b => b.approvalStatus === 'Pending').length;

  if (loadingAuth) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="h-10 w-10 border-4 border-enterprise-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return <Login />;
  }

  // If active page is Digital Signage, render it in full screen without sidebar/header
  if (activePage === 'Digital Signage') {
    return <DigitalSignage />;
  }

  // Routing switch with RBAC guard
  const renderActivePage = () => {
    // Route guard: check menu permission
    const pagePermMap: Record<string, string> = {
      'Dashboard': 'menu:dashboard',
      'Calendar': 'menu:calendar',
      'Book a Room': 'menu:book_room',
      'Approval Center': 'menu:approval_center',
      'Reports': 'menu:reports',
      'Executive Status': 'menu:exec_status',
      'Admin Settings': 'menu:admin_settings',
    };
    const requiredPerm = pagePermMap[activePage];
    if (requiredPerm && !hasPermission(currentUser.role, requiredPerm as any)) {
      return <Dashboard setActivePage={setActivePage} />;
    }

    switch (activePage) {
      case 'Dashboard':
        return <Dashboard setActivePage={setActivePage} />;
      case 'Calendar':
        return <CalendarView setActivePage={setActivePage} />;
      case 'Book a Room':
        return <TaskForm setActivePage={setActivePage} />;
      case 'Approval Center':
        return <ApprovalCenter />;
      case 'Reports':
        return <Reports />;
      case 'Executive Status':
        return <ExecutiveStatus />;
      case 'Admin Settings':
        return <AdminSettings />;
      default:
        return <Dashboard setActivePage={setActivePage} />;
    }
  };

  const getPageThaiLabel = () => {
    switch (activePage) {
      case 'Dashboard':
        return 'แดชบอร์ด';
      case 'Calendar':
        return 'ปฏิทินตารางภารกิจ';
      case 'Book a Room':
        return 'ลงภารกิจและจองห้องประชุม';
      case 'Approval Center':
        return 'ศูนย์พิจารณาอนุมัติห้อง VIP';
      case 'Reports':
        return 'รายงานและข้อมูลสถิติ';
      case 'Executive Status':
        return 'สถานะผู้บริหารและผู้รักษาราชการแทน (Executive Status & Acting Authority)';
      case 'Admin Settings':
        return 'แผงควบคุมผู้ดูแลระบบ';
      default:
        return 'ระบบบริหารจัดการ';
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      
      {/* Sidebar Navigation - Handles drawer sliding on mobile */}
      <Sidebar 
        activePage={activePage} 
        setActivePage={setActivePage} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:pl-64 min-h-screen pb-20 lg:pb-0 min-w-0">
        {/* Header bar with hamburger toggle */}
        <Header 
          activePage={getPageThaiLabel()} 
          onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        {/* Dynamic page content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {renderActivePage()}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar - Sticky PWA Feel */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-2 px-2 shadow-2xl">
        <button
          onClick={() => {
            setActivePage('Dashboard');
            setIsSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activePage === 'Dashboard' ? 'text-enterprise-500 font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[9px] mt-1">แดชบอร์ด</span>
        </button>

        <button
          onClick={() => {
            setActivePage('Calendar');
            setIsSidebarOpen(false);
          }}
          className={`flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activePage === 'Calendar' ? 'text-enterprise-500 font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <Calendar className="h-5 w-5" />
          <span className="text-[9px] mt-1">ปฏิทิน</span>
        </button>

        {/* Highlighted center action button - only for roles with task:create */}
        {hasPermission(currentUser.role, 'task:create') && (
        <button
          onClick={() => {
            setActivePage('Book a Room');
            setIsSidebarOpen(false);
          }}
          className="relative -top-5 flex flex-col items-center justify-center h-14 w-14 rounded-full bg-enterprise-500 hover:bg-enterprise-600 text-white shadow-lg shadow-enterprise-500/35 cursor-pointer transition-all hover:scale-105 active:scale-95 z-50 border-4 border-slate-50 dark:border-slate-950"
        >
          <PlusCircle className="h-7 w-7" />
        </button>
        )}

        {hasPermission(currentUser.role, 'menu:approval_center') && (
        <button
          onClick={() => {
            setActivePage('Approval Center');
            setIsSidebarOpen(false);
          }}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 cursor-pointer transition-colors ${
            activePage === 'Approval Center' ? 'text-enterprise-500 font-bold' : 'text-slate-400 dark:text-slate-500'
          }`}
        >
          <CheckSquare className="h-5 w-5" />
          <span className="text-[9px] mt-1">อนุมัติห้อง</span>
          {['Super Admin', 'Admin', 'Executive'].includes(currentUser.role) && pendingApprovalsCount > 0 && (
            <span className="absolute top-1 right-5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-bold text-white px-1">
              {pendingApprovalsCount}
            </span>
          )}
        </button>
        )}

        <button
          onClick={() => setIsSidebarOpen(true)}
          className="flex flex-col items-center justify-center flex-1 py-1 cursor-pointer text-slate-400 dark:text-slate-500"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[9px] mt-1">เพิ่มเติม</span>
        </button>
      </div>

    </div>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
