import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { StatusBadge } from '../components/common/StatusBadge.tsx';
import { Booking, ServiceOffering, Product } from '../types/index.ts';
import { 
  Calendar as CalendarIcon, 
  List, 
  Clock, 
  Plus, 
  User, 
  CheckCircle2, 
  CreditCard, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Wrench,
  Trash2,
  FileText,
  Package
} from 'lucide-react';

export const BookingsPage: React.FC = () => {
  const { currentSubTab, navigate, openCustomer360, openRazorpayCheckout, openQuickCreate, showToast, triggerRefresh, refreshSignal } = useApp();
  const [activeTab, setActiveTab] = useState<'calendar' | 'appointments' | 'services'>('calendar');
  const [calendarView, setCalendarView] = useState<'day' | 'week' | 'month'>('month');
  const [loading, setLoading] = useState(true);

  // Data
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Selected date for calendar view
  const [currentDate, setCurrentDate] = useState(new Date('2026-10-16'));

  // Field Technician BOM Complete Modal
  const [bomBooking, setBomBooking] = useState<Booking | null>(null);
  const [bomParts, setBomParts] = useState<Array<{ productId: string; name: string; sku: string; quantity: number; unitPrice: number; hsnCode: string }>>([]);
  const [isCompletingBom, setIsCompletingBom] = useState(false);

  useEffect(() => {
    if (currentSubTab) {
      if (['calendar', 'appointments', 'services'].includes(currentSubTab)) {
        setActiveTab(currentSubTab as any);
      }
    }
  }, [currentSubTab]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getBookings(),
      api.getServices(),
      api.getProducts(),
    ]).then(([bkgs, srvs, prods]) => {
      setBookings(bkgs);
      setServices(srvs);
      setProducts(prods);
    }).catch(err => {
      console.error('Failed to load bookings data:', err);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshSignal]);

  const handleUpdateStatus = async (id: string, status: Booking['status']) => {
    try {
      await api.updateBookingStatus(id, status);
      showToast(`Appointment status updated to ${status}`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openBomModal = (booking: Booking) => {
    setBomBooking(booking);
    if (booking.partsUsed && booking.partsUsed.length > 0) {
      setBomParts(booking.partsUsed.map(p => ({
        ...p,
        hsnCode: p.hsnCode || '8544',
      })));
    } else {
      const defaultProd = products[0];
      setBomParts([
        {
          productId: defaultProd?.id || 'prod-004',
          name: defaultProd?.name || 'Cat6 Cable',
          sku: defaultProd?.sku || 'NET-CAB',
          quantity: 1,
          unitPrice: defaultProd?.sellingPrice || 1500,
          hsnCode: defaultProd?.hsnCode || '8544',
        }
      ]);
    }
  };

  const handleAddBomPart = () => {
    const defaultProd = products[0];
    setBomParts([
      ...bomParts,
      {
        productId: defaultProd?.id || 'prod-004',
        name: defaultProd?.name || 'Cat6 Cable',
        sku: defaultProd?.sku || 'NET-CAB',
        quantity: 1,
        unitPrice: defaultProd?.sellingPrice || 1500,
        hsnCode: defaultProd?.hsnCode || '8544',
      }
    ]);
  };

  const handleRemoveBomPart = (idx: number) => {
    setBomParts(bomParts.filter((_, i) => i !== idx));
  };

  const handleBomPartChange = (idx: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    if (!prod) return;
    const updated = [...bomParts];
    updated[idx] = {
      productId: prod.id,
      name: prod.name,
      sku: prod.sku,
      quantity: updated[idx].quantity || 1,
      unitPrice: prod.sellingPrice,
      hsnCode: prod.hsnCode,
    };
    setBomParts(updated);
  };

  const handleCompleteJobSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bomBooking) return;
    setIsCompletingBom(true);
    try {
      const res = await api.completeBookingAndInvoice(bomBooking.id, bomParts);
      showToast(res.message, 'success');
      setBomBooking(null);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsCompletingBom(false);
    }
  };

  // Calendar date helpers
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Sub-tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E7E0]">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'calendar', label: 'Calendar View', icon: CalendarIcon },
            { id: 'appointments', label: 'Appointment List', icon: List, count: bookings.length },
            { id: 'services', label: 'Service Offerings', icon: Clock, count: services.length },
          ].map(tab => {
            const Icon = tab.icon;
            const isCur = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  navigate('bookings', tab.id);
                }}
                className={`px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer ${
                  isCur
                    ? 'bg-[#6D876D] text-white shadow-2xs font-semibold'
                    : 'bg-white hover:bg-stone-100 text-[#73766F] border border-[#E5E7E0]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    isCur ? 'bg-white/20 text-white' : 'bg-stone-100 text-[#73766F]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'calendar' && (
            <div className="inline-flex rounded-md border border-[#E5E7E0] bg-white p-0.5 text-xs">
              {(['day', 'week', 'month'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCalendarView(v)}
                  className={`px-2.5 py-1 rounded text-xs font-medium capitalize font-mono ${
                    calendarView === v ? 'bg-[#6D876D] text-white' : 'text-[#73766F] hover:text-[#252923]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => openQuickCreate('booking')}
            className="px-3 py-1.5 rounded bg-[#6D876D] hover:bg-[#5a725a] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Appointment</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="bg-white rounded-lg border border-[#E5E7E0] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#73766F] flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading bookings and availability...
          </div>
        ) : (
          <>
            {/* 1. CALENDAR VIEW */}
            {activeTab === 'calendar' && (
              <div className="p-4 space-y-4">
                {/* Month Navigator */}
                <div className="flex items-center justify-between pb-3 border-b border-[#E5E7E0]">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-[#252923]">{monthName}</h3>
                    <span className="text-[11px] text-[#73766F] font-mono">Asia/Kolkata (IST)</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                      className="p-1 rounded border border-[#E5E7E0] hover:bg-stone-50 text-[#73766F]"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date('2026-10-16'))}
                      className="px-2 py-1 rounded border border-[#E5E7E0] text-xs text-[#73766F] hover:bg-stone-50"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                      className="p-1 rounded border border-[#E5E7E0] hover:bg-stone-50 text-[#73766F]"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Calendar Grid (Month View) */}
                {calendarView === 'month' && (
                  <div>
                    <div className="grid grid-cols-7 gap-px bg-[#E5E7E0] border border-[#E5E7E0] rounded overflow-hidden text-center text-xs font-semibold text-[#73766F]">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="bg-[#F7F7F4] py-2">
                          {d}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-px bg-[#E5E7E0] border-x border-b border-[#E5E7E0] text-xs">
                      {Array.from({ length: firstDayIndex }).map((_, i) => (
                        <div key={`empty-${i}`} className="bg-stone-50/50 min-h-24 p-1.5" />
                      ))}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                        const dayBookings = bookings.filter(b => b.date === dateStr);
                        const isToday = dateStr === '2026-10-16';

                        return (
                          <div
                            key={dayNum}
                            className={`min-h-24 p-1.5 transition-colors ${
                              isToday ? 'bg-amber-50/40' : 'bg-white hover:bg-[#F7F7F4]/80'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-[11px] font-mono font-medium ${
                                isToday ? 'w-5 h-5 rounded-full bg-[#6D876D] text-white flex items-center justify-center font-bold' : 'text-[#73766F]'
                              }`}>
                                {dayNum}
                              </span>
                              {dayBookings.length > 0 && (
                                <span className="text-[9px] font-mono text-[#6D876D] font-bold">
                                  {dayBookings.length} appt
                                </span>
                              )}
                            </div>

                            <div className="space-y-1">
                              {dayBookings.map(b => (
                                <div
                                  key={b.id}
                                  onClick={() => openCustomer360(b.customerId)}
                                  className={`p-1 rounded text-[10px] border truncate cursor-pointer transition-shadow hover:shadow-xs ${
                                    b.status === 'confirmed'
                                      ? 'bg-[#6D876D]/15 border-[#6D876D]/30 text-[#3d513d]'
                                      : b.status === 'completed'
                                      ? 'bg-stone-100 border-stone-200 text-stone-700'
                                      : 'bg-amber-100 border-amber-200 text-amber-900'
                                  }`}
                                  title={`${b.serviceName} with ${b.customerName} (${b.startTime} - ${b.endTime})`}
                                >
                                  <div className="font-semibold truncate">{b.startTime} {b.serviceName}</div>
                                  <div className="text-[9px] opacity-80 truncate">{b.customerName}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {calendarView !== 'month' && (
                  <div className="p-6 text-center text-xs text-[#73766F] space-y-2">
                    <CalendarIcon className="w-8 h-8 text-[#6D876D] mx-auto" />
                    <div className="font-medium text-[#252923]">Day & Week View Active</div>
                    <p className="max-w-md mx-auto">
                      All technician assignments include automatic overlap prevention and deposit status checks.
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => setCalendarView('month')}
                        className="px-3 py-1.5 bg-[#6D876D] text-white rounded text-xs cursor-pointer"
                      >
                        Back to Full Month View
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. APPOINTMENT LIST WITH BOM COMPLETE TRIGGER */}
            {activeTab === 'appointments' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Booking ID</th>
                      <th className="py-2.5 px-3 font-medium">Customer & Contact</th>
                      <th className="py-2.5 px-3 font-medium">Service & SAC</th>
                      <th className="py-2.5 px-3 font-medium">Field Technician</th>
                      <th className="py-2.5 px-3 font-medium">Date & Slot</th>
                      <th className="py-2.5 px-3 font-medium">Hardware BOM</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium text-right">Fee</th>
                      <th className="py-2.5 px-3 font-medium text-right">Field Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {bookings.map(b => {
                      const service = services.find(s => s.id === b.serviceId);
                      return (
                        <tr key={b.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                          <td className="py-3 px-3 font-mono font-semibold text-[#252923]">{b.bookingNumber}</td>
                          <td className="py-3 px-3">
                            <button
                              onClick={() => openCustomer360(b.customerId)}
                              className="font-medium text-[#252923] hover:underline text-left block"
                            >
                              {b.customerName}
                            </button>
                            <span className="text-[10px] text-[#73766F] font-mono">{b.customerPhone}</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="text-[#252923] font-medium">{b.serviceName}</div>
                            <span className="text-[10px] text-[#73766F] font-mono">SAC: {service?.sacCode || '9987'}</span>
                          </td>
                          <td className="py-3 px-3 text-[#73766F] flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-[#6D876D]" /> {b.staffName}
                          </td>
                          <td className="py-3 px-3 font-mono text-[#73766F]">
                            <div>{b.date}</div>
                            <div className="text-[10px] text-[#252923] font-semibold">{b.startTime} - {b.endTime}</div>
                          </td>
                          <td className="py-3 px-3">
                            {b.partsUsed && b.partsUsed.length > 0 ? (
                              <div className="font-mono text-[10px] text-[#6D876D]">
                                {b.partsUsed.map(p => `${p.quantity}x ${p.name.split(' ')[0]}`).join(', ')}
                              </div>
                            ) : (
                              <span className="text-[10px] text-[#73766F]">No hardware attached</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <StatusBadge status={b.status} />
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-[#252923]">
                            <CurrencyFormat amount={b.totalAmount} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {b.status === 'requested' && (
                                <button
                                  onClick={() => handleUpdateStatus(b.id, 'confirmed')}
                                  className="px-2 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium cursor-pointer"
                                >
                                  Confirm
                                </button>
                              )}
                              {b.status === 'confirmed' && (
                                <button
                                  onClick={() => handleUpdateStatus(b.id, 'checked_in')}
                                  className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] rounded font-medium cursor-pointer"
                                >
                                  Check In
                                </button>
                              )}
                              {(b.status === 'confirmed' || b.status === 'checked_in') && (
                                <button
                                  onClick={() => openBomModal(b)}
                                  className="px-2.5 py-1 bg-[#1C231E] hover:bg-black text-white text-[10px] rounded font-medium flex items-center gap-1 cursor-pointer"
                                  title="Attach parts used and generate combined GST invoice (SAC + HSN)"
                                >
                                  <Wrench className="w-3 h-3 text-emerald-400" /> Complete & Invoice
                                </button>
                              )}
                              {b.status === 'completed' && b.generatedInvoiceId && (
                                <span className="text-[10px] font-mono text-[#6D876D] font-medium flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3" /> Invoiced
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. SERVICE OFFERINGS */}
            {activeTab === 'services' && (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map(s => (
                  <div key={s.id} className="p-4 bg-white rounded border border-[#E5E7E0] space-y-2 shadow-2xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-semibold text-sm text-[#252923]">{s.name}</div>
                        <div className="text-[11px] text-[#73766F] font-mono">SAC: {s.sacCode} • {s.durationMinutes} mins duration</div>
                      </div>
                      <span className="font-mono font-bold text-sm text-[#6D876D]">
                        <CurrencyFormat amount={s.price} />
                      </span>
                    </div>
                    <p className="text-xs text-[#73766F] leading-relaxed">
                      {s.description}
                    </p>
                    <div className="pt-2 border-t border-[#E5E7E0] flex items-center justify-between text-xs">
                      <span className="text-[#73766F]">
                        Deposit: <CurrencyFormat amount={s.depositRequired} className="font-medium text-[#252923]" />
                      </span>
                      <div className="text-[11px] text-[#73766F] font-mono">
                        Staff: {s.assignedStaff.join(', ')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Field Technician BOM & Complete Job Modal */}
      {bomBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-lg shadow-2xl border border-[#E5E7E0] max-w-xl w-full p-4 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-[#6D876D]" />
                <div>
                  <h3 className="font-bold text-sm text-[#252923]">Field Technician Bill of Materials (BOM)</h3>
                  <p className="text-[10px] text-[#73766F]">
                    Attach hardware parts used during service visit to deduct stock and generate combined GST invoice (SAC + HSN).
                  </p>
                </div>
              </div>
              <button onClick={() => setBomBooking(null)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>

            <div className="bg-[#F7F7F4] p-3 rounded border border-[#E5E7E0] grid grid-cols-3 gap-2 font-mono text-xs">
              <div>
                <span className="text-[10px] text-[#73766F] block">Appointment #</span>
                <strong>{bomBooking.bookingNumber}</strong>
              </div>
              <div>
                <span className="text-[10px] text-[#73766F] block">Customer</span>
                <span>{bomBooking.customerName}</span>
              </div>
              <div>
                <span className="text-[10px] text-[#73766F] block">Service Fee (SAC 9987)</span>
                <strong className="text-[#6D876D]"><CurrencyFormat amount={bomBooking.totalAmount} /></strong>
              </div>
            </div>

            <form onSubmit={handleCompleteJobSubmit} className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[#252923]">Hardware Parts & Consumables Consumed:</label>
                <button
                  type="button"
                  onClick={handleAddBomPart}
                  className="text-[#6D876D] font-semibold flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Part
                </button>
              </div>

              <div className="space-y-2">
                {bomParts.map((part, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-[#F7F7F4] rounded border border-[#E5E7E0]">
                    <select
                      value={part.productId}
                      onChange={e => handleBomPartChange(idx, e.target.value)}
                      className="flex-1 p-1.5 border border-[#E5E7E0] rounded bg-white text-xs truncate"
                      required
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (HSN: {p.hsnCode} • Stock: {p.currentStock})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={part.quantity}
                      onChange={e => {
                        const updated = [...bomParts];
                        updated[idx].quantity = Math.max(1, Number(e.target.value));
                        setBomParts(updated);
                      }}
                      className="w-16 p-1.5 border border-[#E5E7E0] rounded bg-white text-center font-mono"
                      placeholder="Qty"
                      required
                    />
                    <div className="w-24 text-right font-mono font-medium">
                      <CurrencyFormat amount={part.quantity * part.unitPrice} />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveBomPart(idx)}
                      className="text-stone-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Combined GST Invoice Summary Preview */}
              <div className="p-3 bg-stone-50 rounded border border-[#E5E7E0] space-y-1 font-mono text-xs">
                <div className="flex justify-between text-[#73766F]">
                  <span>Labor / Service (SAC 9987):</span>
                  <span><CurrencyFormat amount={bomBooking.totalAmount} /></span>
                </div>
                <div className="flex justify-between text-[#73766F]">
                  <span>Hardware Parts Subtotal (HSN):</span>
                  <span><CurrencyFormat amount={bomParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)} /></span>
                </div>
                <div className="flex justify-between text-[#73766F]">
                  <span>Deposit Credited:</span>
                  <span className="text-emerald-700">-<CurrencyFormat amount={bomBooking.depositStatus === 'paid' ? bomBooking.depositAmount : 0} /></span>
                </div>
                <div className="pt-1 border-t border-[#E5E7E0] flex justify-between font-bold text-[#252923]">
                  <span>Combined Net Amount (Incl 18% GST):</span>
                  <span className="text-[#6D876D]">
                    <CurrencyFormat
                      amount={Math.round(
                        ((bomBooking.totalAmount + bomParts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)) * 1.18 -
                          (bomBooking.depositStatus === 'paid' ? bomBooking.depositAmount : 0)) *
                          100
                      ) / 100}
                    />
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setBomBooking(null)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCompletingBom}
                  className="px-4 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {isCompletingBom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Complete Job & Generate Combined Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
