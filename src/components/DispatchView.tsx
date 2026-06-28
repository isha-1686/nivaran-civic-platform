import React, { useState } from "react";
import { 
  CivicReport, 
  CATEGORIES, 
  IssueStatusType, 
  SeverityType 
} from "../types";
import { 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  MapPin, 
  CheckCircle2, 
  User, 
  ChevronDown, 
  ChevronUp, 
  History, 
  Wrench, 
  Trash2, 
  Lightbulb, 
  Droplet,
  Info,
  Sparkles
} from "lucide-react";
import { getRelativeTime } from "./ReportList"; // We will export this helper from ReportList

interface DispatchViewProps {
  reports: CivicReport[];
  currentUserId: string | undefined;
  onStatusChange: (reportId: string, newStatus: IssueStatusType) => void;
}

const CATEGORY_NAMES: Record<string, string> = {
  pothole: "Pothole / Road Damage",
  garbage: "Garbage / Dump Pile",
  streetlight: "Broken Streetlight",
  water_leak: "Water Leak / Pipe Burst",
  other: "Other Civic Hazard"
};

const SEVERITY_COLORS: Record<string, string> = {
  Low: "bg-slate-50 text-slate-600 border-slate-200/80",
  Medium: "bg-amber-50/80 text-amber-700 border-amber-200/70",
  High: "bg-rose-50/80 text-rose-700 border-rose-200/70 font-bold"
};

const STATUS_COLORS: Record<string, string> = {
  reported: "bg-slate-50 text-slate-600 border-slate-200/80",
  acknowledged: "bg-yellow-50/80 text-yellow-800 border-yellow-200/70",
  "in progress": "bg-blue-50/80 text-blue-700 border-blue-200/70",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200/70"
};

