import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { StatusBadge } from '../components/common/StatusBadge.tsx';
import { Order, Quotation, Invoice, Payment, Customer, CreditNote } from '../types/index.ts';
import { 
  ShoppingBag, 
  FileText, 
  Receipt, 
  CreditCard, 
  AlertTriangle, 
  MessageSquare, 
  Plus, 
  Download, 
  Search, 
  Check, 
  Loader2, 
  ArrowRight,
  Send,
  Eye,
  RotateCcw,
  Upload,
  Lock,
  Unlock,
  ExternalLink,
  MessageCircle
} from 'lucide-react';

export const SalesPage: React.FC = () => {
  const { currentSubTab, navigate, openCustomer360, openRazorpayCheckout, openQuickCreate, showToast, triggerRefresh, refreshSignal, user, business } = useApp();
  const [activeTab, setActiveTab] = useState<'orders' | 'invoices' | 'creditNotes' | 'quotations' | 'payments' | 'receivables' | 'followup'>('orders');
  const [loading, setLoading] = useState(true);

  // Data collections
  const [orders, setOrders] = useState<Order[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Manual payment modal state
  const [manualPayInvoice, setManualPayInvoice] = useState<Invoice | null>(null);
  const [manualPayAmount, setManualPayAmount] = useState(0);
  const [manualPayMethod, setManualPayMethod] = useState<'cash' | 'bank_transfer' | 'upi' | 'cheque'>('bank_transfer');
  const [manualPayRef, setManualPayRef] = useState('');

  // Credit Note Modal state
  const [isCreditNoteModalOpen, setIsCreditNoteModalOpen] = useState(false);
  const [creditNoteInvoiceId, setCreditNoteInvoiceId] = useState('');
  const [creditNoteReason, setCreditNoteReason] = useState('Customer return of defective goods');
  const [creditNoteQty, setCreditNoteQty] = useState(1);
  const [creditNoteRestock, setCreditNoteRestock] = useState(true);

  // Credit Hold Override Modal
  const [overrideOrderId, setOverrideOrderId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('Approved by Director - advance promised via NEFT');

  // CSV Bulk Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState(
    'Name,Phone,CustomerType,State,CreditLimit,GSTIN\nSharma Trading Co,+91 98200 44556,wholesale,Maharashtra,80000,27AABCS9988F1Z2\nGujarat Agro Supplies,+91 98790 11223,wholesale,Gujarat,75000,24AAACG1122K1Z9'
  );

  useEffect(() => {
    if (currentSubTab) {
      if (['orders', 'invoices', 'creditNotes', 'quotations', 'payments', 'receivables', 'followup'].includes(currentSubTab)) {
        setActiveTab(currentSubTab as any);
      }
    }
  }, [currentSubTab]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getOrders(),
      api.getQuotations(),
      api.getInvoices(),
      api.getPayments(),
      api.getCreditNotes(),
      api.getCustomers(),
    ]).then(([ords, quots, invs, pays, cns, custs]) => {
      setOrders(ords);
      setQuotations(quots);
      setInvoices(invs);
      setPayments(pays);
      setCreditNotes(cns);
      setCustomers(custs);
      if (invs.length > 0) setCreditNoteInvoiceId(invs[0].id);
    }).catch(err => {
      console.error('Failed to load sales data:', err);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshSignal]);

  const handleConvertToOrder = async (quoteId: string) => {
    try {
      await api.convertQuotationToOrder(quoteId);
      showToast('Quotation successfully converted to active Sales Order', 'success');
      triggerRefresh();
      setActiveTab('orders');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: Order['status']) => {
    try {
      await api.updateOrderStatus(orderId, status);
      showToast(`Order status updated to ${status}`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleOverrideCreditHoldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideOrderId) return;
    try {
      await api.overrideCreditHold(overrideOrderId, overrideReason);
      showToast('Credit hold overridden and inventory reserved for dispatch', 'success');
      setOverrideOrderId(null);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleIssueCreditNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const inv = invoices.find(i => i.id === creditNoteInvoiceId);
    if (!inv || inv.items.length === 0) return;

    try {
      const targetItem = inv.items[0];
      await api.issueCreditNote({
        invoiceId: inv.id,
        reason: creditNoteReason,
        items: [
          {
            productId: targetItem.productId,
            description: `Returned: ${targetItem.description}`,
            quantity: creditNoteQty,
            unitPrice: targetItem.unitPrice,
            restock: creditNoteRestock,
          }
        ]
      });
      showToast('GST Credit Note issued, restocked undamaged goods, and adjusted balance', 'success');
      setIsCreditNoteModalOpen(false);
      triggerRefresh();
      setActiveTab('creditNotes');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleRecordManualPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPayInvoice) return;
    try {
      await api.recordPayment({
        invoiceId: manualPayInvoice.id,
        customerId: manualPayInvoice.customerId,
        amount: Number(manualPayAmount),
        paymentMethod: manualPayMethod,
        referenceNumber: manualPayRef || `${manualPayMethod.toUpperCase()}-${Date.now()}`,
        notes: `Recorded manual payment by accountant`,
      });
      showToast('Payment recorded and credited to invoice balance', 'success');
      setManualPayInvoice(null);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // 1-Click WhatsApp Deep Link Generator
  const generateWhatsAppUrl = (inv: Invoice) => {
    const rawPhone = (inv.customerPhone || '9820000000').replace(/[^0-9]/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const paymentLink = `https://rzp.io/i/test_${inv.invoiceNumber.toLowerCase()}`;
    const gstSplitText = inv.isInterstate
      ? `IGST (18%): ₹${inv.igstAmount}`
      : `CGST (9%): ₹${inv.cgstAmount}, SGST (9%): ₹${inv.sgstAmount}`;

    const message = `Namaste ${inv.customerName},
Regarding Invoice *${inv.invoiceNumber}* from *${business?.name || 'Kalyan Electronics'}*.
Amount Due: *₹${inv.balanceDue.toLocaleString('en-IN')}* (Due Date: ${inv.dueDate})
Tax Details: ${gstSplitText}

Please complete payment securely via UPI / Razorpay link:
${paymentLink}

Thank you for your business!`;

    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  };

  const handleSendWhatsAppFollowup = async (inv: Invoice) => {
    try {
      await api.updateInvoiceDeliveryStatus(inv.id, 'sent');
      const url = generateWhatsAppUrl(inv);
      window.open(url, '_blank');
      showToast(`Logged WhatsApp follow-up for ${inv.customerName}`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleBulkImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const lines = importCsvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const records = lines.slice(1).map(line => {
        const parts = line.split(',').map(p => p.trim());
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = parts[idx];
        });
        return obj;
      });

      const res = await api.importCsv('customers', records);
      showToast(res.message, 'success');
      setIsImportModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const exportCsv = (type: string) => {
    if (type === 'gstr1') {
      window.open(api.getGstr1ExportUrl(), '_blank');
      showToast('Exported GSTR-1 B2B/B2C CSV', 'success');
      return;
    }

    let rows: string[][] = [];
    let filename = `razbuddy-${type}-${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'orders') {
      rows = [
        ['Order Number', 'Customer', 'Place of Supply', 'Tax Type', 'Subtotal', 'Tax (GST)', 'Total Amount', 'Status', 'Payment Status', 'Date'],
        ...orders.map(o => [
          o.orderNumber,
          o.customerName,
          o.customerState || 'Maharashtra',
          o.isInterstate ? 'IGST 18%' : 'CGST+SGST (9%+9%)',
          String(o.subtotal),
          String(o.taxAmount),
          String(o.totalAmount),
          o.status,
          o.paymentStatus,
          o.createdAt.split('T')[0],
        ]),
      ];
    } else if (type === 'invoices') {
      rows = [
        ['Invoice Number', 'Customer', 'Place of Supply', 'Total Amount', 'Amount Paid', 'Balance Due', 'Due Date', 'Status', 'Delivery Status'],
        ...invoices.map(i => [
          i.invoiceNumber,
          i.customerName,
          i.customerState || 'Maharashtra',
          String(i.totalAmount),
          String(i.amountPaid),
          String(i.balanceDue),
          i.dueDate,
          i.status,
          i.deliveryStatus || 'queued',
        ]),
      ];
    } else if (type === 'creditNotes') {
      rows = [
        ['Credit Note #', 'Invoice #', 'Customer', 'Reason', 'Total Amount', 'Issued Date'],
        ...creditNotes.map(cn => [
          cn.creditNoteNumber,
          cn.invoiceNumber,
          cn.customerName,
          cn.reason,
          String(cn.totalAmount),
          cn.issuedAt.split('T')[0],
        ]),
      ];
    } else {
      rows = [
        ['Payment ID', 'Customer', 'Amount', 'Method', 'Reference', 'Date', 'Status'],
        ...payments.map(p => [
          p.paymentNumber,
          p.customerName,
          String(p.amount),
          p.paymentMethod,
          p.referenceNumber || '',
          p.receivedAt.split('T')[0],
          p.status,
        ]),
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${type}.csv`, 'success');
  };

  const q = searchQuery.toLowerCase();
  const filteredOrders = orders.filter(o => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));
  const filteredInvoices = invoices.filter(i => i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q));
  const filteredCreditNotes = creditNotes.filter(cn => cn.creditNoteNumber.toLowerCase().includes(q) || cn.customerName.toLowerCase().includes(q));
  const filteredQuotes = quotations.filter(qu => qu.quoteNumber.toLowerCase().includes(q) || qu.customerName.toLowerCase().includes(q));
  const filteredPayments = payments.filter(p => p.paymentNumber.toLowerCase().includes(q) || p.customerName.toLowerCase().includes(q));
  const overdueInvoices = invoices.filter(i => i.status === 'overdue' || (i.balanceDue > 0 && i.dueDate < new Date().toISOString().split('T')[0]));

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header with Sub-tabs and Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E7E0]">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'orders', label: 'Orders', icon: ShoppingBag, count: orders.length },
            { id: 'invoices', label: 'GST Invoices', icon: FileText, count: invoices.length },
            { id: 'creditNotes', label: 'Credit Notes', icon: RotateCcw, count: creditNotes.length },
            { id: 'quotations', label: 'Quotations', icon: Receipt, count: quotations.length },
            { id: 'payments', label: 'Payments', icon: CreditCard, count: payments.length },
            { id: 'receivables', label: 'Udhaar Ledgers', icon: AlertTriangle, count: overdueInvoices.length, isWarning: true },
            { id: 'followup', label: 'WhatsApp Queue', icon: MessageSquare, count: overdueInvoices.length },
          ].map(tab => {
            const Icon = tab.icon;
            const isCur = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  navigate('sales', tab.id);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  isCur
                    ? 'bg-[#6D876D] text-white shadow-2xs font-semibold'
                    : 'bg-white hover:bg-stone-100 text-[#73766F] border border-[#E5E7E0]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  isCur ? 'bg-white/20 text-white' : tab.isWarning && tab.count > 0 ? 'bg-rose-100 text-rose-800' : 'bg-stone-100 text-[#73766F]'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* GSTR-1 & Tally Export */}
          <button
            onClick={() => exportCsv('gstr1')}
            className="px-2.5 py-1.5 rounded border border-[#6D876D]/40 bg-[#6D876D]/10 hover:bg-[#6D876D]/20 text-[#3d513d] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            title="Download GSTR-1 ready CSV for GST Portal & Tally"
          >
            <Download className="w-3.5 h-3.5 text-[#6D876D]" />
            <span>GSTR-1 CSV</span>
          </button>

          {/* Bulk Import Modal Trigger */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-2.5 py-1.5 rounded border border-[#E5E7E0] bg-white hover:bg-stone-50 text-[#73766F] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Bulk import customers from CSV"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          {/* Credit Note button */}
          {activeTab === 'creditNotes' && (
            <button
              onClick={() => setIsCreditNoteModalOpen(true)}
              className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-900 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Issue Credit Note</span>
            </button>
          )}

          <button
            onClick={() => openQuickCreate(activeTab === 'invoices' ? 'invoice' : 'order')}
            className="px-3 py-1.5 rounded bg-[#6D876D] hover:bg-[#5a725a] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New {activeTab === 'invoices' ? 'Invoice' : 'Order'}</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center px-3 py-2 bg-white rounded border border-[#E5E7E0] text-xs">
        <Search className="w-4 h-4 text-[#73766F] mr-2" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={`Search ${activeTab} by reference ID, GSTIN, or customer...`}
          className="w-full bg-transparent focus:outline-hidden text-[#252923] placeholder-[#73766F]"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="text-xs text-[#73766F] hover:text-[#252923]">
            Clear
          </button>
        )}
      </div>

      {/* Main Table / Views */}
      <div className="bg-white rounded-lg border border-[#E5E7E0] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#73766F] flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading records...
          </div>
        ) : (
          <>
            {/* 1. ORDERS TAB WITH UDHAAR GATEKEEPER & GST SPLIT */}
            {activeTab === 'orders' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Order Number</th>
                      <th className="py-2.5 px-3 font-medium">Customer & State</th>
                      <th className="py-2.5 px-3 font-medium">Place of Supply & GST</th>
                      <th className="py-2.5 px-3 font-medium">Order Status</th>
                      <th className="py-2.5 px-3 font-medium">Payment</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total (Incl GST)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-[#73766F]">No orders found matching search.</td>
                      </tr>
                    ) : (
                      filteredOrders.map(o => {
                        const isHold = o.status === 'pending_approval';
                        return (
                          <tr key={o.id} className={`hover:bg-[#F7F7F4]/60 transition-colors ${isHold ? 'bg-amber-50/30' : ''}`}>
                            <td className="py-3 px-3 font-mono font-semibold text-[#252923]">
                              {o.orderNumber}
                            </td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => openCustomer360(o.customerId)}
                                className="font-medium text-[#252923] hover:underline text-left block"
                              >
                                {o.customerName}
                              </button>
                              <span className="text-[10px] text-[#73766F] font-mono">{o.customerState || 'Maharashtra'}</span>
                            </td>
                            <td className="py-3 px-3 text-[11px]">
                              {o.isInterstate ? (
                                <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 font-medium">
                                  Interstate IGST (<CurrencyFormat amount={o.igstAmount || 0} />)
                                </span>
                              ) : (
                                <span className="text-[#405440] bg-[#6D876D]/10 px-1.5 py-0.5 rounded border border-[#6D876D]/20 font-medium">
                                  Intrastate CGST+SGST (<CurrencyFormat amount={o.cgstAmount || 0} /> + <CurrencyFormat amount={o.sgstAmount || 0} />)
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {isHold ? (
                                <div>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit">
                                    <Lock className="w-3 h-3" /> CREDIT HOLD
                                  </span>
                                  <div className="text-[10px] text-rose-700 mt-0.5 max-w-xs truncate" title={o.creditHoldReason}>
                                    {o.creditHoldReason}
                                  </div>
                                </div>
                              ) : (
                                <StatusBadge status={o.status} />
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <StatusBadge status={o.paymentStatus} />
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-[#252923]">
                              <CurrencyFormat amount={o.totalAmount} />
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {isHold && (user?.role === 'owner' || user?.role === 'admin') && (
                                  <button
                                    onClick={() => setOverrideOrderId(o.id)}
                                    className="px-2.5 py-1 bg-rose-700 hover:bg-rose-800 text-white text-[10px] rounded font-medium flex items-center gap-1 cursor-pointer"
                                  >
                                    <Unlock className="w-3 h-3" /> Override Hold
                                  </button>
                                )}
                                {o.status === 'confirmed' && (
                                  <button
                                    onClick={() => handleUpdateOrderStatus(o.id, 'processing')}
                                    className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-[10px] rounded font-medium text-stone-700 cursor-pointer"
                                  >
                                    Process
                                  </button>
                                )}
                                {o.status === 'processing' && (
                                  <button
                                    onClick={() => handleUpdateOrderStatus(o.id, 'fulfilled')}
                                    className="px-2 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium cursor-pointer"
                                  >
                                    Fulfil
                                  </button>
                                )}
                                <button
                                  onClick={() => openCustomer360(o.customerId)}
                                  className="p-1 text-[#73766F] hover:text-[#252923]"
                                  title="View Customer 360"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. INVOICES TAB WITH GST SPLIT & 1-CLICK WHATSAPP */}
            {activeTab === 'invoices' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Invoice Number</th>
                      <th className="py-2.5 px-3 font-medium">Customer & GSTIN</th>
                      <th className="py-2.5 px-3 font-medium">GST Split (HSN/SAC)</th>
                      <th className="py-2.5 px-3 font-medium">Delivery Status</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total</th>
                      <th className="py-2.5 px-3 font-medium text-right">Balance Due</th>
                      <th className="py-2.5 px-3 font-medium text-right">Collection & WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {filteredInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-[#73766F]">No invoices matching search.</td>
                      </tr>
                    ) : (
                      filteredInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-[#252923]">
                            {inv.invoiceNumber}
                            <span className="block text-[9px] text-[#73766F] font-mono">v{inv.version || 1}</span>
                          </td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => openCustomer360(inv.customerId)}
                              className="font-medium text-[#252923] hover:underline text-left block"
                            >
                              {inv.customerName}
                            </button>
                            <span className="text-[10px] text-[#73766F] font-mono">{inv.customerGstin || 'Unregistered B2C'}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[10px]">
                            {inv.isInterstate ? (
                              <div className="text-purple-700">
                                IGST: <CurrencyFormat amount={inv.igstAmount || 0} />
                              </div>
                            ) : (
                              <div className="text-[#405440]">
                                CGST: <CurrencyFormat amount={inv.cgstAmount || 0} /> | SGST: <CurrencyFormat amount={inv.sgstAmount || 0} />
                              </div>
                            )}
                            <div className="text-[#73766F] text-[9px]">
                              Place: {inv.customerState || 'Maharashtra'}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                              inv.deliveryStatus === 'delivered' ? 'bg-emerald-100 text-emerald-800' :
                              inv.deliveryStatus === 'sent' ? 'bg-blue-100 text-blue-800' :
                              'bg-stone-100 text-stone-700'
                            }`}>
                              {inv.deliveryStatus || 'queued'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={inv.status} />
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-[#252923]">
                            <CurrencyFormat amount={inv.totalAmount} />
                          </td>
                          <td className={`py-3 px-3 text-right font-mono font-bold ${inv.balanceDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                            <CurrencyFormat amount={inv.balanceDue} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            {inv.balanceDue > 0 ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {/* 1-Click WhatsApp Button */}
                                <button
                                  onClick={() => handleSendWhatsAppFollowup(inv)}
                                  className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] rounded font-medium flex items-center gap-1 cursor-pointer"
                                  title="Open WhatsApp Web with pre-filled GST breakdown & payment link"
                                >
                                  <MessageCircle className="w-3 h-3" /> WhatsApp
                                </button>
                                <button
                                  onClick={() => openRazorpayCheckout({
                                    invoiceId: inv.id,
                                    customerId: inv.customerId,
                                    customerName: inv.customerName,
                                    amount: inv.balanceDue,
                                    description: `Invoice ${inv.invoiceNumber}`
                                  })}
                                  className="px-2 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium flex items-center gap-1 cursor-pointer"
                                  title="Open simulated Razorpay Gateway"
                                >
                                  <CreditCard className="w-3 h-3" /> Razorpay
                                </button>
                                <button
                                  onClick={() => {
                                    setManualPayInvoice(inv);
                                    setManualPayAmount(inv.balanceDue);
                                  }}
                                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] rounded font-medium cursor-pointer"
                                >
                                  Manual
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-emerald-700 font-medium">Settled</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. GST CREDIT NOTES TAB */}
            {activeTab === 'creditNotes' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Credit Note #</th>
                      <th className="py-2.5 px-3 font-medium">Against Invoice #</th>
                      <th className="py-2.5 px-3 font-medium">Customer</th>
                      <th className="py-2.5 px-3 font-medium">Reason for Return / Credit</th>
                      <th className="py-2.5 px-3 font-medium">Issued Date & Actor</th>
                      <th className="py-2.5 px-3 font-medium text-right">Tax (GST)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total Credited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {filteredCreditNotes.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#73766F]">
                          No GST Credit Notes issued yet. Click "Issue Credit Note" to log returns.
                        </td>
                      </tr>
                    ) : (
                      filteredCreditNotes.map(cn => (
                        <tr key={cn.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-rose-700">
                            {cn.creditNoteNumber}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#252923]">
                            {cn.invoiceNumber}
                          </td>
                          <td className="py-3 px-3 font-medium text-[#252923]">
                            {cn.customerName}
                          </td>
                          <td className="py-3 px-3 text-[#73766F]">
                            {cn.reason}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#73766F]">
                            <div>{cn.issuedAt.split('T')[0]}</div>
                            <div className="text-[10px] text-[#252923]">{cn.createdBy}</div>
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[#73766F]">
                            <CurrencyFormat amount={cn.taxAmount} />
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                            -<CurrencyFormat amount={cn.totalAmount} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 4. QUOTATIONS TAB */}
            {activeTab === 'quotations' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Quotation ID</th>
                      <th className="py-2.5 px-3 font-medium">Customer</th>
                      <th className="py-2.5 px-3 font-medium">State & GST</th>
                      <th className="py-2.5 px-3 font-medium">Valid Until</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total Amount</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {filteredQuotes.map(qItem => (
                      <tr key={qItem.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-[#252923]">{qItem.quoteNumber}</td>
                        <td className="py-3 px-3 font-medium text-[#252923]">{qItem.customerName}</td>
                        <td className="py-3 px-3 font-mono text-[10px] text-[#73766F]">
                          {qItem.isInterstate ? 'IGST 18%' : 'CGST+SGST (9%+9%)'} ({qItem.customerState || 'Maharashtra'})
                        </td>
                        <td className="py-3 px-3 font-mono text-[#73766F]">{qItem.validUntil}</td>
                        <td className="py-3 px-3"><StatusBadge status={qItem.status} /></td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-[#252923]">
                          <CurrencyFormat amount={qItem.totalAmount} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          {qItem.status !== 'converted' ? (
                            <button
                              onClick={() => handleConvertToOrder(qItem.id)}
                              className="px-2.5 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium flex items-center gap-1 ml-auto cursor-pointer"
                            >
                              Convert to Order <ArrowRight className="w-3 h-3" />
                            </button>
                          ) : (
                            <span className="text-[11px] text-[#73766F] font-mono">Converted</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. PAYMENTS TAB */}
            {activeTab === 'payments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Payment ID</th>
                      <th className="py-2.5 px-3 font-medium">Customer</th>
                      <th className="py-2.5 px-3 font-medium">Invoice Reference</th>
                      <th className="py-2.5 px-3 font-medium">Method</th>
                      <th className="py-2.5 px-3 font-medium">Gateway Ref #</th>
                      <th className="py-2.5 px-3 font-medium">Date & Time</th>
                      <th className="py-2.5 px-3 font-medium text-right">Amount Credited</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {filteredPayments.map(p => (
                      <tr key={p.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-[#252923]">{p.paymentNumber}</td>
                        <td className="py-3 px-3 font-medium text-[#252923]">{p.customerName}</td>
                        <td className="py-3 px-3 font-mono text-[#73766F]">{p.invoiceNumber || 'Advance'}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded text-[10px] uppercase font-mono bg-stone-100 text-stone-700 border border-stone-200">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#73766F]">{p.referenceNumber}</td>
                        <td className="py-3 px-3 font-mono text-[#73766F]">{p.receivedAt.replace('T', ' ').substring(0, 16)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-700">
                          +<CurrencyFormat amount={p.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. OUTSTANDING RECEIVABLES TAB */}
            {activeTab === 'receivables' && (
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-4 gap-3">
                  <div className="p-3 bg-stone-50 rounded border border-[#E5E7E0]">
                    <div className="text-[11px] text-[#73766F]">Current (0 - 15 days)</div>
                    <div className="text-base font-bold font-mono text-[#252923] mt-0.5">
                      <CurrencyFormat amount={invoices.filter(i => i.balanceDue > 0 && i.status !== 'overdue').reduce((s, i) => s + i.balanceDue, 0)} />
                    </div>
                  </div>
                  <div className="p-3 bg-amber-50 rounded border border-amber-200">
                    <div className="text-[11px] text-amber-800">16 - 30 days Overdue</div>
                    <div className="text-base font-bold font-mono text-amber-900 mt-0.5">
                      <CurrencyFormat amount={invoices.filter(i => i.status === 'overdue').reduce((s, i) => s + i.balanceDue, 0)} />
                    </div>
                  </div>
                  <div className="p-3 bg-rose-50 rounded border border-rose-200">
                    <div className="text-[11px] text-rose-800">Severely Overdue (&gt;30d)</div>
                    <div className="text-base font-bold font-mono text-rose-900 mt-0.5">
                      <CurrencyFormat amount={invoices.filter(i => i.status === 'overdue' && new Date(i.dueDate).getTime() < Date.now() - 30 * 86400000).reduce((s, i) => s + i.balanceDue, 0)} />
                    </div>
                  </div>
                  <div className="p-3 bg-[#6D876D]/10 rounded border border-[#6D876D]/30">
                    <div className="text-[11px] text-[#405440]">Total Receivables</div>
                    <div className="text-base font-bold font-mono text-[#2f402f] mt-0.5">
                      <CurrencyFormat amount={invoices.reduce((s, i) => s + i.balanceDue, 0)} />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Customer Name</th>
                        <th className="py-2.5 px-3 font-medium">Invoice Number</th>
                        <th className="py-2.5 px-3 font-medium">Due Date</th>
                        <th className="py-2.5 px-3 font-medium">Status</th>
                        <th className="py-2.5 px-3 font-medium text-right">Balance Due</th>
                        <th className="py-2.5 px-3 font-medium text-right">Actionable Recovery</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7E0]">
                      {invoices.filter(i => i.balanceDue > 0).map(inv => (
                        <tr key={inv.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                          <td className="py-3 px-3 font-semibold text-[#252923]">
                            <button onClick={() => openCustomer360(inv.customerId)} className="hover:underline text-left">
                              {inv.customerName}
                            </button>
                            <span className="block text-[10px] text-[#73766F] font-mono">{inv.customerPhone}</span>
                          </td>
                          <td className="py-3 px-3 font-mono font-medium text-[#252923]">{inv.invoiceNumber}</td>
                          <td className={`py-3 px-3 font-mono ${inv.status === 'overdue' ? 'text-rose-600 font-bold' : 'text-[#73766F]'}`}>
                            {inv.dueDate}
                          </td>
                          <td className="py-3 px-3"><StatusBadge status={inv.status} /></td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-rose-700">
                            <CurrencyFormat amount={inv.balanceDue} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSendWhatsAppFollowup(inv)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] rounded font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <MessageCircle className="w-3 h-3" /> WhatsApp
                              </button>
                              <button
                                onClick={() => openRazorpayCheckout({
                                  invoiceId: inv.id,
                                  customerId: inv.customerId,
                                  customerName: inv.customerName,
                                  amount: inv.balanceDue,
                                })}
                                className="px-2.5 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium inline-flex items-center gap-1 cursor-pointer"
                              >
                                <CreditCard className="w-3 h-3" /> Razorpay
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. WHATSAPP & SMS FOLLOW-UP QUEUE */}
            {activeTab === 'followup' && (
              <div className="p-4 space-y-4">
                <div className="p-3 bg-emerald-50 rounded border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between">
                  <div>
                    <strong>1-Click WhatsApp Deep Linking (wa.me)</strong>: Formats recipient phone (+91) with exact Invoice #, GST breakdown, and dynamic payment link for instant settlement.
                  </div>
                  <span className="font-mono text-[10px] bg-emerald-200/60 px-2 py-0.5 rounded font-bold">
                    Web & Mobile Ready
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overdueInvoices.map(inv => {
                    const payLink = `https://rzp.io/i/test_${inv.invoiceNumber.toLowerCase()}`;
                    return (
                      <div key={inv.id} className="p-4 bg-white rounded border border-[#E5E7E0] space-y-3 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-[#252923] text-sm">{inv.customerName}</div>
                            <div className="text-[11px] text-[#73766F] font-mono">{inv.customerPhone || '+91 98921 77610'}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-rose-100 text-rose-800">
                            OVERDUE: <CurrencyFormat amount={inv.balanceDue} />
                          </span>
                        </div>

                        <div className="p-3 bg-[#F7F7F4] rounded border border-[#E5E7E0] text-[11px] font-mono text-[#252923] whitespace-pre-wrap leading-relaxed">
{`Namaste ${inv.customerName},
Regarding Invoice *${inv.invoiceNumber}* from *${business?.name || 'Kalyan Electronics'}*.
Amount Due: *₹${inv.balanceDue.toLocaleString('en-IN')}* (Due Date: ${inv.dueDate})
Place of Supply: ${inv.customerState || 'Maharashtra'} (${inv.isInterstate ? `IGST ₹${inv.igstAmount}` : `CGST ₹${inv.cgstAmount} + SGST ₹${inv.sgstAmount}`})

Kindly settle via Razorpay UPI:
${payLink}

Thank you, Accounts Desk`}
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-[#73766F] font-mono">
                            Status: <strong className="uppercase">{inv.deliveryStatus || 'queued'}</strong> (Attempts: {inv.deliveryRetries || 0})
                          </span>
                          <button
                            onClick={() => handleSendWhatsAppFollowup(inv)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> 1-Click WhatsApp
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Credit Note Issue Modal */}
      {isCreditNoteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7E0] max-w-md w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="font-semibold text-sm text-[#252923]">Issue GST Credit Note</h3>
              <button onClick={() => setIsCreditNoteModalOpen(false)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <form onSubmit={handleIssueCreditNoteSubmit} className="space-y-3">
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Target Invoice</label>
                <select
                  value={creditNoteInvoiceId}
                  onChange={e => setCreditNoteInvoiceId(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  required
                >
                  {invoices.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} - {inv.customerName} (₹{inv.totalAmount})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#73766F] font-medium mb-1">Reason for Return / Adjustment</label>
                <input
                  type="text"
                  value={creditNoteReason}
                  onChange={e => setCreditNoteReason(e.target.value)}
                  placeholder="e.g. Defective battery returned by customer"
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Return Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={creditNoteQty}
                    onChange={e => setCreditNoteQty(Math.max(1, Number(e.target.value)))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-2 cursor-pointer text-[#252923]">
                    <input
                      type="checkbox"
                      checked={creditNoteRestock}
                      onChange={e => setCreditNoteRestock(e.target.checked)}
                      className="rounded text-[#6D876D]"
                    />
                    <span>Restock returned unit</span>
                  </label>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreditNoteModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium cursor-pointer"
                >
                  Issue Credit Note
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credit Hold Override Modal */}
      {overrideOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7E0] max-w-sm w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="font-semibold text-sm text-[#252923] flex items-center gap-1.5 text-rose-700">
                <Unlock className="w-4 h-4" /> Override Credit Hold
              </h3>
              <button onClick={() => setOverrideOrderId(null)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <form onSubmit={handleOverrideCreditHoldSubmit} className="space-y-3">
              <p className="text-[#73766F]">
                This customer has exceeded their credit limit or has overdue balances. Overriding will release stock and confirm the order for dispatch.
              </p>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Management Override Justification</label>
                <textarea
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                  rows={2}
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideOrderId(null)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-700 hover:bg-rose-800 text-white rounded font-medium cursor-pointer"
                >
                  Authorize Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Bulk Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7E0] max-w-lg w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="font-semibold text-sm text-[#252923] flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-[#6D876D]" /> Bulk Customer Onboarding CSV
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <form onSubmit={handleBulkImportSubmit} className="space-y-3">
              <p className="text-[#73766F]">
                Paste CSV records with headers: <code>Name, Phone, CustomerType, State, CreditLimit, GSTIN</code>
              </p>
              <textarea
                value={importCsvText}
                onChange={e => setImportCsvText(e.target.value)}
                className="w-full p-2 border border-[#E5E7E0] rounded font-mono text-xs"
                rows={6}
                required
              />
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium cursor-pointer"
                >
                  Process Bulk Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Payment Recording Modal */}
      {manualPayInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7E0] max-w-sm w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="font-semibold text-sm text-[#252923]">Record Manual Payment</h3>
              <button onClick={() => setManualPayInvoice(null)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <div>
              <div className="text-[#73766F]">Invoice: <span className="font-mono font-semibold text-[#252923]">{manualPayInvoice.invoiceNumber}</span></div>
              <div className="text-[#73766F]">Customer: <span className="font-medium text-[#252923]">{manualPayInvoice.customerName}</span></div>
            </div>
            <form onSubmit={handleRecordManualPaymentSubmit} className="space-y-3">
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Amount to Credit (₹)</label>
                <input
                  type="number"
                  value={manualPayAmount}
                  onChange={e => setManualPayAmount(Number(e.target.value))}
                  max={manualPayInvoice.balanceDue}
                  min={1}
                  className="w-full p-2 border border-[#E5E7E0] rounded font-mono font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Payment Method</label>
                <select
                  value={manualPayMethod}
                  onChange={e => setManualPayMethod(e.target.value as any)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT / RTGS / IMPS)</option>
                  <option value="upi">Direct UPI (Counter QR / VPA)</option>
                  <option value="cash">Cash Received at Counter</option>
                  <option value="cheque">Bank Cheque</option>
                </select>
              </div>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Bank Reference / UTR Number</label>
                <input
                  type="text"
                  value={manualPayRef}
                  onChange={e => setManualPayRef(e.target.value)}
                  placeholder="e.g. HDFC260991823"
                  className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                  required
                />
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualPayInvoice(null)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium"
                >
                  Save Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
