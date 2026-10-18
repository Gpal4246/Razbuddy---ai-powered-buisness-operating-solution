import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { api } from '../../api/client.ts';
import { CurrencyFormat } from './CurrencyFormat.tsx';
import { X, Plus, Trash2, Loader2 } from 'lucide-react';
import { Customer, Product, ServiceOffering } from '../../types/index.ts';

export const QuickCreateModal: React.FC = () => {
  const { quickCreateTarget, closeQuickCreate, showToast, triggerRefresh } = useApp();
  const [tab, setTab] = useState<'order' | 'invoice' | 'customer' | 'product' | 'booking'>('order');
  const [loading, setLoading] = useState(false);

  // Reference data
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceOffering[]>([]);

  // Form states
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [lineItems, setLineItems] = useState<Array<{ productId: string; quantity: number; unitPrice: number }>>([
    { productId: '', quantity: 1, unitPrice: 0 }
  ]);
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]);

  // Customer form
  const [custName, setCustName] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custType, setCustType] = useState<'retail' | 'wholesale' | 'b2b_corporate'>('retail');
  const [custGstin, setCustGstin] = useState('');
  const [custState, setCustState] = useState('Maharashtra');
  const [custCreditLimit, setCustCreditLimit] = useState(50000);
  const [custAddress, setCustAddress] = useState('');

  // Product form
  const [prodSku, setProdSku] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('Power Backup');
  const [prodHsn, setProdHsn] = useState('8504');
  const [prodWarranty, setProdWarranty] = useState(24);
  const [prodUnit, setProdUnit] = useState<'pcs' | 'box' | 'kg' | 'meter'>('pcs');
  const [prodSellingPrice, setProdSellingPrice] = useState(1000);
  const [prodCostPrice, setProdCostPrice] = useState(750);
  const [prodStock, setProdStock] = useState(10);
  const [prodThreshold, setProdThreshold] = useState(5);

  // Booking form
  const [bookServiceId, setBookServiceId] = useState('');
  const [bookStaff, setBookStaff] = useState('Ganesh Jadhav');
  const [bookDate, setBookDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookStartTime, setBookStartTime] = useState('11:00');
  const [bookEndTime, setBookEndTime] = useState('12:30');

  useEffect(() => {
    if (!quickCreateTarget) return;
    if (quickCreateTarget === 'invoice') setTab('invoice');
    else if (quickCreateTarget === 'customer') setTab('customer');
    else if (quickCreateTarget === 'product') setTab('product');
    else if (quickCreateTarget === 'booking') setTab('booking');
    else setTab('order');

    Promise.all([
      api.getCustomers(),
      api.getProducts(),
      api.getServices(),
    ]).then(([c, p, s]) => {
      setCustomers(c);
      setProducts(p);
      setServices(s);
      if (c.length > 0) setSelectedCustomerId(c[0].id);
      if (p.length > 0) {
        setLineItems([{ productId: p[0].id, quantity: 1, unitPrice: p[0].sellingPrice }]);
      }
      if (s.length > 0) setBookServiceId(s[0].id);
    });
  }, [quickCreateTarget]);

  if (!quickCreateTarget) return null;

  const handleProductSelect = (index: number, prodId: string) => {
    const prod = products.find(p => p.id === prodId);
    const updated = [...lineItems];
    updated[index].productId = prodId;
    if (prod) {
      updated[index].unitPrice = prod.sellingPrice;
    }
    setLineItems(updated);
  };

  const handleAddLineItem = () => {
    const firstProd = products[0];
    setLineItems([...lineItems, { productId: firstProd ? firstProd.id : '', quantity: 1, unitPrice: firstProd ? firstProd.sellingPrice : 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (tab === 'order') {
        const ord = await api.createOrder({
          customerId: selectedCustomerId,
          items: lineItems,
          notes,
        });
        if (ord.status === 'pending_approval') {
          showToast(`Order placed on Credit Hold: ${ord.creditHoldReason}`, 'info');
        } else {
          showToast('Sales order confirmed and stock reserved', 'success');
        }
      } else if (tab === 'invoice') {
        await api.createInvoice({
          customerId: selectedCustomerId,
          items: lineItems.map(it => {
            const p = products.find(pr => pr.id === it.productId);
            return {
              productId: it.productId,
              description: p?.name || 'Item',
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              hsnCode: p?.hsnCode || '8504',
            };
          }),
          dueDate,
          notes,
        });
        showToast('GST Invoice issued successfully', 'success');
      } else if (tab === 'customer') {
        await api.createCustomer({
          name: custName,
          phone: custPhone,
          email: custEmail,
          customerType: custType,
          gstin: custGstin,
          state: custState,
          address: custAddress,
          creditLimit: Number(custCreditLimit),
          tags: [custType, custState],
        });
        showToast('Customer profile registered with credit limit', 'success');
      } else if (tab === 'product') {
        await api.createProduct({
          sku: prodSku,
          name: prodName,
          description: `${prodName} - ${prodCategory}`,
          category: prodCategory,
          hsnCode: prodHsn,
          warrantyMonths: Number(prodWarranty),
          unit: prodUnit,
          sellingPrice: Number(prodSellingPrice),
          costPrice: Number(prodCostPrice),
          currentStock: Number(prodStock),
          reorderThreshold: Number(prodThreshold),
          status: 'active',
        });
        showToast('Product added with HSN code & warranty', 'success');
      } else if (tab === 'booking') {
        await api.createBooking({
          serviceId: bookServiceId,
          customerId: selectedCustomerId,
          staffName: bookStaff,
          date: bookDate,
          startTime: bookStartTime,
          endTime: bookEndTime,
          notes,
        });
        showToast('Service appointment scheduled without conflict', 'success');
      }
      triggerRefresh();
      closeQuickCreate();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl border border-[#E5E7E0] overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header with Sub-tabs */}
        <div className="p-4 border-b border-[#E5E7E0] bg-[#F7F7F4] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#6D876D] uppercase tracking-wider">Quick Create:</span>
            <div className="flex gap-1">
              {(['order', 'invoice', 'customer', 'product', 'booking'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className={`px-2 py-0.5 rounded text-xs capitalize font-medium transition-colors cursor-pointer ${
                    tab === t ? 'bg-[#6D876D] text-white' : 'bg-white text-[#73766F] hover:bg-stone-200'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <button onClick={closeQuickCreate} className="p-1 text-[#73766F] hover:text-[#252923]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto space-y-4 text-xs">
          {(tab === 'order' || tab === 'invoice') && (
            <>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Customer</label>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  required
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) - {c.state || 'Maharashtra'} - Limit: ₹{c.creditLimit?.toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {tab === 'invoice' && (
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              )}

              {/* Line items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[#73766F] font-medium">Line Items (HSN mapped)</label>
                  <button
                    type="button"
                    onClick={handleAddLineItem}
                    className="text-[#6D876D] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </button>
                </div>
                <div className="space-y-2">
                  {lineItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#F7F7F4] p-2 rounded border border-[#E5E7E0]">
                      <select
                        value={item.productId}
                        onChange={e => handleProductSelect(idx, e.target.value)}
                        className="flex-1 p-1.5 border border-[#E5E7E0] rounded bg-white text-xs truncate"
                        required
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (HSN: {p.hsnCode}) - Stock: {p.currentStock}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={e => {
                          const updated = [...lineItems];
                          updated[idx].quantity = Math.max(1, Number(e.target.value));
                          setLineItems(updated);
                        }}
                        placeholder="Qty"
                        className="w-16 p-1.5 border border-[#E5E7E0] rounded bg-white text-center font-mono"
                        required
                      />
                      <div className="w-24 text-right font-mono font-medium">
                        <CurrencyFormat amount={item.quantity * item.unitPrice} />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(idx)}
                        disabled={lineItems.length === 1}
                        className="text-stone-400 hover:text-rose-600 disabled:opacity-30"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[#73766F] font-medium mb-1">Notes / Shipping Details</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional delivery instructions or purchase order cross-reference..."
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                  rows={2}
                />
              </div>
            </>
          )}

          {tab === 'customer' && (
            <>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Customer / Legal Business Name</label>
                <input
                  type="text"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  placeholder="e.g. Apex Engineering Solutions"
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Phone Number (+91)</label>
                  <input
                    type="text"
                    value={custPhone}
                    onChange={e => setCustPhone(e.target.value)}
                    placeholder="+91 98200 00000"
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={custEmail}
                    onChange={e => setCustEmail(e.target.value)}
                    placeholder="accounts@domain.com"
                    className="w-full p-2 border border-[#E5E7E0] rounded"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">State (GST Place of Supply)</label>
                  <select
                    value={custState}
                    onChange={e => setCustState(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  >
                    <option value="Maharashtra">Maharashtra (Intrastate CGST+SGST)</option>
                    <option value="Gujarat">Gujarat (Interstate IGST)</option>
                    <option value="Karnataka">Karnataka (Interstate IGST)</option>
                    <option value="Delhi">Delhi (Interstate IGST)</option>
                    <option value="Telangana">Telangana (Interstate IGST)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    value={custGstin}
                    onChange={e => setCustGstin(e.target.value)}
                    placeholder="27AABCK1234F1Z8"
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Customer Classification</label>
                  <select
                    value={custType}
                    onChange={e => setCustType(e.target.value as any)}
                    className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  >
                    <option value="retail">Retail Client</option>
                    <option value="wholesale">Wholesaler / Distributor</option>
                    <option value="b2b_corporate">Corporate B2B</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Assigned Credit Limit (₹)</label>
                  <input
                    type="number"
                    value={custCreditLimit}
                    onChange={e => setCustCreditLimit(Number(e.target.value))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#73766F] font-medium mb-1">Billing / Delivery Address</label>
                <input
                  type="text"
                  value={custAddress}
                  onChange={e => setCustAddress(e.target.value)}
                  placeholder="Premises, Street, City, Pincode"
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                />
              </div>
            </>
          )}

          {tab === 'product' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">SKU Code</label>
                  <input
                    type="text"
                    value={prodSku}
                    onChange={e => setProdSku(e.target.value)}
                    placeholder="e.g. NET-SW-16P"
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">HSN Code</label>
                  <input
                    type="text"
                    value={prodHsn}
                    onChange={e => setProdHsn(e.target.value)}
                    placeholder="e.g. 8504, 8517, 8507"
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#73766F] font-medium mb-1">Product Name</label>
                <input
                  type="text"
                  value={prodName}
                  onChange={e => setProdName(e.target.value)}
                  placeholder="e.g. TP-Link 16-Port Gigabit Switch"
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Category</label>
                  <select
                    value={prodCategory}
                    onChange={e => setProdCategory(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded bg-white text-xs"
                  >
                    <option value="Power Backup">Power Backup</option>
                    <option value="Networking">Networking</option>
                    <option value="POS & Retail">POS & Retail</option>
                    <option value="Surveillance">Surveillance</option>
                    <option value="Storage">Storage</option>
                    <option value="Cables & Acc">Cables & Acc</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Unit</label>
                  <select
                    value={prodUnit}
                    onChange={e => setProdUnit(e.target.value as any)}
                    className="w-full p-2 border border-[#E5E7E0] rounded bg-white text-xs"
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="box">Box (box)</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="meter">Meter (meter)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Warranty (Months)</label>
                  <input
                    type="number"
                    value={prodWarranty}
                    onChange={e => setProdWarranty(Number(e.target.value))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    value={prodSellingPrice}
                    onChange={e => setProdSellingPrice(Number(e.target.value))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono font-medium"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    value={prodCostPrice}
                    onChange={e => setProdCostPrice(Number(e.target.value))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={prodStock}
                    onChange={e => setProdStock(Number(e.target.value))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Reorder Alert Threshold</label>
                  <input
                    type="number"
                    value={prodThreshold}
                    onChange={e => setProdThreshold(Number(e.target.value))}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>
            </>
          )}

          {tab === 'booking' && (
            <>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Service Offering (SAC Mapped)</label>
                <select
                  value={bookServiceId}
                  onChange={e => setBookServiceId(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  required
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} (₹{s.price} • SAC: {s.sacCode} • {s.durationMinutes} mins)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[#73766F] font-medium mb-1">Client</label>
                <select
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  required
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Assigned Field Technician</label>
                  <select
                    value={bookStaff}
                    onChange={e => setBookStaff(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  >
                    <option value="Ganesh Jadhav">Ganesh Jadhav (Field Lead)</option>
                    <option value="Santosh Pawar">Santosh Pawar (Specialist)</option>
                    <option value="Pooja More">Pooja More (POS Trainer)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Date</label>
                  <input
                    type="date"
                    value={bookDate}
                    onChange={e => setBookDate(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={bookStartTime}
                    onChange={e => setBookStartTime(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    value={bookEndTime}
                    onChange={e => setBookEndTime(e.target.value)}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>
            </>
          )}

          <div className="pt-2 border-t border-[#E5E7E0] flex justify-end gap-2">
            <button
              type="button"
              onClick={closeQuickCreate}
              className="px-3 py-2 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-[#6D876D] hover:bg-[#5a725a] disabled:opacity-50 text-white rounded font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Create {tab}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
