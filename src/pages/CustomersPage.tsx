import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { Customer } from '../types/index.ts';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Mail, 
  Eye, 
  Loader2, 
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Download
} from 'lucide-react';

export const CustomersPage: React.FC = () => {
  const { openCustomer360, openQuickCreate, refreshSignal, showToast } = useApp();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'retail' | 'wholesale' | 'b2b_corporate'>('all');

  const loadCustomers = () => {
    setLoading(true);
    api.getCustomers(searchQuery)
      .then(res => setCustomers(res))
      .catch(err => console.error('Failed to load customers:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCustomers();
  }, [refreshSignal, searchQuery]);

  const filtered = customers.filter(c => {
    if (typeFilter === 'all') return true;
    return c.customerType === typeFilter;
  });

  const exportCustomersCsv = () => {
    const rows = [
      ['Customer Name', 'Phone', 'Email', 'Customer Type', 'State', 'GSTIN', 'Credit Limit', 'Outstanding Balance', 'Risk Score'],
      ...customers.map(c => [
        c.name,
        c.phone,
        c.email || '',
        c.customerType,
        c.state || 'Maharashtra',
        c.gstin || '',
        String(c.creditLimit || 50000),
        String(c.outstandingBalance || 0),
        c.creditRiskScore || 'Low',
      ])
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Customer directory exported as CSV', 'success');
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[#E5E7E0]">
        <div>
          <h2 className="text-xl font-bold text-[#252923] tracking-tight">Shared Customer & Udhaar Directory</h2>
          <p className="text-xs text-[#73766F] mt-0.5">
            Synchronized client ledgers with credit risk ratings, GST place of supply, and lifetime history
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCustomersCsv}
            className="px-2.5 py-1.5 rounded border border-[#E5E7E0] bg-white hover:bg-stone-50 text-[#73766F] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => openQuickCreate('customer')}
            className="px-3 py-1.5 rounded bg-[#6D876D] hover:bg-[#5a725a] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 text-xs">
        <div className="flex-1 flex items-center px-3 py-2 bg-white rounded border border-[#E5E7E0]">
          <Search className="w-4 h-4 text-[#73766F] mr-2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone number, GSTIN, or city..."
            className="w-full bg-transparent focus:outline-hidden text-[#252923] placeholder-[#73766F]"
          />
        </div>
        <div className="inline-flex rounded-md border border-[#E5E7E0] bg-white p-0.5 text-xs">
          {[
            { id: 'all', label: 'All Clients' },
            { id: 'retail', label: 'Retail' },
            { id: 'wholesale', label: 'Wholesale' },
            { id: 'b2b_corporate', label: 'Corporate B2B' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setTypeFilter(f.id as any)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors cursor-pointer ${
                typeFilter === f.id ? 'bg-[#6D876D] text-white' : 'text-[#73766F] hover:text-[#252923]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-lg border border-[#E5E7E0] shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-[#73766F] flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading customer directory...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#73766F]">
            No customer profiles match your search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F7F7F4] text-[#73766F] border-b border-[#E5E7E0]">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Customer Name & GSTIN</th>
                  <th className="py-2.5 px-3 font-medium">Phone & Contact</th>
                  <th className="py-2.5 px-3 font-medium">State & Type</th>
                  <th className="py-2.5 px-3 font-medium text-right">Credit Limit</th>
                  <th className="py-2.5 px-3 font-medium text-right">Outstanding (Udhaar)</th>
                  <th className="py-2.5 px-3 font-medium">Risk Score</th>
                  <th className="py-2.5 px-3 font-medium text-right">Profile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7E0]">
                {filtered.map(cust => (
                  <tr key={cust.id} className="hover:bg-[#F7F7F4]/60 transition-colors">
                    <td className="py-3 px-3">
                      <button
                        onClick={() => openCustomer360(cust.id)}
                        className="font-semibold text-sm text-[#252923] hover:underline text-left block"
                      >
                        {cust.name}
                      </button>
                      {cust.gstin ? (
                        <span className="text-[10px] text-[#73766F] font-mono">GSTIN: {cust.gstin}</span>
                      ) : (
                        <span className="text-[10px] text-[#73766F] font-mono">Unregistered</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[#73766F]">
                      <div className="flex items-center gap-1 font-mono text-[#252923]">
                        <Phone className="w-3 h-3 text-[#6D876D]" /> {cust.phone}
                      </div>
                      {cust.email && (
                        <div className="text-[11px] truncate">{cust.email}</div>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-medium text-[#252923]">{cust.state || 'Maharashtra'}</div>
                      <span className={`inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] capitalize font-medium ${
                        cust.customerType === 'b2b_corporate'
                          ? 'bg-purple-100 text-purple-800'
                          : cust.customerType === 'wholesale'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-stone-100 text-stone-700'
                      }`}>
                        {cust.customerType.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-[#73766F]">
                      <CurrencyFormat amount={cust.creditLimit || 50000} />
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${
                      cust.outstandingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      <CurrencyFormat amount={cust.outstandingBalance} />
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                        cust.creditRiskScore === 'High'
                          ? 'bg-rose-100 text-rose-800 border border-rose-200'
                          : cust.creditRiskScore === 'Moderate'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      }`}>
                        {cust.creditRiskScore || 'Low'} Risk
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => openCustomer360(cust.id)}
                        className="px-2.5 py-1 bg-[#F7F7F4] hover:bg-[#6D876D] hover:text-white border border-[#E5E7E0] rounded text-[11px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> 360 View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
