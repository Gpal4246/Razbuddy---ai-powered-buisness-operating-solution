import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  TrendingUp, 
  DollarSign, 
  Package, 
  Users, 
  CheckCircle2, 
  Loader2,
  FileText
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { business, showToast, refreshSignal } = useApp();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getOrders(),
      api.getInvoices(),
      api.getPayments(),
      api.getProducts(),
      api.getBookings(),
    ]).then(([ords, invs, pays, prods, bkgs]) => {
      setOrders(ords);
      setInvoices(invs);
      setPayments(pays);
      setProducts(prods);
      setBookings(bkgs);
    }).catch(err => {
      console.error('Failed to load reports data:', err);
    }).finally(() => {
      setLoading(false);
    });
  }, [refreshSignal]);

  // Derived Financial calculations
  const totalInvoiced = invoices.reduce((s, i) => s + i.totalAmount, 0);
  const totalCollections = payments.reduce((s, p) => s + p.amount, 0);
  const totalOutstanding = invoices.reduce((s, i) => s + i.balanceDue, 0);
  const inventoryAssetValuation = products.reduce((s, p) => s + (p.currentStock * (p.costPrice || p.sellingPrice * 0.7)), 0);

  // Category breakdown
  const categoryMap: Record<string, number> = {};
  for (const o of orders) {
    for (const it of o.items) {
      const cat = products.find(p => p.id === it.productId)?.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + it.total;
    }
  }

  // State / Place of Supply breakdown (Intrastate vs Interstate)
  const stateMap: Record<string, number> = {};
  for (const inv of invoices) {
    const st = inv.customerState || business?.state || 'Maharashtra';
    stateMap[st] = (stateMap[st] || 0) + inv.totalAmount;
  }

  // Payment method breakdown
  const methodMap: Record<string, number> = {};
  for (const p of payments) {
    methodMap[p.paymentMethod] = (methodMap[p.paymentMethod] || 0) + p.amount;
  }

  const handleExportSummary = () => {
    const rows = [
      ['Report Item', 'Value (INR)'],
      ['Total Sales Invoiced', String(totalInvoiced)],
      ['Total Collections Received', String(totalCollections)],
      ['Total Outstanding Receivables', String(totalOutstanding)],
      ['Inventory Asset Valuation (at Cost)', String(inventoryAssetValuation)],
      ['Total Bookings Count', String(bookings.length)],
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `razbuddy-summary-report-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Summary report exported', 'success');
  };

  const handleDownloadGstr1 = () => {
    window.open(api.getGstr1ExportUrl(), '_blank');
    showToast('Downloaded GSTR-1 compliance CSV', 'success');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-xs text-[#73766F]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Aggregating analytical ledgers...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E7E0]">
        <div>
          <h2 className="text-xl font-bold text-[#252923] tracking-tight">Reports & Business Intelligence</h2>
          <p className="text-xs text-[#73766F] mt-0.5">
            Operational and accounting metrics generated from verifiable business events
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadGstr1}
            className="px-3 py-1.5 rounded border border-[#6D876D]/40 bg-[#6D876D]/10 hover:bg-[#6D876D]/20 text-[#3d513d] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#6D876D]" />
            <span>GSTR-1 CSV</span>
          </button>
          <button
            onClick={handleExportSummary}
            className="px-3 py-1.5 rounded bg-[#6D876D] hover:bg-[#5a725a] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Summary CSV</span>
          </button>
        </div>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs">
          <div className="text-xs text-[#73766F] font-medium">Total Invoiced Sales</div>
          <div className="text-xl font-bold font-mono text-[#252923] mt-1">
            <CurrencyFormat amount={totalInvoiced} />
          </div>
          <div className="text-[11px] text-[#6D876D] mt-1 font-mono">
            {invoices.length} GST invoices generated
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs">
          <div className="text-xs text-[#73766F] font-medium">Total Collections Received</div>
          <div className="text-xl font-bold font-mono text-emerald-700 mt-1">
            <CurrencyFormat amount={totalCollections} />
          </div>
          <div className="text-[11px] text-[#73766F] mt-1 font-mono">
            {payments.length} verified transactions
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs">
          <div className="text-xs text-[#73766F] font-medium">Outstanding Receivables (Udhaar)</div>
          <div className="text-xl font-bold font-mono text-rose-700 mt-1">
            <CurrencyFormat amount={totalOutstanding} />
          </div>
          <div className="text-[11px] text-rose-600 mt-1 font-mono">
            {invoices.filter(i => i.balanceDue > 0).length} unpaid accounts
          </div>
        </div>

        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs">
          <div className="text-xs text-[#73766F] font-medium">Inventory Asset Valuation</div>
          <div className="text-xl font-bold font-mono text-[#252923] mt-1">
            <CurrencyFormat amount={inventoryAssetValuation} />
          </div>
          <div className="text-[11px] text-[#73766F] mt-1 font-mono">
            Across {products.length} catalog items
          </div>
        </div>
      </div>

      {/* Breakdown Grids */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Sales by Product Category */}
        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs space-y-3">
          <h3 className="text-sm font-semibold text-[#252923]">Sales Volume by Category</h3>
          <div className="space-y-2 pt-2">
            {Object.entries(categoryMap).map(([cat, val]) => {
              const pct = totalInvoiced > 0 ? Math.round((val / totalInvoiced) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[#252923]">{cat}</span>
                    <span className="font-mono text-[#73766F]">
                      <CurrencyFormat amount={val} /> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F7F7F4] h-2 rounded-full overflow-hidden border border-[#E5E7E0]">
                    <div className="bg-[#6D876D] h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* GST Sales by Place of Supply */}
        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs space-y-3">
          <h3 className="text-sm font-semibold text-[#252923]">GST Place of Supply (Inter/Intra)</h3>
          <div className="space-y-2 pt-2">
            {Object.entries(stateMap).map(([st, val]) => {
              const isIntra = st.toLowerCase() === (business?.state || 'Maharashtra').toLowerCase();
              const pct = totalInvoiced > 0 ? Math.round((val / totalInvoiced) * 100) : 0;
              return (
                <div key={st} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[#252923] flex items-center gap-1.5">
                      {st}
                      <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                        isIntra ? 'bg-[#6D876D]/15 text-[#3d513d]' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {isIntra ? 'CGST+SGST' : 'IGST'}
                      </span>
                    </span>
                    <span className="font-mono text-[#73766F]">
                      <CurrencyFormat amount={val} /> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F7F7F4] h-2 rounded-full overflow-hidden border border-[#E5E7E0]">
                    <div className={`${isIntra ? 'bg-[#6D876D]' : 'bg-purple-600'} h-full rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Collections by Payment Channel */}
        <div className="p-4 bg-white rounded-lg border border-[#E5E7E0] shadow-2xs space-y-3">
          <h3 className="text-sm font-semibold text-[#252923]">Collections by Payment Channel</h3>
          <div className="space-y-2 pt-2">
            {Object.entries(methodMap).map(([method, val]) => {
              const pct = totalCollections > 0 ? Math.round((val / totalCollections) * 100) : 0;
              return (
                <div key={method} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-[#252923] capitalize">{method.replace('_', ' ')}</span>
                    <span className="font-mono text-[#73766F]">
                      <CurrencyFormat amount={val} /> ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#F7F7F4] h-2 rounded-full overflow-hidden border border-[#E5E7E0]">
                    <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
