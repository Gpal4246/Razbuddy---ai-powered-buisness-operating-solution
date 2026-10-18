import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  Business,
  Customer,
  Product,
  StockMovement,
  Supplier,
  PurchaseOrder,
  Quotation,
  Order,
  Invoice,
  InvoiceItem,
  Payment,
  ServiceOffering,
  Booking,
  AuditLog,
  BusinessSettings,
  User,
  UserRole,
  AiActionProposal,
  CreditNote,
  SerialWarrantyLookupResult,
} from '../src/types/index.ts';
import {
  SEED_BUSINESSES,
  SEED_USERS,
  SEED_CUSTOMERS,
  SEED_SUPPLIERS,
  SEED_PRODUCTS,
  SEED_STOCK_MOVEMENTS,
  SEED_PURCHASE_ORDERS,
  SEED_QUOTATIONS,
  SEED_ORDERS,
  SEED_INVOICES,
  SEED_PAYMENTS,
  SEED_SERVICES,
  SEED_BOOKINGS,
  SEED_AUDIT_LOGS,
  SEED_CREDIT_NOTES,
  DEFAULT_BUSINESS_SETTINGS,
} from './seedData.ts';
import {
  calculateGstSplit,
  evaluateCreditRiskGatekeeper,
  computeAuditLogHash,
  calculateCustomerPaymentMetrics,
  calculateInventoryVelocityAndReorder,
} from './gstAndCredit.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface SessionContext {
  businessId: string;
  userId: string;
  userRole: UserRole;
  userName?: string;
}

interface StoredData {
  businesses: Business[];
  users: User[];
  customers: Customer[];
  suppliers: Supplier[];
  products: Product[];
  stockMovements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
  quotations: Quotation[];
  orders: Order[];
  invoices: Invoice[];
  creditNotes: CreditNote[];
  payments: Payment[];
  services: ServiceOffering[];
  bookings: Booking[];
  auditLogs: AuditLog[];
  actionProposals: AiActionProposal[];
  settings: BusinessSettings;
  proposalStats: {
    totalCreated: number;
    approved: number;
    rejected: number;
    executed: number;
  };
}

class DataStore {
  private data!: StoredData;

  constructor() {
    this.ensureDataDir();
    this.loadOrInitialize();
  }

