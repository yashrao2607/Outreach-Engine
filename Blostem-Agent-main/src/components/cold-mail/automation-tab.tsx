"use client";

import React from "react";
import {
  Zap,
  Play,
  Pause,
  Terminal,
  Loader2,
  Info,
  Server,
  Cpu,
  CheckCircle2,
  Radio,
  Sliders,
  Clock,
  Layers,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useColdMailStore } from "@/lib/store";

interface AutomationTabProps {
  batchSize: string;
  setBatchSize: (size: string) => void;
  intervalMinutes: string;
  setIntervalMinutes: (minutes: string) => void;
  startAgent: () => void;
  stopAgent: () => void;
}

export const AutomationTab: React.FC<AutomationTabProps> = ({
  batchSize,
  setBatchSize,
  intervalMinutes,
  setIntervalMinutes,
  startAgent,
  stopAgent,
}) => {
  const store = useColdMailStore();

  const formatTimestamp = (ts: string) => {
    if (!ts) return "";
    if (!ts.includes("-") && !ts.includes("T") && ts.includes(":")) return ts;
    try {
      return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return ts;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
      {/* Agent Auto-Scheduler Control Deck */}
      <Card className="border-border/80 bg-card/85 backdrop-blur-md shadow-xs rounded-2xl overflow-hidden flex flex-col justify-between h-[540px]">
        <div>
          <CardHeader className="pb-3 pt-5 px-6 border-b border-border/60 bg-secondary/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="font-black text-slate-900 dark:text-white text-sm tracking-tight">
                    Autonomous Agent Scheduler
                  </CardTitle>
                  <CardDescription className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Continuous outreach loop engine
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className={`text-[9px] font-black uppercase ${store.isAgentRunning ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" : "border-slate-500/20 text-slate-400"}`}>
                {store.isAgentRunning ? "Running" : "Standby"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4.5 px-6 pt-4">
            {/* Batch Processing Size */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Batch Processing Size
              </Label>
              <Select value={batchSize} onValueChange={setBatchSize}>
                <SelectTrigger className="border-border bg-secondary/30 text-slate-900 dark:text-white h-9 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Select batch size" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="5">5 HR prospects / execution loop</SelectItem>
                  <SelectItem value="10">10 HR prospects / execution loop</SelectItem>
                  <SelectItem value="20">20 HR prospects / execution loop</SelectItem>
                  <SelectItem value="50">50 HR prospects / execution loop</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sleep Interval */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" />
                Cooldown Interval Between Loops
              </Label>
              <Select value={intervalMinutes} onValueChange={setIntervalMinutes}>
                <SelectTrigger className="border-border bg-secondary/30 text-slate-900 dark:text-white h-9 rounded-xl text-xs font-bold">
                  <SelectValue placeholder="Select sleep interval" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border bg-card">
                  <SelectItem value="1">1 minute cooldown</SelectItem>
                  <SelectItem value="3">3 minutes cooldown</SelectItem>
                  <SelectItem value="5">5 minutes cooldown (Recommended)</SelectItem>
                  <SelectItem value="10">10 minutes cooldown</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Play / Pause Toggle Button */}
            <div className="pt-2">
              {store.isAgentRunning ? (
                <Button
                  onClick={stopAgent}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-5 rounded-xl shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 text-xs transition-all hover:scale-102"
                >
                  <Pause className="w-4 h-4" />
                  Pause Autonomous Execution
                </Button>
              ) : (
                <Button
                  onClick={startAgent}
                  className="w-full bg-primary hover:bg-primary/90 text-white font-black py-5 rounded-xl shadow-lg shadow-primary/25 flex items-center justify-center gap-2 text-xs transition-all hover:scale-102"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Activate Autonomous Engine
                </Button>
              )}
            </div>

            {/* Live State Banner */}
            {store.isAgentRunning && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 font-black leading-tight">
                  Engine active: Processing {batchSize} targets every {intervalMinutes}m.
                </p>
              </div>
            )}
          </CardContent>
        </div>

        {/* Safety checklist */}
        <div className="px-6 pb-5 pt-3 border-t border-border/40 bg-secondary/5 mt-auto">
          <h4 className="text-[9px] font-black uppercase text-slate-400 tracking-wider mb-2 flex items-center gap-1">
            <Info className="w-3 h-3 text-primary" />
            Autonomous Protection Protocol
          </h4>
          <ul className="space-y-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium">
            <li className="flex items-start gap-2">
              <Server className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>Rotates email delays to maintain 99.8% inbox deliverability.</span>
            </li>
            <li className="flex items-start gap-2">
              <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>Grounds each draft with prospect resume context and company signals.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>Automatically suppresses unsubscribed &amp; bounced contacts.</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Developer Terminal Live Stream */}
      <Card className="border-slate-800 bg-slate-950 shadow-2xl rounded-2xl overflow-hidden lg:col-span-2 flex flex-col h-[540px]">
        {/* Terminal Titlebar */}
        <div className="bg-slate-900/90 backdrop-blur-md px-5 py-3 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 select-none">
              <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444] opacity-80 hover:opacity-100 transition-opacity" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#eab308] opacity-80 hover:opacity-100 transition-opacity" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e] opacity-80 hover:opacity-100 transition-opacity" />
            </div>
            <span className="text-[10px] font-bold text-slate-400 font-mono tracking-wider ml-1 select-none flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-cyan-400" />
              outreach-agent-telemetry ~ live outbox loop
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <Badge className="text-[8px] uppercase font-black tracking-widest bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 py-0.5 select-none">
              Live Feed
            </Badge>
          </div>
        </div>

        {/* Terminal Content Stream */}
        <CardContent className="flex-1 p-0 font-mono text-[11px] text-slate-300 relative flex flex-col justify-between overflow-hidden">
          <ScrollArea className="flex-1 p-5 h-full">
            <div className="space-y-2">
              {store.logs.map((log) => {
                let colorClass = "text-slate-400";
                if (log.type === "success") colorClass = "text-emerald-400 font-bold";
                if (log.type === "error") colorClass = "text-rose-400 font-bold";
                if (log.type === "warning") colorClass = "text-amber-400";
                if (log.type === "info") colorClass = "text-cyan-400";

                return (
                  <div key={log.id} className="leading-relaxed whitespace-pre-wrap select-text flex items-start">
                    <span className="text-slate-600 mr-2.5 shrink-0 select-none font-bold">
                      [{formatTimestamp(log.timestamp)}]
                    </span>
                    <span className={colorClass}>{log.message}</span>
                  </div>
                );
              })}
              {store.logs.length === 0 && (
                <div className="text-slate-600 italic py-24 text-center select-none text-xs">
                  Terminal stream initialized. Awaiting autonomous outbox events...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Terminal Footer */}
          <div className="px-5 py-2.5 bg-slate-900/60 border-t border-slate-800/80 flex justify-between items-center shrink-0 select-none">
            <span className="text-[10px] text-slate-500 font-bold font-mono">
              {store.logs.length} telemetry records logged
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={store.clearLogs}
              className="text-[10px] h-6.5 text-slate-400 hover:text-white hover:bg-slate-800 px-2.5 rounded-lg font-mono"
            >
              Clear Buffer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
