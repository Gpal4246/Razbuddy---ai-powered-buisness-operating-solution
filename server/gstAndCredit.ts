import crypto from 'crypto';

export interface TaxSplitResult {
  isInterstate: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  taxAmount: number;
  totalAmount: number;
}

/**
 * Calculates Indian GST based on supplier state and place of supply (customer state).
 * Intrastate (same state): Split equally into CGST and SGST.
 * Interstate (different state): Applied fully as IGST.
 */
export function calculateGstSplit(
  subtotal: number,
  taxRatePercent: number,
  businessState: string,
  customerState?: string
): TaxSplitResult {
  const normBiz = (businessState || '').trim().toLowerCase();
  const normCust = (customerState || '').trim().toLowerCase();
  
  // If states are identical or customer state is not provided, default to intrastate
  const isInterstate = Boolean(normCust && normBiz !== normCust);
  const totalTax = Math.round(subtotal * (taxRatePercent / 100) * 100) / 100;
  const totalAmount = Math.round((subtotal + totalTax) * 100) / 100;

  if (isInterstate) {
    return {
      isInterstate: true,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: taxRatePercent,
      igstAmount: totalTax,
      taxAmount: totalTax,
      totalAmount,
    };
  }

  const halfRate = Math.round((taxRatePercent / 2) * 100) / 100;
  const halfTax = Math.round((totalTax / 2) * 100) / 100;
  // Account for any 1 paisa rounding difference
  const sgstAmount = Math.round((totalTax - halfTax) * 100) / 100;

  return {
    isInterstate: false,
    cgstRate: halfRate,
    cgstAmount: halfTax,
    sgstRate: halfRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
    taxAmount: totalTax,
    totalAmount,
  };
}

/**
 * Credit Risk and Udhaar Gatekeeper check.
 * Rejects or puts on hold if:
 * 1. (outstandingBalance + newOrderAmount) > creditLimit
 * 2. Has any invoice overdue by > 15 days
 */
export interface CreditCheckResult {
  passed: boolean;
  requiresCreditHold: boolean;
  reasons: string[];
  currentExposure: number;
  projectedExposure: number;
  creditLimit: number;
  maxOverdueDays: number;
}

export function evaluateCreditRiskGatekeeper(params: {
  customerCreditLimit: number;
  customerOutstandingBalance: number;
  newOrderTotal: number;
  unpaidInvoices: Array<{ dueDate: string; balanceDue: number }>;
  currentDateStr: string;
}): CreditCheckResult {
  const { customerCreditLimit, customerOutstandingBalance, newOrderTotal, unpaidInvoices, currentDateStr } = params;
  const projectedExposure = customerOutstandingBalance + newOrderTotal;
  const reasons: string[] = [];
  let requiresCreditHold = false;
  let maxOverdueDays = 0;

  const nowMs = new Date(currentDateStr).getTime();

  for (const inv of unpaidInvoices) {
    if (inv.balanceDue > 0) {
      const dueMs = new Date(inv.dueDate).getTime();
      const diffDays = Math.floor((nowMs - dueMs) / (1000 * 60 * 60 * 24));
      if (diffDays > maxOverdueDays) {
        maxOverdueDays = diffDays;
      }
    }
  }

  if (customerCreditLimit > 0 && projectedExposure > customerCreditLimit) {
    requiresCreditHold = true;
    reasons.push(
      `Projected credit exposure (₹${projectedExposure.toLocaleString('en-IN')}) exceeds assigned credit limit of ₹${customerCreditLimit.toLocaleString('en-IN')}`
    );
  }

  if (maxOverdueDays > 15) {
    requiresCreditHold = true;
    reasons.push(`Customer has overdue balance pending past 15-day tolerance window (${maxOverdueDays} days overdue)`);
  }

  return {
    passed: !requiresCreditHold,
    requiresCreditHold,
    reasons,
    currentExposure: customerOutstandingBalance,
    projectedExposure,
    creditLimit: customerCreditLimit,
    maxOverdueDays,
  };
}

/**
 * Cryptographic hash chaining for tamper-evident audit logs
 */