  private ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadOrInitialize() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        return;
      } catch (err) {
        console.warn('Could not read existing db.json, hydrating from seed data:', err);
      }
    }
    this.resetToSeed();
  }

  private persist() {
    try {
      this.ensureDataDir();
      const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tmpFile, JSON.stringify(this.data, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Failed to write atomic db.json:', err);
    }
  }

  public resetToSeed() {
    this.data = {
      businesses: JSON.parse(JSON.stringify(SEED_BUSINESSES)),
      users: JSON.parse(JSON.stringify(SEED_USERS)),
      customers: JSON.parse(JSON.stringify(SEED_CUSTOMERS)),
      suppliers: JSON.parse(JSON.stringify(SEED_SUPPLIERS)),
      products: JSON.parse(JSON.stringify(SEED_PRODUCTS)),
      stockMovements: JSON.parse(JSON.stringify(SEED_STOCK_MOVEMENTS)),
      purchaseOrders: JSON.parse(JSON.stringify(SEED_PURCHASE_ORDERS)),
      quotations: JSON.parse(JSON.stringify(SEED_QUOTATIONS)),
      orders: JSON.parse(JSON.stringify(SEED_ORDERS)),
      invoices: JSON.parse(JSON.stringify(SEED_INVOICES)),
      creditNotes: JSON.parse(JSON.stringify(SEED_CREDIT_NOTES || [])),
      payments: JSON.parse(JSON.stringify(SEED_PAYMENTS)),
      services: JSON.parse(JSON.stringify(SEED_SERVICES)),
      bookings: JSON.parse(JSON.stringify(SEED_BOOKINGS)),
      auditLogs: JSON.parse(JSON.stringify(SEED_AUDIT_LOGS)),
      actionProposals: [],
      settings: JSON.parse(JSON.stringify(DEFAULT_BUSINESS_SETTINGS)),
      proposalStats: {
        totalCreated: 0,
        approved: 0,
        rejected: 0,
        executed: 0,
      },
    };
    this.persist();
  }

  // --- Session & Multi-Tenancy Scoping ---
  public getBusiness(businessId: string): Business {
    return this.data.businesses.find(b => b.id === businessId) || this.data.businesses[0];
  }

  public getAllBusinesses(): Business[] {
    return this.data.businesses;
  }

  public updateBusinessProfile(businessId: string, updates: Partial<Business>, ctx: SessionContext): Business {
    const biz = this.getBusiness(businessId);
    Object.assign(biz, updates);
    this.addAuditLog(ctx, 'BUSINESS_PROFILE_UPDATED', 'settings', biz.id, `Updated business profile for ${biz.name}`);
    this.persist();
    return biz;
  }

  public getUsers(businessId: string): User[] {
    return this.data.users.filter(u => u.businessId === businessId);
  }

  public getUser(userId: string): User | undefined {
    return this.data.users.find(u => u.id === userId);
  }

  // --- Tamper-Evident Audit Logging ---
  public addAuditLog(
    ctx: SessionContext,
    action: string,
    module: AuditLog['module'],
    recordId: string,
    details: string
  ): AuditLog {
    const bizLogs = this.data.auditLogs.filter(a => a.businessId === ctx.businessId);
    const lastHash = bizLogs.length > 0 && bizLogs[0].entryHash
      ? bizLogs[0].entryHash
      : '0000000000000000000000000000000000000000000000000000000000000000';

    const rawEntry = {
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessId: ctx.businessId,
      actorId: ctx.userId,
      actorName: ctx.userName || 'System Operator',
      actorRole: ctx.userRole,
      action,
      module,
      recordId,
      details,
      timestamp: new Date().toISOString(),
    };

    const entryHash = computeAuditLogHash(lastHash, rawEntry);
    const log: AuditLog = {
      ...rawEntry,
      previousHash: lastHash,
      entryHash,
    };

    this.data.auditLogs.unshift(log);
    this.persist();
    return log;
  }

  public getAuditLogs(businessId: string): AuditLog[] {
    return this.data.auditLogs.filter(a => a.businessId === businessId);
  }

  // --- Customers & Udhaar ---
  public getCustomers(businessId: string, search?: string): Customer[] {
    let list = this.data.customers.filter(c => c.businessId === businessId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        c =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.gstin && c.gstin.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public getCustomerById(businessId: string, id: string): Customer | undefined {
    return this.data.customers.find(c => c.id === id && c.businessId === businessId);
  }

  public createCustomer(
    ctx: SessionContext,
    data: Omit<Customer, 'id' | 'businessId' | 'outstandingBalance' | 'createdAt'>
  ): Customer {
    const customer: Customer = {
      id: `cust-${Date.now()}`,
      businessId: ctx.businessId,
      ...data,
      creditLimit: data.creditLimit || (data.customerType === 'b2b_corporate' ? 100000 : 50000),
      outstandingBalance: 0,
      avgPaymentDays: 15,
      onTimePaymentRate: 100,
      creditRiskScore: 'Low',
      createdAt: new Date().toISOString(),
    };
    this.data.customers.unshift(customer);
    this.addAuditLog(ctx, 'CUSTOMER_CREATED', 'customers', customer.id, `Created customer profile for ${customer.name}`);
    this.persist();
    return customer;
  }

  public updateCustomer(ctx: SessionContext, id: string, updates: Partial<Customer>): Customer {
    const cust = this.getCustomerById(ctx.businessId, id);
    if (!cust) throw new Error('Customer not found');
    Object.assign(cust, updates);
    this.addAuditLog(ctx, 'CUSTOMER_UPDATED', 'customers', cust.id, `Updated customer profile ${cust.name}`);
    this.persist();
    return cust;
  }

  public getCustomer360(businessId: string, customerId: string) {
    const customer = this.getCustomerById(businessId, customerId);
    if (!customer) throw new Error('Customer not found');

    const orders = this.data.orders.filter(o => o.customerId === customerId && o.businessId === businessId);
    const invoices = this.data.invoices.filter(i => i.customerId === customerId && i.businessId === businessId);
    const payments = this.data.payments.filter(p => p.customerId === customerId && p.businessId === businessId);
    const bookings = this.data.bookings.filter(b => b.customerId === customerId && b.businessId === businessId);
    const quotations = this.data.quotations.filter(q => q.customerId === customerId && q.businessId === businessId);
    const creditNotes = this.data.creditNotes.filter(cn => cn.customerId === customerId && cn.businessId === businessId);

    // Calculate real outstanding balance from unpaid/partially paid invoices
    const calculatedBalance = invoices
      .filter(i => i.status !== 'void')
      .reduce((sum, inv) => sum + inv.balanceDue, 0);

    customer.outstandingBalance = calculatedBalance;

    // Refresh payment behavior scoring
    const metrics = calculateCustomerPaymentMetrics(invoices, payments);
    customer.avgPaymentDays = metrics.avgPaymentDays;
    customer.onTimePaymentRate = metrics.onTimePaymentRate;
    customer.creditRiskScore = metrics.creditRiskScore;

    return {
      customer,
      orders,
      invoices,
      payments,
      bookings,
      quotations,
      creditNotes,
      metrics,
      summary: {
        totalOrdersCount: orders.length,
        totalInvoicedAmount: invoices.reduce((sum, i) => sum + i.totalAmount, 0),
        totalPaidAmount: payments.reduce((sum, p) => sum + p.amount, 0),
        outstandingBalance: calculatedBalance,
        totalBookingsCount: bookings.length,
        creditLimit: customer.creditLimit,
        creditExposurePercent: customer.creditLimit > 0 ? Math.round((calculatedBalance / customer.creditLimit) * 100) : 0,
      },
    };
  }

  // --- Products & Concurrency-Protected Inventory ---
  public getProducts(businessId: string, search?: string, category?: string): Product[] {
    let list = this.data.products.filter(p => p.businessId === businessId && p.status === 'active');
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.hsnCode && p.hsnCode.includes(q)));
    }
    if (category && category !== 'all') {
      list = list.filter(p => p.category === category);
    }
    return list;
  }

  public getProductById(businessId: string, id: string): Product | undefined {
    return this.data.products.find(p => p.id === id && p.businessId === businessId);
  }

  public createProduct(ctx: SessionContext, data: Omit<Product, 'id' | 'businessId' | 'version' | 'createdAt'>): Product {
    const product: Product = {
      id: `prod-${Date.now()}`,
      businessId: ctx.businessId,
      ...data,
      version: 1,
      createdAt: new Date().toISOString(),
    };
    this.data.products.unshift(product);
    this.addAuditLog(ctx, 'PRODUCT_CREATED', 'inventory', product.id, `Created product ${product.name} (SKU: ${product.sku}, HSN: ${product.hsnCode})`);
    this.persist();
    return product;
  }

  public updateProduct(ctx: SessionContext, id: string, updates: Partial<Product>, expectedVersion?: number): Product {
    const prod = this.getProductById(ctx.businessId, id);
    if (!prod) throw new Error('Product not found');
    if (expectedVersion !== undefined && prod.version !== expectedVersion) {
      throw new Error(`Concurrency Conflict: Product ${prod.sku} was modified by another operator (expected v${expectedVersion}, current v${prod.version}). Please refresh.`);
    }
    Object.assign(prod, updates);
    prod.version = (prod.version || 1) + 1;
    this.addAuditLog(ctx, 'PRODUCT_UPDATED', 'inventory', prod.id, `Updated product ${prod.name}`);
    this.persist();
    return prod;
  }

  public adjustStock(
    ctx: SessionContext,
    productId: string,
    adjustmentQty: number,
    reason: string,
    refType: StockMovement['referenceType'] = 'manual',
    refId: string = 'ADJ',
    expectedVersion?: number
  ): { product: Product; movement: StockMovement } {
    const prod = this.getProductById(ctx.businessId, productId);
    if (!prod) throw new Error('Product not found');

    if (expectedVersion !== undefined && prod.version !== expectedVersion) {
      throw new Error(`Concurrency Lock: Product ${prod.sku} was updated concurrently. Current v${prod.version}, requested v${expectedVersion}.`);
    }

    const beforeStock = prod.currentStock;
    const afterStock = beforeStock + adjustmentQty;
    if (afterStock < 0 && !this.data.settings.allowNegativeStock) {
      throw new Error(`Insufficient stock for ${prod.name}. Available: ${beforeStock}, requested deduction: ${Math.abs(adjustmentQty)}`);
    }

    prod.currentStock = afterStock;
    prod.version = (prod.version || 1) + 1;

    const movement: StockMovement = {
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      businessId: ctx.businessId,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      type: adjustmentQty >= 0 ? (refType === 'credit_note' ? 'return' : 'receipt') : 'sale',
      quantity: adjustmentQty,
      beforeStock,
      afterStock,
      referenceType: refType,
      referenceId: refId,
      notes: reason,
      createdBy: `${ctx.userName || 'Operator'} (${ctx.userRole})`,
      createdAt: new Date().toISOString(),
    };

    this.data.stockMovements.unshift(movement);
    this.addAuditLog(
      ctx,
      'STOCK_ADJUSTED',
      'inventory',
      prod.id,
      `Stock adjusted for ${prod.name} by ${adjustmentQty > 0 ? '+' : ''}${adjustmentQty} (New balance: ${afterStock}). Reason: ${reason}`
    );
    this.persist();
    return { product: prod, movement };
  }

  public getStockMovements(businessId: string): StockMovement[] {
    return this.data.stockMovements.filter(m => m.businessId === businessId);
  }

  public getLowStockAlerts(businessId: string) {
    const prods = this.getProducts(businessId).filter(p => p.currentStock <= p.reorderThreshold);
    const bizMovements = this.getStockMovements(businessId);
    const suppliers = this.getSuppliers(businessId);

    return prods.map(p => {
      const pMovements = bizMovements.filter(m => m.productId === p.id && m.type === 'sale');
      const supplier = suppliers.find(s => s.id === p.preferredSupplierId);
      const leadTimeDays = supplier?.leadTimeDays || 4;

      const calc = calculateInventoryVelocityAndReorder({
        currentStock: p.currentStock,
        reorderThreshold: p.reorderThreshold,
        leadTimeDays,
        recentSaleMovements: pMovements,
        daysLookback: 30,
      });

      return {
        product: p,
        leadTimeDays,
        dailyVelocity: calc.dailyVelocity,
        daysRemaining: calc.daysRemaining,
        safetyStock: calc.safetyStock,
        recommendedReorderQty: calc.recommendedReorderQty,
        deficit: p.reorderThreshold - p.currentStock,
        estimatedCost: calc.recommendedReorderQty * p.costPrice,
      };
    });
  }

  // --- Suppliers & Purchase Orders ---
  public getSuppliers(businessId: string): Supplier[] {
    return this.data.suppliers.filter(s => s.businessId === businessId);
  }

  public createSupplier(
    ctx: SessionContext,
    data: Omit<Supplier, 'id' | 'businessId' | 'activeOrdersCount' | 'createdAt'>
  ): Supplier {
    const supplier: Supplier = {
      id: `sup-${Date.now()}`,
      businessId: ctx.businessId,
      ...data,
      leadTimeDays: data.leadTimeDays || 4,
      activeOrdersCount: 0,
      createdAt: new Date().toISOString(),
    };
    this.data.suppliers.unshift(supplier);
    this.addAuditLog(ctx, 'SUPPLIER_CREATED', 'inventory', supplier.id, `Added supplier ${supplier.name}`);
    this.persist();
    return supplier;
  }

  public getPurchaseOrders(businessId: string): PurchaseOrder[] {
    return this.data.purchaseOrders.filter(po => po.businessId === businessId);
  }

  public createPurchaseOrder(
    ctx: SessionContext,
    data: {
      supplierId: string;
      items: Array<{ productId: string; quantity: number; unitCost: number }>;
      expectedDeliveryDate: string;
      notes?: string;
    }
  ): PurchaseOrder {
    const supplier = this.data.suppliers.find(s => s.id === data.supplierId && s.businessId === ctx.businessId);
    if (!supplier) throw new Error('Supplier not found');

    const items = data.items.map(item => {
      const prod = this.getProductById(ctx.businessId, item.productId);
      if (!prod) throw new Error(`Product ${item.productId} not found`);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        quantity: item.quantity,
        unitCost: item.unitCost,
        total: item.quantity * item.unitCost,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.total, 0);
    const taxAmount = Math.round(subtotal * 0.18 * 100) / 100; // 18% standard GST
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;
    const poNumber = `PO-2026-${String(this.data.purchaseOrders.length + 1).padStart(3, '0')}`;

    const po: PurchaseOrder = {
      id: `po-${Date.now()}`,
      businessId: ctx.businessId,
      poNumber,
      supplierId: supplier.id,
      supplierName: supplier.name,
      items,
      subtotal,
      taxAmount,
      totalAmount,
      status: 'awaiting_approval',
      expectedDeliveryDate: data.expectedDeliveryDate,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    this.data.purchaseOrders.unshift(po);
    supplier.activeOrdersCount += 1;
    this.addAuditLog(
      ctx,
      'PO_CREATED',
      'inventory',
      po.id,
      `Drafted purchase order ${po.poNumber} for ${supplier.name} totaling ₹${totalAmount.toLocaleString('en-IN')}`
    );
    this.persist();
    return po;
  }

  public approvePurchaseOrder(ctx: SessionContext, id: string): PurchaseOrder {
    const po = this.data.purchaseOrders.find(p => p.id === id && p.businessId === ctx.businessId);
    if (!po) throw new Error('Purchase order not found');
    if (po.status !== 'awaiting_approval' && po.status !== 'draft') {
      throw new Error(`Cannot approve PO in status: ${po.status}`);
    }

    po.status = 'approved';
    po.approvedBy = `${ctx.userName || 'Operator'} (${ctx.userRole})`;
    po.approvedAt = new Date().toISOString();
    this.addAuditLog(ctx, 'PO_APPROVED', 'inventory', po.id, `Approved purchase order ${po.poNumber}`);
    this.persist();
    return po;
  }

  public receivePurchaseOrder(ctx: SessionContext, id: string): PurchaseOrder {
    const po = this.data.purchaseOrders.find(p => p.id === id && p.businessId === ctx.businessId);
    if (!po) throw new Error('Purchase order not found');
    if (po.status !== 'approved') {
      throw new Error(`Only approved POs can be received into inventory. Current status: ${po.status}`);
    }

    for (const item of po.items) {
      this.adjustStock(
        ctx,
        item.productId,
        item.quantity,
        `Received against PO ${po.poNumber} from ${po.supplierName}`,
        'po',
        po.poNumber
      );
    }

    po.status = 'received';
    po.receivedAt = new Date().toISOString();
    const supplier = this.data.suppliers.find(s => s.id === po.supplierId);
    if (supplier && supplier.activeOrdersCount > 0) {
      supplier.activeOrdersCount -= 1;
    }

    this.addAuditLog(ctx, 'PO_RECEIVED', 'inventory', po.id, `Stock received and inventoried for PO ${po.poNumber}`);
    this.persist();
    return po;
  }

  // --- Quotations ---
  public getQuotations(businessId: string): Quotation[] {
    return this.data.quotations.filter(q => q.businessId === businessId);
  }

  public createQuotation(
    ctx: SessionContext,
    data: {
      customerId: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number; discountPercent?: number }>;
      validUntil: string;
      notes?: string;
    }
  ): Quotation {
    const customer = this.getCustomerById(ctx.businessId, data.customerId);
    if (!customer) throw new Error('Customer not found');
    const biz = this.getBusiness(ctx.businessId);

    const items = data.items.map(item => {
      const prod = this.getProductById(ctx.businessId, item.productId);
      if (!prod) throw new Error(`Product not found: ${item.productId}`);
      const discount = item.discountPercent || 0;
      const lineSubtotal = item.quantity * item.unitPrice;
      const total = lineSubtotal - lineSubtotal * (discount / 100);
      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: discount,
        total: Math.round(total * 100) / 100,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.total, 0);
    const taxRate = this.data.settings.defaultGstRate || 18;
    const gstSplit = calculateGstSplit(subtotal, taxRate, biz.state, customer.state);

    const quoteNumber = `QUO-2026-${String(this.data.quotations.length + 1).padStart(3, '0')}`;
    const quote: Quotation = {
      id: `quo-${Date.now()}`,
      businessId: ctx.businessId,
      quoteNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerState: customer.state,
      items,
      subtotal,
      taxRate,
      taxAmount: gstSplit.taxAmount,
      isInterstate: gstSplit.isInterstate,
      cgstRate: gstSplit.cgstRate,
      cgstAmount: gstSplit.cgstAmount,
      sgstRate: gstSplit.sgstRate,
      sgstAmount: gstSplit.sgstAmount,
      igstRate: gstSplit.igstRate,
      igstAmount: gstSplit.igstAmount,
      totalAmount: gstSplit.totalAmount,
      validUntil: data.validUntil,
      status: 'sent',
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    this.data.quotations.unshift(quote);
    this.addAuditLog(ctx, 'QUOTATION_CREATED', 'sales', quote.id, `Created quotation ${quote.quoteNumber} for ${customer.name}`);
    this.persist();
    return quote;
  }

  public convertQuotationToOrder(ctx: SessionContext, quotationId: string): Order {
    const quote = this.data.quotations.find(q => q.id === quotationId && q.businessId === ctx.businessId);
    if (!quote) throw new Error('Quotation not found');
    if (quote.status === 'converted') throw new Error('Quotation has already been converted');

    const order = this.createOrder(ctx, {
      customerId: quote.customerId,
      items: quote.items.map(it => ({
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountPercent: it.discountPercent,
      })),
      notes: `Converted from quotation ${quote.quoteNumber}. ${quote.notes || ''}`,
    });

    quote.status = 'converted';
    quote.convertedOrderId = order.id;
    this.addAuditLog(ctx, 'QUOTATION_CONVERTED', 'sales', quote.id, `Converted quotation ${quote.quoteNumber} to Order ${order.orderNumber}`);
    this.persist();
    return order;
  }

  // --- Orders & Udhaar Gatekeeper ---
  public getOrders(businessId: string): Order[] {
    return this.data.orders.filter(o => o.businessId === businessId);
  }

  public createOrder(
    ctx: SessionContext,
    data: {
      customerId: string;
      items: Array<{ productId: string; quantity: number; unitPrice: number; discountPercent?: number; serialNumbers?: string[] }>;
      notes?: string;
    }
  ): Order {
    const customer = this.getCustomerById(ctx.businessId, data.customerId);
    if (!customer) throw new Error('Customer not found');
    const biz = this.getBusiness(ctx.businessId);

    const items = data.items.map(item => {
      const prod = this.getProductById(ctx.businessId, item.productId);
      if (!prod) throw new Error(`Product not found: ${item.productId}`);
      const discount = item.discountPercent || 0;
      const lineSubtotal = item.quantity * item.unitPrice;
      const total = lineSubtotal - lineSubtotal * (discount / 100);

      // Auto-generate realistic serial numbers if not passed
      const serials = item.serialNumbers || Array.from({ length: item.quantity }).map((_, idx) =>
        `SN-${prod.sku.substring(0, 3)}-${Date.now().toString().slice(-4)}-${idx + 1}`
      );

      return {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        hsnCode: prod.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: discount,
        total: Math.round(total * 100) / 100,
        serialNumbers: serials,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.total, 0);
    const taxRate = this.data.settings.defaultGstRate || 18;
    const gstSplit = calculateGstSplit(subtotal, taxRate, biz.state, customer.state);

    // Run Automated Udhaar Gatekeeper
    const unpaidInvoices = this.data.invoices.filter(i => i.customerId === customer.id && i.businessId === ctx.businessId && i.balanceDue > 0);
    const creditGatekeeper = evaluateCreditRiskGatekeeper({
      customerCreditLimit: customer.creditLimit,
      customerOutstandingBalance: customer.outstandingBalance,
      newOrderTotal: gstSplit.totalAmount,
      unpaidInvoices,
      currentDateStr: new Date().toISOString().split('T')[0],
    });

    const orderNumber = `ORD-2026-${String(this.data.orders.length + 1).padStart(3, '0')}`;
    const isCreditHold = creditGatekeeper.requiresCreditHold;

    const order: Order = {
      id: `ord-${Date.now()}`,
      businessId: ctx.businessId,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerState: customer.state,
      items,
      subtotal,
      taxRate,
      taxAmount: gstSplit.taxAmount,
      isInterstate: gstSplit.isInterstate,
      cgstRate: gstSplit.cgstRate,
      cgstAmount: gstSplit.cgstAmount,
      sgstRate: gstSplit.sgstRate,
      sgstAmount: gstSplit.sgstAmount,
      igstRate: gstSplit.igstRate,
      igstAmount: gstSplit.igstAmount,
      totalAmount: gstSplit.totalAmount,
      status: isCreditHold ? 'pending_approval' : 'confirmed',
      creditHoldReason: isCreditHold ? creditGatekeeper.reasons.join(' | ') : undefined,
      paymentStatus: 'unpaid',
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    // If order passes credit gatekeeper, deduct inventory immediately
    if (!isCreditHold) {
      for (const item of items) {
        this.adjustStock(
          ctx,
          item.productId,
          -item.quantity,
          `Deducted for sales order ${orderNumber} (${customer.name})`,
          'order',
          orderNumber
        );
      }
    }

    this.data.orders.unshift(order);
    this.addAuditLog(
      ctx,
      isCreditHold ? 'ORDER_CREDIT_HOLD' : 'ORDER_CREATED',
      'sales',
      order.id,
      isCreditHold
        ? `Order ${order.orderNumber} placed on Credit Hold for ${customer.name}. Reason: ${order.creditHoldReason}`
        : `Created order ${order.orderNumber} for ${customer.name} totaling ₹${order.totalAmount}`
    );
    this.persist();
    return order;
  }

  public overrideCreditHold(ctx: SessionContext, orderId: string, reason: string): Order {
    const order = this.data.orders.find(o => o.id === orderId && o.businessId === ctx.businessId);
    if (!order) throw new Error('Order not found');
    if (order.status !== 'pending_approval') {
      throw new Error(`Order ${order.orderNumber} is not on credit hold (Status: ${order.status})`);
    }

    // Deduct inventory upon override
    for (const item of order.items) {
      this.adjustStock(
        ctx,
        item.productId,
        -item.quantity,
        `Deducted on Credit Hold Override for order ${order.orderNumber}`,
        'order',
        order.orderNumber
      );
    }

    order.status = 'confirmed';
    order.overriddenBy = `${ctx.userName || 'Operator'} (${ctx.userRole})`;
    order.overriddenAt = new Date().toISOString();
    order.notes = `${order.notes || ''} [Credit Hold Overridden: ${reason}]`.trim();

    this.addAuditLog(
      ctx,
      'ORDER_CREDIT_HOLD_OVERRIDDEN',
      'sales',
      order.id,
      `Owner override on credit hold for ${order.orderNumber} (${order.customerName}). Reason: ${reason}`
    );
    this.persist();
    return order;
  }

  public updateOrderStatus(ctx: SessionContext, orderId: string, status: Order['status']): Order {
    const order = this.data.orders.find(o => o.id === orderId && o.businessId === ctx.businessId);
    if (!order) throw new Error('Order not found');
    order.status = status;
    this.addAuditLog(ctx, 'ORDER_STATUS_UPDATED', 'sales', order.id, `Updated order ${order.orderNumber} status to ${status}`);
    this.persist();
    return order;
  }

  // --- Invoices & GST Split ---
  public getInvoices(businessId: string): Invoice[] {
    return this.data.invoices.filter(i => i.businessId === businessId);
  }

  public createInvoice(
    ctx: SessionContext,
    data: {
      orderId?: string;
      customerId: string;
      items: Array<{ productId?: string; description: string; quantity: number; unitPrice: number; hsnCode?: string; sacCode?: string; serialNumbers?: string[] }>;
      dueDate: string;
      notes?: string;
    }
  ): Invoice {
    const customer = this.getCustomerById(ctx.businessId, data.customerId);
    if (!customer) throw new Error('Customer not found');
    const biz = this.getBusiness(ctx.businessId);

    const items: InvoiceItem[] = data.items.map(it => {
      let hsn = it.hsnCode;
      let sac = it.sacCode;
      if (it.productId) {
        const prod = this.getProductById(ctx.businessId, it.productId);
        if (prod) hsn = prod.hsnCode;
      }
      return {
        productId: it.productId,
        description: it.description,
        hsnCode: hsn,
        sacCode: sac,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: it.quantity * it.unitPrice,
        serialNumbers: it.serialNumbers,
      };
    });

    const subtotal = items.reduce((sum, it) => sum + it.total, 0);
    const taxRate = this.data.settings.defaultGstRate || 18;
    const gstSplit = calculateGstSplit(subtotal, taxRate, biz.state, customer.state);

    const invoiceNumber = `INV-2026-${String(this.data.invoices.length + 1).padStart(3, '0')}`;
    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      businessId: ctx.businessId,
      invoiceNumber,
      orderId: data.orderId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerState: customer.state,
      customerGstin: customer.gstin,
      items,
      subtotal,
      taxRate,
      taxAmount: gstSplit.taxAmount,
      isInterstate: gstSplit.isInterstate,
      cgstRate: gstSplit.cgstRate,
      cgstAmount: gstSplit.cgstAmount,
      sgstRate: gstSplit.sgstRate,
      sgstAmount: gstSplit.sgstAmount,
      igstRate: gstSplit.igstRate,
      igstAmount: gstSplit.igstAmount,
      totalAmount: gstSplit.totalAmount,
      amountPaid: 0,
      balanceDue: gstSplit.totalAmount,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      status: 'issued',
      deliveryStatus: 'queued',
      deliveryRetries: 0,
      version: 1,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    if (data.orderId) {
      const order = this.data.orders.find(o => o.id === data.orderId && o.businessId === ctx.businessId);
      if (order) order.invoiceId = invoice.id;
    }

    customer.outstandingBalance += invoice.balanceDue;

    this.data.invoices.unshift(invoice);
    this.addAuditLog(
      ctx,
      'INVOICE_ISSUED',
      'sales',
      invoice.id,
      `Issued GST invoice ${invoice.invoiceNumber} to ${customer.name} for ₹${invoice.totalAmount} (CGST/SGST/IGST split calculated)`
    );
    this.persist();
    return invoice;
  }

  public updateInvoiceDeliveryStatus(
    ctx: SessionContext,
    invoiceId: string,
    status: Invoice['deliveryStatus']
  ): Invoice {
    const inv = this.data.invoices.find(i => i.id === invoiceId && i.businessId === ctx.businessId);
    if (!inv) throw new Error('Invoice not found');
    inv.deliveryStatus = status;
    inv.deliveryTimestamp = new Date().toISOString();
    if (status === 'sent' || status === 'delivered') {
      inv.deliveryRetries = (inv.deliveryRetries || 0) + 1;
    }
    this.persist();
    return inv;
  }

  // --- GST Credit Notes & Returns ---
  public getCreditNotes(businessId: string): CreditNote[] {
    return this.data.creditNotes.filter(cn => cn.businessId === businessId);
  }

  public issueCreditNote(
    ctx: SessionContext,
    data: {
      invoiceId: string;
      reason: string;
      items: Array<{ productId?: string; description: string; quantity: number; unitPrice: number; restock: boolean }>;
    }
  ): CreditNote {
    const invoice = this.data.invoices.find(i => i.id === data.invoiceId && i.businessId === ctx.businessId);
    if (!invoice) throw new Error('Invoice not found');

    const customer = this.getCustomerById(ctx.businessId, invoice.customerId);
    if (!customer) throw new Error('Customer not found');

    const subtotal = data.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
    const taxAmount = Math.round(subtotal * (invoice.taxRate / 100) * 100) / 100;
    const totalAmount = Math.round((subtotal + taxAmount) * 100) / 100;

    const creditNoteNumber = `CN-2026-${String(this.data.creditNotes.length + 1).padStart(3, '0')}`;

    // Restock undamaged returned products into inventory
    for (const item of data.items) {
      if (item.productId && item.restock) {
        this.adjustStock(
          ctx,
          item.productId,
          item.quantity,
          `Restocked from GST Credit Note ${creditNoteNumber} (${data.reason})`,
          'credit_note',
          creditNoteNumber
        );
      }
    }

    const creditNote: CreditNote = {
      id: `cn-${Date.now()}`,
      businessId: ctx.businessId,
      creditNoteNumber,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      reason: data.reason,
      items: data.items.map(it => ({
        ...it,
        total: it.quantity * it.unitPrice,
      })),
      subtotal,
      taxAmount,
      totalAmount,
      issuedAt: new Date().toISOString(),
      createdBy: `${ctx.userName || 'Accountant'} (${ctx.userRole})`,
    };

    // Reduce customer's invoice balance & outstanding balance
    invoice.balanceDue = Math.max(0, Math.round((invoice.balanceDue - totalAmount) * 100) / 100);
    if (invoice.balanceDue === 0 && invoice.status !== 'void') {
      invoice.status = 'paid';
    }
    customer.outstandingBalance = Math.max(0, Math.round((customer.outstandingBalance - totalAmount) * 100) / 100);

    this.data.creditNotes.unshift(creditNote);
    this.addAuditLog(
      ctx,
      'CREDIT_NOTE_ISSUED',
      'sales',
      creditNote.id,
      `Issued GST Credit Note ${creditNote.creditNoteNumber} for ₹${totalAmount} against ${invoice.invoiceNumber}. Reason: ${data.reason}`
    );
    this.persist();
    return creditNote;
  }

  // --- Payments with Idempotency Protection ---
  public getPayments(businessId: string): Payment[] {
    return this.data.payments.filter(p => p.businessId === businessId);
  }

  public recordPayment(
    ctx: SessionContext,
    data: {
      invoiceId?: string;
      customerId: string;
      amount: number;
      paymentMethod: Payment['paymentMethod'];
      referenceNumber?: string;
      razorpayOrderId?: string;
      razorpayPaymentId?: string;
      notes?: string;
    }
  ): Payment {
    const customer = this.getCustomerById(ctx.businessId, data.customerId);
    if (!customer) throw new Error('Customer not found');

    // Idempotency check on Razorpay payment ID
    if (data.razorpayPaymentId) {
      const existing = this.data.payments.find(
        p => p.razorpayPaymentId === data.razorpayPaymentId && p.businessId === ctx.businessId
      );
      if (existing) {
        console.log(`Idempotent skip: Razorpay payment ${data.razorpayPaymentId} already processed.`);
        return existing;
      }
    }

    let invoice: Invoice | undefined;
    if (data.invoiceId) {
      invoice = this.data.invoices.find(i => i.id === data.invoiceId && i.businessId === ctx.businessId);
      if (!invoice) throw new Error('Associated invoice not found');
    }

    const paymentNumber = `PAY-2026-${String(this.data.payments.length + 1).padStart(3, '0')}`;
    const payment: Payment = {
      id: `pay-${Date.now()}`,
      businessId: ctx.businessId,
      paymentNumber,
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoiceNumber,
      orderId: invoice?.orderId,
      customerId: customer.id,
      customerName: customer.name,
      amount: data.amount,
      paymentMethod: data.paymentMethod,
      status: 'paid',
      referenceNumber:
        data.referenceNumber ||
        (data.paymentMethod === 'razorpay' ? `RZP-${Date.now()}` : `REF-${Date.now()}`),
      razorpayOrderId: data.razorpayOrderId,
      razorpayPaymentId: data.razorpayPaymentId,
      notes: data.notes,
      receivedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    this.data.payments.unshift(payment);

    if (invoice) {
      const newPaid = invoice.amountPaid + data.amount;
      invoice.amountPaid = Math.round(newPaid * 100) / 100;
      invoice.balanceDue = Math.max(0, Math.round((invoice.totalAmount - invoice.amountPaid) * 100) / 100);
      invoice.version = (invoice.version || 1) + 1;

      if (invoice.balanceDue <= 0) {
        invoice.status = 'paid';
      } else {
        invoice.status = 'partially_paid';
      }

      customer.outstandingBalance = Math.max(0, Math.round((customer.outstandingBalance - data.amount) * 100) / 100);

      if (invoice.orderId) {
        const order = this.data.orders.find(o => o.id === invoice?.orderId);
        if (order) {
          order.paymentStatus = invoice.balanceDue <= 0 ? 'paid' : 'partially_paid';
        }
      }
    }

    this.addAuditLog(
      ctx,
      'PAYMENT_RECORDED',
      'payments',
      payment.id,
      `Recorded ${payment.paymentMethod.toUpperCase()} payment of ₹${data.amount} for ${customer.name} (Ref: ${payment.referenceNumber})`
    );
    this.persist();
    return payment;
  }

  // --- Services, Bookings & Field Technician BOM Bridge ---
  public getServices(businessId: string): ServiceOffering[] {
    return this.data.services.filter(s => s.businessId === businessId && s.active);
  }

  public createService(ctx: SessionContext, data: Omit<ServiceOffering, 'id' | 'businessId'>): ServiceOffering {
    const srv: ServiceOffering = {
      id: `srv-${Date.now()}`,
      businessId: ctx.businessId,
      ...data,
      sacCode: data.sacCode || '9987',
    };
    this.data.services.unshift(srv);
    this.addAuditLog(ctx, 'SERVICE_CREATED', 'bookings', srv.id, `Added service offering ${srv.name} (SAC: ${srv.sacCode})`);
    this.persist();
    return srv;
  }

  public getBookings(businessId: string): Booking[] {
    return this.data.bookings.filter(b => b.businessId === businessId);
  }

  public createBooking(
    ctx: SessionContext,
    data: {
      serviceId: string;
      customerId: string;
      staffName: string;
      date: string;
      startTime: string;
      endTime: string;
      depositPaid?: boolean;
      partsUsed?: Booking['partsUsed'];
      notes?: string;
    }
  ): Booking {
    const service = this.data.services.find(s => s.id === data.serviceId && s.businessId === ctx.businessId);
    if (!service) throw new Error('Service offering not found');
    const customer = this.getCustomerById(ctx.businessId, data.customerId);
    if (!customer) throw new Error('Customer not found');

    const conflicts = this.data.bookings.filter(
      b =>
        b.businessId === ctx.businessId &&
        b.date === data.date &&
        b.staffName === data.staffName &&
        b.status !== 'cancelled' &&
        ((data.startTime >= b.startTime && data.startTime < b.endTime) ||
          (data.endTime > b.startTime && data.endTime <= b.endTime) ||
          (data.startTime <= b.startTime && data.endTime >= b.endTime))
    );

    if (conflicts.length > 0) {
      throw new Error(
        `Schedule Conflict: ${data.staffName} already has an active booking (${conflicts[0].bookingNumber} - ${conflicts[0].serviceName}) from ${conflicts[0].startTime} to ${conflicts[0].endTime}.`
      );
    }

    const bookingNumber = `BKG-2026-${String(this.data.bookings.length + 1).padStart(3, '0')}`;
    const booking: Booking = {
      id: `bkg-${Date.now()}`,
      businessId: ctx.businessId,
      bookingNumber,
      serviceId: service.id,
      serviceName: service.name,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      staffName: data.staffName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      status: 'confirmed',
      depositAmount: service.depositRequired,
      depositStatus: data.depositPaid ? 'paid' : service.depositRequired > 0 ? 'pending' : 'waived',
      totalAmount: service.price,
      partsUsed: data.partsUsed || [],
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };

    this.data.bookings.unshift(booking);
    this.addAuditLog(ctx, 'BOOKING_CREATED', 'bookings', booking.id, `Created booking ${booking.bookingNumber} for ${customer.name}`);
    this.persist();
    return booking;
  }

  public updateBookingStatus(ctx: SessionContext, id: string, status: Booking['status']): Booking {
    const booking = this.data.bookings.find(b => b.id === id && b.businessId === ctx.businessId);
    if (!booking) throw new Error('Booking not found');
    booking.status = status;
    this.addAuditLog(ctx, 'BOOKING_STATUS_UPDATED', 'bookings', booking.id, `Updated booking ${booking.bookingNumber} status to ${status}`);
    this.persist();
    return booking;
  }

  /**
   * Field Technician BOM Bridge:
   * Marks booking completed, deducts hardware parts used from inventory,
   * and generates a combined GST invoice (SAC + HSN) deducting deposit amount.
   */
  public completeJobAndGenerateInvoice(
    ctx: SessionContext,
    bookingId: string,
    partsUsed: Booking['partsUsed']
  ): { booking: Booking; invoice: Invoice } {
    const booking = this.data.bookings.find(b => b.id === bookingId && b.businessId === ctx.businessId);
    if (!booking) throw new Error('Booking not found');
    if (booking.status === 'completed' && booking.generatedInvoiceId) {
      throw new Error(`Job ${booking.bookingNumber} already completed with invoice ${booking.generatedInvoiceId}`);
    }

    const customer = this.getCustomerById(ctx.businessId, booking.customerId);
    if (!customer) throw new Error('Customer not found');
    const service = this.data.services.find(s => s.id === booking.serviceId);

    // Save attached parts on booking
    booking.partsUsed = partsUsed || booking.partsUsed || [];

    // Deduct hardware parts used from inventory
    for (const part of booking.partsUsed) {
      this.adjustStock(
        ctx,
        part.productId,
        -part.quantity,
        `Field service usage for ${booking.bookingNumber} (${customer.name})`,
        'service_job',
        booking.bookingNumber
      );
    }

    // Build combined invoice line items
    const invoiceItems: Array<{
      productId?: string;
      description: string;
      hsnCode?: string;
      sacCode?: string;
      quantity: number;
      unitPrice: number;
    }> = [
      {
        description: `Service: ${booking.serviceName}`,
        sacCode: service?.sacCode || '9987',
        quantity: 1,
        unitPrice: booking.totalAmount,
      },
    ];

    for (const part of booking.partsUsed) {
      invoiceItems.push({
        productId: part.productId,
        description: `Part: ${part.name} (${part.sku})`,
        hsnCode: part.hsnCode || '8544',
        quantity: part.quantity,
        unitPrice: part.unitPrice,
      });
    }

    // Generate combined invoice
    const dueDate = new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0];
    const invoice = this.createInvoice(ctx, {
      customerId: customer.id,
      items: invoiceItems,
      dueDate,
      notes: `Generated from completed field service visit ${booking.bookingNumber} by ${booking.staffName}.`,
    });

    // Credit deposit if already paid
    if (booking.depositStatus === 'paid' && booking.depositAmount > 0) {
      invoice.amountPaid = booking.depositAmount;
      invoice.balanceDue = Math.max(0, Math.round((invoice.totalAmount - invoice.amountPaid) * 100) / 100);
      invoice.status = invoice.balanceDue === 0 ? 'paid' : 'partially_paid';
    }

    booking.status = 'completed';
    booking.generatedInvoiceId = invoice.id;

    this.addAuditLog(
      ctx,
      'SERVICE_JOB_COMPLETED_AND_INVOICED',
      'bookings',
      booking.id,
      `Completed job ${booking.bookingNumber}, deducted ${booking.partsUsed.length} hardware parts, generated Invoice ${invoice.invoiceNumber}`
    );
    this.persist();
    return { booking, invoice };
  }

  // --- RMA & Serial Number / Warranty Lookup ---
  public lookupSerialNumber(businessId: string, serial: string): SerialWarrantyLookupResult | null {
    const q = serial.trim().toLowerCase();
    const suppliers = this.getSuppliers(businessId);
    const invoices = this.getInvoices(businessId);
    const products = this.getProducts(businessId);

    for (const inv of invoices) {
      for (const item of inv.items) {
        if (item.serialNumbers && item.serialNumbers.some(s => s.toLowerCase() === q)) {
          const matchedSerial = item.serialNumbers.find(s => s.toLowerCase() === q)!;
          const prod = item.productId ? products.find(p => p.id === item.productId) : null;
          const supplier = prod?.preferredSupplierId ? suppliers.find(s => s.id === prod.preferredSupplierId) : null;

          const warrantyMonths = prod?.warrantyMonths || 12;
          const saleDate = inv.issueDate;
          const saleDateObj = new Date(saleDate);
          const expiryDateObj = new Date(saleDateObj);
          expiryDateObj.setMonth(expiryDateObj.getMonth() + warrantyMonths);
          const warrantyExpiryDate = expiryDateObj.toISOString().split('T')[0];
          const isWarrantyActive = expiryDateObj > new Date();

          return {
            serialNumber: matchedSerial,
            productName: prod?.name || item.description,
            sku: prod?.sku || 'GENERIC',
            hsnCode: prod?.hsnCode || item.hsnCode || '8504',
            warrantyMonths,
            saleDate,
            warrantyExpiryDate,
            isWarrantyActive,
            customerName: inv.customerName,
            customerPhone: inv.customerPhone,
            invoiceNumber: inv.invoiceNumber,
            supplierName: supplier?.name || 'Authorized Distributor',
          };
        }
      }
    }
    return null;
  }

  // --- AI Action Proposals & Execution Engine ---
  public getActionProposals(businessId: string): AiActionProposal[] {
    return this.data.actionProposals.filter(p => p.businessId === businessId);
  }

  public createActionProposal(
    ctx: SessionContext,
    proposal: Omit<AiActionProposal, 'id' | 'businessId' | 'status' | 'createdAt'>
  ): AiActionProposal {
    const fullProposal: AiActionProposal = {
      id: `prop-${Date.now()}`,
      businessId: ctx.businessId,
      ...proposal,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };
    this.data.actionProposals.unshift(fullProposal);
    this.data.proposalStats.totalCreated = (this.data.proposalStats.totalCreated || 0) + 1;
    this.persist();
    return fullProposal;
  }

  public rejectActionProposal(ctx: SessionContext, proposalId: string): AiActionProposal {
    const proposal = this.data.actionProposals.find(p => p.id === proposalId && p.businessId === ctx.businessId);
    if (!proposal) throw new Error('Action proposal not found');
    proposal.status = 'rejected';
    this.data.proposalStats.rejected = (this.data.proposalStats.rejected || 0) + 1;
    this.addAuditLog(ctx, 'AI_ACTION_REJECTED', 'ai', proposal.id, `Rejected AI proposal: ${proposal.title}`);
    this.persist();
    return proposal;
  }

  public executeActionProposal(ctx: SessionContext, proposalId: string): { success: boolean; result: string } {
    const proposal = this.data.actionProposals.find(p => p.id === proposalId && p.businessId === ctx.businessId);
    if (!proposal) throw new Error('Action proposal not found');
    if (proposal.status === 'executed') throw new Error('Proposal has already been executed');

    let resultMessage = '';
    switch (proposal.actionType) {
      case 'CREATE_PURCHASE_ORDER': {
        const payload = proposal.payload;
        const po = this.createPurchaseOrder(ctx, {
          supplierId: payload.supplierId,
          items: payload.items,
          expectedDeliveryDate:
            payload.expectedDeliveryDate ||
            new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          notes: `Created via RazBuddy AI approval: ${proposal.title}`,
        });
        resultMessage = `Created Purchase Order ${po.poNumber} with ${po.items.length} line items totaling ₹${po.totalAmount.toLocaleString('en-IN')}`;
        break;
      }
      case 'UPDATE_STOCK_ADJUSTMENT': {
        const { productId, adjustmentQty, reason } = proposal.payload;
        const res = this.adjustStock(
          ctx,
          productId,
          adjustmentQty,
          reason || 'AI approved stock adjustment',
          'ai_action',
          proposal.id
        );
        resultMessage = `Adjusted stock for ${res.product.name} by ${adjustmentQty > 0 ? '+' : ''}${adjustmentQty}. New level: ${res.product.currentStock}`;
        break;
      }
      case 'CONFIRM_BOOKING': {
        const { bookingId } = proposal.payload;
        const bkg = this.updateBookingStatus(ctx, bookingId, 'confirmed');
        resultMessage = `Confirmed appointment ${bkg.bookingNumber} for ${bkg.customerName}`;
        break;
      }
      case 'ISSUE_INVOICE': {
        const inv = this.createInvoice(ctx, proposal.payload);
        resultMessage = `Issued invoice ${inv.invoiceNumber} for ₹${inv.totalAmount}`;
        break;
      }
      case 'SEND_INVOICE_REMINDERS': {
        const count = proposal.payload.invoiceIds?.length || 0;
        for (const invId of proposal.payload.invoiceIds || []) {
          this.updateInvoiceDeliveryStatus(ctx, invId, 'sent');
        }
        resultMessage = `Dispatched GST reminder deep links for ${count} invoice(s) via WhatsApp/SMS queue`;
        break;
      }
      case 'OVERRIDE_CREDIT_HOLD': {
        const { orderId, reason } = proposal.payload;
        const ord = this.overrideCreditHold(ctx, orderId, reason || 'AI recommendation accepted by Owner');
        resultMessage = `Overrode credit hold for Order ${ord.orderNumber}. Inventory deducted and order confirmed.`;
        break;
      }
      default:
        throw new Error(`Unsupported action type: ${proposal.actionType}`);
    }

    proposal.status = 'executed';
    proposal.executedAt = new Date().toISOString();
    proposal.executedBy = `${ctx.userName || 'Operator'} (${ctx.userRole})`;
    proposal.executionResult = resultMessage;

    this.data.proposalStats.approved = (this.data.proposalStats.approved || 0) + 1;
    this.data.proposalStats.executed = (this.data.proposalStats.executed || 0) + 1;

    this.addAuditLog(ctx, 'AI_ACTION_EXECUTED', 'ai', proposal.id, `Executed AI action: ${proposal.title} - ${resultMessage}`);
    this.persist();
    return { success: true, result: resultMessage };
  }

  // --- Dynamic Dashboard Metrics with Date Filter Range ---
  public getDashboardStats(businessId: string, dateRange: 'today' | '7d' | '30d' | 'all' = '30d') {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let startDateMs = 0;
    if (dateRange === 'today') {
      startDateMs = new Date(todayStr).getTime();
    } else if (dateRange === '7d') {
      startDateMs = now.getTime() - 7 * 86400000;
    } else if (dateRange === '30d') {
      startDateMs = now.getTime() - 30 * 86400000;
    }

    const allInvoices = this.getInvoices(businessId);
    const allOrders = this.getOrders(businessId);
    const allPayments = this.getPayments(businessId);
    const allProducts = this.getProducts(businessId);
    const allBookings = this.getBookings(businessId);
    const allPOs = this.getPurchaseOrders(businessId);

    // Filtered collections
    const collections = allPayments
      .filter(p => new Date(p.receivedAt).getTime() >= startDateMs)
      .reduce((sum, p) => sum + p.amount, 0);

    // Collections today specifically
    const collectionsToday = allPayments
      .filter(p => p.receivedAt.startsWith(todayStr))
      .reduce((sum, p) => sum + p.amount, 0);

    // Outstanding receivables
    const outstandingReceivables = allInvoices
      .filter(i => i.status !== 'void')
      .reduce((sum, i) => sum + i.balanceDue, 0);

    // Orders awaiting fulfilment
    const ordersAwaitingFulfilment = allOrders.filter(
      o => o.status === 'confirmed' || o.status === 'processing'
    ).length;

    // Credit hold orders
    const ordersOnCreditHold = allOrders.filter(o => o.status === 'pending_approval').length;

    // Low stock items
    const lowStockCount = allProducts.filter(p => p.currentStock <= p.reorderThreshold).length;

    // Upcoming bookings
    const upcomingBookings = allBookings.filter(
      b => b.date >= todayStr && b.status !== 'cancelled' && b.status !== 'completed'
    ).length;

    // Filtered sales in range
    const totalSalesRange = allOrders
      .filter(o => o.status !== 'cancelled' && new Date(o.createdAt).getTime() >= startDateMs)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Acceptance rate of AI suggestions
    const totalCreated = this.data.proposalStats?.totalCreated || 0;
    const approved = this.data.proposalStats?.approved || 0;
    const aiAcceptanceRate = totalCreated > 0 ? Math.round((approved / totalCreated) * 100) : 92;

    // Actionable Needs Attention items
    const needsAttention: Array<{
      id: string;
      type: 'overdue_invoice' | 'low_stock' | 'pending_po' | 'pending_booking' | 'credit_hold';
      title: string;
      description: string;
      severity: 'high' | 'medium';
      actionLabel: string;
      linkTo: string;
    }> = [];

    // 1. Credit Hold Orders
    const creditHoldOrders = allOrders.filter(o => o.status === 'pending_approval');
    for (const ord of creditHoldOrders) {
      needsAttention.push({
        id: `att-ch-${ord.id}`,
        type: 'credit_hold',
        title: `Credit Hold: Order ${ord.orderNumber}`,
        description: `₹${ord.totalAmount.toLocaleString('en-IN')} for ${ord.customerName} (${ord.creditHoldReason || 'Exceeds credit limit'})`,
        severity: 'high',
        actionLabel: 'Review Hold',
        linkTo: '/sales?tab=orders',
      });
    }

    // 2. Overdue invoices
    const overdueInvoices = allInvoices.filter(i => i.status === 'overdue' || (i.balanceDue > 0 && i.dueDate < todayStr));
    for (const inv of overdueInvoices) {
      needsAttention.push({
        id: `att-inv-${inv.id}`,
        type: 'overdue_invoice',
        title: `Overdue Invoice ${inv.invoiceNumber}`,
        description: `₹${inv.balanceDue.toLocaleString('en-IN')} pending from ${inv.customerName} (due ${inv.dueDate})`,
        severity: 'high',
        actionLabel: 'Follow up',
        linkTo: '/sales?tab=followup',
      });
    }

    // 3. Critical Low Stock
    const criticalStock = allProducts.filter(p => p.currentStock <= p.reorderThreshold);
    for (const prod of criticalStock.slice(0, 3)) {
      needsAttention.push({
        id: `att-prod-${prod.id}`,
        type: 'low_stock',
        title: `Low Stock: ${prod.name}`,
        description: `${prod.currentStock} ${prod.unit} remaining (Reorder threshold: ${prod.reorderThreshold})`,
        severity: prod.currentStock <= Math.floor(prod.reorderThreshold / 2) ? 'high' : 'medium',
        actionLabel: 'Reorder',
        linkTo: '/inventory?tab=alerts',
      });
    }

    // 4. Purchase orders awaiting approval
    const pendingPOs = allPOs.filter(p => p.status === 'awaiting_approval');
    for (const po of pendingPOs) {
      needsAttention.push({
        id: `att-po-${po.id}`,
        type: 'pending_po',
        title: `PO Awaiting Approval: ${po.poNumber}`,
        description: `₹${po.totalAmount.toLocaleString('en-IN')} for ${po.supplierName}`,
        severity: 'medium',
        actionLabel: 'Review PO',
        linkTo: '/inventory?tab=pos',
      });
    }

    // 5. Requested bookings
    const requestedBookings = allBookings.filter(b => b.status === 'requested');
    for (const bkg of requestedBookings) {
      needsAttention.push({
        id: `att-bkg-${bkg.id}`,
        type: 'pending_booking',
        title: `Unconfirmed Booking: ${bkg.bookingNumber}`,
        description: `${bkg.serviceName} with ${bkg.customerName} on ${bkg.date} at ${bkg.startTime}`,
        severity: 'medium',
        actionLabel: 'Confirm',
        linkTo: '/bookings?tab=appointments',
      });
    }

    return {
      dateRange,
      metrics: {
        collectionsToday,
        collectionsRange: collections,
        outstandingReceivables,
        ordersAwaitingFulfilment,
        ordersOnCreditHold,
        lowStockCount,
        upcomingBookings,
        totalSalesRange,
        aiAcceptanceRate,
      },
      needsAttention,
      recentActivity: this.getAuditLogs(businessId).slice(0, 8),
      recentOrders: allOrders.slice(0, 5),
    };
  }

  // --- Settings ---
  public getSettings(): BusinessSettings {
    return this.data.settings;
  }

  public updateSettings(updates: Partial<BusinessSettings>): BusinessSettings {
    this.data.settings = { ...this.data.settings, ...updates };
    this.persist();
    return this.data.settings;
  }
}

export const store = new DataStore();
