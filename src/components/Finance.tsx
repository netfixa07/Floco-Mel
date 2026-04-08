import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  query, 
  orderBy,
  serverTimestamp,
  where,
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Expense, Sale } from '../types';
import { 
  Plus, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Filter,
  Calendar,
  DollarSign,
  PieChart as PieChartIcon,
  X,
  AlertTriangle,
  Bell
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip,
  Legend
} from 'recharts';
import { startOfMonth, endOfMonth, format } from 'date-fns';

const Finance: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [showDiscrepancyAlert, setShowDiscrepancyAlert] = useState<any>(null);
  const [formData, setFormData] = useState<Partial<Expense>>({
    description: '',
    amount: 0,
    category: 'variable',
    date: format(new Date(), 'yyyy-MM-dd'),
    status: 'paid'
  });

  useEffect(() => {
    const unsubscribeExpenses = onSnapshot(
      query(collection(db, 'expenses'), orderBy('date', 'desc')), 
      (snapshot) => {
        setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
      }, 
      (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
    );

    const start = startOfMonth(new Date());
    const qSales = query(
      collection(db, 'sales'), 
      where('timestamp', '>=', start),
      orderBy('timestamp', 'desc')
    );
    const unsubscribeSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const qAudit = query(
      collection(db, 'audit_log'),
      where('actionType', 'in', ['CASH_SESSION_DISCREPANCY', 'INVENTORY_DISCREPANCY']),
      orderBy('timestamp', 'desc'),
      limit(50)
    );

    const unsubscribeAudit = onSnapshot(qAudit, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAuditLogs(logs);

      // Check for new discrepancies to alert (last 1 minute)
      const now = new Date().getTime();
      const newDiscrepancy = logs.find((log: any) => {
        const logTime = log.timestamp?.toDate().getTime();
        return logTime && (now - logTime) < 60000; // 1 minute
      });

      if (newDiscrepancy) {
        setShowDiscrepancyAlert(newDiscrepancy);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'audit_log'));

    return () => {
      unsubscribeExpenses();
      unsubscribeSales();
      unsubscribeAudit();
    };
  }, []);

  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + s.total, 0), [sales]);
  const totalExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const netProfit = totalRevenue - totalExpenses;

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const expenseByCategory = useMemo(() => {
    const data: Record<string, number> = {};
    expenses.forEach(e => {
      data[e.category] = (data[e.category] || 0) + e.amount;
    });
    return Object.entries(data).map(([name, value]) => ({ name, value }));
  }, [expenses]);

  const COLORS = ['#f59e0b', '#ef4444', '#3b82f6'];

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'expenses'), formData);
      setIsAddingExpense(false);
      setFormData({ description: '', amount: 0, category: 'variable', date: format(new Date(), 'yyyy-MM-dd'), status: 'paid' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'expenses');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Gestão Financeira</h2>
          <p className="text-slate-500">Controle total de entradas, saídas e lucratividade.</p>
        </div>
        <button
          onClick={() => setIsAddingExpense(true)}
          className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-lg hover:bg-slate-800 transition-all"
        >
          <Plus className="w-5 h-5" />
          Registrar Despesa
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 rounded-2xl text-green-600">
              <ArrowUpCircle className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Receita (Mês)</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">{formatCurrency(totalRevenue)}</h3>
        </div>
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-100 rounded-2xl text-red-600">
              <ArrowDownCircle className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Despesas (Mês)</span>
          </div>
          <h3 className="text-3xl font-black text-slate-900">{formatCurrency(totalExpenses)}</h3>
        </div>
        <div className="bg-amber-500 p-8 rounded-3xl shadow-lg shadow-amber-200 text-white">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/20 rounded-2xl text-white">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-sm font-bold text-white/80 uppercase tracking-widest">Lucro Líquido</span>
          </div>
          <h3 className="text-3xl font-black">{formatCurrency(netProfit)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Discrepancy History */}
        <div className="lg:col-span-12 bg-white rounded-3xl border border-red-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-red-50 bg-red-50/30 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="font-bold text-lg text-red-900">Alertas de Divergência</h3>
            </div>
            <span className="text-xs font-bold text-red-600 uppercase tracking-widest bg-red-100 px-3 py-1 rounded-full">
              {auditLogs.length} Registros
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Área</th>
                  <th className="px-6 py-4">Funcionário</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-right">Valor/Diferença</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      Nenhuma divergência registrada recentemente.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-red-50/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'dd/MM/yyyy') : '-'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm') : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                          log.actionType === 'CASH_SESSION_DISCREPANCY' ? "bg-amber-100 text-amber-700" : "bg-purple-100 text-purple-700"
                        )}>
                          {log.actionType === 'CASH_SESSION_DISCREPANCY' ? 'Caixa' : 'Estoque'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">{log.userName || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-slate-500 max-w-xs">
                          {log.actionType === 'CASH_SESSION_DISCREPANCY' 
                            ? `Diferença no fechamento do caixa #${log.details?.sessionId?.substring(0,6)}`
                            : `Ajuste manual de estoque: ${log.details?.productName}`}
                        </p>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-right font-black",
                        (log.details?.difference || 0) < 0 ? "text-red-600" : "text-green-600"
                      )}>
                        {formatCurrency(log.details?.difference || log.details?.quantity || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sales History */}
        <div className="lg:col-span-12 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-lg">Histórico de Vendas (Mês Atual)</h3>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full">
              {sales.length} Vendas
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Data/Hora</th>
                  <th className="px-6 py-4">Atendente</th>
                  <th className="px-6 py-4">Pagamento</th>
                  <th className="px-6 py-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {sales.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      Nenhuma venda registrada este mês.
                    </td>
                  </tr>
                ) : (
                  sales.map(sale => (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">
                            {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'dd/MM/yyyy') : '-'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {sale.timestamp?.toDate ? format(sale.timestamp.toDate(), 'HH:mm') : '-'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-600">{sale.cashierName || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {sale.paymentMethods.map((p, i) => {
                            let label = p.method.toUpperCase();
                            if (p.method === 'card') {
                              label = `${p.cardType === 'debit' ? 'DÉB' : 'CRÉD'}${p.creditType === 'installments' ? ` ${p.installments}x` : ''}`;
                            }
                            return (
                              <span key={i} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-bold">
                                {label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-green-600">
                        {formatCurrency(sale.total)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expenses List */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50 flex justify-between items-center">
            <h3 className="font-bold text-lg">Últimas Movimentações</h3>
            <button className="text-slate-400 hover:text-slate-600">
              <Filter className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4">Categoria</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900">{expense.description}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-medium text-slate-500 capitalize">{expense.category}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{expense.date}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        expense.status === 'paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {expense.status === 'paid' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-red-500">-{formatCurrency(expense.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Chart */}
        <div className="lg:col-span-4 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-w-0">
          <h3 className="font-bold text-lg mb-8">Despesas por Categoria</h3>
          <div className="w-full relative">
            {isMounted && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseByCategory.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showDiscrepancyAlert && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[200] p-4">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              className="bg-white rounded-[40px] p-10 w-full max-w-lg shadow-2xl border-4 border-red-100 text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
              
              <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse">
                <AlertTriangle className="w-12 h-12 text-red-600" />
              </div>
              
              <h3 className="text-3xl font-black text-slate-900 mb-4 uppercase tracking-tight">
                Alerta de Divergência!
              </h3>
              
              <div className="bg-slate-50 rounded-3xl p-6 mb-8 text-left space-y-3 border border-slate-100">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Área</span>
                  <span className="font-black text-red-600">
                    {showDiscrepancyAlert.actionType === 'CASH_SESSION_DISCREPANCY' ? 'CAIXA' : 'ESTOQUE'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Funcionário</span>
                  <span className="font-bold text-slate-900">{showDiscrepancyAlert.userName}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-400 uppercase">Valor/Diferença</span>
                  <span className="font-black text-red-600">
                    {formatCurrency(showDiscrepancyAlert.details?.difference || showDiscrepancyAlert.details?.quantity || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">Data/Hora</span>
                  <span className="text-sm font-medium text-slate-600">
                    {showDiscrepancyAlert.timestamp?.toDate().toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowDiscrepancyAlert(null)}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 shadow-xl transition-all flex items-center justify-center gap-3"
              >
                <Bell className="w-6 h-6" />
                Ciente do Ocorrido
              </button>
            </motion.div>
          </div>
        )}

        {isAddingExpense && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">Nova Despesa</h3>
                <button onClick={() => setIsAddingExpense(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Descrição</label>
                  <input
                    required
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                    placeholder="Ex: Aluguel, Compra de Leite..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Valor (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Categoria</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  >
                    <option value="fixed">Fixa (Aluguel, Luz, etc)</option>
                    <option value="variable">Variável (Manutenção, etc)</option>
                    <option value="stock">Estoque (Insumos)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Data</label>
                  <input
                    required
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setIsAddingExpense(false)}
                    className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-lg transition-all"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Finance;
