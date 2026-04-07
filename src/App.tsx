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
  signOut 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot,
  collection,
  query,
  where
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
  AlertCircle
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
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          const adminEmails = ['netfixa07@gmail.com', 'douglastaylorinvestimentos@gmail.com', 'atizzoneto@gmail.com'];
          const shouldBeAdmin = adminEmails.includes(firebaseUser.email || '');
          
          if (shouldBeAdmin && userData.role !== 'admin') {
            const updatedUser = { ...userData, role: 'admin' as UserRole };
            await setDoc(doc(db, 'users', firebaseUser.uid), updatedUser);
            setUser(updatedUser);
          } else {
            setUser(userData);
          }
        } else {
          // Create default user if it's the admin email
          const adminEmails = ['netfixa07@gmail.com', 'douglastaylorinvestimentos@gmail.com', 'atizzoneto@gmail.com'];
          const isAdmin = adminEmails.includes(firebaseUser.email || '');
          const newUser: User = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email || '',
            role: isAdmin ? 'admin' : 'cashier',
            active: true
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
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

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
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
  const { login } = useAuth();
  const [loginType, setLoginType] = useState<'admin' | 'employee'>('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError(null);
    try {
      // In this environment, we primarily use Google Login for simplicity and security
      // but we simulate the profile selection logic
      await login();
      // The actual role check happens in the AuthProvider's onAuthStateChanged
    } catch (err: any) {
      setError('Falha na autenticação. Verifique suas credenciais.');
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

        <form onSubmit={handleLogin} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider ml-1">E-mail ou Usuário</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@flocomel.com"
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
            <button type="button" className="text-xs text-amber-600 font-bold hover:underline">Esqueceu a senha?</button>
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

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-4 text-slate-300 font-bold tracking-widest">Ou acesse com</span></div>
        </div>

        <button
          onClick={login}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-slate-100 hover:border-amber-200 hover:bg-amber-50 py-4 rounded-2xl transition-all duration-300 font-bold text-slate-600 shadow-sm"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          Google Workspace
        </button>
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
