export type SeverityType = "Low" | "Medium" | "High";
export type IssueStatusType = "reported" | "acknowledged" | "in progress" | "resolved" | "Reported" | "Acknowledged" | "In Progress" | "Resolved";

export interface StatusHistoryEntry {
  status: string;
  changedBy: string;
  changedAt: string; // ISO format
}

export interface GeoLocation {
  lat: number;
  lng: number;
  address: string;
}

export interface ResolutionPlan {
  suggestedDepartment: string;
  suggestedAction: string;
  estimatedResources: string;
  estimatedResolutionTime: string;
}

export interface CivicReport {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  photoUrl: string; // base64 string or image URL
  description: string;
  location: GeoLocation;
  category: string;
  severity: SeverityType;
  status: IssueStatusType;
  upvotes: number;
  upvotedBy: string[]; // List of user IDs who upvoted
  createdAt: string; // ISO format
  aiSummary?: string;
  aiDebugError?: string;
  debugError?: string;
  escalated?: boolean;
  escalationReason?: string;
  agentLog?: string;
  photoUrls?: string[];
  statusHistory?: StatusHistoryEntry[];
  resolutionPlan?: ResolutionPlan | null;
}

export const CATEGORIES = [
  { id: "pothole", name: "Pothole / Road Damage", icon: "Road" },
  { id: "garbage", name: "Garbage / Dump Pile", icon: "Trash" },
  { id: "streetlight", name: "Broken Streetlight", icon: "Lightbulb" },
  { id: "water_leak", name: "Water Leak / Pipe Burst", icon: "Droplet" },
  { id: "other", name: "Other Civic Hazard", icon: "AlertTriangle" },
];

export interface Verification {
  id?: string;
  issueId: string;
  userId: string;
  vote: "still_active" | "resolved";
  createdAt: string;
}

export interface CivicUser {
  userId: string;
  userName: string;
  points: number;
}


