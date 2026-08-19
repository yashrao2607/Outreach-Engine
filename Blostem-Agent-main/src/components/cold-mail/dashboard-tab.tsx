"use client";

import React from "react";
import {
  Send,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Eye,
  RotateCcw,
  Plus,
  Upload,
  FileText,
  Trash2,
  Terminal,
  Mail,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  LayoutDashboard,
  Building2,
  UserPlus,
  Edit,
  Sparkles,
  Reply,
  MousePointerClick,
  MessageSquare,
  UserX,
  ShieldAlert,
  ArrowUpRight,
  Copy,
  Check,
  TrendingUp,
  Activity,
  Layers,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { motion, AnimatePresence } from "framer-motion";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
} from "recharts";
import { useColdMailStore } from "@/lib/store";
import type { HrContact } from "@/lib/types";

interface DashboardTabProps {
  // Stats
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  pendingCount: number;
  generatingCount: number;
  repliedCount: number;
  deliveredCount: number;
  openedCount: number;
  totalOpens?: number;
  clickedCount: number;
  ctaClickedCount?: number;
  docClickedCount?: number;
  totalClicks?: number;
  unsubscribedCount: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  successRate: number;
  // Charts
  chartData: Array<{ name: string; value: number; color: string }>;
  companyBarData: Array<{ name: string; count: number }>;
  recentActivities: HrContact[];
  mounted: boolean;
  // Contacts table
  filteredContacts: HrContact[];
  paginatedContacts: HrContact[];
  safeCurrentPage: number;
  totalPages: number;
  // Selection
  selectedContacts: string[];
  handleSelectContact: (id: string) => void;
  handleSelectAll: () => void;
  // Handlers
  handlePreviewEmail: (contact: HrContact) => void;
  handleResetStatus: (contact: HrContact) => Promise<void>;
  handleDeleteContact: (contact: HrContact) => Promise<void>;
  handleDeleteAllContacts: () => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBulkSend: () => Promise<void>;
  handleBulkReset: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  openEditDialog: (contact: HrContact) => void;
  setAddDialogOpen: (open: boolean) => void;
  setViewSentContact: (contact: HrContact | null) => void;
  setViewReplyContact: (contact: HrContact | null) => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>;
  isBulkProcessing: boolean;
  handleSendFollowUp?: (contact: HrContact, step?: number) => Promise<void>;
}

