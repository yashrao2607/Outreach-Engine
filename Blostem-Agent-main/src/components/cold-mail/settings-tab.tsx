"use client";

import React from "react";
import {
  Mail,
  Sparkles,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  Zap,
  Users,
  RadioTower,
  Settings2,
  Shield,
  RefreshCw,
  XCircle,
  Info,
  UserX,
  ShieldAlert,
  Trash2,
  Plus,
  Search,
  Key,
  ShieldCheck,
  Building2,
  Globe,
  Sliders,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useColdMailStore } from "@/lib/store";
import { fetchTrackingStatus, type TrackingStatus } from "@/lib/api";

interface SettingsTabProps {
  settingsSaving: boolean;
  smtpTesting: boolean;
  handleSaveSettings: () => Promise<void>;
  handleTestSmtp: () => Promise<void>;
  handleResumeUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  resumeInputRef: React.RefObject<HTMLInputElement | null>;
}

function DnsRow({
  label,
  pass,
  detail,
  fix,
  warning,
}: {
  label: string;
  pass: boolean;
  detail: string | null;
  fix: React.ReactNode;
  warning?: string;
}) {
  const [open, setOpen] = React.useState(!pass);
  return (
    <div className={`rounded-2xl border ${pass ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-rose-500/25 bg-rose-500/5'} overflow-hidden`}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        {pass
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          : <XCircle className="w-4 h-4 text-rose-500 shrink-0" />}
        <span className={`text-xs font-black ${pass ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
          {label}
        </span>
        {detail && (
          <span className="text-[10px] text-slate-500 font-mono truncate flex-1">{detail}</span>
        )}
        {!pass && (
          <span className="ml-auto text-[10px] font-bold text-rose-500 shrink-0">
            {open ? 'Hide fix ▲' : 'Show fix ▼'}
          </span>
        )}
        {warning && pass && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-500 shrink-0">
            <AlertTriangle className="w-3 h-3" /> {open ? '▲' : '▼'}
          </span>
        )}
      </button>
      {open && !pass && (
        <div className="px-4 pb-4 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium border-t border-rose-500/10">
          <div className="pt-3">{fix}</div>
        </div>
      )}
      {open && pass && warning && (
        <div className="px-4 pb-4 text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium border-t border-amber-500/10">
          <div className="pt-3">{warning}</div>
        </div>
      )}
    </div>
  );
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settingsSaving,
  smtpTesting,
  handleSaveSettings,
  handleTestSmtp,
  handleResumeUpload,
  resumeInputRef,
}) => {
  const store = useColdMailStore();

  const [tracking, setTracking] = React.useState<TrackingStatus | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [hasChanges, setHasChanges] = React.useState(false);
  const initialConfigRef = React.useRef<string | null>(null);

  // DNS health check state
  type DnsResult = {
    domain: string;
    isManaged: boolean;
    spf: { pass: boolean; managed?: boolean; record: string | null };
    dkim: { pass: boolean; managed?: boolean; selector: string | null };
    dmarc: { pass: boolean; managed?: boolean; record: string | null; policy: string | null };
  };
  const [dnsResult, setDnsResult] = React.useState<DnsResult | null>(null);
  const [dnsLoading, setDnsLoading] = React.useState(false);
  const [dnsError, setDnsError] = React.useState<string | null>(null);

  // Suppression / Unsubscribed list state
  type SuppressionItem = {
    id: string;
    email: string;
    reason: string;
    source: string;
    createdAt: string;
  };
  const [suppressions, setSuppressions] = React.useState<SuppressionItem[]>([]);
  const [suppressionLoading, setSuppressionLoading] = React.useState(false);
  const [suppressionQuery, setSuppressionQuery] = React.useState("");
  const [newSuppressionEmail, setNewSuppressionEmail] = React.useState("");
  const [addingSuppression, setAddingSuppression] = React.useState(false);

  const fetchSuppressions = React.useCallback(async () => {
    setSuppressionLoading(true);
    try {
      const res = await fetch('/api/suppression');
      const data = await res.json();
      if (data.success && Array.isArray(data.suppressions)) {
        setSuppressions(data.suppressions);
      }
    } catch {
      // ignore
    } finally {
      setSuppressionLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchSuppressions();
  }, [fetchSuppressions]);

  const handleAddSuppression = async () => {
    if (!newSuppressionEmail.trim() || !newSuppressionEmail.includes('@')) return;
    setAddingSuppression(true);
    try {
      const res = await fetch('/api/suppression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newSuppressionEmail.trim(), reason: 'manual' }),
      });
      const data = await res.json();
      if (data.success) {
        setNewSuppressionEmail('');
        fetchSuppressions();
      }
    } finally {
      setAddingSuppression(false);
    }
  };

  const handleRemoveSuppression = async (email: string) => {
    try {
      const res = await fetch(`/api/suppression?email=${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        fetchSuppressions();
      }
    } catch {
      // ignore
    }
  };

  const runDnsCheck = React.useCallback(async () => {
    setDnsLoading(true);
    setDnsError(null);
    try {
      const res = await fetch('/api/dns-check');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      setDnsResult(data);
    } catch (e: unknown) {
      setDnsError(e instanceof Error ? e.message : 'DNS check failed');
    } finally {
      setDnsLoading(false);
    }
  }, []);

  // Cache original config once loaded
  React.useEffect(() => {
    if (store.config && initialConfigRef.current === null) {
      initialConfigRef.current = JSON.stringify(store.config);
    }
  }, [store.config]);

  // Detect changes against the cached version
  React.useEffect(() => {
    if (store.config && initialConfigRef.current) {
      const current = JSON.parse(JSON.stringify(store.config));
      const initial = JSON.parse(initialConfigRef.current);
      
      delete current.updatedAt;
      delete initial.updatedAt;
      
      setHasChanges(JSON.stringify(current) !== JSON.stringify(initial));
    }
  }, [store.config]);

  const onSave = async () => {
    await handleSaveSettings();
    if (store.config) {
      initialConfigRef.current = JSON.stringify(store.config);
      setHasChanges(false);
    }
  };

  React.useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const status = await fetchTrackingStatus();
        if (active) setTracking(status);
      } catch {
        if (active) setTracking(null);
      }
    };
    load();
    const interval = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  if (!store.config) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Outbox & AI Credentials */}
        <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden">
          <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-sm tracking-tight">
                <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                Sending Credentials &amp; AI
              </CardTitle>
              <Badge variant="outline" className="text-[9px] font-bold border-primary/20 text-primary bg-primary/5">
                SMTP / IMAP
              </Badge>
            </div>
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
              Configure your Gmail outbox authentication and LLM API keys
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-4 px-6 pb-5">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gmail Address / Username</Label>
              <Input
                placeholder="you@gmail.com"
                value={store.config.emailUser}
                onChange={(e) => store.setConfig({ ...store.config!, emailUser: e.target.value })}
                className="text-xs h-9 rounded-xl font-medium"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gmail App Password</Label>
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-primary font-bold hover:underline inline-flex items-center gap-0.5"
                >
                  Generate App Password <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <Input
                type="password"
                placeholder="xxxx xxxx xxxx xxxx"
                value={store.config.emailPass}
                onChange={(e) => store.setConfig({ ...store.config!, emailPass: e.target.value })}
                className="text-xs h-9 rounded-xl font-mono"
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Groq API Key (Llama 3.3 70B — Free &amp; Ultra-Fast)
                </Label>
                <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                  Active Provider (29 req/min)
                </Badge>
              </div>
              <Input
                type="password"
                placeholder="gsk_..."
                value={store.config.groqApiKey || ""}
                onChange={(e) => store.setConfig({ ...store.config!, groqApiKey: e.target.value })}
                className="text-xs h-9 rounded-xl font-mono"
              />
              <span className="text-[10px] text-slate-400 block font-medium">
                Uses Llama 3.3 70B Versatile with automatic 29 req/min rate limit throttling.
              </span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gemini API Key (Optional Fallback)</Label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={store.config.geminiApiKey || ""}
                onChange={(e) => store.setConfig({ ...store.config!, geminiApiKey: e.target.value })}
                className="text-xs h-9 rounded-xl font-mono"
              />
            </div>

            <Button
              variant="outline"
              onClick={handleTestSmtp}
              disabled={smtpTesting || !store.config.emailUser || !store.config.emailPass}
              className="w-full mt-2 border-border hover:bg-secondary text-xs font-bold h-9 rounded-xl"
            >
              {smtpTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Testing SMTP/IMAP Connection...
                </>
              ) : (
                "Test Outbox & IMAP Connection"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Candidate Resume & Document Profile */}
        <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-sm tracking-tight">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  Resume &amp; Candidate PDF Profile
                </CardTitle>
                <Badge variant="outline" className={`text-[9px] font-bold ${store.resumeExists ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/5" : "border-amber-500/30 text-amber-600"}`}>
                  {store.resumeExists ? "Indexed" : "No Resume"}
                </Badge>
              </div>
              <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                Upload your resume PDF to ground the AI writer in your actual projects, skills, education, and work experience
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 px-6 pb-5 space-y-4">
              {store.resumeExists ? (
                <div className="flex items-start gap-2.5 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-emerald-600 dark:text-emerald-400">Resume Successfully Indexed</h4>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5 leading-relaxed font-medium">
                      Your resume has been parsed and is actively indexed inside the job application email pipeline.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-black text-amber-600 dark:text-amber-400">No Resume Uploaded</h4>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 leading-relaxed font-medium">
                      Upload your PDF resume to enrich cold emails with personalized technical skills and project highlights.
                    </p>
                  </div>
                </div>
              )}

              <div className="border-2 border-dashed border-border/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center bg-secondary/15 hover:bg-secondary/25 transition-all">
                <Upload className="w-6 h-6 text-slate-400 mb-2" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-0.5">
                  Upload PDF Resume
                </h4>
                <p className="text-[10px] text-slate-400 font-medium mb-3">
                  Max file size: 8MB · Single PDF
                </p>
                <input
                  type="file"
                  ref={resumeInputRef}
                  onChange={handleResumeUpload}
                  accept=".pdf"
                  className="hidden"
                />
                <Button
                  size="sm"
                  onClick={() => resumeInputRef.current?.click()}
                  className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-4 text-xs h-8 shadow-sm"
                >
                  Choose Resume PDF
                </Button>
              </div>
            </CardContent>
          </div>
        </Card>
      </div>

      {/* Candidate Profile & Target Roles */}
      <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6">
          <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-base">
            <Building2 className="w-4 h-4 text-primary" />
            Job Seeker Profile &amp; Target Roles
          </CardTitle>
          <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Configure your target roles, skills, degree, and projects for AI cold job application emails
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 px-6 pb-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Applicant Identity</h4>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Your Full Name</Label>
                <Input
                  value={store.config.candidateName}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateName: e.target.value })}
                  placeholder="e.g. Yash Yadav"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target Role / Designation</Label>
                <Input
                  value={store.config.candidateDegree}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateDegree: e.target.value })}
                  placeholder="e.g. Software Engineer / Full Stack Developer"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">College / Education / Background</Label>
                <Input
                  value={store.config.candidateCollege}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateCollege: e.target.value })}
                  placeholder="e.g. B.Tech Computer Science | 2025"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Contact &amp; Links</h4>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Outbox Email</Label>
                <Input
                  value={store.config.candidateEmail}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateEmail: e.target.value })}
                  placeholder="you@gmail.com"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Portfolio / GitHub URL</Label>
                <Input
                  value={store.config.companyWebsite}
                  onChange={(e) => store.setConfig({ ...store.config!, companyWebsite: e.target.value })}
                  placeholder="https://github.com/yourusername or portfolio"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">LinkedIn Profile URL</Label>
                <Input
                  value={store.config.candidateLinkedin}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateLinkedin: e.target.value })}
                  placeholder="https://linkedin.com/in/yourprofile"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Direct Links (CTA &amp; Resume)</h4>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Resume Link (Google Drive / URL)</Label>
                <Input
                  value={store.config.candidateDocLink}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateDocLink: e.target.value })}
                  placeholder="https://drive.google.com/file/d/.../view"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Phone Number (Optional)</Label>
                <Input
                  value={store.config.candidatePhone}
                  onChange={(e) => store.setConfig({ ...store.config!, candidatePhone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Quick Intro Call Link (Optional)</Label>
                <Input
                  value={store.config.candidateCtaLink}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateCtaLink: e.target.value })}
                  placeholder="https://calendly.com/your-name (optional)"
                  className="text-xs h-8.5 rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-4 space-y-3">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-wider">Technical Skills &amp; Projects</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Technical Skills &amp; Stack</Label>
                <Textarea
                  rows={3}
                  placeholder="e.g. React, Next.js, TypeScript, Node.js, Python, PostgreSQL, REST APIs, TailwindCSS"
                  value={store.config.candidateSkills}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateSkills: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Key Projects &amp; Achievements</Label>
                <Textarea
                  rows={3}
                  placeholder="e.g. Built high-speed email platform with 10k users; Solved 400+ LeetCode problems; Hackathon Winner"
                  value={store.config.candidateHighlights}
                  onChange={(e) => store.setConfig({ ...store.config!, candidateHighlights: e.target.value })}
                  className="text-xs rounded-xl"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Custom Job Application Instructions</Label>
                <Textarea
                  rows={3}
                  placeholder="e.g. 'Targeting SDE-1 / Frontend Developer roles. Keep tone friendly and under 90 words.'"
                  value={store.config.customInstructions}
                  onChange={(e) => store.setConfig({ ...store.config!, customInstructions: e.target.value })}
                  className="text-xs font-mono rounded-xl"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automated Follow-Up Sequences & A/B Testing Configuration */}
      <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-base">
              <Sparkles className="w-4 h-4 text-purple-500" />
              Automated Follow-Up Sequences &amp; A/B Testing
            </CardTitle>
            <Badge variant="outline" className="text-[9px] font-bold border-purple-500/20 text-purple-600 bg-purple-500/5">
              Threaded Drip Engine
            </Badge>
          </div>
          <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Configure multi-step conversation follow-up delays (sent in original Gmail thread) and subject line experimentation
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 px-6 pb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Enable Automated Follow-Ups</Label>
                <p className="text-[10px] text-slate-500 font-medium">Sends polite Step 1 and Step 2 follow-ups if no reply is detected.</p>
              </div>
              <Switch
                checked={store.config.enableFollowUps ?? true}
                onCheckedChange={(checked) => store.setConfig({ ...store.config!, enableFollowUps: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-secondary/20">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200">Enable Subject Line A/B Testing</Label>
                <p className="text-[10px] text-slate-500 font-medium">Splits outreach between Direct Pitch (Var A) &amp; Conversational Hook (Var B).</p>
              </div>
              <Switch
                checked={store.config.enableAbTesting ?? true}
                onCheckedChange={(checked) => store.setConfig({ ...store.config!, enableAbTesting: checked })}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Step 1 Follow-Up Delay (Days)</Label>
              <Input
                type="number"
                min={1}
                max={14}
                value={store.config.followUp1DelayDays ?? 3}
                onChange={(e) => store.setConfig({ ...store.config!, followUp1DelayDays: parseInt(e.target.value) || 3 })}
                className="text-xs h-9 rounded-xl font-medium"
              />
              <span className="text-[10px] text-slate-400 font-medium">Standard industry benchmark: 3 days after initial email.</span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Step 2 Follow-Up Delay (Days)</Label>
              <Input
                type="number"
                min={1}
                max={21}
                value={store.config.followUp2DelayDays ?? 4}
                onChange={(e) => store.setConfig({ ...store.config!, followUp2DelayDays: parseInt(e.target.value) || 4 })}
                className="text-xs h-9 rounded-xl font-medium"
              />
              <span className="text-[10px] text-slate-400 font-medium">Standard industry benchmark: 4 days after Step 1.</span>
            </div>

            {/* Send Pacing & Delay Speed Controls */}
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Min Send Delay (Seconds)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={store.config.minSendDelaySec ?? 3}
                onChange={(e) => store.setConfig({ ...store.config!, minSendDelaySec: parseInt(e.target.value) || 3 })}
                className="text-xs h-9 rounded-xl font-medium"
              />
              <span className="text-[10px] text-slate-400 font-medium">Fast &amp; responsive: 3 seconds.</span>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">Max Send Delay (Seconds)</Label>
              <Input
                type="number"
                min={2}
                max={120}
                value={store.config.maxSendDelaySec ?? 6}
                onChange={(e) => store.setConfig({ ...store.config!, maxSendDelaySec: parseInt(e.target.value) || 6 })}
                className="text-xs h-9 rounded-xl font-medium"
              />
              <span className="text-[10px] text-slate-400 font-medium">Random jitter ceiling: 6 seconds.</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 1-Click LinkedIn Recruiter Ingestion & Chrome Extension */}
      <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-base">
              <ExternalLink className="w-4 h-4 text-sky-500" />
              1-Click LinkedIn Recruiter Ingestion
            </CardTitle>
            <Badge variant="outline" className="text-[9px] font-bold border-sky-500/20 text-sky-600 bg-sky-500/5">
              Browser Ext &amp; Bookmarklet
            </Badge>
          </div>
          <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Ingest recruiter profiles directly from LinkedIn into your outreach pipeline with 1 click
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5 px-6 pb-6 space-y-4">
          {/* API Auth Token & Webhook Connection */}
          <div className="p-4 rounded-2xl border border-border bg-secondary/20 space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-primary" />
                  Ingest Webhook Security Token
                </Label>
                <p className="text-[10px] text-slate-500 font-medium">Secures incoming recruiter leads from your browser extension &amp; bookmarklet.</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const randomToken = "oe_sec_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                  store.setConfig({ ...store.config!, apiAuthToken: randomToken });
                }}
                className="text-[10px] h-7 font-bold rounded-lg border-border"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Generate New Token
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                placeholder="oe_sec_your_secret_token"
                value={store.config.apiAuthToken ?? ""}
                onChange={(e) => store.setConfig({ ...store.config!, apiAuthToken: e.target.value })}
                className="text-xs h-9 rounded-xl font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option 1: Browser Bookmarklet */}
            <div className="p-4 rounded-2xl border border-border bg-secondary/15 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-sky-500/10 text-sky-600 font-black text-[10px] flex items-center justify-center border border-sky-500/20">1</span>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Instant Browser Bookmarklet</h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Drag this button to your browser Bookmarks bar. Whenever you are on any LinkedIn recruiter profile, click it to instantly import them!
              </p>
              <a
                href={`javascript:(function(){try{const n=document.querySelector('h1.text-heading-xlarge,h1.inline,.pv-top-card--list h1')?.innerText?.trim()||'Recruiter';const t=document.querySelector('.text-body-medium.break-words')?.innerText?.trim()||'Talent Acquisition';let c=document.querySelector('div[aria-label="Current company"],.pv-text-details__right-panel button span')?.innerText?.trim()||(t.includes(' at ')?t.split(' at ')[1]:t.includes(' @ ')?t.split(' @ ')[1]:prompt('Company Name for '+n+':','Company'));const tok='${store.config.apiAuthToken || ''}';fetch('${typeof window !== 'undefined' ? window.location.origin : ''}/api/ingest/linkedin'+(tok?'?token='+tok:''),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:n,title:t,company:c,linkedinUrl:window.location.href})}).then(r=>r.json()).then(d=>alert(d.success?'✅ Ingested '+n+' ('+c+') into Outreach Engine!':'❌ '+d.error)).catch(e=>alert('Network error: '+e.message));}catch(e){alert(e.message);}})();`}
                onClick={(e) => {
                  if (!e.metaKey && !e.ctrlKey) {
                    // Do not navigate
                  }
                }}
                className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-600 text-white text-xs font-black px-4 py-2 rounded-xl shadow-xs cursor-grab active:cursor-grabbing select-none"
              >
                <span>⚡ Drag Me: Ingest LinkedIn Recruiter</span>
              </a>
            </div>

            {/* Option 2: Chrome Extension Manifest V3 */}
            <div className="p-4 rounded-2xl border border-border bg-secondary/15 space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 font-black text-[10px] flex items-center justify-center border border-indigo-500/20">2</span>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200">Chrome Extension (Manifest V3)</h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                Unpacked Chrome extension included in <code className="bg-secondary px-1 py-0.5 rounded text-[10px] font-mono">public/extension</code>. Load it in <code className="bg-secondary px-1 py-0.5 rounded text-[10px] font-mono">chrome://extensions</code> Developer Mode.
              </p>
              <div className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Manifest V3 Ready in project directory
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deliverability & Compliance */}
      <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-base">
              <Shield className="w-4 h-4 text-primary" />
              Deliverability &amp; DNS Health
            </CardTitle>
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              SPF, DKIM, and DMARC verification to guarantee inbox arrival
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runDnsCheck}
            disabled={dnsLoading || !store.config?.emailUser}
            className="text-xs font-bold gap-1.5 shrink-0 rounded-xl h-8"
          >
            {dnsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {dnsLoading ? 'Checking…' : dnsResult ? 'Re-check DNS' : 'Inspect DNS'}
          </Button>
        </CardHeader>
        <CardContent className="pt-5 px-6 pb-6 space-y-4">
          {dnsResult && (
            <div className="space-y-3">
              <DnsRow
                label="SPF Record"
                pass={dnsResult.spf.pass}
                detail={dnsResult.spf.record}
                fix={
                  <>
                    Add this TXT record at <code className="bg-secondary px-1 rounded font-mono font-bold">@ ({dnsResult.domain})</code>:<br />
                    <code className="mt-1 block bg-slate-900 text-emerald-400 text-[10px] p-2.5 rounded-lg font-mono select-all">
                      v=spf1 include:_spf.google.com ~all
                    </code>
                  </>
                }
              />
              <DnsRow
                label="DKIM Signing"
                pass={dnsResult.dkim.pass}
                detail={dnsResult.dkim.pass ? `Selector: ${dnsResult.dkim.selector}` : null}
                fix={<>Enable DKIM in your email provider admin console.</>}
              />
              <DnsRow
                label="DMARC Policy"
                pass={dnsResult.dmarc.pass}
                detail={dnsResult.dmarc.pass ? `Policy: ${dnsResult.dmarc.policy}` : null}
                fix={
                  <>
                    Add this TXT record at <code className="bg-secondary px-1 rounded font-mono font-bold">_dmarc.{dnsResult.domain}</code>:<br />
                    <code className="mt-1 block bg-slate-900 text-emerald-400 text-[10px] p-2.5 rounded-lg font-mono select-all">
                      {`v=DMARC1; p=none; rua=mailto:${store.config?.emailUser || 'you@' + dnsResult.domain}`}
                    </code>
                  </>
                }
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Do-Not-Contact & Suppression List */}
      <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden">
        <CardHeader className="border-b border-border/60 bg-secondary/10 py-4 px-6 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-base">
              <UserX className="w-4 h-4 text-rose-500" />
              Do-Not-Contact &amp; Unsubscribed Directory
              <Badge variant="outline" className="ml-2 border-rose-500/30 text-rose-600 bg-rose-500/5 text-[10px] font-black">
                {suppressions.length} Suppressed
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
              Recipients who opted out or bounced. The engine automatically skips outreach to these addresses.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSuppressions}
            disabled={suppressionLoading}
            className="text-xs font-bold gap-1.5 shrink-0 rounded-xl h-8"
          >
            <RefreshCw className={`w-3 h-3 ${suppressionLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="pt-4 px-6 pb-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Enter email to add to do-not-contact list..."
              value={newSuppressionEmail}
              onChange={(e) => setNewSuppressionEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddSuppression()}
              className="text-xs h-9 rounded-xl flex-1"
            />
            <Button
              size="sm"
              onClick={handleAddSuppression}
              disabled={addingSuppression || !newSuppressionEmail.includes('@')}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shrink-0 gap-1.5 h-9 rounded-xl"
            >
              <Plus className="w-3.5 h-3.5" />
              Add to Suppression
            </Button>
          </div>

          {suppressions.length > 3 && (
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search suppressed emails..."
                value={suppressionQuery}
                onChange={(e) => setSuppressionQuery(e.target.value)}
                className="text-xs pl-8 h-8 rounded-xl bg-secondary/30"
              />
            </div>
          )}

          <div className="rounded-2xl border border-border/80 overflow-hidden">
            {suppressions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400 font-medium">
                No unsubscribed or suppressed contacts yet. Your do-not-contact list is clean.
              </div>
            ) : (
              <div className="divide-y divide-border/60 max-h-60 overflow-y-auto">
                {suppressions
                  .filter((s) => s.email.toLowerCase().includes(suppressionQuery.toLowerCase()))
                  .map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 px-4 text-xs hover:bg-secondary/20 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono select-all">
                            {item.email}
                          </span>
                          <Badge
                            variant="outline"
                            className={`text-[9px] font-black px-1.5 py-0 rounded ${
                              item.reason === 'unsubscribe'
                                ? 'border-rose-500/30 text-rose-600 bg-rose-500/10'
                                : 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                            }`}
                          >
                            {item.reason === 'unsubscribe' ? 'Unsubscribed' : item.reason}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block">
                          Added {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSuppression(item.email)}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 text-xs h-7 px-2.5 rounded-lg font-bold"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save Bar */}
      <div className="sticky bottom-6 z-20 flex items-center justify-between bg-card/95 backdrop-blur-xl border border-border/80 p-4 rounded-2xl shadow-2xl mt-6 transition-all">
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <div className="flex items-center gap-2 text-amber-500 font-black text-xs">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              Unsaved changes detected. Please save.
            </div>
          ) : (
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs">
              <CheckCircle2 className="w-4 h-4" />
              Settings are saved &amp; synchronized.
            </div>
          )}
        </div>
        <Button
          onClick={onSave}
          disabled={settingsSaving || !hasChanges}
          className={`font-black px-6 py-2.5 text-xs rounded-xl transition-all ${
            hasChanges
              ? "bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 scale-102"
              : "bg-secondary text-slate-400 border border-border cursor-not-allowed"
          }`}
        >
          {settingsSaving ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              Saving changes...
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
