export type UserRole = 'admin' | 'manager' | 'cashier';

export interface User {
  uid: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  active: boolean;
  cpf?: string;
  birthDate?: string;
  phone?: string;
  admissionDate?: string;
  cargo?: string; // Job title like "Atendente", "Caixa"
  forcePasswordChange?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  cost?: number;
  price: number;
  unit: 'kg' | 'un' | 'lt';
  stockLevel?: number;
  minStock?: number;
  imageUrl?: string;
  isIngredient?: boolean;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface PaymentMethod {
  method: 'cash' | 'pix' | 'card';
  amount: number;
  cardType?: 'debit' | 'credit';
  creditType?: 'one-time' | 'installments';
  installments?: number;
}

export interface Sale {
  id: string;
  items: SaleItem[];
  total: number;
  paymentMethods: PaymentMethod[];
  timestamp: any; // Firestore Timestamp
  cashierId: string;
  cashierName?: string;
  sessionId?: string;
}

export interface CashSession {
  id: string;
  startTime: any;
  endTime?: any;
  initialValue: number;
  finalValue?: number;
  expectedValue?: number;
  totalSales?: number;
  difference?: number;
  status: 'open' | 'closed';
  cashierId: string;
  cashierName?: string;
  notes?: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: 'fixed' | 'variable' | 'stock';
  date: string;
  status: 'paid' | 'pending';
}

export interface InventoryLog {
  id: string;
  productId: string;
  productName?: string;
  type: 'entry' | 'sale' | 'adjustment' | 'loss';
  quantity: number;
  reason?: string;
  timestamp: any;
  userId: string;
}
