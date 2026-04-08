import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, logAudit } from '../firebase';
import { Product, InventoryLog } from '../types';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Filter,
  Search,
  Package,
  History,
  Check,
  X
} from 'lucide-react';
import { cn, formatCurrency, formatDate } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import { useAuth } from '../App';

const Inventory: React.FC = () => {
  const { user } = useAuth();
  const isReadOnly = user?.role === 'cashier';
  const [products, setProducts] = useState<Product[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingStock, setAdjustingStock] = useState<Product | null>(null);
  const [viewingLogs, setViewingLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Form states
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '',
    price: 0,
    cost: 0,
    unit: 'un',
    stockLevel: 0,
    minStock: 5,
    isIngredient: false
  });
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState('');

  useEffect(() => {
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    const qLogs = query(collection(db, 'inventory_logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryLog)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_logs'));

    return () => {
      unsubscribeProducts();
      unsubscribeLogs();
    };
  }, []);

  const categories = ['Todos', ...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        if (editingProduct.price !== formData.price) {
          await logAudit('PRODUCT_PRICE_CHANGE', {
            productId: editingProduct.id,
            productName: editingProduct.name,
            oldPrice: editingProduct.price,
            newPrice: formData.price
          });
        }
        await updateDoc(doc(db, 'products', editingProduct.id), formData);
      } else {
        await addDoc(collection(db, 'products'), formData);
      }
      setIsAddingProduct(false);
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: 0, cost: 0, unit: 'un', stockLevel: 0, minStock: 5, isIngredient: false });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustingStock) return;
    try {
      const newStock = (adjustingStock.stockLevel || 0) + adjustmentQty;
      await updateDoc(doc(db, 'products', adjustingStock.id), {
        stockLevel: newStock
      });

      await addDoc(collection(db, 'inventory_logs'), {
        productId: adjustingStock.id,
        productName: adjustingStock.name,
        type: adjustmentQty > 0 ? 'entry' : 'adjustment',
        quantity: adjustmentQty,
        reason: adjustmentReason,
        timestamp: serverTimestamp(),
        userId: auth.currentUser?.uid
      });

      if (adjustmentQty < 0 && adjustmentReason.toLowerCase().includes('perda') || adjustmentReason.toLowerCase().includes('erro')) {
        await logAudit('INVENTORY_DISCREPANCY', {
          productId: adjustingStock.id,
          productName: adjustingStock.name,
          quantity: adjustmentQty,
          reason: adjustmentReason
        });
      }

      setAdjustingStock(null);
      setAdjustmentQty(0);
      setAdjustmentReason('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory_logs');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${id}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Estoque Inteligente</h2>
          <p className="text-slate-500">Gerencie seus produtos e insumos em tempo real.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setViewingLogs(!viewingLogs)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all",
              viewingLogs ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            )}
          >
            <History className="w-5 h-5" />
            Histórico
          </button>
          {!isReadOnly && (
            <button
              onClick={() => setIsAddingProduct(true)}
              className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-200 hover:bg-amber-600 transition-all"
            >
              <Plus className="w-5 h-5" />
              Novo Produto
            </button>
          )}
        </div>
      </div>

      {viewingLogs ? (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-bold text-lg">Histórico de Movimentações</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-widest font-bold">
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Quantidade</th>
                  <th className="px-6 py-4">Motivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500">{formatDate(log.timestamp?.toDate() || new Date())}</td>
                    <td className="px-6 py-4 font-bold text-slate-900">{log.productName}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase",
                        log.type === 'entry' ? "bg-green-100 text-green-700" :
                        log.type === 'sale' ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {log.type}
                      </span>
                    </td>
                    <td className={cn(
                      "px-6 py-4 font-bold",
                      log.quantity > 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{log.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Filters & Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Pesquisar no estoque..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
                      selectedCategory === cat 
                        ? "bg-amber-500 text-white shadow-md shadow-amber-100" 
                        : "bg-white border border-slate-200 text-slate-600 hover:border-amber-200"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
            <div className="lg:col-span-4">
              <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-4">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-red-900">
                    {products.filter(p => (p.stockLevel || 0) <= (p.minStock || 0)).length} Produtos em Alerta
                  </p>
                  <p className="text-xs text-red-600">Reposição necessária imediata.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map(product => (
              <div key={product.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                      <Package className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{product.name}</h4>
                      <p className="text-xs text-slate-400 uppercase tracking-widest font-bold">{product.category}</p>
                    </div>
                  </div>
                  {!isReadOnly && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => {
                          setEditingProduct(product);
                          setFormData(product);
                          setIsAddingProduct(true);
                        }}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Preço Venda</p>
                    <p className="font-black text-slate-900">{formatCurrency(product.price)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-2xl">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Custo Médio</p>
                    <p className="font-black text-slate-900">{formatCurrency(product.cost || 0)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-50">
                  <div>
                    <p className="text-xs text-slate-500 font-medium">Estoque Atual</p>
                    <p className={cn(
                      "text-2xl font-black",
                      (product.stockLevel || 0) <= (product.minStock || 0) ? "text-red-500" : "text-slate-900"
                    )}>
                      {product.stockLevel} <span className="text-xs font-bold text-slate-400">{product.unit}</span>
                    </p>
                  </div>
                  {!isReadOnly && (
                    <button
                      onClick={() => setAdjustingStock(product)}
                      className="bg-white border border-slate-200 p-2 rounded-xl shadow-sm hover:border-amber-400 hover:text-amber-600 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      <AnimatePresence>
        {(isAddingProduct || editingProduct) && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-bold">{editingProduct ? 'Editar Produto' : 'Novo Produto'}</h3>
                <button onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Nome do Produto</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Categoria</label>
                  <input
                    required
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                    placeholder="Ex: Sorvetes, Açaí, Coberturas"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Preço de Venda (R$)</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Custo (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Unidade</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  >
                    <option value="un">Unidade (un)</option>
                    <option value="kg">Quilo (kg)</option>
                    <option value="lt">Litro (lt)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Estoque Mínimo</label>
                  <input
                    type="number"
                    value={formData.minStock}
                    onChange={(e) => setFormData({ ...formData, minStock: Number(e.target.value) })}
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-3 bg-amber-50 p-4 rounded-2xl">
                  <input
                    type="checkbox"
                    id="isIngredient"
                    checked={formData.isIngredient}
                    onChange={(e) => setFormData({ ...formData, isIngredient: e.target.checked })}
                    className="w-5 h-5 accent-amber-500"
                  />
                  <label htmlFor="isIngredient" className="text-sm font-bold text-amber-900">
                    Este produto é um insumo/ingrediente (não aparece no PDV)
                  </label>
                </div>

                <div className="md:col-span-2 flex gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => { setIsAddingProduct(false); setEditingProduct(null); }}
                    className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all"
                  >
                    {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {adjustingStock && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-2">Ajustar Estoque</h3>
              <p className="text-slate-500 mb-6">{adjustingStock.name}</p>
              
              <div className="space-y-6 mb-8">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Quantidade (Use negativo para saída)</label>
                  <input
                    type="number"
                    value={adjustmentQty}
                    onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                    className="w-full px-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none text-xl font-bold"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">Motivo do Ajuste</label>
                  <input
                    type="text"
                    value={adjustmentReason}
                    onChange={(e) => setAdjustmentReason(e.target.value)}
                    placeholder="Ex: Compra, Perda, Erro de contagem"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none transition-all"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAdjustingStock(null)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdjustStock}
                  className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all"
                >
                  Confirmar Ajuste
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Inventory;
