"use client";

import React from "react";
import {
  Send,
  Eye,
  Reply,
  MousePointerClick,
  Mail,
  Loader2,
  Sparkles,
  Plus,
  UserPlus,
  Edit,
  Check,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Clock,
  User,
  Building2,
  Briefcase,
  ChevronDown,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useColdMailStore } from "@/lib/store";
import { checkSpam, fetchContacts, sendEmail, type SpamReport } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { HrContact } from "@/lib/types";

const RATING_STYLES: Record<SpamReport["rating"], { bar: string; text: string; label: string }> = {
  excellent: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Excellent (Inbox Guaranteed)" },
  good: { bar: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Good" },
  fair: { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Fair" },
  poor: { bar: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", label: "Needs work" },
};

const DeliverabilityScore = ({ report }: { report: SpamReport }) => {
  const s = RATING_STYLES[report.rating];
  return (
    <div className="p-3.5 rounded-xl border border-border/80 bg-secondary/20 space-y-2.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-primary" />
          Pre-Send Deliverability Score
        </Label>
        <span className={`text-xs font-black ${s.text}`}>{report.score}/100 · {s.label}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
        <div className={`h-full ${s.bar} transition-all duration-300`} style={{ width: `${report.score}%` }} />
      </div>
      {report.issues.length > 0 && (
        <ul className="space-y-1 pt-1">
          {report.issues.slice(0, 3).map((issue, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[10px] font-medium leading-relaxed text-slate-500 dark:text-slate-400">
              <AlertTriangle
                className={`w-3 h-3 shrink-0 mt-0.5 ${
                  issue.severity === "high" ? "text-rose-500" : issue.severity === "medium" ? "text-amber-500" : "text-slate-400"
                }`}
              />
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface EmailPreviewDialogProps {
  // Add Contact
  addDialogOpen: boolean;
  setAddDialogOpen: (open: boolean) => void;
  addForm: { name: string; email: string; title: string; company: string };
  setAddForm: (form: { name: string; email: string; title: string; company: string }) => void;
  handleAddContact: () => Promise<void>;
  // Edit Contact
  editDialogOpen: boolean;
  setEditDialogOpen: (open: boolean) => void;
  editForm: { id: string; name: string; email: string; title: string; company: string };
  setEditForm: (form: { id: string; name: string; email: string; title: string; company: string }) => void;
  handleEditContact: () => Promise<void>;
  // Email Preview
  aiFeedback: string;
  setAiFeedback: (feedback: string) => void;
  isRefining: boolean;
  isSendingTest: boolean;
  handleRefineEmail: () => Promise<void>;
  handleSendEmail: () => Promise<void>;
  handleSendTestEmail: () => Promise<void>;
  // Sent/Reply view
  viewSentContact: HrContact | null;
  setViewSentContact: (contact: HrContact | null) => void;
  viewReplyContact: HrContact | null;
  setViewReplyContact: (contact: HrContact | null) => void;
  handlePreviewEmail: (contact: HrContact) => void;
}

// Connected tracking timeline indicator
const TrackingTimeline = ({ contact }: { contact: HrContact }) => {
  const isSent = contact.status === "sent" || contact.status === "replied";
  const isOpened = contact.opened;
  const isClicked = contact.clicked;
  const isReplied = contact.status === "replied";

  const getInitials = (name: string) => {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "HR";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
  };

  const getFormattedTime = (dateStr?: string | null) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return "";
    }
  };

  return (
    <div className="flex items-center gap-1.5 select-none font-sans py-0.5">
      {/* Sent step */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
          isSent 
            ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400" 
            : "bg-secondary border-border text-slate-400"
        }`}
        title={isSent && contact.sentAt ? `Sent at: ${new Date(contact.sentAt).toLocaleString()}` : "Not sent yet"}
      >
        <Send className="w-2.5 h-2.5" />
      </div>

      <div className={`w-3 h-0.5 transition-all ${isOpened ? "bg-emerald-500" : "bg-secondary"}`} />

      {/* Opened step */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
          isOpened 
            ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-400" 
            : "bg-secondary border-border text-slate-400"
        }`}
        title={isOpened && contact.openedAt ? `Opened ${contact.openCount} times. First open: ${new Date(contact.openedAt).toLocaleString()}` : "Not opened yet"}
      >
        <Eye className="w-2.5 h-2.5" />
      </div>

      <div className={`w-3 h-0.5 transition-all ${isClicked ? "bg-emerald-500" : "bg-secondary"}`} />

      {/* Clicked step */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
          isClicked 
            ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400" 
            : "bg-secondary border-border text-slate-400"
        }`}
        title={
          isClicked 
            ? `Clicked ${contact.clickCount} times.${contact.ctaClicked ? " CTA Link Clicked." : ""}${contact.docClicked ? " Document Link Clicked." : ""}` 
            : "No links clicked yet"
        }
      >
        <MousePointerClick className="w-2.5 h-2.5" />
      </div>

      <div className={`w-3 h-0.5 transition-all ${isReplied ? "bg-emerald-500" : "bg-secondary"}`} />

      {/* Replied step */}
      <div 
        className={`w-6 h-6 rounded-full flex items-center justify-center border transition-all ${
          isReplied 
            ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 font-bold" 
            : "bg-secondary border-border text-slate-400"
        }`}
        title={isReplied && contact.repliedAt ? `Replied at: ${new Date(contact.repliedAt).toLocaleString()}` : "No reply yet"}
      >
        <Reply className="w-2.5 h-2.5" />
      </div>

      {/* Recruiter Initials */}
      <div className="w-5.5 h-5.5 rounded-full flex items-center justify-center bg-secondary text-slate-700 dark:text-slate-300 border border-border text-[9px] font-black ml-1 shrink-0">
        {getInitials(contact.name)}
      </div>

      {/* Timestamp */}
      {isSent && contact.sentAt && (
        <span className="text-[9px] text-muted-foreground ml-1 font-mono font-medium shrink-0">
          {getFormattedTime(contact.sentAt)}
        </span>
      )}
    </div>
  );
};

export const EmailPreviewDialog: React.FC<EmailPreviewDialogProps> = ({
  addDialogOpen,
  setAddDialogOpen,
  addForm,
  setAddForm,
  handleAddContact,
  editDialogOpen,
  setEditDialogOpen,
  editForm,
  setEditForm,
  handleEditContact,
  aiFeedback,
  setAiFeedback,
  isRefining,
  isSendingTest,
  handleRefineEmail,
  handleSendEmail,
  handleSendTestEmail,
  viewSentContact,
  setViewSentContact,
  viewReplyContact,
  setViewReplyContact,
  handlePreviewEmail,
}) => {
  const store = useColdMailStore();
  const { toast } = useToast();

  const [quickReplyDraft, setQuickReplyDraft] = React.useState<string>("");
  const [isSendingQuickReply, setIsSendingQuickReply] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (viewReplyContact?.suggestedDraft) {
      setQuickReplyDraft(viewReplyContact.suggestedDraft);
    } else if (viewReplyContact) {
      const firstName = viewReplyContact.name ? viewReplyContact.name.split(" ")[0] : "there";
      setQuickReplyDraft(`Hi ${firstName},\n\nThank you for getting back to me! I would love to connect for a quick conversation. Please let me know what time works best for your team.\n\nBest regards`);
    }
  }, [viewReplyContact]);

  const handleDispatchQuickReply = async () => {
    if (!viewReplyContact || !quickReplyDraft.trim()) return;
    setIsSendingQuickReply(true);
    try {
      const subject = viewReplyContact.replySubject || `Re: ${viewReplyContact.subject || "Outreach"}`;
      await sendEmail(viewReplyContact.id, subject, quickReplyDraft, false);
      toast({
        title: "Response Delivered!",
        description: `Delivered your reply to ${viewReplyContact.name} (${viewReplyContact.email})`,
      });
      setViewReplyContact(null);
      const freshContacts = await fetchContacts();
      store.setContacts(freshContacts);
    } catch (err: any) {
      toast({
        title: "Failed to send reply",
        description: err.message || "An error occurred while sending.",
        variant: "destructive",
      });
    } finally {
      setIsSendingQuickReply(false);
    }
  };

  // Live pre-send deliverability / spam score (debounced).
  const [spamReport, setSpamReport] = React.useState<SpamReport | null>(null);
  React.useEffect(() => {
    if (!store.isPreviewOpen || store.isGenerating) return;
    const subject = store.previewSubject;
    const body = store.previewBody;
    if (body.includes("Please wait.") || subject === "Generating...") return;
    const t = setTimeout(async () => {
      if (!subject.trim() && !body.trim()) {
        setSpamReport(null);
        return;
      }
      try {
        setSpamReport(await checkSpam(subject, body));
      } catch {
        /* ignore */
      }
    }, 450);
    return () => clearTimeout(t);
  }, [store.previewSubject, store.previewBody, store.isPreviewOpen, store.isGenerating]);

  const activeContact = store.contacts.find((c) => c.id === viewSentContact?.id) || viewSentContact;

  const quickPromptChips = [
    "Make it shorter & punchier",
    "Focus on project achievements",
    "Add gentle follow-up urgency",
    "Make tone more conversational",
  ];

  return (
    <>
      {/* Email Composer / Preview Dialog */}
      <Dialog open={store.isPreviewOpen} onOpenChange={(open) => !open && store.closePreview()}>
        <DialogContent className="sm:max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl bg-card/95 backdrop-blur-xl border-border/80 shadow-2xl p-6">
          <DialogHeader className="border-b border-border/60 pb-4">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-lg">
                {store.previewContact?.status === "replied" ? (
                  <Reply className="w-5 h-5 text-indigo-500 animate-pulse" />
                ) : (
                  <Mail className="w-5 h-5 text-primary" />
                )}
                {store.isGenerating 
                  ? (store.previewContact?.status === "replied" ? "AI Drafting Follow-up..." : "AI Drafting Outreach...") 
                  : (store.previewContact?.status === "replied" ? "Follow-up Draft Review" : "Email Draft Review")
                }
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              {store.previewContact
                ? `Personalized for ${store.previewContact.name} (${store.previewContact.title || "HR"}) at ${store.previewContact.company}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Received response context banner */}
            {store.previewContact?.replyBody && (
              <div className="border border-indigo-500/20 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-black text-xs">
                    <Reply className="w-3.5 h-3.5" />
                    <span>Received Recruiter Response from {store.previewContact.name}</span>
                  </div>
                  {store.previewContact.repliedAt && (
                    <span className="text-[10px] text-indigo-500 font-mono font-bold">
                      {new Date(store.previewContact.repliedAt).toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="bg-card/80 border border-indigo-500/10 rounded-xl p-3 max-h-36 overflow-y-auto text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans">
                  {store.previewContact.replyBody}
                </div>
              </div>
            )}

            {/* Email Subject Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Subject Line</Label>
              <Input
                value={store.previewSubject}
                onChange={(e) => store.setPreviewSubject(e.target.value)}
                disabled={store.isGenerating || store.isSending}
                className="border-border bg-secondary/30 text-slate-900 dark:text-white font-medium text-xs h-9.5 rounded-xl focus:border-primary"
                placeholder="Subject line..."
              />
            </div>

            {/* Email Body Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Message Body</Label>
                <span className="text-[10px] text-slate-400 font-mono">
                  {store.previewBody.split(/\s+/).filter(Boolean).length} words
                </span>
              </div>
              <Textarea
                value={store.previewBody}
                onChange={(e) => store.setPreviewBody(e.target.value)}
                disabled={store.isGenerating || store.isSending}
                rows={9}
                className="border-border bg-secondary/30 text-slate-900 dark:text-white font-mono text-xs leading-relaxed rounded-xl focus:border-primary p-3.5"
                placeholder="Write your email body..."
              />
            </div>

            {/* Deliverability & Spam Score */}
            {!store.isGenerating && spamReport && <DeliverabilityScore report={spamReport} />}
            {!store.isGenerating && spamReport && spamReport.score < 70 && (
              <p className="text-xs text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Send blocked — spam score too low. Refine or edit the email to improve deliverability.
              </p>
            )}

            {/* AI Refinement & Quick Prompt Chips */}
            {!store.isGenerating && !store.isSending && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-black text-primary flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    AI Agent Writer &amp; Refiner
                  </Label>
                </div>

                {/* Quick Chips */}
                <div className="flex flex-wrap gap-1.5">
                  {quickPromptChips.map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAiFeedback(chip)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-card/80 border border-primary/20 text-slate-700 dark:text-slate-300 hover:border-primary hover:text-primary transition-colors shadow-2xs"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder="Custom instruction (e.g., 'Emphasize React & TypeScript experience')..."
                    value={aiFeedback}
                    onChange={(e) => setAiFeedback(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleRefineEmail()}
                    className="border-border bg-card text-xs h-9 rounded-xl flex-1"
                  />
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-white font-bold h-9 px-4 rounded-xl text-xs shrink-0 shadow-sm"
                    onClick={handleRefineEmail}
                    disabled={isRefining}
                  >
                    {isRefining ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        Refine
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 pt-4 border-t border-border/80 flex sm:flex-row flex-col">
            <Button
              variant="outline"
              onClick={store.closePreview}
              disabled={store.isSending || isSendingTest}
              className="border-border text-slate-600 dark:text-slate-300 rounded-xl h-9.5 text-xs font-bold"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              className="border-primary/20 hover:bg-primary/5 text-primary font-bold px-4 rounded-xl h-9.5 text-xs"
              onClick={handleSendTestEmail}
              disabled={store.isGenerating || store.isSending || isSendingTest}
            >
              {isSendingTest ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Sending Test...
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 mr-1.5" />
                  Send Test to Me
                </>
              )}
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white font-black px-6 rounded-xl h-9.5 text-xs shadow-md shadow-primary/20"
              onClick={handleSendEmail}
              disabled={store.isGenerating || store.isSending || isSendingTest || (spamReport !== null && spamReport.score < 70)}
            >
              {store.isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  {store.previewContact?.status === "replied" ? "Send Follow-up" : "Send Live Email"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-card border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-lg">
              <UserPlus className="w-5 h-5 text-primary" />
              Add Target Prospect
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-400">
              Input recipient contact details to add them to your outreach sequence
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</Label>
              <Input
                placeholder="e.g. Jane Smith"
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</Label>
              <Input
                type="email"
                placeholder="e.g. jane@company.com"
                value={addForm.email}
                onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Job Title</Label>
                <Input
                  placeholder="e.g. Talent Lead"
                  value={addForm.title}
                  onChange={(e) => setAddForm({ ...addForm, title: e.target.value })}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Company</Label>
                <Input
                  placeholder="e.g. Acme Corp"
                  value={addForm.company}
                  onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} className="rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl text-xs" onClick={handleAddContact}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Save Prospect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-card border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-lg">
              <Edit className="w-5 h-5 text-primary" />
              Edit Prospect Details
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-400">
              Update details for this recipient
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Full Name *</Label>
              <Input
                placeholder="Jane Smith"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Address *</Label>
              <Input
                type="email"
                placeholder="jane@company.com"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="text-xs h-9 rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Job Title</Label>
                <Input
                  placeholder="HR Lead"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Company</Label>
                <Input
                  placeholder="Acme Corp"
                  value={editForm.company}
                  onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  className="text-xs h-9 rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} className="rounded-xl text-xs font-bold">
              Cancel
            </Button>
            <Button className="bg-primary hover:bg-primary/90 text-white font-black rounded-xl text-xs" onClick={handleEditContact}>
              <Check className="w-3.5 h-3.5 mr-1" />
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sent Email Details Dialog */}
      <Dialog open={viewSentContact !== null} onOpenChange={(open) => !open && setViewSentContact(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border-border p-6 shadow-2xl">
          <DialogHeader className="border-b border-border/60 pb-3">
            <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-lg">
              <Mail className="w-5 h-5 text-emerald-500" />
              Sent Outreach Analytics
            </DialogTitle>
            <DialogDescription className="text-xs font-medium text-slate-400">
              {activeContact
                ? `Delivery summary for ${activeContact.name} (${activeContact.title || "HR"}) at ${activeContact.company}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {activeContact && (
            <div className="space-y-4 pt-3 text-sm">
              {/* Engagement & Tracking Stats */}
              <div className="border border-border bg-secondary/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live Engagement &amp; Tracking</h4>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[9px] uppercase font-black py-0.5">
                    Live Telemetry
                  </Badge>
                </div>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 divide-y md:divide-y-0 md:divide-x divide-border">
                  <div className="w-full md:w-auto pb-4 md:pb-0">
                    <TrackingTimeline contact={activeContact} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs pt-4 md:pt-0 pl-0 md:pl-6 w-full md:w-auto">
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Total Opens:</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 bg-card px-2 py-0.5 rounded-lg border border-border font-mono">{activeContact.openCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Total Clicks:</span>
                      <span className="font-black text-slate-800 dark:text-slate-200 bg-card px-2 py-0.5 rounded-lg border border-border font-mono">{activeContact.clickCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">CTA Link:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-lg text-[10px] ${activeContact.ctaClicked ? "text-emerald-600 bg-emerald-500/10" : "text-slate-400 bg-card border border-border"}`}>
                        {activeContact.ctaClicked ? "Clicked" : "Not Clicked"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 font-medium">Document:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-lg text-[10px] ${activeContact.docClicked ? "text-emerald-600 bg-emerald-500/10" : "text-slate-400 bg-card border border-border"}`}>
                        {activeContact.docClicked ? "Opened" : "Not Clicked"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 border border-border rounded-2xl p-4 space-y-2">
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Sent To</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{activeContact.name} ({activeContact.email})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Sent At</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {activeContact.sentAt ? new Date(activeContact.sentAt).toLocaleString() : "N/A"}
                    </span>
                  </div>
                  <div className="col-span-2 border-t border-border/40 pt-2">
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Subject</span>
                    <span className="font-bold text-slate-900 dark:text-white">{activeContact.subject || "No Subject"}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Initial Cold Email Body</Label>
                  <span className="text-[10px] text-slate-400 font-mono">Step 0 (Original)</span>
                </div>
                <div className="bg-secondary/30 border border-border rounded-2xl p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono max-h-56 overflow-y-auto">
                  {activeContact.body}
                </div>
              </div>

              {/* Follow-Up Sequence Conversation History */}
              {activeContact.followUps && activeContact.followUps.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-purple-500" />
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">
                      Dispatched Threaded Follow-Ups ({activeContact.followUps.length})
                    </h4>
                  </div>
                  {activeContact.followUps.map((f) => (
                    <div key={f.id} className="border border-purple-500/20 bg-purple-500/5 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between">
                        <Badge className="bg-purple-500/15 text-purple-600 border border-purple-500/30 text-[9px] font-black">
                          Follow-Up Step {f.step}
                        </Badge>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {f.sentAt ? new Date(f.sentAt).toLocaleString() : "Pending"}
                        </span>
                      </div>
                      <div className="text-[11px] font-bold text-purple-700 dark:text-purple-300">
                        {f.subject}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono bg-card/80 p-3 rounded-xl border border-border/80 max-h-40 overflow-y-auto">
                        {f.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border">
            <Button
              className="bg-primary hover:bg-primary/90 text-white font-bold px-6 rounded-xl text-xs"
              onClick={() => setViewSentContact(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Received Reply Details Dialog & 1-Click Response Drafter */}
      <Dialog open={viewReplyContact !== null} onOpenChange={(open) => !open && setViewReplyContact(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-card border-border p-6 shadow-2xl">
          <DialogHeader className="border-b border-border/60 pb-3">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-lg">
                <Reply className="w-5 h-5 text-indigo-500" />
                Received Recruiter Reply
              </DialogTitle>
              {viewReplyContact?.replyClassification && (
                <Badge
                  className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    viewReplyContact.replyClassification === "INTERVIEW_INTEREST"
                      ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 glow-emerald"
                      : viewReplyContact.replyClassification === "FORWARDED"
                      ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
                      : viewReplyContact.replyClassification === "INFO_REQUESTED"
                      ? "bg-sky-500/15 text-sky-600 border border-sky-500/30"
                      : viewReplyContact.replyClassification === "REJECTION"
                      ? "bg-rose-500/15 text-rose-600 border border-rose-500/30"
                      : "bg-secondary text-slate-600 border border-border"
                  }`}
                >
                  {viewReplyContact.replyClassification === "INTERVIEW_INTEREST" && "🟢 Interview Interest"}
                  {viewReplyContact.replyClassification === "FORWARDED" && "🟡 Forwarded to Team"}
                  {viewReplyContact.replyClassification === "INFO_REQUESTED" && "🔵 Info / CTC Requested"}
                  {viewReplyContact.replyClassification === "REJECTION" && "⚪ Closed Role"}
                  {viewReplyContact.replyClassification === "OTHER" && "⚪ General Update"}
                </Badge>
              )}
            </div>
            <DialogDescription className="text-xs font-medium text-slate-400">
              {viewReplyContact
                ? `Response from ${viewReplyContact.name} (${viewReplyContact.title || "HR"}) at ${viewReplyContact.company}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewReplyContact && (
            <div className="space-y-4 pt-3 text-sm">
              {/* AI Intent Summary Snippet */}
              {viewReplyContact.replySnippet && (
                <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3.5 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px]">AI Intent Insight:</span>
                    <p className="text-slate-600 dark:text-slate-400 mt-0.5 font-medium">{viewReplyContact.replySnippet}</p>
                  </div>
                </div>
              )}

              {/* Reply Details Metadata */}
              <div className="bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
                <div className="grid grid-cols-2 gap-y-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Sender</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{viewReplyContact.name} ({viewReplyContact.email})</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Replied At</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {viewReplyContact.repliedAt ? new Date(viewReplyContact.repliedAt).toLocaleString() : "N/A"}
                    </span>
                  </div>
                  <div className="col-span-2 border-t border-indigo-500/10 pt-2">
                    <span className="text-slate-400 font-medium block text-[10px] uppercase">Reply Subject</span>
                    <span className="font-bold text-indigo-600 dark:text-indigo-400">{viewReplyContact.replySubject || `Re: ${viewReplyContact.subject || "Outreach"}`}</span>
                  </div>
                </div>
              </div>

              {/* Reply Body Content */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Recruiter Message</Label>
                <div className="bg-secondary/30 border border-border rounded-2xl p-4 text-xs leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans max-h-48 overflow-y-auto">
                  {viewReplyContact.replyBody || "No message body found in reply."}
                </div>
              </div>

              {/* 1-Click AI Suggested Response Drafter */}
              <div className="bg-gradient-to-r from-emerald-500/5 via-teal-500/5 to-primary/5 border border-emerald-500/20 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
                    1-Click Response Copilot
                  </Label>
                  <span className="text-[10px] text-slate-400 font-medium">Editable AI Draft</span>
                </div>
                <Textarea
                  rows={4}
                  value={quickReplyDraft}
                  onChange={(e) => setQuickReplyDraft(e.target.value)}
                  placeholder="Type or customize your response to the recruiter..."
                  className="text-xs rounded-xl bg-card border-border/80 leading-relaxed font-sans"
                />
              </div>

              {/* Original Sent Email context */}
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                <div className="bg-secondary/20 px-4 py-2 border-b border-border text-[10px] font-bold text-slate-400">
                  Original Sent Outreach ({viewReplyContact.sentAt ? new Date(viewReplyContact.sentAt).toLocaleDateString() : ""})
                </div>
                <div className="p-3 text-xs space-y-1.5">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{viewReplyContact.subject || "No Subject"}</div>
                  <div className="text-slate-500 whitespace-pre-wrap font-mono text-[11px] max-h-24 overflow-y-auto">
                    {viewReplyContact.body}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-3 border-t border-border flex sm:flex-row flex-col justify-between items-center gap-2.5">
            {viewReplyContact && (
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  onClick={handleDispatchQuickReply}
                  disabled={isSendingQuickReply || !quickReplyDraft.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-4 rounded-xl text-xs flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 w-full sm:w-auto"
                >
                  {isSendingQuickReply ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>⚡ 1-Click Send Response</span>
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10 font-bold px-3.5 rounded-xl text-xs flex items-center gap-1.5"
                  onClick={() => {
                    const contact = viewReplyContact;
                    setViewReplyContact(null);
                    handlePreviewEmail(contact);
                  }}
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Compose Studio</span>
                </Button>
              </div>
            )}
            <Button
              className="bg-secondary text-slate-700 dark:text-slate-300 hover:bg-secondary/80 font-bold px-5 rounded-xl text-xs w-full sm:w-auto"
              onClick={() => setViewReplyContact(null)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
