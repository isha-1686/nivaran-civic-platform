import React, { useState, useRef } from "react";
import { 
  Camera, 
  MapPin, 
  Loader2, 
  AlertTriangle, 
  Check, 
  X, 
  Trash, 
  Sparkles,
  RefreshCw
} from "lucide-react";
import { CATEGORIES, SeverityType, CivicReport } from "../types";
import { User } from "../firebase";
import { motion } from "motion/react";

interface ReportFormProps {
  user: User | null;
  onLoginRequest: () => void;
  onSubmitReport: (
    reportData: Omit<CivicReport, "id" | "userId" | "userName" | "userEmail" | "upvotes" | "upvotedBy" | "status" | "createdAt">,
    forceNew?: boolean,
    confirmDuplicateId?: string
  ) => Promise<any>;
  onClose: () => void;
}

export default function ReportForm({ user, onLoginRequest, onSubmitReport, onClose }: ReportFormProps) {
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("pothole");
  const [severity, setSeverity] = useState<SeverityType>("Medium");
  
  // Photo states
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [isPhotoLoading, setIsPhotoLoading] = useState(false);
  
  // Duplicate check states
  const [duplicateCandidate, setDuplicateCandidate] = useState<any>(null);
  
  // Location states
  const [latitude, setLatitude] = useState<number>(0);
  const [longitude, setLongitude] = useState<number>(0);
  const [address, setAddress] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  // Form submitting state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle image attachment + direct browser canvas rendering compression
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith("image/")) {
      setErrorText("Please upload an image file");
      return;
    }

    setIsPhotoLoading(true);
    setErrorText(null);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        // Client-side resizing canvas helper
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 900;
        const MAX_HEIGHT = 675;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Compress quality slightly to save DB size, keeping elegant visual representation
        const base64Data = canvas.toDataURL("image/jpeg", 0.7);
        setPhotoBase64(base64Data);
        setIsPhotoLoading(false);
      };
      
      img.onerror = () => {
        setErrorText("Failed to process image.");
        setIsPhotoLoading(false);
      };
    };

    reader.onerror = () => {
      setErrorText("Error reading file.");
      setIsPhotoLoading(false);
    };
  };

  // Browser geolocation detection
  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setErrorText("Geolocation is not supported by your browser");
      return;
    }

    setIsDetectingLocation(true);
    setErrorText(null);

    try {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setLatitude(lat);
          setLongitude(lng);

          let defaultAddress = `Coords: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
          setAddress(defaultAddress);

          try {
            // Fetch reverse geocoded address using OpenStreetMap Nominatim
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`
            );
            if (res.ok) {
              const data = await res.json();
              if (data && data.display_name) {
                setAddress(data.display_name);
              }
            }
          } catch (err) {
            console.warn("Could not geocode location, using coordinates string directly", err);
          } finally {
            setIsDetectingLocation(false);
          }
        },
        (err) => {
          console.warn("Geolocation permission error or timeout", err);
          setErrorText("Could not detect location automatically. Please enter your address manually below.");
          setIsDetectingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } catch (err: any) {
      console.warn("Geolocation invocation failed synchronously", err);
      setErrorText("Could not access browser geolocation API: " + (err?.message || String(err)));
      setIsDetectingLocation(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);

    if (!user) {
      setErrorText("Please sign in to submit a ticket.");
      return;
    }

    if (!photoBase64) {
      setErrorText("Please take or upload a photo of the issue.");
      return;
    }

    if (!description.trim() || description.length < 10) {
      setErrorText("Please describe the issue with at least 10 characters.");
      return;
    }

    if (!address.trim()) {
      setErrorText("Please provide an address or detect current location.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await onSubmitReport({
        photoUrl: photoBase64 || "",
        description: description.trim(),
        location: {
          lat: latitude,
          lng: longitude,
          address: address.trim()
        },
        category: category,
        severity: severity,
      }, false, undefined);

      if (response && response.requiresConfirmation && response.duplicateCandidate) {
        setDuplicateCandidate(response.duplicateCandidate);
        return;
      }

      // Clear states on success
      setDescription("");
      setPhotoBase64(null);
      setLatitude(0);
      setLongitude(0);
      setAddress("");
      onClose();
    } catch (err: any) {
      setErrorText(err.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateChoice = async (isDuplicate: boolean) => {
    if (!duplicateCandidate) return;
    setErrorText(null);
    setIsSubmitting(true);

    try {
      await onSubmitReport({
        photoUrl: photoBase64 || "",
        description: description.trim(),
        location: {
          lat: latitude,
          lng: longitude,
          address: address.trim()
        },
        category: category,
        severity: severity,
      }, !isDuplicate, isDuplicate ? duplicateCandidate.id : undefined);

      // Clear states on success
      setDescription("");
      setPhotoBase64(null);
      setLatitude(0);
      setLongitude(0);
      setAddress("");
      setDuplicateCandidate(null);
      onClose();
    } catch (err: any) {
      setErrorText(err.message || "Failed to process duplicate choice.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-w-2xl mx-auto">
      {/* Form Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4.5 flex items-center justify-between text-slate-800">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-slate-900">Report New Civic Issue</h3>
          <p className="text-xs text-slate-400 font-medium">Submit an incident report for municipal dispatch</p>
        </div>
        <button 
          onClick={onClose}
          type="button"
          className="text-slate-400 hover:text-slate-600 transition-colors bg-slate-50 hover:bg-slate-100 p-1.5 rounded-xl border border-slate-100"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {!user ? (
        <div className="p-8 text-center bg-slate-50/50">
          <AlertTriangle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h4 className="text-base font-bold text-slate-800">Authentication Required</h4>
          <p className="text-sm text-slate-500 mt-2 max-w-sm mx-auto font-medium leading-relaxed">
            Each citizen report matches are indexed by identity to prevent duplicate or malicious ticket spamming.
          </p>
          <button
            type="button"
            onClick={onLoginRequest}
            className="mt-6 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-850 text-white font-bold rounded-xl text-xs transition shadow-md shadow-indigo-100 cursor-pointer"
          >
            Sign in with Google to Continue
          </button>
        </div>
      ) : duplicateCandidate ? (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="p-6 bg-slate-50/50 flex flex-col items-center"
        >
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h4 className="text-lg font-bold text-slate-900 text-center">Similar Issue Found Nearby</h4>
          <p className="text-sm text-slate-500 text-center mt-2 max-w-md">
            Our AI detected a matching unresolved report just <span className="font-bold text-slate-700">{duplicateCandidate.distance}m</span> away.
          </p>
          
          <div className="w-full mt-6 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex gap-4">
              {duplicateCandidate.photoUrl && (
                <img 
                  src={duplicateCandidate.photoUrl} 
                  alt="Existing issue" 
                  className="w-24 h-24 object-cover rounded-lg shrink-0 border border-slate-100"
                />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-400 mb-1">EXISTING REPORT</p>
                <p className="text-sm font-semibold text-slate-800 line-clamp-2 leading-snug">
                  {duplicateCandidate.description}
                </p>
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  Reported {new Date(duplicateCandidate.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          
          {errorText && (
            <div className="w-full mt-4 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs p-3.5 rounded-r-xl flex gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-6">
            <button
              onClick={() => handleDuplicateChoice(false)}
              disabled={isSubmitting}
              className="px-4 py-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              This is a different issue
            </button>
            <button
              onClick={() => handleDuplicateChoice(true)}
              disabled={isSubmitting}
              className="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-805 text-white text-sm font-bold rounded-xl transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-indigo-100/50"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Same issue, add evidence
            </button>
          </div>
        </motion.div>
      ) : (
        <form onSubmit={handleFormSubmit} className="p-6 space-y-5 bg-white">
          {errorText && (
            <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs p-3.5 rounded-r-xl flex gap-1.5 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorText}</span>
            </div>
          )}

          {/* Photo Section */}
          <div>
            <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
              Incident Photo <span className="text-rose-500">*</span>
            </label>
            
            {photoBase64 ? (
              <div className="relative group rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                <img 
                  src={photoBase64} 
                  alt="Incident capture" 
                  className="w-full aspect-video object-cover bg-slate-55"
                />
                <button
                  type="button"
                  onClick={() => setPhotoBase64(null)}
                  className="absolute top-3 right-3 bg-red-650 hover:bg-red-700 text-white p-2 rounded-xl transition duration-150 shadow-md flex items-center gap-1.5 text-xs font-extrabold"
                >
                  <Trash className="w-3.5 h-3.5" /> Retake Photo
                </button>
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-indigo-300 rounded-xl p-8 text-center cursor-pointer bg-slate-50/50 hover:bg-indigo-50/10 transition duration-150 flex flex-col items-center justify-center aspect-video relative"
              >
                {isPhotoLoading ? (
                  <>
                    <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mb-3" />
                    <p className="text-sm font-semibold text-slate-700">Processing image evidence...</p>
                    <p className="text-xs text-slate-400 mt-1">Compressing payload...</p>
                  </>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-full border border-slate-100 shadow-sm mb-3 text-slate-450">
                      <Camera className="w-6 h-6 text-slate-505" />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Click to upload or drag photo</span>
                    <p className="text-[10px] text-slate-400 mt-1">Attach image evidencing the issue</p>
                  </>
                )}
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handlePhotoChange}
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Details Row: Category & Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                Category & Classification <span className="text-rose-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white text-slate-700 font-medium"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
                Severity Level
              </label>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-205">
                {(["Low", "Medium", "High"] as SeverityType[]).map((level) => {
                  const isActive = severity === level;
                  const activeColorMap = {
                    Low: "bg-white text-emerald-700 border-slate-200/80 shadow-xs",
                    Medium: "bg-white text-amber-700 border-slate-200/80 shadow-xs",
                    High: "bg-white text-rose-700 border-slate-200/80 shadow-xs animate-none",
                  };
                  return (
                    <button
                      type="button"
                      key={level}
                      onClick={() => setSeverity(level)}
                      className={`py-2 text-[11px] font-bold rounded-lg border text-center transition-all ${
                        isActive 
                          ? `${activeColorMap[level]} border`
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase mb-1.5">
              Incident Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail (min 10 characters)..."
              maxLength={500}
              className="w-full bg-slate-50 border border-slate-250 rounded-xl px-3.5 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white text-slate-700 h-24 resize-none"
            />
            <div className="flex justify-between mt-1 font-medium text-[10px] text-slate-405">
              <span>Ensure accurate details are specified</span>
              <span>{description.length}/500</span>
            </div>
          </div>

          {/* Location Capture Area */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-400 tracking-wide uppercase">
                Location or Address <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleDetectLocation}
                disabled={isDetectingLocation}
                className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-bold transition disabled:opacity-50"
              >
                {isDetectingLocation ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Detecting GPS...
                  </>
                ) : (
                  <>
                    <MapPin className="w-3.5 h-3.5" />
                    Detect Coordinates
                  </>
                )}
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Enter postal address or closest manual landmark..."
                className="w-full bg-slate-50 border border-slate-250 rounded-xl pl-3.5 pr-10 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white text-slate-700"
              />
              <div className="absolute right-3.5 top-3 text-indigo-600">
                <MapPin className="w-4 h-4 shrink-0" />
              </div>
            </div>
            
            {latitude !== 0 && longitude !== 0 && (
              <p className="text-[10px] text-slate-400 font-medium mt-1.5 flex items-center gap-1.5">
                📍 Coordinates matched: <span className="font-mono bg-slate-50 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md font-bold">{latitude.toFixed(6)}° N, {longitude.toFixed(6)}° E</span>
              </p>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-50">
            <button
              onClick={onClose}
              type="button"
              className="px-5 py-3 hover:bg-slate-50 text-slate-650 text-xs font-extrabold rounded-xl transition cursor-pointer border border-transparent hover:border-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-805 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2 shadow-lg shadow-indigo-100/80 active:scale-98 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Generating AI report...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                  Submit Report
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
