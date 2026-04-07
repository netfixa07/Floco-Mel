import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  updateDoc, 
  deleteDoc,
  doc, 
  query, 
  where,
  limit,
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { User, UserRole } from '../types';
import { 
  Shield, 
  User as UserIcon, 
  Mail, 
  CheckCircle2, 
  XCircle,
  MoreVertical,
  Search,
  Edit2,
  Trash2,
  Activity,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [viewingActivity, setViewingActivity] = useState<User | null>(null);
  const [employeeSales, setEmployeeSales] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleToggleActive = async (uid: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { active: !currentStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`);
    }
  };

  const handleDeleteEmployee = async (uid: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
      setActiveMenu(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    try {
      await updateDoc(doc(db, 'users', editingEmployee.uid), {
        name: editingEmployee.name,
        email: editingEmployee.email
      });
      setEditingEmployee(null);
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
                        <p className="text-xs text-slate-400">{employee.email}</p>
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
                  <label className="text-sm font-bold text-slate-700">E-mail</label>
                  <input
                    required
                    type="email"
                    value={editingEmployee.email}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
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
    </div>
  );
};

export default Employees;
