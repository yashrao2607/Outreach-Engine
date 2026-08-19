import type { HrContact, AppConfig } from "./types";

const API_BASE = "/api";

export async function fetchConfig(): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function saveConfig(config: Partial<AppConfig>): Promise<AppConfig> {
  const res = await fetch(`${API_BASE}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error("Failed to save config");
  return res.json();
}

export async function fetchContacts(): Promise<HrContact[]> {
  const res = await fetch(`${API_BASE}/hr-list`);
  if (!res.ok) throw new Error("Failed to fetch contacts");
  return res.json();
}

export async function addContact(contact: { name: string; email: string; title: string; company: string }): Promise<HrContact> {
  const res = await fetch(`${API_BASE}/hr-list`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });
  if (!res.ok) throw new Error("Failed to add contact");
  return res.json();
}

export async function deleteContact(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/hr-list/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete contact");
}

export async function uploadCsv(file: File): Promise<{ added: number; total: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/hr-list/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to upload CSV");
  }
  return res.json();
}

export async function generateEmail(
  hrContactId: string, 
  feedback?: string,
  currentSubject?: string,
  currentBody?: string
): Promise<{ subject: string; body: string }> {
  const res = await fetch(`${API_BASE}/generate-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hrContactId, feedback, currentSubject, currentBody }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to generate email");
  }
  const data = await res.json();
  return data.email;
}

export async function updateContact(id: string, contact: { name?: string; email?: string; title?: string; company?: string }): Promise<HrContact> {
  const res = await fetch(`${API_BASE}/hr-list/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contact),
  });
  if (!res.ok) throw new Error("Failed to update contact");
  return res.json();
}

export async function generateFollowUp(
  hrContactId: string,
  step: number = 1,
  feedback?: string
): Promise<{ subject: string; body: string; followUp: any }> {
  const res = await fetch(`${API_BASE}/generate-followup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hrContactId, step, feedback }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to generate follow-up");
  }
  return res.json();
}

export async function sendEmail(
  hrContactId: string,
  subject: string,
  body: string,
  isTest: boolean = false,
  isFollowUp: boolean = false,
  followUpStep: number = 1
): Promise<{ messageId: string; isFollowUp?: boolean }> {
  const res = await fetch(`${API_BASE}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hrContactId, subject, body, isTest, isFollowUp, followUpStep }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to send email");
  }
  return res.json();
}

export async function resetStatus(hrContactId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/reset-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hrContactId }),
  });
  if (!res.ok) throw new Error("Failed to reset status");
}

export async function checkResumeStatus(): Promise<{ exists: boolean; filename: string }> {
  const res = await fetch(`${API_BASE}/resume-status`);
  if (!res.ok) throw new Error("Failed to check resume status");
  return res.json();
}

export async function uploadResume(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/upload-resume`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload resume");
}

export async function checkReplies(): Promise<{
  success: boolean;
  checked: number;
  replied: number;
  bounced?: number;
  repliedList: string[];
  bouncedList?: string[];
  message: string;
}> {
  const res = await fetch(`${API_BASE}/hr-list/check-replies`);
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to check replies");
  }
  return res.json();
}

export async function deleteAllContacts(): Promise<void> {
  const res = await fetch(`${API_BASE}/hr-list`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete all contacts");
}

export interface SpamReport {
  score: number;
  rating: "excellent" | "good" | "fair" | "poor";
  issues: { severity: "high" | "medium" | "low"; message: string }[];
  stats: { words: number; links: number; spamWords: string[]; capsRatio: number; exclamations: number };
}

export async function checkSpam(subject: string, body: string): Promise<SpamReport> {
  const res = await fetch(`${API_BASE}/spam-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subject, body }),
  });
  if (!res.ok) throw new Error("Failed to analyze email");
  return res.json();
}

export interface TrackingStatus {
  active: boolean;
  url: string | null;
  source: "env" | "tunnel" | "manual" | "none";
  /** True when a cloudflared tunnel process is running, even if its domain isn't email-safe */
  tunnelConnected: boolean;
  tunnel: {
    state: "idle" | "starting" | "connected" | "disabled" | "error";
    provider: string | null;
    lastError: string | null;
  };
}

export async function fetchTrackingStatus(): Promise<TrackingStatus> {
  const res = await fetch(`${API_BASE}/tracking-status`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch tracking status");
  return res.json();
}

export async function enrichCompany(companyName: string, website?: string): Promise<{
  success: boolean;
  signals: {
    companyName: string;
    website: string;
    techStack: string[];
    description: string;
    keySignal: string;
  };
}> {
  const res = await fetch(`${API_BASE}/enrich-company`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ companyName, website }),
  });
  if (!res.ok) throw new Error("Failed to enrich company data");
  return res.json();
}


