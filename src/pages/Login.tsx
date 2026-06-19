import React, { useState } from 'react';
import { useApp, User, UserRole } from '../context/AppContext';
import { Shield, Lock, Mail, LogIn, UserPlus, KeyRound, Server } from 'lucide-react';
import { auth, googleProvider, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendPasswordResetEmail, 
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import Swal from 'sweetalert2';

export const Login: React.FC = () => {
  const { users, quickLogin } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration Form States
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<UserRole>('General User');

  // Toggle States
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showDevMode, setShowDevMode] = useState(false);

  const handleManualLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาระบุอีเมลและรหัสผ่าน', 'error');
      return;
    }

    setLoading(true);
    try {
      // Set Firebase Auth Persistence based on Remember Me state
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      
      await signInWithEmailAndPassword(auth, email.trim(), password);
      Swal.fire({
        title: 'เข้าสู่ระบบสำเร็จ',
        text: 'ยินดีต้อนรับเข้าสู่ระบบจัดการตารางภารกิจแบบบูรณาการ',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err: any) {
      let message = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        message = 'ไม่พบผู้ใช้ในระบบ หรืออีเมลและรหัสผ่านไม่ตรงกัน';
      }
      Swal.fire('เข้าสู่ระบบล้มเหลว', message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || !name.trim()) {
      Swal.fire('ข้อผิดพลาด', 'กรุณากรอกข้อมูลให้ครบถ้วน', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email.trim(), password);
      
      // Save profile metadata in Firestore users collection
      await setDoc(doc(db, 'users', res.user.uid), {
        id: res.user.uid,
        email: email.trim(),
        name: name.trim(),
        role: role,
        phone: phone.trim(),
        avatarUrl: `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(name.trim())}`
      });

      Swal.fire('สมัครสมาชิกสำเร็จ', 'บัญชีสิทธิ์ใช้งานของคุณได้รับการลงทะเบียนเรียบร้อยแล้ว', 'success');
      setIsSignUp(false);
    } catch (err: any) {
      let message = 'ไม่สามารถสมัครสมาชิกได้';
      if (err.code === 'auth/email-already-in-use') message = 'อีเมลนี้ถูกใช้งานไปแล้ว';
      else if (err.code === 'auth/weak-password') message = 'รหัสผ่านไม่ปลอดภัยพอ (ขั้นต่ำ 6 ตัวอักษร)';
      Swal.fire('สมัครสมาชิกล้มเหลว', message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      Swal.fire('ข้อผิดพลาด', 'กรุณาระบุอีเมล', 'error');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      Swal.fire('ส่งลิงก์สำเร็จ', 'ระบบได้ส่งลิงก์ตั้งรหัสผ่านใหม่ไปยังอีเมลของคุณแล้ว', 'success');
      setIsResetPassword(false);
    } catch (err: any) {
      Swal.fire('ส่งล้มเหลว', 'ไม่มีอีเมลนี้ในฐานข้อมูล หรือเซิร์ฟเวอร์ขัดข้อง', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      Swal.fire({
        title: 'ลงชื่อเข้าใช้สำเร็จ',
        text: 'ยินดีต้อนรับด้วยบัญชี Google',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err: any) {
      console.warn(err);
      Swal.fire('ลงชื่อเข้าใช้ล้มเหลว', 'การลงชื่อเข้าใช้งานด้วย Google ขัดข้อง หรือถูกปิดหน้าต่างลงชื่อ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (role: User['role']) => {
    setLoading(true);
    try {
      await quickLogin(role);
      Swal.fire({
        title: 'เข้าสู่ระบบด่วนสำเร็จ',
        text: `คุณเข้าระบบด้วยบทบาท: ${role}`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
      });
    } catch (err) {
      Swal.fire('เกิดข้อผิดพลาด', 'การเข้าสู่ระบบด่วนขัดข้อง', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-4 py-12 relative overflow-hidden select-none font-sans">
      
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] bg-enterprise-500/20 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 h-[300px] w-[300px] bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse"></div>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl z-10">
        
        {/* Left Side Banner (Desktop only) */}
        <div className="hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-enterprise-950 to-slate-900 border-r border-slate-800 text-left">
          <div className="flex items-center gap-3.5">
            <img src="/logo.png" alt="Task & Facility Logo" className="h-12 w-12 rounded-xl object-contain drop-shadow-lg" />
            <div>
              <div className="text-sm font-extrabold leading-tight text-white uppercase tracking-wider">Task & Facility</div>
              <div className="text-[10px] text-slate-400">ระบบบริหารจัดการภารกิจแบบบูรณาการ</div>
            </div>
          </div>

          <div className="space-y-6 my-8">
            <h2 className="text-2xl font-extrabold leading-snug space-y-2.5">
              <span className="block text-white">ระบบบริหารภารกิจและทรัพยากรห้องประชุมแบบบูรณาการ</span>
              <span className="block text-sm font-semibold tracking-wide text-slate-400 uppercase">Integrated Task & Facility Management System</span>
            </h2>
          </div>

          <div className="text-[10px] text-slate-500">
            © 2026 งานเทคโนโลยีสารสนเทศ ตำรวจภูธรจังหวัดอำนาจเจริญ
          </div>
        </div>

        {/* Right Side auth forms */}
        <div className="p-8 md:p-10 flex flex-col justify-center text-left space-y-6 bg-slate-900">
          
          {/* Mobile brand logo */}
          <div className="md:hidden flex items-center gap-3.5 mb-2 pb-4 border-b border-slate-800">
            <img src="/logo.png" alt="Task & Facility Logo" className="h-11 w-11 rounded-xl object-contain drop-shadow-lg" />
            <div className="text-left">
              <div className="text-sm font-extrabold leading-tight text-white uppercase tracking-wider">Task & Facility System</div>
              <div className="text-[9px] text-slate-400">ระบบบริหารภารกิจและทรัพยากรห้องประชุมแบบบูรณาการ</div>
            </div>
          </div>

          {/* Render reset password panel */}
          {isResetPassword ? (
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-enterprise-500" />
                  <span>ลืมรหัสผ่าน</span>
                </h1>
                <p className="text-xs text-slate-400">ระบุอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่านทางอีเมล</p>
              </div>

              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">อีเมลผู้ใช้งาน (Email)</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@gov.go.th"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                      required
                    />
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-enterprise-500 hover:bg-enterprise-600 font-bold py-3 text-xs text-white cursor-pointer shadow-lg shadow-enterprise-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>ส่งอีเมลรีเซ็ตรหัสผ่าน</span>
                  )}
                </button>
              </form>

              <div className="text-center">
                <button
                  onClick={() => setIsResetPassword(false)}
                  className="text-xs text-enterprise-500 hover:underline font-semibold"
                >
                  กลับไปหน้าเข้าสู่ระบบ
                </button>
              </div>
            </div>
          ) : isSignUp ? (
            /* Render Signup panel */
            <div className="space-y-4">
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-enterprise-500" />
                  <span>สมัครเข้าใช้งาน</span>
                </h1>
                <p className="text-xs text-slate-400">สร้างบัญชีผู้ใช้ใหม่สำหรับระบบความมั่นคงและจองห้องประชุม</p>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">ชื่อ - นามสกุล *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="เช่น นายนครินทร์ สมบูรณ์"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">เบอร์โทรศัพท์ติดต่อ</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="เช่น 089-xxxxxxx"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">อีเมล (Email Address) *</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@gov.go.th"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">รหัสผ่าน (Password) *</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="ขั้นต่ำ 6 ตัวอักษร"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                {/* Role selection for testing purpose */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">สิทธิ์และบทบาทที่ต้องการสร้าง *</label>
                  <select
                    value={role}
                    onChange={e => setRole(e.target.value as UserRole)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-enterprise-500 focus:outline-none cursor-pointer"
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-enterprise-500 hover:bg-enterprise-600 font-bold py-3 text-xs text-white cursor-pointer shadow-lg shadow-enterprise-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <span>สมัครสมาชิกและเริ่มทดสอบ</span>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  onClick={() => setIsSignUp(false)}
                  className="text-xs text-enterprise-500 hover:underline font-semibold"
                >
                  มีบัญชีอยู่แล้ว? ลงชื่อเข้าใช้
                </button>
              </div>
            </div>
          ) : (
            /* Render Sign In panel */
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="h-5 w-5 text-enterprise-500" />
                  <span>เข้าสู่ระบบ</span>
                </h1>
                <p className="text-xs text-slate-400">ระบุข้อมูลบัญชีผู้ใช้ หรือลงชื่อเข้าใช้ด้วย Google / บัญชีด่วน</p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleManualLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">อีเมลผู้ใช้งาน (Email)</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="name@gov.go.th"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                      required
                    />
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">รหัสผ่าน (Password)</label>
                    <button
                      type="button"
                      onClick={() => setIsResetPassword(true)}
                      className="text-[9px] font-bold text-slate-500 hover:text-enterprise-500"
                    >
                      ลืมรหัสผ่าน?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pl-10 text-xs text-white placeholder-slate-650 focus:border-enterprise-500 focus:outline-none transition-all"
                      required
                    />
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-600" />
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center pt-1 pb-1">
                  <label className="flex items-center gap-2.5 text-xs text-slate-400 hover:text-slate-350 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="rounded border-slate-800 text-enterprise-500 focus:ring-enterprise-500 bg-slate-950 h-4 w-4 transition-all"
                    />
                    <span>จดจำการเข้าระบบ (Remember Me)</span>
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-xl bg-enterprise-500 hover:bg-enterprise-600 font-bold py-3 text-xs text-white cursor-pointer shadow-lg shadow-enterprise-500/20 transition-all flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <LogIn className="h-4 w-4" />
                      <span>เข้าสู่ระบบ</span>
                    </>
                  )}
                </button>
              </form>

              {/* Login with Google option */}
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full rounded-xl border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-850 font-bold py-2.5 text-xs text-slate-300 cursor-pointer transition-all flex justify-center items-center gap-2 shadow-sm"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
                </svg>
                <span>ลงชื่อเข้าใช้งานด้วย Google</span>
              </button>

              <div className="text-center text-xs">
                <span className="text-slate-500">ยังไม่มีบัญชีสิทธิ์ใช้งาน? </span>
                <button
                  onClick={() => setIsSignUp(true)}
                  className="text-enterprise-500 hover:underline font-bold"
                >
                  สร้างบัญชีใหม่
                </button>
              </div>

              {/* Developer Demo Mode Toggle */}
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setShowDevMode(!showDevMode)}
                  className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-400 uppercase tracking-wider transition-colors cursor-pointer"
                >
                  <Server className="h-3.5 w-3.5" />
                  <span>{showDevMode ? 'ซ่อนโหมดนักพัฒนา' : 'โหมดทดสอบสำหรับนักพัฒนา (Developer Demo Mode)'}</span>
                </button>
              </div>

              {/* Collapsible Quick Login Section */}
              {showDevMode && (
                <div className="space-y-3 p-3 bg-slate-950/40 rounded-2xl border border-slate-850/80 animate-in slide-in-from-top-2 duration-200">
                  <div className="text-[9px] font-bold text-slate-500 uppercase tracking-widest text-center">
                    เข้าสู่ระบบด้วยสิทธิ์บัญชีจำลอง (Auto-Provision)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {users.slice(0, 6).map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleQuickLogin(user.role)}
                        className="p-2.5 rounded-xl border border-slate-800 bg-slate-950 hover:bg-slate-850 hover:border-slate-700 cursor-pointer text-left transition-all flex items-center gap-2"
                      >
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="h-7 w-7 rounded-full object-cover ring-1 ring-slate-800"
                          style={{
                            objectPosition: `${user.avatarOffsetX ?? 50}% ${user.avatarOffsetY ?? 50}%`
                          }}
                        />
                        <div className="overflow-hidden">
                          <div className="font-bold text-slate-200 truncate">{user.name.split(' ')[0]}</div>
                          <div className="text-[9px] text-slate-500 truncate">{user.role}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
};
