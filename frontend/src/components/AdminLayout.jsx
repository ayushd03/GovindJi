import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { AdminPanelGuard } from './PermissionGuard';
import {
  HomeIcon,
  ChartBarIcon,
  CubeIcon,
  ShoppingCartIcon,
  TruckIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  ChartPieIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TagIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import './AdminLayout.css'; // Import the CSS file

const AdminLayout = ({ children }) => {
  const { logout } = useAuth();
  const { getAccessibleTabs } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const sidebarRef = useRef(null);
  const backdropRef = useRef(null);
  const touchStartX = useRef(null);
  const touchCurrentX = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Touch/Swipe handlers
  const handleTouchStart = useCallback((e) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setIsDragging(true);
  }, [isMobile]);

  const handleTouchMove = useCallback((e) => {
    if (!isMobile || !isDragging || touchStartX.current === null) return;
    
    touchCurrentX.current = e.touches[0].clientX;
    const deltaX = touchCurrentX.current - touchStartX.current;
    
    // Only handle swipes from the left edge to open or from sidebar to close
    if (!sidebarOpen && touchStartX.current < 50 && deltaX > 0) {
      // Swipe from left edge to open
      e.preventDefault();
    } else if (sidebarOpen && deltaX < 0) {
      // Swipe left on open sidebar to close
      e.preventDefault();
    }
  }, [isDragging, isMobile, sidebarOpen]);

  const handleTouchEnd = useCallback(() => {
    if (!isMobile || !isDragging || touchStartX.current === null) return;
    
    const deltaX = touchCurrentX.current - touchStartX.current;
    const threshold = 100; // Minimum swipe distance
    
    if (!sidebarOpen && touchStartX.current < 50 && deltaX > threshold) {
      // Swipe right from left edge to open
      setSidebarOpen(true);
    } else if (sidebarOpen && deltaX < -threshold) {
      // Swipe left to close
      setSidebarOpen(false);
    }
    
    touchStartX.current = null;
    touchCurrentX.current = null;
    setIsDragging(false);
  }, [isDragging, isMobile, sidebarOpen]);

  // Add global touch listeners for swipe gestures
  useEffect(() => {
    if (!isMobile) return;
    
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchEnd, handleTouchMove, handleTouchStart, isMobile]);

  const iconComponents = {
    'ChartBarIcon': ChartBarIcon,
    'TagIcon': TagIcon,
    'CubeIcon': CubeIcon,
    'ShoppingCartIcon': ShoppingCartIcon,
    'TruckIcon': TruckIcon,
    'ClipboardDocumentListIcon': ClipboardDocumentListIcon,
    'UsersIcon': UsersIcon,
    'ChartPieIcon': ChartPieIcon,
    'BuildingOfficeIcon': BuildingOfficeIcon,
    'UserGroupIcon': UserGroupIcon,
    'CurrencyDollarIcon': CurrencyDollarIcon,
    'DocumentTextIcon': DocumentTextIcon
  };

  const menuItems = getAccessibleTabs().map(tab => ({
    path: tab.path,
    label: tab.label,
    icon: iconComponents[tab.icon] || ChartBarIcon
  }));

  return (
    <AdminPanelGuard>
      <div className="admin-shell min-h-screen bg-slate-50 text-slate-900 flex">
        <div 
          ref={sidebarRef}
          className={`fixed inset-y-0 left-0 z-50 border-r border-slate-200/80 bg-white/95 text-slate-800 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur flex flex-col
                     transition-all duration-300 ease-in-out
                     ${sidebarOpen ? 'w-72 translate-x-0' : 'w-16 lg:w-16 -translate-x-full lg:translate-x-0 hidden lg:flex'}
                     ${isMobile && sidebarOpen ? 'flex' : ''}`}>
          
          <div className={`flex border-b border-slate-200/80 ${sidebarOpen ? 'items-center justify-between p-4' : 'flex-col items-center p-2.5 space-y-2'}`}>
            <Link to="/admin" className="flex min-w-0 items-center space-x-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
                <CubeIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              {sidebarOpen && (
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-tight text-slate-900">GovindJi Admin</div>
                  <div className="text-xs text-slate-500">Operations Panel</div>
                </div>
              )}
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`rounded-xl border border-slate-200 bg-slate-50 p-2 text-slate-600 transition-colors duration-200 ${sidebarOpen ? 'hover:bg-slate-100 hover:text-slate-900' : 'bg-slate-100 text-slate-700'}`}
            >
              {sidebarOpen ? (
                <ChevronLeftIcon className="w-5 h-5" />
              ) : (
                <ChevronRightIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto sidebar-scroll">
            <nav className="mt-4 px-3 space-y-1 pb-6">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`menu-item flex items-center rounded-xl py-2.5 text-[13px] font-medium transition-all duration-200 
                               ${sidebarOpen ? 'px-3' : 'px-2 justify-center'} 
                               ${isActive 
                                 ? 'bg-slate-900 text-white shadow-sm' 
                                 : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                               }`}
                  >
                    <IconComponent className="w-5 h-5 flex-shrink-0" />
                    {sidebarOpen && (
                      <span className="ml-3 transition-opacity duration-200">{item.label}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="p-3 border-t border-slate-200/80 space-y-1 flex-shrink-0">
            <Link
              to="/"
              className="flex items-center rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 
                         hover:bg-slate-100 hover:text-slate-900 transition-all duration-200"
            >
              <HomeIcon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="ml-3">Back to Store</span>}
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center rounded-xl px-3 py-2.5 text-[13px] font-medium text-rose-600 
                         hover:bg-rose-50 hover:text-rose-700 transition-all duration-200"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="ml-3">Logout</span>}
            </button>
          </div>
        </div>

        <div className={`flex-1 ${sidebarOpen ? 'ml-0 lg:ml-72' : 'ml-0 lg:ml-16'} transition-all duration-300 flex flex-col min-h-screen`}>
          <main className="admin-main-scroll flex-1 overflow-y-auto overflow-x-hidden bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_rgba(248,250,252,1)_55%)]">
            <div className="mx-auto w-full max-w-[96rem] px-3 py-4 sm:px-5 lg:px-6 lg:py-5">
              {children}
            </div>
          </main>
        </div>

        {sidebarOpen && isMobile && (
          <div 
            ref={backdropRef}
            className="fixed inset-0 z-40 bg-slate-950/45 lg:hidden transition-opacity duration-300 ease-in-out"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className={`expand-button fixed top-4 left-3 z-50 rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 shadow-lg hover:bg-slate-50 
                       transition-all duration-300 ease-in-out lg:hidden
                       ${sidebarOpen ? 'hidden' : ''}`}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </AdminPanelGuard>
  );
};

export default AdminLayout;
