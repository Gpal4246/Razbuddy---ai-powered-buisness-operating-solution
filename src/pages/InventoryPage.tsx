import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { StatusBadge } from '../components/common/StatusBadge.tsx';
import { Product, StockMovement, Supplier, PurchaseOrder, VendorBillExtractionResult } from '../types/index.ts';
import { 
  Package, 
  History, 
  AlertTriangle, 
  Truck, 
  FileCheck, 
  Sparkles, 
  Plus, 
  Search, 
  Loader2, 
  CheckCircle2, 
  ArrowRight,
  Upload,
  Camera,
  AlertCircle,
  FileText,
  TrendingUp,
  Download
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { currentSubTab, navigate, showToast, triggerRefresh, refreshSignal, user } = useApp();
  const [activeTab, setActiveTab] = useState<'catalogue' | 'alerts' | 'reorder' | 'movements' | 'pos' | 'suppliers'>('catalogue');
  const [loading, setLoading] = useState(true);

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Stock Adjustment Modal
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState('Physical audit variance');

  // New PO Modal
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [poItems, setPoItems] = useState<Array<{ productId: string; quantity: number; unitCost: number }>>([
    { productId: '', quantity: 10, unitCost: 1000 }
  ]);

  // Multimodal Kachha Bill OCR Modal
  const [isOcrModalOpen, setIsOcrModalOpen] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [parsedBill, setParsedBill] = useState<VendorBillExtractionResult | null>(null);

  // CSV Bulk Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState(
    'SKU,Name,Category,HSNCode,WarrantyMonths,SellingPrice,CostPrice,CurrentStock,ReorderThreshold\nSEC-CAM-2MP,Hikvision 2MP Dome Camera,Surveillance,8525,24,2400,1650,15,6\nPWR-INV-850,Luminous 850VA Inverter,Power Backup,8504,24,5400,4100,8,4'
  );

  useEffect(() => {
    if (currentSubTab) {
      if (['catalogue', 'alerts', 'reorder', 'movements', 'pos', 'suppliers', 'purchase_orders'].includes(currentSubTab)) {
        setActiveTab(currentSubTab === 'purchase_orders' ? 'pos' : currentSubTab as any);
      }
    }
  }, [currentSubTab]);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.getProducts(),
      api.getStockMovements(),
      api.getLowStockAlerts(),
      api.getSuppliers(),
      api.getPurchaseOrders(),
    ]).then(([prods, movs, alts, sups, pos]) => {
      setProducts(prods);
      setMovements(movs);
      setAlerts(alts);
      setSuppliers(sups);
      setPurchaseOrders(pos);
      if (sups.length > 0) setSelectedSupplierId(sups[0].id);
      if (prods.length > 0) {
        setPoItems([{ productId: prods[0].id, quantity: 10, unitCost: prods[0].costPrice || 1000 }]);
      }
    }).catch(err => {
      console.error('Failed to load inventory data:', err);
    }).finally(() => {
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshSignal]);

  const handleAdjustStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    try {
      await api.adjustStock(adjustingProduct.id, Number(adjustmentQty), adjustmentReason, adjustingProduct.version);
      showToast('Stock balance updated and recorded in movement ledger', 'success');
      setAdjustingProduct(null);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleApprovePo = async (poId: string) => {
    try {
      await api.approvePurchaseOrder(poId);
      showToast('Purchase Order approved for supplier fulfillment', 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleReceivePo = async (poId: string) => {
    try {
      await api.receivePurchaseOrder(poId);
      showToast('Stock received in full and updated in inventory balances', 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleCreatePoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPurchaseOrder({
        supplierId: selectedSupplierId,
        items: poItems,
        expectedDeliveryDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      });
      showToast('Purchase order drafted and submitted for approval', 'success');
      setIsPoModalOpen(false);
      triggerRefresh();
      setActiveTab('pos');
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const handleSimulateOcrScan = async () => {
    setOcrLoading(true);
    try {
      // Send sample base64 payload to multimodal parser
      const dummyBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const result = await api.parseVendorBill(dummyBase64, 'image/png');
      setParsedBill(result);
    } catch (err: any) {
      showToast(err.message || 'OCR parsing failed', 'error');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleReceiveBillInventory = async () => {
    if (!parsedBill) return;
    try {
      const res = await api.receiveBillInventory({
        supplierName: parsedBill.supplierName,
        invoiceNumber: parsedBill.invoiceNumber,
        lineItems: parsedBill.lineItems,
      });
      showToast(res.message, 'success');
      setIsOcrModalOpen(false);
      setParsedBill(null);
      triggerRefresh();
      setActiveTab('movements');
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

      const res = await api.importCsv('products', records);
      showToast(res.message, 'success');
      setIsImportModalOpen(false);
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const categories = ['all', ...Array.from(new Set(products.map(p => p.category)))];
  const q = searchQuery.toLowerCase();
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || (p.hsnCode && p.hsnCode.includes(q));
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Sub-tabs Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E7E0]">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'catalogue', label: 'Product Catalogue', icon: Package, count: products.length },
            { id: 'alerts', label: 'Low-Stock Alerts', icon: AlertTriangle, count: alerts.length, isWarning: alerts.length > 0 },
            { id: 'reorder', label: 'Reorder Insights', icon: Sparkles, count: alerts.length },
            { id: 'movements', label: 'Stock Movements', icon: History, count: movements.length },
            { id: 'pos', label: 'Purchase Orders', icon: FileCheck, count: purchaseOrders.length },
            { id: 'suppliers', label: 'Suppliers', icon: Truck, count: suppliers.length },
          ].map(tab => {
            const Icon = tab.icon;
            const isCur = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  navigate('inventory', tab.id);
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
                  isCur ? 'bg-white/20 text-white' : tab.isWarning ? 'bg-amber-100 text-amber-800' : 'bg-stone-100 text-[#73766F]'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {/* Multimodal Kachha Bill OCR Ingestion Button */}
          <button
            onClick={() => {
              setIsOcrModalOpen(true);
              handleSimulateOcrScan();
            }}
            className="px-3 py-1.5 rounded bg-[#1C231E] hover:bg-black text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            title="Scan handwritten kachha bill or vendor GST invoice with Gemini Vision"
          >
            <Camera className="w-3.5 h-3.5 text-emerald-400" />
            <span>Kachha Bill OCR</span>
          </button>

          {/* Bulk Import CSV */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="px-2.5 py-1.5 rounded border border-[#E5E7E0] bg-white hover:bg-stone-50 text-[#73766F] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            title="Bulk import catalog products from CSV"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import CSV</span>
          </button>

          <button
            onClick={() => setIsPoModalOpen(true)}
            className="px-3 py-1.5 rounded border border-[#E5E7E0] bg-[#6D876D] hover:bg-[#5a725a] text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create PO</span>
          </button>
        </div>
      </div>

      {/* Filter bar for catalogue */}
      {activeTab === 'catalogue' && (
        <div className="flex flex-col sm:flex-row gap-2 text-xs">
          <div className="flex-1 flex items-center px-3 py-2 bg-white rounded border border-[#E5E7E0]">
            <Search className="w-4 h-4 text-[#73766F] mr-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search product name, SKU code, or HSN number..."
              className="w-full bg-transparent focus:outline-hidden text-[#252923]"
            />
          </div>
          <div className="flex items-center gap-1 overflow-x-auto">
            {categories.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1.5 rounded text-xs capitalize whitespace-nowrap transition-colors cursor-pointer ${
                  categoryFilter === c ? 'bg-[#6D876D] text-white font-medium' : 'bg-white border border-[#E5E7E0] text-[#73766F]'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Tab Views */}
      <div className="bg-white rounded-lg border border-[#E5E7E0] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#73766F] flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading inventory records...
          </div>
        ) : (
          <>
            {/* 1. PRODUCT CATALOGUE WITH HSN & WARRANTY */}
            {activeTab === 'catalogue' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">SKU & HSN</th>
                      <th className="py-2.5 px-3 font-medium">Product Name & Category</th>
                      <th className="py-2.5 px-3 font-medium">Warranty</th>
                      <th className="py-2.5 px-3 font-medium text-right">Current Stock</th>
                      <th className="py-2.5 px-3 font-medium text-right">Reorder Threshold</th>
                      <th className="py-2.5 px-3 font-medium text-right">Selling Price</th>
                      {user?.role !== 'sales' && user?.role !== 'viewer' && (
                        <th className="py-2.5 px-3 font-medium text-right">Cost Price</th>
                      )}
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {filteredProducts.map(p => {
                      const isLow = p.currentStock <= p.reorderThreshold;
                      return (
                        <tr key={p.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                          <td className="py-3 px-3 font-mono">
                            <span className="font-semibold text-[#252923]">{p.sku}</span>
                            <span className="block text-[10px] text-[#73766F]">HSN: {p.hsnCode} (v{p.version || 1})</span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#252923]">{p.name}</div>
                            <div className="text-[10px] text-[#73766F]">{p.category} • {p.unit}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#73766F]">
                            {p.warrantyMonths ? `${p.warrantyMonths} mos` : 'No Warranty'}
                          </td>
                          <td className={`py-3 px-3 text-right font-mono font-bold ${
                            isLow ? 'text-amber-700' : 'text-[#252923]'
                          }`}>
                            {p.currentStock} {p.unit}
                            {isLow && (
                              <span className="ml-1.5 px-1.5 py-0.2 rounded text-[9px] bg-amber-100 text-amber-800 font-sans">
                                LOW
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-[#73766F]">
                            {p.reorderThreshold} {p.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-semibold text-[#252923]">
                            <CurrencyFormat amount={p.sellingPrice} />
                          </td>
                          {user?.role !== 'sales' && user?.role !== 'viewer' && (
                            <td className="py-3 px-3 text-right font-mono text-[#73766F]">
                              <CurrencyFormat amount={p.costPrice} />
                            </td>
                          )}
                          <td className="py-3 px-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setAdjustingProduct(p);
                                setAdjustmentQty(0);
                              }}
                              className="px-2 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[10px] rounded font-medium cursor-pointer"
                            >
                              Adjust Stock
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2. LOW-STOCK ALERTS WITH DYNAMIC DEMAND FORECASTING */}
            {activeTab === 'alerts' && (
              <div className="p-4 space-y-4">
                <div className="p-3 bg-amber-50 rounded border border-amber-200 text-xs text-amber-900 flex items-center justify-between">
                  <div>
                    <strong>Dynamic Demand Velocity Forecasting</strong>: Daily consumption is calculated from actual 30-day stock movements and supplier lead times instead of static estimates.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {alerts.map(alt => (
                    <div key={alt.product.id} className="p-4 bg-white rounded border border-[#E5E7E0] space-y-3 shadow-2xs">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-sm font-semibold text-[#252923]">{alt.product.name}</div>
                          <div className="text-xs text-[#73766F] font-mono mt-0.5">
                            SKU: {alt.product.sku} | HSN: {alt.product.hsnCode} | Lead Time: {alt.leadTimeDays || 4} days
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-100 text-amber-900 border border-amber-200">
                          {alt.daysRemaining} days left (~{alt.dailyVelocity || 0.5} units/day)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 bg-[#F7F7F4] p-2.5 rounded border border-[#E5E7E0] text-center font-mono">
                        <div>
                          <div className="text-[10px] text-[#73766F]">Current Stock</div>
                          <div className="text-sm font-bold text-amber-700">{alt.product.currentStock} {alt.product.unit}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#73766F]">Safety Stock Target</div>
                          <div className="text-sm font-semibold text-[#252923]">{alt.safetyStock || alt.product.reorderThreshold} {alt.product.unit}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-[#73766F]">Recommended Reorder</div>
                          <div className="text-sm font-bold text-[#6D876D]">+{alt.recommendedReorderQty} {alt.product.unit}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[#73766F]">
                          Est Cost: <CurrencyFormat amount={alt.estimatedCost} className="font-semibold text-[#252923]" />
                        </span>
                        <button
                          onClick={() => {
                            setSelectedSupplierId(alt.product.preferredSupplierId || suppliers[0]?.id || '');
                            setPoItems([{ productId: alt.product.id, quantity: alt.recommendedReorderQty, unitCost: alt.product.costPrice }]);
                            setIsPoModalOpen(true);
                          }}
                          className="px-3 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-xs font-medium rounded flex items-center gap-1 cursor-pointer"
                        >
                          Draft Reorder PO <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. REORDER INSIGHTS */}
            {activeTab === 'reorder' && (
              <div className="p-4 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                      <tr>
                        <th className="py-2.5 px-3 font-medium">Product / SKU</th>
                        <th className="py-2.5 px-3 font-medium">HSN Code</th>
                        <th className="py-2.5 px-3 font-medium text-right">Daily Sales Velocity</th>
                        <th className="py-2.5 px-3 font-medium text-right">Stock</th>
                        <th className="py-2.5 px-3 font-medium text-right">Recommended Reorder</th>
                        <th className="py-2.5 px-3 font-medium text-right">Est. Cost</th>
                        <th className="py-2.5 px-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7E0]">
                      {alerts.map(alt => (
                        <tr key={alt.product.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                          <td className="py-3 px-3">
                            <div className="font-medium text-[#252923]">{alt.product.name}</div>
                            <div className="text-[10px] text-[#73766F] font-mono">{alt.product.sku}</div>
                          </td>
                          <td className="py-3 px-3 font-mono text-[#73766F]">{alt.product.hsnCode}</td>
                          <td className="py-3 px-3 text-right font-mono text-[#252923]">
                            {alt.dailyVelocity || 0.5} units/day
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-amber-700">
                            {alt.product.currentStock} {alt.product.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-bold text-[#6D876D]">
                            +{alt.recommendedReorderQty} {alt.product.unit}
                          </td>
                          <td className="py-3 px-3 text-right font-mono font-medium text-[#252923]">
                            <CurrencyFormat amount={alt.estimatedCost} />
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => {
                                setSelectedSupplierId(alt.product.preferredSupplierId || suppliers[0]?.id || '');
                                setPoItems([{ productId: alt.product.id, quantity: alt.recommendedReorderQty, unitCost: alt.product.costPrice }]);
                                setIsPoModalOpen(true);
                              }}
                              className="px-2.5 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium inline-flex items-center gap-1 cursor-pointer"
                            >
                              Create PO
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. STOCK MOVEMENTS LEDGER */}
            {activeTab === 'movements' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Date & Time</th>
                      <th className="py-2.5 px-3 font-medium">Product (SKU)</th>
                      <th className="py-2.5 px-3 font-medium">Type</th>
                      <th className="py-2.5 px-3 font-medium text-right">Movement Qty</th>
                      <th className="py-2.5 px-3 font-medium text-right">Before / After Balance</th>
                      <th className="py-2.5 px-3 font-medium">Reference ID</th>
                      <th className="py-2.5 px-3 font-medium">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {movements.map(m => (
                      <tr key={m.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                        <td className="py-3 px-3 font-mono text-[#73766F]">
                          {m.createdAt.replace('T', ' ').substring(0, 16)}
                        </td>
                        <td className="py-3 px-3">
                          <div className="font-medium text-[#252923]">{m.productName}</div>
                          <div className="text-[10px] text-[#73766F] font-mono">{m.sku}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono font-semibold ${
                            m.type === 'receipt' ? 'bg-emerald-100 text-emerald-800' : 
                            m.type === 'return' ? 'bg-purple-100 text-purple-800' :
                            'bg-stone-100 text-stone-700'
                          }`}>
                            {m.type}
                          </span>
                        </td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${
                          m.quantity > 0 ? 'text-emerald-700' : 'text-stone-700'
                        }`}>
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[#73766F]">
                          {m.beforeStock} → <span className="font-bold text-[#252923]">{m.afterStock}</span>
                        </td>
                        <td className="py-3 px-3 font-mono text-[#252923] font-medium">{m.referenceId}</td>
                        <td className="py-3 px-3 text-[#73766F]">{m.createdBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5. PURCHASE ORDERS */}
            {activeTab === 'pos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">PO Number</th>
                      <th className="py-2.5 px-3 font-medium">Supplier</th>
                      <th className="py-2.5 px-3 font-medium">Items Breakdown</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                      <th className="py-2.5 px-3 font-medium">Expected Delivery</th>
                      <th className="py-2.5 px-3 font-medium text-right">Total (Incl GST)</th>
                      <th className="py-2.5 px-3 font-medium text-right">Workflow Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {purchaseOrders.map(po => (
                      <tr key={po.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                        <td className="py-3 px-3 font-mono font-semibold text-[#252923]">{po.poNumber}</td>
                        <td className="py-3 px-3 font-medium text-[#252923]">{po.supplierName}</td>
                        <td className="py-3 px-3 text-[#73766F] max-w-xs truncate">
                          {po.items.map(i => `${i.quantity}x ${i.productName}`).join(', ')}
                        </td>
                        <td className="py-3 px-3">
                          <StatusBadge status={po.status} />
                        </td>
                        <td className="py-3 px-3 font-mono text-[#73766F]">{po.expectedDeliveryDate}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-[#252923]">
                          <CurrencyFormat amount={po.totalAmount} />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {po.status === 'awaiting_approval' && (
                              <button
                                onClick={() => handleApprovePo(po.id)}
                                className="px-2.5 py-1 bg-[#6D876D] hover:bg-[#5a725a] text-white text-[10px] rounded font-medium cursor-pointer"
                              >
                                Approve PO
                              </button>
                            )}
                            {po.status === 'approved' && (
                              <button
                                onClick={() => handleReceivePo(po.id)}
                                className="px-2.5 py-1 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] rounded font-medium cursor-pointer flex items-center gap-1"
                              >
                                <CheckCircle2 className="w-3 h-3" /> Receive Stock
                              </button>
                            )}
                            {po.status === 'received' && (
                              <span className="text-[11px] text-emerald-700 font-mono font-medium">Inventoried</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6. SUPPLIERS */}
            {activeTab === 'suppliers' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Supplier Name</th>
                      <th className="py-2.5 px-3 font-medium">Contact Person</th>
                      <th className="py-2.5 px-3 font-medium">Lead Time</th>
                      <th className="py-2.5 px-3 font-medium">Payment Terms</th>
                      <th className="py-2.5 px-3 font-medium">Active POs</th>
                      <th className="py-2.5 px-3 font-medium">Address</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {suppliers.map(s => (
                      <tr key={s.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                        <td className="py-3 px-3 font-semibold text-[#252923]">
                          {s.name}
                          {s.gstin && <span className="block text-[10px] font-mono text-[#73766F] font-normal">{s.gstin}</span>}
                        </td>
                        <td className="py-3 px-3 text-[#252923]">{s.contactPerson}</td>
                        <td className="py-3 px-3 font-mono text-emerald-800 font-semibold">{s.leadTimeDays || 4} days</td>
                        <td className="py-3 px-3 font-mono text-[#73766F]">{s.paymentTerms}</td>
                        <td className="py-3 px-3 font-mono font-bold text-[#6D876D]">{s.activeOrdersCount} active</td>
                        <td className="py-3 px-3 text-[#73766F]">{s.address}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Multimodal Kachha Bill OCR Ingestion Modal */}
      {isOcrModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-2xl border border-[#E5E7E0] max-w-2xl w-full p-4 space-y-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-[#6D876D]" />
                <div>
                  <h3 className="font-bold text-sm text-[#252923]">Multimodal "Kachha Bill" & Invoice OCR</h3>
                  <p className="text-[10px] text-[#73766F]">Ingest supplier paper bills or handwritten chits with Gemini Vision & Price Creep Detection</p>
                </div>
              </div>
              <button onClick={() => { setIsOcrModalOpen(false); setParsedBill(null); }} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>

            {ocrLoading ? (
              <div className="py-12 text-center text-xs text-[#73766F] space-y-2">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#6D876D]" />
                <div>Analyzing supplier bill layout, matching catalog SKUs, and detecting price creep...</div>
              </div>
            ) : parsedBill ? (
              <div className="space-y-4">
                {/* Price Creep Alert Banner */}
                {parsedBill.priceCreepDetected && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Price Creep Detected!</strong> The supplier billed higher unit rates than your current catalog cost. Review highlighted items before receiving.
                    </div>
                  </div>
                )}

                {/* Bill Header Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#F7F7F4] p-3 rounded border border-[#E5E7E0] font-mono text-xs">
                  <div>
                    <span className="text-[#73766F] text-[10px] block">Supplier</span>
                    <strong className="text-[#252923]">{parsedBill.supplierName}</strong>
                  </div>
                  <div>
                    <span className="text-[#73766F] text-[10px] block">Invoice #</span>
                    <span className="text-[#252923]">{parsedBill.invoiceNumber}</span>
                  </div>
                  <div>
                    <span className="text-[#73766F] text-[10px] block">Bill Date</span>
                    <span className="text-[#252923]">{parsedBill.invoiceDate}</span>
                  </div>
                  <div>
                    <span className="text-[#73766F] text-[10px] block">Total Amount</span>
                    <strong className="text-emerald-700"><CurrencyFormat amount={parsedBill.totalBilledAmount} /></strong>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="border border-[#E5E7E0] rounded overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                      <tr>
                        <th className="py-2 px-3">Billed Description</th>
                        <th className="py-2 px-3">Catalog SKU Match</th>
                        <th className="py-2 px-2 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Billed Cost</th>
                        <th className="py-2 px-3 text-right">Last Cost</th>
                        <th className="py-2 px-3 text-right">Variance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7E0]">
                      {parsedBill.lineItems.map((item, idx) => (
                        <tr key={idx} className={item.priceCreepPercent ? 'bg-amber-50/50' : ''}>
                          <td className="py-2 px-3 font-medium text-[#252923]">{item.rawDescription}</td>
                          <td className="py-2 px-3 font-mono text-[#6D876D]">
                            {item.matchedSku || 'Unmatched'}
                          </td>
                          <td className="py-2 px-2 text-right font-mono">{item.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-[#252923]">
                            <CurrencyFormat amount={item.unitCost} />
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-[#73766F]">
                            {item.catalogCostPrice ? <CurrencyFormat amount={item.catalogCostPrice} /> : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            {item.priceCreepPercent ? (
                              <span className="text-rose-600 font-bold">
                                +{item.priceCreepPercent}%
                              </span>
                            ) : (
                              <span className="text-emerald-700">0%</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 border-t border-[#E5E7E0] flex justify-end gap-2">
                  <button
                    onClick={() => { setIsOcrModalOpen(false); setParsedBill(null); }}
                    className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReceiveBillInventory}
                    className="px-4 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Receive into Inventory & Log Bill
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7E0] max-w-sm w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="font-semibold text-sm text-[#252923]">Stock Adjustment (Concurrency Lock Active)</h3>
              <button onClick={() => setAdjustingProduct(null)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <div>
              <div className="font-semibold text-sm text-[#252923]">{adjustingProduct.name}</div>
              <div className="text-[#73766F] font-mono mt-0.5">
                Current Stock: <span className="font-bold text-[#252923]">{adjustingProduct.currentStock} {adjustingProduct.unit}</span> (v{adjustingProduct.version || 1})
              </div>
            </div>
            <form onSubmit={handleAdjustStockSubmit} className="space-y-3">
              <div>
                <label className="block text-[#73766F] font-medium mb-1">
                  Quantity Adjustment (+ to add, - to deduct)
                </label>
                <input
                  type="number"
                  value={adjustmentQty}
                  onChange={e => setAdjustmentQty(Number(e.target.value))}
                  placeholder="e.g. +5 or -2"
                  className="w-full p-2 border border-[#E5E7E0] rounded font-mono font-semibold"
                  required
                />
              </div>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Reason for Adjustment</label>
                <select
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                >
                  <option value="Physical audit variance">Physical audit count variance</option>
                  <option value="Damaged in warehouse storage">Damaged goods write-off</option>
                  <option value="Customer return restocked">Customer return restocked</option>
                  <option value="Vendor promotional sample">Sample units received</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustingProduct(null)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium"
                >
                  Apply Adjustment
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
                <Upload className="w-4 h-4 text-[#6D876D]" /> Bulk Product Import CSV
              </h3>
              <button onClick={() => setIsImportModalOpen(false)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <form onSubmit={handleBulkImportSubmit} className="space-y-3">
              <p className="text-[#73766F]">
                Paste CSV lines with headers: <code>SKU,Name,Category,HSNCode,WarrantyMonths,SellingPrice,CostPrice,CurrentStock,ReorderThreshold</code>
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
                  Import Products
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Purchase Order Modal */}
      {isPoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-lg shadow-xl border border-[#E5E7E0] max-w-lg w-full p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <h3 className="font-semibold text-sm text-[#252923]">Draft Purchase Order</h3>
              <button onClick={() => setIsPoModalOpen(false)} className="text-[#73766F] hover:text-[#252923]">
                ✕
              </button>
            </div>
            <form onSubmit={handleCreatePoSubmit} className="space-y-3">
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Supplier</label>
                <select
                  value={selectedSupplierId}
                  onChange={e => setSelectedSupplierId(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  required
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.paymentTerms})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Product</label>
                <select
                  value={poItems[0].productId}
                  onChange={e => {
                    const prod = products.find(p => p.id === e.target.value);
                    setPoItems([{ productId: e.target.value, quantity: poItems[0].quantity, unitCost: prod?.costPrice || 1000 }]);
                  }}
                  className="w-full p-2 border border-[#E5E7E0] rounded bg-white"
                  required
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (HSN: {p.hsnCode} • Cost: ₹{p.costPrice})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={poItems[0].quantity}
                    onChange={e => setPoItems([{ ...poItems[0], quantity: Math.max(1, Number(e.target.value)) }])}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#73766F] font-medium mb-1">Unit Cost Price (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={poItems[0].unitCost}
                    onChange={e => setPoItems([{ ...poItems[0], unitCost: Number(e.target.value) }])}
                    className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                    required
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPoModalOpen(false)}
                  className="px-3 py-1.5 border border-[#E5E7E0] rounded text-stone-600 hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] text-white rounded font-medium cursor-pointer"
                >
                  Submit PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
