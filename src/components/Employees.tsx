import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  getDoc,
  doc, 
  query, 
  where,
  limit,
  getDocs,
  orderBy,
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut as authSignOut } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, firebaseConfig, firestoreDatabaseId, logAudit } from '../firebase';
import { User, UserRole } from '../types';
import { 
  Shield, 
  User as UserIcon, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Search,
  Edit2,
  RefreshCw,
  Trash2,
  Activity,
  X,
  Plus,
  Phone,
  CreditCard,
  Calendar,
  Briefcase,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [viewingActivity, setViewingActivity] = useState<User | null>(null);
  const [employeeSales, setEmployeeSales] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    type: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'info'
  });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Form State for New Employee
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    role: 'cashier' as UserRole,
    cpf: '',
    phone: '',
    birthDate: '',
    admissionDate: new Date().toISOString().split('T')[0],
    cargo: '',
    forcePasswordChange: true
  });

  const handleNameChange = (name: string) => {
    const username = name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/\s+/g, '.') // Replace spaces with dots
      .replace(/[^a-z0-9.]/g, ''); // Remove special characters
    
    setNewEmployee(prev => {
      const newUsername = prev.username === '' || prev.username === prev.name.toLowerCase().replace(/\s+/g, '.') ? username : prev.username;
      return {
        ...prev,
        name,
        username: newUsername,
        email: `${newUsername}@flocomel.com`
      };
    });
  };

  const resetForm = () => {
    setNewEmployee({
      name: '',
      email: '',
      username: '',
      password: '',
      role: 'cashier',
      cpf: '',
      phone: '',
      birthDate: '',
      admissionDate: new Date().toISOString().split('T')[0],
      cargo: '',
      forcePasswordChange: true
    });
  };

  useEffect(() => {
    if (viewingActivity) {
      setLoadingActivity(true);
      const q = query(
        collection(db, 'sales'),
        where('cashierId', '==', viewingActivity.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setEmployeeSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingActivity(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'sales');
        setLoadingActivity(false);
      });
      
      return () => unsubscribe();
    }
  }, [viewingActivity]);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'users'), orderBy('name')), 
      (snapshot) => {
        setEmployees(snapshot.docs.map(doc => ({ ...doc.data() } as User)));
      }, 
      (err) => handleFirestoreError(err, OperationType.LIST, 'users')
    );

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      unsubscribe();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredEmployees = employees.filter(e => 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUpdateRole = async (uid: string, newRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const syncUsernames = async () => {
    setConfirmModal({
      isOpen: true,
      title: 'Sincronizar Acessos',
      message: 'Deseja sincronizar os acessos? Isso garantirá que todos os funcionários consigam logar pelo usuário.',
      type: 'info',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setIsSyncing(true);
        try {
          const usersSnap = await getDocs(collection(db, 'users'));
          const batch: Promise<any>[] = [];
          
          usersSnap.docs.forEach(userDoc => {
            const data = userDoc.data() as User;
            if (data.username) {
              batch.push(setDoc(doc(db, 'usernames', data.username), {
                uid: data.uid,
                email: data.email,
                active: data.active !== false
              }));
            }
          });
          
          await Promise.all(batch);
          setNotification({ message: 'Sincronização concluída com sucesso!', type: 'success' });
        } catch (err) {
          console.error('Sync error:', err);
          setNotification({ message: 'Erro ao sincronizar acessos.', type: 'error' });
        } finally {
          setIsSyncing(false);
        }
      }
    });
  };

  const handleToggleActive = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { active: !currentStatus });
      
      // Update mapping status
      const userDoc = await getDoc(doc(db, 'users', uid));
      const userData = userDoc.data();
      if (userData?.username) {
        await updateDoc(doc(db, 'usernames', userData.username), { active: !currentStatus });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteEmployee = async (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Excluir Funcionário',
      message: 'Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita.',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          const userData = userDoc.data();
          
          await deleteDoc(doc(db, 'users', uid));
          
          await logAudit('DELETE_EMPLOYEE', {
            deletedUserId: uid,
            deletedUserData: userData
          });

          if (userData?.username) {
            await deleteDoc(doc(db, 'usernames', userData.username));
          }

          setActiveMenu(null);
          setNotification({ message: 'Funcionário excluído com sucesso!', type: 'success' });
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
        }
      }
    });
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const generatedEmail = newEmployee.email || `${newEmployee.username.toLowerCase().trim()}@flocomel.com`;
    
    try {
      // 1. Check if email or username already exists in Firestore
      const emailQuery = query(collection(db, 'users'), where('email', '==', generatedEmail.toLowerCase().trim()), limit(1));
      const usernameQuery = query(collection(db, 'users'), where('username', '==', newEmployee.username.toLowerCase().trim()), limit(1));
      
      const [emailSnap, usernameSnap] = await Promise.all([
        getDocs(emailQuery),
        getDocs(usernameQuery)
      ]);

      if (!emailSnap.empty) {
        const existingUser = emailSnap.docs[0].data() as User;
        setConfirmModal({
          isOpen: true,
          title: 'Usuário Existente',
          message: `O usuário ${newEmployee.username} já possui um cadastro para ${existingUser.name}. Deseja reativar/atualizar este funcionário?`,
          type: 'info',
          onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, isOpen: false }));
            const updatedData = {
              ...existingUser,
              name: newEmployee.name,
              username: newEmployee.username || existingUser.username,
              role: newEmployee.role,
              active: true,
              cpf: newEmployee.cpf,
              phone: newEmployee.phone,
              birthDate: newEmployee.birthDate,
              admissionDate: newEmployee.admissionDate,
              cargo: newEmployee.cargo,
              forcePasswordChange: newEmployee.forcePasswordChange,
              updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'users', existingUser.uid), updatedData);
            setIsAddModalOpen(false);
            resetForm();
            setNotification({ message: 'Funcionário atualizado/reativado com sucesso!', type: 'success' });
          }
        });
        setIsSubmitting(false);
        return;
      }

      if (!usernameSnap.empty) {
        setNotification({ message: 'Este nome de usuário já está sendo usado por outro funcionário.', type: 'error' });
        setIsSubmitting(false);
        return;
      }

      // 2. Create Auth User using secondary app
      const secondaryAppName = `secondary-app-${Date.now()}`;
      const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        const userCredential = await createUserWithEmailAndPassword(
          secondaryAuth, 
          generatedEmail, 
          newEmployee.password
        );
        
        const uid = userCredential.user.uid;
        
        // 3. Create Firestore Document
        const employeeData: User = {
          uid,
          name: newEmployee.name,
          email: generatedEmail.toLowerCase().trim(),
          username: newEmployee.username.toLowerCase().trim(),
          role: newEmployee.role,
          active: true,
          cpf: newEmployee.cpf,
          phone: newEmployee.phone,
          birthDate: newEmployee.birthDate,
          admissionDate: newEmployee.admissionDate,
          cargo: newEmployee.cargo,
          forcePasswordChange: newEmployee.forcePasswordChange,
          createdAt: serverTimestamp()
        };
        
        await setDoc(doc(db, 'users', uid), employeeData);
        
        // 4. Create Username Mapping for login
        await setDoc(doc(db, 'usernames', employeeData.username), {
          uid: employeeData.uid,
          email: employeeData.email,
          active: true
        });

        await authSignOut(secondaryAuth);
        
        setIsAddModalOpen(false);
        resetForm();
        setNotification({ message: 'Funcionário cadastrado com sucesso!', type: 'success' });
      } catch (authErr: any) {
        if (authErr.code === 'auth/email-already-in-use') {
          setNotification({ message: 'Este usuário já possui uma conta de acesso.', type: 'error' });
        } else if (authErr.code === 'auth/weak-password') {
          setNotification({ message: 'A senha deve ter pelo menos 6 caracteres.', type: 'error' });
        } else {
          throw authErr;
        }
      }
    } catch (err: any) {
      console.error("Error adding employee:", err);
      setNotification({ message: 'Erro ao cadastrar funcionário.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      // Get old data to check if username changed
      const oldDoc = await getDoc(doc(db, 'users', editingEmployee.uid));
      const oldData = oldDoc.data();
      const oldUsername = oldData?.username;

      await updateDoc(doc(db, 'users', editingEmployee.uid), {
        name: editingEmployee.name,
        email: editingEmployee.email,
        username: editingEmployee.username || editingEmployee.email.split('@')[0],
        cpf: editingEmployee.cpf || '',
        phone: editingEmployee.phone || '',
        cargo: editingEmployee.cargo || '',
        role: editingEmployee.role,
        birthDate: editingEmployee.birthDate || '',
        admissionDate: editingEmployee.admissionDate || '',
        updatedAt: serverTimestamp()
      });

      // Update username mapping if changed
      if (oldUsername && oldUsername !== editingEmployee.username) {
        await deleteDoc(doc(db, 'usernames', oldUsername));
      }
      
      await setDoc(doc(db, 'usernames', editingEmployee.username), {
        uid: editingEmployee.uid,
        email: editingEmployee.email,
        active: editingEmployee.active !== false
      });

      setEditingEmployee(null);
      setNotification({ message: 'Perfil atualizado com sucesso!', type: 'success' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${editingEmployee.uid}`);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestão de Equipe</h2>
          <p className="text-slate-500">Controle de acessos e permissões dos funcionários.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={syncUsernames}
            disabled={isSyncing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-2xl font-bold transition-all flex items-center gap-2"
          >
            {isSyncing ? (
              <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            Sincronizar Acessos
          </button>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-amber-200 transition-all flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Novo Funcionário
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all"
            />
          </div>
          <div className="flex gap-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" /> Ativos
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-slate-300" /> Inativos
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                <th className="px-6 py-4">Funcionário</th>
                <th className="px-6 py-4">Nível de Acesso</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredEmployees.map(employee => (
                <tr key={employee.uid} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                        {employee.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{employee.name}</p>
                        <p className="text-xs text-slate-400">@{employee.username || employee.email.split('@')[0]}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={employee.role}
                      onChange={(e) => handleUpdateRole(employee.uid, e.target.value as UserRole)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold border-none focus:ring-2 focus:ring-amber-400 outline-none cursor-pointer",
                        employee.role === 'admin' ? "bg-purple-100 text-purple-700" :
                        employee.role === 'manager' ? "bg-blue-100 text-blue-700" :
                        "bg-slate-100 text-slate-700"
                      )}
                    >
                      <option value="cashier">Caixa</option>
                      <option value="manager">Gerente</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(employee.uid, employee.active !== false)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase transition-all",
                        employee.active !== false 
                          ? "bg-green-100 text-green-700 hover:bg-green-200" 
                          : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                      )}
                    >
                      {employee.active !== false ? (
                        <><CheckCircle2 className="w-3 h-3" /> Ativo</>
                      ) : (
                        <><XCircle className="w-3 h-3" /> Inativo</>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <button 
                      onClick={() => setActiveMenu(activeMenu === employee.uid ? null : employee.uid)}
                      className="p-2 text-slate-300 hover:text-slate-600 transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {activeMenu === employee.uid && (
                        <motion.div
                          ref={menuRef}
                          initial={{ opacity: 0, scale: 0.95, y: -10 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -10 }}
                          className="absolute right-6 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 py-2"
                        >
                          <button 
                            onClick={() => {
                              setEditingEmployee(employee);
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                            Editar Perfil
                          </button>
                          <button 
                            onClick={() => {
                              setViewingActivity(employee);
                              setActiveMenu(null);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <Activity className="w-4 h-4" />
                            Ver Atividade
                          </button>
                          <div className="h-px bg-slate-50 my-1" />
                          <button 
                            onClick={() => handleDeleteEmployee(employee.uid)}
                            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            Excluir
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-bold">Cadastrar Funcionário</h3>
                  <p className="text-slate-400 text-sm">Preencha os dados para gerar o acesso.</p>
                </div>
                <button onClick={() => setIsAddModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddEmployee} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Dados Pessoais */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Dados Pessoais</h4>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Nome Completo</label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          required
                          type="text"
                          value={newEmployee.name}
                          onChange={(e) => handleNameChange(e.target.value)}
                          placeholder="Nome do funcionário"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">CPF</label>
                      <div className="relative">
                        <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="text"
                          value={newEmployee.cpf}
                          onChange={(e) => setNewEmployee({ ...newEmployee, cpf: e.target.value })}
                          placeholder="000.000.000-00"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Telefone</label>
                      <div className="relative">
                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="tel"
                          value={newEmployee.phone}
                          onChange={(e) => setNewEmployee({ ...newEmployee, phone: e.target.value })}
                          placeholder="(00) 00000-0000"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Data de Nascimento</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="date"
                          value={newEmployee.birthDate}
                          onChange={(e) => setNewEmployee({ ...newEmployee, birthDate: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dados Profissionais */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Dados Profissionais</h4>
                    
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Cargo</label>
                      <div className="relative">
                        <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="text"
                          value={newEmployee.cargo}
                          onChange={(e) => setNewEmployee({ ...newEmployee, cargo: e.target.value })}
                          placeholder="Ex: Atendente, Caixa"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Nível de Acesso</label>
                      <div className="relative">
                        <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <select
                          value={newEmployee.role}
                          onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value as UserRole })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm appearance-none cursor-pointer"
                        >
                          <option value="cashier">Funcionário (Caixa/PDV)</option>
                          <option value="manager">Gerente</option>
                          <option value="admin">Administrador</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Data de Admissão</label>
                      <div className="relative">
                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          type="date"
                          value={newEmployee.admissionDate}
                          onChange={(e) => setNewEmployee({ ...newEmployee, admissionDate: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dados de Acesso */}
                <div className="space-y-4 pt-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-50 pb-2">Dados de Acesso (Login)</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1 flex items-center gap-1">
                        Usuário (Login)
                        <span className="text-[10px] font-normal text-slate-400 normal-case">(O que ele usará para entrar)</span>
                      </label>
                      <div className="relative">
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          required
                          type="text"
                          value={newEmployee.username}
                          onChange={(e) => {
                            const val = e.target.value.toLowerCase().replace(/\s/g, '');
                            setNewEmployee({ ...newEmployee, username: val, email: `${val}@flocomel.com` });
                          }}
                          placeholder="ex: joao.silva"
                          className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">Senha Inicial</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input
                          required
                          type={showPassword ? "text" : "password"}
                          value={newEmployee.password}
                          onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-12 py-3 bg-slate-50 border-2 border-transparent focus:border-amber-200 rounded-xl outline-none transition-all text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-amber-500 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-1">
                    <input
                      type="checkbox"
                      id="forcePass"
                      checked={newEmployee.forcePasswordChange}
                      onChange={(e) => setNewEmployee({ ...newEmployee, forcePasswordChange: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-200 text-amber-500 focus:ring-amber-500"
                    />
                    <label htmlFor="forcePass" className="text-xs text-slate-500 font-medium cursor-pointer">
                      Forçar troca de senha no primeiro login
                    </label>
                  </div>
                </div>

                <div className="flex gap-4 pt-6">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus className="w-5 h-5" />
                        Cadastrar Funcionário
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Employee Modal */}
      <AnimatePresence>
        {editingEmployee && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">Editar Funcionário</h3>
                <button onClick={() => setEditingEmployee(null)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nome Completo</label>
                  <input
                    required
                    type="text"
                    value={editingEmployee.name}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Usuário (Login)</label>
                  <input
                    required
                    type="text"
                    value={editingEmployee.username || ''}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase().replace(/\s/g, '');
                      setEditingEmployee({ 
                        ...editingEmployee, 
                        username: val
                      });
                    }}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                    placeholder="ex: joao.silva"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">CPF</label>
                  <input
                    type="text"
                    value={editingEmployee.cpf || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, cpf: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Telefone</label>
                  <input
                    type="text"
                    value={editingEmployee.phone || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nível de Acesso</label>
                  <select
                    value={editingEmployee.role}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as UserRole })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  >
                    <option value="cashier">Caixa</option>
                    <option value="manager">Gerente</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setEditingEmployee(null)}
                    className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-lg transition-all"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Activity Modal */}
      <AnimatePresence>
        {viewingActivity && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl max-h-[80vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center text-amber-700 font-bold text-xl">
                    {viewingActivity.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold">Atividade de {viewingActivity.name}</h3>
                    <p className="text-slate-500 text-sm">Últimas 50 vendas realizadas</p>
                  </div>
                </div>
                <button onClick={() => setViewingActivity(null)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pr-2">
                {loadingActivity ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 font-medium">Carregando atividades...</p>
                  </div>
                ) : employeeSales.length === 0 ? (
                  <div className="text-center py-20">
                    <Activity className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-400">Nenhuma atividade registrada para este funcionário.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {employeeSales.map((sale) => (
                      <div key={sale.id} className="bg-slate-50 p-4 rounded-2xl flex justify-between items-center border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-900">
                            {sale.items.map((it: any) => `${it.quantity}x ${it.name}`).join(', ')}
                          </p>
                          <p className="text-xs text-slate-400">
                            {sale.timestamp?.toDate ? sale.timestamp.toDate().toLocaleString('pt-BR') : new Date(sale.timestamp).toLocaleString('pt-BR')} • {sale.paymentMethods?.[0]?.method}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-black text-amber-600">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.total)}
                          </p>
                          <p className="text-[10px] text-slate-300 uppercase tracking-widest font-bold">Venda #{sale.id.substring(0, 6)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100">
                <button
                  onClick={() => setViewingActivity(null)}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-[32px] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6",
                confirmModal.type === 'danger' ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
              )}>
                {confirmModal.type === 'danger' ? <Trash2 className="w-8 h-8" /> : <Shield className="w-8 h-8" />}
              </div>
              
              <h3 className="text-xl font-bold text-slate-900 mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-8">{confirmModal.message}</p>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={cn(
                    "flex-1 py-4 text-white font-bold rounded-2xl shadow-lg transition-all",
                    confirmModal.type === 'danger' ? "bg-red-500 hover:bg-red-600 shadow-red-100" : "bg-amber-500 hover:bg-amber-600 shadow-amber-100"
                  )}
                >
                  Confirmar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-xl z-[300] flex items-center gap-3 font-bold text-sm",
              notification.type === 'success' ? "bg-green-600 text-white" : "bg-red-600 text-white"
            )}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Employees;
