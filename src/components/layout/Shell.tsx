import React, { useState } from 'react';
import { useApp } from '../../context/AppContext.tsx';
import { UserRole } from '../../types/index.ts';
import { 
  LayoutDashboard, 
  ShoppingBag, 
  Package, 
  Calendar, 
  Users, 
  Sparkles, 
  BarChart3, 
  Settings as SettingsIcon,
  Search,
  Bell,
  Plus,
  RotateCcw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mic,
  MicOff,
  Check,
  Menu,
  X
} from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

const ROLES_LIST: { role: UserRole; label: string; desc: string }[] = [
  { role: 'owner', label: 'Owner', desc: 'Full business access and administrative rights' },
  { role: 'admin', label: 'Admin', desc: 'Operational manager with approvals' },
  { role: 'sales', label: 'Sales', desc: 'Orders, quotations, invoices & collections' },
  { role: 'inventory_manager', label: 'Inventory Manager', desc: 'Stock movements, POs & suppliers' },
  { role: 'booking_manager', label: 'Booking Manager', desc: 'Appointments, services & customer deposits' },
  { role: 'accountant', label: 'Accountant', desc: 'Reconciliation, invoices & payments' },
  { role: 'viewer', label: 'Viewer', desc: 'Read-only access without cost or mutations' },
];

