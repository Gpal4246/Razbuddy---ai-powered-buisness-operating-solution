export type UserRole = 
  | 'owner' 
  | 'admin' 
  | 'sales' 
  | 'inventory_manager' 
  | 'booking_manager' 
  | 'accountant' 
  | 'viewer';

export interface Business {
  id: string;
  name: string;
  slug: string;
  legalName: string;
  gstin: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  currency: string; // 'INR'
  currencySymbol: string; // '₹'
  timezone: string; // 'Asia/Kolkata'
  isDemo: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  businessId: string;
  avatarUrl?: string;
}

export interface Customer {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string;
  customerType: 'retail' | 'wholesale' | 'b2b_corporate';
  gstin?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
  tags: string[];
  outstandingBalance: number;
  creditLimit: number; // e.g. 100000
  avgPaymentDays?: number;
  onTimePaymentRate?: number;
  creditRiskScore?: 'Low' | 'Moderate' | 'High';
  createdAt: string;
}

export interface Product {
  id: string;
  businessId: string;
  sku: string;
  name: string;
  description: string;
  category: string;
  unit: 'pcs' | 'box' | 'kg' | 'meter' | 'set' | 'litre';
  hsnCode: string; // e.g. '8504' (UPS/Inverter), '8507' (Batteries), '8517' (Switches)
  warrantyMonths?: number; // e.g. 24 or 36 months
  sellingPrice: number;
  costPrice: number;
  currentStock: number;
  reorderThreshold: number;
  preferredSupplierId?: string;
  status: 'active' | 'archived';
  version: number; // Optimistic Concurrency lock
  createdAt: string;
}

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName: string;
  sku: string;
  type: 'receipt' | 'sale' | 'adjustment' | 'return';
  quantity: number; // positive or negative
  beforeStock: number;
  afterStock: number;
  referenceType: 'po' | 'order' | 'manual' | 'ai_action' | 'credit_note' | 'service_job';
  referenceId: string;
  notes: string;
  createdBy: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  businessId: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  state?: string;
  gstin?: string;
  paymentTerms: string;
  leadTimeDays: number; // e.g. 3, 5, 7 days
  activeOrdersCount: number;
  createdAt: string;
}

