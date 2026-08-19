"use client";

import { useEffect, useRef, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useColdMailStore } from "@/lib/store";
import * as api from "@/lib/api";
import type { HrContact } from "@/lib/types";

// UI Components
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Icons
import {
  Send,
  RefreshCw,
  Mail,
  Search,
  Terminal,
  Cog,
  Loader2,
  LayoutDashboard,
  LogOut,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";

// Subcomponents
import { EmailPreviewDialog } from "./email-preview-dialog";
import { DashboardTab } from "./dashboard-tab";
import { AutomationTab } from "./automation-tab";
import { SettingsTab } from "./settings-tab";

const ROWS_PER_PAGE = 10;

export default function ColdMailApp() {
  const { toast } = useToast();
  const store = useColdMailStore();
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const agentIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [batchSize, setBatchSize] = useState("10");
  const [intervalMinutes, setIntervalMinutes] = useState("5");
  const [addForm, setAddForm] = useState({ name: "", email: "", title: "", company: "" });
  const [editForm, setEditForm] = useState({ id: "", name: "", email: "", title: "", company: "" });

  // Bulk actions state
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // AI refinement state
  const [aiFeedback, setAiFeedback] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isCheckingReplies, setIsCheckingReplies] = useState(false);
  const [viewSentContact, setViewSentContact] = useState<HrContact | null>(null);
  const [viewReplyContact, setViewReplyContact] = useState<HrContact | null>(null);

  // SSR protection for Recharts
  const [mounted, setMounted] = useState(false);

  // Load configuration and contacts
  const loadData = async () => {
    store.setIsLoading(true);
    try {
      const [config, contacts, resume] = await Promise.all([
        api.fetchConfig(),
        api.fetchContacts(),
        api.checkResumeStatus(),
      ]);
      store.setConfig(config);
      store.setContacts(contacts);
      store.setResumeExists(resume.exists);
      store.addLog("Configuration and contacts loaded.", "system");
      if (resume.exists) {
        store.addLog("Pitch Deck PDF found and verified.", "success");
      } else {
        store.addLog("Note: Pitch Deck PDF not uploaded yet.", "info");
      }
    } catch (e: any) {
      store.addLog(`Error loading data: ${e.message}`, "error");
    } finally {
      store.setIsLoading(false);
    }
  };

  const handleCheckReplies = async () => {
    setIsCheckingReplies(true);
    store.addLog("Checking inbox for replies and delivery failure bounces via IMAP...", "info");
    try {
      const res = await api.checkReplies();
      store.addLog(res.message, (res.replied > 0 || (res.bounced ?? 0) > 0) ? "success" : "info");
      
      if (res.replied > 0 || (res.bounced ?? 0) > 0) {
        const parts: string[] = [];
        if (res.replied > 0) parts.push(`${res.replied} new replies received`);
        if ((res.bounced ?? 0) > 0) parts.push(`${res.bounced} bounced addresses auto-suppressed`);
        
        toast({
          title: "Inbox audit completed",
          description: parts.join(" & ") + ".",
          variant: "success",
        });
        await refreshContacts();
      } else {
        toast({
          title: "Inbox audit complete",
          description: "No new replies or bounces detected.",
          variant: "success",
        });
      }
    } catch (e: any) {
      store.addLog(`Failed to check replies: ${e.message}`, "error");
      toast({
        title: "Reply check failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setIsCheckingReplies(false);
    }
  };

  useEffect(() => {
    loadData();
    window.requestAnimationFrame(() => {
      setMounted(true);
    });

    // Poll for open/click count updates every 5 s
    const contactPoll = setInterval(async () => {
      try {
        const contacts = await api.fetchContacts();
        store.setContacts(contacts);
      } catch {}
    }, 5_000);

    return () => {
      if (agentIntervalRef.current) {
        clearInterval(agentIntervalRef.current);
      }
      clearInterval(contactPoll);
    };
  }, []);

  // Selection helpers
  const handleSelectContact = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Safe paginated boundaries
  const filteredContacts = store.contacts.filter((c) => {
    let matchesStatus = false;
    if (store.statusFilter === "all") {
      matchesStatus = true;
    } else if (store.statusFilter === "opened") {
      matchesStatus = c.opened;
    } else if (store.statusFilter === "clicked") {
      matchesStatus = c.clicked;
    } else if (store.statusFilter === "unsubscribed") {
      matchesStatus = Boolean(c.unsubscribed);
    } else {
      matchesStatus = c.status === store.statusFilter;
    }

    const matchesSearch =
      c.name.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      c.company.toLowerCase().includes(store.searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(store.searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const totalPages = Math.ceil(filteredContacts.length / ROWS_PER_PAGE);
  const safeCurrentPage = Math.min(Math.max(store.currentPage, 1), totalPages || 1);

  const paginatedContacts = filteredContacts.slice(
    (safeCurrentPage - 1) * ROWS_PER_PAGE,
    safeCurrentPage * ROWS_PER_PAGE
  );

  const handleSelectAll = () => {
    const paginatedIds = paginatedContacts.map((c) => c.id);
    const allSelected = paginatedIds.every((id) => selectedContacts.includes(id));

    if (allSelected) {
      setSelectedContacts((prev) => prev.filter((id) => !paginatedIds.includes(id)));
    } else {
      setSelectedContacts((prev) => [...new Set([...prev, ...paginatedIds])]);
    }
  };

  // Preview email
  const handlePreviewEmail = (contact: HrContact) => {
    setAiFeedback(""); // Reset refinement input
    store.openPreview(
      contact,
      contact.subject || "",
      contact.body || ""
    );
    store.addLog(
      `Opened email composer/preview for ${contact.name} at ${contact.company}.`,
      "info"
    );
  };

  // Generate/Refine Email with AI
  const handleRefineEmail = async () => {
    if (!store.previewContact) return;
    const isNewDraft = !store.previewSubject.trim() && !store.previewBody.trim();
    setIsRefining(true);
    store.setIsGenerating(true);

    if (isNewDraft) {
      const isReply = store.previewContact.status === "replied";
      store.setPreviewSubject("Generating...");
      store.setPreviewBody(
        isReply
          ? "AI is drafting a personalized follow-up in response to the HR representative... Please wait."
          : "AI is crafting a personalized cold email... Please wait."
      );
    }

    if (aiFeedback.trim()) {
      store.addLog(`Generating/refining email draft for ${store.previewContact.name} with prompt: "${aiFeedback}"...`, "info");
    } else {
      store.addLog(`Generating email draft for ${store.previewContact.name} using AI...`, "info");
    }

    try {
      const email = await api.generateEmail(
        store.previewContact.id,
        aiFeedback.trim() || undefined,
        store.previewSubject && store.previewSubject !== "Generating..." ? store.previewSubject : undefined,
        store.previewBody && !store.previewBody.includes("Please wait.") ? store.previewBody : undefined
      );
      store.setPreviewSubject(email.subject);
      store.setPreviewBody(email.body);
      setAiFeedback("");
      store.addLog(`Draft generated/refined successfully.`, "success");
      toast({
        title: isNewDraft ? "Draft generated" : "Draft refined",
        description: isNewDraft ? "AI drafted the email for you." : "AI updated the email according to your instructions.",
        variant: "success",
      });
      await refreshContacts();
    } catch (e: any) {
      if (isNewDraft) {
        store.setPreviewSubject("");
        store.setPreviewBody("");
      }
      store.addLog(`Failed to generate/refine draft: ${e.message}`, "error");
      toast({ title: "Failed to generate/refine", description: e.message, variant: "destructive" });
    } finally {
      setIsRefining(false);
      store.setIsGenerating(false);
    }
  };

  // Send email
  const handleSendEmail = async () => {
    if (!store.previewContact) return;
    const contactName = store.previewContact.name;
    store.setIsSending(true);
    store.addLog(`Sending email to ${store.previewContact.name} (${store.previewContact.email})...`, "info");

    try {
      await api.sendEmail(
        store.previewContact.id,
        store.previewSubject,
        store.previewBody
      );
      store.addLog(`Email sent to ${contactName}!`, "success");
      store.closePreview();
      await refreshContacts();
      toast({ title: "Email sent successfully!", description: `Email delivered to ${contactName}`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Failed to send email: ${e.message}`, "error");
      toast({ title: "Failed to send email", description: e.message, variant: "destructive" });
    } finally {
      store.setIsSending(false);
    }
  };

  // Reset status
  const handleResetStatus = async (contact: HrContact) => {
    try {
      await api.resetStatus(contact.id);
      store.addLog(`Status reset for ${contact.email}.`, "info");
      await refreshContacts();
      toast({ title: "Status reset", description: `${contact.name} is now pending.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Reset failed: ${e.message}`, "error");
    }
  };

  // Delete contact
  const handleDeleteContact = async (contact: HrContact) => {
    try {
      await api.deleteContact(contact.id);
      setSelectedContacts((prev) => prev.filter((id) => id !== contact.id));
      store.addLog(`Deleted contact: ${contact.name} (${contact.email}).`, "info");
      await refreshContacts();
      toast({ title: "Contact deleted", description: `${contact.name} removed from list.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Delete failed: ${e.message}`, "error");
      toast({ title: "Failed to delete", description: e.message, variant: "destructive" });
    }
  };

  // Delete whole dataset
  const handleDeleteAllContacts = async () => {
    if (!confirm("Are you sure you want to delete the whole dataset? This action will permanently remove all contacts and cannot be undone.")) {
      return;
    }
    
    store.setIsLoading(true);
    store.addLog("Deleting entire dataset...", "warning");
    try {
      await api.deleteAllContacts();
      setSelectedContacts([]);
      store.addLog("Whole dataset deleted successfully.", "success");
      await refreshContacts();
      toast({
        title: "Dataset deleted",
        description: "The whole dataset has been successfully removed.",
        variant: "success",
      });
    } catch (e: any) {
      store.addLog(`Failed to delete entire dataset: ${e.message}`, "error");
      toast({
        title: "Deletion failed",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      store.setIsLoading(false);
    }
  };

  // Add contact
  const handleAddContact = async () => {
    if (!addForm.name || !addForm.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    try {
      await api.addContact(addForm);
      store.addLog(`Added contact: ${addForm.name} (${addForm.email}).`, "success");
      setAddDialogOpen(false);
      setAddForm({ name: "", email: "", title: "", company: "" });
      await refreshContacts();
      toast({ title: "Contact added", description: `${addForm.name} added to the list.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Failed to add contact: ${e.message}`, "error");
      toast({ title: "Failed to add contact", description: e.message, variant: "destructive" });
    }
  };

  // Open edit contact dialog
  const openEditDialog = (contact: HrContact) => {
    setEditForm({
      id: contact.id,
      name: contact.name,
      email: contact.email,
      title: contact.title || "",
      company: contact.company || "",
    });
    setEditDialogOpen(true);
  };

  // Save edited contact
  const handleEditContact = async () => {
    if (!editForm.name || !editForm.email) {
      toast({ title: "Name and email are required", variant: "destructive" });
      return;
    }
    try {
      await api.updateContact(editForm.id, {
        name: editForm.name,
        email: editForm.email,
        title: editForm.title,
        company: editForm.company,
      });
      store.addLog(`Updated contact: ${editForm.name} (${editForm.email}).`, "success");
      setEditDialogOpen(false);
      await refreshContacts();
      toast({ title: "Contact updated", description: `${editForm.name} updated successfully.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Failed to update contact: ${e.message}`, "error");
      toast({ title: "Failed to update", description: e.message, variant: "destructive" });
    }
  };

  // Upload CSV/Excel
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");
    const fileType = isExcel ? "Spreadsheet" : "CSV";
    try {
      const result = await api.uploadCsv(file);
      store.addLog(`${fileType} uploaded: ${result.added} contacts added out of ${result.total} total rows.`, "success");
      await refreshContacts();
      toast({ title: `${fileType} uploaded`, description: `${result.added} contacts added successfully.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`${fileType} upload failed: ${e.message}`, "error");
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
    e.target.value = "";
  };

  // Upload pitch deck/brochure PDF
  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.uploadResume(file);
      store.setResumeExists(true);
      store.addLog("Resume PDF uploaded and indexed successfully.", "success");
      toast({ title: "Resume uploaded", description: "Your Resume PDF is now indexed for job application emails.", variant: "success" });
    } catch (e: any) {
      store.addLog(`Resume upload failed: ${e.message}`, "error");
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    }
    e.target.value = "";
  };

  // Save settings
  const handleSaveSettings = async () => {
    if (!store.config) return;
    setSettingsSaving(true);
    try {
      const saved = await api.saveConfig(store.config);
      store.setConfig(saved);
      store.addLog("Settings saved successfully.", "success");
      toast({ title: "Settings saved", description: "Your configuration has been updated.", variant: "success" });
    } catch (e: any) {
      store.addLog(`Failed to save settings: ${e.message}`, "error");
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSettingsSaving(false);
    }
  };

  // Test SMTP Connection
  const handleTestSmtp = async () => {
    if (!store.config?.emailUser || !store.config?.emailPass) {
      toast({
        title: "Missing fields",
        description: "Please enter both Gmail address and App Password before testing.",
        variant: "destructive"
      });
      return;
    }
    setSmtpTesting(true);
    store.addLog("Testing SMTP Connection...", "info");
    try {
      const res = await fetch("/api/config/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailUser: store.config.emailUser,
          emailPass: store.config.emailPass
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to verify SMTP");
      
      store.addLog("SMTP Connection verified successfully!", "success");
      toast({
        title: "Connection Success",
        description: "Your Gmail SMTP credentials are valid and active!",
        variant: "success",
      });
    } catch (e: any) {
      store.addLog(`SMTP Connection test failed: ${e.message}`, "error");
      toast({
        title: "Verification failed",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  // Send Test Email to Yourself
  const handleSendTestEmail = async () => {
    if (!store.previewContact) return;
    
    if (!store.config?.emailUser || !store.config?.emailPass) {
      toast({
        title: "Missing credentials",
        description: "Please configure SMTP settings in the Settings tab before sending emails.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSendingTest(true);
    store.addLog(`Sending test email for ${store.previewContact.name}...`, "info");
    try {
      const result = await api.sendEmail(
        store.previewContact.id,
        store.previewSubject,
        store.previewBody,
        true // isTest = true
      );
      store.addLog(`Test email successfully sent. Message ID: ${result.messageId}`, "success");
      toast({
        title: "Test email sent!",
        description: `Successfully dispatched to ${store.config.candidateEmail || store.config.emailUser}.`,
        variant: "success",
      });
    } catch (e: any) {
      store.addLog(`Failed to send test email: ${e.message}`, "error");
      toast({
        title: "Test failed",
        description: e.message,
        variant: "destructive"
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Automation
  const startAgent = () => {
    if (!store.config?.emailUser || !store.config?.emailPass) {
      store.addLog("Error: Gmail SMTP credentials are missing. Please configure settings first.", "error");
      toast({ title: "Missing credentials", description: "Please configure Gmail settings first.", variant: "destructive" });
      return;
    }

    const parsedMinutes = parseInt(intervalMinutes, 10);
    if (!parsedMinutes || parsedMinutes < 1) {
      toast({ title: "Invalid interval", description: "Interval must be at least 1 minute.", variant: "destructive" });
      return;
    }

    // Guard against double-start
    if (agentIntervalRef.current) {
      clearInterval(agentIntervalRef.current);
      agentIntervalRef.current = null;
    }

    store.setIsAgentRunning(true);
    const intervalMs = parsedMinutes * 60 * 1000;
    store.addLog(`Automation started. Batch: ${batchSize}, Interval: ${parsedMinutes} min.`, "success");

    runAgentBatch();
    agentIntervalRef.current = setInterval(runAgentBatch, intervalMs);
  };

  const stopAgent = () => {
    store.setIsAgentRunning(false);
    if (agentIntervalRef.current) {
      clearInterval(agentIntervalRef.current);
      agentIntervalRef.current = null;
    }
    store.addLog("Automation paused.", "warning");
  };

  // Randomized human-like delay between sends (protects sender reputation).
  // Default: 3–6 seconds — fast, responsive, and prevents automation flags.
  const getJitterMs = () => {
    const min = store.config?.minSendDelaySec ?? 3;
    const max = store.config?.maxSendDelaySec ?? 6;
    const lo = Math.max(1, Math.min(min, max));
    const hi = Math.max(lo, max);
    return Math.round((lo + Math.random() * (hi - lo)) * 1000);
  };

  const handleSendFollowUp = async (contact: HrContact, step: number = 1) => {
    if (!store.config?.emailUser || !store.config?.emailPass) {
      toast({ title: "Missing SMTP credentials", description: "Configure Gmail settings first.", variant: "destructive" });
      return;
    }
    store.addLog(`[Follow-Up] Generating threaded follow-up (Step ${step}) for ${contact.name} @ ${contact.company}...`, "info");
    try {
      const followup = await api.generateFollowUp(contact.id, step);
      await new Promise((r) => setTimeout(r, 300));
      await api.sendEmail(contact.id, followup.subject, followup.body, false, true, step);
      store.addLog(`[Success] Follow-Up Step ${step} delivered to ${contact.name} (${contact.email})`, "success");
      await refreshContacts();
      toast({
        title: `Follow-Up Step ${step} sent!`,
        description: `Delivered in original thread to ${contact.name}.`,
        variant: "success",
      });
    } catch (e: any) {
      store.addLog(`[Failed] Follow-up for ${contact.name} failed: ${e.message}`, "error");
      toast({ title: "Follow-up failed", description: e.message, variant: "destructive" });
    }
  };

  const runAgentBatch = async () => {
    if (!useColdMailStore.getState().isAgentRunning) return;
    store.addLog("--- Automation batch triggered ---", "system");

    const currentContacts = useColdMailStore.getState().contacts;
    const now = Date.now();
    const config = store.config;

    // 1. Check for due Follow-Ups (Priority Queue)
    const enableFollowUps = config?.enableFollowUps !== false;
    const delay1Ms = (config?.followUp1DelayDays ?? 3) * 24 * 60 * 60 * 1000;
    const delay2Ms = (config?.followUp2DelayDays ?? 4) * 24 * 60 * 60 * 1000;

    const dueFollowUps = enableFollowUps
      ? currentContacts.filter((c) => {
          if (c.status !== "sent" || c.repliedAt || c.unsubscribed || c.bounced) return false;
          if (c.followUpStatus === "cancelled") return false;

          const sentTime = c.sentAt ? new Date(c.sentAt).getTime() : 0;
          const lastFollowUpTime = c.lastFollowUpAt ? new Date(c.lastFollowUpAt).getTime() : 0;

          if (c.followUpStep === 0 && sentTime > 0 && now - sentTime >= delay1Ms) {
            return true; // Due for Step 1
          }
          if (c.followUpStep === 1 && lastFollowUpTime > 0 && now - lastFollowUpTime >= delay2Ms) {
            return true; // Due for Step 2
          }
          return false;
        })
      : [];

    const pendingCold = currentContacts.filter((c) => c.status === "pending");

    if (dueFollowUps.length === 0 && pendingCold.length === 0) {
      store.addLog("No pending contacts or due follow-ups left. Pausing automation loop.", "success");
      stopAgent();
      return;
    }

    const limit = parseInt(batchSize, 10);
    // Prioritize follow-ups, fill remaining slots with cold prospects
    const followUpsToRun = dueFollowUps.slice(0, limit);
    const coldToRun = pendingCold.slice(0, Math.max(0, limit - followUpsToRun.length));

    store.addLog(`Processing queue: ${followUpsToRun.length} due follow-ups & ${coldToRun.length} cold applications...`, "info");

    // Execute due follow-ups
    for (let i = 0; i < followUpsToRun.length; i++) {
      if (!useColdMailStore.getState().isAgentRunning) break;
      const contact = followUpsToRun[i];
      const nextStep = (contact.followUpStep ?? 0) + 1;
      store.addLog(`[Follow-Up ${i + 1}/${followUpsToRun.length}] Generating Step ${nextStep} threaded follow-up for ${contact.name} @ ${contact.company}...`, "info");

      try {
        const followup = await api.generateFollowUp(contact.id, nextStep);
        await new Promise((r) => setTimeout(r, 300));
        await api.sendEmail(contact.id, followup.subject, followup.body, false, true, nextStep);
        store.addLog(`[Success] Threaded Follow-Up Step ${nextStep} sent to ${contact.name} (${contact.email})`, "success");
      } catch (e: any) {
        store.addLog(`[Failed] Follow-up for ${contact.name}: ${e.message}`, "error");
      }

      await refreshContacts();
      if (i < followUpsToRun.length - 1 || coldToRun.length > 0) {
        const waitMs = getJitterMs();
        store.addLog(`Throttling ${Math.round(waitMs / 1000)}s before next send...`, "system");
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    // Execute cold applications
    for (let i = 0; i < coldToRun.length; i++) {
      if (!useColdMailStore.getState().isAgentRunning) break;
      const contact = coldToRun[i];
      store.addLog(`[Cold Outreach ${i + 1}/${coldToRun.length}] Generating draft for ${contact.name} @ ${contact.company}...`, "info");

      try {
        const email = await api.generateEmail(contact.id);
        await new Promise((r) => setTimeout(r, 300));
        await api.sendEmail(contact.id, email.subject, email.body);
        store.addLog(`[Success] Initial cold application emailed to ${contact.name} (${contact.email})`, "success");
      } catch (e: any) {
        store.addLog(`[Failed] Processing ${contact.name}: ${e.message}`, "error");
      }

      await refreshContacts();
      if (i < coldToRun.length - 1) {
        const waitMs = getJitterMs();
        store.addLog(`Throttling ${Math.round(waitMs / 1000)}s before next send...`, "system");
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    store.addLog("Batch cycle finished. Standing by for next interval.", "system");
  };

  // Bulk execution handlers
  const handleBulkSend = async () => {
    const pendingToProcess = store.contacts.filter(
      (c) => selectedContacts.includes(c.id) && c.status === "pending"
    );

    if (pendingToProcess.length === 0) {
      toast({
        title: "No pending contacts",
        description: "None of the selected contacts are in 'pending' status.",
        variant: "destructive",
      });
      return;
    }

    if (!store.config?.emailUser || !store.config?.emailPass) {
      toast({
        title: "Missing SMTP Credentials",
        description: "Please configure your Gmail SMTP settings first.",
        variant: "destructive",
      });
      return;
    }

    setIsBulkProcessing(true);
    store.setIsAgentRunning(true);
    store.setActiveTab("automation");
    store.addLog(`--- Starting Bulk Outreach for ${pendingToProcess.length} contacts ---`, "system");
    setSelectedContacts([]); // Reset selections

    for (let i = 0; i < pendingToProcess.length; i++) {
      const contact = pendingToProcess[i];
      store.addLog(`[Bulk Outreach ${i + 1}/${pendingToProcess.length}] Generating draft for ${contact.name} (${contact.company})...`, "info");

      try {
        const email = await api.generateEmail(contact.id);
        await new Promise((r) => setTimeout(r, 300));
        store.addLog(`[Bulk Outreach ${i + 1}/${pendingToProcess.length}] Delivering email to ${contact.email}...`, "info");
        await api.sendEmail(contact.id, email.subject, email.body);
        store.addLog(`[Success] Emailed ${contact.name} at ${contact.company}`, "success");
      } catch (e: any) {
        store.addLog(`[Failed] Could not process ${contact.name}: ${e.message}`, "error");
      }

      await refreshContacts();
      if (i < pendingToProcess.length - 1) {
        const waitMs = getJitterMs();
        store.addLog(`Throttling ${Math.round(waitMs / 1000)}s before next send...`, "system");
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }

    store.addLog(`--- Bulk outreach completed ---`, "success");
    setIsBulkProcessing(false);
    store.setIsAgentRunning(false);
    toast({
      title: "Bulk outreach finished",
      description: `Completed processing ${pendingToProcess.length} contacts. See console for details.`,
      variant: "success",
    });
  };

  const handleBulkReset = async () => {
    if (selectedContacts.length === 0) return;
    try {
      let count = 0;
      for (const id of selectedContacts) {
        await api.resetStatus(id);
        count++;
      }
      setSelectedContacts([]);
      await refreshContacts();
      store.addLog(`Bulk reset completed. ${count} contacts reset to pending.`, "info");
      toast({ title: "Bulk status reset", description: `Successfully reset ${count} contacts.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Bulk reset failed: ${e.message}`, "error");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedContacts.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedContacts.length} selected contacts?`)) return;

    try {
      let count = 0;
      for (const id of selectedContacts) {
        await api.deleteContact(id);
        count++;
      }
      setSelectedContacts([]);
      await refreshContacts();
      store.addLog(`Bulk delete completed. ${count} contacts removed.`, "warning");
      toast({ title: "Bulk delete success", description: `Removed ${count} contacts.`, variant: "success" });
    } catch (e: any) {
      store.addLog(`Bulk delete failed: ${e.message}`, "error");
    }
  };

  const refreshContacts = async () => {
    try {
      const contacts = await api.fetchContacts();
      store.setContacts(contacts);
    } catch {}
  };

  // Precomputed statistics (Exact counts for Unique Opens, Total Opens, CTA Clicks, Document Reads)
  const totalContacts = store.contacts.length;
  const sentCount = store.contacts.filter((c) => c.status === "sent" || c.status === "replied").length;
  const failedCount = store.contacts.filter((c) => c.status === "failed" || c.bounced).length;
  const pendingCount = store.contacts.filter((c) => c.status === "pending").length;
  const generatingCount = store.contacts.filter((c) => c.status === "generating" || c.status === "generated").length;
  const repliedCount = store.contacts.filter((c) => c.status === "replied").length;
  const deliveredCount = sentCount;
  
  const openedCount = store.contacts.filter((c) => c.opened || (c.openCount ?? 0) > 0).length;
  const totalOpens = store.contacts.reduce((sum, c) => sum + (c.openCount || (c.opened ? 1 : 0)), 0);
  const clickedCount = store.contacts.filter((c) => c.clicked || c.ctaClicked || c.docClicked || (c.clickCount ?? 0) > 0).length;
  const ctaClickedCount = store.contacts.filter((c) => c.ctaClicked).length;
  const docClickedCount = store.contacts.filter((c) => c.docClicked).length;
  const totalClicks = store.contacts.reduce((sum, c) => sum + (c.clickCount || (c.clicked || c.ctaClicked || c.docClicked ? 1 : 0)), 0);
  const unsubscribedCount = store.contacts.filter((c) => c.unsubscribed).length;

  const openRate = deliveredCount > 0 ? Math.round((openedCount / deliveredCount) * 100) : 0;
  const clickRate = deliveredCount > 0 ? Math.round((clickedCount / deliveredCount) * 100) : 0;
  const replyRate = deliveredCount > 0 ? Math.round((repliedCount / deliveredCount) * 100) : 0;
  const successRate = totalContacts > 0 ? Math.round((sentCount / totalContacts) * 100) : 0;

  // Pie chart stats
  const chartData = [
    { name: "Scheduled (Pending)", value: pendingCount, color: "#f59e0b" },
    { name: "Delivered (Sent)", value: sentCount - repliedCount, color: "#06b6d4" },
    { name: "Bounced (Failed)", value: failedCount, color: "#ef4444" },
    { name: "Drafted (AI)", value: generatingCount, color: "#8b5cf6" },
    { name: "Replied (Leads)", value: repliedCount, color: "#6366f1" },
    { name: "Unsubscribed", value: unsubscribedCount, color: "#f43f5e" },
  ].filter((d) => d.value > 0);

  // Bar chart company volumes
  const companyCounts: Record<string, number> = {};
  store.contacts.forEach((c) => {
    if (c.company) {
      companyCounts[c.company] = (companyCounts[c.company] || 0) + 1;
    }
  });
  const companyBarData = Object.entries(companyCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const recentActivities = [...store.contacts].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased transition-colors duration-200 selection:bg-primary/25 selection:text-foreground">
      {/* Premium Glassmorphic Header */}
      <header className="sticky top-0 z-40 bg-card/75 backdrop-blur-xl border-b border-border/80 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center overflow-hidden border border-border/80 bg-gradient-to-br from-card to-secondary/80 shadow-md shadow-black/5 dark:shadow-black/20 group">
                <img src="https://i.ibb.co/7xB4Dycc/Chat-GPT-Image-Aug-18-2026-01-24-39-PM.png" className="w-8 h-8 object-contain transition-transform duration-300 group-hover:scale-110" alt="Outreach AI" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    Outreach AI
                  </h1>
                  <span className="text-[9px] uppercase font-black tracking-widest bg-gradient-to-r from-indigo-500 to-cyan-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                    Autonomous
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">B2B Talent Outreach Engine</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3">
              {/* User session indicator */}
              {session?.user && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary/40 border border-border/80 text-xs backdrop-blur-sm">
                  <div className="w-5 h-5 rounded-lg bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-[10px] font-black text-white uppercase shadow-sm">
                    {session.user.name?.charAt(0) || session.user.email?.charAt(0) || "U"}
                  </div>
                  <span className="text-slate-700 dark:text-slate-300 font-medium max-w-[130px] truncate">{session.user.email}</span>
                  <button
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="ml-1 p-1 rounded-md text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                    title="Sign out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Theme Toggle Button */}
              {mounted && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl w-8 h-8 p-0 border-border/80 bg-card/60 hover:bg-secondary text-slate-600 dark:text-slate-300"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle Theme"
                >
                  {theme === "dark" ? (
                    <span className="text-amber-400 text-xs">☀</span>
                  ) : (
                    <span className="text-indigo-500 text-xs">🌙</span>
                  )}
                </Button>
              )}

              {/* Engine Status Live Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border/80 text-xs font-semibold shadow-xs">
                {store.isAgentRunning ? (
                  <div className="relative flex h-2 w-2 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </div>
                ) : (
                  <div className="relative flex h-2 w-2 shrink-0">
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-400 dark:bg-slate-600"></span>
                  </div>
                )}
                <span className="text-[11px] text-slate-700 dark:text-slate-300">
                  {store.isAgentRunning ? "Engine Active" : "Engine Idle"}
                </span>
              </div>

              {/* Manual Check Replies Trigger */}
              <Button
                variant="outline"
                size="sm"
                className="border-indigo-500/20 hover:border-indigo-500/40 hover:bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 font-bold px-3 py-1.5 rounded-xl h-8 text-xs flex items-center gap-1.5 shadow-2xs"
                onClick={handleCheckReplies}
                disabled={isCheckingReplies}
              >
                {isCheckingReplies ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Syncing...</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Check Replies</span>
                  </>
                )}
              </Button>

              {/* Reload data button */}
              <Button
                variant="ghost"
                size="sm"
                className="text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-secondary rounded-xl w-8 h-8 p-0"
                onClick={loadData}
                title="Refresh outreach records"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={store.activeTab} onValueChange={(v) => store.setActiveTab(v as any)} className="space-y-6">
          <TabsList className="bg-secondary/40 backdrop-blur-md border border-border/80 p-1 rounded-2xl flex gap-1.5 h-auto w-fit shadow-inner">
            <TabsTrigger value="dashboard" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 text-xs font-bold gap-2 transition-all shadow-2xs">
              <LayoutDashboard className="w-3.5 h-3.5" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="automation" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 text-xs font-bold gap-2 transition-all shadow-2xs">
              <Terminal className="w-3.5 h-3.5" />
              Agent Console
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white px-4 py-2 text-xs font-bold gap-2 transition-all shadow-2xs">
              <Cog className="w-3.5 h-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* ============ DASHBOARD TAB ============ */}
          <TabsContent value="dashboard" className="space-y-6">
            <DashboardTab
              totalContacts={totalContacts}
              sentCount={sentCount}
              failedCount={failedCount}
              pendingCount={pendingCount}
              generatingCount={generatingCount}
              repliedCount={repliedCount}
              deliveredCount={deliveredCount}
              openedCount={openedCount}
              totalOpens={totalOpens}
              clickedCount={clickedCount}
              ctaClickedCount={ctaClickedCount}
              docClickedCount={docClickedCount}
              totalClicks={totalClicks}
              unsubscribedCount={unsubscribedCount}
              openRate={openRate}
              clickRate={clickRate}
              replyRate={replyRate}
              successRate={successRate}
              chartData={chartData}
              companyBarData={companyBarData}
              recentActivities={recentActivities}
              mounted={mounted}
              filteredContacts={filteredContacts}
              paginatedContacts={paginatedContacts}
              safeCurrentPage={safeCurrentPage}
              totalPages={totalPages}
              selectedContacts={selectedContacts}
              handleSelectContact={handleSelectContact}
              handleSelectAll={handleSelectAll}
              handlePreviewEmail={handlePreviewEmail}
              handleResetStatus={handleResetStatus}
              handleDeleteContact={handleDeleteContact}
              handleDeleteAllContacts={handleDeleteAllContacts}
              handleFileUpload={handleFileUpload}
              handleBulkSend={handleBulkSend}
              handleBulkReset={handleBulkReset}
              handleBulkDelete={handleBulkDelete}
              openEditDialog={openEditDialog}
              setAddDialogOpen={setAddDialogOpen}
              setViewSentContact={setViewSentContact}
              setViewReplyContact={setViewReplyContact}
              csvInputRef={csvInputRef}
              isBulkProcessing={isBulkProcessing}
              handleSendFollowUp={handleSendFollowUp}
            />
          </TabsContent>

          {/* ============ AUTOMATION TAB ============ */}
          <TabsContent value="automation" className="space-y-6">
            <AutomationTab
              batchSize={batchSize}
              setBatchSize={setBatchSize}
              intervalMinutes={intervalMinutes}
              setIntervalMinutes={setIntervalMinutes}
              startAgent={startAgent}
              stopAgent={stopAgent}
            />
          </TabsContent>

          {/* ============ SETTINGS TAB ============ */}
          <TabsContent value="settings" className="space-y-6">
            <SettingsTab
              settingsSaving={settingsSaving}
              smtpTesting={smtpTesting}
              handleSaveSettings={handleSaveSettings}
              handleTestSmtp={handleTestSmtp}
              handleResumeUpload={handleResumeUpload}
              resumeInputRef={resumeInputRef}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-border/80 bg-card/45 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Outreach Engine v0.2.1 · Built for autonomous talent outreach</p>
          <p className="text-xs text-primary font-bold">
            {totalContacts} Outreach targets · {sentCount} Emailed targets
          </p>
        </div>
      </footer>

      {/* Shared Dialogs Wrapper */}
      <EmailPreviewDialog
        addDialogOpen={addDialogOpen}
        setAddDialogOpen={setAddDialogOpen}
        addForm={addForm}
        setAddForm={setAddForm}
        handleAddContact={handleAddContact}
        editDialogOpen={editDialogOpen}
        setEditDialogOpen={setEditDialogOpen}
        editForm={editForm}
        setEditForm={setEditForm}
        handleEditContact={handleEditContact}
        aiFeedback={aiFeedback}
        setAiFeedback={setAiFeedback}
        isRefining={isRefining}
        isSendingTest={isSendingTest}
        handleRefineEmail={handleRefineEmail}
        handleSendEmail={handleSendEmail}
        handleSendTestEmail={handleSendTestEmail}
        viewSentContact={viewSentContact}
        setViewSentContact={setViewSentContact}
        viewReplyContact={viewReplyContact}
        setViewReplyContact={setViewReplyContact}
        handlePreviewEmail={handlePreviewEmail}
      />
    </div>
  );
}
