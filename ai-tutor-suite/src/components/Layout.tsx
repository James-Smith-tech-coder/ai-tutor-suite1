import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { signInWithGoogle, logout } from '../firebase';
import { MessageSquare, Image as ImageIcon, Video, Mic, Eye, Headphones, LogOut, LogIn } from 'lucide-react';
import { cn } from '../lib/utils';

export const Layout: React.FC = () => {
  const { user, isAuthReady } = useAuth();

  const navItems = [
    { to: '/', icon: MessageSquare, label: 'Chat Assistant' },
    { to: '/image', icon: ImageIcon, label: 'Image Studio' },
    { to: '/video', icon: Video, label: 'Video Studio' },
    { to: '/voice', icon: Mic, label: 'Voice Chat' },
    { to: '/vision', icon: Eye, label: 'Vision Analysis' },
    { to: '/audio', icon: Headphones, label: 'Audio Tools' },
  ];

  if (!isAuthReady) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-indigo-600 flex items-center gap-2">
            <span className="bg-indigo-100 p-2 rounded-lg">✨</span>
            AI Tutor Suite
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive 
                    ? "bg-indigo-50 text-indigo-700" 
                    : "text-gray-700 hover:bg-gray-100"
                )
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold">
                    {user.email?.[0].toUpperCase()}
                  </div>
                )}
                <div className="truncate">
                  <p className="text-sm font-medium text-gray-900 truncate">{user.displayName || 'User'}</p>
                  <p className="text-xs text-gray-500 truncate">{user.email}</p>
                </div>
              </div>
              <button onClick={logout} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Log out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <LogIn className="w-4 h-4" />
              Sign in with Google
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {user ? (
          <Outlet />
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center">
            <div className="max-w-md">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to AI Tutor Suite</h2>
              <p className="text-gray-600 mb-8">
                Your friendly, all-in-one AI assistant powered by Google Gemini. Sign in to access chat, image generation, video creation, and more.
              </p>
              <button
                onClick={signInWithGoogle}
                className="bg-indigo-600 text-white py-3 px-6 rounded-xl hover:bg-indigo-700 transition-colors font-medium text-lg shadow-sm"
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
