import React, { useState, useEffect } from "react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  CartesianGrid,
  Cell
} from "recharts";
import { 
  Sparkles, 
  Loader2, 
  TrendingUp, 
  Layers, 
  Map, 
  Info,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface DashboardData {
  categoryCounts: Record<string, number>;
  areaCounts: Record<string, number>;
  trendInsight: string;
  usingAllTime: boolean;
  totalReports: number;
}

const CATEGORY_NAMES: Record<string, string> = {
  pothole: "Pothole",
  garbage: "Garbage Pile",
  streetlight: "Streetlight",
  water_leak: "Water Leak",
  other: "Other"
};

const CATEGORY_COLORS: Record<string, string> = {
  pothole: "#6366f1", // indigo-500
  garbage: "#f59e0b", // amber-500
  streetlight: "#06b6d4", // cyan-500
  water_leak: "#3b82f6", // blue-500
  other: "#64748b" // slate-500
};

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [hotspotsData, setHotspotsData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchInsights = async (silent = false) => {
    if (!silent) setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dashboard-insight");
      if (!response.ok) {
        throw new Error(`Server failed to fetch dashboard insights (${response.status})`);
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const json = await response.json();
        setData(json);
      } else {
        const text = await response.text();
        if (text.includes("<!DOCTYPE") || text.includes("<!doctype")) {
          throw new Error("API route returned HTML instead of JSON. This indicates the server is fallback-routing to the single page app index.html.");
        } else {
          throw new Error(`Expected JSON but received: ${text.slice(0, 100)}`);
        }
      }

      // Fetch hotspots
      const hotspotsRes = await fetch("/api/hotspots");
      if (hotspotsRes.ok) {
        const hsJson = await hotspotsRes.json();
        setHotspotsData(hsJson);
      }

    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to load dashboard insights");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchInsights(true);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 flex flex-col items-center justify-center min-h-[400px] shadow-sm">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-600">Analyzing district incident feeds...</p>
        <p className="text-xs text-slate-400 mt-1">Aggregating categories, areas, and querying Gemini for trend insights</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 flex flex-col items-center justify-center min-h-[350px] shadow-sm">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-base font-bold text-slate-800">Dashboard Analysis Failed</p>
        <p className="text-xs text-slate-500 mt-1 max-w-md text-center">{error || "No data returned from analytical backend"}</p>
        <button
          onClick={() => fetchInsights()}
          className="mt-6 px-4 py-2 bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs rounded-xl flex items-center gap-2 duration-150 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Try Again
        </button>
      </div>
    );
  }

  const { categoryCounts, areaCounts, trendInsight, usingAllTime, totalReports } = data;

  // Format category chart data
  const categoryChartData = Object.entries(categoryCounts).map(([key, val]) => ({
    name: CATEGORY_NAMES[key] || key,
    key,
    count: Number(val),
  })).sort((a, b) => b.count - a.count);

  // Format area chart data
  const areaChartData = Object.entries(areaCounts).map(([name, val]) => ({
    name,
    count: Number(val),
  })).sort((a, b) => b.count - a.count).slice(0, 8); // top 8 areas

  const hasData = totalReports > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* Top bar with quick facts */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/50 font-mono">
            <TrendingUp className="w-3.5 h-3.5" /> District Metrics Engine
          </span>
          <h2 className="text-xl font-extrabold text-slate-900 mt-1.5">District Analytics Console</h2>
          <p className="text-xs text-slate-400 font-semibold mt-0.5">
            {usingAllTime 
              ? "All-time consolidated statistics (insufficient data in last 30 days)" 
              : "Active ticket aggregates across the last 30 days of resident reports"
            }
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-50 border border-slate-200 px-4.5 py-2.5 rounded-xl text-center">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Reports Logged</p>
            <p className="text-xl font-black text-slate-800 leading-tight">{totalReports}</p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition duration-150 disabled:opacity-50 text-slate-600 hover:text-slate-800 cursor-pointer flex items-center justify-center h-11 w-11"
            title="Refresh analytics and re-query Gemini insights"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-16 text-center shadow-sm">
          <Layers className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-base font-extrabold text-slate-800">Insufficient Data for Analytics</h3>
          <p className="text-xs text-slate-550 max-w-sm mx-auto mt-2 leading-relaxed">
            There are currently no active reports filed in the system. Go back to the incident feed, report a few test hazards, and return here to visualize real-time charts and Gemini insights.
          </p>
        </div>
      ) : (
        <>
          {/* Charts Layout - Two Column Bento */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Category Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5.5 shadow-sm flex flex-col">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2 bg-indigo-50 border border-indigo-100/50 rounded-xl text-indigo-600">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Issues by Category</h3>
                  <p className="text-[10px] text-slate-450 font-semibold">Volume break-down by municipal department</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} 
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis 
                      tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc", radius: 8 }}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#1e293b",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: "bold",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                      }}
                    />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={45}>
                      {categoryChartData.map((entry, idx) => (
                        <Cell 
                          key={`cell-${idx}`} 
                          fill={CATEGORY_COLORS[entry.key] || "#6366f1"} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Geographical Distribution */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5.5 shadow-sm flex flex-col">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="p-2 bg-indigo-50 border border-indigo-100/50 rounded-xl text-indigo-600">
                  <Map className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Top Impacted Areas</h3>
                  <p className="text-[10px] text-slate-450 font-semibold">Incident distribution grouped by local district boundaries</p>
                </div>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={areaChartData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis 
                      type="number"
                      tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }} 
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <YAxis 
                      dataKey="name"
                      type="category"
                      tick={{ fill: "#64748b", fontSize: 10, fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      width={100}
                    />
                    <Tooltip
                      cursor={{ fill: "#f8fafc", radius: 8 }}
                      contentStyle={{
                        backgroundColor: "#0f172a",
                        borderColor: "#1e293b",
                        borderRadius: "12px",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: "bold",
                        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
                      }}
                    />
                    <Bar dataKey="count" fill="#4f46e5" radius={[0, 6, 6, 0]} maxBarSize={25} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Gemini AI Natural-Language Trend Insight Panel */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950 text-white rounded-2xl border border-slate-800 p-6.5 shadow-xl relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:3rem_3rem] opacity-[0.07]"></div>
            <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-indigo-500/10 rounded-full blur-[80px] pointer-events-none"></div>

            <div className="relative z-10 flex flex-col md:flex-row md:items-start gap-4">
              <div className="bg-indigo-500/15 p-3 rounded-2xl text-indigo-400 border border-indigo-500/20 shadow-inner shrink-0 self-start">
                <Sparkles className="w-5.5 h-5.5 text-indigo-300 animate-pulse" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 font-mono">Gemini AI Trend Intelligence</h4>
                  <span className="bg-indigo-400/10 text-indigo-300 text-[9px] px-2 py-0.5 rounded-full font-bold border border-indigo-400/10 font-mono">
                    Real-time Analysis
                  </span>
                </div>

                <p className="text-sm md:text-base text-slate-100 font-medium leading-relaxed">
                  "{trendInsight}"
                </p>

                <div className="flex items-center gap-1.5 pt-1 text-[10px] text-slate-400 font-mono">
                  <Info className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Synthesized directly from live database report histories and spatial geodistribution feeds.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Predictive Hotspots Panel */}
          <div className="bg-white rounded-2xl border border-rose-200/80 shadow-sm overflow-hidden mt-6">
            <div className="bg-rose-50/50 p-4 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-800">Predictive Risk Hotspots</h3>
              </div>
              <span className="text-[10px] uppercase font-bold text-rose-500 bg-rose-100 px-2 py-1 rounded">AI Detected</span>
            </div>
            
            <div className="p-5">
              {!hotspotsData ? (
                <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mb-2" />
                  <span className="text-xs">Analyzing spatial density...</span>
                </div>
              ) : hotspotsData.status === "insufficient_data" ? (
                <div className="text-center py-6">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 inline-flex flex-col items-center shadow-sm">
                    <Map className="w-8 h-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-600">Density Analysis Pending</p>
                    <p className="text-xs font-medium text-slate-400 max-w-sm mt-1">{hotspotsData.message}</p>
                  </div>
                </div>
              ) : hotspotsData.zones && hotspotsData.zones.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {hotspotsData.zones.map((zone: any, i: number) => {
                    const isHighDensity = zone.reportCount >= 3;
                    const borderClass = isHighDensity ? 'border-l-orange-500/80' : 'border-l-amber-400/80';
                    const accentBg = isHighDensity ? 'bg-orange-50/30' : 'bg-amber-50/30';
                    const badgeClass = isHighDensity ? 'text-orange-700 bg-orange-100' : 'text-amber-700 bg-amber-100';
                    
                    return (
                      <div key={i} className={`border border-slate-200 border-l-4 ${borderClass} rounded-xl p-4 ${accentBg} hover:opacity-90 transition-opacity`}>
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-slate-800 text-sm">{zone.title || `${zone.category} Cluster`}</h4>
                          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${badgeClass}`}>
                            {zone.reportCount} reports
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 font-medium">{zone.center.address}</p>
                        <div className="bg-white/60 p-3 rounded-lg border border-slate-100 backdrop-blur-sm">
                          <p className="text-[11px] text-slate-700 italic flex gap-2">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                            <span>{zone.reasoning}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-6">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 inline-flex flex-col items-center shadow-sm">
                    <AlertCircle className="w-8 h-8 text-slate-300 mb-3" />
                    <p className="text-sm font-bold text-slate-600">No Active Hotspots</p>
                    <p className="text-xs font-medium text-slate-400 max-w-sm mt-1">No hotspots detected in your area at this time.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
