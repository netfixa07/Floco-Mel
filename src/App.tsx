import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate, 
  useLocation,
  Link
} from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from './firebase';
import ErrorBoundary from './components/ErrorBoundary';
import { User, UserRole } from './types';
import { LOGO_URL } from './constants';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  DollarSign, 
  Users, 
  LogOut, 
  IceCream,
  Menu,
  X,
  ChevronRight,
  Shield,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  User as UserIcon
} from 'lucide-react';
import { cn } from './lib/utils';
import { motion, AnimatePresence } from 'motion/react';

// Components
import Dashboard from './components/Dashboard';
import POS from './components/POS';
import Inventory from './components/Inventory';
import Finance from './components/Finance';
import Employees from './components/Employees';

// Auth Context
interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            
            // Check if user is active
            if (userData.active === false) {
              await signOut(auth);
              setUser(null);
              return;
            }

            if (userData.forcePasswordChange) {
              // Note: In a production app, you would redirect to a /change-password route
              console.warn("Usuário precisa trocar a senha.");
            }

            const adminEmails = ['netfixa07@gmail.com', 'douglastaylorinvestimentos@gmail.com', 'atizzoneto@gmail.com', 'admin@flocomel.com'];
            const shouldBeAdmin = adminEmails.includes(firebaseUser.email?.toLowerCase() || '');
            
            if (shouldBeAdmin && userData.role !== 'admin') {
              const updatedUser = { ...userData, role: 'admin' as UserRole, active: true };
              await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
              setUser(updatedUser);
            } else {
              setUser(userData);
            }
          } else {
            // Create default user if it's the admin email
            const adminEmails = ['netfixa07@gmail.com', 'douglastaylorinvestimentos@gmail.com', 'atizzoneto@gmail.com', 'admin@flocomel.com'];
            const isAdmin = adminEmails.includes(firebaseUser.email?.toLowerCase() || '');
            
            if (isAdmin) {
              const newUser: User = {
                uid: firebaseUser.uid,
                name: firebaseUser.displayName || 'Administrador',
                email: firebaseUser.email || '',
                role: 'admin',
                active: true,
                createdAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
              setUser(newUser);
            } else {
              // Not an admin and not in DB? Log out.
              await signOut(auth);
              setUser(null);
            }
          }
        } catch (error) {
          console.error("Auth error:", error);
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const loginWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email, pass);
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Layout Component
const SidebarItem = ({ to, icon: Icon, label, active }: any) => (
  <Link
    to={to}
    className={cn(
      "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
      active 
        ? "bg-amber-100 text-amber-900 shadow-sm" 
        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-amber-600" : "text-slate-400 group-hover:text-slate-600")} />
    <span className="font-medium">{label}</span>
    {active && <ChevronRight className="w-4 h-4 ml-auto text-amber-600" />}
  </Link>
);

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard', roles: ['admin', 'manager'] },
    { to: '/pos', icon: ShoppingCart, label: 'Caixa (PDV)', roles: ['admin', 'manager', 'cashier'] },
    { to: '/inventory', icon: Package, label: 'Estoque', roles: ['admin', 'manager', 'cashier'] },
    { to: '/finance', icon: DollarSign, label: 'Financeiro', roles: ['admin', 'manager'] },
    { to: '/employees', icon: Users, label: 'Funcionários', roles: ['admin'] },
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(user?.role || ''));

  return (
    <div className="flex h-screen bg-[#FDFCF8] text-slate-900 overflow-hidden">
      {/* Sidebar Desktop */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-r border-slate-100 p-6">
        <div className="flex items-center gap-3 mb-10 px-2">
          <IceCream className="text-amber-500 w-8 h-8" />
          <div>
            <h1 className="font-bold text-xl tracking-tight">FlocoMel</h1>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">Sorvetes Premium</p>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          {filteredItems.map((item) => (
            <SidebarItem
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label}
              active={location.pathname === item.to}
            />
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-50">
          <div className="flex items-center gap-3 px-2 mb-6">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
              {user?.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 px-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <IceCream className="text-amber-500 w-6 h-6" />
          <span className="font-bold text-lg tracking-tight">FlocoMel</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)}>
          <Menu className="w-6 h-6 text-slate-600" />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-80 bg-white z-[70] p-6 lg:hidden shadow-2xl"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-3">
                  <IceCream className="text-amber-500 w-8 h-8" />
                  <span className="font-bold text-xl tracking-tight">FlocoMel</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)}>
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <nav className="space-y-2">
                {filteredItems.map((item) => (
                  <SidebarItem
                    key={item.to}
                    to={item.to}
                    icon={item.icon}
                    label={item.label}
                    active={location.pathname === item.to}
                  />
                ))}
              </nav>
              <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-slate-50">
                <button
                  onClick={logout}
                  className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-500 hover:bg-red-50 rounded-xl transition-colors font-medium"
                >
                  <LogOut className="w-5 h-5" />
                  Sair
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pt-16 lg:pt-0 p-4 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};

