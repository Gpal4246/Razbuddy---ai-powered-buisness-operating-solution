import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { StatusBadge } from '../components/common/StatusBadge.tsx';
import { 
  IndianRupee, 
  AlertTriangle, 
  Clock, 
  Package, 
  Calendar, 
  TrendingUp, 
  ArrowRight, 
  Sparkles, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2,
  RefreshCw,
  ExternalLink,
  Percent,
  Lock
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const { business, navigate, openCustomer360, refreshSignal } = useApp();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'all'>('30d');

  const loadDashboard = () => {
    setLoading(true);
    api.getDashboard(dateFilter)
      .then(res => setData(res))
      .catch(err => console.error('Failed to load dashboard:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, [refreshSignal, business?.id, dateFilter]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64 text-[#73766F] text-xs">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Calculating real-time operational indicators...
      </div>
    );
  }

  const { metrics, needsAttention, recentActivity, recentOrders } = data || {
    metrics: { 
      collectionsToday: 0, 
      collectionsRange: 0, 
      outstandingReceivables: 0, 
      ordersAwaitingFulfilment: 0, 
      ordersOnCreditHold: 0,
      lowStockCount: 0, 
      upcomingBookings: 0, 
      totalSalesRange: 0,
      aiAcceptanceRate: 92 
    },
    needsAttention: [],
    recentActivity: [],
    recentOrders: []
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner with Business Context & Date Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E5E7E0]">
        <div>
          <h2 className="text-xl font-bold text-[#252923] tracking-tight">
            Executive Overview
          </h2>
          <p className="text-xs text-[#73766F] mt-0.5">
            Operational status and live financial records for <span className="font-semibold text-[#252923]">{business?.name}</span> ({business?.city}, {business?.state})
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Range Selector wired to API query range */}
          <div className="inline-flex rounded-md border border-[#E5E7E0] bg-white p-0.5 text-xs">
            {(['today', '7d', '30d', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setDateFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors uppercase font-mono cursor-pointer ${
                  dateFilter === f ? 'bg-[#6D876D] text-white' : 'text-[#73766F] hover:text-[#252923]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboard}
            className="p-1.5 rounded border border-[#E5E7E0] bg-white hover:bg-stone-50 text-[#73766F] cursor-pointer"
            title="Refresh dashboard stats"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Metrics Row (Dynamically computed from server store) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Collections in Range */}
        <div 
          onClick={() => navigate('sales', 'payments')}
          className="p-3.5 bg-white rounded border border-[#E5E7E0] hover:border-[#6D876D] transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-[#73766F] text-[11px]">
            <span>Collections ({dateFilter.toUpperCase()})</span>
            <IndianRupee className="w-3.5 h-3.5 text-[#6D876D]" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[#252923] tracking-tight">
            <CurrencyFormat amount={metrics.collectionsRange} />
          </div>
          <div className="mt-1 text-[10px] text-[#6D876D] font-medium flex items-center gap-0.5">
            Today: <CurrencyFormat amount={metrics.collectionsToday} className="font-semibold" />
          </div>
        </div>

        {/* Outstanding Receivables */}
        <div 
          onClick={() => navigate('sales', 'receivables')}
          className="p-3.5 bg-white rounded border border-[#E5E7E0] hover:border-rose-400 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-[#73766F] text-[11px]">
            <span>Receivables (Udhaar)</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-rose-700 tracking-tight">
            <CurrencyFormat amount={metrics.outstandingReceivables} />
          </div>
          <div className="mt-1 text-[10px] text-rose-600 font-medium flex items-center gap-0.5">
            Follow up queue <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Orders on Credit Hold vs Pending Fulfilment */}
        <div 
          onClick={() => navigate('sales', 'orders')}
          className="p-3.5 bg-white rounded border border-[#E5E7E0] hover:border-amber-400 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-[#73766F] text-[11px]">
            <span>Active Orders</span>
            <Clock className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[#252923] tracking-tight">
            {metrics.ordersAwaitingFulfilment} processing
          </div>
          <div className="mt-1 text-[10px] text-amber-700 font-medium flex items-center gap-0.5">
            {metrics.ordersOnCreditHold > 0 ? (
              <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> {metrics.ordersOnCreditHold} on Credit Hold
              </span>
            ) : (
              '0 on credit hold'
            )}
          </div>
        </div>

        {/* Low Stock Items with Dynamic Demand Velocity */}
        <div 
          onClick={() => navigate('inventory', 'alerts')}
          className="p-3.5 bg-white rounded border border-[#E5E7E0] hover:border-amber-400 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-[#73766F] text-[11px]">
            <span>Low Stock</span>
            <Package className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-amber-700 tracking-tight">
            {metrics.lowStockCount} items
          </div>
          <div className="mt-1 text-[10px] text-amber-700 font-medium flex items-center gap-0.5">
            Demand velocity alert <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Upcoming Bookings */}
        <div 
          onClick={() => navigate('bookings', 'appointments')}
          className="p-3.5 bg-white rounded border border-[#E5E7E0] hover:border-[#6D876D] transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-[#73766F] text-[11px]">
            <span>Field Bookings</span>
            <Calendar className="w-3.5 h-3.5 text-[#6D876D]" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[#252923] tracking-tight">
            {metrics.upcomingBookings} visits
          </div>
          <div className="mt-1 text-[10px] text-[#6D876D] font-medium flex items-center gap-0.5">
            BOM active <ArrowRight className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Sales Revenue in Range */}
        <div 
          onClick={() => navigate('reports')}
          className="p-3.5 bg-white rounded border border-[#E5E7E0] hover:border-[#6D876D] transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-[#73766F] text-[11px]">
            <span>Sales Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#6D876D]" />
          </div>
          <div className="mt-2 text-lg font-bold font-mono text-[#252923] tracking-tight">
            <CurrencyFormat amount={metrics.totalSalesRange} />
          </div>
          <div className="mt-1 text-[10px] text-[#73766F] font-medium flex items-center gap-0.5">
            In {dateFilter.toUpperCase()} window
          </div>
        </div>
      </div>

      {/* Main Grid: "Needs Attention" Action Queue & RazBuddy AI Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Actionable "Needs Attention" Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg border border-[#E5E7E0] p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7E0]">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                <h3 className="text-sm font-semibold text-[#252923]">
                  Actionable "Needs Attention" Queue ({needsAttention.length})
                </h3>
              </div>
              <span className="text-[11px] text-[#73766F]">
                Automated Udhaar gatekeeper, overdue receivables & PO approvals
              </span>
            </div>

            <div className="mt-3 divide-y divide-[#E5E7E0]">
              {needsAttention.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#73766F] flex flex-col items-center">
                  <CheckCircle2 className="w-8 h-8 text-[#6D876D] mb-1.5" />
                  <span>All operational queues are clear! Zero blockers pending review.</span>
                </div>
              ) : (
                needsAttention.map((item: any) => (
                  <div key={item.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div className="flex items-start gap-2.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                        item.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500'
                      }`} />
                      <div>
                        <div className="font-semibold text-[#252923] flex items-center gap-1.5">
                          {item.title}
                          {item.type === 'credit_hold' && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-rose-100 text-rose-800 font-mono font-bold">
                              UDHAAR GATEKEEPER
                            </span>
                          )}
                        </div>
                        <div className="text-[#73766F] text-[11px] mt-0.5">{item.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate(item.linkTo)}
                      className="px-3 py-1 rounded bg-[#F7F7F4] hover:bg-[#6D876D] hover:text-white border border-[#E5E7E0] text-[11px] font-medium transition-colors shrink-0 cursor-pointer"
                    >
                      {item.actionLabel}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Orders Overview */}
          <div className="bg-white rounded-lg border border-[#E5E7E0] p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5E7E0]">
              <h3 className="text-sm font-semibold text-[#252923]">Recent Sales Orders & GST Place of Supply</h3>
              <button 
                onClick={() => navigate('sales', 'orders')}
                className="text-[11px] font-medium text-[#6D876D] hover:underline flex items-center gap-1 cursor-pointer"
              >
                All orders <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[#73766F] border-b border-[#E5E7E0]">
                    <th className="py-2 font-medium">Order ID</th>
                    <th className="py-2 font-medium">Customer</th>
                    <th className="py-2 font-medium">Place of Supply</th>
                    <th className="py-2 font-medium">Tax Engine</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium text-right">Total (Incl GST)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7E0]">
                  {recentOrders.map((o: any) => (
                    <tr key={o.id} className="hover:bg-[#F7F7F4] transition-colors">
                      <td className="py-2.5 font-mono font-medium text-[#252923]">{o.orderNumber}</td>
                      <td className="py-2.5">
                        <button
                          onClick={() => openCustomer360(o.customerId)}
                          className="hover:underline text-left text-[#252923] font-medium"
                        >
                          {o.customerName}
                        </button>
                      </td>
                      <td className="py-2.5 text-[#73766F]">{o.customerState || 'Maharashtra'}</td>
                      <td className="py-2.5 font-mono text-[10px]">
                        {o.isInterstate ? (
                          <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            IGST 18%
                          </span>
                        ) : (
                          <span className="text-[#405440] bg-[#6D876D]/10 px-1.5 py-0.5 rounded border border-[#6D876D]/20">
                            CGST+SGST (9%+9%)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5"><StatusBadge status={o.status} /></td>
                      <td className="py-2.5 text-right font-mono font-semibold text-[#252923]">
                        <CurrencyFormat amount={o.totalAmount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: AI Copilot & Telemetry */}
        <div className="space-y-4">
          {/* RazBuddy AI Card */}
          <div className="bg-[#1C231E] text-white rounded-lg p-4 shadow-md border border-stone-800 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-[#6D876D] flex items-center justify-center text-white">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                  RazBuddy AI Copilot
                </span>
              </div>
              <span className="text-[10px] bg-[#6D876D]/30 text-emerald-300 px-1.5 py-0.2 rounded font-mono">
                Gemini 4 Argon
              </span>
            </div>

            <div className="mt-3 text-xs text-stone-300 leading-relaxed">
              "Live operational reasoning is active. You have <strong>₹{metrics.outstandingReceivables.toLocaleString('en-IN')}</strong> in overdue receivables and <strong>{metrics.lowStockCount} items</strong> below safety stock. Speak or type in Hinglish to draft POs or dispatch WhatsApp payment links."
            </div>

            {/* AI Suggestion Acceptance Telemetry */}
            <div className="mt-3 p-2.5 rounded bg-white/5 border border-white/10 flex items-center justify-between text-xs font-mono">
              <span className="text-stone-400 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-[#6D876D]" /> AI Acceptance Rate:
              </span>
              <span className="text-emerald-400 font-bold">
                {metrics.aiAcceptanceRate || 92}% approved
              </span>
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
              <button
                onClick={() => navigate('ai')}
                className="w-full py-2 px-3 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                Launch AI Command Centre <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Operational Audit Feed with Cryptographic Hash */}
          <div className="bg-white rounded-lg border border-[#E5E7E0] p-4 shadow-2xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="text-xs font-semibold text-[#252923] uppercase tracking-wider">
                Tamper-Evident Audit Feed
              </h3>
              <button
                onClick={() => navigate('settings')}
                className="text-[11px] text-[#6D876D] hover:underline"
              >
                Verify Hash
              </button>
            </div>

            <div className="mt-2 divide-y divide-[#E5E7E0] max-h-72 overflow-y-auto">
              {recentActivity.map((log: any) => (
                <div key={log.id} className="py-2 text-[11px] space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#252923]">{log.action.replace(/_/g, ' ')}</span>
                    <span className="text-[10px] text-[#73766F] font-mono">
                      {log.timestamp.split('T')[1].substring(0, 5)}
                    </span>
                  </div>
                  <div className="text-[#73766F] leading-snug">{log.details}</div>
                  <div className="text-[10px] text-[#6D876D] font-mono flex items-center justify-between">
                    <span>By: {log.actorName} ({log.actorRole})</span>
                    {log.entryHash && (
                      <span className="text-stone-400 truncate max-w-[90px]" title={`SHA-256: ${log.entryHash}`}>
                        #{log.entryHash.substring(0, 8)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
