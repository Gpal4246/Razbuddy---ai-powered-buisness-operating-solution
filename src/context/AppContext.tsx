import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Business, User, UserRole, NotificationItem } from '../types/index.ts';
import { api } from '../api/client.ts';

interface AppContextType {
  user: User | null;
  business: Business | null;
  businesses: Business[];
  teamMembers: User[];
  currentRoute: string;
  currentSubTab: string;
  navigate: (route: string, subTab?: string) => void;
  switchRole: (role: UserRole) => Promise<void>;
  switchBusiness: (businessId: string) => Promise<void>;
  resetDemoData: () => Promise<void>;
  refreshSignal: number;
  triggerRefresh: () => void;
  
  // Modals
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean) => void;
  quickCreateTarget: string | null;
  openQuickCreate: (target?: string) => void;
  closeQuickCreate: () => void;
  selectedCustomerIdFor360: string | null;
  openCustomer360: (customerId: string) => void;
  closeCustomer360: () => void;

  // Razorpay Checkout Modal
  razorpayCheckoutData: {
    isOpen: boolean;
    invoiceId?: string;
    customerId?: string;
    customerName?: string;
    amount: number;
    description?: string;
  };
  openRazorpayCheckout: (data: { invoiceId?: string; customerId?: string; customerName?: string; amount: number; description?: string }) => void;
  closeRazorpayCheckout: () => void;
  onPaymentCompleted?: (paymentId: string) => void;
  setPaymentCompletedCallback: (cb: (paymentId: string) => void) => void;

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;

  // Notifications
  notifications: NotificationItem[];
  markNotificationAsRead: (id: string) => void;

  // Voice Web Speech API
  isListening: boolean;
  startListening: (onTranscript: (text: string) => void) => void;
  stopListening: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [refreshSignal, setRefreshSignal] = useState(0);

  // Routing
  const [currentRoute, setCurrentRoute] = useState<string>('overview');
  const [currentSubTab, setCurrentSubTab] = useState<string>('');

  // Modals
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [quickCreateTarget, setQuickCreateTarget] = useState<string | null>(null);
  const [selectedCustomerIdFor360, setSelectedCustomerIdFor360] = useState<string | null>(null);

  // Razorpay Checkout
  const [razorpayCheckoutData, setRazorpayCheckoutData] = useState<{
    isOpen: boolean;
    invoiceId?: string;
    customerId?: string;
    customerName?: string;
    amount: number;
    description?: string;
  }>({ isOpen: false, amount: 0 });
  const [paymentCompletedCallback, setPaymentCompletedCallbackState] = useState<((paymentId: string) => void) | undefined>(undefined);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Voice speech state
  const [isListening, setIsListening] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState<any>(null);

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>([
    {
      id: 'notif-1',
      title: 'Udhaar Overdue Alert',
      message: 'INV-2026-002 from Mehra Electronics is overdue by >20 days (₹61,832).',
      type: 'warning',
      linkTo: 'sales?tab=receivables',
      read: false,
      timestamp: '10 mins ago',
    },
    {
      id: 'notif-2',
      title: 'Safety Stock Alert (Dynamic Velocity)',
      message: 'Exide InvaTubular 150Ah Battery is down to 4 units (Threshold: 8).',
      type: 'action_needed',
      linkTo: 'inventory?tab=alerts',
      read: false,
      timestamp: '1 hour ago',
    },
    {
      id: 'notif-3',
      title: 'Field Service Job',
      message: 'Apex Diagnostic Labs calibration scheduled tomorrow at 10:00 AM (Field BOM enabled).',
      type: 'info',
      linkTo: 'bookings?tab=appointments',
      read: false,
      timestamp: '2 hours ago',
    }
  ]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(prev => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const triggerRefresh = useCallback(() => {
    setRefreshSignal(s => s + 1);
  }, []);

  // Fetch initial session
  useEffect(() => {
    api.getMe()
      .then(res => {
        setUser(res.user);
        setBusiness(res.business);
        setBusinesses(res.businesses);
        setTeamMembers(res.teamMembers);
        // Persist to local storage if not already set
        if (!localStorage.getItem('razbuddy_active_biz')) {
          localStorage.setItem('razbuddy_active_biz', res.business.id);
        }
        if (!localStorage.getItem('razbuddy_user_role')) {
          localStorage.setItem('razbuddy_user_role', res.user.role);
        }
        if (!localStorage.getItem('razbuddy_user_id')) {
          localStorage.setItem('razbuddy_user_id', res.user.id);
        }
      })
      .catch(err => {
        console.error('Failed to load session:', err);
        showToast('Could not load user profile', 'error');
      });
  }, [showToast]);

  // Handle URL hash / path routing
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname.replace(/^\//, '');
      const searchParams = new URLSearchParams(window.location.search);
      const tab = searchParams.get('tab') || '';
      if (path) {
        setCurrentRoute(path);
        setCurrentSubTab(tab);
      }
    };
    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigate = (route: string, subTab?: string) => {
    let cleanRoute = route.replace(/^\//, '');
    let tab = subTab || '';
    if (cleanRoute.includes('?')) {
      const parts = cleanRoute.split('?');
      cleanRoute = parts[0];
      const params = new URLSearchParams(parts[1]);
      tab = params.get('tab') || tab;
    }
    setCurrentRoute(cleanRoute || 'overview');
    setCurrentSubTab(tab);
    const url = cleanRoute === 'overview' ? '/' : `/${cleanRoute}${tab ? `?tab=${tab}` : ''}`;
    window.history.pushState({}, '', url);
  };

  const switchRole = async (role: UserRole) => {
    try {
      localStorage.setItem('razbuddy_user_role', role);
      if (user) {
        setUser({ ...user, role });
      }
      showToast(`Active role switched to ${role.replace('_', ' ').toUpperCase()}`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const switchBusiness = async (businessId: string) => {
    try {
      localStorage.setItem('razbuddy_active_biz', businessId);
      const matched = businesses.find(b => b.id === businessId);
      if (matched) setBusiness(matched);
      showToast(`Switched workspace to "${matched?.name || businessId}"`, 'success');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const resetDemoData = async () => {
    try {
      await api.resetDemo();
      showToast('Demo workspace reset to pristine initial state', 'success');
      triggerRefresh();
      const res = await api.getMe();
      setUser(res.user);
      setBusiness(res.business);
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const openQuickCreate = (target: string = 'order') => {
    setQuickCreateTarget(target);
  };

  const closeQuickCreate = () => {
    setQuickCreateTarget(null);
  };

  const openCustomer360 = (customerId: string) => {
    setSelectedCustomerIdFor360(customerId);
  };

  const closeCustomer360 = () => {
    setSelectedCustomerIdFor360(null);
  };

  const openRazorpayCheckout = (data: {
    invoiceId?: string;
    customerId?: string;
    customerName?: string;
    amount: number;
    description?: string;
  }) => {
    setRazorpayCheckoutData({ isOpen: true, ...data });
  };

  const closeRazorpayCheckout = () => {
    setRazorpayCheckoutData(prev => ({ ...prev, isOpen: false }));
  };

  const setPaymentCompletedCallback = (cb: (paymentId: string) => void) => {
    setPaymentCompletedCallbackState(() => cb);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  // Web Speech API for Hinglish / Indian English Voice Command Bar
  const startListening = (onTranscript: (text: string) => void) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Speech recognition is not supported in this browser.', 'info');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-IN'; // Also detects Hinglish terms
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsListening(true);
        showToast('Listening... Speak your command in Hinglish or English', 'info');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          onTranscript(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
      setRecognitionInstance(recognition);
    } catch (err) {
      console.error('Speech recognition error:', err);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionInstance) {
      recognitionInstance.stop();
      setIsListening(false);
    }
  };

  // Keyboard shortcut Cmd+K for global search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <AppContext.Provider
      value={{
        user,
        business,
        businesses,
        teamMembers,
        currentRoute,
        currentSubTab,
        navigate,
        switchRole,
        switchBusiness,
        resetDemoData,
        refreshSignal,
        triggerRefresh,
        isSearchOpen,
        setIsSearchOpen,
        quickCreateTarget,
        openQuickCreate,
        closeQuickCreate,
        selectedCustomerIdFor360,
        openCustomer360,
        closeCustomer360,
        razorpayCheckoutData,
        openRazorpayCheckout,
        closeRazorpayCheckout,
        onPaymentCompleted: paymentCompletedCallback,
        setPaymentCompletedCallback,
        toast,
        showToast,
        notifications,
        markNotificationAsRead,
        isListening,
        startListening,
        stopListening,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
