import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateGstSplit,
  evaluateCreditRiskGatekeeper,
  computeAuditLogHash,
  calculateInventoryVelocityAndReorder,
} from './gstAndCredit.ts';

test('GST calculation - Intrastate split into CGST and SGST', () => {
  const result = calculateGstSplit(10000, 18, 'Maharashtra', 'Maharashtra');
  assert.equal(result.isInterstate, false);
  assert.equal(result.cgstRate, 9);
  assert.equal(result.sgstRate, 9);
  assert.equal(result.igstRate, 0);
  assert.equal(result.cgstAmount, 900);
  assert.equal(result.sgstAmount, 900);
  assert.equal(result.taxAmount, 1800);
  assert.equal(result.totalAmount, 11800);
});

test('GST calculation - Interstate applied fully as IGST', () => {
  const result = calculateGstSplit(10000, 18, 'Maharashtra', 'Gujarat');
  assert.equal(result.isInterstate, true);
  assert.equal(result.cgstRate, 0);
  assert.equal(result.sgstRate, 0);
  assert.equal(result.igstRate, 18);
  assert.equal(result.cgstAmount, 0);
  assert.equal(result.sgstAmount, 0);
  assert.equal(result.igstAmount, 1800);
  assert.equal(result.taxAmount, 1800);
  assert.equal(result.totalAmount, 11800);
});

test('Udhaar gatekeeper - Flags credit limit breach', () => {
  const check = evaluateCreditRiskGatekeeper({
    customerCreditLimit: 50000,
    customerOutstandingBalance: 40000,
    newOrderTotal: 25000,
    unpaidInvoices: [],
    currentDateStr: '2026-10-16',
  });
  assert.equal(check.passed, false);
  assert.equal(check.requiresCreditHold, true);
  assert.equal(check.projectedExposure, 65000);
  assert.ok(check.reasons[0].includes('assigned credit limit'));
});

test('Udhaar gatekeeper - Flags severely overdue invoice (>15 days)', () => {
  const check = evaluateCreditRiskGatekeeper({
    customerCreditLimit: 100000,
    customerOutstandingBalance: 20000,
    newOrderTotal: 10000,
    unpaidInvoices: [{ dueDate: '2026-09-20', balanceDue: 20000 }],
    currentDateStr: '2026-10-16',
  });
  assert.equal(check.passed, false);
  assert.equal(check.requiresCreditHold, true);
  assert.ok(check.maxOverdueDays > 15);
  assert.ok(check.reasons[0].includes('overdue balance'));
});

test('Udhaar gatekeeper - Passes within limits and no overdue accounts', () => {
  const check = evaluateCreditRiskGatekeeper({
    customerCreditLimit: 100000,
    customerOutstandingBalance: 20000,
    newOrderTotal: 15000,
    unpaidInvoices: [{ dueDate: '2026-10-25', balanceDue: 20000 }],
    currentDateStr: '2026-10-16',
  });
  assert.equal(check.passed, true);
  assert.equal(check.requiresCreditHold, false);
  assert.equal(check.reasons.length, 0);
});

test('Tamper-evident audit log - Hash chaining generates valid SHA-256 digests', () => {
  const initialHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const entry = {
    id: 'aud-101',
    businessId: 'biz-kalyan-01',
    actorId: 'usr-arjun-01',
    actorRole: 'owner',
    action: 'ORDER_CREATED',
    module: 'sales',
    recordId: 'ORD-2026-001',
    details: 'Created sales order',
    timestamp: '2026-10-16T12:00:00Z',
  };
  const hash1 = computeAuditLogHash(initialHash, entry);
  assert.equal(hash1.length, 64);
  assert.notEqual(hash1, initialHash);

  // Different details must produce different hash
  const hash2 = computeAuditLogHash(initialHash, { ...entry, details: 'Tampered order' });
  assert.notEqual(hash1, hash2);
});

test('Demand velocity calculation - Factors past sales and lead time', () => {
  const res = calculateInventoryVelocityAndReorder({
    currentStock: 4,
    reorderThreshold: 8,
    leadTimeDays: 5,
    recentSaleMovements: [
      { quantity: -6, createdAt: '2026-10-01' },
      { quantity: -9, createdAt: '2026-10-10' },
    ],
    daysLookback: 30,
  });
  // 15 units sold over 30 days = 0.5 units/day
  assert.equal(res.dailyVelocity, 0.5);
  assert.equal(res.daysRemaining, 8); // 4 / 0.5 = 8 days
  assert.ok(res.recommendedReorderQty >= 10);
});
