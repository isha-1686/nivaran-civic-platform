import React, { useState, useEffect } from "react";
import { 
  Plus, 
  MapPin, 
  ShieldAlert, 
  Sparkles, 
  Filter, 
  Loader2, 
  Compass, 
  HelpCircle,
  ThumbsUp,
  Image as ImageIcon,
  MessageSquareCode,
  Trophy
} from "lucide-react";
import { 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  onSnapshot, 
  arrayUnion, 
  arrayRemove,
  increment,
  setDoc,
  query,
  where,
  getDocs,
  getDoc
} from "firebase/firestore";
import { 
  db, 
  auth, 
  signInWithGoogle, 
  logout, 
  onAuthStateChanged, 
  User,
  OperationType,
  handleFirestoreError
} from "./firebase";
import { CivicReport, CATEGORIES, SeverityType, IssueStatusType, Verification, CivicUser } from "./types";
import Header from "./components/Header";
import ReportForm from "./components/ReportForm";
import ReportList from "./components/ReportList";
import Dashboard from "./components/Dashboard";
import DispatchView from "./components/DispatchView";
import Leaderboard from "./components/Leaderboard";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [verifications, setVerifications] = useState<Verification[]>([]);
  const [users, setUsers] = useState<CivicUser[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  
  // Tab switcher
  const [activeTab, setActiveTab] = useState<"feed" | "analytics" | "dispatch" | "leaderboard">("feed");

  // Dialog showing form toggle
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filters & Sorting states
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("All");
  const [selectedSeverityFilter, setSelectedSeverityFilter] = useState<string>("All");
  const [sortBy, setSortBy] = useState<"newest" | "upvotes" | "severity">("newest");

  // Error/Info banner states
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Show a temporary message
  const triggerToast = (text: string, type: "success" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
    });
    return () => unsubscribe();
  }, []);

  // Listen to Firestore operation errors and display them as visible toasts immediately
  useEffect(() => {
    const handleErrEvent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        triggerToast(`[Firestore error: ${detail.code}] ${detail.message}`, "error");
      }
    };
    window.addEventListener('firestore-operation-error', handleErrEvent);
    return () => window.removeEventListener('firestore-operation-error', handleErrEvent);
  }, []);

  // Real-time Firestore Sync with Client-side Sorting (Resilient against Index Lag)
  useEffect(() => {
    setIsLoadingReports(true);
    try {
      const reportsCollection = collection(db, "reports");
      const unsubscribe = onSnapshot(
        reportsCollection, 
        (snapshot) => {
          const fetched: CivicReport[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            fetched.push({
              id: docSnap.id,
              ...data,
              userId: data.userId || "",
              userName: data.userName || "Citizen",
              userEmail: data.userEmail || "",
              photoUrl: data.photoUrl || "",
              description: data.description || "",
              location: data.location || { lat: 0, lng: 0, address: "Unknown location" },
              category: data.category || "other",
              severity: data.severity || "Medium",
              status: data.status || "reported",
              upvotes: data.upvotes || 0,
              upvotedBy: data.upvotedBy || [],
              createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString()),
              statusHistory: data.statusHistory || [],
              escalated: data.escalated || false,
              photoUrls: data.photoUrls || [],
              resolutionPlan: data.resolutionPlan || null,
            } as CivicReport);
          });
          setReports(fetched);
          setIsLoadingReports(false);
        },
        (error) => {
          setIsLoadingReports(false);
          handleFirestoreError(error, OperationType.GET, "reports");
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to establish reports stream:", err);
      setIsLoadingReports(false);
    }
  }, []);

  // Real-time Firestore Sync for Verifications
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isSubscribed = true;
    let retryCount = 0;
    const maxRetries = 3;

    function setupStream() {
      try {
        const verificationsCollection = collection(db, "verifications");
        unsubscribe = onSnapshot(
          verificationsCollection,
          (snapshot) => {
            if (!isSubscribed) return;
            const fetched: Verification[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              fetched.push({
                id: docSnap.id,
                issueId: data.issueId || "",
                userId: data.userId || "",
                vote: data.vote || "still_active",
                createdAt: data.createdAt || new Date().toISOString()
              });
            });
            setVerifications(fetched);
          },
          (error) => {
            if (!isSubscribed) return;
            console.warn("Verifications stream subscription encountered an error:", error);
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`Retrying verifications subscription in 4s (attempt ${retryCount}/${maxRetries})...`);
              setTimeout(() => {
                if (isSubscribed) setupStream();
              }, 4000);
            } else {
              handleFirestoreError(error, OperationType.GET, "verifications");
            }
          }
        );
      } catch (err) {
        console.error("Failed to establish verifications stream:", err);
      }
    }

    setupStream();

    return () => {
      isSubscribed = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Real-time Firestore Sync for User Points Leaderboard
  useEffect(() => {
    try {
      const usersCollection = collection(db, "users");
      const unsubscribe = onSnapshot(
        usersCollection,
        (snapshot) => {
          const fetched: CivicUser[] = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            fetched.push({
              userId: docSnap.id,
              userName: data.userName || "Anonymous Citizen",
              points: data.points || 0,
            });
          });
          setUsers(fetched);
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, "users");
        }
      );
      return () => unsubscribe();
    } catch (err) {
      console.error("Failed to establish users stream:", err);
    }
  }, []);

  // Handle Google Login popup
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      await signInWithGoogle();
      triggerToast("Signed in securely via Google Account!");
    } catch (err: any) {
      console.error(err);
      triggerToast("Sign-in process cancelled or interrupted.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Handle Sign out
  const handleLogout = async () => {
    try {
      await logout();
      triggerToast("Logged out successfully.");
    } catch (err) {
      triggerToast("Failed to sign out.", "error");
    }
  };

  // Handle Guest Login simulation
  const handleGuestLogin = () => {
    const guestUser = {
      uid: "guest-resident-101",
      displayName: "Guest Resident",
      email: "guest@nivaran.gov",
      photoURL: null,
      isAnonymous: true
    };
    setUser(guestUser as any);
    triggerToast("Logged in securely as Guest Resident!");
  };

  // Upvote report logic
  const handleUpvoteToggle = async (reportId: string) => {
    if (!user) {
      triggerToast("Please sign in to vote on priorities.", "error");
      return;
    }

    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    const reportRef = doc(db, "reports", reportId);
    const userId = user.uid;
    const hasAlreadyUpvoted = report.upvotedBy?.includes(userId);

    try {
      if (hasAlreadyUpvoted) {
        // Remove vote
        await updateDoc(reportRef, {
          upvotedBy: arrayRemove(userId),
          upvotes: increment(-1)
        });
        triggerToast("Removed your priority recommendation vote.");
      } else {
        // Add vote
        await updateDoc(reportRef, {
          upvotedBy: arrayUnion(userId),
          upvotes: increment(1)
        });
        triggerToast("Upvoted! Municipal dispatch notified of urgency.");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  // Award civic points helper
  const awardCivicPoints = async (reporterId: string, reporterName: string) => {
    if (!reporterId) return;
    try {
      const userRef = doc(db, "users", reporterId);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        await updateDoc(userRef, {
          points: increment(10)
        });
      } else {
        await setDoc(userRef, {
          userId: reporterId,
          userName: reporterName || "Anonymous Citizen",
          points: 10
        });
      }
    } catch (err: any) {
      console.error("Error awarding civic points detailed catch:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${reporterId}`);
      triggerToast(`Civic Points Award Failure: ${err?.message || String(err)}`, "error");
    }
  };

  // Status Change logic
  const handleStatusChange = async (reportId: string, newStatus: IssueStatusType) => {
    if (!user) {
      triggerToast("Please sign in to change ticket statuses.", "error");
      return;
    }

    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    try {
      const reportRef = doc(db, "reports", reportId);
      const newHistoryEntry = {
        status: newStatus,
        changedBy: user.displayName || user.email || "Anonymous Citizen",
        changedAt: new Date().toISOString()
      };
      await updateDoc(reportRef, {
        status: newStatus,
        statusHistory: arrayUnion(newHistoryEntry)
      });

      // Award civic points if changed to resolved and previously was not resolved
      if (newStatus.toLowerCase() === "resolved" && report.status.toLowerCase() !== "resolved") {
        await awardCivicPoints(report.userId, report.userName);
      }

      triggerToast(`Status updated to "${newStatus}"!`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    }
  };

  // Handle registering a community verification vote
  const handleVerificationVote = async (reportId: string, voteType: "still_active" | "resolved") => {
    if (!user) {
      triggerToast("Please sign in utilizing the top menu button to verify incidents.", "error");
      return;
    }

    const report = reports.find((r) => r.id === reportId);
    if (!report) return;

    if (report.userId === user.uid) {
      triggerToast("Original reporter cannot verify their own reported incident.", "error");
      return;
    }

    const verificationDocId = `${reportId}_${user.uid}`;
    const verificationRef = doc(db, "verifications", verificationDocId);

    try {
      await setDoc(verificationRef, {
        issueId: reportId,
        userId: user.uid,
        vote: voteType,
        createdAt: new Date().toISOString()
      });

      triggerToast(`Your verification vote ("${voteType === "still_active" ? "still active" : "resolved"}") was submitted securely!`);

      // Count resolved verifications across Firestore for this issue
      const q = query(
        collection(db, "verifications"), 
        where("issueId", "==", reportId)
      );
      const qSnap = await getDocs(q);
      
      let resolvedCount = 0;
      qSnap.forEach((d) => {
        if (d.data().vote === "resolved") {
          resolvedCount++;
        }
      });

      // If issue gets 3+ resolved votes, update status
      if (resolvedCount >= 3 && report.status !== "resolved") {
        const reportRef = doc(db, "reports", reportId);
        const newHistoryEntry = {
          status: "resolved",
          changedBy: "Community Consensus",
          changedAt: new Date().toISOString()
        };
        await updateDoc(reportRef, {
          status: "resolved",
          statusHistory: arrayUnion(newHistoryEntry)
        });

        // Award points to original reporter
        await awardCivicPoints(report.userId, report.userName);

        triggerToast("Incident has received 3+ community 'resolved' votes! Transitioning status to Resolved automatically.");
      }

    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `verifications/${verificationDocId}`);
    }
  };

  // Create report document in Firestore via Secure Agent Backend
  const handleCreateReport = async (
    reportData: Omit<CivicReport, "id" | "userId" | "userName" | "userEmail" | "upvotes" | "upvotedBy" | "status" | "createdAt">,
    forceNew?: boolean,
    confirmDuplicateId?: string
  ) => {
    if (!user) {
      throw new Error("You must be logged in to submit a ticket.");
    }

    try {
      const response = await fetch("/api/submit-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: reportData.description,
          photo: reportData.photoUrl,
          category: reportData.category,
          severity: reportData.severity,
          location: reportData.location,
          user: {
            uid: user.uid,
            displayName: user?.displayName || "Anonymous Citizen",
            email: user?.email || ""
          },
          forceNew,
          confirmDuplicateId
        })
      });

      if (!response.ok) {
        let errMsg = `Server failed submission with code ${response.status}`;
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errJson = await response.json();
            errMsg = errJson.error || errMsg;
          } else {
            const text = await response.text();
            if (text.includes("<!DOCTYPE") || text.includes("<!doctype")) {
              errMsg = `API route returned HTML instead of JSON. This usually indicates the server route is not configured or the backend crashed. (Status: ${response.status})`;
            } else {
              errMsg = text.slice(0, 200) || errMsg;
            }
          }
        } catch (e) {
          // ignore parsing error
        }
        throw new Error(errMsg);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const resData = await response.json();
        
        if (resData.requiresConfirmation) {
          return resData;
        }

        if (resData.isDuplicate) {
          triggerToast("Identified duplicate! Upvote & photo added to original incident ticket.", "success");
        } else {
          triggerToast("Incident report filed successfully!", "success");
        }
        return resData;
      } else {
        const text = await response.text();
        if (text.includes("<!DOCTYPE") || text.includes("<!doctype")) {
          throw new Error("API route returned HTML instead of JSON. Please check server start/routing configuration.");
        } else {
          throw new Error(`Expected JSON response but received: ${text.slice(0, 100)}`);
        }
      }
    } catch (err: any) {
      console.error("Submission failed:", err);
      triggerToast(err.message || "Failed to submit report. Please try again.", "error");
      throw err;
    }
  };

  // Compute final reports list after applying filter + sort
  const filteredAndSortedReports = reports
    .filter((report) => {
      // Filter by category
      if (selectedCategoryFilter !== "All" && report.category !== selectedCategoryFilter) {
        return false;
      }
      // Filter by severity
      if (selectedSeverityFilter !== "All" && report.severity !== selectedSeverityFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "upvotes") {
        return (b.upvotes || 0) - (a.upvotes || 0);
      }
      if (sortBy === "severity") {
        const severityScores = { Low: 1, Medium: 2, High: 3 };
        return severityScores[b.severity] - severityScores[a.severity];
      }
      // "newest" sorting fallback
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Hero section real data computation
  const realReports = reports
    .filter((r: any) => !r.isSeedData)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);

  let totalDispatchMs = 0;
  let dispatchCount = 0;
  reports.filter((r: any) => !r.isSeedData && String(r.status).toLowerCase() === "resolved" && r.statusHistory && r.statusHistory.length > 0)
    .forEach(r => {
      const resolvedState = r.statusHistory.find(h => String(h.status).toLowerCase() === "resolved");
      if (resolvedState && r.createdAt) {
        const diff = new Date(resolvedState.changedAt).getTime() - new Date(r.createdAt).getTime();
        if (diff > 0) {
          totalDispatchMs += diff;
          dispatchCount++;
        }
      }
    });
  const avgDispatchTimeMins = dispatchCount > 0 ? Math.round(totalDispatchMs / dispatchCount / 60000) : null;
  const avgDispatchText = avgDispatchTimeMins !== null 
    ? `Avg Resolution: ${avgDispatchTimeMins > 60 ? `${Math.floor(avgDispatchTimeMins/60)}h ${avgDispatchTimeMins%60}m` : `${avgDispatchTimeMins}m`}`
    : null;

  return (
    <div className="min-h-screen bg-slate-50/60 pb-16 antialiased selection:bg-indigo-100 text-slate-800">
      
      {/* Toast Alert System */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className={`px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-2.5 font-bold text-xs ${
            toastMessage.type === "success" 
              ? "bg-slate-900 border-slate-800 text-white" 
              : "bg-rose-600 border-rose-500 text-white"
          }`}>
            <Sparkles className="w-4 h-4 text-indigo-400 fill-indigo-400 shrink-0 animate-pulse" />
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header bar */}
      <Header 
        user={user} 
        points={user ? users.find((u) => u.userId === user.uid)?.points : undefined}
        onLogin={handleGoogleLogin} 
        onLogout={handleLogout}
        onGuestLogin={handleGuestLogin}
        isLoggingIn={isLoggingIn}
      />

      {/* Hero Visual Area */}
      <div className="bg-slate-950 text-white min-h-[calc(100vh-4rem)] relative overflow-hidden flex items-center justify-center py-12 md:py-16">
        {/* Background image & gradient overlays */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <img
            src="https://images.unsplash.com/photo-1477959858617-67f30bc4d394?auto=format&fit=crop&w=2000&q=80"
            alt="Civic infrastructure background"
            className="w-full h-full object-cover object-center opacity-30 scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/95 to-slate-950/70" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/85" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-25" />
          <div className="absolute -top-24 right-1/4 w-[500px] h-[500px] bg-indigo-500/15 rounded-full blur-[160px]" />
          <div className="absolute -bottom-24 left-1/3 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[140px]" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full my-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full border border-indigo-400/20 mb-4 font-mono">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Civic Dispatch Portal
              </span>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5.55xl font-extrabold tracking-tight leading-tight text-white font-sans">
                Connect local issues to <span className="text-indigo-400 relative">AI & Municipal Action</span>
              </h1>
              <p className="mt-6 text-base sm:text-lg md:text-xl text-slate-200 max-w-2xl leading-relaxed font-semibold">
                Report potholes, garbage, streetlights, or water leaks instantly. Nivaran analyzes reports with smart heuristics, gauges urgency levels, and dispatches civic managers.
              </p>
              
              {/* Quick action buttons */}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    if (!user) {
                      triggerToast("Please sign in first utilizing the Google option.", "error");
                      handleGoogleLogin();
                    } else {
                      setActiveTab("feed");
                      setIsFormOpen(true);
                    }
                  }}
                  className="px-5.5 py-3.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-lg shadow-indigo-600/15 duration-100 hover:scale-[1.01] cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" /> Report Local Incident
                </button>
                
                <button
                  onClick={() => {
                    setActiveTab("feed");
                    document.getElementById("portal-main-stage")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-5.5 py-3.5 bg-slate-900 hover:bg-slate-850 text-white hover:text-slate-100 transition duration-100 font-bold text-xs rounded-xl flex items-center gap-2 border border-slate-800 cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-slate-400" /> Explore Public Feed
                </button>

                <button
                  onClick={() => {
                    setActiveTab("analytics");
                    document.getElementById("portal-main-stage")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="px-5.5 py-3.5 bg-indigo-950/40 hover:bg-indigo-900/40 text-indigo-300 font-bold text-xs rounded-xl flex items-center gap-2 border border-indigo-850/30 hover:border-indigo-700/50 transition duration-150 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-indigo-400" /> View District Analytics
                </button>
              </div>
            </div>

            {/* Alongside illustration / live dispatch card */}
            <div className="mt-12 lg:mt-0 flex justify-center items-center lg:col-span-5 w-full">
              <div className="relative w-full max-w-md pointer-events-none select-none">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-3xl blur-xl opacity-30 animate-pulse" />
                <div className="relative bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl p-6 shadow-2xl overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-400">AI Civic Dispatch Live</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-1 rounded">LIVE FEED</span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {realReports.length > 0 ? (
                      realReports.map(report => (
                        <div key={report.id} className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-3.5 flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 mt-0.5 border ${
                            report.severity === 'High' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 
                            report.severity === 'Medium' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 
                            'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                          }`}>
                            {report.severity === 'High' ? <ShieldAlert className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-slate-200 truncate">
                                {(report.description || "").length > 35 ? (report.description || "").substring(0, 35) + '...' : (report.description || "No description")}
                              </span>
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${
                                String(report.status || "").toLowerCase() === 'resolved' ? 'bg-emerald-500/20 text-emerald-300' : 
                                String(report.status || "").toLowerCase() === 'in progress' ? 'bg-blue-500/20 text-blue-300' : 
                                'bg-rose-500/20 text-rose-300'
                              }`}>
                                {String(report.status || "REPORTED").toUpperCase()}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 mt-1 truncate">
                              {report.location?.address ? report.location.address.split(',')[0] : 'Unknown Location'} • {report.category?.split(' / ')[0] || 'Uncategorized'}
                            </p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-slate-950/60 border border-slate-800/60 rounded-xl p-6 flex flex-col items-center justify-center text-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-400/50" />
                        <span className="text-xs font-bold text-slate-300">No active incidents</span>
                        <p className="text-[10px] text-slate-400">Be the first to report an issue in your area</p>
                      </div>
                    )}
                  </div>
                  {avgDispatchText && (
                    <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>{avgDispatchText}</span>
                      <span className="text-indigo-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Auto-Routed</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <main id="portal-main-stage" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-10">
        
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 mb-8 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("feed")}
            className={`pb-4 px-6 font-bold text-xs tracking-wider uppercase border-b-2 transition duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "feed"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Compass className="w-4 h-4" /> Public Incident Feed
          </button>
          
          <button
            onClick={() => setActiveTab("analytics")}
            className={`pb-4 px-6 font-bold text-xs tracking-wider uppercase border-b-2 transition duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "analytics"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Sparkles className="w-4 h-4" /> District Analytics Dashboard
          </button>

          {user && (
            <button
              onClick={() => setActiveTab("dispatch")}
              className={`pb-4 px-6 font-bold text-xs tracking-wider uppercase border-b-2 transition duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
                activeTab === "dispatch"
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <ShieldAlert className="w-4 h-4" /> Operator Dispatch View
            </button>
          )}

          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`pb-4 px-6 font-bold text-xs tracking-wider uppercase border-b-2 transition duration-150 cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === "leaderboard"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Trophy className="w-4 h-4 text-amber-500" /> Leaderboard
          </button>
        </div>

        {/* Dynamic Add / Form Section */}
        {isFormOpen && (
          <div className="mb-10 animate-fade-in">
            <ReportForm 
              user={user}
              onLoginRequest={handleGoogleLogin}
              onSubmitReport={handleCreateReport}
              onClose={() => setIsFormOpen(false)}
            />
          </div>
        )}

        {activeTab === "feed" ? (
          <>
            {/* Dashboard Tools & Feed Header */}
            <div id="reported-feed" className="bg-white rounded-2xl border border-slate-200/80 p-5.5 shadow-sm space-y-4.5 mb-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
                    Citizen Dispatch Incident Feed
                    <span className="bg-indigo-50 text-indigo-700 text-xs px-2.5 py-0.5 rounded-full font-bold border border-indigo-100/50">
                      {filteredAndSortedReports.length} Active
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">Real-time reported issues across civic district parameters</p>
                </div>

                {/* Quick Report Add Trigger (visible when form is closed) */}
                {!isFormOpen && (
                  <button
                    onClick={() => {
                      if (!user) {
                        triggerToast("Sign in first utilizing the top menu button.", "error");
                        handleGoogleLogin();
                      } else {
                        setIsFormOpen(true);
                      }
                    }}
                    className="self-start md:self-center bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-[1.01] active:scale-100 px-4 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 transition duration-150 shadow-md shadow-indigo-100 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> File New Incident
                  </button>
                )}
              </div>

              <hr className="border-slate-100" />

              {/* Filtering Layout */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-slate-600">
                {/* Category Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Category:</span>
                  <div className="flex gap-1 flex-wrap">
                    <button
                      onClick={() => setSelectedCategoryFilter("All")}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition duration-150 cursor-pointer ${
                        selectedCategoryFilter === "All"
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      All
                    </button>
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategoryFilter(cat.id)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition duration-150 cursor-pointer ${
                          selectedCategoryFilter === cat.id
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {cat.name.split(" / ")[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="hidden lg:block w-px h-6 bg-slate-200"></div>

                {/* Severity Filter */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Severity:</span>
                  <div className="flex gap-1 flex-wrap">
                    {["All", "Low", "Medium", "High"].map((level) => (
                      <button
                        key={level}
                        onClick={() => setSelectedSeverityFilter(level)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition duration-150 cursor-pointer ${
                          selectedSeverityFilter === level
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="hidden lg:block w-px h-6 bg-slate-200"></div>

                {/* Sorting controls */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">Sort By:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-3.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-slate-350 font-bold"
                  >
                    <option value="newest">Newest First</option>
                    <option value="upvotes">Priority Votes</option>
                    <option value="severity">Hazard Severity</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Real-time reports stream */}
            <ReportList 
              reports={filteredAndSortedReports}
              users={users}
              currentUserId={user?.uid}
              onUpvoteToggle={handleUpvoteToggle}
              onStatusChange={handleStatusChange}
              isLoading={isLoadingReports}
              verifications={verifications}
              onVerifyVote={handleVerificationVote}
            />
          </>
        ) : activeTab === "analytics" ? (
          <Dashboard />
        ) : activeTab === "leaderboard" ? (
          <Leaderboard users={users} currentUserId={user?.uid} />
        ) : (
          <DispatchView 
            reports={reports}
            currentUserId={user?.uid}
            onStatusChange={handleStatusChange}
          />
        )}

      </main>

    </div>
  );
}
