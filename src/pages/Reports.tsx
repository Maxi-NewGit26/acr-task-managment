import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Download, FileSpreadsheet, FileText, CheckCircle2, TrendingUp, HelpCircle } from 'lucide-react';
import Swal from 'sweetalert2';

export const Reports: React.FC = () => {
  const { tasks, bookings, rooms, executives } = useApp();

  // Chart Data 1: Room Utilization (Total hours booked per room)
  const roomUtilityData = rooms.map(room => {
    // Find bookings for this room (only approved ones)
    const roomBookings = bookings.filter(b => b.roomId === room.id && b.approvalStatus === 'Approved');
    
    // Calculate total hours
    let totalHours = 0;
    roomBookings.forEach(b => {
      const start = new Date(b.startTime);
      const end = new Date(b.endTime);
      const diffMs = end.getTime() - start.getTime();
      totalHours += diffMs / (1000 * 60 * 60); // convert to hours
    });

    return {
      name: room.name,
      'ชั่วโมงที่ใช้': parseFloat(totalHours.toFixed(1)),
      bookingsCount: roomBookings.length
    };
  });

  // Chart Data 2: Peak Hours of the day (occupancy index 8:00 - 18:00)
  // Let's mock/calculate dynamic usage counts from current bookings
  const hourLabels = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const peakHourData = hourLabels.map(hour => {
    // Count bookings overlapping with this hour
    const activeBookings = bookings.filter(b => {
      if (b.approvalStatus !== 'Approved') return false;
      const start = new Date(b.startTime).getHours();
      const end = new Date(b.endTime).getHours();
      return hour >= start && hour < end;
    }).length;

    return {
      time: `${String(hour).padStart(2, '0')}:00`,
      'ความหนาแน่น': activeBookings
    };
  });

  // Chart Data 3: Executive Schedule breakdown
  const COLORS = ['#0e8eed', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
  const execDistribution = executives.map(exec => {
    const count = tasks.filter(t => t.executiveId === exec.id && t.status !== 'Cancelled').length;
    return {
      name: exec.name,
      value: count
    };
  }).filter(item => item.value > 0);

  // Client-Side CSV Exporter
  const handleExportCSV = () => {
    if (tasks.length === 0) {
      Swal.fire('ไม่มีข้อมูล', 'ไม่มีตารางกำหนดการที่ต้องการดาวน์โหลด', 'warning');
      return;
    }

    // Header row
    const headers = ['Task ID', 'Subject', 'Executive', 'Start Time', 'End Time', 'Meeting Room', 'Confidentiality', 'Priority', 'Status'];
    
    // Data rows
    const rows = tasks.map(task => {
      const exec = executives.find(e => e.id === task.executiveId);
      const booking = bookings.find(b => b.taskId === task.id);
      const room = rooms.find(r => r.id === booking?.roomId);
      
      return [
        task.id,
        `"${task.title.replace(/"/g, '""')}"`,
        `"${exec?.name || ''}"`,
        task.startTime,
        task.endTime,
        `"${room?.name || 'ไม่ได้ระบุ'}"`,
        task.confidentialityLevel,
        task.priority,
        task.status
      ];
    });

    // Build CSV Content
    // Include UTF-8 BOM so Thai characters open correctly in Excel
    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    // Create download element
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Task_Facility_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    Swal.fire({
      title: 'ดาวน์โหลดรายงานสำเร็จ',
      text: 'ระบบทำการสร้างไฟล์รายงานตารางสรุปภารกิจในรูปแบบ Excel (CSV) เรียบร้อยแล้ว',
      icon: 'success',
      confirmButtonText: 'ตกลง'
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200/60 dark:border-slate-800 gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-800 dark:text-white">รายงานสถิติการใช้งานห้องประชุมและตารางภารกิจ</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">วิเคราะห์ข้อมูลความหนาแน่นการจอง อัตราส่วนกิจกรรม และดาวน์โหลดแฟ้มข้อมูลดิบ</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white cursor-pointer shadow-sm shadow-emerald-600/10 transition-all"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>ดาวน์โหลดรายงานดิบ Excel (CSV)</span>
          </button>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* KPI 1 */}
        <div className="rounded-xl bg-enterprise-50/40 p-4 border border-enterprise-100 dark:bg-enterprise-950/20 dark:border-enterprise-900/60 text-left">
          <div className="text-[10px] font-bold text-enterprise-600 uppercase tracking-wider">ห้องที่ครองสถิติจองสูงสุด</div>
          <div className="text-lg font-bold text-slate-800 dark:text-white mt-1">ห้องประชุมศรีวิชัย (VIP)</div>
          <p className="text-[10px] text-slate-400 mt-0.5">รวม 3.0 ชั่วโมงวันนี้ จากการใช้วาระยุทธศาสตร์</p>
        </div>

        {/* KPI 2 */}
        <div className="rounded-xl bg-purple-50/40 p-4 border border-purple-100 dark:bg-purple-950/20 dark:border-purple-900/60 text-left">
          <div className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">ช่วงเวลาที่มีความหนาแน่นสูงสุด</div>
          <div className="text-lg font-bold text-slate-800 dark:text-white mt-1">10:00 - 12:00 น.</div>
          <p className="text-[10px] text-slate-400 mt-0.5">มีจองห้องพร้อมกันถึง 2 รายการ</p>
        </div>

        {/* KPI 3 */}
        <div className="rounded-xl bg-emerald-50/40 p-4 border border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/60 text-left">
          <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ผู้บริหารที่ตารางงานแน่นที่สุด</div>
          <div className="text-lg font-bold text-slate-800 dark:text-white mt-1">ดร.สมชาย วิเศษศักดิ์</div>
          <p className="text-[10px] text-slate-400 mt-0.5">ผู้ว่าราชการจังหวัด (3 ภารกิจในวันนี้และพรุ่งนี้)</p>
        </div>

      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Room Occupancy Hours */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6">อัตราการใช้งานห้องประชุม (ชั่วโมงสะสมรวม)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roomUtilityData} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-10} textAnchor="end" />
                <YAxis label={{ value: 'ชั่วโมงสะสม', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value} ชั่วโมง`, 'ใช้ไปแล้ว']} />
                <Bar dataKey="ชั่วโมงที่ใช้" fill="#0e8eed" radius={[4, 4, 0, 0]} barSize={35} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Peak Hours Occupancy Line */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6">ชั่วโมงการจองใช้บริการหนาแน่นสูงสุด (Peak Hours)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakHourData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} />
                <YAxis allowDecimals={false} label={{ value: 'จำนวนห้องที่ถูกจองพร้อมกัน', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <Tooltip />
                <Area type="monotone" dataKey="ความหนาแน่น" stroke="#8b5cf6" fillOpacity={0.15} fill="url(#colorUv)" />
                <defs>
                  <linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Exec Breakdown Pie */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 text-left lg:col-span-2">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-6">อัตราส่วนภารกิจจำแนกรายผู้บริหาร (งานตารางเดิน)</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Chart */}
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={execDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {execDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} ภารกิจ`, 'จำนวนงาน']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legends Details */}
            <div className="space-y-3">
              {execDistribution.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-extrabold text-slate-800 dark:text-white">{item.value} งาน</span>
                </div>
              ))}
              {execDistribution.length === 0 && (
                <div className="text-xs text-slate-400 italic">ไม่มีข้อมูลภารกิจเปิดสำหรับผู้บริหารในช่วงนี้</div>
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
