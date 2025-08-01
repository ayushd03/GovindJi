import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePermissions } from '../context/PermissionContext';
import { AdminPanelGuard } from './PermissionGuard';
import RoleIndicator from './RoleIndicator';
import {
  HomeIcon,
  ChartBarIcon,
  CubeIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon,
  UsersIcon,
  ChartPieIcon,
  ArrowRightOnRectangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TagIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import './AdminLayout.css'; // Import the CSS file

const AdminLayout = ({ children }) => {
  const { user, logout } = useAuth();
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
  const handleTouchStart = (e) => {
    if (!isMobile) return;
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
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
  };

  const handleTouchEnd = (e) => {
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
  };

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
  }, [isMobile, sidebarOpen, isDragging]);

  const iconComponents = {
    'ChartBarIcon': ChartBarIcon,
    'TagIcon': TagIcon,
    'CubeIcon': CubeIcon,
    'ShoppingCartIcon': ShoppingCartIcon,
    'ClipboardDocumentListIcon': ClipboardDocumentListIcon,
    'UsersIcon': UsersIcon,
    'ChartPieIcon': ChartPieIcon,
    'BuildingOfficeIcon': BuildingOfficeIcon,
    'UserGroupIcon': UserGroupIcon,
    'CurrencyDollarIcon': CurrencyDollarIcon
  };

  const menuItems = getAccessibleTabs().map(tab => ({
    path: tab.path,
    label: tab.label,
    icon: iconComponents[tab.icon] || ChartBarIcon
  }));

  return (
    <AdminPanelGuard>
      <div className="min-h-screen bg-background flex">
        <div 
          ref={sidebarRef}
          className={`fixed inset-y-0 left-0 z-50 bg-gray-800 text-white shadow-lg flex flex-col
                     transition-all duration-300 ease-in-out
                     ${sidebarOpen ? 'w-72 translate-x-0' : 'w-16 lg:w-16 -translate-x-full lg:translate-x-0 hidden lg:flex'}
                     ${isMobile && sidebarOpen ? 'flex' : ''}`}>
          
          <div className={`flex border-b border-gray-700 ${sidebarOpen ? 'items-center justify-between p-4' : 'flex-col items-center p-2 space-y-2'}`}>
            <Link to="/admin" className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <CubeIcon className="w-5 h-5 text-primary-foreground" />
              </div>
              {sidebarOpen && (
                <span className="text-xl font-bold">GovindJi Admin</span>
              )}
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg transition-colors duration-200 ${sidebarOpen ? 'hover:bg-gray-700' : 'bg-gray-700'}`}
            >
              {sidebarOpen ? (
                <ChevronLeftIcon className="w-5 h-5" />
              ) : (
                <ChevronRightIcon className="w-5 h-5" />
              )}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto sidebar-scroll">
            <nav className="mt-6 px-3 space-y-1 pb-6">
              {menuItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`menu-item flex items-center py-3 text-sm font-medium rounded-lg transition-all duration-200 
                               ${sidebarOpen ? 'px-3' : 'px-2 justify-center'} 
                               ${isActive 
                                 ? 'bg-primary text-primary-foreground shadow-lg' 
                                 : 'text-gray-300 hover:bg-gray-700 hover:text-white'
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

          <div className="p-3 border-t border-gray-700 space-y-1 flex-shrink-0">
            <Link
              to="/"
              className="flex items-center px-3 py-3 text-sm font-medium text-gray-300 
                         hover:bg-gray-700 hover:text-white rounded-lg transition-all duration-200"
            >
              <HomeIcon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="ml-3">Back to Store</span>}
            </Link>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-3 py-3 text-sm font-medium text-red-400 
                         hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-all duration-200"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
              {sidebarOpen && <span className="ml-3">Logout</span>}
            </button>
          </div>
        </div>

        <div className={`flex-1 ${sidebarOpen ? 'ml-0 lg:ml-72' : 'ml-0 lg:ml-16'} transition-all duration-300 flex flex-col min-h-screen`}>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-6">
              <div className="flex items-center justify-end mb-6">
                <div className="flex items-center space-x-3">
                  <RoleIndicator />
                </div>
              </div>
              {children}
            </div>
          </main>
        </div>

        {sidebarOpen && isMobile && (
          <div 
            ref={backdropRef}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300 ease-in-out"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className={`expand-button fixed top-4 left-3 z-50 p-3 bg-gray-800 rounded-lg shadow-lg hover:bg-gray-700 
                       transition-all duration-300 ease-in-out lg:hidden
                       ${sidebarOpen ? 'hidden' : ''}`}
          >
            <ChevronRightIcon className="w-6 h-6 text-white" />
          </button>
        )}
      </div>
    </AdminPanelGuard>
  );
};

export default AdminLayout;
