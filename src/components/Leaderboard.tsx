import React, { useState, useEffect } from "react";
import { CivicUser } from "../types";
import { Trophy, Award } from "lucide-react";

interface LeaderboardProps {
  users: CivicUser[];
  currentUserId?: string;
}

const AnimatedNumber = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 800; // 800ms
    const startValue = 0;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // easeOutQuart
      const easeProgress = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeProgress * (value - startValue) + startValue));
      
      if (progress < 1) {
        window.requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };
    
    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{displayValue}</span>;
};

const getAvatarColor = (name: string) => {
  const colors = [
    "bg-rose-100 text-rose-700 border-rose-200",
    "bg-amber-100 text-amber-700 border-amber-200",
    "bg-emerald-100 text-emerald-700 border-emerald-200",
    "bg-blue-100 text-blue-700 border-blue-200",
    "bg-indigo-100 text-indigo-700 border-indigo-200",
    "bg-purple-100 text-purple-700 border-purple-200",
    "bg-pink-100 text-pink-700 border-pink-200",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

export default function Leaderboard({ users, currentUserId }: LeaderboardProps) {
  // Sort users by points descending, get top 10
  const topUsers = [...users]
    .sort((a, b) => b.points - a.points)
    .slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100/50 font-mono">
          <Trophy className="w-3.5 h-3.5" /> Civic Honor Roll
        </span>
        <h2 className="text-xl font-extrabold text-slate-900 font-sans tracking-tight">Active Citizen Leaderboard</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-2xl font-medium">
          Recognizing residents who actively contribute to city maintenance and community safety by logging incidents and resolving hazards. Points are awarded upon successful hazard verification and resolution.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75">
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono w-16 text-center">Rank</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Citizen</th>
                <th className="py-4 px-6 text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono text-right w-32">Civic Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-16 text-center bg-white">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 inline-flex flex-col items-center">
                      <Award className="w-10 h-10 text-slate-300 mb-3" />
                      <p className="text-sm text-slate-600 font-bold">No Civic Points Registered Yet</p>
                      <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
                        Submit and resolve local incidents, or cast verification votes to climb the honor roll!
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                topUsers.map((user, index) => {
                  const rank = index + 1;
                  const isCurrentUser = user.userId === currentUserId;
                  const prevUser = index > 0 ? topUsers[index - 1] : null;
                  const pointsToNext = prevUser ? prevUser.points - user.points : 0;
                  const progressPercentage = prevUser && user.points > 0 ? Math.min(Math.max((user.points / prevUser.points) * 100, 5), 100) : (user.points > 0 ? 100 : 0);

                  return (
                    <tr key={user.userId || index} className={`hover:bg-slate-50/80 transition animate-fade-in ${isCurrentUser ? 'bg-indigo-50/30 relative' : ''}`}>
                      <td className="py-4 px-6 text-center font-mono font-bold text-xs">
                        {rank === 1 ? (
                          <span className="text-xl" title="1st Place">🥇</span>
                        ) : rank === 2 ? (
                          <span className="text-xl" title="2nd Place">🥈</span>
                        ) : rank === 3 ? (
                          <span className="text-xl" title="3rd Place">🥉</span>
                        ) : (
                          <span className="text-slate-500 font-medium text-sm">{rank}</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black shadow-sm ${getAvatarColor(user.userName || "C")}`}>
                              {user.userName ? user.userName[0].toUpperCase() : "C"}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-slate-800 font-sans">{user.userName}</span>
                              {isCurrentUser && <span className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">You</span>}
                            </div>
                          </div>
                          {isCurrentUser && pointsToNext > 0 && (
                            <div className="mt-3 w-full max-w-xs">
                              <div className="flex justify-between text-[10px] text-slate-500 font-medium mb-1">
                                <span>{pointsToNext} pts to rank {rank - 1}</span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-400 rounded-full transition-all duration-1000 ease-out" style={{ width: `${progressPercentage}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-mono font-extrabold text-indigo-600 text-sm">
                        <AnimatedNumber value={user.points} /> <span className="text-xs text-indigo-400 font-medium">pts</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