export function computeAuditLogHash(
  previousHash: string,
  entry: {
    id: string;
    businessId: string;
    actorId: string;
    actorRole: string;
    action: string;
    module: string;
    recordId: string;
    details: string;
    timestamp: string;
  }
): string {
  const content = `${previousHash}|${entry.id}|${entry.businessId}|${entry.actorId}|${entry.actorRole}|${entry.action}|${entry.module}|${entry.recordId}|${entry.details}|${entry.timestamp}`;
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Customer payment behavior scoring
 */
export function calculateCustomerPaymentMetrics(invoices: Array<{
  issueDate: string;
  dueDate: string;
  amountPaid: number;
  balanceDue: number;
  status: string;
}>, payments: Array<{ receivedAt: string; amount: number; invoiceId?: string }>): {
  avgPaymentDays: number;
  onTimePaymentRate: number;
  creditRiskScore: 'Low' | 'Moderate' | 'High';
} {
  if (invoices.length === 0) {
    return { avgPaymentDays: 0, onTimePaymentRate: 100, creditRiskScore: 'Low' };
  }

  let totalPaymentDays = 0;
  let paidCount = 0;
  let onTimeCount = 0;
  let overdueCount = 0;

  for (const inv of invoices) {
    if (inv.status === 'overdue' || (inv.balanceDue > 0 && new Date(inv.dueDate) < new Date())) {
      overdueCount++;
    }
    if (inv.amountPaid > 0) {
      paidCount++;
      const issueMs = new Date(inv.issueDate).getTime();
      const dueMs = new Date(inv.dueDate).getTime();
      // Find matching payments
      const matched = payments.filter(p => p.invoiceId === (inv as any).id);
      if (matched.length > 0) {
        const lastPayMs = new Date(matched[matched.length - 1].receivedAt).getTime();
        const daysTaken = Math.max(1, Math.round((lastPayMs - issueMs) / (1000 * 60 * 60 * 24)));
        totalPaymentDays += daysTaken;
        if (lastPayMs <= dueMs) {
          onTimeCount++;
        }
      } else {
        totalPaymentDays += 15;
        onTimeCount++;
      }
    }
  }

  const avgPaymentDays = paidCount > 0 ? Math.round(totalPaymentDays / paidCount) : 15;
  const onTimePaymentRate = invoices.length > 0 ? Math.round((onTimeCount / invoices.length) * 100) : 100;

  let creditRiskScore: 'Low' | 'Moderate' | 'High' = 'Low';
  if (overdueCount >= 2 || onTimePaymentRate < 60 || avgPaymentDays > 45) {
    creditRiskScore = 'High';
  } else if (overdueCount === 1 || onTimePaymentRate < 80 || avgPaymentDays > 25) {
    creditRiskScore = 'Moderate';
  }

  return {
    avgPaymentDays,
    onTimePaymentRate,
    creditRiskScore,
  };
}

/**
 * Real Sales Velocity & Lead-Time Factored Reorder Calculation
 */
export function calculateInventoryVelocityAndReorder(params: {
  currentStock: number;
  reorderThreshold: number;
  leadTimeDays: number;
  recentSaleMovements: Array<{ quantity: number; createdAt: string }>;
  daysLookback?: number;
}): {
  dailyVelocity: number;
  daysRemaining: number;
  safetyStock: number;
  recommendedReorderQty: number;
} {
  const { currentStock, reorderThreshold, leadTimeDays, recentSaleMovements, daysLookback = 30 } = params;
  
  // Total units sold in lookback period (quantities in stock movements are negative for sales)
  const totalSold = recentSaleMovements.reduce((sum, m) => sum + Math.abs(m.quantity), 0);
  const rawVelocity = totalSold / daysLookback;
  // Floor at 0.1 to avoid division by zero
  const dailyVelocity = Math.max(0.1, Math.round(rawVelocity * 100) / 100);

  const daysRemaining = Math.max(0, Math.floor(currentStock / dailyVelocity));
  const leadTimeDemand = dailyVelocity * leadTimeDays;
  const safetyStock = Math.max(reorderThreshold, Math.ceil(leadTimeDemand * 1.5));
  const targetStock = safetyStock + Math.ceil(dailyVelocity * 14); // 2-week cycle stock
  const recommendedReorderQty = Math.max(10, targetStock - currentStock);

  return {
    dailyVelocity,
    daysRemaining,
    safetyStock,
    recommendedReorderQty,
  };
}
