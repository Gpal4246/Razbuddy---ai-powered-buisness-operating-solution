import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { api } from '../../api/client.ts';
import { CurrencyFormat } from './CurrencyFormat.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import { 
  X, 
  Phone, 
  Mail, 
  MapPin, 
  FileText, 
  ShoppingBag, 
  Calendar, 
  CreditCard, 
  Loader2, 
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';

export const Customer360Drawer: React.FC = () => {
  const { selectedCustomerIdFor360, closeCustomer360, openRazorpayCheckout } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'invoices' | 'orders' | 'bookings' | 'payments' | 'creditNotes'>('invoices');

  useEffect(() => {
    if (!selectedCustomerIdFor360) {
      setData(null);
      return;
    }
    setLoading(true);
    api.getCustomer360(selectedCustomerIdFor360)
      .then(res => setData(res))
      .catch(err => console.error('Error fetching Customer 360:', err))
      .finally(() => setLoading(false));
  }, [selectedCustomerIdFor360]);

  if (!selectedCustomerIdFor360) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white shadow-2xl border-l border-[#E5E7E0] h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#E5E7E0] bg-[#F7F7F4] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-[#6D876D] uppercase tracking-wider">
              Customer 360 & Udhaar Profile
            </div>
            <h2 className="text-lg font-semibold text-[#252923]">
              {loading ? 'Loading...' : data?.customer.name}
            </h2>
          </div>
          <button
            onClick={closeCustomer360}
            className="p-1.5 text-[#73766F] hover:text-[#252923] hover:bg-stone-200 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center p-8 text-[#73766F]">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading customer history...
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center p-8 text-[#73766F]">
            Customer details could not be retrieved.
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Customer Details Strip */}
            <div className="p-4 border-b border-[#E5E7E0] space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex items-center gap-2 text-[#73766F]">
                  <Phone className="w-4 h-4 text-[#6D876D]" />
                  <span className="font-mono text-[#252923]">{data.customer.phone}</span>
                </div>
                {data.customer.email && (
                  <div className="flex items-center gap-2 text-[#73766F]">
                    <Mail className="w-4 h-4 text-[#6D876D]" />
                    <span className="text-[#252923] truncate">{data.customer.email}</span>
                  </div>
                )}
                {data.customer.gstin && (
                  <div className="text-[#73766F]">
                    GSTIN: <span className="font-mono text-[#252923] font-medium">{data.customer.gstin}</span>
                  </div>
                )}
                <div className="text-[#73766F]">
                  Type: <span className="capitalize text-[#252923] font-medium">{data.customer.customerType}</span>
                </div>
              </div>
              {data.customer.address && (
                <div className="flex items-start gap-2 text-xs text-[#73766F]">
                  <MapPin className="w-4 h-4 text-[#6D876D] shrink-0 mt-0.5" />
                  <span>{data.customer.address}, {data.customer.city}, {data.customer.state}</span>
                </div>
              )}

              {/* Udhaar & Credit Health Scoring Banner */}
              <div className="p-3 bg-stone-50 rounded-lg border border-[#E5E7E0] grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-[10px] text-[#73766F]">Assigned Credit Limit</div>
                  <div className="font-mono font-bold text-[#252923] mt-0.5">
                    <CurrencyFormat amount={data.customer.creditLimit || 50000} />
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#73766F]">Avg Payment Velocity</div>
                  <div className="font-mono font-bold text-[#252923] mt-0.5">
                    {data.customer.avgPaymentDays || 15} days
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-[#73766F]">Credit Risk Score</div>
                  <div className="mt-0.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                      data.customer.creditRiskScore === 'High' 
                        ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                        : data.customer.creditRiskScore === 'Moderate'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}>
                      {data.customer.creditRiskScore || 'Low'} Risk ({data.customer.onTimePaymentRate || 95}% on-time)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Overview Cards */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-[#F7F7F4] border-b border-[#E5E7E0]">
              <div className="p-3 bg-white rounded border border-[#E5E7E0]">
                <div className="text-[11px] text-[#73766F]">Outstanding Balance</div>
                <div className={`text-base font-bold font-mono mt-0.5 ${data.summary.outstandingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  <CurrencyFormat amount={data.summary.outstandingBalance} showDecimals={true} />
                </div>
                {data.summary.outstandingBalance > 0 && (
                  <button
                    onClick={() => {
                      const firstUnpaid = data.invoices.find((i: any) => i.balanceDue > 0);
                      openRazorpayCheckout({
                        invoiceId: firstUnpaid?.id,
                        customerId: data.customer.id,
                        customerName: data.customer.name,
                        amount: data.summary.outstandingBalance,
                      });
                    }}
                    className="mt-2 w-full py-1 px-2 text-[10px] bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CreditCard className="w-3 h-3" /> Collect via Razorpay
                  </button>
                )}
              </div>
              <div className="p-3 bg-white rounded border border-[#E5E7E0]">
                <div className="text-[11px] text-[#73766F]">Total Lifetime Sales</div>
                <div className="text-base font-bold font-mono text-[#252923] mt-0.5">
                  <CurrencyFormat amount={data.summary.totalInvoicedAmount} />
                </div>
                <div className="text-[10px] text-[#73766F] mt-1 font-mono">
                  {data.summary.totalOrdersCount} orders placed
                </div>
              </div>
              <div className="p-3 bg-white rounded border border-[#E5E7E0]">
                <div className="text-[11px] text-[#73766F]">Total Collected</div>
                <div className="text-base font-bold font-mono text-[#252923] mt-0.5">
                  <CurrencyFormat amount={data.summary.totalPaidAmount} />
                </div>
                <div className="text-[10px] text-[#73766F] mt-1 font-mono">
                  {data.summary.totalBookingsCount} service visits
                </div>
              </div>
            </div>

            {/* Interactive Tabs */}
            <div className="border-b border-[#E5E7E0] px-4 flex gap-4 text-xs font-medium text-[#73766F] overflow-x-auto">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'invoices' ? 'border-[#6D876D] text-[#252923]' : 'border-transparent hover:text-[#252923]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Invoices ({data.invoices.length})
              </button>
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'orders' ? 'border-[#6D876D] text-[#252923]' : 'border-transparent hover:text-[#252923]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Orders ({data.orders.length})
              </button>
              <button
                onClick={() => setActiveTab('creditNotes')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'creditNotes' ? 'border-[#6D876D] text-[#252923]' : 'border-transparent hover:text-[#252923]'
                }`}
              >
                <RotateCcw className="w-3.5 h-3.5" /> Credit Notes ({data.creditNotes?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('bookings')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'bookings' ? 'border-[#6D876D] text-[#252923]' : 'border-transparent hover:text-[#252923]'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Bookings ({data.bookings.length})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  activeTab === 'payments' ? 'border-[#6D876D] text-[#252923]' : 'border-transparent hover:text-[#252923]'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Payments ({data.payments.length})
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-4 space-y-2">
              {activeTab === 'invoices' && (
                data.invoices.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#73766F]">No invoices issued for this customer.</div>
                ) : (
                  data.invoices.map((inv: any) => (
                    <div key={inv.id} className="p-3 bg-white rounded border border-[#E5E7E0] flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#252923] font-mono">{inv.invoiceNumber}</span>
                          <StatusBadge status={inv.status} />
                          {inv.isInterstate ? (
                            <span className="text-[9px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                              IGST (18%)
                            </span>
                          ) : (
                            <span className="text-[9px] bg-stone-100 text-stone-700 px-1.5 py-0.2 rounded border border-stone-200">
                              CGST+SGST (9%+9%)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#73766F] mt-1 font-mono">
                          Issued: {inv.issueDate} • Due: {inv.dueDate}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold font-mono text-sm text-[#252923]">
                          <CurrencyFormat amount={inv.totalAmount} />
                        </div>
                        {inv.balanceDue > 0 && (
                          <div className="text-[11px] text-rose-600 font-mono font-semibold">
                            Pending: <CurrencyFormat amount={inv.balanceDue} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'orders' && (
                data.orders.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#73766F]">No sales orders recorded.</div>
                ) : (
                  data.orders.map((ord: any) => (
                    <div key={ord.id} className="p-3 bg-white rounded border border-[#E5E7E0] flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#252923] font-mono">{ord.orderNumber}</span>
                          <StatusBadge status={ord.status} />
                        </div>
                        <div className="text-[11px] text-[#73766F] mt-1 font-mono">
                          {ord.items.length} line items • Placed {ord.createdAt.split('T')[0]}
                        </div>
                        {ord.creditHoldReason && (
                          <div className="text-[10px] text-amber-700 mt-0.5">
                            Hold: {ord.creditHoldReason}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold font-mono text-sm text-[#252923]">
                          <CurrencyFormat amount={ord.totalAmount} />
                        </div>
                        <div className="text-[10px] text-[#73766F] capitalize">
                          {ord.paymentStatus}
                        </div>
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'creditNotes' && (
                (!data.creditNotes || data.creditNotes.length === 0) ? (
                  <div className="text-center py-8 text-xs text-[#73766F]">No credit notes issued for this customer.</div>
                ) : (
                  data.creditNotes.map((cn: any) => (
                    <div key={cn.id} className="p-3 bg-white rounded border border-[#E5E7E0] flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#252923] font-mono">{cn.creditNoteNumber}</span>
                          <span className="text-[10px] bg-purple-50 text-purple-700 px-1.5 py-0.2 rounded border border-purple-200">
                            Ref: {cn.invoiceNumber}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#73766F] mt-1">
                          Reason: {cn.reason}
                        </div>
                        <div className="text-[10px] text-[#73766F] font-mono">
                          Issued {cn.issuedAt.split('T')[0]} by {cn.createdBy}
                        </div>
                      </div>
                      <div className="text-right font-mono font-semibold text-rose-700 text-sm">
                        -<CurrencyFormat amount={cn.totalAmount} />
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'bookings' && (
                data.bookings.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#73766F]">No service appointments booked.</div>
                ) : (
                  data.bookings.map((bkg: any) => (
                    <div key={bkg.id} className="p-3 bg-white rounded border border-[#E5E7E0] flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#252923] font-mono">{bkg.bookingNumber}</span>
                          <StatusBadge status={bkg.status} />
                        </div>
                        <div className="text-[#252923] font-medium mt-1">{bkg.serviceName}</div>
                        <div className="text-[11px] text-[#73766F]">
                          {bkg.date} from {bkg.startTime} - {bkg.endTime} (Staff: {bkg.staffName})
                        </div>
                        {bkg.partsUsed && bkg.partsUsed.length > 0 && (
                          <div className="text-[10px] text-[#6D876D] font-mono mt-0.5">
                            BOM: {bkg.partsUsed.map((p: any) => `${p.quantity}x ${p.name}`).join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="text-right font-mono text-sm font-semibold text-[#252923]">
                        <CurrencyFormat amount={bkg.totalAmount} />
                      </div>
                    </div>
                  ))
                )
              )}

              {activeTab === 'payments' && (
                data.payments.length === 0 ? (
                  <div className="text-center py-8 text-xs text-[#73766F]">No payment transactions recorded.</div>
                ) : (
                  data.payments.map((pay: any) => (
                    <div key={pay.id} className="p-3 bg-white rounded border border-[#E5E7E0] flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#252923] font-mono">{pay.paymentNumber}</span>
                          <StatusBadge status={pay.status} />
                          <span className="text-[11px] uppercase bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded border border-stone-200">
                            {pay.paymentMethod}
                          </span>
                        </div>
                        <div className="text-[11px] text-[#73766F] mt-1 font-mono">
                          Ref: {pay.referenceNumber} • Date: {pay.receivedAt.split('T')[0]}
                        </div>
                      </div>
                      <div className="text-right font-mono text-sm font-semibold text-emerald-700">
                        +<CurrencyFormat amount={pay.amount} />
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
