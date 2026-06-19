import React, { createContext, useContext, useState, useEffect } from 'react';
import { hasPermission, canEditTask, canCancelTask } from '../rbac';
import Swal from 'sweetalert2';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithPopup,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  getDocs,
  updateDoc, 
  deleteDoc,
  collection, 
  onSnapshot, 
  query, 
  where, 
  writeBatch
} from 'firebase/firestore';
import { auth, db, googleProvider, getFirebaseMessaging, storage } from '../firebase';
import { getToken } from 'firebase/messaging';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// --- Type Definitions ---

export type UserRole =
  | 'Super Admin'
  | 'Admin'
  | 'Secretary'
  | 'Executive'
  | 'Facility Officer'
  | 'IT Support'
  | 'Housekeeping'
  | 'General User';

export interface Department {
  id: string;
  name: string;
}

export type ConfidentialityLevel = 'Public' | 'Internal' | 'Confidential' | 'Secret';

export type PriorityLevel =
  | 'ด่วนมาก'
  | 'ด่วน'
  | 'ปกติ'
  | 'ภารกิจลับ'
  | 'ประชุมภายใน'
  | 'ประชุมภายนอก';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  telegramChatId?: string;
  lineUserId?: string;
  avatarUrl: string;
  avatarOffsetX?: number;
  avatarOffsetY?: number;
  avatarScale?: number; // Zoom/scale factor for user profile picture
  fcmToken?: string;
  status?: 'Active' | 'Suspended';
  lastLoginAt?: string;
  department?: string;
}

export interface Executive {
  id: string;
  name: string;
  position: string;
  department: string;
  colorCode: string;
  priority: number; // 0-9 for acting ranking (0 = top leader)
  status?: 'Active' | 'Suspended';
  avatarUrl?: string;
  avatarOffsetX?: number;
  avatarOffsetY?: number;
  avatarScale?: number;
}

export interface ExecutiveStatusRecord {
  id: string;
  executiveId: string;
  status: string; // 'อยู่ปฏิบัติราชการ', 'ไปราชการ', 'ประชุมภายนอก', 'อบรม/สัมมนา', 'ลาป่วย', 'ลากิจ', 'ลาพักผ่อน', 'ลาคลอด', 'Work From Home', 'ติดภารกิจ', 'อื่น ๆ'
  details?: string;
  location?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  note?: string;
  recordedBy: string; // Name or Email of Secretary/Admin
  recordedAt: string; // ISO timestamp
  actingExecutiveId?: string; // Specific designated acting executive ID
}

export interface MeetingRoom {
  id: string;
  name: string;
  capacity: number;
  building: string;
  floor: string;
  amenities: string[];
  isVip: boolean;
  status: 'Available' | 'Maintenance' | 'OutOfService';
}

export interface Task {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  executiveId: string;
  confidentialityLevel: ConfidentialityLevel;
  priority: PriorityLevel;
  attendees: string[];
  createdBy: string; // User ID
  status: 'Scheduled' | 'Cancelled' | 'Completed';
  createdAt: string;
  attachments?: { fileName: string, fileUrl: string, fileSize: number }[];
  department?: string;
}

export interface RoomBooking {
  id: string;
  taskId: string;
  roomId: string;
  startTime: string;
  endTime: string;
  approvalStatus: 'Approved' | 'Pending' | 'Rejected';
  requestedAmenities: string[];
  layoutStyle: 'U-Shape' | 'Classroom' | 'Theater' | 'Standard';
  comment?: string;
  approvedBy?: string; // User ID
}

export interface TaskAssignment {
  id: string;
  taskId: string;
  title: string;
  assignedToRole: UserRole;
  assignedToUserId?: string;
  status: 'Pending' | 'In_Progress' | 'Completed';
  dueDate: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  details: string;
}

export interface ConflictDetails {
  hasConflict: boolean;
  roomConflict?: {
    roomName: string;
    conflictingTaskTitle: string;
  };
  execConflict?: {
    execName: string;
    conflictingTaskTitle: string;
  };
}

interface AppContextType {
  currentUser: User | null;
  users: User[];
  executives: Executive[];
  rooms: MeetingRoom[];
  tasks: Task[];
  bookings: RoomBooking[];
  assignments: TaskAssignment[];
  notifications: NotificationItem[];
  logs: ActivityLog[];
  departments: Department[];
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setCurrentUserByRole: (role: UserRole) => Promise<void>;
  
  // Auth actions
  quickLogin: (role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  loadingAuth: boolean;
  
  // Task Actions
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'createdBy'>, booking?: Omit<RoomBooking, 'id' | 'taskId' | 'approvalStatus'>, attachments?: File[], assignmentsInput?: Omit<TaskAssignment, 'id' | 'taskId' | 'status'>[]) => Promise<{ success: boolean; error?: string }>;
  updateTask: (
    taskId: string,
    updatedTask: Partial<Task>,
    updatedBooking?: Partial<RoomBooking>,
    assignmentsInput?: Omit<TaskAssignment, 'id' | 'taskId' | 'status'>[],
    newAttachments?: File[],
    existingAttachments?: { fileName: string; fileUrl: string; fileSize: number }[]
  ) => Promise<{ success: boolean; error?: string }>;
  cancelTask: (taskId: string) => Promise<void>;
  
  // Assignment Actions
  updateAssignmentStatus: (assignmentId: string, status: TaskAssignment['status']) => Promise<void>;
  
  // Approval Actions
  approveBooking: (bookingId: string, comment: string) => Promise<void>;
  rejectBooking: (bookingId: string, comment: string) => Promise<void>;
  
  // Validation Actions
  checkScheduleConflict: (startTime: string, endTime: string, roomId?: string, execId?: string, excludeTaskId?: string) => ConflictDetails;
  getSmartRecommendations: (startTime: string, endTime: string, requiredCapacity: number, requiredAmenities: string[], requiredVip: boolean, execId: string) => {
    rooms: MeetingRoom[];
    times: { startTime: string; endTime: string; note: string }[];
  };

  // Room & Executive Admin Actions
  createRoom: (room: MeetingRoom) => Promise<void>;
  updateRoom: (roomId: string, updatedRoom: Partial<MeetingRoom>) => Promise<void>;
  deleteRoom: (roomId: string) => Promise<void>;
  createExecutive: (exec: Executive) => Promise<void>;
  updateExecutive: (execId: string, updatedExec: Partial<Executive>) => Promise<void>;
  deleteExecutive: (execId: string) => Promise<void>;
  createDepartment: (dept: Department) => Promise<void>;
  updateDepartment: (deptId: string, updatedDept: Partial<Department>) => Promise<void>;
  deleteDepartment: (deptId: string) => Promise<void>;

  // User Profile
  updateUserProfile: (updatedData: Partial<User>) => Promise<{ success: boolean; error?: string }>;

  // Admin User CRUD Actions
  adminCreateUser: (user: User) => Promise<void>;
  adminUpdateUser: (userId: string, updatedUserData: Partial<User>) => Promise<void>;
  adminDeleteUser: (userId: string) => Promise<void>;
  adminResetUserPassword: (email: string) => Promise<void>;

  // Helper filters
  canViewTaskDetail: (task: Task) => boolean;
  maskTaskTitle: (task: Task) => string;
  maskTaskDesc: (task: Task) => string;
  
