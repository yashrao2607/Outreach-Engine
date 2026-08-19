export interface HrFollowUp {
  id: string;
  contactId: string;
  step: number;
  status: "pending" | "sent" | "failed" | "cancelled";
  subject: string;
  body: string;
  messageId?: string | null;
  sentAt?: string | null;
  scheduledFor?: string | null;
  error?: string | null;
  opened: boolean;
  openedAt?: string | null;
  openCount: number;
  clicked: boolean;
  clickedAt?: string | null;
  clickCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface HrContact {
  id: string;
  name: string;
  email: string;
  title: string;
  company: string;
  status: "pending" | "generating" | "generated" | "sending" | "sent" | "failed" | "replied";
  subject?: string | null;
  body?: string | null;
  sentAt?: string | null;
  error?: string | null;
  messageId?: string | null;
  // A/B Testing Variant
  abVariant?: "A" | "B";
  // Follow-up Drip State
  followUpStep?: number;
  followUpStatus?: "idle" | "pending" | "sent" | "cancelled";
  lastFollowUpAt?: string | null;
  nextFollowUpDue?: string | null;
  followUps?: HrFollowUp[];
  // AI Reply Classification & Drafter
  replyBody?: string | null;
  replySubject?: string | null;
  repliedAt?: string | null;
  replyClassification?: "INTERVIEW_INTEREST" | "FORWARDED" | "INFO_REQUESTED" | "REJECTION" | "OTHER" | "";
  replySnippet?: string;
  suggestedDraft?: string;
  // Tracking
  opened: boolean;
  openedAt?: string | null;
  openCount: number;
  clicked: boolean;
  clickedAt?: string | null;
  clickCount: number;
  ctaClicked: boolean;
  ctaClickedAt?: string | null;
  docClicked: boolean;
  docClickedAt?: string | null;
  unsubscribed: boolean;
  unsubscribedAt?: string | null;
  bounced: boolean;
  bouncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppConfig {
  id: string;
  emailUser: string;
  emailPass: string;
  geminiApiKey: string;
  groqApiKey: string;
  aiProvider: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone: string;
  candidateLinkedin: string;
  companyWebsite: string;
  candidateCollege: string;
  candidateDegree: string;
  candidateSkills: string;
  candidateHighlights: string;
  candidateCtaLink: string;
  candidateDocLink: string;
  appUrl: string;
  customInstructions: string;
  includeWebsite: boolean;
  includeLinkedin: boolean;
  tavilyApiKey: string;
  firecrawlApiKey: string;
  hunterApiKey: string;
  companyAddress: string;
  replyToEmail: string;
  enableTracking: boolean;
  dailySendLimit: number;
  minSendDelaySec: number;
  maxSendDelaySec: number;
  // Follow-Up & A/B Configuration
  enableFollowUps?: boolean;
  followUp1DelayDays?: number;
  followUp2DelayDays?: number;
  maxFollowUpSteps?: number;
  enableAbTesting?: boolean;
  apiAuthToken?: string;
  updatedAt: string;
}

export type ContactVerificationStatus = "verified" | "risky" | "invalid" | "unverified";

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "system" | "success" | "error" | "warning" | "info";
}

export type TabType = "dashboard" | "automation" | "settings";
