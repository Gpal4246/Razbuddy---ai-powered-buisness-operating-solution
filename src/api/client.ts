import {
  Business,
  User,
  Customer,
  Product,
  StockMovement,
  Supplier,
  PurchaseOrder,
  Quotation,
  Order,
  Invoice,
  Payment,
  ServiceOffering,
  Booking,
  AuditLog,
  BusinessSettings,
  UserRole,
  AiActionProposal,
  CreditNote,
  SerialWarrantyLookupResult,
  VendorBillExtractionResult,
} from '../types/index.ts';

const API_BASE = '/api';

// Helper to retrieve session headers from localStorage
export function getSessionHeaders(): Record<string, string> {
  const businessId = localStorage.getItem('razbuddy_active_biz') || 'biz-kalyan-01';
  const userId = localStorage.getItem('razbuddy_user_id') || 'usr-arjun-01';
  const userRole = localStorage.getItem('razbuddy_user_role') || 'owner';

  return {
    'x-business-id': businessId,
    'x-user-id': userId,
    'x-user-role': userRole,
  };
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const sessionHeaders = getSessionHeaders();
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...sessionHeaders,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let errorMsg = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data.error) errorMsg = data.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }
  return res.json();
}

export const api = {
  // Auth & Session
  getMe: () => fetchJson<{ user: User; business: Business; businesses: Business[]; teamMembers: User[] }>('/auth/me'),

  updateBusinessProfile: (data: Partial<Business>) =>
    fetchJson<{ success: boolean; business: Business }>('/business/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  resetDemo: () => fetchJson<{ success: boolean; message: string }>('/demo/reset', { method: 'POST' }),

  // Dashboard
  getDashboard: (range: 'today' | '7d' | '30d' | 'all' = '30d') =>
    fetchJson<{
      dateRange: string;
      metrics: {
        collectionsToday: number;
        collectionsRange: number;
        outstandingReceivables: number;
        ordersAwaitingFulfilment: number;
        ordersOnCreditHold: number;
        lowStockCount: number;
        upcomingBookings: number;
        totalSalesRange: number;
        aiAcceptanceRate: number;
      };
      needsAttention: Array<{
        id: string;
        type: 'overdue_invoice' | 'low_stock' | 'pending_po' | 'pending_booking' | 'credit_hold';
        title: string;
        description: string;
        severity: 'high' | 'medium';
        actionLabel: string;
        linkTo: string;
      }>;
      recentActivity: AuditLog[];
      recentOrders: Order[];
    }>(`/dashboard?range=${range}`),

  // Customers
  getCustomers: (q?: string) => fetchJson<Customer[]>(q ? `/customers?q=${encodeURIComponent(q)}` : '/customers'),
  getCustomer360: (id: string) =>
    fetchJson<{
      customer: Customer;
      orders: Order[];
      invoices: Invoice[];
      payments: Payment[];
      bookings: Booking[];
      quotations: Quotation[];
      creditNotes: CreditNote[];
      metrics: {
        avgPaymentDays: number;
        onTimePaymentRate: number;
        creditRiskScore: 'Low' | 'Moderate' | 'High';
      };
      summary: {
        totalOrdersCount: number;
        totalInvoicedAmount: number;
        totalPaidAmount: number;
        outstandingBalance: number;
        totalBookingsCount: number;
        creditLimit: number;
        creditExposurePercent: number;
      };
    }>(`/customers/${id}/360`),
  createCustomer: (data: Partial<Customer>) =>
    fetchJson<Customer>('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCustomer: (id: string, data: Partial<Customer>) =>
    fetchJson<Customer>(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Products & Inventory
  getProducts: (q?: string, category?: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    return fetchJson<Product[]>(`/products?${params.toString()}`);
  },
  createProduct: (data: Partial<Product>) =>
    fetchJson<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateProduct: (id: string, data: Partial<Product>, expectedVersion?: number) =>
    fetchJson<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, expectedVersion }),
    }),
  adjustStock: (id: string, adjustmentQty: number, reason: string, expectedVersion?: number) =>
    fetchJson<{ product: Product; movement: StockMovement }>(`/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ adjustmentQty, reason, expectedVersion }),
    }),
  getStockMovements: () => fetchJson<StockMovement[]>('/inventory/movements'),
  getLowStockAlerts: () =>
    fetchJson<
      Array<{
        product: Product;
        leadTimeDays: number;
        dailyVelocity: number;
        daysRemaining: number;
        safetyStock: number;
        recommendedReorderQty: number;
        deficit: number;
        estimatedCost: number;
      }>
    >('/inventory/alerts'),

  // Suppliers & Purchase Orders
  getSuppliers: () => fetchJson<Supplier[]>('/suppliers'),
  createSupplier: (data: Partial<Supplier>) =>
    fetchJson<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getPurchaseOrders: () => fetchJson<PurchaseOrder[]>('/purchase-orders'),
  createPurchaseOrder: (data: any) =>
    fetchJson<PurchaseOrder>('/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  approvePurchaseOrder: (id: string) =>
    fetchJson<PurchaseOrder>(`/purchase-orders/${id}/approve`, {
      method: 'POST',
    }),
  receivePurchaseOrder: (id: string) =>
    fetchJson<PurchaseOrder>(`/purchase-orders/${id}/receive`, {
      method: 'POST',
    }),

  // Quotations, Orders, Invoices, Payments, Credit Notes
  getQuotations: () => fetchJson<Quotation[]>('/quotations'),
  createQuotation: (data: any) =>
    fetchJson<Quotation>('/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  convertQuotationToOrder: (id: string) =>
    fetchJson<Order>(`/quotations/${id}/convert-to-order`, {
      method: 'POST',
    }),

  getOrders: () => fetchJson<Order[]>('/orders'),
  createOrder: (data: any) =>
    fetchJson<Order>('/orders', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  overrideCreditHold: (orderId: string, reason: string) =>
    fetchJson<{ success: boolean; order: Order; message: string }>(`/orders/${orderId}/override-credit-hold`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),
  updateOrderStatus: (id: string, status: Order['status']) =>
    fetchJson<Order>(`/orders/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  getInvoices: () => fetchJson<Invoice[]>('/invoices'),
  createInvoice: (data: any) =>
    fetchJson<Invoice>('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInvoiceDeliveryStatus: (id: string, status: Invoice['deliveryStatus']) =>
    fetchJson<{ success: boolean; invoice: Invoice }>(`/invoices/${id}/delivery-status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),

  getCreditNotes: () => fetchJson<CreditNote[]>('/credit-notes'),
  issueCreditNote: (data: {
    invoiceId: string;
    reason: string;
    items: Array<{ productId?: string; description: string; quantity: number; unitPrice: number; restock: boolean }>;
  }) =>
    fetchJson<CreditNote>('/credit-notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPayments: () => fetchJson<Payment[]>('/payments'),
  recordPayment: (data: any) =>
    fetchJson<Payment>('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Services & Bookings & BOM
  getServices: () => fetchJson<ServiceOffering[]>('/services'),
  createService: (data: Partial<ServiceOffering>) =>
    fetchJson<ServiceOffering>('/services', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getBookings: () => fetchJson<Booking[]>('/bookings'),
  createBooking: (data: any) =>
    fetchJson<Booking>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateBookingStatus: (id: string, status: Booking['status']) =>
    fetchJson<Booking>(`/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),
  completeBookingAndInvoice: (id: string, partsUsed: Booking['partsUsed']) =>
    fetchJson<{ success: boolean; booking: Booking; invoice: Invoice; message: string }>(
      `/bookings/${id}/complete-and-invoice`,
      {
        method: 'POST',
        body: JSON.stringify({ partsUsed }),
      }
    ),

  // RMA & Serial / Warranty
  lookupWarranty: (serial: string) =>
    fetchJson<SerialWarrantyLookupResult>(`/warranty/lookup?serial=${encodeURIComponent(serial)}`),

  // Multimodal Kachha Bill & OCR Ingestion
  parseVendorBill: (base64Data: string, mimeType?: string) =>
    fetchJson<VendorBillExtractionResult>('/ai/parse-vendor-bill', {
      method: 'POST',
      body: JSON.stringify({ base64Data, mimeType }),
    }),
  receiveBillInventory: (data: { supplierName: string; invoiceNumber?: string; lineItems: any[] }) =>
    fetchJson<{ success: boolean; message: string }>('/inventory/receive-bill', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // GSTR-1 & Bulk Import
  getGstr1ExportUrl: () => `${API_BASE}/export/gstr1`,
  importCsv: (type: 'products' | 'customers', records: any[]) =>
    fetchJson<{ success: boolean; count: number; message: string }>('/import/csv', {
      method: 'POST',
      body: JSON.stringify({ type, records }),
    }),

  // AI Command Centre
  aiChat: (query: string) =>
    fetchJson<{
      content: string;
      thinking?: string;
      actionProposal?: AiActionProposal;
      functionCalls?: Array<{ name: string; args: any }>;
      modelUsed: string;
      source: 'gemini' | 'deterministic_agent';
    }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),
  aiProposals: () => fetchJson<AiActionProposal[]>('/ai/proposals'),
  executeAiAction: (proposalId: string) =>
    fetchJson<{ success: boolean; result: string }>('/ai/execute-action', {
      method: 'POST',
      body: JSON.stringify({ proposalId }),
    }),
  rejectAiAction: (proposalId: string) =>
    fetchJson<{ success: boolean; proposal: AiActionProposal }>('/ai/reject-action', {
      method: 'POST',
      body: JSON.stringify({ proposalId }),
    }),

  // Razorpay
  createRazorpayOrder: (data: { amount: number; invoiceId?: string; customerId: string }) =>
    fetchJson<any>('/razorpay/create-order', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  verifyRazorpayPayment: (data: any) =>
    fetchJson<any>('/razorpay/verify-payment', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Settings & Audit
  getSettings: () => fetchJson<BusinessSettings>('/settings'),
  updateSettings: (data: Partial<BusinessSettings>) =>
    fetchJson<BusinessSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getAuditLogs: () => fetchJson<AuditLog[]>('/audit-logs'),
};