export default function DispatchView({ reports, currentUserId, onStatusChange }: DispatchViewProps) {
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Helper to pick category details
  const getCategoryDetails = (catId: string) => {
    const found = CATEGORIES.find(c => c.id === catId);
    if (found) return found;
    return { name: catId, icon: "AlertTriangle" };
  };

  const renderCategoryIcon = (catId: string) => {
    switch (catId) {
      case "pothole":
        return <Wrench className="w-3.5 h-3.5 text-slate-700" />;
      case "garbage":
        return <Trash2 className="w-3.5 h-3.5 text-emerald-700" />;
      case "streetlight":
        return <Lightbulb className="w-3.5 h-3.5 text-amber-600" />;
      case "water_leak":
        return <Droplet className="w-3.5 h-3.5 text-blue-600" />;
      default:
        return <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />;
    }
  };

  // Sort by priority: Escalated first, then High, then Medium, then Low severity, then newest date
  const sortedReports = [...reports].sort((a, b) => {
    const aEsc = a.escalated ? 1 : 0;
    const bEsc = b.escalated ? 1 : 0;
    if (aEsc !== bEsc) {
      return bEsc - aEsc; // escalated (1) first
    }

    const severityWeight = (sev: SeverityType) => {
      if (sev === "High") return 3;
      if (sev === "Medium") return 2;
      if (sev === "Low") return 1;
      return 0;
    };

    const aSev = severityWeight(a.severity);
    const bSev = severityWeight(b.severity);
    if (aSev !== bSev) {
      return bSev - aSev; // high priority first
    }

    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const toggleHistory = (id: string) => {
    if (expandedHistoryId === id) {
      setExpandedHistoryId(null);
    } else {
      setExpandedHistoryId(id);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Intro header block */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5.5 shadow-sm space-y-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100/50 font-mono">
          <ShieldAlert className="w-3.5 h-3.5" /> Dispatch Console
        </span>
        <h2 className="text-xl font-extrabold text-slate-900">Operator Incident Routing</h2>
        <p className="text-xs text-slate-550 leading-relaxed max-w-2xl font-medium">
          Welcome to the civic routing matrix. Below are all reported hazard reports organized by system dispatch urgency. Any signed-in user can perform active ticket acknowledgments, status updates, and progress transitions.
        </p>
      </div>

      {sortedReports.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200/80 rounded-2xl p-8 max-w-md mx-auto shadow-sm">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100/60 shadow-inner">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h4 className="text-base font-extrabold text-slate-800">Dispatch Queue Empty</h4>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed font-semibold max-w-xs mx-auto">
            All reported hazards have been cleared or are currently inactive. Sit back, the city is running smoothly!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedReports.map((report) => {
            const catDetails = getCategoryDetails(report.category);
            const statusKey = String(report.status).toLowerCase();
            const photos = Array.isArray(report.photoUrls) && report.photoUrls.length > 0
              ? report.photoUrls
              : [report.photoUrl].filter(Boolean);

            return (
              <div 
                key={report.id} 
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                  report.escalated 
                    ? "border-rose-300 ring-1 ring-rose-300/30" 
                    : "border-slate-200 hover:border-slate-350"
                }`}
              >
                <div className="p-5 flex flex-col md:flex-row gap-5">
                  {/* Photo Thumbnail */}
                  <div className="w-full md:w-36 h-28 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shrink-0 relative">
                    {photos[0] ? (
                      <img 
                        src={photos[0]} 
                        alt={catDetails.name} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-350 italic text-[10px]">
                        No Image
                      </div>
                    )}
                    {report.escalated && (
                      <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-rose-600 text-[8px] font-black uppercase text-white rounded tracking-wide animate-pulse">
                        Escalated
                      </span>
                    )}
                  </div>

                  {/* Main Content Info */}
                  <div className="flex-1 space-y-3.5">
                    {/* Upper row tags */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${SEVERITY_COLORS[report.severity] || "bg-slate-50 text-slate-650"}`}>
                        {report.severity} Priority
                      </span>

                      <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[statusKey] || "bg-slate-50 text-slate-650"}`}>
                        {report.status}
                      </span>

                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5 ml-auto">
                        <Clock className="w-3.5 h-3.5" />
                        {getRelativeTime(report.createdAt)}
                      </span>
                    </div>

                    {/* Category Title & description */}
                    <div>
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
                        {renderCategoryIcon(report.category)}
                        {catDetails.name}
                      </h3>
                      <p className="text-sm font-bold text-slate-800 leading-snug mt-1.5">
                        {report.description}
                      </p>
                    </div>

                    {/* Geolocation */}
                    <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-xs text-slate-500 flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate leading-normal font-medium">{report.location.address}</span>
                    </div>

                    {/* Escalation detail reason */}
                    {report.escalated && report.escalationReason && (
                      <div className="bg-rose-50/70 border border-rose-100/50 p-2.5 rounded-xl">
                        <p className="text-[10px] text-rose-800 italic leading-relaxed font-semibold">
                          <span className="font-bold uppercase tracking-wider mr-1 text-rose-600">AI Flagged:</span>
                          "{report.escalationReason}"
                        </p>
                      </div>
                    )}

                    {/* AI Resolution Plan Section */}
                    <div className="bg-slate-900 text-slate-100 p-3 rounded-xl border border-slate-800 space-y-2 shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse shrink-0" />
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">
                            AI Resolution Plan
                          </span>
                        </div>
                        {report.resolutionPlan?.suggestedDepartment && (
                          <span className="text-[9px] font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
                            {report.resolutionPlan.suggestedDepartment}
                          </span>
                        )}
                      </div>

                      {report.resolutionPlan ? (
                        <div className="space-y-1.5 text-xs">
                          <div>
                            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-0.5">Suggested Action</span>
                            <p className="text-slate-200 font-medium leading-relaxed">{report.resolutionPlan.suggestedAction}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                              <span className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Est. Resources</span>
                              <span className="text-[11px] font-bold text-indigo-300 font-mono mt-0.5 block truncate">{report.resolutionPlan.estimatedResources}</span>
                            </div>
                            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
                              <span className="text-[9px] font-mono text-slate-450 uppercase tracking-wider block">Est. Time</span>
                              <span className="text-[11px] font-bold text-emerald-400 font-mono mt-0.5 block truncate">{report.resolutionPlan.estimatedResolutionTime}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="py-1 flex items-center gap-2 text-xs text-slate-400 italic font-mono">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          <span>Resolution plan pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Operational Dropdown Control Panel */}
                  <div className="md:w-56 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-5 flex flex-col justify-between gap-3.5">
                    <div>
                      <label className="text-[9px] font-bold uppercase text-slate-400 tracking-wider block mb-1.5 font-mono">
                        Ticket Routing Status
                      </label>
                      {currentUserId ? (
                        <div className="relative">
                          <select
                            value={statusKey}
                            onChange={(e) => onStatusChange(report.id, e.target.value as IssueStatusType)}
                            className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-slate-350 cursor-pointer appearance-none pr-8"
                          >
                            <option value="reported">Reported</option>
                            <option value="acknowledged">Acknowledged</option>
                            <option value="in progress">In Progress</option>
                            <option value="resolved">Resolved</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 text-[11px] text-slate-400 italic font-semibold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-300" />
                          <span>Sign in as citizen operator</span>
                        </div>
                      )}
                    </div>

                    {/* Expandable History Log summary */}
                    <div>
                      <button
                        type="button"
                        onClick={() => toggleHistory(report.id)}
                        className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-150 rounded-xl p-2.5 flex items-center justify-between text-slate-600 hover:text-slate-800 transition duration-150 cursor-pointer text-[10px] font-bold"
                      >
                        <span className="flex items-center gap-1.5 font-mono">
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          History ({report.statusHistory?.length || 0})
                        </span>
                        {expandedHistoryId === report.id ? (
                          <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Status History Timeline */}
                {expandedHistoryId === report.id && (
                  <div className="bg-slate-50/70 border-t border-slate-100 p-4.5 space-y-3.5">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                      <History className="w-3.5 h-3.5 text-indigo-500" /> Audit Trail Log
                    </h4>

                    {!report.statusHistory || report.statusHistory.length === 0 ? (
                      <p className="text-[11px] text-slate-450 italic pl-1 font-semibold">
                        This incident has not received any administrative status updates yet. Current active state is "Reported".
                      </p>
                    ) : (
                      <div className="relative pl-4 border-l border-slate-200 space-y-4 ml-1.5">
                        {report.statusHistory.map((history, idx) => {
                          const val = String(history.status).toLowerCase();
                          return (
                            <div key={idx} className="relative">
                              {/* Indicator dot */}
                              <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow-sm ring-1 ring-indigo-500/20" />
                              
                              <div className="text-xs leading-normal">
                                <span className="font-bold text-slate-800 capitalize mr-2">
                                  {val}
                                </span>
                                <span className="text-slate-400 font-semibold text-[10px] mr-2">
                                  by {history.changedBy}
                                </span>
                                <span className="text-slate-400 font-mono text-[9px]">
                                  ({getRelativeTime(history.changedAt)})
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
