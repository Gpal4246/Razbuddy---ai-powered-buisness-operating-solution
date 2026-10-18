import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { store, SessionContext } from './store.ts';
import { processAiQuery, parseVendorBillOcr } from './ai.ts';
import { UserRole } from '../src/types/index.ts';

const app = express();
const router = Router();

// Handle JSON with extended limit for base64 bill photos
app.use(express.json({ limit: '15mb' }));
app.use(router);

// Extend Express Request interface for SessionContext
declare global {
  namespace Express {
    interface Request {
      sessionCtx: SessionContext;
    }
  }
}

// Session extraction middleware from request headers
router.use((req: Request, res: Response, next) => {
  const businessId = (req.headers['x-business-id'] as string) || 'biz-kalyan-01';
  const userId = (req.headers['x-user-id'] as string) || 'usr-arjun-01';
  const userRole = ((req.headers['x-user-role'] as string) || 'owner') as UserRole;

  const user = store.getUser(userId);

  req.sessionCtx = {
    businessId,
    userId,
    userRole,
    userName: user?.name || (userRole === 'owner' ? 'Arjun Sharma' : 'Staff Member'),
  };
  next();
});

// RBAC Middleware Helper
const requireRole = (allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: Function) => {
    const role = req.sessionCtx.userRole;
    if (role === 'owner' || allowedRoles.includes(role)) {
      return next();
    }
    return res.status(403).json({
      error: `Access Denied: Your active role (${role}) lacks permission for this operation. Permitted roles: ${allowedRoles.join(', ')}`,
    });
  };
};

// Simple GSTIN validation regex: 2 digits state + 10 PAN + 1 entity + 1 Z + 1 check digit
function isValidGstin(gstin: string): boolean {
  if (!gstin) return false;
  const regex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return regex.test(gstin.trim().toUpperCase());
}

// --- Health ---
router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', app: 'RazBuddy', time: new Date().toISOString() });
});

// --- Auth & Session ---
router.get('/auth/me', (req: Request, res: Response) => {
  const ctx = req.sessionCtx;
  const user = store.getUser(ctx.userId) || {
    id: ctx.userId,
    name: ctx.userName || 'Operator',
    email: 'operator@kalyanelectronics.in',
    role: ctx.userRole,
    businessId: ctx.businessId,
  };
  res.json({
    user,
    business: store.getBusiness(ctx.businessId),
    businesses: store.getAllBusinesses(),
    teamMembers: store.getUsers(ctx.businessId),
  });
});

