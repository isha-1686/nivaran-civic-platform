import { useState } from "react";
import { 
  ThumbsUp, 
  MapPin, 
  AlertTriangle, 
  Sparkles, 
  Clock, 
  User as UserIcon, 
  Wrench, 
  Trash2, 
  Lightbulb, 
  Droplet, 
  CheckCircle2,
  Lock,
  ChevronDown,
  RefreshCw
} from "lucide-react";
import { CivicReport, CATEGORIES, SeverityType, IssueStatusType, Verification, CivicUser } from "../types";
import { motion } from "motion/react";

export function getRelativeTime(isoString: string): string {
  try {
    const now = new Date();
    const past = new Date(isoString);
    const diffMs = now.getTime() - past.getTime();
    if (diffMs < 0) return "just now";
    
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays}d ago`;
    
    return past.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch (e) {
    return "recent";
  }
}

interface ReportListProps {
  reports: CivicReport[];
  users?: CivicUser[];
  currentUserId: string | undefined;
  onUpvoteToggle: (reportId: string) => void;
  onStatusChange: (reportId: string, newStatus: IssueStatusType) => void;
  isLoading: boolean;
  verifications: Verification[];
  onVerifyVote: (reportId: string, voteType: "still_active" | "resolved") => void;
}

export default function ReportList({ 
  reports, 
  users = [],
  currentUserId, 
  onUpvoteToggle, 
  onStatusChange,
  isLoading,
  verifications = [],
  onVerifyVote
}: ReportListProps) {

  // Helper to pick category details
  const getCategoryDetails = (catId: string) => {
    const found = CATEGORIES.find(c => c.id === catId);
    if (found) return found;
    return { name: catId, icon: "AlertTriangle" };
  };

  // Helper to render category icon
  const renderCategoryIcon = (catId: string) => {
    switch (catId) {
      case "pothole":
        return <Wrench className="w-4 h-4 text-slate-700" />;
      case "garbage":
        return <Trash2 className="w-4 h-4 text-emerald-700" />;
      case "streetlight":
        return <Lightbulb className="w-4 h-4 text-amber-600" />;
      case "water_leak":
        return <Droplet className="w-4 h-4 text-blue-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    }
  };

  // Format date helper
  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, { 
        month: "short", 
        day: "numeric", 
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "Recently";
    }
  };

  // Severity style helper
  const getSeverityStyle = (sev: SeverityType) => {
    switch (sev) {
      case "Low":
        return "bg-slate-50 text-slate-600 border-slate-200/80";
      case "Medium":
        return "bg-amber-50/80 text-amber-700 border-amber-200/70";
      case "High":
        return "bg-rose-50/80 text-rose-700 border-rose-200/70 font-bold";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200/80";
    }
  };

  // Status style helper
  const getStatusStyle = (status: IssueStatusType) => {
    const s = String(status).toLowerCase();
    switch (s) {
      case "reported":
        return "bg-slate-50 text-slate-600 border-slate-200/80";
      case "acknowledged":
        return "bg-yellow-50/80 text-yellow-800 border-yellow-200/70";
      case "in progress":
        return "bg-blue-50/80 text-blue-700 border-blue-200/70";
      case "resolved":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/70";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200/80";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 flex flex-col items-center justify-center min-h-[300px] shadow-sm animate-pulse">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-600">Connecting to citizen registry...</p>
        <p className="text-xs text-slate-400 mt-1">Fetching live incident coordinates and verifying database sync...</p>
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-20 bg-white border border-slate-200 rounded-2xl p-8 max-w-sm mx-auto shadow-sm">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-100">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800">No Incidents Reported</h4>
        <p className="text-xs text-slate-400 mt-1 lines-clamp-3 leading-relaxed font-semibold">
          All systems operating normally. No civic hazards currently registered in your zone.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reports.map((report) => (
        <ReportCard
          key={report.id}
          report={report}
          users={users}
          currentUserId={currentUserId}
          onUpvoteToggle={onUpvoteToggle}
          onStatusChange={onStatusChange}
          getCategoryDetails={getCategoryDetails}
          renderCategoryIcon={renderCategoryIcon}
          getSeverityStyle={getSeverityStyle}
          getStatusStyle={getStatusStyle}
          formatDate={formatDate}
          verifications={verifications}
          onVerifyVote={onVerifyVote}
        />
      ))}
    </div>
  );
}

interface ReportCardProps {
  key?: string;
  report: CivicReport;
  users?: CivicUser[];
  currentUserId: string | undefined;
  onUpvoteToggle: (reportId: string) => void;
  onStatusChange: (reportId: string, newStatus: IssueStatusType) => void;
  getCategoryDetails: (catId: string) => { name: string; icon: string };
  renderCategoryIcon: (catId: string) => any;
  getSeverityStyle: (sev: SeverityType) => string;
  getStatusStyle: (status: IssueStatusType) => string;
  formatDate: (isoString: string) => string;
  verifications: Verification[];
  onVerifyVote: (reportId: string, voteType: "still_active" | "resolved") => void;
}

function ReportCard({
  report,
  users = [],
  currentUserId,
  onUpvoteToggle,
  onStatusChange,
  getCategoryDetails,
  renderCategoryIcon,
  getSeverityStyle,
  getStatusStyle,
  formatDate,
  verifications = [],
  onVerifyVote
}: ReportCardProps) {
  const [showLog, setShowLog] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  // Materialize photos from historical logs (arising from duplicate merges)
  const photos = Array.isArray(report.photoUrls) && report.photoUrls.length > 0
    ? report.photoUrls
    : [report.photoUrl].filter(Boolean);

  const [activePhotoIdx, setActivePhotoIdx] = useState(0);
  const activePhoto = photos[activePhotoIdx] || report.photoUrl;

  const cat = getCategoryDetails(report.category);
  const hasUpvoted = currentUserId ? report.upvotedBy?.includes(currentUserId) : false;

  const getSeverityBorderClass = (sev: SeverityType) => {
    switch (sev) {
      case "High": return "border-l-rose-500";
      case "Medium": return "border-l-amber-500";
      case "Low": return "border-l-emerald-500";
      default: return "border-l-slate-300";
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white rounded-2xl border border-slate-200 border-l-[6px] ${getSeverityBorderClass(report.severity)} overflow-hidden shadow-sm hover:border-indigo-300 hover:-translate-y-1 hover:shadow-lg transition-all duration-300`}
    >
      <div className="flex flex-col md:flex-row">
        {/* Photo Box */}
        <div className="md:w-1/4 relative aspect-[4/3] md:aspect-auto md:min-h-[190px] bg-slate-50 shrink-0 select-none">
          {activePhoto ? (
            <img 
              src={activePhoto} 
              alt={cat.name} 
              className="w-full h-full object-cover transition-all"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-300 bg-slate-50 italic text-xs">
              No image attached
            </div>
          )}
          <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[9px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-lg flex items-center gap-1 border border-white/10">
            {renderCategoryIcon(report.category)}
            {cat && typeof cat.name === 'string' ? cat.name.split(" / ")[0] : "Other"}
          </span>
          {report.severity === "High" && (
            <span className="absolute bottom-3 right-3 text-[9px] text-white px-2 py-0.5 bg-red-600 rounded-lg font-bold tracking-wider uppercase shadow-sm">
              Critical
            </span>
          )}

          {/* Multiple Photos Indicator Grid */}
          {photos.length > 1 && (
            <div className="absolute bottom-2 left-2 right-2 flex gap-1 justify-center bg-black/45 backdrop-blur-sm p-1 rounded-xl overflow-x-auto max-w-full">
              {photos.map((ph, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActivePhotoIdx(idx);
                  }}
                  className={`w-6 h-6 rounded overflow-hidden shrink-0 transition-all ${
                    activePhotoIdx === idx ? "ring-2 ring-indigo-500 scale-105" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={ph} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content Panel */}
        <div className="p-5 md:w-3/4 flex flex-col justify-between space-y-3.5">
          
          {/* Upper Metadata Row */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex gap-2">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getSeverityStyle(report.severity)}`}>
                  {report.severity} Priority
                </span>
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${getStatusStyle(report.status)}`}>
                  {report.status}
                </span>
              </div>

              <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3" />
                {formatDate(report.createdAt)}
              </span>
            </div>

            <h3 className="text-sm font-bold text-slate-800 leading-snug">
              {report.description}
            </h3>
          </div>

          {/* Location display */}
          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs text-slate-500 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate leading-normal font-medium">{report.location.address}</span>
          </div>

          {/* Emergency Escalation Banner */}
          {report.escalated && (
            <div className="bg-rose-50/70 border border-rose-100 p-3 rounded-xl flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping shrink-0" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600">
                  Priority Dispatch Agent Escalation
                </span>
              </div>
              {report.escalationReason && (
                <p className="text-[11px] text-rose-800 leading-normal italic font-medium">
                  "{report.escalationReason}"
                </p>
              )}
            </div>
          )}

          {/* AI Summary Section */}
          {report.aiSummary && (
            report.aiSummary === "AI analysis pending" ? (
              <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600">
                    AI Verification Status
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-normal italic font-medium">
                  AI analysis pending. System will re-inspect automatically on backend verification.
                </p>
                {(report.debugError || report.aiDebugError) && (
                  <div className="mt-2 pt-1.5 border-t border-amber-100 text-[9px] text-slate-500/85 font-mono break-all leading-normal whitespace-pre-wrap">
                    <span className="font-bold text-[8px] uppercase tracking-wide text-amber-600 mr-1">Diagnostics:</span>
                    {report.debugError || report.aiDebugError}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-indigo-50/40 border border-indigo-100/60 p-3 rounded-xl">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-pulse"></div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-600">
                    AI Verification Summary
                  </span>
                </div>
                <p className="text-[11px] text-indigo-900 leading-normal italic font-medium">
                  "{report.aiSummary}"
                </p>
              </div>
            )
          )}

          {/* AI Resolution Plan Section */}
          <div className="bg-slate-900 text-slate-100 p-3.5 rounded-xl border border-slate-800 space-y-2.5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
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
              <div className="space-y-2 text-xs">
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

          {/* Expandable Agent Reasoning Section */}
          {report.agentLog && (
            <div className="border-t border-slate-100 pt-2.5">
              <button
                type="button"
                onClick={() => setShowLog(!showLog)}
                className="flex items-center justify-between w-full text-[11px] text-indigo-600 font-bold hover:text-indigo-800 transition cursor-pointer select-none"
              >
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 animate-pulse" />
                  Nivaran Dispatch Routing Agent Reasoning
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-indigo-500 transition-transform duration-200 ${showLog ? "rotate-180" : ""}`} />
              </button>
              {showLog && (
                <div className="mt-2 text-[11px] bg-slate-50 border border-slate-100 p-3 rounded-xl text-slate-600 leading-relaxed font-sans whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {report.agentLog}
                </div>
              )}
            </div>
          )}

          {/* Verifications Box */}
          {report.status !== "resolved" ? (
            <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-slate-450 flex items-center gap-1.5 font-mono">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500 fill-indigo-100" /> Community Verification
                </span>
                <div className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-slate-500">
                  <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100">
                    Active: {verifications.filter((v) => v.issueId === report.id && v.vote === "still_active").length}
                  </span>
                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                    Resolved: {verifications.filter((v) => v.issueId === report.id && v.vote === "resolved").length} / 3
                  </span>
                </div>
              </div>

              {currentUserId === report.userId ? (
                <p className="text-[10px] text-slate-450 italic flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-350" />
                  You reported this. Verification is open to other residents.
                </p>
              ) : (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 leading-normal font-medium">
                    Please vouch if this is still active or resolved:
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onVerifyVote(report.id, "still_active")}
                      className={`flex-1 text-[10px] font-bold px-3 py-1.5 rounded-xl border transition duration-150 flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01] ${
                        verifications.find((v) => v.issueId === report.id && v.userId === currentUserId)?.vote === "still_active"
                          ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-amber-700 hover:bg-amber-50"
                      }`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      Still Active
                    </button>
                    <button
                      onClick={() => onVerifyVote(report.id, "resolved")}
                      className={`flex-1 text-[10px] font-bold px-3 py-1.5 rounded-xl border transition duration-150 flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01] ${
                        verifications.find((v) => v.issueId === report.id && v.userId === currentUserId)?.vote === "resolved"
                          ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                          : "bg-white border-slate-200 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Mark Resolved
                    </button>
                  </div>
                  {verifications.filter((v) => v.issueId === report.id && v.vote === "resolved").length > 0 &&
                    verifications.filter((v) => v.issueId === report.id && v.vote === "resolved").length < 3 && (
                      <p className="text-[9px] text-slate-400 font-semibold italic">
                        Requires {3 - verifications.filter((v) => v.issueId === report.id && v.vote === "resolved").length} more "resolved" vote(s) to automatically transition this ticket of state to Resolved.
                      </p>
                    )
                  }
                </div>
              )}
            </div>
          ) : (
            <div className="bg-emerald-50/50 border border-emerald-100/60 p-3 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 animate-bounce" />
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                Issue Confirmed Resolved by Community Consensus
              </span>
            </div>
          )}

          {/* Status History Timeline - Citizen Transparency Layer */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowTimeline(!showTimeline)}
              className="flex items-center justify-between w-full text-[11px] text-slate-500 font-bold hover:text-indigo-600 transition cursor-pointer select-none"
            >
              <span className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Citizen Transparency Log ({report.statusHistory?.length || 0} updates)
              </span>
              <span className="text-[10px] text-indigo-600 font-sans font-bold flex items-center gap-0.5">
                {showTimeline ? "Hide History" : "View Full Timeline"}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${showTimeline ? "rotate-180" : ""}`} />
              </span>
            </button>
            
            {showTimeline && (
              <div className="mt-2.5 bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-2.5 animate-fade-in">
                {!report.statusHistory || report.statusHistory.length === 0 ? (
                  <p className="text-[10px] text-slate-450 italic pl-1 font-semibold">
                    No status transitions logged yet. Current status: <span className="capitalize font-bold text-slate-600">{report.status}</span>.
                  </p>
                ) : (
                  <div className="relative pl-3.5 border-l-2 border-indigo-100 space-y-3.5 ml-1">
                    {report.statusHistory.map((history, idx) => {
                      const val = String(history.status).toLowerCase();
                      return (
                        <div key={idx} className="relative">
                          {/* Dot indicator */}
                          <span className="absolute -left-[19px] top-1.5 w-2 h-2 rounded-full bg-indigo-500 border border-white shadow-sm" />
                          <div className="text-[11px] leading-relaxed">
                            <span className="font-bold text-slate-800 capitalize mr-1.5">
                              {val}
                            </span>
                            <span className="text-slate-500 font-medium">
                              (by {history.changedBy}, {getRelativeTime(history.changedAt)})
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

          {/* Bottom Action bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-3">
            {/* Reported by profile */}
            <div className="flex items-center gap-1 text-[11px] text-slate-400 font-medium">
              <UserIcon className="w-3 h-3 text-slate-350" />
              <span>Reported by</span>
              <span className="font-bold text-slate-600 truncate max-w-[110px]" title={report.userName}>
                {report.userName || "Resident"}
              </span>
              {users.find((u) => u.userId === report.userId)?.points !== undefined && (
                <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-amber-200 shrink-0">
                  {users.find((u) => u.userId === report.userId)?.points} pts
                </span>
              )}
            </div>

            {/* Status Toggle / Actions */}
            <div className="flex items-center gap-2">
              {currentUserId ? (
                <div className="flex items-center gap-1 bg-slate-50 hover:bg-slate-100 border border-slate-205 rounded-xl px-2 py-0.5 transition">
                  <span className="text-[9px] uppercase font-bold text-slate-400">Status:</span>
                  <select
                    value={String(report.status).toLowerCase()}
                    onChange={(e) => onStatusChange(report.id, e.target.value as IssueStatusType)}
                    className="text-[11px] font-bold text-slate-700 bg-transparent focus:outline-none border-none py-1 pr-1.5 pl-0.5 cursor-pointer max-w-[110px]"
                  >
                    <option value="reported">Reported</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="in progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400 bg-slate-50/50 px-2 py-1.5 rounded-lg border border-slate-100">
                  <Lock className="w-3 h-3 text-slate-300" />
                  <span>Sign in to manage</span>
                </div>
              )}

              {/* Upvote triggers */}
              <button
                onClick={() => onUpvoteToggle(report.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  hasUpvoted
                    ? "bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                }`}
                title={currentUserId ? "Vote for dispatch priority" : "Sign in to upvote"}
              >
                <ThumbsUp className={`w-3.5 h-3.5 ${hasUpvoted ? "fill-indigo-100 text-indigo-600" : "text-slate-450"}`} />
                <span>{report.upvotes || 0}</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}