export interface PurchaseOrderItem {
  productId: string;
  productName: string;
  sku: string;
  hsnCode?: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface PurchaseOrder {
  id: string;
  businessId: string;
  poNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseOrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  status: 'draft' | 'awaiting_approval' | 'approved' | 'received' | 'cancelled';
  expectedDeliveryDate: string;
  approvedBy?: string;
  approvedAt?: string;
  receivedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface QuotationItem {
  productId: string;
  productName: string;
  sku: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
}

export interface Quotation {
  id: string;
  businessId: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  customerState?: string;
  items: QuotationItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  isInterstate?: boolean;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalAmount: number;
  validUntil: string;
  status: 'draft' | 'sent' | 'accepted' | 'converted' | 'rejected';
  convertedOrderId?: string;
  notes?: string;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  sku: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
  serialNumbers?: string[];
}

export interface Order {
  id: string;
  businessId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerState?: string;
  items: OrderItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  isInterstate?: boolean;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalAmount: number;
  status: 'draft' | 'pending_approval' | 'confirmed' | 'processing' | 'fulfilled' | 'cancelled';
  creditHoldReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  invoiceId?: string;
  notes?: string;
  createdAt: string;
}

export interface InvoiceItem {
  productId?: string;
  description: string;
  hsnCode?: string;
  sacCode?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  serialNumbers?: string[];
}

export interface Invoice {
  id: string;
  businessId: string;
  invoiceNumber: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerState?: string;
  customerGstin?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  isInterstate?: boolean;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalAmount: number;
  amountPaid: number;
  balanceDue: number;
  issueDate: string;
  dueDate: string;
  status: 'draft' | 'issued' | 'partially_paid' | 'paid' | 'overdue' | 'void';
  razorpayPaymentLinkId?: string;
  deliveryStatus?: 'queued' | 'sent' | 'delivered' | 'failed';
  deliveryRetries?: number;
  deliveryTimestamp?: string;
  version: number; // Concurrency lock
  notes?: string;
  createdAt: string;
}

export interface CreditNoteItem {
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  restock: boolean;
}

export interface CreditNote {
  id: string;
  businessId: string;
  creditNoteNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  reason: string;
  items: CreditNoteItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  issuedAt: string;
  createdBy: string;
}

export interface Payment {
  id: string;
  businessId: string;
  paymentNumber: string;
  invoiceId?: string;
  invoiceNumber?: string;
  orderId?: string;
  customerId: string;
  customerName: string;
  amount: number;
  paymentMethod: 'razorpay' | 'cash' | 'bank_transfer' | 'upi' | 'cheque';
  status: 'created' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  referenceNumber?: string;
  notes?: string;
  receivedAt: string;
  createdAt: string;
}

export interface ServiceOffering {
  id: string;
  businessId: string;
  name: string;
  category: string;
  sacCode: string; // e.g. '9987' for Maintenance and Repair
  durationMinutes: number;
  price: number;
  depositRequired: number;
  description: string;
  assignedStaff: string[];
  active: boolean;
}

export interface BookingPartUsed {
  productId: string;
  name: string;
  sku: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
}

export interface Booking {
  id: string;
  businessId: string;
  bookingNumber: string;
  serviceId: string;
  serviceName: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  staffName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  status: 'requested' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';
  depositAmount: number;
  depositStatus: 'pending' | 'paid' | 'waived';
  totalAmount: number;
  partsUsed?: BookingPartUsed[];
  generatedInvoiceId?: string;
  notes?: string;
  createdAt: string;
}

export interface AiActionProposal {
  id: string;
  businessId: string;
  title: string;
  description: string;
  actionType: 
    | 'CREATE_PURCHASE_ORDER' 
    | 'UPDATE_STOCK_ADJUSTMENT' 
    | 'ISSUE_INVOICE' 
    | 'SEND_INVOICE_REMINDERS' 
    | 'CONFIRM_BOOKING' 
    | 'CREATE_CUSTOMER'
    | 'OVERRIDE_CREDIT_HOLD';
  payload: any;
  affectedRecords: Array<{
    type: string;
    id: string;
    label: string;
  }>;
  financialImpact?: {
    amount: number;
    currency: string;
    description: string;
  };
  validation: {
    passed: boolean;
    checks: Array<{ rule: string; passed: boolean; message: string }>;
  };
  status: 'pending_approval' | 'approved' | 'rejected' | 'executed' | 'cancelled';
  createdAt: string;
  executedAt?: string;
  executedBy?: string;
  executionResult?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  thinking?: string;
  actionProposal?: AiActionProposal;
  functionCalls?: Array<{
    name: string;
    args: any;
  }>;
}

export interface AuditLog {
  id: string;
  businessId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: 'sales' | 'inventory' | 'bookings' | 'customers' | 'settings' | 'ai' | 'payments';
  recordId: string;
  details: string;
  previousHash?: string;
  entryHash?: string;
  timestamp: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'warning' | 'info' | 'success' | 'action_needed';
  linkTo?: string;
  read: boolean;
  timestamp: string;
}

export interface BusinessSettings {
  invoicePrefix: string;
  defaultGstRate: number; // 18%
  allowNegativeStock: boolean;
  bookingAdvanceHours: number;
  razorpayKeyId: string;
  razorpayKeySecret?: string;
  razorpayConnected: boolean;
  razorpayTestMode: boolean;
  geminiModel: string;
  geminiThinkingEnabled: boolean;
}

export interface SerialWarrantyLookupResult {
  serialNumber: string;
  productName: string;
  sku: string;
  hsnCode: string;
  warrantyMonths: number;
  saleDate: string;
  warrantyExpiryDate: string;
  isWarrantyActive: boolean;
  customerName: string;
  customerPhone?: string;
  invoiceNumber: string;
  supplierName: string;
}

export interface VendorBillExtractionResult {
  supplierName: string;
  supplierGstin?: string;
  invoiceNumber: string;
  invoiceDate: string;
  totalBilledAmount: number;
  lineItems: Array<{
    rawDescription: string;
    matchedProductId?: string;
    matchedProductName?: string;
    matchedSku?: string;
    quantity: number;
    unitCost: number;
    catalogCostPrice?: number;
    priceCreepPercent?: number; // e.g. +4.2%
    hsnCode?: string;
    gstRatePercent: number;
    total: number;
  }>;
  confidenceScore: number;
  priceCreepDetected: boolean;
  notes?: string;
}
