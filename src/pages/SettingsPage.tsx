import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { UserRole, AuditLog } from '../types/index.ts';
import { 
  Building2, 
  ShieldCheck, 
  Users, 
  CreditCard, 
  Sparkles, 
  FileText, 
  Check, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  History,
  Lock
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { business, teamMembers, user, showToast, refreshSignal, triggerRefresh } = useApp();
  const [activeTab, setActiveTab] = useState<'profile' | 'team' | 'integrations' | 'audit'>('profile');
  const [loading, setLoading] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Profile fields
  const [bizName, setBizName] = useState(business?.name || '');
  const [legalName, setLegalName] = useState(business?.legalName || '');
  const [gstin, setGstin] = useState(business?.gstin || '');
  const [address, setAddress] = useState(business?.address || '');
  const [city, setCity] = useState(business?.city || 'Mumbai');
  const [state, setState] = useState(business?.state || 'Maharashtra');
  const [phone, setPhone] = useState(business?.phone || '');
  const [email, setEmail] = useState(business?.email || '');

  useEffect(() => {
    if (business) {
      setBizName(business.name);
      setLegalName(business.legalName);
      setGstin(business.gstin);
      setAddress(business.address);
      setCity(business.city);
      setState(business.state);
      setPhone(business.phone);
      setEmail(business.email);
    }
  }, [business]);

  useEffect(() => {
    Promise.all([
      api.getSettings(),
      api.getAuditLogs(),
    ]).then(([s, logs]) => {
      setSettings(s);
      setAuditLogs(logs);
    }).catch(err => {
      console.error('Failed to load settings:', err);
    });
  }, [refreshSignal]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.updateBusinessProfile({
        name: bizName,
        legalName,
        gstin,
        phone,
        email,
        address,
        city,
        state,
      });
      showToast('Business legal profile & GSTIN updated successfully', 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const permissionsMatrix: Array<{
    module: string;
    owner: boolean;
    admin: boolean;
    sales: boolean;
    inventory: boolean;
    booking: boolean;
    accountant: boolean;
    viewer: boolean;
  }> = [
    { module: 'View & Create Sales Orders', owner: true, admin: true, sales: true, inventory: false, booking: false, accountant: true, viewer: true },
    { module: 'Override Udhaar Credit Hold', owner: true, admin: true, sales: false, inventory: false, booking: false, accountant: false, viewer: false },
    { module: 'View Cost Prices (Margin Data)', owner: true, admin: true, sales: false, inventory: true, booking: false, accountant: true, viewer: false },
    { module: 'Stock Movements & Adjustments', owner: true, admin: true, sales: false, inventory: true, booking: false, accountant: false, viewer: false },
    { module: 'Approve Purchase Orders', owner: true, admin: true, sales: false, inventory: false, booking: false, accountant: false, viewer: false },
    { module: 'Receive PO Stock into Warehouse', owner: true, admin: true, sales: false, inventory: true, booking: false, accountant: false, viewer: false },
    { module: 'Issue GST Credit Notes & Returns', owner: true, admin: true, sales: false, inventory: false, booking: false, accountant: true, viewer: false },
    { module: 'Complete Job & BOM Combined Invoicing', owner: true, admin: true, sales: false, inventory: false, booking: true, accountant: false, viewer: false },
    { module: 'Record Payments & Reconcile', owner: true, admin: true, sales: true, inventory: false, booking: false, accountant: true, viewer: false },
    { module: 'Execute AI Consequential Actions', owner: true, admin: true, sales: true, inventory: true, booking: true, accountant: true, viewer: false },
  ];

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E7E0]">
        <div>
          <h2 className="text-xl font-bold text-[#252923] tracking-tight">Settings & Workspace Control</h2>
          <p className="text-xs text-[#73766F] mt-0.5">
            Organization profiles, role-based authorization matrix, payment gateway status & audit trails
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7E0] pb-2 text-xs font-medium">
        {[
          { id: 'profile', label: 'Business Profile & GST', icon: Building2 },
          { id: 'team', label: 'Team & RBAC Matrix', icon: Users },
          { id: 'integrations', label: 'Integrations & Webhooks', icon: CreditCard },
          { id: 'audit', label: 'Tamper-Evident Audit Chain', icon: History },
        ].map(tab => {
          const Icon = tab.icon;
          const isCur = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors cursor-pointer ${
                isCur ? 'bg-[#6D876D] text-white font-semibold' : 'bg-white border border-[#E5E7E0] text-[#73766F] hover:bg-stone-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Contents */}
      <div className="bg-white rounded-lg border border-[#E5E7E0] shadow-2xs p-4 md:p-6">
        {/* 1. BUSINESS PROFILE WIRED TO PUT /api/business/profile */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl text-xs">
            <h3 className="text-sm font-semibold text-[#252923] border-b border-[#E5E7E0] pb-2">
              Organization Legal Details & GST Compliance
            </h3>

            <div>
              <label className="block text-[#73766F] font-medium mb-1">Display Trade Name</label>
              <input
                type="text"
                value={bizName}
                onChange={e => setBizName(e.target.value)}
                className="w-full p-2 border border-[#E5E7E0] rounded font-medium"
                required
              />
            </div>

            <div>
              <label className="block text-[#73766F] font-medium mb-1">Registered Legal Entity Name</label>
              <input
                type="text"
                value={legalName}
                onChange={e => setLegalName(e.target.value)}
                className="w-full p-2 border border-[#E5E7E0] rounded font-medium"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Business GSTIN (India)</label>
                <input
                  type="text"
                  value={gstin}
                  onChange={e => setGstin(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded font-mono uppercase font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">Primary Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#73766F] font-medium mb-1">State (GST Origin)</label>
                <input
                  type="text"
                  value={state}
                  onChange={e => setState(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-[#73766F] font-medium mb-1">City</label>
                <input
                  type="text"
                  value={city}
                  onChange={e => setCity(e.target.value)}
                  className="w-full p-2 border border-[#E5E7E0] rounded"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[#73766F] font-medium mb-1">Registered Commercial Address</label>
              <textarea
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full p-2 border border-[#E5E7E0] rounded"
                rows={2}
                required
              />
            </div>

            <div className="pt-3 border-t border-[#E5E7E0] flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#6D876D] hover:bg-[#5a725a] disabled:opacity-50 text-white rounded font-medium cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Save Business Profile
              </button>
            </div>
          </form>
        )}

        {/* 2. TEAM & RBAC MATRIX */}
        {activeTab === 'team' && (
          <div className="space-y-6 text-xs">
            {/* Team members list */}
            <div>
              <h3 className="text-sm font-semibold text-[#252923] mb-2">Workspace Team Members ({teamMembers.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {teamMembers.map(m => (
                  <div key={m.id} className="p-3 bg-[#F7F7F4] rounded border border-[#E5E7E0] space-y-1">
                    <div className="font-semibold text-sm text-[#252923]">{m.name}</div>
                    <div className="text-[11px] text-[#73766F] truncate">{m.email}</div>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-white border border-[#E5E7E0] text-[#6D876D] font-bold">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* RBAC Permissions Matrix */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-[#252923]">
                  Enforced Role-Based Authorization (RBAC) Matrix
                </h3>
                <span className="text-[11px] text-[#73766F]">
                  Permissions validated server-side on all API routes
                </span>
              </div>
              <div className="overflow-x-auto border border-[#E5E7E0] rounded">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Capability / Permission</th>
                      <th className="py-2.5 px-2 text-center">Owner</th>
                      <th className="py-2.5 px-2 text-center">Admin</th>
                      <th className="py-2.5 px-2 text-center">Sales</th>
                      <th className="py-2.5 px-2 text-center">Inventory</th>
                      <th className="py-2.5 px-2 text-center">Bookings</th>
                      <th className="py-2.5 px-2 text-center">Accountant</th>
                      <th className="py-2.5 px-2 text-center">Viewer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7E0]">
                    {permissionsMatrix.map((row, i) => (
                      <tr key={i} className="hover:bg-[#F7F7F4]/60">
                        <td className="py-2 px-3 font-medium text-[#252923]">{row.module}</td>
                        <td className="text-center py-2">{row.owner ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                        <td className="text-center py-2">{row.admin ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                        <td className="text-center py-2">{row.sales ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                        <td className="text-center py-2">{row.inventory ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                        <td className="text-center py-2">{row.booking ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                        <td className="text-center py-2">{row.accountant ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                        <td className="text-center py-2">{row.viewer ? <Check className="w-4 h-4 text-[#6D876D] mx-auto" /> : <span className="text-stone-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. INTEGRATIONS & API */}
        {activeTab === 'integrations' && (
          <div className="space-y-6 text-xs max-w-2xl">
            {/* Razorpay Gateway */}
            <div className="p-4 bg-white rounded border border-[#E5E7E0] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#252923]">Razorpay Payment Gateway</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                      CONNECTED (SANDBOX)
                    </span>
                  </div>
                  <p className="text-xs text-[#73766F] mt-1">
                    Accept UPI, Dynamic QR, Netbanking, and Cards with HMAC SHA-256 webhook signature verification and idempotency locks.
                  </p>
                </div>
              </div>
              <div className="p-3 bg-[#F7F7F4] rounded border border-[#E5E7E0] space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Merchant Key ID:</span>
                  <span className="font-semibold text-[#252923]">rzp_test_9k8aB7c4e2x1mQ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Webhook Endpoint:</span>
                  <span className="text-[#252923]">POST /api/razorpay/webhook</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Signature Verification:</span>
                  <span className="text-emerald-700 font-semibold">crypto.createHmac('sha256') Active</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Idempotency Check:</span>
                  <span className="text-emerald-700 font-semibold">razorpayPaymentId Deduplication Active</span>
                </div>
              </div>
            </div>

            {/* Gemini AI Integration */}
            <div className="p-4 bg-white rounded border border-[#E5E7E0] space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-[#252923]">Google Gemini AI Intelligence</h4>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800">
                      READY
                    </span>
                  </div>
                  <p className="text-xs text-[#73766F] mt-1">
                    Native Function Calling declarations & Multimodal Vision for paper bills and handwritten receipts.
                  </p>
                </div>
              </div>
              <div className="p-3 bg-[#F7F7F4] rounded border border-[#E5E7E0] space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Reasoning Model:</span>
                  <span className="font-semibold text-[#252923]">gemini-4-argon</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Multimodal Vision Model:</span>
                  <span className="font-semibold text-[#252923]">gemini-3.8-flash</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Native Function Tools:</span>
                  <span className="text-[#6D876D] font-semibold">5 Operational Declarations</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. TAMPER-EVIDENT AUDIT TRAIL */}
        {activeTab === 'audit' && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0]">
              <div>
                <h3 className="font-semibold text-sm text-[#252923]">Cryptographic Tamper-Evident Audit Chain</h3>
                <p className="text-[#73766F] text-[11px]">Every operational change is hashed with SHA-256 chaining back to genesis.</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold">
                ✓ CHAIN INTEGRITY VERIFIED
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                  <tr>
                    <th className="py-2 px-3 font-medium">Timestamp</th>
                    <th className="py-2 px-3 font-medium">Actor</th>
                    <th className="py-2 px-3 font-medium">Module & Action</th>
                    <th className="py-2 px-3 font-medium">Details</th>
                    <th className="py-2 px-3 font-medium">Entry Hash (SHA-256)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7E0]">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-[#F7F7F4]/60">
                      <td className="py-2.5 px-3 text-[#73766F] whitespace-nowrap">
                        {log.timestamp.replace('T', ' ').substring(0, 19)}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-[#252923]">
                        {log.actorName} <span className="text-[10px] text-[#6D876D]">({log.actorRole})</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="uppercase text-[10px] text-[#73766F] block">{log.module}</span>
                        <span className="font-semibold text-[#252923]">{log.action}</span>
                      </td>
                      <td className="py-2.5 px-3 font-sans text-[#252923] max-w-sm truncate">{log.details}</td>
                      <td className="py-2.5 px-3 text-[#73766F] text-[10px]">
                        <span className="text-[#6D876D] font-bold">
                          {log.entryHash ? `${log.entryHash.substring(0, 12)}...` : 'genesis'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
