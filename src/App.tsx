import React from 'react';
import { AppProvider, useApp } from './context/AppContext.tsx';
import { Shell } from './components/layout/Shell.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { SalesPage } from './pages/SalesPage.tsx';
import { InventoryPage } from './pages/InventoryPage.tsx';
import { BookingsPage } from './pages/BookingsPage.tsx';
import { CustomersPage } from './pages/CustomersPage.tsx';
import { AiCommandCentrePage } from './pages/AiCommandCentrePage.tsx';
import { ReportsPage } from './pages/ReportsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { GlobalSearchModal } from './components/common/GlobalSearchModal.tsx';
import { QuickCreateModal } from './components/common/QuickCreateModal.tsx';
import { Customer360Drawer } from './components/common/Customer360Drawer.tsx';
import { RazorpayCheckoutModal } from './components/common/RazorpayCheckoutModal.tsx';

function MainRouter() {
  const { currentRoute } = useApp();

  const renderCurrentPage = () => {
    switch (currentRoute) {
      case 'sales':
        return <SalesPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'bookings':
        return <BookingsPage />;
      case 'customers':
        return <CustomersPage />;
      case 'ai':
        return <AiCommandCentrePage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'overview':
      default:
        return <DashboardPage />;
    }
  };

  return (
    <Shell>
      {renderCurrentPage()}
      <GlobalSearchModal />
      <QuickCreateModal />
      <Customer360Drawer />
      <RazorpayCheckoutModal />
    </Shell>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainRouter />
    </AppProvider>
  );
}