export const Shell: React.FC<Props> = ({ children }) => {
  const {
    user,
    business,
    businesses,
    currentRoute,
    navigate,
    switchRole,
    switchBusiness,
    resetDemoData,
    setIsSearchOpen,
    openQuickCreate,
    notifications,
    markNotificationAsRead,
    toast,
    isListening,
    startListening,
    stopListening,
  } = useApp();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [businessMenuOpen, setBusinessMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'sales', label: 'Sales & Collections', icon: ShoppingBag },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'bookings', label: 'Bookings', icon: Calendar },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'ai', label: 'RazBuddy AI', icon: Sparkles, badge: 'Function Tools' },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const unreadNotifs = notifications.filter(n => !n.read).length;

  const getPageTitle = () => {
    switch (currentRoute) {
      case 'sales': return 'Sales & Collections';
      case 'inventory': return 'Inventory & Procurement';
      case 'bookings': return 'Bookings & Appointments';
      case 'customers': return 'Customer Directory';
      case 'ai': return 'RazBuddy AI Command Centre';
      case 'reports': return 'Reports & Analytics';
      case 'settings': return 'Settings & Integrations';
      default: return 'Executive Overview';
    }
  };

  const handleVoiceClick = () => {
    if (isListening) {
      stopListening();
    } else {
      navigate('ai');
      startListening((transcript) => {
        // Dispatched to AI page via custom event or navigate
        window.dispatchEvent(new CustomEvent('razbuddy-voice-input', { detail: transcript }));
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F7F4] flex flex-col antialiased">
      {/* Toast Notification Top Banner */}
      {toast && (
        <div className="fixed top-3 right-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className={`px-4 py-2.5 rounded shadow-lg border text-xs font-medium flex items-center gap-2 ${
            toast.type === 'success' 
              ? 'bg-[#6D876D] text-white border-[#5a725a]'
              : toast.type === 'error'
              ? 'bg-rose-700 text-white border-rose-800'
              : 'bg-stone-800 text-white border-stone-900'
          }`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar */}
        <aside
          className={`hidden md:flex flex-col bg-white border-r border-[#E5E7E0] transition-all duration-200 ${
            sidebarCollapsed ? 'w-16' : 'w-64'
          }`}
        >
          {/* Logo & Wordmark */}
          <div className="h-16 px-4 border-b border-[#E5E7E0] flex items-center justify-between">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#6D876D] text-white flex items-center justify-center font-bold text-base shadow-xs">
                  R
                </div>
                <div>
                  <div className="text-sm font-bold text-[#252923] tracking-tight flex items-center gap-1.5">
                    RazBuddy
                    <span className="text-[10px] font-semibold bg-[#6D876D]/15 text-[#4e644e] px-1.5 py-0.2 rounded font-mono">
                      OS
                    </span>
                  </div>
                  <div className="text-[10px] text-[#73766F] font-medium leading-none">
                    Business Operating System
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded bg-[#6D876D] text-white flex items-center justify-center font-bold text-base mx-auto">
                R
              </div>
            )}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded text-[#73766F] hover:bg-stone-100 hover:text-[#252923] transition-colors"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentRoute === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#6D876D]/10 text-[#405440] font-semibold border border-[#6D876D]/20'
                      : 'text-[#73766F] hover:bg-[#F7F7F4] hover:text-[#252923]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#6D876D]' : 'text-[#73766F]'}`} />
                  {!sidebarCollapsed && (
                    <span className="flex-1 text-left truncate">{item.label}</span>
                  )}
                  {!sidebarCollapsed && item.badge && (
                    <span className="text-[9px] bg-[#6D876D]/20 text-[#3d513d] px-1.5 py-0.2 rounded font-semibold font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Business Switcher & User Profile */}
          <div className="p-2 border-t border-[#E5E7E0] space-y-2 bg-[#F7F7F4]/50">
            {/* Business switcher */}
            <div className="relative">
              <button
                onClick={() => setBusinessMenuOpen(!businessMenuOpen)}
                className="w-full p-2 rounded border border-[#E5E7E0] bg-white hover:bg-stone-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                title="Switch Business Workspace"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="w-4 h-4 text-[#6D876D] shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-[#252923] truncate text-[11px]">
                      {business?.name || 'Workspace'}
                    </span>
                  )}
                </div>
                {!sidebarCollapsed && <ChevronDown className="w-3.5 h-3.5 text-[#73766F]" />}
              </button>

              {businessMenuOpen && (
                <div className="absolute bottom-full left-0 w-64 mb-1 bg-white border border-[#E5E7E0] rounded shadow-lg p-1.5 z-50 text-xs">
                  <div className="text-[10px] font-semibold text-[#73766F] uppercase tracking-wider px-2 py-1">
                    Select Workspace
                  </div>
                  {businesses.map(b => (
                    <button
                      key={b.id}
                      onClick={() => {
                        switchBusiness(b.id);
                        setBusinessMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#F7F7F4] flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-[#252923]">{b.name}</div>
                        <div className="text-[10px] text-[#73766F] font-mono">{b.city}, {b.state}</div>
                      </div>
                      {business?.id === b.id && <Check className="w-3.5 h-3.5 text-[#6D876D]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* User role profile */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="w-full p-2 rounded border border-[#E5E7E0] bg-white hover:bg-stone-50 flex items-center justify-between text-xs transition-colors cursor-pointer"
                title="Switch User Role (Sandbox RBAC Testing)"
              >
                <div className="flex items-center gap-2 truncate">
                  <div className="w-6 h-6 rounded-full bg-[#6D876D]/20 text-[#405440] font-bold text-[11px] flex items-center justify-center shrink-0">
                    {user?.name.charAt(0) || 'U'}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="text-left truncate">
                      <div className="font-semibold text-[#252923] text-[11px] truncate">{user?.name}</div>
                      <div className="text-[10px] text-[#6D876D] font-mono uppercase font-semibold">
                        Role: {user?.role}
                      </div>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && <ChevronDown className="w-3.5 h-3.5 text-[#73766F]" />}
              </button>

              {roleMenuOpen && (
                <div className="absolute bottom-full left-0 w-64 mb-1 bg-white border border-[#E5E7E0] rounded shadow-lg p-1.5 z-50 text-xs">
                  <div className="text-[10px] font-semibold text-[#73766F] uppercase tracking-wider px-2 py-1">
                    Simulate Role (RBAC Testing)
                  </div>
                  {ROLES_LIST.map(r => (
                    <button
                      key={r.role}
                      onClick={() => {
                        switchRole(r.role);
                        setRoleMenuOpen(false);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded hover:bg-[#F7F7F4] flex items-center justify-between cursor-pointer"
                    >
                      <div>
                        <div className="font-medium text-[#252923]">{r.label}</div>
                        <div className="text-[10px] text-[#73766F]">{r.desc}</div>
                      </div>
                      {user?.role === r.role && <Check className="w-3.5 h-3.5 text-[#6D876D]" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 md:hidden bg-black/40 backdrop-blur-xs flex">
            <div className="w-64 bg-white h-full flex flex-col shadow-xl">
              <div className="p-4 border-b border-[#E5E7E0] flex items-center justify-between">
                <div className="font-bold text-sm text-[#252923]">RazBuddy OS</div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-[#73766F]">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                {navItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        navigate(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-xs font-medium ${
                        currentRoute === item.id ? 'bg-[#6D876D]/10 text-[#405440]' : 'text-[#73766F]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        )}

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top Bar */}
          <header className="h-14 bg-white border-b border-[#E5E7E0] px-4 md:px-6 flex items-center justify-between shrink-0">
            {/* Left: Mobile hamburger & Title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="md:hidden p-1.5 text-[#73766F] hover:bg-stone-100 rounded"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-sm font-semibold text-[#252923] tracking-tight">
                  {getPageTitle()}
                </h1>
                <div className="hidden sm:block text-[11px] text-[#73766F]">
                  {business?.name} • {business?.city}, {business?.state} • INR (<span className="font-sans">₹</span>)
                </div>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Voice-to-Action Microphone Button */}
              <button
                onClick={handleVoiceClick}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-all cursor-pointer ${
                  isListening
                    ? 'bg-rose-500 text-white border-rose-600 animate-pulse shadow-sm'
                    : 'bg-white hover:bg-stone-50 border-[#E5E7E0] text-[#73766F] hover:text-[#252923]'
                }`}
                title={isListening ? 'Stop listening' : 'Speak Hinglish / Voice command'}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-[#6D876D]" />}
                <span className="hidden sm:inline">{isListening ? 'Listening...' : 'Voice AI'}</span>
              </button>

              {/* Global search trigger */}
              <button
                onClick={() => setIsSearchOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded border border-[#E5E7E0] bg-[#F7F7F4] hover:bg-stone-100 text-[#73766F] text-xs transition-colors cursor-pointer"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search / RMA...</span>
                <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-white border border-[#E5E7E0] rounded text-[#73766F]">
                  ⌘K
                </kbd>
              </button>

              {/* Quick Create Button */}
              <div className="relative group">
                <button
                  onClick={() => openQuickCreate('order')}
                  className="px-2.5 py-1.5 rounded bg-[#6D876D] hover:bg-[#5b735b] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Create</span>
                </button>
              </div>

              {/* Notifications Popover */}
              <div className="relative">
                <button
                  onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                  className="relative p-1.5 rounded border border-[#E5E7E0] hover:bg-stone-100 text-[#73766F] transition-colors cursor-pointer"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadNotifs > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {unreadNotifs}
                    </span>
                  )}
                </button>

                {notifMenuOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E5E7E0] rounded shadow-xl p-2 z-50 text-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[#E5E7E0] px-1">
                      <span className="font-semibold text-[#252923]">Notifications</span>
                      <span className="text-[10px] text-[#73766F] font-mono">{unreadNotifs} unread</span>
                    </div>
                    <div className="divide-y divide-[#E5E7E0] max-h-72 overflow-y-auto">
                      {notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markNotificationAsRead(n.id);
                            if (n.linkTo) navigate(n.linkTo);
                            setNotifMenuOpen(false);
                          }}
                          className={`p-2.5 hover:bg-[#F7F7F4] cursor-pointer transition-colors ${
                            !n.read ? 'bg-amber-50/50' : ''
                          }`}
                        >
                          <div className="font-medium text-[#252923]">{n.title}</div>
                          <div className="text-[11px] text-[#73766F] mt-0.5">{n.message}</div>
                          <div className="text-[10px] text-[#73766F] mt-1 font-mono">{n.timestamp}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Demo Reset Button */}
              <button
                onClick={resetDemoData}
                className="px-2.5 py-1.5 rounded border border-[#E5E7E0] bg-[#F7F7F4] hover:bg-stone-200 text-[#73766F] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Reset all demo records to initial state"
              >
                <RotateCcw className="w-3.5 h-3.5 text-[#6D876D]" />
                <span className="hidden lg:inline text-[11px]">Reset Demo</span>
              </button>
            </div>
          </header>

          {/* Child Page Content */}
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