  // Notifications
  markNotificationRead: (notifId: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Editing Task state
  editingTaskId: string | null;
  setEditingTaskId: (id: string | null) => void;

  // RBAC
  hasPermission: (permission: string) => boolean;

  // Executive Status
  execStatuses: ExecutiveStatusRecord[];
  createExecStatus: (record: Omit<ExecutiveStatusRecord, 'id' | 'recordedBy' | 'recordedAt'>) => Promise<void>;
  updateExecStatus: (id: string, record: Partial<ExecutiveStatusRecord>) => Promise<void>;
  deleteExecStatus: (id: string) => Promise<void>;
  getExecutiveStatus: (execId: string, dateStr: string) => ExecutiveStatusRecord;
  getActingAuthority: (execId: string, dateStr: string) => Executive | null;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'system' | 'email' | 'line' | 'telegram';
  status: 'unread' | 'read';
  createdAt: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// --- Pre-populated Mock Data for seeding ---

const MOCK_USERS: User[] = [
  { id: 'u-1', email: 'secretary@gov.go.th', name: 'มนัสวี นิลวรรณ', role: 'Secretary', phone: '081-234-5678', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces', department: 'กลุ่มงานอำนวยการ' },
  { id: 'u-2', email: 'governor@gov.go.th', name: 'ดร.สมชาย วิเศษศักดิ์', role: 'Executive', phone: '082-345-6789', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces', department: 'สำนักงานจังหวัด' },
  { id: 'u-3', email: 'it.support@gov.go.th', name: 'สมศักดิ์ รักษ์ดี', role: 'IT Support', phone: '083-456-7890', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces', department: 'กลุ่มงานข้อมูลและการสื่อสาร' },
  { id: 'u-4', email: 'housekeeper@gov.go.th', name: 'สมศรี ใจดี', role: 'Housekeeping', phone: '084-567-8901', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces', department: 'กลุ่มงานอำนวยการ' },
  { id: 'u-5', email: 'facility@gov.go.th', name: 'อนันต์ เรืองเกียรติ', role: 'Facility Officer', phone: '085-678-9012', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces', department: 'กลุ่มงานอำนวยการ' },
  { id: 'u-6', email: 'admin@gov.go.th', name: 'สุวัจน์ เจริญรัตน์', role: 'Admin', phone: '086-789-0123', avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces', department: 'สำนักงานจังหวัด' },
];

const initialDepartments: Department[] = [
  { id: 'dept-1', name: 'สำนักงานจังหวัด' },
  { id: 'dept-2', name: 'กลุ่มงานยุทธศาสตร์' },
  { id: 'dept-3', name: 'กลุ่มงานอำนวยการ' },
  { id: 'dept-4', name: 'กลุ่มงานทรัพยากรบุคคล' },
  { id: 'dept-5', name: 'กลุ่มงานข้อมูลและการสื่อสาร' }
];

const MOCK_EXECUTIVES: Executive[] = [
  { id: 'exec-1', name: 'ดร.สมชาย วิเศษศักดิ์', position: 'ผู้ว่าราชการจังหวัด', department: 'สำนักงานจังหวัด', colorCode: '#3b82f6', priority: 0, status: 'Active' },
  { id: 'exec-2', name: 'นายนครินทร์ สุขวิวัฒน์', position: 'รองผู้ว่าราชการจังหวัด (ฝ่ายความมั่นคง)', department: 'สำนักงานจังหวัด', colorCode: '#10b981', priority: 1, status: 'Active' },
  { id: 'exec-3', name: 'นางสาวพจนีย์ สุทธิชัย', position: 'รองผู้ว่าราชการจังหวัด (ฝ่ายเศรษฐกิจ)', department: 'สำนักงานจังหวัด', colorCode: '#f59e0b', priority: 2, status: 'Active' },
  { id: 'exec-4', name: 'นายเกียรติศักดิ์ พลภักดี', position: 'หัวหน้าสำนักงานจังหวัด', department: 'สำนักงานจังหวัด', colorCode: '#8b5cf6', priority: 3, status: 'Active' },
];

const MOCK_ROOMS: MeetingRoom[] = [
  { id: 'room-1', name: 'ห้องประชุมศรีวิชัย (VIP)', capacity: 15, building: 'อาคารอำนวยการ', floor: '3', amenities: ['Video Conference', 'Live Streaming', 'Coffee Break', 'Microphone', 'Smart Board'], isVip: true, status: 'Available' },
  { id: 'room-2', name: 'ห้องประชุมราชพฤกษ์', capacity: 50, building: 'อาคารบริการ', floor: '1', amenities: ['Projector', 'Microphone', 'Coffee Break', 'Lunch', 'Sound System'], isVip: false, status: 'Available' },
  { id: 'room-3', name: 'ห้องประชุมสุพรรณิการ์', capacity: 25, building: 'อาคารอำนวยการ', floor: '2', amenities: ['Projector', 'Microphone', 'Coffee Break'], isVip: false, status: 'Available' },
  { id: 'room-4', name: 'ห้องประชุมบอร์ดบริหาร (VIP)', capacity: 10, building: 'อาคารอำนวยการ', floor: '4', amenities: ['Video Conference', 'Microphone', 'Coffee Break', 'Mini Bar'], isVip: true, status: 'Available' },
  { id: 'room-5', name: 'ห้องประชุมนานาชาติ', capacity: 120, building: 'หอประชุมใหญ่', floor: '1', amenities: ['Projector', 'Video Conference', 'Microphone', 'Live Streaming', 'Sound System', 'VIP Lounge'], isVip: true, status: 'Available' },
];

const baseDate = new Date().toISOString().slice(0, 10);
const nextDay = (() => {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
})();

const initialTasks: Task[] = [
  {
    id: 'task-1',
    title: 'ประชุมคณะกรรมการจัดทำแผนยุทธศาสตร์จังหวัด',
    description: 'พิจารณาข้อเสนอโครงการเพื่อบรรจุในแผนพัฒนาจังหวัดประจำปีงบประมาณ 2570 และทบทวนความก้าวหน้าโครงการปี 2569',
    startTime: `${baseDate}T09:00:00`,
    endTime: `${baseDate}T12:00:00`,
    executiveId: 'exec-1',
    confidentialityLevel: 'Internal',
    priority: 'ด่วนมาก',
    attendees: ['governor@gov.go.th', 'deputy1@gov.go.th', 'chief.provincial@gov.go.th'],
    createdBy: 'u-1',
    status: 'Scheduled',
    createdAt: `${baseDate}T08:00:00`
  },
  {
    id: 'task-2',
    title: 'หารือความร่วมมือการลงทุน Smart City กับผู้แทนต่างประเทศ',
    description: 'ต้อนรับคณะทูตพาณิชย์และตัวแทนนักลงทุนต่างประเทศในการเสนอโครงการระบบบริหารการจราจรอัจฉริยะ',
    startTime: `${baseDate}T13:30:00`,
    endTime: `${baseDate}T15:30:00`,
    executiveId: 'exec-1',
    confidentialityLevel: 'Confidential',
    priority: 'ด่วน',
    attendees: ['governor@gov.go.th', 'deputy2@gov.go.th', 'foreigndev@city.co.th'],
    createdBy: 'u-1',
    status: 'Scheduled',
    createdAt: `${baseDate}T08:10:00`
  },
  {
    id: 'task-3',
    title: 'ประชุมลับ: ทบทวนมาตรการรักษาความปลอดภัยในจังหวัด',
    description: 'รายงานสถานการณ์ความมั่นคงทางพื้นที่ชายแดนและแผนบูรณาการกำลังความสงบเรียบร้อย',
    startTime: `${baseDate}T10:00:00`,
    endTime: `${baseDate}T11:30:00`,
    executiveId: 'exec-2',
    confidentialityLevel: 'Secret',
    priority: 'ภารกิจลับ',
    attendees: ['deputy1@gov.go.th', 'police.commander@police.go.th', 'army.chief@army.go.th'],
    createdBy: 'u-1',
    status: 'Scheduled',
    createdAt: `${baseDate}T08:15:00`
  },
  {
    id: 'task-4',
    title: 'ต้อนรับคณะผู้ตรวจราชการกระทรวงมหาดไทย',
    description: 'รายงานผลการปฏิบัติงานของจังหวัดในไตรมาสที่ 3 และประเด็นการดำเนินโครงการพระราชดำริ',
    startTime: `${nextDay}T09:30:00`,
    endTime: `${nextDay}T12:00:00`,
    executiveId: 'exec-1',
    confidentialityLevel: 'Public',
    priority: 'ด่วนมาก',
    attendees: ['governor@gov.go.th', 'deputy1@gov.go.th', 'deputy2@gov.go.th', 'inspector@moi.go.th'],
    createdBy: 'u-1',
    status: 'Scheduled',
    createdAt: `${baseDate}T08:20:00`
  }
];

const initialBookings: RoomBooking[] = [
  {
    id: 'book-1',
    taskId: 'task-1',
    roomId: 'room-1',
    startTime: `${baseDate}T09:00:00`,
    endTime: `${baseDate}T12:00:00`,
    approvalStatus: 'Approved',
    requestedAmenities: ['Video Conference', 'Coffee Break', 'Microphone'],
    layoutStyle: 'U-Shape',
    approvedBy: 'u-6'
  },
  {
    id: 'book-2',
    taskId: 'task-2',
    roomId: 'room-4',
    startTime: `${baseDate}T13:30:00`,
    endTime: `${baseDate}T15:30:00`,
    approvalStatus: 'Approved',
    requestedAmenities: ['Video Conference', 'Microphone', 'Coffee Break', 'Mini Bar'],
    layoutStyle: 'Standard',
    approvedBy: 'u-6'
  },
  {
    id: 'book-3',
    taskId: 'task-3',
    roomId: 'room-3',
    startTime: `${baseDate}T10:00:00`,
    endTime: `${baseDate}T11:30:00`,
    approvalStatus: 'Approved',
    requestedAmenities: ['Coffee Break'],
    layoutStyle: 'Theater',
    approvedBy: 'u-1'
  },
  {
    id: 'book-4',
    taskId: 'task-4',
    roomId: 'room-2',
    startTime: `${nextDay}T09:30:00`,
    endTime: `${nextDay}T12:00:00`,
    approvalStatus: 'Pending',
    requestedAmenities: ['Projector', 'Microphone', 'Coffee Break', 'Lunch'],
    layoutStyle: 'U-Shape'
  }
];

const initialAssignments: TaskAssignment[] = [
  { id: 'as-1', taskId: 'task-1', title: 'เตรียมห้องประชุม จัดรูป U-shape และเอกสารรายงาน', assignedToRole: 'Housekeeping', status: 'Completed', dueDate: `${baseDate}T08:30:00` },
  { id: 'as-2', taskId: 'task-1', title: 'ทดสอบเชื่อมต่อระบบ Zoom กับ สนง. อำเภอทั้ง 7 แห่ง', assignedToRole: 'IT Support', status: 'Completed', dueDate: `${baseDate}T08:45:00` },
  { id: 'as-3', taskId: 'task-1', title: 'จัดเตรียมของว่างและกาแฟสำหรับคณะประชุม (15 ท่าน)', assignedToRole: 'Housekeeping', status: 'Completed', dueDate: `${baseDate}T09:30:00` },
  { id: 'as-4', taskId: 'task-2', title: 'เปิดระบบล่ามแปลภาษาและอุปกรณ์ Smart Board', assignedToRole: 'IT Support', status: 'Pending', dueDate: `${baseDate}T13:15:00` },
  { id: 'as-5', taskId: 'task-2', title: 'เตรียมของว่างพรีเมียมและผลไม้ต้อนรับทูตการค้า', assignedToRole: 'Housekeeping', status: 'In_Progress', dueDate: `${baseDate}T13:45:00` },
  { id: 'as-6', taskId: 'task-3', title: 'จัดระเบียบรักษาความปลอดภัยห้ามบุคคลภายนอกเข้าชั้น 2', assignedToRole: 'Facility Officer', status: 'Completed', dueDate: `${baseDate}T09:45:00` }
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [bookings, setBookings] = useState<RoomBooking[]>([]);
  const [assignments, setAssignments] = useState<TaskAssignment[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>(MOCK_ROOMS);
  const [executives, setExecutives] = useState<Executive[]>(MOCK_EXECUTIVES);
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [execStatuses, setExecStatuses] = useState<ExecutiveStatusRecord[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  // Sync dark class on body
  useEffect(() => {
    const root = window.document.documentElement;
    const body = window.document.body;
    if (theme === 'dark') {
      root.classList.add('dark');
      body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      body.classList.remove('dark');
    }
  }, [theme]);

  // Seeding initial mock data if database is empty or date changes
  useEffect(() => {
    const seedDatabase = async () => {
      try {
        const flagRef = doc(db, 'system', 'initialized');
        const flagSnap = await getDoc(flagRef);
        
        let needsSeeding = !flagSnap.exists();
        if (flagSnap.exists()) {
          const data = flagSnap.data();
          if (data && data.seededDate !== baseDate) {
            needsSeeding = true;
            console.log('Detecting date change (re-seeding mock data relative to today)...');
          }
        }

        if (!needsSeeding) return;

        console.log('Seeding initial mock data to Cloud Firestore...');
        const batch = writeBatch(db);

        // Seed Rooms
        MOCK_ROOMS.forEach(room => {
          batch.set(doc(db, 'rooms', room.id), room);
        });

        // Seed Executives
        MOCK_EXECUTIVES.forEach(exec => {
          batch.set(doc(db, 'executives', exec.id), exec);
        });

        // Seed Tasks
        initialTasks.forEach(task => {
          batch.set(doc(db, 'tasks', task.id), task);
        });

        // Seed Bookings
        initialBookings.forEach(booking => {
          batch.set(doc(db, 'bookings', booking.id), booking);
        });

        // Seed Assignments
        initialAssignments.forEach(ass => {
          batch.set(doc(db, 'assignments', ass.id), ass);
        });

        // Seed Default Users
        MOCK_USERS.forEach(u => {
          batch.set(doc(db, 'users', u.id), u);
        });

        // Seed Departments
        initialDepartments.forEach(dept => {
          batch.set(doc(db, 'departments', dept.id), dept);
        });

        // Write setup completed flag with current baseDate
        batch.set(flagRef, { 
          initializedAt: new Date().toISOString(),
          seededDate: baseDate
        });

        await batch.commit();
        console.log('Database seeded successfully!');
      } catch (err) {
        console.warn('Auto-seeding mock database skipped or failed:', err);
      }
    };

    seedDatabase();
  }, []);

  // Listen to Auth State changes & real-time User Profile sync
  useEffect(() => {
    let unsubscribeUserProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUserProfile) {
        unsubscribeUserProfile();
        unsubscribeUserProfile = null;
      }

      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        try {
          const docSnap = await getDoc(userDocRef);
          if (!docSnap.exists()) {
            // Document doesn't exist, check for pre-created user by email in Firestore
            let existingUserData: Partial<User> | null = null;
            let existingUserDocId: string | null = null;
            
            const usersRef = collection(db, 'users');
            const q = query(usersRef, where('email', '==', firebaseUser.email));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              const matchDoc = querySnapshot.docs[0];
              existingUserData = matchDoc.data() as User;
              existingUserDocId = matchDoc.id;
            }
            
            const matchedMockUser = MOCK_USERS.find(u => u.email.toLowerCase() === firebaseUser.email?.toLowerCase());
            
            const defaultUser: User = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              name: firebaseUser.displayName || existingUserData?.name || matchedMockUser?.name || 'ผู้ใช้งานใหม่',
              role: (existingUserData?.role || matchedMockUser?.role || 'General User') as UserRole,
              phone: existingUserData?.phone || matchedMockUser?.phone || '',
              avatarUrl: firebaseUser.photoURL || existingUserData?.avatarUrl || matchedMockUser?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces',
              status: (existingUserData?.status || 'Active') as 'Active' | 'Suspended',
              lastLoginAt: new Date().toISOString()
            };
            
            await setDoc(userDocRef, defaultUser);
            
            if (existingUserDocId && existingUserDocId !== firebaseUser.uid) {
              await deleteDoc(doc(db, 'users', existingUserDocId));
            }
          } else {
            // Update last login timestamp in Firestore
            await updateDoc(userDocRef, {
              lastLoginAt: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Error migrating/initializing user doc:", err);
        }
        
        // Listen to the user document in real-time
        unsubscribeUserProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userData = docSnap.data() as User;
            if (userData.status === 'Suspended') {
              signOut(auth);
              setCurrentUser(null);
              Swal.fire({
                title: 'บัญชีถูกระงับการใช้งาน',
                text: 'บัญชีสิทธิ์การใช้งานของคุณถูกระงับชั่วคราว กรุณาติดต่อผู้ดูแลระบบเพื่อขอเปิดใช้งาน',
                icon: 'error',
                confirmButtonText: 'รับทราบ',
                confirmButtonColor: '#e11d48'
              });
              return;
            }
            setCurrentUser(userData);
          }
        }, (err) => console.error("Firestore user doc sync error:", err));

      } else {
        setCurrentUser(null);
      }
      setLoadingAuth(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserProfile) {
        unsubscribeUserProfile();
      }
    };
  }, []);

  // Sync real-time data from Firestore when currentUser is active
  useEffect(() => {
    if (!currentUser) {
      setTasks([]);
      setBookings([]);
      setAssignments([]);
      setNotifications([]);
      setLogs([]);
      setDepartments([]);
      return;
    }

    const unsubscribeTasks = onSnapshot(collection(db, 'tasks'), (snapshot) => {
      const list: Task[] = [];
      snapshot.forEach(d => list.push(d.data() as Task));
      setTasks(list);
    }, (err) => console.error("Firestore tasks sync error:", err));

    const unsubscribeBookings = onSnapshot(collection(db, 'bookings'), (snapshot) => {
      const list: RoomBooking[] = [];
      snapshot.forEach(d => list.push(d.data() as RoomBooking));
      setBookings(list);
    }, (err) => console.error("Firestore bookings sync error:", err));

    const unsubscribeAssignments = onSnapshot(collection(db, 'assignments'), (snapshot) => {
      const list: TaskAssignment[] = [];
      snapshot.forEach(d => list.push(d.data() as TaskAssignment));
      setAssignments(list);
    }, (err) => console.error("Firestore assignments sync error:", err));

    const qNotifications = query(collection(db, 'notifications'), where('userId', '==', currentUser.id));
    const unsubscribeNotifications = onSnapshot(qNotifications, (snapshot) => {
      const list: NotificationItem[] = [];
      snapshot.forEach(d => list.push(d.data() as NotificationItem));
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(list);
    }, (err) => console.error("Firestore notifications sync error:", err));

    const unsubscribeLogs = onSnapshot(collection(db, 'logs'), (snapshot) => {
      const list: ActivityLog[] = [];
      snapshot.forEach(d => list.push(d.data() as ActivityLog));
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setLogs(list);
    }, (err) => console.error("Firestore logs sync error:", err));

    const unsubscribeRooms = onSnapshot(collection(db, 'rooms'), (snapshot) => {
      const list: MeetingRoom[] = [];
      snapshot.forEach(d => list.push(d.data() as MeetingRoom));
      setRooms(list);
    }, (err) => console.error("Firestore rooms sync error:", err));

    const unsubscribeExecutives = onSnapshot(collection(db, 'executives'), (snapshot) => {
      const list: Executive[] = [];
      snapshot.forEach(d => {
        const data = d.data() as Executive;
        list.push(data);
        const mockMatch = MOCK_EXECUTIVES.find(m => m.id === data.id);
        if (mockMatch && (data.priority === undefined || data.status === undefined)) {
          updateDoc(doc(db, 'executives', data.id), {
            priority: mockMatch.priority,
            status: data.status || 'Active'
          }).catch(err => console.warn(`Failed self-healing executive migration for ${data.id}:`, err));
        }
      });
      setExecutives(list);
    }, (err) => console.error("Firestore executives sync error:", err));

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: User[] = [];
      snapshot.forEach(d => list.push(d.data() as User));
      setUsers(list);
    }, (err) => console.error("Firestore users sync error:", err));

    const unsubscribeDepartments = onSnapshot(collection(db, 'departments'), (snapshot) => {
      const list: Department[] = [];
      snapshot.forEach(d => list.push(d.data() as Department));
      setDepartments(list);
    }, (err) => console.error("Firestore departments sync error:", err));

    const unsubscribeExecStatuses = onSnapshot(collection(db, 'exec_statuses'), (snapshot) => {
      const list: ExecutiveStatusRecord[] = [];
      snapshot.forEach(d => list.push(d.data() as ExecutiveStatusRecord));
      list.sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
      setExecStatuses(list);
    }, (err) => console.error("Firestore exec_statuses sync error:", err));

    return () => {
      unsubscribeTasks();
      unsubscribeBookings();
      unsubscribeAssignments();
      unsubscribeNotifications();
      unsubscribeLogs();
      unsubscribeRooms();
      unsubscribeExecutives();
      unsubscribeUsers();
      unsubscribeDepartments();
      unsubscribeExecStatuses();
    };
  }, [currentUser]);

  // Sync FCM Push Token
  useEffect(() => {
    if (!currentUser) return;
    
    const setupNotifications = async () => {
      try {
        const messaging = await getFirebaseMessaging();
        if (!messaging) return;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          const token = await getToken(messaging, {
            vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY
          });
          if (token) {
            console.log('FCM Token generated successfully:', token);
            await updateDoc(doc(db, 'users', currentUser.id), { fcmToken: token });
          }
        }
      } catch (err) {
        console.warn('Error setting up Web Push Notifications:', err);
      }
    };

    setupNotifications();
  }, [currentUser]);

  // Predefined Quick Logins helper
  const quickLogin = async (role: UserRole) => {
    const emailMap: Record<UserRole, string> = {
      'Secretary': 'secretary@gov.go.th',
      'Executive': 'governor@gov.go.th',
      'IT Support': 'it.support@gov.go.th',
      'Housekeeping': 'housekeeper@gov.go.th',
      'Facility Officer': 'facility@gov.go.th',
      'Admin': 'admin@gov.go.th',
      'Super Admin': 'admin@gov.go.th',
      'General User': 'general@gov.go.th'
    };
    const email = emailMap[role] || 'general@gov.go.th';
    try {
      await signInWithEmailAndPassword(auth, email, 'password123');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        // Auto register test account in Firebase Auth + Firestore
        try {
          const res = await createUserWithEmailAndPassword(auth, email, 'password123');
          const defaultNames: Record<UserRole, string> = {
            'Secretary': 'มนัสวี นิลวรรณ',
            'Executive': 'ดร.สมชาย วิเศษศักดิ์',
            'IT Support': 'สมศักดิ์ รักษ์ดี',
            'Housekeeping': 'สมศรี ใจดี',
            'Facility Officer': 'อนันต์ เรืองเกียรติ',
            'Admin': 'สุวัจน์ เจริญรัตน์',
            'Super Admin': 'สุวัจน์ เจริญรัตน์ (Super Admin)',
            'General User': 'สมชาย ทั่วไป'
          };
          const defaultAvatars: Record<UserRole, string> = {
            'Secretary': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=faces',
            'Executive': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces',
            'IT Support': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=faces',
            'Housekeeping': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&h=100&fit=crop&crop=faces',
            'Facility Officer': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=faces',
            'Admin': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces',
            'Super Admin': 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=100&h=100&fit=crop&crop=faces',
            'General User': 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop&crop=faces'
          };
          
          await setDoc(doc(db, 'users', res.user.uid), {
            id: res.user.uid,
            email: email,
            name: defaultNames[role],
            role: role,
            phone: '081-234-5678',
            avatarUrl: defaultAvatars[role]
          });
        } catch (regErr) {
          console.error("Auto register of quick login failed:", regErr);
        }
      } else {
        console.error("Quick login failed:", err);
      }
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("SignOut failed:", err);
    }
  };

  const toggleTheme = () => setTheme(prev => (prev === 'light' ? 'dark' : 'light'));

  const setCurrentUserByRole = async (role: UserRole) => {
    if (!currentUser) return;
    try {
      const userRef = doc(db, 'users', currentUser.id);
      await updateDoc(userRef, { role });
      
      // Log switch in Firestore
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'SWITCH_ROLE',
        targetType: 'user',
        targetId: currentUser.id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `เปลี่ยนสิทธิ์การใช้งานเป็น: ${role}`
      });
      
      Swal.fire({
        title: 'เปลี่ยนสิทธิ์สำเร็จ',
        html: `ขณะนี้คุณใช้งานในฐานะ: <b>${role}</b> (${currentUser.name})`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      console.error("Switch role in Firestore failed:", err);
    }
  };

  // --- Real-Time Conflict Detection ---

  const checkScheduleConflict = (
    startTime: string,
    endTime: string,
    roomId?: string,
    execId?: string,
    excludeTaskId?: string
  ): ConflictDetails => {
    const start = new Date(startTime);
    const end = new Date(endTime);

    // 1. Check Executive Overlap
    if (execId) {
      const execConflictingTask = tasks.find(t => {
        if (t.id === excludeTaskId || t.status === 'Cancelled') return false;
        if (t.executiveId !== execId) return false;
        const tStart = new Date(t.startTime);
        const tEnd = new Date(t.endTime);
        return start < tEnd && end > tStart;
      });

      if (execConflictingTask) {
        const exec = executives.find(e => e.id === execId);
        return {
          hasConflict: true,
          execConflict: {
            execName: exec?.name || 'ผู้บริหาร',
            conflictingTaskTitle: execConflictingTask.title
          }
        };
      }
    }

    // 2. Check Room Overlap
    if (roomId) {
      const roomConflictingBooking = bookings.find(b => {
        if (b.taskId === excludeTaskId || b.approvalStatus === 'Rejected') return false;
        if (b.roomId !== roomId) return false;
        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        
        // Find corresponding task to check status
        const associatedTask = tasks.find(t => t.id === b.taskId);
        if (associatedTask?.status === 'Cancelled') return false;
        
        return start < bEnd && end > bStart;
      });

      if (roomConflictingBooking) {
        const room = rooms.find(r => r.id === roomId);
        const t = tasks.find(t => t.id === roomConflictingBooking.taskId);
        return {
          hasConflict: true,
          roomConflict: {
            roomName: room?.name || 'ห้องประชุม',
            conflictingTaskTitle: t?.title || 'การจองห้องอื่น'
          }
        };
      }
    }

    return { hasConflict: false };
  };

  // --- Smart Recommendation Algorithms ---

  const getSmartRecommendations = (
    startTime: string,
    endTime: string,
    requiredCapacity: number,
    requiredAmenities: string[],
    requiredVip: boolean,
    execId: string
  ) => {
    // Suggest Rooms that are free at this exact time
    const start = new Date(startTime);
    const end = new Date(endTime);

    const availableRooms = rooms.filter(room => {
      if (room.status !== 'Available') return false;
      if (room.capacity < requiredCapacity) return false;
      if (requiredVip && !room.isVip) return false;
      
      const hasAllAmenities = requiredAmenities.every(a => room.amenities.includes(a));
      if (!hasAllAmenities) return false;

      // Check if it's booked during this duration
      const isBooked = bookings.some(b => {
        if (b.roomId !== room.id || b.approvalStatus === 'Rejected') return false;
        const assocTask = tasks.find(t => t.id === b.taskId);
        if (assocTask?.status === 'Cancelled') return false;

        const bStart = new Date(b.startTime);
        const bEnd = new Date(b.endTime);
        return start < bEnd && end > bStart;
      });

      return !isBooked;
    });

    // Suggest alternative times for this executive + preferred room setup
    const timeSuggestions: { startTime: string; endTime: string; note: string }[] = [];
    const offsets = [
      { hours: 1, note: 'เลื่อนเวลาเร็วขึ้น 1 ชั่วโมง' },
      { hours: 2, note: 'เลื่อนเวลาช้าลง 2 ชั่วโมง' },
      { hours: 24, note: 'วันถัดไปในเวลาเดียวกัน' }
    ];

    offsets.forEach(offset => {
      const testStart = new Date(start);
      const testEnd = new Date(end);
      if (offset.hours === 24) {
        testStart.setDate(testStart.getDate() + 1);
        testEnd.setDate(testEnd.getDate() + 1);
      } else if (offset.hours === 1) {
        testStart.setHours(testStart.getHours() - 1);
        testEnd.setHours(testEnd.getHours() - 1);
      } else {
        testStart.setHours(testStart.getHours() + offset.hours);
        testEnd.setHours(testEnd.getHours() + offset.hours);
      }

      const isoStart = testStart.toISOString().slice(0, 16);
      const isoEnd = testEnd.toISOString().slice(0, 16);

      // Verify executive is free
      const hasExecConflict = tasks.some(t => {
        if (t.status === 'Cancelled' || t.executiveId !== execId) return false;
        const tStart = new Date(t.startTime);
        const tEnd = new Date(t.endTime);
        return testStart < tEnd && testEnd > tStart;
      });

      if (!hasExecConflict) {
        timeSuggestions.push({
          startTime: isoStart,
          endTime: isoEnd,
          note: `${offset.note} (${testStart.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} - ${testEnd.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })})`
        });
      }
    });

    return {
      rooms: availableRooms,
      times: timeSuggestions.slice(0, 3)
    };
  };

  // --- Task Operations ---

  const createTask = async (
    taskInput: Omit<Task, 'id' | 'createdAt' | 'createdBy'>,
    bookingInput?: Omit<RoomBooking, 'id' | 'taskId' | 'approvalStatus'>,
    attachmentsInput?: File[],
    assignmentsInput?: Omit<TaskAssignment, 'id' | 'taskId' | 'status'>[]
  ) => {
    // 0. Authorization Check
    if (!currentUser || !hasPermission(currentUser.role, 'task:create')) {
      return { success: false, error: 'สิทธิ์ของคุณไม่อนุญาตให้สร้างภารกิจ กรุณาติดต่อผู้ดูแลระบบ' };
    }

    // 1. Conflict Check
    const conflict = checkScheduleConflict(
      taskInput.startTime,
      taskInput.endTime,
      bookingInput?.roomId,
      taskInput.executiveId
    );

    if (conflict.hasConflict) {
      let errorMsg = 'พบความขัดแย้งของเวลา: ';
      if (conflict.execConflict) {
        errorMsg += `ผู้บริหาร ${conflict.execConflict.execName} ติดภารกิจซ้อน "${conflict.execConflict.conflictingTaskTitle}"`;
      } else if (conflict.roomConflict) {
        errorMsg += `ห้องประชุม ${conflict.roomConflict.roomName} ถูกจองแล้วสำหรับงาน "${conflict.roomConflict.conflictingTaskTitle}"`;
      }
      return { success: false, error: errorMsg };
    }

    const taskId = `task-${Date.now()}`;

    // Real Firebase Storage Uploads
    const attachments: { fileName: string, fileUrl: string, fileSize: number }[] = [];
    if (attachmentsInput && attachmentsInput.length > 0) {
      try {
        for (const file of attachmentsInput) {
          const fileRef = ref(storage, `tasks/${taskId}/${file.name}`);
          const uploadResult = await uploadBytes(fileRef, file);
          const url = await getDownloadURL(uploadResult.ref);
          attachments.push({
            fileName: file.name,
            fileUrl: url,
            fileSize: file.size
          });
        }
      } catch (err: any) {
        return { success: false, error: `อัปโหลดไฟล์ล้มเหลว: ${err.message}` };
      }
    }

    const newTask: Task = {
      ...taskInput,
      id: taskId,
      createdAt: new Date().toISOString().slice(0, 19),
      createdBy: currentUser.id,
      status: 'Scheduled',
      attachments
    };

    let roomApprovalPending = false;
    let targetRoomName = '';
    let newBooking: RoomBooking | null = null;

    if (bookingInput && bookingInput.roomId) {
      const room = rooms.find(r => r.id === bookingInput.roomId);
      roomApprovalPending = room?.isVip || false;
      targetRoomName = room?.name || '';

      newBooking = {
        ...bookingInput,
        id: `book-${Date.now()}`,
        taskId: taskId,
        approvalStatus: roomApprovalPending ? 'Pending' : 'Approved',
        approvedBy: roomApprovalPending ? undefined : currentUser.id
      };
    }

    // Write all to Firestore using an atomic batch
    const batch = writeBatch(db);
    
    // Set Task
    batch.set(doc(db, 'tasks', taskId), newTask);
    
    // Set Booking
    if (newBooking) {
      batch.set(doc(db, 'bookings', newBooking.id), newBooking);
    }

    // Generate sub-tasks (Assignments)
    if (assignmentsInput && assignmentsInput.length > 0) {
      assignmentsInput.forEach((ass, i) => {
        const id = `as-${Date.now()}-${i}`;
        batch.set(doc(db, 'assignments', id), {
          id,
          taskId,
          title: ass.title,
          assignedToRole: ass.assignedToRole,
          status: 'Pending',
          dueDate: ass.dueDate
        });
      });
    } else if (bookingInput) {
      let index = 0;
      if (bookingInput.requestedAmenities.includes('Video Conference') || bookingInput.requestedAmenities.includes('Live Streaming')) {
        const id = `as-auto-${Date.now()}-${index++}`;
        batch.set(doc(db, 'assignments', id), {
          id,
          taskId,
          title: `ตรวจสอบและเปิดระบบกล้อง/ห้องประชุมออนไลน์ Zoom/Live Stream ณ ${targetRoomName}`,
          assignedToRole: 'IT Support',
          status: 'Pending',
          dueDate: taskInput.startTime
        });
      }
      if (bookingInput.requestedAmenities.includes('Coffee Break') || bookingInput.requestedAmenities.includes('Lunch')) {
        const id = `as-auto-${Date.now()}-${index++}`;
        batch.set(doc(db, 'assignments', id), {
          id,
          taskId,
          title: `เตรียมของว่างและน้ำดื่มจัดเสิร์ฟห้องประชุม ${targetRoomName}`,
          assignedToRole: 'Housekeeping',
          status: 'Pending',
          dueDate: taskInput.startTime
        });
      }
    }

    // Dispatch Notifications
    const exec = executives.find(e => e.id === taskInput.executiveId);
    const execUser = MOCK_USERS.find(u => u.name === exec?.name);
    if (execUser) {
      const id = `n-${Date.now()}-exec`;
      batch.set(doc(db, 'notifications', id), {
        id,
        userId: execUser.id,
        title: 'มีภารกิจใหม่ลงตารางงาน',
        message: `คุณมีภารกิจ: ${taskInput.title} ในวันที่ ${new Date(taskInput.startTime).toLocaleDateString('th-TH')}`,
        type: 'system',
        status: 'unread',
        createdAt: new Date().toISOString()
      });
    }

    if (roomApprovalPending) {
      const admins = MOCK_USERS.filter(u => u.role === 'Admin' || u.role === 'Super Admin');
      admins.forEach(admin => {
        const id = `n-${Date.now()}-adm-${admin.id}`;
        batch.set(doc(db, 'notifications', id), {
          id,
          userId: admin.id,
          title: 'คำขอจองห้อง VIP ใหม่',
          message: `คำขอจองห้อง "${targetRoomName}" สำหรับงาน "${taskInput.title}" รอการอนุมัติ`,
          type: 'telegram',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      });
    }

    // Log Activity
    const logId = `l-${Date.now()}`;
    batch.set(doc(db, 'logs', logId), {
      id: logId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'CREATE_TASK',
      targetType: 'task',
      targetId: taskId,
      timestamp: new Date().toISOString().slice(0, 19),
      details: `สร้างภารกิจ: "${taskInput.title}" จองห้อง: "${targetRoomName || 'ไม่ใช่ห้องประชุม'}"`
    });

    try {
      await batch.commit();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `ไม่สามารถบันทึกภารกิจลง Firestore: ${err.message}` };
    }
  };

  const updateTask = async (
    taskId: string,
    updatedTask: Partial<Task>,
    updatedBooking?: Partial<RoomBooking>,
    assignmentsInput?: Omit<TaskAssignment, 'id' | 'taskId' | 'status'>[],
    newAttachments?: File[],
    existingAttachments?: { fileName: string; fileUrl: string; fileSize: number }[]
  ) => {
    const currentTask = tasks.find(t => t.id === taskId);
    if (!currentTask) return { success: false, error: 'ไม่พบภารกิจที่ต้องการแก้ไข' };

    if (!currentUser || !canEditTask(currentUser.role, currentTask.createdBy, currentUser.id)) {
      return { success: false, error: 'คุณไม่มีสิทธิ์แก้ไขภารกิจนี้ เฉพาะผู้สร้างหรือผู้ดูแลระบบเท่านั้น' };
    }

    const checkStart = updatedTask.startTime || currentTask.startTime;
    const checkEnd = updatedTask.endTime || currentTask.endTime;
    const currentBooking = bookings.find(b => b.taskId === taskId);
    const checkRoom = updatedBooking?.roomId !== undefined ? updatedBooking.roomId : currentBooking?.roomId;
    const checkExec = updatedTask.executiveId || currentTask.executiveId;

    const conflict = checkScheduleConflict(checkStart, checkEnd, checkRoom, checkExec, taskId);
    if (conflict.hasConflict) {
      let errorMsg = 'พบการทับซ้อนของช่วงเวลา: ';
      if (conflict.execConflict) {
        errorMsg += `ผู้บริหาร ${conflict.execConflict.execName} มีคิวชนกับ "${conflict.execConflict.conflictingTaskTitle}"`;
      } else if (conflict.roomConflict) {
        errorMsg += `ห้องประชุม ${conflict.roomConflict.roomName} ถูกจองแล้วสำหรับ "${conflict.roomConflict.conflictingTaskTitle}"`;
      }
      return { success: false, error: errorMsg };
    }

    // Real Firebase Storage Uploads for new attachments
    const uploadedAttachments: { fileName: string, fileUrl: string, fileSize: number }[] = [];
    if (newAttachments && newAttachments.length > 0) {
      try {
        for (const file of newAttachments) {
          const fileRef = ref(storage, `tasks/${taskId}/${file.name}`);
          const uploadResult = await uploadBytes(fileRef, file);
          const url = await getDownloadURL(uploadResult.ref);
          uploadedAttachments.push({
            fileName: file.name,
            fileUrl: url,
            fileSize: file.size
          });
        }
      } catch (err: any) {
        return { success: false, error: `อัปโหลดไฟล์ล้มเหลว: ${err.message}` };
      }
    }

    // Combine existing attachments with newly uploaded ones
    const finalAttachments = [
      ...(existingAttachments || currentTask.attachments || []),
      ...uploadedAttachments
    ];

    const taskToUpdate = {
      ...updatedTask,
      attachments: finalAttachments
    };

    const batch = writeBatch(db);
    
    // Update Task
    batch.update(doc(db, 'tasks', taskId), taskToUpdate);

    // Update Room Booking
    let isVipRoomSelected = false;
    let targetRoomName = '';

    if (updatedBooking) {
      const room = rooms.find(r => r.id === updatedBooking.roomId);
      isVipRoomSelected = room?.isVip || false;
      targetRoomName = room?.name || '';

      if (currentBooking) {
        const hasRoomChanged = updatedBooking.roomId && updatedBooking.roomId !== currentBooking.roomId;
        batch.update(doc(db, 'bookings', currentBooking.id), {
          ...updatedBooking,
          approvalStatus: hasRoomChanged ? (isVipRoomSelected ? 'Pending' : 'Approved') : currentBooking.approvalStatus
        });
      } else if (updatedBooking.roomId) {
        const newBookingId = `book-${Date.now()}`;
        batch.set(doc(db, 'bookings', newBookingId), {
          id: newBookingId,
          taskId: taskId,
          roomId: updatedBooking.roomId,
          startTime: checkStart,
          endTime: checkEnd,
          approvalStatus: isVipRoomSelected ? 'Pending' : 'Approved',
          requestedAmenities: updatedBooking.requestedAmenities || [],
          layoutStyle: updatedBooking.layoutStyle || 'Standard'
        });
      }
    }

    // Update Assignments
    if (assignmentsInput) {
      const affectedAssignments = assignments.filter(a => a.taskId === taskId);
      affectedAssignments.forEach(a => {
        batch.delete(doc(db, 'assignments', a.id));
      });

      assignmentsInput.forEach((ass, i) => {
        const id = `as-${Date.now()}-${i}`;
        batch.set(doc(db, 'assignments', id), {
          id,
          taskId: taskId,
          title: ass.title,
          assignedToRole: ass.assignedToRole,
          status: 'Pending',
          dueDate: ass.dueDate
        });
      });
    }

    // Notify assignees about schedule updates
    const affectedAssignments = assignments.filter(a => a.taskId === taskId);
    affectedAssignments.forEach((ass, idx) => {
      const usersOfRole = MOCK_USERS.filter(u => u.role === ass.assignedToRole);
      usersOfRole.forEach(u => {
        const id = `n-upd-${Date.now()}-${idx}-${u.id}`;
        batch.set(doc(db, 'notifications', id), {
          id,
          userId: u.id,
          title: 'อัปเดตกำหนดการภารกิจที่รับผิดชอบ',
          message: `ภารกิจ "${currentTask.title}" มีการเปลี่ยนตารางเวลา กรุณาตรวจสอบแผนการเตรียมงาน`,
          type: 'email',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      });
    });

    // Log Activity
    const logId = `l-${Date.now()}`;
    batch.set(doc(db, 'logs', logId), {
      id: logId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'UPDATE_TASK',
      targetType: 'task',
      targetId: taskId,
      timestamp: new Date().toISOString().slice(0, 19),
      details: `แก้ไขภารกิจ: "${currentTask.title}"`
    });

    try {
      await batch.commit();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `ไม่สามารถปรับปรุงข้อมูลบน Firestore: ${err.message}` };
    }
  };

  const cancelTask = async (taskId: string) => {
    const taskToCancel = tasks.find(t => t.id === taskId);
    if (!currentUser || (taskToCancel && !canCancelTask(currentUser.role, taskToCancel.createdBy, currentUser.id))) {
      Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ยกเลิกภารกิจนี้ เฉพาะผู้สร้างหรือผู้ดูแลระบบเท่านั้น', 'error');
      return;
    }

    const batch = writeBatch(db);
    
    // Cancel Task
    batch.update(doc(db, 'tasks', taskId), { status: 'Cancelled' });

    // Cancel Booking
    const booking = bookings.find(b => b.taskId === taskId);
    if (booking) {
      batch.update(doc(db, 'bookings', booking.id), {
        approvalStatus: 'Rejected',
        comment: 'ภารกิจถูกยกเลิก'
      });
    }
    
    // Notify executive
    if (taskToCancel) {
      const exec = executives.find(e => e.id === taskToCancel.executiveId);
      const execUser = MOCK_USERS.find(u => u.name === exec?.name);
      if (execUser) {
        const id = `n-${Date.now()}-cancel`;
        batch.set(doc(db, 'notifications', id), {
          id,
          userId: execUser.id,
          title: 'ภารกิจถูกยกเลิก',
          message: `ภารกิจของคุณวันที่ ${new Date(taskToCancel.startTime).toLocaleDateString('th-TH')} หัวข้อ: ${taskToCancel.title} ได้รับการยกเลิกแล้ว`,
          type: 'system',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      }

      // Notify subtask assignees
      const affectedAssignments = assignments.filter(a => a.taskId === taskId);
      affectedAssignments.forEach((ass, idx) => {
        const usersOfRole = MOCK_USERS.filter(u => u.role === ass.assignedToRole);
        usersOfRole.forEach(u => {
          const id = `n-cancel-ass-${Date.now()}-${idx}-${u.id}`;
          batch.set(doc(db, 'notifications', id), {
            id,
            userId: u.id,
            title: 'ยกเลิกงานเตรียมงาน',
            message: `ยกเลิกงานจัดเตรียม: "${ass.title}" เนื่องจากภารกิจหลักถูกยกเลิก`,
            type: 'line',
            status: 'unread',
            createdAt: new Date().toISOString()
          });
        });
      });
    }

    // Log Activity
    const logId = `l-${Date.now()}`;
    batch.set(doc(db, 'logs', logId), {
      id: logId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'CANCEL_TASK',
      targetType: 'task',
      targetId: taskId,
      timestamp: new Date().toISOString().slice(0, 19),
      details: `ยกเลิกภารกิจรหัส: ${taskId}`
    });

    try {
      await batch.commit();
      Swal.fire({
        title: 'ยกเลิกภารกิจเรียบร้อย',
        text: 'ระบบได้ส่งสัญญาณยกเลิกไปยังฝ่ายจัดเตรียมและลบห้องออกจากระบบจองแล้ว',
        icon: 'info',
        confirmButtonText: 'รับทราบ'
      });
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', `การยกเลิกภารกิจขัดข้อง: ${err.message}`, 'error');
    }
  };

  // --- Assignment Operations ---

  const updateAssignmentStatus = async (assignmentId: string, status: TaskAssignment['status']) => {
    if (!currentUser || !hasPermission(currentUser.role, 'assignment:update_own')) {
      Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์อัปเดตสถานะงานเตรียมความพร้อม', 'error');
      return;
    }
    const targetAssignment = assignments.find(a => a.id === assignmentId);
    if (targetAssignment && targetAssignment.assignedToRole !== currentUser.role && !hasPermission(currentUser.role, 'assignment:view_all')) {
      Swal.fire('ไม่มีสิทธิ์', 'คุณสามารถอัปเดตได้เฉพาะงานที่มอบหมายให้บทบาทของคุณเท่านั้น', 'error');
      return;
    }

    try {
      await updateDoc(doc(db, 'assignments', assignmentId), { status });
      
      // Log activity
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser.id,
        userName: currentUser.name,
        userRole: currentUser.role,
        action: 'UPDATE_ASSIGNMENT',
        targetType: 'assignment',
        targetId: assignmentId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `เปลี่ยนสถานะงานเตรียมความพร้อม "${targetAssignment?.title}" เป็น ${status}`
      });

      Swal.fire({
        title: 'อัปเดตสถานะสำเร็จ',
        text: `งานย่อยได้รับการอัปเดตเป็น: ${status === 'Completed' ? 'เสร็จสิ้น' : status === 'In_Progress' ? 'กำลังดำเนินการ' : 'รอดำเนินการ'}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'bottom-end'
      });
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', `ไม่สามารถอัปเดตสถานะงานย่อยได้: ${err.message}`, 'error');
    }
  };

  // --- Approval Flow ---

  const approveBooking = async (bookingId: string, comment: string) => {
    if (!currentUser || !hasPermission(currentUser.role, 'booking:approve_vip')) {
      Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์อนุมัติการจองห้อง VIP', 'error');
      return;
    }

    const booking = bookings.find(b => b.id === bookingId);
    const task = tasks.find(t => t.id === booking?.taskId);
    const room = rooms.find(r => r.id === booking?.roomId);

    const batch = writeBatch(db);
    
    batch.update(doc(db, 'bookings', bookingId), {
      approvalStatus: 'Approved',
      approvedBy: currentUser.id,
      comment
    });
    
    // Notify creator
    if (task) {
      const id = `n-app-${Date.now()}`;
      batch.set(doc(db, 'notifications', id), {
        id,
        userId: task.createdBy,
        title: 'ห้องประชุม VIP ได้รับการอนุมัติ',
        message: `คำขอจองห้อง "${room?.name}" สำหรับภารกิจ "${task.title}" ได้รับอนุมัติแล้ว โดย ${currentUser.name}`,
        type: 'system',
        status: 'unread',
        createdAt: new Date().toISOString()
      });
    }

    // Log Activity
    const logId = `l-${Date.now()}`;
    batch.set(doc(db, 'logs', logId), {
      id: logId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'APPROVE_BOOKING',
      targetType: 'booking',
      targetId: bookingId,
      timestamp: new Date().toISOString().slice(0, 19),
      details: `อนุมัติจองห้อง: "${room?.name}" สำหรับภารกิจ: "${task?.title || ''}"`
    });

    try {
      await batch.commit();
      Swal.fire({
        title: 'อนุมัติคำขอสำเร็จ',
        text: 'ระบบทำการลงทะเบียนห้องประชุมและส่งแจ้งเตือนกลับไปยังเลขานุการแล้ว',
        icon: 'success',
        confirmButtonText: 'ตกลง'
      });
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', `อนุมัติห้องประชุม VIP ขัดข้อง: ${err.message}`, 'error');
    }
  };

  const rejectBooking = async (bookingId: string, comment: string) => {
    if (!currentUser || !hasPermission(currentUser.role, 'booking:approve_vip')) {
      Swal.fire('ไม่มีสิทธิ์', 'คุณไม่มีสิทธิ์ปฏิเสธการจองห้อง VIP', 'error');
      return;
    }

    const booking = bookings.find(b => b.id === bookingId);
    const task = tasks.find(t => t.id === booking?.taskId);
    const room = rooms.find(r => r.id === booking?.roomId);

    const batch = writeBatch(db);
    
    batch.update(doc(db, 'bookings', bookingId), {
      approvalStatus: 'Rejected',
      approvedBy: currentUser.id,
      comment
    });
    
    // Notify creator
    if (task) {
      const id = `n-rej-${Date.now()}`;
      batch.set(doc(db, 'notifications', id), {
        id,
        userId: task.createdBy,
        title: 'คำขอใช้ห้องประชุม VIP ถูกปฏิเสธ',
        message: `ห้อง "${room?.name}" สำหรับภารกิจ "${task.title}" ไม่ได้รับการอนุมัติ เหตุผล: ${comment}`,
        type: 'email',
        status: 'unread',
        createdAt: new Date().toISOString()
      });
    }

    // Log Activity
    const logId = `l-${Date.now()}`;
    batch.set(doc(db, 'logs', logId), {
      id: logId,
      userId: currentUser.id,
      userName: currentUser.name,
      userRole: currentUser.role,
      action: 'REJECT_BOOKING',
      targetType: 'booking',
      targetId: bookingId,
      timestamp: new Date().toISOString().slice(0, 19),
      details: `ปฏิเสธจองห้อง: "${room?.name}" (เหตุผล: ${comment})`
    });

    try {
      await batch.commit();
      Swal.fire({
        title: 'ปฏิเสธคำขอเรียบร้อย',
        text: 'ระบบได้บันทึกการส่งคืนสิทธิ์ใช้ห้องและแจ้งเตือนผู้จองแล้ว',
        icon: 'warning',
        confirmButtonText: 'ตกลง'
      });
    } catch (err: any) {
      Swal.fire('เกิดข้อผิดพลาด', `ปฏิเสธคำขอจองห้องประชุมขัดข้อง: ${err.message}`, 'error');
    }
  };

  // --- Room & Executive Admin Actions ---

  const createRoom = async (room: MeetingRoom) => {
    try {
      await setDoc(doc(db, 'rooms', room.id), room);
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'CREATE_ROOM',
        targetType: 'room',
        targetId: room.id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `สร้างห้องประชุมใหม่: "${room.name}"`
      });
    } catch (err: any) {
      console.error("Firestore createRoom error:", err);
      throw err;
    }
  };

  const updateRoom = async (roomId: string, updatedRoom: Partial<MeetingRoom>) => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), updatedRoom);
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'UPDATE_ROOM',
        targetType: 'room',
        targetId: roomId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แก้ไขห้องประชุม: "${updatedRoom.name || roomId}"`
      });
    } catch (err: any) {
      console.error("Firestore updateRoom error:", err);
      throw err;
    }
  };

  const deleteRoom = async (roomId: string) => {
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'DELETE_ROOM',
        targetType: 'room',
        targetId: roomId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `ลบห้องประชุม ID: "${roomId}"`
      });
    } catch (err: any) {
      console.error("Firestore deleteRoom error:", err);
      throw err;
    }
  };

