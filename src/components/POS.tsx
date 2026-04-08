import React, { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Product, Sale, SaleItem, CashSession, PaymentMethod } from '../types';
import { LOGO_URL } from '../constants';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  Banknote, 
  QrCode, 
  CheckCircle2,
  AlertCircle,
  X,
  Lock,
  Unlock,
  Receipt,
  IceCream,
  ShoppingCart
} from 'lucide-react';
import { cn, formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

const POS: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [isOpeningSession, setIsOpeningSession] = useState(false);
  const [isClosingSession, setIsClosingSession] = useState(false);
  const [initialValue, setInitialValue] = useState(0);
  const [closingValue, setClosingValue] = useState(0);
  const [isProcessingSale, setIsProcessingSale] = useState(false);
  const [showReceipt, setShowReceipt] = useState<Sale | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: 'error' | 'success' } | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayments, setSelectedPayments] = useState<PaymentMethod[]>([]);
  const [cashReceived, setCashReceived] = useState(0);

  // Totals
  const cartTotal = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const addPaymentMethod = () => {
    const currentTotal = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = Math.max(0, cartTotal - currentTotal);
    setSelectedPayments([...selectedPayments, { method: 'pix', amount: remaining }]);
  };

  const removePaymentMethod = (index: number) => {
    setSelectedPayments(selectedPayments.filter((_, i) => i !== index));
  };

  const updatePaymentAmount = (index: number, amount: number) => {
    const newPayments = [...selectedPayments];
    newPayments[index].amount = amount;
    setSelectedPayments(newPayments);
  };

  const updatePaymentMethod = (index: number, method: 'cash' | 'pix' | 'card') => {
    const newPayments = [...selectedPayments];
    newPayments[index].method = method;
    if (method === 'card') {
      newPayments[index].cardType = 'debit';
      newPayments[index].creditType = 'one-time';
      newPayments[index].installments = 1;
    } else {
      delete newPayments[index].cardType;
      delete newPayments[index].creditType;
      delete newPayments[index].installments;
    }
    setSelectedPayments(newPayments);
  };

  const updateCardDetails = (index: number, details: Partial<PaymentMethod>) => {
    const newPayments = [...selectedPayments];
    newPayments[index] = { ...newPayments[index], ...details };
    setSelectedPayments(newPayments);
  };

  const totalPaid = selectedPayments.reduce((sum, p) => sum + p.amount, 0);
  const isPaymentValid = Math.abs(totalPaid - cartTotal) < 0.01;

  const hasCashPayment = selectedPayments.some(p => p.method === 'cash');
  const totalCashToPay = selectedPayments.filter(p => p.method === 'cash').reduce((sum, p) => sum + p.amount, 0);
  const change = Math.max(0, cashReceived - totalCashToPay);

  // Categories
  const categories = useMemo(() => {
    const cats = ['Todos', ...new Set(products.map(p => p.category))];
    return cats;
  }, [products]);

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'Todos' || p.category === selectedCategory;
    return matchesSearch && matchesCategory && !p.isIngredient;
  });

  // Totals

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    // Listen for products
    const unsubscribeProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'products'));

    // Listen for active session
    const q = query(
      collection(db, 'cash_sessions'), 
      where('cashierId', '==', auth.currentUser?.uid),
      where('status', '==', 'open')
    );
    const unsubscribeSession = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const session = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as CashSession;
        setActiveSession(session);
        setClosingValue(session.expectedValue || 0);
      } else {
        setActiveSession(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'cash_sessions'));

    return () => {
      unsubscribeProducts();
      unsubscribeSession();
    };
  }, []);

  const addToCart = (product: Product) => {
    if (product.stockLevel !== undefined && product.stockLevel <= 0) {
      setNotification({ message: 'Produto sem estoque disponível!', type: 'error' });
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (product.stockLevel !== undefined && existing.quantity >= product.stockLevel) {
          setNotification({ message: 'Quantidade máxima em estoque atingida!', type: 'error' });
          return prev;
        }
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * item.price }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        subtotal: product.price
      }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    const product = products.find(p => p.id === productId);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (product && product.stockLevel !== undefined && newQty > product.stockLevel) {
          setNotification({ message: 'Quantidade máxima em estoque atingida!', type: 'error' });
          return item;
        }
        return { ...item, quantity: newQty, subtotal: newQty * item.price };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setShowClearConfirm(false);
  };

  const openSession = async () => {
    try {
      await addDoc(collection(db, 'cash_sessions'), {
        startTime: serverTimestamp(),
        initialValue,
        status: 'open',
        cashierId: auth.currentUser?.uid,
        cashierName: auth.currentUser?.displayName || 'Atendente',
        totalSales: 0,
        expectedValue: initialValue
      });
      setIsOpeningSession(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'cash_sessions');
    }
  };

  const closeSession = async () => {
    if (!activeSession) return;
    try {
      const expected = activeSession.expectedValue || 0;
      await updateDoc(doc(db, 'cash_sessions', activeSession.id), {
        endTime: serverTimestamp(),
        finalValue: closingValue,
        status: 'closed',
        difference: closingValue - expected
      });
      setIsClosingSession(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `cash_sessions/${activeSession.id}`);
    }
  };

  const processSale = async (methods: PaymentMethod[]) => {
    if (!activeSession || cart.length === 0) return;
    setIsProcessingSale(true);
    try {
      const saleData = {
        items: cart,
        total: cartTotal,
        paymentMethods: methods,
        timestamp: serverTimestamp(),
        cashierId: auth.currentUser?.uid,
        cashierName: auth.currentUser?.displayName || 'Atendente',
        sessionId: activeSession.id
      };

      const saleRef = await addDoc(collection(db, 'sales'), saleData);
      
      // Update inventory and session
      const batch = writeBatch(db);
      
      // Update session totals
      batch.update(doc(db, 'cash_sessions', activeSession.id), {
        totalSales: (activeSession.totalSales || 0) + cartTotal,
        expectedValue: (activeSession.expectedValue || 0) + cartTotal
      });

      // Update product stock
      for (const item of cart) {
        const product = products.find(p => p.id === item.productId);
        if (product && product.stockLevel !== undefined) {
          batch.update(doc(db, 'products', item.productId), {
            stockLevel: product.stockLevel - item.quantity
          });
          
          // Log inventory movement
          const logRef = doc(collection(db, 'inventory_logs'));
          batch.set(logRef, {
            productId: item.productId,
            productName: item.name,
            type: 'sale',
            quantity: -item.quantity,
            timestamp: serverTimestamp(),
            userId: auth.currentUser?.uid
          });
        }
      }

      await batch.commit();
      
      setShowReceipt({ id: saleRef.id, ...saleData } as any);
      setCart([]);
      setIsPaymentModalOpen(false);
      setSelectedPayments([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'sales');
    } finally {
      setIsProcessingSale(false);
    }
  };

  const handlePrint = (sale: Sale | null) => {
    if (!sale) return;
    
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      iframe.style.visibility = 'hidden';
      document.body.appendChild(iframe);

      const itemsHtml = sale.items.map(item => `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span>${item.quantity}x ${item.name}</span>
          <span>${formatCurrency(item.subtotal)}</span>
        </div>
      `).join('');

      const content = `
        <html>
          <head>
            <title>Cupom de Venda - FlocoMel</title>
            <style>
              @page { margin: 0; }
              body { 
                font-family: 'Courier New', Courier, monospace; 
                width: 80mm; 
                margin: 0; 
                padding: 15px; 
                font-size: 12px;
                color: #000;
                line-height: 1.2;
              }
              .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
              .header h1 { margin: 0; font-size: 16px; text-transform: uppercase; }
              .header p { margin: 2px 0; }
              .items { margin: 10px 0; }
              .total { margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px; font-weight: bold; font-size: 14px; }
              .footer { margin-top: 20px; text-align: center; font-size: 10px; border-top: 1px solid #eee; padding-top: 10px; }
              @media print {
                body { width: 80mm; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>FlocoMel Sorvetes</h1>
              <p>Comprovante de Venda</p>
              <p>${new Date(sale.timestamp?.toDate ? sale.timestamp.toDate() : new Date()).toLocaleString('pt-BR')}</p>
            </div>
            <div class="items">
              ${itemsHtml}
            </div>
            <div class="total">
              <div style="display: flex; justify-content: space-between;">
                <span>TOTAL:</span>
                <span>${formatCurrency(sale.total)}</span>
              </div>
            </div>
            <div style="margin-top: 10px; font-size: 10px;">
              <p style="margin: 2px 0;"><strong>PAGAMENTOS:</strong></p>
              ${sale.paymentMethods.map(p => {
                let details = p.method.toUpperCase();
                if (p.method === 'card') {
                  details += ` (${p.cardType === 'debit' ? 'DÉBITO' : 'CRÉDITO'})`;
                  if (p.cardType === 'credit') {
                    details += p.creditType === 'one-time' ? ' À VISTA' : ` ${p.installments}X`;
                  }
                }
                return `<div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                  <span>${details}</span>
                  <span>${formatCurrency(p.amount)}</span>
                </div>`;
              }).join('')}
              <p style="margin: 8px 0 2px 0;">Atendente: ${sale.cashierName || 'N/A'}</p>
              <p style="margin: 2px 0;">ID Venda: ${sale.id?.substring(0, 8) || ''}</p>
            </div>
            <div class="footer">
              <p>Obrigado pela preferência!</p>
              <p>www.flocomel.com.br</p>
            </div>
            <script>
              window.onload = function() {
                window.focus();
                window.print();
                setTimeout(function() { window.close(); }, 100);
              };
            </script>
          </body>
        </html>
      `;

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(content);
        doc.close();

        // Wait for content to load and then print
        iframe.onload = () => {
          setTimeout(() => {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
            
            // Cleanup after printing
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
            }, 1000);
          }, 500);
        };
      }
    } catch (error) {
      console.error('Erro ao imprimir:', error);
      setNotification({ message: 'Erro ao gerar impressão. Tente novamente.', type: 'error' });
    }
  };

  if (!activeSession) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-6">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Caixa Fechado</h2>
        <p className="text-slate-500 mb-8 max-w-md">
          Para iniciar as vendas, você precisa abrir o caixa informando o valor inicial em dinheiro.
        </p>
        <button
          onClick={() => setIsOpeningSession(true)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-amber-200 transition-all"
        >
          Abrir Caixa Agora
        </button>

        <AnimatePresence>
          {isOpeningSession && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
              >
                <h3 className="text-xl font-bold mb-6">Abertura de Caixa</h3>
                <div className="space-y-4 mb-8">
                  <label className="block text-sm font-medium text-slate-700">Valor Inicial em Dinheiro (Troco)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                    <input
                      type="number"
                      value={initialValue}
                      onChange={(e) => setInitialValue(Number(e.target.value))}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none text-xl font-bold"
                      placeholder="0,00"
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setIsOpeningSession(false)}
                    className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={openSession}
                    className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all"
                  >
                    Confirmar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full">
      {/* Products Section */}
      <div className="lg:col-span-8 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-amber-400 outline-none transition-all"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto">
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

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-amber-100 transition-all text-left flex flex-col h-full group"
            >
              <div className="w-full aspect-square bg-amber-50 rounded-2xl mb-4 flex items-center justify-center overflow-hidden">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <IceCream className="w-10 h-10 text-amber-200 group-hover:text-amber-400 transition-colors" />
                )}
              </div>
              <h4 className="font-bold text-slate-900 mb-1 line-clamp-2 flex-1">{product.name}</h4>
              <p className="text-amber-600 font-black text-lg">{formatCurrency(product.price)}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-slate-50 px-2 py-0.5 rounded-full">
                  {product.category}
                </span>
                {product.stockLevel !== undefined && (
                  <span className={cn(
                    "text-[10px] font-bold",
                    product.stockLevel <= (product.minStock || 0) ? "text-red-500" : "text-slate-400"
                  )}>
                    Esq: {product.stockLevel}
                  </span>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Cart Section */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-amber-900/5 flex flex-col h-[calc(100vh-12rem)] sticky top-8">
          <div className="p-6 border-b border-slate-50 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">Carrinho</h3>
              <p className="text-xs text-slate-400">Atendente: {activeSession.cashierName}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => cart.length > 0 && setShowClearConfirm(true)}
                className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                title="Limpar Carrinho"
              >
                <Trash2 className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setIsClosingSession(true)}
                className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                title="Fechar Caixa"
              >
                <Unlock className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center">
                <ShoppingCart className="w-12 h-12 mb-4 opacity-20" />
                <p className="font-medium">Carrinho vazio</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.productId} className="flex gap-4 group">
                  <div className="flex-1">
                    <h5 className="font-bold text-sm text-slate-900 line-clamp-1">{item.name}</h5>
                    <p className="text-xs text-slate-400">{formatCurrency(item.price)} / un</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center bg-slate-50 rounded-lg p-1">
                      <button 
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="p-1 hover:bg-white rounded shadow-sm transition-all"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="p-1 hover:bg-white rounded shadow-sm transition-all"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-6 bg-slate-50/50 border-t border-slate-50 rounded-b-3xl">
            <div className="flex justify-between items-center mb-6">
              <span className="text-slate-500 font-medium">Total</span>
              <span className="text-3xl font-black text-slate-900">{formatCurrency(cartTotal)}</span>
            </div>

            <button
              disabled={cart.length === 0 || isProcessingSale}
              onClick={() => {
                setSelectedPayments([{ method: 'cash', amount: cartTotal }]);
                setCashReceived(cartTotal);
                setIsPaymentModalOpen(true);
              }}
              className="w-full py-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl font-black shadow-lg shadow-amber-200 transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Finalizar Venda
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isPaymentModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-lg shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Formas de Pagamento</h3>
                <button onClick={() => setIsPaymentModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl">
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4 mb-8">
                <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl">
                  <span className="text-slate-500 font-medium">Total da Venda</span>
                  <span className="text-xl font-black text-slate-900">{formatCurrency(cartTotal)}</span>
                </div>

                <div className="space-y-3">
                  {selectedPayments.map((payment, index) => (
                    <div key={index} className="flex gap-3 items-center bg-white border border-slate-100 p-3 rounded-2xl shadow-sm">
                      <div className="flex flex-col gap-3 flex-1">
                        <div className="flex gap-3 items-center">
                          <select 
                            value={payment.method}
                            onChange={(e) => updatePaymentMethod(index, e.target.value as any)}
                            className="bg-slate-50 border-none rounded-xl px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                          >
                            <option value="cash">Dinheiro</option>
                            <option value="pix">PIX</option>
                            <option value="card">Cartão</option>
                          </select>
                          
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">R$</span>
                            <input 
                              type="number"
                              value={payment.amount}
                              onChange={(e) => updatePaymentAmount(index, Number(e.target.value))}
                              className="w-full pl-8 pr-3 py-2 bg-slate-50 border-none rounded-xl text-sm font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                            />
                          </div>

                          {selectedPayments.length > 1 && (
                            <button 
                              onClick={() => removePaymentMethod(index)}
                              className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {payment.method === 'card' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                            <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Tipo de Cartão</label>
                              <select 
                                value={payment.cardType}
                                onChange={(e) => updateCardDetails(index, { cardType: e.target.value as any })}
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                              >
                                <option value="debit">Débito</option>
                                <option value="credit">Crédito</option>
                              </select>
                            </div>

                            {payment.cardType === 'credit' && (
                              <>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Modalidade</label>
                                  <select 
                                    value={payment.creditType}
                                    onChange={(e) => updateCardDetails(index, { creditType: e.target.value as any })}
                                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                                  >
                                    <option value="one-time">À Vista</option>
                                    <option value="installments">Parcelado</option>
                                  </select>
                                </div>

                                {payment.creditType === 'installments' && (
                                  <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Parcelas</label>
                                    <select 
                                      value={payment.installments}
                                      onChange={(e) => updateCardDetails(index, { installments: Number(e.target.value) })}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-amber-400 outline-none"
                                    >
                                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                                        <option key={n} value={n}>{n}x</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={addPaymentMethod}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-sm hover:border-amber-200 hover:text-amber-500 hover:bg-amber-50 transition-all flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Outra Forma
                </button>

                <div className={cn(
                  "p-4 rounded-2xl flex justify-between items-center font-bold",
                  isPaymentValid ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                )}>
                  <span>Total Pago:</span>
                  <div className="text-right">
                    <p>{formatCurrency(totalPaid)}</p>
                    {!isPaymentValid && (
                      <p className="text-[10px] uppercase tracking-wider">
                        {totalPaid < cartTotal ? `Faltam ${formatCurrency(cartTotal - totalPaid)}` : `Sobra ${formatCurrency(totalPaid - cartTotal)}`}
                      </p>
                    )}
                  </div>
                </div>

                {hasCashPayment && isPaymentValid && (
                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-wider">Valor Recebido (Dinheiro)</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                        <input 
                          type="number"
                          value={cashReceived}
                          onChange={(e) => setCashReceived(Number(e.target.value))}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none text-xl font-bold"
                          placeholder="0,00"
                        />
                      </div>
                    </div>

                    {cashReceived > totalCashToPay && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-amber-50 p-4 rounded-2xl flex justify-between items-center border border-amber-100"
                      >
                        <span className="text-amber-700 font-bold">Troco a devolver:</span>
                        <span className="text-2xl font-black text-amber-900">{formatCurrency(change)}</span>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  disabled={!isPaymentValid || isProcessingSale}
                  onClick={() => processSale(selectedPayments)}
                  className="flex-1 py-4 bg-amber-500 text-white font-bold rounded-2xl hover:bg-amber-600 shadow-lg shadow-amber-100 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessingSale ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      Confirmar Pagamento
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isClosingSession && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl"
            >
              <h3 className="text-xl font-bold mb-4">Fechar Caixa</h3>
              <p className="text-slate-500 mb-6">
                Você está prestes a encerrar o turno. Informe o valor total em dinheiro presente na gaveta agora:
              </p>
              
              <div className="space-y-4 mb-8">
                <div className="bg-amber-50 p-4 rounded-2xl flex justify-between items-center">
                  <span className="text-sm text-amber-700 font-medium">Valor Esperado</span>
                  <span className="font-black text-amber-900">{formatCurrency(activeSession.expectedValue || 0)}</span>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">R$</span>
                  <input
                    type="number"
                    value={closingValue}
                    onChange={(e) => setClosingValue(Number(e.target.value))}
                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-amber-400 outline-none text-xl font-bold"
                    placeholder="0,00"
                  />
                </div>

                {closingValue !== (activeSession.expectedValue || 0) && (
                  <div className={cn(
                    "p-3 rounded-xl text-xs font-bold text-center",
                    closingValue > (activeSession.expectedValue || 0) ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
                  )}>
                    Diferença: {formatCurrency(closingValue - (activeSession.expectedValue || 0))}
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsClosingSession(false)}
                  className="flex-1 py-4 font-bold text-slate-500 hover:bg-slate-50 rounded-2xl transition-colors"
                >
                  Voltar
                </button>
                <button
                  onClick={closeSession}
                  className="flex-1 py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 shadow-lg shadow-red-100 transition-all"
                >
                  Encerrar Turno
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showReceipt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-sm shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-amber-400" />
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Venda Realizada!</h3>
                <p className="text-slate-400 text-sm">Comprovante Digital</p>
              </div>

              <div className="space-y-3 mb-8 border-y border-slate-100 py-6">
                {showReceipt.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-slate-600">{item.quantity}x {item.name}</span>
                    <span className="font-bold">{formatCurrency(item.subtotal)}</span>
                  </div>
                ))}
                <div className="pt-4 flex justify-between items-center border-t border-slate-50">
                  <span className="font-bold text-slate-900">Total Pago</span>
                  <span className="text-xl font-black text-amber-600">{formatCurrency(showReceipt.total)}</span>
                </div>
                <div className="text-[10px] text-slate-400 text-center pt-4 uppercase tracking-widest">
                  {showReceipt.paymentMethods[0].method} • {new Date().toLocaleTimeString()}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowReceipt(null)}
                  className="w-full py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all cursor-pointer"
                >
                  Nova Venda
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => handlePrint(showReceipt)}
                  className="w-full py-4 bg-amber-100 text-amber-900 font-bold rounded-2xl hover:bg-amber-200 transition-all flex items-center justify-center gap-2 border-2 border-amber-200 shadow-sm cursor-pointer"
                >
                  <Receipt className="w-5 h-5" />
                  Imprimir Cupom
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}

        {showClearConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl p-8 w-full max-w-xs shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">Limpar Carrinho?</h3>
              <p className="text-slate-500 text-sm mb-8">Todos os itens selecionados serão removidos.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Não
                </button>
                <button
                  onClick={clearCart}
                  className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-all"
                >
                  Sim, Limpar
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[200] flex items-center gap-3",
              notification.type === 'error' ? "bg-red-600 text-white" : "bg-green-600 text-white"
            )}
          >
            {notification.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            <span className="font-bold">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default POS;
