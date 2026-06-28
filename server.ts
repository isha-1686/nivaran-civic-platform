import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function generateWithFallback(ai: GoogleGenAI, options: { contents: any; config?: any }) {
  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "gemini-2.5-flash",
    "gemini-flash-latest"
  ];
  let lastError: any = null;
  for (const modelName of modelsToTry) {
    try {
      console.log(`[Nivaran AI Helper] Attempting generation with model: ${modelName}`);
      const response = await ai.models.generateContent({
        model: modelName,
        contents: options.contents,
        config: options.config,
      });
      if (response) {
        console.log(`[Nivaran AI Helper] Successfully resolved generation using model: ${modelName}`);
        return response;
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Nivaran AI Helper] Model '${modelName}' failed: ${err.message || err}`);
    }
  }
  throw lastError || new Error("All requested Gemini models failed.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing for JSON payloads
  app.use(express.json({ limit: "10mb" }));

  // API Route: Get aggregated counts for dashboard and call Gemini for natural-language insight
  app.get("/api/dashboard-insight", async (req, res) => {
    try {
      const fsConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (!fs.existsSync(fsConfigPath)) {
        return res.json({
          categoryCounts: {},
          areaCounts: {},
          trendInsight: "Firebase config not found. Please set up Firebase first.",
          usingAllTime: false,
          totalReports: 0
        });
      }

      const fsConfig = JSON.parse(fs.readFileSync(fsConfigPath, "utf-8"));
      const { initializeApp: initFb, getApps: getFbApps } = await import("firebase/app");
      const { getFirestore: initFs, collection: fsCol, getDocs: fsGet } = await import("firebase/firestore");

      const fbApp = getFbApps().length === 0 ? initFb(fsConfig) : getFbApps()[0];
      const db = initFs(fbApp, fsConfig.firestoreDatabaseId || "default");

      // Retrieve all records to filter locally
      const reportsCol = fsCol(db, "reports");
      const querySnapshot = await fsGet(reportsCol);
      const allReports: any[] = [];
      querySnapshot.forEach((d) => {
        allReports.push({ id: d.id, ...d.data() });
      });

      const extractArea = (address: string) => {
        if (!address) return "General Area";
        if (address.startsWith("Coords:")) {
          const match = address.match(/Coords:\s*(-?\d+\.\d{1,2})\d*,\s*(-?\d+\.\d{1,2})\d*/);
          if (match) {
            return `District (${match[1]}, ${match[2]})`;
          }
          return "District Area";
        }
        const parts = address.split(",");
        if (parts.length > 1) {
          const cleanParts = parts.map(p => p.trim()).filter(p => p.length > 0 && !/^\d+$/.test(p));
          if (cleanParts.length > 1) {
            return cleanParts[1];
          }
          return cleanParts[0];
        }
        return address.trim() || "General Area";
      };

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      let activeReports = allReports.filter((r: any) => {
        if (!r.createdAt) return false;
        const d = new Date(r.createdAt);
        return !isNaN(d.getTime()) && d >= thirtyDaysAgo;
      });

      let usingAllTime = false;
      if (activeReports.length === 0) {
        activeReports = allReports; // fallback to all-time if last 30 days is empty
        usingAllTime = true;
      }

      const categoryCounts: Record<string, number> = {};
      const areaCounts: Record<string, number> = {};

      activeReports.forEach((r: any) => {
        const cat = r.category || "other";
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

        const area = extractArea(r.location?.address);
        areaCounts[area] = (areaCounts[area] || 0) + 1;
      });

      const totalReports = activeReports.length;
      let trendInsight = "";

      if (totalReports === 0) {
        trendInsight = "No reported incidents have been filed yet. Add an incident report on the home screen to seed the analytics engine.";
      } else {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          trendInsight = "Gemini API key is not configured. Add it in AI Studio settings to see natural-language trends and automated dispatch recommendations.";
        } else {
          try {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build'
                }
              }
            });

            const prompt = `
You are a municipal dispatch routing analyst named "Nivaran AI Advisor".
We have analyzed reported civic issues over the ${usingAllTime ? 'all-time history' : 'last 30 days'}. Here are the aggregate counts:

Category Counts:
${JSON.stringify(categoryCounts, null, 2)}

Area Counts (number of issues in each neighborhood/area):
${JSON.stringify(areaCounts, null, 2)}

Please write a brief, professional, 1-2 sentence natural-language insight about the most notable trend or pattern in this civic data (for example, a category spiking in a specific area, or the most dominant category/area requiring attention). Keep it strictly to 1 or 2 sentences max, professional, objective, and directly useful for municipal dispatchers.
`.trim();

            const response = await generateWithFallback(ai, {
              contents: prompt,
            });
            trendInsight = response.text ? response.text.trim() : "No notable trends detected.";
          } catch (geminiErr: any) {
            console.error("Gemini failed in /api/dashboard-insight:", geminiErr);
            trendInsight = "AI trend analysis is temporarily unavailable. Based on raw data: " + 
              Object.entries(categoryCounts).map(([cat, count]) => `${cat} (${count})`).join(", ") + " reported.";
          }
        }
      }

      return res.json({
        categoryCounts,
        areaCounts,
        trendInsight,
        usingAllTime,
        totalReports
      });

    } catch (err: any) {
      console.error("Error in /api/dashboard-insight:", err);
      return res.status(500).json({ error: err.message || "Failed to load dashboard insights." });
    }
  });

  app.get("/api/hotspots", async (req, res) => {
    try {
      const fsConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (!fs.existsSync(fsConfigPath)) {
        return res.json({ status: "insufficient_data", message: "Firebase not configured." });
      }

      const fsConfig = JSON.parse(fs.readFileSync(fsConfigPath, "utf-8"));
      const { initializeApp: initFb, getApps: getFbApps } = await import("firebase/app");
      const { getFirestore: initFs, collection: fsCol, getDocs: fsGet } = await import("firebase/firestore");

      const fbApp = getFbApps().length === 0 ? initFb(fsConfig) : getFbApps()[0];
      const db = initFs(fbApp, fsConfig.firestoreDatabaseId || "default");

      const reportsCol = fsCol(db, "reports");
      const querySnapshot = await fsGet(reportsCol);
      const realReports: any[] = [];
      querySnapshot.forEach((d) => {
        const data = d.data();
        if (!data.isSeedData) {
          realReports.push({ id: d.id, ...data });
        }
      });

      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3; // metres
        const p1 = lat1 * Math.PI / 180;
        const p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
          Math.cos(p1) * Math.cos(p2) *
          Math.sin(dl / 2) * Math.sin(dl / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      let clusters: any[] = [];
      const usedReportIds = new Set();
      
      realReports.forEach(r1 => {
        if (usedReportIds.has(r1.id)) return;
        
        const cluster = [r1];
        usedReportIds.add(r1.id);
        
        realReports.forEach(r2 => {
          if (r1.id === r2.id || usedReportIds.has(r2.id) || r1.category !== r2.category) return;
          
          if (r1.location && r1.location.lat && r2.location && r2.location.lat) {
            const dist = getDistance(r1.location.lat, r1.location.lng, r2.location.lat, r2.location.lng);
            if (dist <= 200) {
              cluster.push(r2);
              usedReportIds.add(r2.id);
            }
          }
        });
        
        if (cluster.length >= 2) {
          clusters.push({
            category: r1.category,
            center: { lat: r1.location.lat, lng: r1.location.lng, address: r1.location.address },
            reportCount: cluster.length
          });
        }
      });

      if (clusters.length < 2) {
        return res.json({
          status: "insufficient_data",
          message: "Not enough report density yet to detect reliable patterns - check back as more reports come in",
          zones: []
        });
      }

      clusters.sort((a, b) => b.reportCount - a.reportCount);
      const topClusters = clusters.slice(0, 4);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ status: "error", message: "Gemini API key is not configured." });
      }

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });

      const prompt = `
You are a civic data analyst. I have identified the following actual hotspots (zones with multiple reports of the same category within 200m).
For each zone, write a 1-sentence reasoning citing the exact number of reports provided. Do not invent any numbers or confidence levels not backed by this data.

Zones:
${topClusters.map((c, i) => `Zone ${i + 1}: ${c.category} at ${c.center.address} (${c.reportCount} matching reports)`).join("\n")}

Respond ONLY with a valid JSON array of objects, each with:
- "title": A short name for the hotspot (e.g., "Pothole Cluster on Main St")
- "reasoning": The 1-sentence reasoning citing the exact report count (e.g., "There have been 3 reports of potholes in this area recently.")
`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json"
        }
      });

      let aiZones = [];
      try {
        aiZones = JSON.parse(response.text || "[]");
      } catch (e) {
        console.error("Failed to parse Gemini hotspots JSON", e);
      }

      const zones = topClusters.map((c, i) => ({
        ...c,
        title: aiZones[i]?.title || `${c.category} Hotspot`,
        reasoning: aiZones[i]?.reasoning || `${c.reportCount} reports in this area.`
      }));

      return res.json({
        status: "success",
        zones
      });

    } catch (err: any) {
      console.error("Error in /api/hotspots:", err);
      return res.status(500).json({ error: err.message || "Failed to load hotspots." });
    }
  });

  // API Route: AI summary of civic issue
  app.post("/api/analyze-issue", async (req, res) => {
    try {
      const { description, photo, category, severity, locationAddress } = req.body;

      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }

      // Check for Gemini API Key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn("GEMINI_API_KEY is not defined. Using fallback pending status.");
        return res.json({
          category: category || "other",
          severity: severity || "Medium",
          aiSummary: "AI analysis pending"
        });
      }

      // Lazy initialization of Gemini SDK
      let primaryError: any = null;
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });
        const contents: any[] = [];

        // Parse and attach the uploaded image if provided
        if (photo && photo.startsWith("data:")) {
          const matches = photo.match(/^data:([^;]+);base64,(.*)$/);
          if (matches) {
            contents.push({
              inlineData: {
                mimeType: matches[1],
                data: matches[2]
              }
            });
          }
        }

        const prompt = `
You are a civic service assistant named "Nivaran AI Advisor".
Please analyze the provided photo evidence and the descriptive text of this reported civic hazard.
Determine the correct category (must match one of the precise category IDs provided below) and estimate the safety severity hazard (Low, Medium, or High).
In addition, provide a brief (1-3 sentences), professional municipal action summary of the issue.

--- CITIZEN REPORT DESCRIPTION ---
"${description}"

${locationAddress ? `Location Context: Near ${locationAddress}` : ""}

--- DEPARTMENTS & CLASSIFICATIONS ---
- 'pothole': Road damage, open asphalt, potholes, cracking.
- 'garbage': Stray trash, piles of refuse, illegal dumping, overfull dumpsters.
- 'streetlight': Blown bulbs, dark street lamps, exposed electrical wires on poles.
- 'water_leak': Pipe bursts, pooling water on streets, leaking valves.
- 'other': Any other general safety warnings or municipal issues not matching above categories.

Format your output EXACTLY as requested in the JSON schema.
`.trim();

        contents.push(prompt);

        const response = await generateWithFallback(ai, {
          contents: contents,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "object",
              properties: {
                category: {
                  type: "string",
                  enum: ["pothole", "garbage", "streetlight", "water_leak", "other"]
                },
                severity: {
                  type: "string",
                  enum: ["Low", "Medium", "High"]
                },
                aiSummary: {
                  type: "string",
                  description: "A professional and concise 1-3 sentences summary of the issue analysis based on the description and photo."
                }
              },
              required: ["category", "severity", "aiSummary"]
            }
          }
        });

        const resultText = response.text ? response.text.trim() : "";
        const parsed = JSON.parse(resultText);

        return res.json({
          category: parsed.category || category || "other",
          severity: parsed.severity || severity || "Medium",
          aiSummary: parsed.aiSummary || "AI analysis pending"
        });
      } catch (geminiError: any) {
        console.error("=== DIAGNOSTIC [Gemini Critical Generation Failure] ===");
        console.error("Primary Error (gemini-flash-latest):", primaryError ? (primaryError.stack || primaryError.message || primaryError) : "No primary error recorded");
        console.error("Fallback Error (last error):", geminiError.stack || geminiError.message || geminiError);
        console.error("=====================================================");

        const primaryMsg = primaryError ? (primaryError.message || String(primaryError)) : "None";
        const primaryStack = primaryError ? (primaryError.stack || "No stack trace") : "None";
        const fallbackMsg = geminiError.message || String(geminiError);
        const fallbackStack = geminiError.stack || "No stack trace";

        const errDetail = `=== PRIMARY ERROR ===\nMessage: ${primaryMsg}\n\nStack Trace:\n${primaryStack}\n\n=== LAST/FALLBACK ERROR ===\nMessage: ${fallbackMsg}\n\nStack Trace:\n${fallbackStack}`;

        return res.json({
          category: category || "other",
          severity: severity || "Medium",
          aiSummary: "AI analysis pending",
          debugError: errDetail
        });
      }
    } catch (error: any) {
      console.error("Error in /api/analyze-issue:", error);
      return res.status(500).json({ error: error.message || "Failed to generate AI summary." });
    }
  });

  // API Route: AI summary, duplicate analysis, and Firestore submission of citizen civic report
  app.post("/api/submit-report", async (req, res) => {
    try {
      const { description, photo, category, severity, location, user, forceNew, confirmDuplicateId } = req.body;

      if (!description) {
        return res.status(400).json({ error: "Description is required" });
      }
      if (!location || typeof location.lat !== "number" || typeof location.lng !== "number") {
        return res.status(400).json({ error: "Location is required with valid latitude & longitude" });
      }
      if (!user || !user.uid) {
        return res.status(401).json({ error: "Citizen session is required to file report" });
      }

      // Step 1: Handle confirmDuplicateId directly
      if (confirmDuplicateId) {
        const fsConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
        const fsConfig = JSON.parse(fs.readFileSync(fsConfigPath, "utf-8"));
        
        const { initializeApp: initFb, getApps: getFbApps } = await import("firebase/app");
        const { getFirestore: initFs, collection: fsCol, getDocs: fsGet, doc: fsDoc, addDoc: fsAdd, updateDoc: fsUpdate, getDoc: fsGetDoc } = await import("firebase/firestore");

        const fbApp = getFbApps().length === 0 ? initFb(fsConfig) : getFbApps()[0];
        const db = initFs(fbApp, fsConfig.firestoreDatabaseId || "default");

        const targetRef = fsDoc(db, "reports", confirmDuplicateId);
        const targetSnap = await fsGetDoc(targetRef);
        if (targetSnap.exists()) {
          const targetReport = targetSnap.data();
          const currentPhotos = Array.isArray(targetReport.photoUrls) 
            ? targetReport.photoUrls 
            : [targetReport.photoUrl].filter(Boolean);
          
          if (photo && !currentPhotos.includes(photo)) {
            currentPhotos.push(photo);
          }

          const currentUpvotedBy = Array.isArray(targetReport.upvotedBy) ? targetReport.upvotedBy : [];
          if (user.uid && !currentUpvotedBy.includes(user.uid)) {
            currentUpvotedBy.push(user.uid);
          }
          
          const timeStr = new Date().toLocaleString();
          const newLog = `[Duplicate Confirmed - ${timeStr}] Citizen verified this matches an existing report. Evidence attached and upvoted.`;
          const agentLog = targetReport.agentLog ? `${targetReport.agentLog}\n\n${newLog}` : newLog;

          await fsUpdate(targetRef, {
            upvotes: (targetReport.upvotes || 0) + 1,
            upvotedBy: currentUpvotedBy,
            photoUrls: currentPhotos,
            agentLog
          });

          return res.json({ isDuplicate: true, reportId: confirmDuplicateId });
        }
      }

      // Step 2: Perform initial AI analysis (classification, severity, and summary)
      let finalCategory = category || "other";
      let finalSeverity = severity || "Medium";
      let generatedSummary = "AI analysis pending";
      let debugError = "";

      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build'
              }
            }
          });
          
          const contents: any[] = [];
          if (photo && photo.startsWith("data:")) {
            const matches = photo.match(/^data:([^;]+);base64,(.*)$/);
            if (matches) {
              contents.push({
                inlineData: {
                  mimeType: matches[1],
                  data: matches[2]
                }
              });
            }
          }

          const analyzePrompt = `
You are a civic service assistant named "Nivaran AI Advisor".
Please analyze the provided photo evidence and the descriptive text of this reported civic hazard.
Determine the correct category (must match one of the precise category IDs provided below) and estimate the safety severity hazard (Low, Medium, or High).
In addition, provide a brief (1-3 sentences), professional municipal action summary of the issue.

--- CITIZEN REPORT DESCRIPTION ---
"${description}"

Location Context: Near ${location.address || "coordinates"}

--- DEPARTMENTS & CLASSIFICATIONS ---
- 'pothole': Road damage, open asphalt, potholes, cracking.
- 'garbage': Stray trash, piles of refuse, illegal dumping, overfull dumpsters.
- 'streetlight': Blown bulbs, dark street lamps, exposed electrical wires on poles.
- 'water_leak': Pipe bursts, pooling water on streets, leaking valves.
- 'other': Any other general safety warnings or municipal issues not matching above categories.

Format your output EXACTLY as requested in the JSON schema.
`.trim();

          contents.push(analyzePrompt);

          const analyzeResponse = await generateWithFallback(ai, {
            contents: contents,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  category: {
                    type: "string",
                    enum: ["pothole", "garbage", "streetlight", "water_leak", "other"]
                  },
                  severity: {
                    type: "string",
                    enum: ["Low", "Medium", "High"]
                  },
                  aiSummary: {
                    type: "string",
                    description: "A professional and concise 1-3 sentences summary of the issue analysis based on the description and photo."
                  }
                },
                required: ["category", "severity", "aiSummary"]
              }
            }
          });

          if (analyzeResponse && analyzeResponse.text) {
            const parsed = JSON.parse(analyzeResponse.text.trim());
            finalCategory = parsed.category || finalCategory;
            finalSeverity = parsed.severity || finalSeverity;
            generatedSummary = parsed.aiSummary || generatedSummary;
          }
        } catch (err: any) {
          console.error("AI analysis during submit failed:", err);
          debugError = err.message || String(err);
        }
      }

      // Step 2: Read active reports from Firestore to look for duplicates within 200m
      const fsConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
      const fsConfig = JSON.parse(fs.readFileSync(fsConfigPath, "utf-8"));
      
      const { initializeApp: initFb, getApps: getFbApps } = await import("firebase/app");
      const { getFirestore: initFs, collection: fsCol, getDocs: fsGet, doc: fsDoc, addDoc: fsAdd, updateDoc: fsUpdate } = await import("firebase/firestore");

      const fbApp = getFbApps().length === 0 ? initFb(fsConfig) : getFbApps()[0];
      const db = initFs(fbApp, fsConfig.firestoreDatabaseId || "default");

      // Retrieve all records to filter locally (Index-lag free & perfect local filter)
      const reportsCol = fsCol(db, "reports");
      const querySnapshot = await fsGet(reportsCol);
      const allReports: any[] = [];
      querySnapshot.forEach((d) => {
        allReports.push({ id: d.id, ...d.data() });
      });

      // Filter: same category, not resolved, within 200m
      const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const similarReports = allReports.filter((r: any) => {
        if (r.category !== finalCategory) return false;
        if (r.status === "resolved") return false;
        if (!r.location || typeof r.location.lat !== "number" || typeof r.location.lng !== "number") return false;
        
        const dist = getDistance(location.lat, location.lng, r.location.lat, r.location.lng);
        return dist <= 200;
      });

      console.log(`[Nivaran Agent] Found ${similarReports.length} candidate reports of category '${finalCategory}' within 200m`);

      // Step 3: Run duplicate comparison logic if there are candidates
      let isDuplicate = false;
      let duplicateId = "";
      let agentLog = "";

      if (similarReports.length > 0 && apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build'
              }
            }
          });

          const candidatesText = similarReports.map((r, idx) => `
[Candidate #${idx + 1}]
ID: ${r.id}
Description: "${r.description}"
Category: "${r.category}"
Location: "${r.location?.address || "Coordinates"}" (${Math.round(getDistance(location.lat, location.lng, r.location.lat, r.location.lng))}m away)
`).join("\n---\n");

          const comparePrompt = `
You are a municipal dispatch routing manager named "Nivaran AI Advisor".
We have received a new citizen civic report of category "${finalCategory}" and there are ${similarReports.length} existing unresolved report(s) reported within 200 meters.
We need to determine if this new report is referring to the SAME underlying physical problem (a duplicate) as one of the existing candidate issues, or if it is a DISTINCT, independent issue (e.g., a different pothole downstream, a separate broken streetlamp, or distinct trash piles nearby).

New Issue Description: "${description}"
New Issue Category: "${finalCategory}"
New Location Context: "${location.address || "Coordinates"}"

Existing Unresolved Candidate Issues within 200m:
${candidatesText}

Analyze carefully:
1. Is the new issue a duplicate of any existing candidates? Answer "duplicate" if it refers to the exact same physical hole, dump pile, or street light bulb. Else answer "new" if it's separate.
2. If it is a duplicate, specify the 1-based index (e.g. 1) of the duplicate candidate. If distinct, specify -1.
3. If it is a duplicate, provide the corresponding candidate's actual Firestore ID. If distinct, provide an empty string.
4. Provide a compact, highly professional explanation of your comparison reasoning (maximum 2 sentences).

Format your output EXACTLY as requested in the JSON schema.
`.trim();

          const compareRes = await generateWithFallback(ai, {
            contents: comparePrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  decision: {
                    type: "string",
                    enum: ["duplicate", "new"]
                  },
                  duplicateOfIndex: {
                    type: "integer"
                  },
                  duplicateOfId: {
                    type: "string"
                  },
                  reasoning: {
                    type: "string"
                  }
                },
                required: ["decision", "duplicateOfIndex", "duplicateOfId", "reasoning"]
              }
            }
          });

          if (compareRes && compareRes.text) {
            const compareParsed = JSON.parse(compareRes.text.trim());
            if (compareParsed.decision === "duplicate") {
              // Map index or look up by candidate ID
              let targetReport = null;
              if (compareParsed.duplicateOfId && similarReports.find(r => r.id === compareParsed.duplicateOfId)) {
                targetReport = similarReports.find(r => r.id === compareParsed.duplicateOfId);
              } else if (compareParsed.duplicateOfIndex >= 1 && compareParsed.duplicateOfIndex <= similarReports.length) {
                targetReport = similarReports[compareParsed.duplicateOfIndex - 1];
              }

              if (targetReport) {
                if (!forceNew) {
                  // Pause and require explicit user input
                  const dist = Math.round(getDistance(location.lat, location.lng, targetReport.location.lat, targetReport.location.lng));
                  return res.json({
                    requiresConfirmation: true,
                    duplicateCandidate: {
                      id: targetReport.id,
                      description: targetReport.description,
                      photoUrl: targetReport.photoUrl,
                      createdAt: targetReport.createdAt,
                      distance: dist
                    }
                  });
                }

                // If forceNew is true, it means user clicked "This is a different issue, submit as new", so we should NOT merge it.
                // It should fall through to Step 4.
                // Wait! If forceNew is true, we should just let it fall through.
              }
            } else {
              // Comparable but distinct
              agentLog = `[Incident Logged - ${new Date().toLocaleString()}] Similar unresolved issues were found within 200m, but Nivaran AI analyzed and verified this is a distinct new incident. Reasoning: ${compareParsed.reasoning}`;
            }
          }
        } catch (compErr: any) {
          console.error("Duplicate comparison failed, falling back to treating as new:", compErr);
        }
      }

      // Step 4: If distinct or comparison wasn't run/failed
      if (!agentLog) {
        agentLog = `[Incident Logged - ${new Date().toLocaleString()}] Nivaran AI analyzed this report and determined it is a distinct new incident of category '${finalCategory}' with ${finalSeverity} severity.`;
      }

      // Rule 4: If it is new and severity is High, escalate it
      let escalated = false;
      let escalationReason = "";
      if (finalSeverity === "High") {
        escalated = true;
        escalationReason = "High-hazard civic report flagged by Nivaran AI for urgent municipal action.";

        if (apiKey) {
          try {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build'
                }
              }
            });
            const escRes = await generateWithFallback(ai, {
              contents: `Discuss why this high severity hazard requires priority municipality action. Be professional and concise (1-2 sentences max).\n\nDescription: "${description}"\nCategory: "${finalCategory}"`,
            });
            if (escRes && escRes.text) {
              escalationReason = escRes.text.trim();
            }
          } catch (escErr) {
            console.error("Failed to generate escalation reason via Gemini, using default:", escErr);
          }
        }

        agentLog += `\n\n[Flagged & Escalated - ${new Date().toLocaleString()}] Immediate civic action required. Escalation reason: ${escalationReason}`;
      }

      // Step 5: AI Resolution Planner call
      let resolutionPlan = null;
      if (apiKey) {
        try {
          const ai = new GoogleGenAI({
            apiKey,
            httpOptions: {
              headers: {
                'User-Agent': 'aistudio-build'
              }
            }
          });

          const planPrompt = `
You are an expert municipal operation planner named "Nivaran AI Resolution Planner".
A new civic hazard report has been categorized. Based on the report details below, formulate a concrete, practical resolution plan.

Category: "${finalCategory}"
Severity: "${finalSeverity}"
Description: "${description}"
Location Context: Near "${location.address || "Coordinates"}"

Please output a JSON object containing:
- suggestedDepartment: The municipal department responsible (e.g. "Road Maintenance", "Sanitation", "Electrical", "Water Department" - inferred from category).
- suggestedAction: A short, concrete next step to resolve the issue.
- estimatedResources: Brief and plausible required resources (e.g. "2 workers, bitumen").
- estimatedResolutionTime: Plausible resolution timeframe (e.g. "3 hours", "1-2 days").
`.trim();

          const planRes = await generateWithFallback(ai, {
            contents: planPrompt,
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "object",
                properties: {
                  suggestedDepartment: { type: "string" },
                  suggestedAction: { type: "string" },
                  estimatedResources: { type: "string" },
                  estimatedResolutionTime: { type: "string" }
                },
                required: ["suggestedDepartment", "suggestedAction", "estimatedResources", "estimatedResolutionTime"]
              }
            }
          });

          if (planRes && planRes.text) {
            const parsedPlan = JSON.parse(planRes.text.trim());
            if (parsedPlan.suggestedDepartment && parsedPlan.suggestedAction) {
              resolutionPlan = {
                suggestedDepartment: parsedPlan.suggestedDepartment,
                suggestedAction: parsedPlan.suggestedAction,
                estimatedResources: parsedPlan.estimatedResources || "Standard crew",
                estimatedResolutionTime: parsedPlan.estimatedResolutionTime || "24 hours"
              };
            }
          }
        } catch (planErr) {
          console.error("AI Resolution Planner call failed:", planErr);
          resolutionPlan = null;
        }
      }

      // Save as brand new report document in Firestore
      const newReportData: any = {
        userId: user.uid,
        userName: user.displayName || "Anonymous Citizen",
        userEmail: user.email || "",
        photoUrl: photo,
        photoUrls: [photo],
        description,
        location,
        category: finalCategory,
        severity: finalSeverity,
        status: "reported",
        upvotes: 0,
        upvotedBy: [],
        createdAt: new Date().toISOString(),
        aiSummary: generatedSummary,
        aiDebugError: debugError,
        debugError,
        agentLog,
        resolutionPlan
      };

      if (escalated) {
        newReportData.escalated = true;
        newReportData.escalationReason = escalationReason;
      }

      const freshDocRef = await fsAdd(fsCol(db, "reports"), newReportData);
      console.log(`[Nivaran Agent] Successfully filed new report document. Unique ID: ${freshDocRef.id}`);

      return res.json({ isDuplicate: false, reportId: freshDocRef.id });

    } catch (err: any) {
      console.error("Error in /api/submit-report:", err);
      return res.status(500).json({ error: err.message || "Failed to submit civic report." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA routing: catch-all
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Nivaran Backend] Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server", err);
});
