import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  limit
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Sale, Product } from '../types';
import { LOGO_URL } from '../constants';
import { 
  TrendingUp, 
  ShoppingBag, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  IceCream
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { formatCurrency, cn } from '../lib/utils';
import { startOfDay, subDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'motion/react';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, color }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className={cn("p-3 rounded-2xl", color)}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend && (
        <div className={cn(
          "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg",
          trend === 'up' ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
        )}>
          {trend === 'up' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {trendValue}%
        </div>
      )}
    </div>
    <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
    <h3 className="text-2xl font-black text-slate-900">{value}</h3>
  </div>
);

const Dashboard: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [todaySales, setTodaySales] = useState<Sale[]>([]);

  useEffect(() => {
    const today = startOfDay(new Date());
    const qToday = query(collection(db, 'sales'), where('timestamp', '>=', today));
    
    const unsubscribeToday = onSnapshot(qToday, (snapshot) => {
      setTodaySales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const qAll = query(collection(db, 'sales'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));

    return () => {
      unsubscribeToday();
      unsubscribeProducts();
      unsubscribeAll();
    };
  }, []);

  const totalRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
  const ticketMedio = todaySales.length > 0 ? totalRevenue / todaySales.length : 0;
  
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const chartData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }).map((_, i) => {
      const date = subDays(new Date(), i);
      return format(date, 'yyyy-MM-dd');
    }).reverse();

    return last7Days.map(dateStr => {
      const daySales = sales.filter(s => {
        const sDate = s.timestamp?.toDate();
        return sDate && format(sDate, 'yyyy-MM-dd') === dateStr;
      });
      return {
        name: format(new Date(dateStr), 'EEE', { locale: ptBR }),
        total: daySales.reduce((sum, s) => sum + s.total, 0)
      };
    });
  }, [sales]);

  const topProducts = useMemo(() => {
    const counts: Record<string, { name: string, qty: number }> = {};
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!counts[item.productId]) counts[item.productId] = { name: item.name, qty: 0 };
        counts[item.productId].qty += item.quantity;
      });
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [sales]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Olá, Bem-vindo!</h2>
        <p className="text-slate-500">Aqui está o que está acontecendo na FlocoMel hoje.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Faturamento Hoje" 
          value={formatCurrency(totalRevenue)} 
          icon={DollarSign} 
          trend="up" 
          trendValue="12" 
          color="bg-green-500" 
        />
        <StatCard 
          title="Vendas Realizadas" 
          value={todaySales.length} 
          icon={ShoppingBag} 
          trend="up" 
          trendValue="8" 
          color="bg-blue-500" 
        />
        <StatCard 
          title="Ticket Médio" 
          value={formatCurrency(ticketMedio)} 
          icon={TrendingUp} 
          color="bg-amber-500" 
        />
        <StatCard 
          title="Produtos Ativos" 
          value={products.length} 
          icon={IceCream} 
          color="bg-purple-500" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm min-w-0">
          <h3 className="font-bold text-lg mb-8">Desempenho de Vendas (7 dias)</h3>
          <div className="w-full relative">
            {isMounted && (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} tickFormatter={(v) => `R$${v}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(v: number) => [formatCurrency(v), 'Vendas']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="font-bold text-lg mb-8">Mais Vendidos</h3>
          <div className="space-y-6">
            {topProducts.map((p, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center font-bold text-slate-400">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.qty / topProducts[0].qty) * 100}%` }}
                      className="bg-amber-400 h-full rounded-full"
                    />
                  </div>
                </div>
                <span className="text-xs font-black text-slate-400">{p.qty} un</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