const Login: React.FC = () => {
  const { loginWithEmail, login } = useAuth();
  const [loginType, setLoginType] = useState<'admin' | 'employee'>('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor, digite seu usuário e senha.');
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      // Employees MUST login by username
      const username = email.toLowerCase().trim();
      const usernameDoc = await getDoc(doc(db, 'usernames', username));
      
      if (!usernameDoc.exists()) {
        setError('Usuário não encontrado. Verifique se o administrador já cadastrou você.');
        setIsLoggingIn(false);
        return;
      }

      const userData = usernameDoc.data();
      if (userData.active === false) {
        setError('Sua conta está inativa. Entre em contato com o administrador.');
        setIsLoggingIn(false);
        return;
      }

      await loginWithEmail(userData.email, password);
    } catch (err: any) {
      console.error('Employee login error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Senha incorreta para este usuário.');
      } else {
        setError('Erro ao entrar. Verifique sua conexão ou tente novamente.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Digite seu e-mail para receber o link de redefinição.');
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      alert('E-mail de redefinição enviado! Verifique sua caixa de entrada.');
    } catch (err: any) {
      console.error('Reset password error:', err);
      setError('Erro ao enviar e-mail de redefinição. Verifique o endereço digitado.');
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Digite usuário e senha administrativos.');
      return;
    }
    setIsLoggingIn(true);
    setError(null);
    try {
      const username = email.toLowerCase().trim();
      
      // Fixed admin credentials
      if (username === 'admin' && password === 'admin1234') {
        // Use a fixed admin email for Firebase Auth
        const adminEmail = 'admin@flocomel.com';
        let uid: string;
        
        try {
          const userCredential = await signInWithEmailAndPassword(auth, adminEmail, password);
          uid = userCredential.user.uid;
        } catch (err: any) {
          // If account doesn't exist in Auth, create it
          if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
            try {
              const userCredential = await createUserWithEmailAndPassword(auth, adminEmail, password);
              uid = userCredential.user.uid;
            } catch (createErr: any) {
              // If it failed because it already exists but we got wrong-password, then it's a wrong password
              if (err.code === 'auth/wrong-password') {
                setError('Senha administrativa incorreta.');
                setIsLoggingIn(false);
                return;
              }
              throw createErr;
            }
          } else {
            throw err;
          }
        }

        // Ensure admin document exists in Firestore (Robust check after login/creation)
        const adminDoc = await getDoc(doc(db, 'users', uid));
        if (!adminDoc.exists()) {
          await setDoc(doc(db, 'users', uid), {
            uid,
            name: 'Administrador Principal',
            email: adminEmail,
            username: 'admin',
            role: 'admin',
            active: true,
            createdAt: serverTimestamp()
          });
        } else if (adminDoc.data()?.role !== 'admin' || adminDoc.data()?.active !== true) {
          // Force admin role and active status if document exists but is wrong
          await updateDoc(doc(db, 'users', uid), {
            role: 'admin',
            active: true
          });
        }
        
        // Ensure username mapping exists
        const usernameDoc = await getDoc(doc(db, 'usernames', 'admin'));
        if (!usernameDoc.exists()) {
          await setDoc(doc(db, 'usernames', 'admin'), {
            uid,
            email: adminEmail,
            active: true
          });
        }
      } else {
        setError('Usuário ou senha administrativa incorretos.');
      }
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError('Erro na autenticação administrativa.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-64 h-64 bg-amber-100 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-amber-50 rounded-full blur-3xl opacity-50" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl shadow-amber-900/5 p-8 lg:p-10 text-center border border-amber-50 relative z-10"
      >
        <IceCream className="text-amber-500 w-16 h-16 mx-auto mb-6" />
        <h1 className="text-3xl font-black text-slate-900 mb-1">FlocoMel</h1>
        <p className="text-slate-400 font-medium mb-8 uppercase tracking-[0.2em] text-[10px]">Sorvetes Premium • ERP</p>
        
        {/* Profile Selector */}
        <div className="flex p-1 bg-slate-50 rounded-2xl mb-8">
          <button
            onClick={() => setLoginType('employee')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2",
              loginType === 'employee' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Users className="w-4 h-4" />
            Funcionário
          </button>
          <button
            onClick={() => setLoginType('admin')}
            className={cn(
              "flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2",
              loginType === 'admin' ? "bg-white text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <Shield className="w-4 h-4" />
            Administrador
          </button>
        </div>

        {loginType === 'employee' ? (
          <form onSubmit={handleEmployeeLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Usuário (Login)</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Seu usuário (ex: joao.silva)"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-amber-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 pt-1">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-200 text-amber-500 focus:ring-amber-500" />
                <span className="text-xs text-slate-400 group-hover:text-slate-600 transition-colors">Lembrar de mim</span>
              </label>
              <button 
                type="button" 
                onClick={handleForgotPassword}
                className="text-xs text-amber-600 font-bold hover:underline"
              >
                Esqueceu a senha?
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white py-4 rounded-2xl font-black shadow-lg shadow-amber-200 transition-all duration-300 flex items-center justify-center gap-2 mt-4"
            >
              {isLoggingIn ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" />
                </motion.div>
              ) : (
                <>
                  Entrar no Sistema
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAdminLogin} className="space-y-4 text-left">
            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Usuário Admin</label>
              <div className="relative">
                <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">Senha</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-slate-50 border-2 border-transparent focus:border-amber-200 focus:bg-white rounded-2xl outline-none transition-all font-medium text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-amber-500 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 text-red-500 text-xs font-bold p-3 rounded-xl flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 text-white py-4 rounded-2xl font-black shadow-lg transition-all duration-300 flex items-center justify-center gap-2 mt-4"
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
              ) : (
                <>
                  Entrar como Admin
                  <ChevronRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <IceCream className="w-10 h-10 text-amber-400" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Layout>
      <Routes>
        {/* Admin & Manager Routes */}
        <Route 
          path="/" 
          element={user.role === 'admin' || user.role === 'manager' ? <Dashboard /> : <Navigate to="/pos" />} 
        />
        <Route 
          path="/inventory" 
          element={<Inventory />} 
        />
        <Route 
          path="/finance" 
          element={user.role === 'admin' || user.role === 'manager' ? <Finance /> : <Navigate to="/pos" />} 
        />
        
        {/* Admin Only Routes */}
        <Route 
          path="/employees" 
          element={user.role === 'admin' ? <Employees /> : <Navigate to="/" />} 
        />

        {/* Shared Routes (with internal role checks) */}
        <Route path="/pos" element={<POS />} />
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  );
};

export default App;