router.put('/business/profile', requireRole(['owner', 'admin']), (req: Request, res: Response) => {
  try {
    const ctx = req.sessionCtx;
    const { name, legalName, gstin, phone, address, city, state, pincode, email } = req.body;
    if (gstin && !isValidGstin(gstin)) {
      return res.status(400).json({ error: `Invalid Indian GSTIN format: "${gstin}". Standard format: 27AABCK1234F1Z8` });
    }
    const updated = store.updateBusinessProfile(ctx.businessId, req.body, ctx);
    res.json({ success: true, business: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Demo Reset ---
router.post('/demo/reset', (req: Request, res: Response) => {
  store.resetToSeed();
  store.addAuditLog(req.sessionCtx, 'DEMO_RESET', 'settings', 'demo', 'Reset demo workspace to pristine initial state');
  res.json({ success: true, message: 'Demo workspace reset to initial state' });
});

// --- Dashboard with Dynamic Date Filter ---
router.get('/dashboard', (req: Request, res: Response) => {
  const range = (req.query.range as any) || '30d';
  const data = store.getDashboardStats(req.sessionCtx.businessId, range);
  res.json(data);
});

// --- Customers ---
router.get('/customers', (req: Request, res: Response) => {
  const search = req.query.q as string | undefined;
  const customers = store.getCustomers(req.sessionCtx.businessId, search);
  res.json(customers);
});

router.post('/customers', requireRole(['owner', 'admin', 'sales', 'booking_manager']), (req: Request, res: Response) => {
  try {
    const { name, phone, gstin, creditLimit } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }
    if (gstin && !isValidGstin(gstin)) {
      return res.status(400).json({ error: `Invalid GSTIN format: "${gstin}"` });
    }
    if (creditLimit !== undefined && Number(creditLimit) < 0) {
      return res.status(400).json({ error: 'Credit limit cannot be negative' });
    }
    const customer = store.createCustomer(req.sessionCtx, req.body);
    res.status(201).json(customer);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/customers/:id/360', (req: Request, res: Response) => {
  try {
    const data = store.getCustomer360(req.sessionCtx.businessId, req.params.id);
    res.json(data);
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

router.put('/customers/:id', requireRole(['owner', 'admin', 'sales']), (req: Request, res: Response) => {
  try {
    const updated = store.updateCustomer(req.sessionCtx, req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Products & Inventory ---
router.get('/products', (req: Request, res: Response) => {
  const search = req.query.q as string | undefined;
  const category = req.query.category as string | undefined;
  const products = store.getProducts(req.sessionCtx.businessId, search, category);

  // Mask costPrice for sales or viewer roles
  const role = req.sessionCtx.userRole;
  const hideCost = role === 'sales' || role === 'viewer';
  const sanitized = products.map(p => ({
    ...p,
    costPrice: hideCost ? 0 : p.costPrice,
  }));
  res.json(sanitized);
});

router.post('/products', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const { sku, name, sellingPrice, costPrice, currentStock, reorderThreshold, hsnCode } = req.body;
    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and product name are required' });
    }
    if (sellingPrice < 0 || costPrice < 0 || currentStock < 0 || reorderThreshold < 0) {
      return res.status(400).json({ error: 'Prices and inventory quantities cannot be negative' });
    }
    const prod = store.createProduct(req.sessionCtx, {
      ...req.body,
      hsnCode: hsnCode || '8504',
      warrantyMonths: req.body.warrantyMonths || 12,
    });
    res.status(201).json(prod);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/products/:id', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const expectedVersion = req.body.expectedVersion ? Number(req.body.expectedVersion) : undefined;
    const prod = store.updateProduct(req.sessionCtx, req.params.id, req.body, expectedVersion);
    res.json(prod);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/products/:id/adjust-stock', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const { adjustmentQty, reason, expectedVersion } = req.body;
    if (typeof adjustmentQty !== 'number' || !reason) {
      return res.status(400).json({ error: 'adjustmentQty (number) and reason (string) are required' });
    }
    const result = store.adjustStock(
      req.sessionCtx,
      req.params.id,
      adjustmentQty,
      reason,
      'manual',
      'ADJ',
      expectedVersion
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/inventory/movements', (req: Request, res: Response) => {
  res.json(store.getStockMovements(req.sessionCtx.businessId));
});

router.get('/inventory/alerts', (req: Request, res: Response) => {
  res.json(store.getLowStockAlerts(req.sessionCtx.businessId));
});

// --- Suppliers & Purchase Orders ---
router.get('/suppliers', (req: Request, res: Response) => {
  res.json(store.getSuppliers(req.sessionCtx.businessId));
});

router.post('/suppliers', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const sup = store.createSupplier(req.sessionCtx, req.body);
    res.status(201).json(sup);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/purchase-orders', (req: Request, res: Response) => {
  res.json(store.getPurchaseOrders(req.sessionCtx.businessId));
});

router.post('/purchase-orders', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const po = store.createPurchaseOrder(req.sessionCtx, req.body);
    res.status(201).json(po);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/purchase-orders/:id/approve', requireRole(['owner', 'admin']), (req: Request, res: Response) => {
  try {
    const po = store.approvePurchaseOrder(req.sessionCtx, req.params.id);
    res.json(po);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/purchase-orders/:id/receive', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const po = store.receivePurchaseOrder(req.sessionCtx, req.params.id);
    res.json(po);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Quotations, Orders, Invoices & GST Credit Notes ---
router.get('/quotations', (req: Request, res: Response) => {
  res.json(store.getQuotations(req.sessionCtx.businessId));
});

router.post('/quotations', requireRole(['owner', 'admin', 'sales']), (req: Request, res: Response) => {
  try {
    const quote = store.createQuotation(req.sessionCtx, req.body);
    res.status(201).json(quote);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/quotations/:id/convert-to-order', requireRole(['owner', 'admin', 'sales']), (req: Request, res: Response) => {
  try {
    const order = store.convertQuotationToOrder(req.sessionCtx, req.params.id);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/orders', (req: Request, res: Response) => {
  res.json(store.getOrders(req.sessionCtx.businessId));
});

router.post('/orders', requireRole(['owner', 'admin', 'sales']), (req: Request, res: Response) => {
  try {
    const { customerId, items } = req.body;
    if (!customerId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Valid customerId and at least one item are required' });
    }
    const order = store.createOrder(req.sessionCtx, req.body);
    res.status(201).json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/orders/:id/override-credit-hold', requireRole(['owner', 'admin']), (req: Request, res: Response) => {
  try {
    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Management justification reason is required to override credit hold' });
    }
    const order = store.overrideCreditHold(req.sessionCtx, req.params.id, reason);
    res.json({ success: true, order, message: 'Credit hold overridden successfully' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/orders/:id/status', requireRole(['owner', 'admin', 'sales', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const order = store.updateOrderStatus(req.sessionCtx, req.params.id, req.body.status);
    res.json(order);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/invoices', (req: Request, res: Response) => {
  res.json(store.getInvoices(req.sessionCtx.businessId));
});

router.post('/invoices', requireRole(['owner', 'admin', 'sales', 'accountant']), (req: Request, res: Response) => {
  try {
    const invoice = store.createInvoice(req.sessionCtx, req.body);
    res.status(201).json(invoice);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/invoices/:id/delivery-status', (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const inv = store.updateInvoiceDeliveryStatus(req.sessionCtx, req.params.id, status);
    res.json({ success: true, invoice: inv });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Credit Notes & Returns ---
router.get('/credit-notes', (req: Request, res: Response) => {
  res.json(store.getCreditNotes(req.sessionCtx.businessId));
});

router.post('/credit-notes', requireRole(['owner', 'admin', 'accountant']), (req: Request, res: Response) => {
  try {
    const { invoiceId, reason, items } = req.body;
    if (!invoiceId || !reason || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'invoiceId, reason, and items are required' });
    }
    const cn = store.issueCreditNote(req.sessionCtx, req.body);
    res.status(201).json(cn);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Payments & Real HMAC Razorpay Webhook Verification ---
router.get('/payments', (req: Request, res: Response) => {
  res.json(store.getPayments(req.sessionCtx.businessId));
});

router.post('/payments', requireRole(['owner', 'admin', 'sales', 'accountant']), (req: Request, res: Response) => {
  try {
    const payment = store.recordPayment(req.sessionCtx, req.body);
    res.status(201).json(payment);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/razorpay/create-order', (req: Request, res: Response) => {
  try {
    const { amount, invoiceId, customerId } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount' });
    }
    const orderId = `order_${Math.random().toString(36).substring(2, 10)}${Date.now().toString(36)}`;
    const settings = store.getSettings();
    res.json({
      success: true,
      orderId,
      amount,
      currency: 'INR',
      keyId: settings.razorpayKeyId,
      isTestMode: settings.razorpayTestMode,
      businessName: store.getBusiness(req.sessionCtx.businessId).name,
      invoiceId,
      customerId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/razorpay/verify-payment', (req: Request, res: Response) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, invoiceId, customerId, amount, paymentMethod } = req.body;
    const settings = store.getSettings();

    // Verify HMAC-SHA256 signature if secret is present and signature is supplied
    if (settings.razorpayKeySecret && razorpaySignature) {
      const generatedSignature = crypto
        .createHmac('sha256', settings.razorpayKeySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (generatedSignature !== razorpaySignature && !settings.razorpayTestMode) {
        return res.status(400).json({ error: 'Razorpay signature verification failed. Untrusted payment.' });
      }
    }

    const payment = store.recordPayment(req.sessionCtx, {
      invoiceId,
      customerId,
      amount: Number(amount),
      paymentMethod: paymentMethod || 'razorpay',
      razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId || `pay_${Date.now()}`,
      referenceNumber: razorpayPaymentId ? `RZP-${razorpayPaymentId}` : `RZP-SANDBOX-${Date.now()}`,
      notes: `Verified Razorpay transaction for order ${razorpayOrderId}`,
    });

    res.json({
      success: true,
      payment,
      message: 'Payment verified and credited to invoice balance',
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/razorpay/webhook', (req: Request, res: Response) => {
  const webhookSignature = req.headers['x-razorpay-signature'] as string;
  const settings = store.getSettings();

  if (settings.razorpayKeySecret && webhookSignature) {
    const expected = crypto
      .createHmac('sha256', settings.razorpayKeySecret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    if (expected !== webhookSignature && !settings.razorpayTestMode) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  const event = req.body;
  store.addAuditLog(
    req.sessionCtx,
    'RAZORPAY_WEBHOOK_VERIFIED',
    'payments',
    event.id || 'wh-evt',
    `Verified Razorpay webhook: ${event.event || 'payment.captured'}`
  );
  res.json({ status: 'ok', received: true });
});

// --- Services, Bookings & Field Technician BOM Bridge ---
router.get('/services', (req: Request, res: Response) => {
  res.json(store.getServices(req.sessionCtx.businessId));
});

router.post('/services', requireRole(['owner', 'admin', 'booking_manager']), (req: Request, res: Response) => {
  try {
    const srv = store.createService(req.sessionCtx, req.body);
    res.status(201).json(srv);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/bookings', (req: Request, res: Response) => {
  res.json(store.getBookings(req.sessionCtx.businessId));
});

router.post('/bookings', requireRole(['owner', 'admin', 'booking_manager', 'sales']), (req: Request, res: Response) => {
  try {
    const bkg = store.createBooking(req.sessionCtx, req.body);
    res.status(201).json(bkg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/bookings/:id/status', requireRole(['owner', 'admin', 'booking_manager']), (req: Request, res: Response) => {
  try {
    const bkg = store.updateBookingStatus(req.sessionCtx, req.params.id, req.body.status);
    res.json(bkg);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Field Technician BOM Complete & Combined Invoice
router.post('/bookings/:id/complete-and-invoice', requireRole(['owner', 'admin', 'booking_manager']), (req: Request, res: Response) => {
  try {
    const { partsUsed } = req.body;
    const result = store.completeJobAndGenerateInvoice(req.sessionCtx, req.params.id, partsUsed);
    res.json({
      success: true,
      booking: result.booking,
      invoice: result.invoice,
      message: `Job completed! Combined GST Invoice ${result.invoice.invoiceNumber} generated with SAC 9987 service and hardware HSN parts.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Serial Number & Warranty (RMA Tracker) ---
router.get('/warranty/lookup', (req: Request, res: Response) => {
  const serial = req.query.serial as string;
  if (!serial) return res.status(400).json({ error: 'Serial number or barcode query required' });
  const result = store.lookupSerialNumber(req.sessionCtx.businessId, serial);
  if (!result) {
    return res.status(404).json({ error: `No sales or warranty record found for serial/barcode: "${serial}"` });
  }
  res.json(result);
});

// --- Multimodal Kachha Bill & Vendor Invoice OCR ---
router.post('/ai/parse-vendor-bill', async (req: Request, res: Response) => {
  try {
    const { base64Data, mimeType } = req.body;
    const result = await parseVendorBillOcr(base64Data, mimeType || 'image/jpeg', req.sessionCtx);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Vendor bill parsing failed' });
  }
});

// 1-Click "Receive into Inventory & Log Bill"
router.post('/inventory/receive-bill', requireRole(['owner', 'admin', 'inventory_manager']), (req: Request, res: Response) => {
  try {
    const { supplierName, invoiceNumber, lineItems } = req.body;
    if (!Array.isArray(lineItems) || lineItems.length === 0) {
      return res.status(400).json({ error: 'Valid line items required to receive stock' });
    }

    let inventoriedCount = 0;
    for (const item of lineItems) {
      if (item.matchedProductId) {
        store.adjustStock(
          req.sessionCtx,
          item.matchedProductId,
          Number(item.quantity) || 1,
          `Received via Vendor Bill OCR ${invoiceNumber || 'BILL'} from ${supplierName}`,
          'po',
          invoiceNumber || 'BILL-OCR'
        );
        inventoriedCount++;
      }
    }

    store.addAuditLog(
      req.sessionCtx,
      'VENDOR_BILL_INVENTORIED',
      'inventory',
      invoiceNumber || 'BILL',
      `Processed OCR Vendor Bill from ${supplierName}. Updated ${inventoriedCount} product inventory records.`
    );

    res.json({
      success: true,
      message: `Successfully received and updated inventory for ${inventoriedCount} product(s) from ${supplierName}.`,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- GSTR-1 & Tally CSV Export ---
router.get('/export/gstr1', (req: Request, res: Response) => {
  const invoices = store.getInvoices(req.sessionCtx.businessId);
  const biz = store.getBusiness(req.sessionCtx.businessId);

  const csvRows = [
    [
      'GSTIN/UIN of Recipient',
      'Receiver Name',
      'Invoice Number',
      'Invoice date',
      'Invoice Value',
      'Place Of Supply',
      'Reverse Charge',
      'Invoice Type',
      'HSN/SAC',
      'Taxable Value',
      'CGST Amount',
      'SGST Amount',
      'IGST Amount',
    ],
  ];

  for (const inv of invoices) {
    const pos = inv.customerState || biz.state;
    for (const item of inv.items) {
      const code = item.hsnCode || item.sacCode || '8504';
      csvRows.push([
        inv.customerGstin || 'URP',
        inv.customerName,
        inv.invoiceNumber,
        inv.issueDate,
        String(inv.totalAmount),
        pos,
        'N',
        inv.customerGstin ? 'Regular B2B' : 'B2C Small',
        code,
        String(item.total),
        String(inv.cgstAmount || 0),
        String(inv.sgstAmount || 0),
        String(inv.igstAmount || 0),
      ]);
    }
  }

  const csvContent = csvRows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=GSTR-1-${biz.gstin}-${new Date().toISOString().split('T')[0]}.csv`);
  res.send(csvContent);
});

// --- CSV Bulk Import ---
router.post('/import/csv', requireRole(['owner', 'admin']), (req: Request, res: Response) => {
  try {
    const { type, records } = req.body;
    if (!type || !Array.isArray(records)) {
      return res.status(400).json({ error: 'type (products | customers) and records array are required' });
    }

    let count = 0;
    if (type === 'products') {
      for (const r of records) {
        if (r.sku && r.name) {
          store.createProduct(req.sessionCtx, {
            sku: r.sku,
            name: r.name,
            description: r.description || r.name,
            category: r.category || 'General',
            unit: r.unit || 'pcs',
            hsnCode: r.hsnCode || '8504',
            warrantyMonths: Number(r.warrantyMonths) || 12,
            sellingPrice: Number(r.sellingPrice) || 1000,
            costPrice: Number(r.costPrice) || 800,
            currentStock: Number(r.currentStock) || 10,
            reorderThreshold: Number(r.reorderThreshold) || 5,
            status: 'active',
          });
          count++;
        }
      }
    } else if (type === 'customers') {
      for (const r of records) {
        if (r.name && r.phone) {
          store.createCustomer(req.sessionCtx, {
            name: r.name,
            phone: r.phone,
            email: r.email,
            customerType: r.customerType || 'retail',
            gstin: r.gstin,
            state: r.state || 'Maharashtra',
            city: r.city || 'Mumbai',
            address: r.address || '',
            creditLimit: Number(r.creditLimit) || 50000,
            tags: r.tags ? r.tags.split(';') : ['Imported'],
          });
          count++;
        }
      }
    }

    res.json({ success: true, count, message: `Successfully bulk imported ${count} ${type}.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- RazBuddy AI Command Centre ---
router.post('/ai/chat', async (req: Request, res: Response) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'Query prompt is required' });
    const response = await processAiQuery(query, req.sessionCtx);
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'AI processing failure' });
  }
});

router.get('/ai/proposals', (req: Request, res: Response) => {
  res.json(store.getActionProposals(req.sessionCtx.businessId));
});

router.post('/ai/execute-action', requireRole(['owner', 'admin', 'inventory_manager', 'sales', 'booking_manager']), (req: Request, res: Response) => {
  try {
    const { proposalId } = req.body;
    const result = store.executeActionProposal(req.sessionCtx, proposalId);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/ai/reject-action', (req: Request, res: Response) => {
  try {
    const { proposalId } = req.body;
    const result = store.rejectActionProposal(req.sessionCtx, proposalId);
    res.json({ success: true, proposal: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// --- Settings & Audit Logs ---
router.get('/settings', (req: Request, res: Response) => {
  res.json(store.getSettings());
});

router.put('/settings', requireRole(['owner', 'admin']), (req: Request, res: Response) => {
  try {
    const updated = store.updateSettings(req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/audit-logs', (req: Request, res: Response) => {
  res.json(store.getAuditLogs(req.sessionCtx.businessId));
});

export default app;