// Status badge renderer
const StatusBadge: React.FC<{ status: string; unsubscribed?: boolean }> = ({ status, unsubscribed }) => {
  if (unsubscribed) {
    return (
      <Badge variant="outline" className="px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center w-fit border border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 shadow-2xs">
        <UserX className="w-3 h-3 mr-1" />
        Unsubscribed / Suppressed
      </Badge>
    );
  }

  const variants: Record<string, { className: string; icon: React.ReactNode; label: string }> = {
    pending: {
      className: "border-amber-500/25 text-amber-600 dark:text-amber-400 bg-amber-500/10",
      icon: <Clock className="w-3 h-3 mr-1" />,
      label: "Scheduled",
    },
    generating: {
      className: "border-indigo-500/25 text-indigo-500 dark:text-indigo-400 bg-indigo-500/10",
      icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
      label: "Drafting",
    },
    generated: {
      className: "border-violet-500/25 text-violet-600 dark:text-violet-400 bg-violet-500/10",
      icon: <FileText className="w-3 h-3 mr-1" />,
      label: "AI Ready",
    },
    sending: {
      className: "border-cyan-500/25 text-cyan-600 dark:text-cyan-400 bg-cyan-500/10",
      icon: <Loader2 className="w-3 h-3 mr-1 animate-spin" />,
      label: "Sending",
    },
    sent: {
      className: "border-emerald-500/25 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 glow-emerald",
      icon: <Send className="w-3 h-3 mr-1" />,
      label: "Delivered",
    },
    replied: {
      className: "border-indigo-500/30 text-indigo-600 dark:text-indigo-400 bg-indigo-500/15 glow-indigo font-black",
      icon: <Reply className="w-3 h-3 mr-1" />,
      label: "Replied (Lead)",
    },
    failed: {
      className: "border-rose-500/25 text-rose-600 dark:text-rose-400 bg-rose-500/10",
      icon: <XCircle className="w-3 h-3 mr-1" />,
      label: "Bounced",
    },
  };

  const config = variants[status] || variants.pending;
  return (
    <Badge variant="outline" className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] flex items-center w-fit border ${config.className}`}>
      {config.icon}
      {config.label}
    </Badge>
  );
};

export const DashboardTab: React.FC<DashboardTabProps> = ({
  totalContacts,
  sentCount,
  failedCount,
  pendingCount,
  generatingCount,
  repliedCount,
  deliveredCount,
  openedCount,
  totalOpens = 0,
  clickedCount,
  ctaClickedCount = 0,
  docClickedCount = 0,
  totalClicks = 0,
  unsubscribedCount,
  openRate,
  clickRate,
  replyRate,
  successRate,
  chartData,
  companyBarData,
  recentActivities,
  mounted,
  filteredContacts,
  paginatedContacts,
  safeCurrentPage,
  totalPages,
  selectedContacts,
  handleSelectContact,
  handleSelectAll,
  handlePreviewEmail,
  handleResetStatus,
  handleDeleteContact,
  handleDeleteAllContacts,
  handleFileUpload,
  handleBulkSend,
  handleBulkReset,
  handleBulkDelete,
  openEditDialog,
  setAddDialogOpen,
  setViewSentContact,
  setViewReplyContact,
  csvInputRef,
  isBulkProcessing,
  handleSendFollowUp,
}) => {
  const store = useColdMailStore();
  const [copiedEmail, setCopiedEmail] = React.useState<string | null>(null);

  // A/B Testing Metrics
  const variantAContacts = store.contacts.filter((c) => c.abVariant === "A" || !c.abVariant);
  const variantBContacts = store.contacts.filter((c) => c.abVariant === "B");

  const variantASent = variantAContacts.filter((c) => c.status === "sent" || c.status === "replied").length;
  const variantAOpened = variantAContacts.filter((c) => c.opened).length;
  const variantAReplied = variantAContacts.filter((c) => c.status === "replied").length;
  const variantAOpenRate = variantASent > 0 ? Math.round((variantAOpened / variantASent) * 100) : 0;
  const variantAReplyRate = variantASent > 0 ? Math.round((variantAReplied / variantASent) * 100) : 0;

  const variantBSent = variantBContacts.filter((c) => c.status === "sent" || c.status === "replied").length;
  const variantBOpened = variantBContacts.filter((c) => c.opened).length;
  const variantBReplied = variantBContacts.filter((c) => c.status === "replied").length;
  const variantBOpenRate = variantBSent > 0 ? Math.round((variantBOpened / variantBSent) * 100) : 0;
  const variantBReplyRate = variantBSent > 0 ? Math.round((variantBReplied / variantBSent) * 100) : 0;

  const copyToClipboard = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Welcome banner if no contacts */}
      {totalContacts === 0 && (
        <Card className="border-border/80 bg-gradient-to-b from-card to-secondary/30 backdrop-blur-xl shadow-lg rounded-3xl py-16 text-center border-dashed relative overflow-hidden">
          <div className="absolute inset-0 bg-radial-gradient from-primary/5 via-transparent to-transparent opacity-60 pointer-events-none" />
          <div className="max-w-md mx-auto px-4 flex flex-col items-center relative z-10">
            <span className="text-[10px] font-black uppercase tracking-widest bg-primary/10 border border-primary/20 text-primary px-3.5 py-1 rounded-full mb-5 shadow-2xs">
              Outreach Engine Ready
            </span>
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-sm">
              <Mail className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
              Initialize Your Prospect Pipeline
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
              Upload your target contacts spreadsheet (CSV or Excel with Name, Email, Company, Title) or add individual contacts manually.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <input
                type="file"
                ref={csvInputRef}
                onChange={handleFileUpload}
                accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                className="hidden"
              />
              <Button
                onClick={() => csvInputRef.current?.click()}
                className="bg-primary hover:bg-primary/90 text-white font-black px-6 rounded-xl text-xs h-10 flex items-center gap-2 shadow-lg shadow-primary/20 transition-all hover:scale-102"
              >
                <Upload className="w-4 h-4" />
                Import CSV / Excel Sheet
              </Button>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
                className="border-border hover:bg-secondary text-slate-700 dark:text-slate-300 font-bold px-5 rounded-xl text-xs h-10 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Prospect Manually
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Top Hero KPI Metrics Grid */}
      {totalContacts > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: Total Targets Pipeline */}
            <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl p-5 hover:border-primary/40 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Target Pipeline
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {totalContacts}
                </div>
                <Badge variant="outline" className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 border-indigo-500/20 bg-indigo-500/5">
                  {pendingCount} Scheduled
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
                Active recruiter prospects in campaign
              </p>
            </Card>

            {/* Card 2: Outreach Sent & Delivered */}
            <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl p-5 hover:border-cyan-500/40 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Delivered Emails
                </span>
                <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Send className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-cyan-600 dark:text-cyan-400 tracking-tight">
                  {sentCount}
                </div>
                <Badge variant="outline" className="text-[9px] font-bold text-cyan-600 dark:text-cyan-400 border-cyan-500/20 bg-cyan-500/5">
                  {successRate}% Sent
                </Badge>
              </div>
              <div className="mt-3 h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all duration-500" style={{ width: `${successRate}%` }} />
              </div>
            </Card>

            {/* Card 3: Engagement (Opens & Clicks) */}
            <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl p-5 hover:border-amber-500/40 transition-all group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Prospect Engagement
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div>
                  <div className="text-3xl font-black text-amber-600 dark:text-amber-400 tracking-tight flex items-baseline gap-1.5">
                    <span>{openedCount}</span>
                    <span className="text-xs text-slate-400 font-bold">Opened ({totalOpens} Total)</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{openRate}%</span>
                  <span className="text-[9px] text-slate-400 block font-medium">Open Rate</span>
                </div>
              </div>
              <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className="text-[9px] font-bold border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10 py-0 px-1.5 h-4">
                  {ctaClickedCount} CTA Clicks
                </Badge>
                {docClickedCount > 0 && (
                  <Badge variant="outline" className="text-[9px] font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-0 px-1.5 h-4">
                    {docClickedCount} Doc Reads
                  </Badge>
                )}
                <span className="text-[10px] text-slate-400 font-medium">({clickRate}% CTA Rate)</span>
              </div>
            </Card>

            {/* Card 4: Recruiter Replies & Conversion */}
            <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl p-5 hover:border-emerald-500/40 transition-all group glow-emerald">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recruiter Replies
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Reply className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline justify-between">
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {repliedCount}
                </div>
                <Badge variant="outline" className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/20 bg-emerald-500/5">
                  {replyRate}% Reply Rate
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-2">
                Positive recruiter reply threads received
              </p>
            </Card>
          </div>

          {/* Visual Analytics Row */}
          {mounted && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left: Company Volumes */}
              <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden flex flex-col h-[300px]">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="font-bold text-slate-900 dark:text-white text-xs tracking-tight flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-primary" />
                    Top Companies in Directory
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 flex-1 flex items-center justify-center">
                  {companyBarData.length === 0 ? (
                    <span className="text-xs text-muted-foreground">No volume metrics loaded</span>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={companyBarData} layout="vertical" margin={{ left: -5, right: 10, top: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#06b6d4" />
                          </linearGradient>
                        </defs>
                        <XAxis type="number" fontSize={9} fontStyle="bold" stroke="#94a3b8" tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" fontSize={9} stroke="#94a3b8" width={80} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }} />
                        <Bar dataKey="count" fill="url(#barGradient)" radius={[0, 4, 4, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Middle: Outreach Conversion Funnel */}
              <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden flex flex-col h-[300px]">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="font-bold text-slate-900 dark:text-white text-xs tracking-tight flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    Outreach Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-1 flex-1 flex flex-row items-center justify-between gap-2">
                  <div className="w-[50%] h-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          innerRadius={45}
                          outerRadius={65}
                          paddingAngle={3}
                          dataKey="value"
                          cx="50%"
                          cy="50%"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: '10px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--card)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-lg font-black text-slate-800 dark:text-white">{totalContacts}</span>
                      <span className="text-[8px] text-slate-400 uppercase font-black tracking-wider">Targets</span>
                    </div>
                  </div>
                  <div className="w-[50%] space-y-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 pl-2">
                    {chartData.map((d, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="truncate">{d.name}</span>
                        <span className="font-bold ml-auto text-slate-700 dark:text-slate-300">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Right: Live Activity Feed */}
              <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden flex flex-col h-[300px]">
                <CardHeader className="pb-2 pt-4 px-5">
                  <CardTitle className="font-bold text-slate-900 dark:text-white text-xs tracking-tight flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Live Activity Stream
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden flex-1 text-xs">
                  <ScrollArea className="h-[230px] px-4">
                    <div className="divide-y divide-border/60">
                      {recentActivities.slice(0, 10).map((c) => (
                        <div key={c.id} className="py-2.5 flex items-start gap-2.5 hover:bg-secondary/20 transition-all rounded-lg px-2 -mx-1">
                          <div className="w-7 h-7 rounded-xl bg-secondary/80 border border-border/80 flex items-center justify-center shrink-0 text-[9px] font-black text-slate-700 dark:text-slate-300">
                            {c.name.split(" ").filter(Boolean).map(x => x[0]).join("").substring(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-800 dark:text-slate-200 truncate text-[11px]">
                              {c.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-medium truncate">
                              {c.title} · {c.company}
                            </p>
                          </div>
                          <StatusBadge status={c.status} unsubscribed={c.unsubscribed} />
                        </div>
                      ))}
                      {recentActivities.length === 0 && (
                        <div className="text-center py-16 text-slate-400 font-medium text-xs">No activity log yet</div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          )}

          {/* A/B Subject Testing & Conversion Deck */}
          {sentCount > 0 && (
            <Card className="border-border/80 bg-gradient-to-r from-sky-500/5 via-indigo-500/5 to-purple-500/5 backdrop-blur-md shadow-xs rounded-2xl p-4.5 border">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3.5">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white tracking-tight">
                      Subject Line A/B Optimization Benchmark
                    </h4>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      Comparing Direct Technical Pitch (Variant A) vs. Conversational Role Inquiry (Variant B)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {variantBOpenRate > variantAOpenRate ? (
                    <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] font-black">
                      Variant B Leading (+{variantBOpenRate - variantAOpenRate}% Open Rate)
                    </Badge>
                  ) : variantAOpenRate > variantBOpenRate ? (
                    <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[9px] font-black">
                      Variant A Leading (+{variantAOpenRate - variantBOpenRate}% Open Rate)
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[9px] font-bold text-slate-500">
                      Even Benchmark Performance
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-card/80 border border-border/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-sky-500" />
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">Variant A (Direct Skills Hook)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">{variantASent} Sent</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <div>Opens: <span className="text-sky-600 font-black">{variantAOpened}</span> ({variantAOpenRate}%)</div>
                    <div>Replies: <span className="text-emerald-600 font-black">{variantAReplied}</span> ({variantAReplyRate}%)</div>
                  </div>
                </div>

                <div className="p-3 bg-card/80 border border-border/80 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      <span className="text-xs font-black text-slate-800 dark:text-slate-200">Variant B (Conversational Inquiry)</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono font-bold">{variantBSent} Sent</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <div>Opens: <span className="text-indigo-600 font-black">{variantBOpened}</span> ({variantBOpenRate}%)</div>
                    <div>Replies: <span className="text-emerald-600 font-black">{variantBReplied}</span> ({variantBReplyRate}%)</div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* HR Outreach Directory Table Container */}
          <Card className="border-border/80 bg-card/90 backdrop-blur-md shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border/80 bg-secondary/20 py-4 px-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="font-black text-slate-900 dark:text-white text-base tracking-tight flex items-center gap-2">
                  <span>Prospect Directory</span>
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/20 text-primary bg-primary/5">
                    {filteredContacts.length} of {totalContacts}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                  Audit live communication loops, email deliveries, and reply statuses
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={csvInputRef}
                  onChange={handleFileUpload}
                  accept=".csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => csvInputRef.current?.click()}
                  className="border-border hover:bg-secondary rounded-xl text-xs font-bold px-3 py-1.5 h-8.5 flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Import Sheet
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAddDialogOpen(true)}
                  className="bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black px-3.5 py-1.5 h-8.5 flex items-center gap-1.5 shadow-sm shadow-primary/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Prospect
                </Button>
                {store.contacts.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDeleteAllContacts}
                    className="text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl text-xs h-8.5 px-2.5"
                    title="Delete all contacts"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </CardHeader>

            {/* Filter Pills and Search Bar */}
            <div className="p-3.5 px-5 border-b border-border/60 bg-secondary/10 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Button
                  variant={store.statusFilter === "all" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("all")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  All ({totalContacts})
                </Button>
                <Button
                  variant={store.statusFilter === "pending" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("pending")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  Scheduled ({pendingCount})
                </Button>
                <Button
                  variant={store.statusFilter === "sent" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("sent")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  Delivered ({deliveredCount})
                </Button>
                <Button
                  variant={store.statusFilter === "opened" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("opened")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  Opened ({openedCount})
                </Button>
                <Button
                  variant={store.statusFilter === "clicked" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("clicked")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  Clicked ({clickedCount})
                </Button>
                <Button
                  variant={store.statusFilter === "replied" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("replied")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  Replied ({repliedCount})
                </Button>
                <Button
                  variant={store.statusFilter === "failed" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("failed")}
                  size="sm"
                  className="h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5"
                >
                  Bounced ({failedCount})
                </Button>
                <Button
                  variant={store.statusFilter === "unsubscribed" ? "default" : "outline"}
                  onClick={() => store.setStatusFilter("unsubscribed")}
                  size="sm"
                  className={`h-7.5 rounded-lg font-bold text-[10px] py-1 px-2.5 ${
                    store.statusFilter === "unsubscribed"
                      ? "bg-rose-600 hover:bg-rose-700 text-white"
                      : "border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
                  }`}
                >
                  <UserX className="w-3 h-3 mr-1" />
                  Unsubscribed ({unsubscribedCount})
                </Button>
              </div>

              {/* Search Bar */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  placeholder="Search name, company, email..."
                  value={store.searchQuery}
                  onChange={(e) => store.setSearchQuery(e.target.value)}
                  className="pl-8 pr-7 text-xs h-8 rounded-xl bg-card border-border/80"
                />
                {store.searchQuery && (
                  <button
                    onClick={() => store.setSearchQuery("")}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Prospects Table */}
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-border/80 bg-secondary/30 hover:bg-secondary/30">
                    <TableHead className="w-10 px-4">
                      <Checkbox
                        checked={
                          paginatedContacts.length > 0 &&
                          paginatedContacts.every((c) => selectedContacts.includes(c.id))
                        }
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-black text-slate-600 dark:text-slate-300">Target Contact</TableHead>
                    <TableHead className="text-xs font-black text-slate-600 dark:text-slate-300">Company</TableHead>
                    <TableHead className="text-xs font-black text-slate-600 dark:text-slate-300">Designation</TableHead>
                    <TableHead className="text-xs font-black text-slate-600 dark:text-slate-300">Outreach Status</TableHead>
                    <TableHead className="text-xs font-black text-slate-600 dark:text-slate-300 text-center w-16">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.map((contact) => {
                    const isSelected = selectedContacts.includes(contact.id);
                    return (
                      <TableRow
                        key={contact.id}
                        data-state={isSelected ? "selected" : undefined}
                        className="border-b border-border/60 hover:bg-secondary/20 transition-colors"
                      >
                        <TableCell className="px-4">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleSelectContact(contact.id)}
                            aria-label={`Select ${contact.name}`}
                          />
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                              {contact.name}
                            </span>
                            {/* A/B Variant Badge */}
                            <Badge variant="outline" className="text-[8px] font-mono px-1 py-0 h-3.5 border-slate-400/30 text-slate-500">
                              Var {contact.abVariant || 'A'}
                            </Badge>
                            {/* Follow-Up Stage Badge */}
                            {contact.followUpStep === 1 && (
                              <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20 text-[8px] h-3.5 py-0 px-1 font-bold leading-none">
                                Follow-Up 1 Sent
                              </Badge>
                            )}
                            {contact.followUpStep === 2 && (
                              <Badge className="bg-indigo-500/10 text-indigo-600 border-indigo-500/20 text-[8px] h-3.5 py-0 px-1 font-bold leading-none">
                                Follow-Up 2 Sent
                              </Badge>
                            )}
                            {/* Live Engagement Badges */}
                            {contact.unsubscribed && (
                              <Badge className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[8px] h-3.5 py-0 px-1 font-black leading-none">
                                Unsubscribed
                              </Badge>
                            )}
                            {contact.openCount > 0 && (
                              <Badge className="bg-cyan-500/10 text-cyan-600 border-cyan-500/20 text-[8px] h-3.5 py-0 px-1 font-black leading-none flex items-center">
                                <Eye className="w-2 h-2 mr-0.5" /> {contact.openCount}x Opens
                              </Badge>
                            )}
                            {contact.ctaClicked && (
                              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[8px] h-3.5 py-0 px-1 font-black leading-none">
                                CTA Clicked
                              </Badge>
                            )}
                            {contact.docClicked && (
                              <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[8px] h-3.5 py-0 px-1 font-black leading-none">
                                Doc Read
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-450 dark:text-slate-400 font-mono select-all">
                              {contact.email}
                            </span>
                            <button
                              onClick={() => copyToClipboard(contact.email)}
                              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                              title="Copy email"
                            >
                              {copiedEmail === contact.email ? (
                                <Check className="w-2.5 h-2.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                          {contact.company}
                        </TableCell>
                        <TableCell className="text-slate-600 dark:text-slate-400 text-xs font-medium">
                          {contact.title}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <div
                              onClick={() => contact.status === "replied" && setViewReplyContact(contact)}
                              className={contact.status === "replied" ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}
                            >
                              <StatusBadge status={contact.status} unsubscribed={contact.unsubscribed} />
                            </div>
                            {contact.status === "replied" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewReplyContact(contact)}
                                className="h-6 px-2 text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg flex items-center gap-1 shrink-0"
                              >
                                <Reply className="w-2.5 h-2.5" />
                                <span>Copilot</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                className="h-7 w-7 p-0 rounded-lg hover:bg-secondary text-slate-400"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 bg-card border-border rounded-xl shadow-lg">
                              {/* Open compose/preview dialog */}
                              <DropdownMenuItem
                                onClick={() => handlePreviewEmail(contact)}
                                className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                <Mail className="w-3.5 h-3.5 mr-2 text-primary" />
                                {contact.status === "pending" || contact.status === "failed" ? "Compose Email" : "Inspect Outreach"}
                              </DropdownMenuItem>

                              {/* Manual Send Follow-Up option */}
                              {contact.status === "sent" && !contact.repliedAt && handleSendFollowUp && (
                                <DropdownMenuItem
                                  onClick={() => handleSendFollowUp(contact, (contact.followUpStep ?? 0) + 1)}
                                  className="text-xs font-bold text-purple-600 dark:text-purple-400 cursor-pointer"
                                >
                                  <Sparkles className="w-3.5 h-3.5 mr-2 text-purple-500" />
                                  Send Follow-Up {(contact.followUpStep ?? 0) + 1}
                                </DropdownMenuItem>
                              )}

                              {/* View Sent details */}
                              {(contact.status === "sent" || contact.status === "replied") && (
                                <DropdownMenuItem
                                  onClick={() => setViewSentContact(contact)}
                                  className="text-xs font-bold text-cyan-600 dark:text-cyan-400 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 mr-2" />
                                  Engagement Details
                                </DropdownMenuItem>
                              )}

                              {/* View Reply dialog */}
                              {contact.status === "replied" && (
                                <DropdownMenuItem
                                  onClick={() => setViewReplyContact(contact)}
                                  className="text-xs font-black text-indigo-600 dark:text-indigo-400 cursor-pointer"
                                >
                                  <MessageSquare className="w-3.5 h-3.5 mr-2" />
                                  Read Received Reply
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuItem
                                onClick={() => openEditDialog(contact)}
                                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                <Edit className="w-3.5 h-3.5 mr-2" />
                                Edit Prospect
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => handleResetStatus(contact)}
                                className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5 mr-2" />
                                Reset Status
                              </DropdownMenuItem>

                              <DropdownMenuSeparator />

                              <DropdownMenuItem
                                onClick={() => handleDeleteContact(contact)}
                                className="text-xs font-bold text-rose-500 hover:text-rose-600 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 mr-2" />
                                Delete Prospect
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredContacts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-slate-400 font-medium text-xs">
                        No targets match your current search or filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-3.5 px-5 border-t border-border/80 bg-secondary/10 flex items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Showing page {safeCurrentPage} of {totalPages} ({filteredContacts.length} targets)
                </p>
                <div className="flex gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeCurrentPage === 1}
                    onClick={() => store.setCurrentPage(safeCurrentPage - 1)}
                    className="h-7.5 rounded-lg border-border font-bold text-xs px-2.5"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 mr-0.5" /> Prev
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={safeCurrentPage === totalPages}
                    onClick={() => store.setCurrentPage(safeCurrentPage + 1)}
                    className="h-7.5 rounded-lg border-border font-bold text-xs px-2.5"
                  >
                    Next <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Floating selection dashboard */}
          <AnimatePresence>
            {selectedContacts.length > 0 && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 text-white rounded-2xl shadow-2xl py-3 px-5 flex items-center gap-4"
              >
                <span className="text-xs font-bold select-none text-slate-300">
                  {selectedContacts.length} Selected
                </span>
                <div className="h-4 w-px bg-slate-700" />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={handleBulkSend}
                    disabled={isBulkProcessing}
                    className="bg-primary hover:bg-primary/90 text-white font-black h-8 rounded-xl text-xs px-3.5 shadow-md shadow-primary/30"
                  >
                    {isBulkProcessing ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Send Outreach Campaign
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleBulkReset}
                    disabled={isBulkProcessing}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 font-bold h-8 rounded-xl text-xs"
                  >
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleBulkDelete}
                    disabled={isBulkProcessing}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 font-bold h-8 rounded-xl text-xs"
                  >
                    Delete
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