  const createExecutive = async (exec: Executive) => {
    try {
      await setDoc(doc(db, 'executives', exec.id), exec);
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'CREATE_EXEC',
        targetType: 'executive',
        targetId: exec.id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `เพิ่มรายชื่อผู้บริหาร: "${exec.name}"`
      });
    } catch (err: any) {
      console.error("Firestore createExecutive error:", err);
      throw err;
    }
  };

  const updateExecutive = async (execId: string, updatedExec: Partial<Executive>) => {
    try {
      await updateDoc(doc(db, 'executives', execId), updatedExec);
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'UPDATE_EXEC',
        targetType: 'executive',
        targetId: execId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แก้ไขรายชื่อผู้บริหาร: "${updatedExec.name || execId}"`
      });
    } catch (err: any) {
      console.error("Firestore updateExecutive error:", err);
      throw err;
    }
  };

  const deleteExecutive = async (execId: string) => {
    try {
      await deleteDoc(doc(db, 'executives', execId));
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'DELETE_EXEC',
        targetType: 'executive',
        targetId: execId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `ลบชื่อผู้บริหาร ID: "${execId}"`
      });
    } catch (err: any) {
      console.error("Firestore deleteExecutive error:", err);
      throw err;
    }
  };

  const createExecStatus = async (recordInput: Omit<ExecutiveStatusRecord, 'id' | 'recordedBy' | 'recordedAt'>) => {
    try {
      const id = `status-${Date.now()}`;
      const recordedBy = currentUser?.name || currentUser?.email || 'Unknown';
      const recordedAt = new Date().toISOString();
      const newRecord: ExecutiveStatusRecord = {
        ...recordInput,
        id,
        recordedBy,
        recordedAt
      };
      
      const batch = writeBatch(db);
      batch.set(doc(db, 'exec_statuses', id), newRecord);

      // Create activity log
      const logId = `l-${Date.now()}`;
      const exec = executives.find(e => e.id === recordInput.executiveId);
      batch.set(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'CREATE_EXEC_STATUS',
        targetType: 'executive_status',
        targetId: id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `บันทึกสถานะผู้บริหาร: "${exec?.name || recordInput.executiveId}" เป็น "${recordInput.status}" (${recordInput.startDate} ถึง ${recordInput.endDate})`
      });

      // Send internal notification to all users
      const execName = exec?.name || 'ผู้บริหาร';
      const execPosition = exec?.position || '';
      const statusText = recordInput.status;
      const notifMsg = `${execPosition} ${execName} ${statusText} วันที่ ${recordInput.startDate} ถึง ${recordInput.endDate}`;
      
      users.forEach(u => {
        const notifId = `n-${Date.now()}-${u.id}`;
        batch.set(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: u.id,
          title: 'อัปเดตสถานะผู้บริหาร',
          message: notifMsg,
          type: 'system',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      });

      // Calculate acting authority cascade change notification!
      const topExec = executives.find(e => e.priority === 0);
      if (topExec) {
        const tempStatuses = [newRecord, ...execStatuses];
        
        const getSimulatedStatus = (execId: string, dateStr: string): ExecutiveStatusRecord => {
          const record = tempStatuses.find(r => 
            r.executiveId === execId && 
            r.startDate <= dateStr && 
            dateStr <= r.endDate
          );
          if (record) return record;
          return {
            id: 'temp',
            executiveId: execId,
            status: 'อยู่ปฏิบัติราชการ',
            startDate: dateStr,
            endDate: dateStr,
            recordedBy: 'System',
            recordedAt: new Date().toISOString()
          };
        };

        const getSimulatedActing = (execId: string, dateStr: string): Executive | null => {
          const target = executives.find(e => e.id === execId);
          if (!target) return null;
          if (target.priority !== 0) return null; // Only priority 0 needs acting authority
          
          const targetStatus = getSimulatedStatus(execId, dateStr);
          if (targetStatus.status === 'อยู่ปฏิบัติราชการ') return null;

          // 1. Manually assigned
          if (targetStatus.actingExecutiveId) {
            const assigned = executives.find(e => e.id === targetStatus.actingExecutiveId);
            if (assigned && assigned.status !== 'Suspended') {
              return assigned;
            }
          }

          // 2. Priority cascade fallback
          const activeExecs = executives
            .filter(e => e.status !== 'Suspended')
            .sort((a, b) => a.priority - b.priority);

          const candidates = activeExecs.filter(e => e.priority > target.priority);
          for (const candidate of candidates) {
            const candStatus = getSimulatedStatus(candidate.id, dateStr);
            if (candStatus.status === 'อยู่ปฏิบัติราชการ') {
              return candidate;
            }
          }
          return null;
        };

        const acting = getSimulatedActing(topExec.id, recordInput.startDate);
        if (acting) {
          const actingMsg = `${acting.position} ${acting.name} รักษาราชการแทน ${topExec.position}`;
          users.forEach(u => {
            const notifId = `n-acting-${Date.now()}-${u.id}`;
            batch.set(doc(db, 'notifications', notifId), {
              id: notifId,
              userId: u.id,
              title: 'ผู้รักษาราชการแทน',
              message: actingMsg,
              type: 'system',
              status: 'unread',
              createdAt: new Date().toISOString()
            });
          });
        }
      }

      await batch.commit();
    } catch (err: any) {
      console.error("Firestore createExecStatus error:", err);
      throw err;
    }
  };

  const updateExecStatus = async (id: string, updatedFields: Partial<ExecutiveStatusRecord>) => {
    try {
      const docRef = doc(db, 'exec_statuses', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('ไม่พบข้อมูลสถานะที่ต้องการแก้ไข');
      
      const oldRecord = docSnap.data() as ExecutiveStatusRecord;
      const newRecord = { ...oldRecord, ...updatedFields };

      const batch = writeBatch(db);
      batch.update(docRef, updatedFields);

      // Create activity log
      const logId = `l-${Date.now()}`;
      const exec = executives.find(e => e.id === newRecord.executiveId);
      batch.set(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'UPDATE_EXEC_STATUS',
        targetType: 'executive_status',
        targetId: id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แก้ไขสถานะผู้บริหาร: "${exec?.name || newRecord.executiveId}" เป็น "${newRecord.status}" (${newRecord.startDate} ถึง ${newRecord.endDate})`
      });

      // Send internal notification to all users
      const execName = exec?.name || 'ผู้บริหาร';
      const execPosition = exec?.position || '';
      const notifMsg = `[แก้ไข] ${execPosition} ${execName} ${newRecord.status} วันที่ ${newRecord.startDate} ถึง ${newRecord.endDate}`;
      
      users.forEach(u => {
        const notifId = `n-update-${Date.now()}-${u.id}`;
        batch.set(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: u.id,
          title: 'แก้ไขสถานะผู้บริหาร',
          message: notifMsg,
          type: 'system',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      });

      // Handle acting cascade notification
      const topExec = executives.find(e => e.priority === 0);
      if (topExec) {
        const tempStatuses = execStatuses.map(r => r.id === id ? newRecord : r);
        const getSimulatedStatus = (execId: string, dateStr: string): ExecutiveStatusRecord => {
          const record = tempStatuses.find(r => 
            r.executiveId === execId && 
            r.startDate <= dateStr && 
            dateStr <= r.endDate
          );
          if (record) return record;
          return {
            id: 'temp',
            executiveId: execId,
            status: 'อยู่ปฏิบัติราชการ',
            startDate: dateStr,
            endDate: dateStr,
            recordedBy: 'System',
            recordedAt: new Date().toISOString()
          };
        };

        const getSimulatedActing = (execId: string, dateStr: string): Executive | null => {
          const target = executives.find(e => e.id === execId);
          if (!target) return null;
          if (target.priority !== 0) return null; // Only priority 0 needs acting authority
          
          const targetStatus = getSimulatedStatus(execId, dateStr);
          if (targetStatus.status === 'อยู่ปฏิบัติราชการ') return null;

          // 1. Manually assigned
          if (targetStatus.actingExecutiveId) {
            const assigned = executives.find(e => e.id === targetStatus.actingExecutiveId);
            if (assigned && assigned.status !== 'Suspended') {
              return assigned;
            }
          }

          // 2. Priority cascade fallback
          const activeExecs = executives
            .filter(e => e.status !== 'Suspended')
            .sort((a, b) => a.priority - b.priority);

          const candidates = activeExecs.filter(e => e.priority > target.priority);
          for (const candidate of candidates) {
            const candStatus = getSimulatedStatus(candidate.id, dateStr);
            if (candStatus.status === 'อยู่ปฏิบัติราชการ') {
              return candidate;
            }
          }
          return null;
        };

        const acting = getSimulatedActing(topExec.id, newRecord.startDate);
        if (acting) {
          const actingMsg = `${acting.position} ${acting.name} รักษาราชการแทน ${topExec.position}`;
          users.forEach(u => {
            const notifId = `n-acting-${Date.now()}-${u.id}`;
            batch.set(doc(db, 'notifications', notifId), {
              id: notifId,
              userId: u.id,
              title: 'ผู้รักษาราชการแทน',
              message: actingMsg,
              type: 'system',
              status: 'unread',
              createdAt: new Date().toISOString()
            });
          });
        }
      }

      await batch.commit();
    } catch (err: any) {
      console.error("Firestore updateExecStatus error:", err);
      throw err;
    }
  };

  const deleteExecStatus = async (id: string) => {
    try {
      const docRef = doc(db, 'exec_statuses', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error('ไม่พบข้อมูลสถานะที่ต้องการลบ');
      const oldRecord = docSnap.data() as ExecutiveStatusRecord;

      const batch = writeBatch(db);
      batch.delete(docRef);

      // Create activity log
      const logId = `l-${Date.now()}`;
      const exec = executives.find(e => e.id === oldRecord.executiveId);
      batch.set(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'DELETE_EXEC_STATUS',
        targetType: 'executive_status',
        targetId: id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `ลบสถานะผู้บริหาร: "${exec?.name || oldRecord.executiveId}" (${oldRecord.startDate} ถึง ${oldRecord.endDate})`
      });

      // Send notification
      const execName = exec?.name || 'ผู้บริหาร';
      const execPosition = exec?.position || '';
      const notifMsg = `ยกเลิกสถานะของ ${execPosition} ${execName} (วันที่ ${oldRecord.startDate} ถึง ${oldRecord.endDate}) กลับสู่การปฏิบัติราชการปกติ`;
      
      users.forEach(u => {
        const notifId = `n-delete-${Date.now()}-${u.id}`;
        batch.set(doc(db, 'notifications', notifId), {
          id: notifId,
          userId: u.id,
          title: 'ยกเลิกสถานะผู้บริหาร',
          message: notifMsg,
          type: 'system',
          status: 'unread',
          createdAt: new Date().toISOString()
        });
      });

      await batch.commit();
    } catch (err: any) {
      console.error("Firestore deleteExecStatus error:", err);
      throw err;
    }
  };

  const getExecutiveStatus = (execId: string, dateStr: string): ExecutiveStatusRecord => {
    const record = execStatuses.find(r => 
      r.executiveId === execId && 
      r.startDate <= dateStr && 
      dateStr <= r.endDate
    );
    if (record) return record;
    return {
      id: `default-${execId}-${dateStr}`,
      executiveId: execId,
      status: 'อยู่ปฏิบัติราชการ',
      startDate: dateStr,
      endDate: dateStr,
      recordedBy: 'System',
      recordedAt: new Date().toISOString()
    };
  };

  const getActingAuthority = (execId: string, dateStr: string): Executive | null => {
    const targetExec = executives.find(e => e.id === execId);
    if (!targetExec) return null;

    // ONLY priority 0 executive gets acting authority
    if (targetExec.priority !== 0) {
      return null;
    }

    const targetStatus = getExecutiveStatus(execId, dateStr);
    if (targetStatus.status === 'อยู่ปฏิบัติราชการ') {
      return null;
    }

    // 1. Check if there is a manually assigned acting authority
    if (targetStatus.actingExecutiveId) {
      const assigned = executives.find(e => e.id === targetStatus.actingExecutiveId);
      if (assigned && assigned.status !== 'Suspended') {
        return assigned;
      }
    }

    // 2. Fallback to automatic priority-based search
    const activeExecs = executives
      .filter(e => e.status !== 'Suspended')
      .sort((a, b) => a.priority - b.priority);

    // Candidates have priority > 0
    const candidates = activeExecs.filter(e => e.priority > targetExec.priority);
    for (const candidate of candidates) {
      const candStatus = getExecutiveStatus(candidate.id, dateStr);
      if (candStatus.status === 'อยู่ปฏิบัติราชการ') {
        return candidate;
      }
    }

    return null;
  };

  const createDepartment = async (dept: Department) => {
    try {
      await setDoc(doc(db, 'departments', dept.id), dept);
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'CREATE_DEPT',
        targetType: 'department',
        targetId: dept.id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `เพิ่มหน่วยงาน/แผนก: "${dept.name}"`
      });
    } catch (err: any) {
      console.error("Firestore createDepartment error:", err);
      throw err;
    }
  };

  const updateDepartment = async (deptId: string, updatedDept: Partial<Department>) => {
    try {
      await updateDoc(doc(db, 'departments', deptId), updatedDept);
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'UPDATE_DEPT',
        targetType: 'department',
        targetId: deptId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แก้ไขหน่วยงาน/แผนก: "${updatedDept.name || deptId}"`
      });
    } catch (err: any) {
      console.error("Firestore updateDepartment error:", err);
      throw err;
    }
  };

  const deleteDepartment = async (deptId: string) => {
    try {
      await deleteDoc(doc(db, 'departments', deptId));
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'DELETE_DEPT',
        targetType: 'department',
        targetId: deptId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `ลบหน่วยงาน/แผนก ID: "${deptId}"`
      });
    } catch (err: any) {
      console.error("Firestore deleteDepartment error:", err);
      throw err;
    }
  };

  const updateUserProfile = async (updatedData: Partial<User>) => {
    if (!currentUser) return { success: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
    try {
      await updateDoc(doc(db, 'users', currentUser.id), updatedData);
      // Log Activity
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser.id,
        userName: updatedData.name || currentUser.name,
        userRole: currentUser.role,
        action: 'UPDATE_PROFILE',
        targetType: 'user',
        targetId: currentUser.id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แก้ไขข้อมูลส่วนตัวผู้ใช้งาน`
      });
      return { success: true };
    } catch (err: any) {
      console.error("Firestore updateUserProfile error:", err);
      return { success: false, error: err.message };
    }
  };

  const adminCreateUser = async (user: User) => {
    try {
      await setDoc(doc(db, 'users', user.id), user);
      // Log Activity
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'ADMIN_CREATE_USER',
        targetType: 'user',
        targetId: user.id,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แอดมินสร้างผู้ใช้งานใหม่: "${user.name}" (${user.role})`
      });
    } catch (err: any) {
      console.error("Firestore adminCreateUser error:", err);
      throw err;
    }
  };

  const adminUpdateUser = async (userId: string, updatedUserData: Partial<User>) => {
    try {
      await updateDoc(doc(db, 'users', userId), updatedUserData);
      // Log Activity
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'ADMIN_UPDATE_USER',
        targetType: 'user',
        targetId: userId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แอดมินแก้ไขข้อมูลผู้ใช้งาน: "${updatedUserData.name || userId}"`
      });
    } catch (err: any) {
      console.error("Firestore adminUpdateUser error:", err);
      throw err;
    }
  };

  const adminDeleteUser = async (userId: string) => {
    try {
      await deleteDoc(doc(db, 'users', userId));
      // Log Activity
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'ADMIN_DELETE_USER',
        targetType: 'user',
        targetId: userId,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แอดมินลบผู้ใช้งาน ID: "${userId}"`
      });
    } catch (err: any) {
      console.error("Firestore adminDeleteUser error:", err);
      throw err;
    }
  };

  const adminResetUserPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      // Log Activity
      const logId = `l-${Date.now()}`;
      await setDoc(doc(db, 'logs', logId), {
        id: logId,
        userId: currentUser?.id || 'system',
        userName: currentUser?.name || 'System',
        userRole: currentUser?.role || 'Admin',
        action: 'ADMIN_RESET_PASSWORD',
        targetType: 'user',
        targetId: email,
        timestamp: new Date().toISOString().slice(0, 19),
        details: `แอดมินส่งลิงก์รีเซ็ตรหัสผ่านไปยังอีเมล: "${email}"`
      });
    } catch (err: any) {
      console.error("Firestore adminResetUserPassword error:", err);
      throw err;
    }
  };

  // --- Privacy, RBAC & Masking Helpers ---

  const canViewTaskDetail = (task: Task): boolean => {
    if (!currentUser) return false;
    
    if (['Super Admin', 'Admin', 'Secretary'].includes(currentUser.role)) return true;
    
    if (currentUser.role === 'Executive') {
      if (['Public', 'Internal'].includes(task.confidentialityLevel)) return true;
      const exec = executives.find(e => e.name === currentUser.name);
      return task.executiveId === exec?.id || task.createdBy === currentUser.id;
    }

    if (['Public', 'Internal'].includes(task.confidentialityLevel)) return true;

    const hasAssignedSubtask = assignments.some(a => a.taskId === task.id && a.assignedToRole === currentUser.role);
    if (hasAssignedSubtask) return true;

    return false;
  };

  const maskTaskTitle = (task: Task): string => {
    if (canViewTaskDetail(task)) return task.title;
    if (task.confidentialityLevel === 'Secret') return 'ภารกิจลับระดับสูง (Secret Mission)';
    if (task.confidentialityLevel === 'Confidential') return 'การประชุมลับเฉพาะกลุ่ม (Confidential)';
    return 'การประชุมภายในชั้นความลับ';
  };

  const maskTaskDesc = (task: Task): string => {
    if (canViewTaskDetail(task)) return task.description;
    return 'ข้อมูลถูกจำกัดการเข้าถึงเนื่องจากสิทธิ์และระดับชั้นความลับของข้อมูล';
  };

  // --- Notifications Read Operations ---

  const markNotificationRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), { status: 'read' });
    } catch (err) {
      console.error("Failed to mark notification read in Firestore:", err);
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        if (n.status === 'unread') {
          batch.update(doc(db, 'notifications', n.id), { status: 'read' });
        }
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to mark all notifications read in Firestore:", err);
    }
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        users,
        executives,
        rooms,
        tasks,
        bookings,
        assignments,
        notifications: currentUser ? notifications.filter(n => n.userId === currentUser.id) : [],
        logs,
        departments,
        theme,
        toggleTheme,
        setCurrentUserByRole,
        
        quickLogin,
        logout,
        loadingAuth,
        
        createTask,
        updateTask,
        cancelTask,
        updateAssignmentStatus,
        approveBooking,
        rejectBooking,
        checkScheduleConflict,
        getSmartRecommendations,
        canViewTaskDetail,
        maskTaskTitle,
        maskTaskDesc,
        markNotificationRead,
        markAllNotificationsRead,
        editingTaskId,
        setEditingTaskId,
        hasPermission: (permission: string) => currentUser ? hasPermission(currentUser.role, permission as any) : false,
        
        createRoom,
        updateRoom,
        deleteRoom,
        createExecutive,
        updateExecutive,
        deleteExecutive,
        createDepartment,
        updateDepartment,
        deleteDepartment,
        updateUserProfile,
        adminCreateUser,
        adminUpdateUser,
        adminDeleteUser,
        adminResetUserPassword,
        execStatuses,
        createExecStatus,
        updateExecStatus,
        deleteExecStatus,
        getExecutiveStatus,
        getActingAuthority
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
