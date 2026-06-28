import { LogIn, LogOut, ShieldAlert, Sparkles } from "lucide-react";
import { User } from "../firebase";

interface HeaderProps {
  user: User | null;
  points?: number;
  onLogin: () => void;
  onLogout: () => void;
  onGuestLogin: () => void;
  isLoggingIn: boolean;
}

export default function Header({ user, points, onLogin, onLogout, onGuestLogin, isLoggingIn }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-md shadow-indigo-100 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-800 flex items-center gap-1.5">
                Nivaran
                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 border border-indigo-100">
                  <Sparkles className="w-3 h-3 text-indigo-600" /> Community Hero
                </span>
              </span>
              <p className="text-[10px] text-slate-400 font-medium hidden sm:block">Empowering Citizens, Enabling Action</p>
            </div>
          </div>

          {/* User Section */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-3">
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
                  {user.photoURL ? (
                    <img 
                      src={user.photoURL} 
                      alt={user.displayName || "User"} 
                      className="w-6 h-6 rounded-full border border-slate-200"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-[10px]">
                      {user.displayName ? user.displayName[0] : "C"}
                    </div>
                  )}
                  <div className="text-left hidden sm:block">
                    <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <span>{user.displayName || "Resident"}</span>
                      {points !== undefined && (
                        <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md border border-amber-200 shrink-0">
                          {points} pts
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-slate-400">Verified Citizen</p>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors bg-white hover:bg-slate-50 rounded-xl border border-slate-200 shadow-sm"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={onLogin}
                  disabled={isLoggingIn}
                  className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-750 active:bg-indigo-800 rounded-xl transition duration-150 shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {isLoggingIn ? "Signing in..." : "Sign in with Google"}
                  </span>
                </button>
                <button
                  onClick={onGuestLogin}
                  disabled={isLoggingIn}
                  className="flex items-center px-3.5 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-250 rounded-xl transition duration-150 border border-slate-200 cursor-pointer"
                >
                  <span>Guest</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
