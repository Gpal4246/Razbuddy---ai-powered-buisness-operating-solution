import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { api } from '../../api/client.ts';
import { Search, X, Users, Package, ShoppingBag, FileText, Calendar, ArrowRight, ShieldCheck, ShieldAlert, Barcode, CheckCircle2 } from 'lucide-react';
import { CurrencyFormat } from './CurrencyFormat.tsx';
import { SerialWarrantyLookupResult } from '../../types/index.ts';

export const GlobalSearchModal: React.FC = () => {
  const { isSearchOpen, setIsSearchOpen, navigate, openCustomer360 } = useApp();
  const [query, setQuery] = useState('');
  const [warrantyResult, setWarrantyResult] = useState<SerialWarrantyLookupResult | null>(null);
  const [results, setResults] = useState<{
    customers: any[];
    products: any[];
    orders: any[];
    invoices: any[];
    bookings: any[];
  }>({
    customers: [],
    products: [],
    orders: [],
    invoices: [],
    bookings: [],
  });

  useEffect(() => {
    if (!isSearchOpen) {
      setQuery('');
      setWarrantyResult(null);
      setResults({ customers: [], products: [], orders: [], invoices: [], bookings: [] });
      return;
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!query.trim()) {
      setWarrantyResult(null);
      setResults({ customers: [], products: [], orders: [], invoices: [], bookings: [] });
      return;
    }

    const q = query.toLowerCase();

    // Check if query looks like a serial number (e.g. starts with SN- or has dashes)
    if (q.includes('sn-') || q.includes('exd') || q.includes('tpl') || q.includes('hik')) {
      api.lookupWarranty(query.trim())
        .then(res => setWarrantyResult(res))
        .catch(() => setWarrantyResult(null));
    } else {
      setWarrantyResult(null);
    }

    Promise.all([
      api.getCustomers(q),
      api.getProducts(q),
      api.getOrders(),
      api.getInvoices(),
      api.getBookings(),
    ]).then(([custs, prods, ords, invs, bkgs]) => {
      setResults({
        customers: custs.slice(0, 4),
        products: prods.slice(0, 4),
        orders: ords.filter(o => o.orderNumber.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q)).slice(0, 4),
        invoices: invs.filter(i => i.invoiceNumber.toLowerCase().includes(q) || i.customerName.toLowerCase().includes(q)).slice(0, 4),
        bookings: bkgs.filter(b => b.bookingNumber.toLowerCase().includes(q) || b.customerName.toLowerCase().includes(q) || b.serviceName.toLowerCase().includes(q)).slice(0, 4),
      });
    }).catch(err => {
      console.error('Search error:', err);
    });
  }, [query]);

  if (!isSearchOpen) return null;

  const totalHits = 
    (warrantyResult ? 1 : 0) +
    results.customers.length +
    results.products.length +
    results.orders.length +
    results.invoices.length +
    results.bookings.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-lg shadow-2xl border border-[#E5E7E0] overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-[#E5E7E0] bg-[#F7F7F4]">
          <Search className="w-5 h-5 text-[#73766F] mr-3 shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type serial # (e.g. SN-EXD-9812-44), customer, SKU, or invoice..."
            autoFocus
            className="w-full bg-transparent text-sm text-[#252923] placeholder-[#73766F] focus:outline-hidden"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#73766F] hover:text-[#252923] p-1 rounded hover:bg-stone-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsSearchOpen(false)}
            className="ml-2 px-2 py-0.5 text-xs text-[#73766F] border border-[#E5E7E0] rounded bg-white hover:bg-stone-100"
          >
            ESC
          </button>
        </div>

        {/* Quick Sample Serial Chips */}
        <div className="px-4 py-1.5 bg-stone-50 border-b border-[#E5E7E0] flex items-center gap-1.5 text-[11px] overflow-x-auto">
          <span className="text-[#73766F] font-medium flex items-center gap-1 shrink-0">
            <Barcode className="w-3.5 h-3.5 text-[#6D876D]" /> Test Serials:
          </span>
          {['SN-EXD-9812-44', 'SN-TPL-5512-09', 'SN-HIK-7721-33'].map(sn => (
            <button
              key={sn}
              onClick={() => setQuery(sn)}
              className="px-2 py-0.5 bg-white border border-[#E5E7E0] rounded hover:border-[#6D876D] font-mono text-[10px] text-[#252923] cursor-pointer"
            >
              {sn}
            </button>
          ))}
        </div>

        {/* Search Results Area */}
        <div className="p-3 overflow-y-auto space-y-4">
          {/* 1. RMA SERIAL NUMBER / WARRANTY LOOKUP CARD */}
          {warrantyResult && (
            <div className="p-4 rounded-lg border-2 border-[#6D876D] bg-[#6D876D]/5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-[10px] font-bold text-[#6D876D] uppercase tracking-wider font-mono flex items-center gap-1">
                    <Barcode className="w-3.5 h-3.5" /> RMA Warranty Verification
                  </div>
                  <h4 className="text-sm font-bold text-[#252923] mt-0.5">
                    {warrantyResult.productName}
                  </h4>
                  <div className="text-xs text-[#73766F] font-mono mt-0.5">
                    Serial No: <span className="font-bold text-[#252923]">{warrantyResult.serialNumber}</span> | SKU: {warrantyResult.sku} | HSN: {warrantyResult.hsnCode}
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold flex items-center gap-1 ${
                  warrantyResult.isWarrantyActive 
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}>
                  {warrantyResult.isWarrantyActive ? (
                    <>
                      <ShieldCheck className="w-3.5 h-3.5" /> WARRANTY ACTIVE
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-3.5 h-3.5" /> WARRANTY EXPIRED
                    </>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2.5 rounded border border-[#E5E7E0] text-xs font-mono">
                <div>
                  <div className="text-[10px] text-[#73766F]">Customer Sold To</div>
                  <div className="font-semibold text-[#252923] truncate">{warrantyResult.customerName}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#73766F]">Sale Invoice</div>
                  <div className="font-semibold text-[#252923]">{warrantyResult.invoiceNumber}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#73766F]">Date Sold</div>
                  <div className="text-[#252923]">{warrantyResult.saleDate}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#73766F]">Warranty Expiry</div>
                  <div className={`font-semibold ${warrantyResult.isWarrantyActive ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {warrantyResult.warrantyExpiryDate}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#73766F]">
                <span>Original Supplier: <strong className="text-[#252923]">{warrantyResult.supplierName}</strong></span>
                <span className="text-[#6D876D] font-medium">Verified for Counter Replacement</span>
              </div>
            </div>
          )}

          {!query.trim() ? (
            <div className="py-8 text-center text-xs text-[#73766F]">
              Type keywords, SKU codes, customer names, or scan an RMA Serial Number.
            </div>
          ) : totalHits === 0 ? (
            <div className="py-8 text-center text-xs text-[#73766F]">
              No records found matching "{query}".
            </div>
          ) : (
            <>
              {/* Customers Section */}
              {results.customers.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#73766F] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#6D876D]" /> Customers
                  </div>
                  <div className="space-y-1">
                    {results.customers.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          openCustomer360(c.id);
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[#F7F7F4] flex items-center justify-between text-xs transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-[#252923]">{c.name}</div>
                          <div className="text-[#73766F] text-[11px]">{c.phone} • {c.customerType} • Limit: ₹{c.creditLimit?.toLocaleString('en-IN')}</div>
                        </div>
                        <ArrowRight className="w-4 h-4 text-[#73766F] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Products Section */}
              {results.products.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#73766F] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-[#6D876D]" /> Products & Inventory
                  </div>
                  <div className="space-y-1">
                    {results.products.map(p => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigate('inventory', 'catalogue');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[#F7F7F4] flex items-center justify-between text-xs transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-[#252923]">{p.name}</div>
                          <div className="text-[#73766F] text-[11px] font-mono">SKU: {p.sku} | HSN: {p.hsnCode} | Stock: {p.currentStock} {p.unit}</div>
                        </div>
                        <CurrencyFormat amount={p.sellingPrice} className="font-medium" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Invoices Section */}
              {results.invoices.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#73766F] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#6D876D]" /> Invoices
                  </div>
                  <div className="space-y-1">
                    {results.invoices.map(i => (
                      <button
                        key={i.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigate('sales', 'invoices');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[#F7F7F4] flex items-center justify-between text-xs transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-[#252923]">{i.invoiceNumber} • {i.customerName}</div>
                          <div className="text-[#73766F] text-[11px]">Due: {i.dueDate} • Status: {i.status}</div>
                        </div>
                        <CurrencyFormat amount={i.totalAmount} className="font-medium" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orders Section */}
              {results.orders.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#73766F] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#6D876D]" /> Sales Orders
                  </div>
                  <div className="space-y-1">
                    {results.orders.map(o => (
                      <button
                        key={o.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigate('sales', 'orders');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[#F7F7F4] flex items-center justify-between text-xs transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-[#252923]">{o.orderNumber} • {o.customerName}</div>
                          <div className="text-[#73766F] text-[11px]">Status: {o.status}</div>
                        </div>
                        <CurrencyFormat amount={o.totalAmount} className="font-medium" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bookings Section */}
              {results.bookings.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-[#73766F] uppercase tracking-wider px-2 mb-1 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#6D876D]" /> Appointments
                  </div>
                  <div className="space-y-1">
                    {results.bookings.map(b => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setIsSearchOpen(false);
                          navigate('bookings', 'appointments');
                        }}
                        className="w-full text-left px-3 py-2 rounded hover:bg-[#F7F7F4] flex items-center justify-between text-xs transition-colors group cursor-pointer"
                      >
                        <div>
                          <div className="font-medium text-[#252923]">{b.bookingNumber} • {b.serviceName}</div>
                          <div className="text-[#73766F] text-[11px]">{b.customerName} • {b.date} at {b.startTime}</div>
                        </div>
                        <CurrencyFormat amount={b.totalAmount} className="font-medium" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
