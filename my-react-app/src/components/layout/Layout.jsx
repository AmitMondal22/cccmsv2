import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar collapsed={collapsed} />
      <div className={`app-main ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <Header onToggleSidebar={() => setCollapsed(p => !p)} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
