import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Shield, CheckCircle, AlertTriangle, ShieldAlert,
  Zap, BarChart3, FileText, Image as ImageIcon,
  Activity, ChevronDown, RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { useGetHistoryItem } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";

// ─── helpers ──────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function predictionStyle(p: string) {
  if (p === "Real")    return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (p === "Fake")    return "bg-red-500/20    text-red-400    border-red-500/30";
  return                      "bg-yellow-500/20 text-yellow-400  border-yellow-500/30";
}

function PredictionIcon({ p }: { p: string }) {
  if (p === "Real")    return <CheckCircle  className="w-4 h-4" />;
  if (p === "Fake")    return <ShieldAlert  className="w-4 h-4" />;
  return                      <AlertTriangle className="w-4 h-4" />;
}

// ─── sub-components ───────────────────────────────────────────

function ScoreRow({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground/60 font-mono">{weight}</span>
        <span className={cn("font-bold font-mono w-8 text-right", scoreColor(value))}>{value}</span>
      </div>
    </div>
  );
}

function Accordion({
  title, icon, score, flags, signals, defaultOpen = false,
}: {
  title: string; icon: React.ReactNode; score: number;
  flags: string[]; signals: string[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-display font-bold uppercase tracking-wider text-xs text-foreground">{title}</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-bold font-mono border",
            score >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
            score >= 40 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                          "text-red-400    bg-red-500/10    border-red-500/30"
          )}>
            {Math.round(score)}/100
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-5 bg-background/20">
              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-3">
                  <AlertTriangle className="w-3.5 h-3.5" /> Anomaly Signals
                </h4>
                {flags.length > 0 ? (
                  <ul className="space-y-1.5">
                    {flags.map((f, i) => (
                      <li key={i} className="text-xs bg-red-500/5 border border-red-500/20 text-red-400/90 px-3 py-2 rounded-lg flex items-start gap-2 leading-relaxed">
                        <span className="shrink-0 mt-0.5">✕</span> {f}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">No anomalies detected.</p>
                )}
              </div>
              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                  <CheckCircle className="w-3.5 h-3.5" /> Credibility Signals
                </h4>
                {signals.length > 0 ? (
                  <ul className="space-y-1.5">
                    {signals.map((s, i) => (
                      <li key={i} className="text-xs bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/90 px-3 py-2 rounded-lg flex items-start gap-2">
                        <span className="shrink-0 mt-0.5">✓</span> {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">No strong positive signals.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImagePanel({
  imageAnalysis,
  anomalyScore,
}: {
  imageAnalysis: AnalysisResult["image_analysis"];
  anomalyScore: number;
}) {
  const [open, setOpen] = useState(false);
  const contextWeak = anomalyScore > 30;
  const hasExifFlag     = imageAnalysis.flags.some((f) => f.includes("EXIF metadata found"));
  const hasExifPositive = imageAnalysis.positive_signals.some((s) => s.includes("EXIF"));
  const metaStatus = hasExifPositive ? "Present" : hasExifFlag ? "Missing" : "N/A";
  const metaColor  = metaStatus === "Present" ? "text-emerald-400" : metaStatus === "Missing" ? "text-red-400" : "text-muted-foreground";
  const osintNote  = imageAnalysis.flags.find((f) => f.startsWith("🔍"));
  const otherFlags = imageAnalysis.flags.filter((f) => !f.startsWith("🔍"));

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="font-display font-bold uppercase tracking-wider text-xs text-foreground">Image Analysis</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-bold font-mono border",
            imageAnalysis.score >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
            imageAnalysis.score >= 40 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                                         "text-red-400    bg-red-500/10    border-red-500/30"
          )}>
            {imageAnalysis.score}/100
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-border/40 space-y-4 bg-background/20">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Metadata</p>
                  <p className={cn("text-sm font-bold", metaColor)}>{metaStatus}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Authenticity</p>
                  <p className="text-sm font-bold text-yellow-400">Unverified</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Context Match</p>
                  <p className={cn("text-sm font-bold", contextWeak ? "text-red-400" : "text-yellow-400")}>
                    {contextWeak ? "Weak" : "Neutral"}
                  </p>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Notes</h4>
                <ul className="space-y-1.5">
                  {osintNote && (
                    <li className="text-xs bg-blue-500/5 border border-blue-500/20 text-blue-400/90 px-3 py-2 rounded-lg">{osintNote}</li>
                  )}
                  {contextWeak && (
                    <li className="text-xs bg-red-500/5 border border-red-500/20 text-red-400/90 px-3 py-2 rounded-lg">
                      ⚠️ Image does not verify the claim — possible context mismatch
                    </li>
                  )}
                  {otherFlags.map((f, i) => (
                    <li key={i} className="text-xs bg-yellow-500/5 border border-yellow-500/20 text-yellow-400/90 px-3 py-2 rounded-lg">{f}</li>
                  ))}
                  {imageAnalysis.positive_signals.map((s, i) => (
                    <li key={i} className="text-xs bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/90 px-3 py-2 rounded-lg flex items-start gap-2">
                      <span className="shrink-0">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Detail content (used once data is loaded) ────────────────

function DetailContent({
  result,
  onRerun,
}: {
  result: AnalysisResult;
  onRerun?: (text: string) => void;
}) {
  const ta = result.text_analysis as AnalysisResult["text_analysis"] & {
    anomaly_score?: number;
    has_strong_positive?: boolean;
    has_strong_negative?: boolean;
  };
  const anomalyScore = ta.anomaly_score ?? 0;

  return (
    <div className="space-y-5">

      {/* Score header */}
      <div className="bg-background/40 border border-border/40 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1 font-mono">Credibility Score</p>
            <div className={cn("text-6xl font-display font-black leading-none", scoreColor(result.credibility_score))}>
              {result.credibility_score}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1 font-mono">/ 100</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={cn("flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider", predictionStyle(result.prediction))}>
              <PredictionIcon p={result.prediction} />
              {result.prediction}
            </span>
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border",
              anomalyScore >= 60 ? "text-red-400 bg-red-500/10 border-red-500/30" :
              anomalyScore >= 30 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                                    "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
            )}>
              <Zap className="w-3 h-3" /> Anomaly {anomalyScore}
            </span>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="bg-background/40 border border-border/40 rounded-xl p-4 space-y-2">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <BarChart3 className="w-3.5 h-3.5" /> Score Breakdown
          </h4>
          {result.image_analysis.has_image ? (
            <>
              <ScoreRow label="Text Score"  value={result.text_analysis.score}  weight="× 70%" />
              <ScoreRow label="Image Score" value={result.image_analysis.score} weight="× 30%" />
              <div className="border-t border-border/40 pt-2 mt-1 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Final</span>
                <span className={cn("text-lg font-display font-black", scoreColor(result.credibility_score))}>
                  {result.credibility_score}
                </span>
              </div>
            </>
          ) : (
            <>
              <ScoreRow label="Text Score" value={result.text_analysis.score} weight="Text only" />
              <p className="text-xs text-muted-foreground/60 italic mt-1">No image provided — analysis is text-only</p>
            </>
          )}
        </div>
      </div>

      {/* Signal summary strip */}
      <div className="grid grid-cols-2 gap-2">
        <div className={cn("px-3 py-2 rounded-lg border text-xs flex items-center gap-2",
          ta.has_strong_positive
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : "bg-secondary/20    border-border/40       text-muted-foreground")}>
          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
          {ta.has_strong_positive ? "Strong credibility signals" : "No strong credibility signals"}
        </div>
        <div className={cn("px-3 py-2 rounded-lg border text-xs flex items-center gap-2",
          ta.has_strong_negative
            ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-secondary/20 border-border/40 text-muted-foreground")}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {ta.has_strong_negative ? "Strong anomaly signals" : "No strong anomaly signals"}
        </div>
      </div>

      {/* Explanation */}
      {result.explanation.length > 0 && (
        <div className="bg-background/40 border border-border/40 rounded-xl p-5">
          <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            <Shield className="w-3.5 h-3.5" /> Analysis Summary
          </h4>
          <ul className="space-y-2">
            {result.explanation.map((line, i) => (
              <li key={i} className="text-sm text-foreground/80 flex items-start gap-2 leading-relaxed">
                <span className="shrink-0 text-primary mt-0.5">›</span> {line}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Text analysis accordion */}
      <Accordion
        title="Text Analysis"
        icon={<FileText className="w-4 h-4 text-primary" />}
        score={result.text_analysis.score}
        flags={result.text_analysis.flags}
        signals={result.text_analysis.positive_signals}
        defaultOpen={true}
      />

      {/* Image analysis accordion */}
      {result.image_analysis.has_image && (
        <ImagePanel
          imageAnalysis={result.image_analysis}
          anomalyScore={anomalyScore}
        />
      )}

      {/* Full source text */}
      {result.text_content && (
        <SourceTextPanel text={result.text_content} />
      )}

      {/* Re-run button */}
      {onRerun && result.text_content && (
        <button
          onClick={() => onRerun(result.text_content!)}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-primary/40 text-primary hover:bg-primary/10 rounded-xl text-sm font-bold uppercase tracking-wider transition-colors"
        >
          <RotateCcw className="w-4 h-4" /> Re-run Analysis
        </button>
      )}
    </div>
  );
}

function SourceTextPanel({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <FileText className="w-4 h-4 text-muted-foreground" />
          <span className="font-display font-bold uppercase tracking-wider text-xs text-foreground">Full Source Text</span>
          <span className="text-xs text-muted-foreground/60 font-mono">{text.split(/\s+/).length} words</span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", open && "rotate-180")} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="p-5 border-t border-border/40 bg-background/20">
              <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap font-sans">{text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────

export default function AnalysisDetailModal({
  id,
  onClose,
  onRerun,
}: {
  id: number;
  onClose: () => void;
  onRerun?: (text: string) => void;
}) {
  const { data, isLoading, error } = useGetHistoryItem(id);

  // ESC key closes the modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-background/80 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.96, y: 24 }}
        animate={{ scale: 1,    y: 0  }}
        exit={{    scale: 0.96, y: 24 }}
        transition={{ duration: 0.2 }}
        className="glass-panel rounded-2xl w-full max-w-2xl my-8 border border-border/60 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-sm uppercase tracking-widest text-foreground">
              Intelligence Report
            </span>
            <span className="text-xs font-mono text-muted-foreground/60">#{id}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="py-16 flex flex-col items-center gap-4">
              <Activity className="w-8 h-8 text-primary animate-pulse" />
              <p className="text-sm text-muted-foreground font-mono">Loading intelligence report…</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center">
              <ShieldAlert className="w-10 h-10 text-destructive mx-auto mb-3" />
              <p className="text-destructive font-medium">Failed to load record.</p>
            </div>
          ) : data ? (
            <DetailContent result={data} onRerun={onRerun} />
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  );
}
