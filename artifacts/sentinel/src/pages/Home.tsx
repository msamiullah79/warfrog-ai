import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import {
  UploadCloud, X, ShieldAlert, CheckCircle, AlertTriangle,
  ChevronDown, Image as ImageIcon, FileText, Activity,
  Zap, Shield, CircleDot, BarChart3, Brain
} from "lucide-react";
import { useAnalyzeContent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetHistoryQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";

// ─── helpers ─────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-400";
  if (score >= 40) return "text-yellow-400";
  return "text-red-400";
}

function scoreBg(score: number) {
  if (score >= 70) return "bg-emerald-500/10 border-emerald-500/30";
  if (score >= 40) return "bg-yellow-500/10 border-yellow-500/30";
  return "bg-red-500/10 border-red-500/30";
}

function predictionPill(prediction: string) {
  if (prediction === "Real")
    return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  if (prediction === "Fake")
    return "bg-red-500/15 text-red-400 border border-red-500/30";
  return "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30";
}

function predictionIcon(prediction: string) {
  if (prediction === "Real") return <CheckCircle className="w-5 h-5" />;
  if (prediction === "Fake") return <X className="w-5 h-5" />;
  return <AlertTriangle className="w-5 h-5" />;
}

function anomalyColor(score: number) {
  if (score >= 40) return "text-red-400";
  if (score >= 20) return "text-yellow-400";
  return "text-emerald-400";
}

// ─── main component ───────────────────────────────────────────

export default function Home() {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const queryClient = useQueryClient();

  // Handle "Re-run Analysis" handoff from History page
  useEffect(() => {
    const rerunText = sessionStorage.getItem("rerun_text");
    if (rerunText) {
      setText(rerunText);
      sessionStorage.removeItem("rerun_text");
    }
  }, []);

  const { mutate, isPending, error } = useAnalyzeContent({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      },
    },
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/*": [] },
    maxFiles: 1,
  });

  const clearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  const handleAnalyze = () => {
    if (!text.trim()) return;
    setResult(null);
    mutate({ data: { text, image: imageFile as any } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10 space-y-8">

      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-2">
            War<span className="text-gradient">Frog</span>
          </h1>
          <p className="text-sm text-muted-foreground tracking-wide uppercase font-medium">
            AI-powered disinformation analysis system
          </p>
        </div>

        {/* Status badge */}
        <div className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-bold uppercase tracking-wider self-start sm:self-auto",
          isPending
            ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
        )}>
          <span className={cn(
            "w-2 h-2 rounded-full",
            isPending ? "bg-yellow-400 animate-pulse" : "bg-emerald-400"
          )} />
          {isPending ? "Analyzing..." : "System Ready"}
        </div>
      </div>

      {/* ── Two-column grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ── Input Panel (left) ──────────────────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/60 to-transparent" />

            {/* Text input */}
            <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
              <FileText className="w-4 h-4 text-primary" />
              Source Text
            </label>
            <textarea
              className="w-full h-56 bg-background/50 border border-border/50 rounded-xl p-4 text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/50 transition-all resize-none text-sm leading-relaxed"
              placeholder="Paste news article here…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {/* Image upload */}
            <div className="mt-5">
              <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                <ImageIcon className="w-4 h-4 text-primary" />
                Image Evidence
                <span className="text-xs opacity-40 lowercase normal-case font-normal">(optional)</span>
              </label>

              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl text-center cursor-pointer transition-all duration-200 relative overflow-hidden group",
                  isDragActive
                    ? "border-primary bg-primary/5"
                    : "border-border/40 hover:border-primary/50 hover:bg-secondary/20",
                  previewUrl
                    ? "p-1 border-solid border-border/40 bg-background/50"
                    : "h-28 flex flex-col items-center justify-center"
                )}
              >
                <input {...getInputProps()} />
                {previewUrl ? (
                  <div className="relative w-full h-36 rounded-lg overflow-hidden">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white text-sm font-medium">Click to replace</p>
                    </div>
                    <button
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className={cn("w-7 h-7 mb-2 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground/50")} />
                    <p className="text-sm text-muted-foreground">Drag & drop image or click to browse</p>
                  </>
                )}
              </div>
            </div>

            {/* Analyze button */}
            <button
              onClick={handleAnalyze}
              disabled={isPending || !text.trim()}
              className="mt-5 w-full relative group overflow-hidden rounded-xl font-display font-bold tracking-widest uppercase py-4 bg-secondary text-foreground border border-border/50 hover:border-primary hover:text-primary transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative flex items-center justify-center gap-2">
                {isPending ? (
                  <>
                    <Activity className="w-5 h-5 animate-pulse text-primary" />
                    Analyzing Data...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5 group-hover:text-primary transition-colors" />
                    Run Analysis
                  </>
                )}
              </span>
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-400 font-medium">
                  {(error as any)?.error?.error || "Analysis failed. Check your connection and try again."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Results Panel (right) ────────────────────────────── */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">

            {/* Idle state */}
            {!result && !isPending && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                className="min-h-[440px] flex flex-col items-center justify-center border border-dashed border-border/30 rounded-2xl bg-secondary/5"
              >
                <div className="w-20 h-20 mb-6 rounded-full bg-secondary/30 flex items-center justify-center relative">
                  <div className="absolute inset-0 border border-muted-foreground/20 rounded-full animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-2 border border-dashed border-primary/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                  <Shield className="w-8 h-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-lg font-display font-medium text-muted-foreground uppercase tracking-widest">Awaiting Input</h3>
                <p className="text-sm text-muted-foreground/50 mt-2 max-w-xs text-center">
                  Paste article text and click Run Analysis to begin credibility assessment.
                </p>
              </motion.div>
            )}

            {/* Loading state */}
            {isPending && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="min-h-[440px] flex flex-col items-center justify-center border border-primary/20 rounded-2xl glass-panel relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_infinite]" />
                <div className="relative w-28 h-28 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
                  <div className="absolute inset-4 rounded-full border-b-2 border-primary/50 animate-[spin_2s_linear_infinite_reverse]" />
                  <Brain className="w-8 h-8 text-primary animate-pulse" />
                </div>
                <h3 className="text-2xl font-display font-bold text-foreground uppercase tracking-widest mb-3">Processing</h3>
                <div className="flex gap-1.5 mb-6">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
                <div className="space-y-2 w-56 text-center">
                  <div className="h-1 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 animate-[pulse_1s_ease-in-out_infinite] w-3/4" />
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">Running heuristic models…</p>
                </div>
              </motion.div>
            )}

            {/* Results */}
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-4"
              >
                {/* ── Score Card ─────────────────────────────── */}
                <div className={cn("glass-panel rounded-2xl p-6 border relative overflow-hidden", scoreBg(result.credibility_score))}>
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />

                  <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">

                    {/* Big score number */}
                    <div className="flex flex-col items-center shrink-0">
                      <div className={cn("text-7xl font-display font-black tabular-nums leading-none", scoreColor(result.credibility_score))}>
                        {result.credibility_score}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-1 uppercase tracking-widest">/ 100</div>
                      <div className="text-xs text-muted-foreground mt-0.5 uppercase tracking-wider font-medium">Credibility</div>
                    </div>

                    {/* Prediction + breakdown */}
                    <div className="flex-1 space-y-4 text-center sm:text-left">
                      {/* Prediction pill */}
                      <div className="flex items-center justify-center sm:justify-start gap-3">
                        <span className={cn(
                          "inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold uppercase tracking-widest",
                          predictionPill(result.prediction)
                        )}>
                          {predictionIcon(result.prediction)}
                          {result.prediction}
                        </span>

                        {/* Anomaly score */}
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border bg-background/40",
                          result.text_analysis.anomaly_score >= 40
                            ? "border-red-500/40 text-red-400"
                            : result.text_analysis.anomaly_score >= 20
                              ? "border-yellow-500/40 text-yellow-400"
                              : "border-emerald-500/40 text-emerald-400"
                        )}>
                          <Zap className="w-3 h-3" />
                          Anomaly {result.text_analysis.anomaly_score}
                        </span>
                      </div>

                      {/* Score breakdown */}
                      <div className="bg-background/40 border border-border/40 rounded-xl p-4 space-y-2">
                        <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
                          <BarChart3 className="w-4 h-4" /> Score Breakdown
                        </h4>
                        {result.image_analysis.has_image ? (
                          <>
                            <ScoreRow label="Text Score" value={result.text_analysis.score} weight="× 70%" />
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
                  </div>
                </div>

                {/* ── Signal Summary ─────────────────────────── */}
                <div className="glass-panel rounded-xl p-5 border border-border/40">
                  <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                    <CircleDot className="w-4 h-4 text-primary" /> Signal Summary
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {result.text_analysis.positive_signals.map((sig, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-emerald-400/90 bg-emerald-500/5 border border-emerald-500/15 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{sig}</span>
                      </div>
                    ))}
                    {result.text_analysis.flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-yellow-400/90 bg-yellow-500/5 border border-yellow-500/15 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{flag}</span>
                      </div>
                    ))}
                    {result.text_analysis.positive_signals.length === 0 && result.text_analysis.flags.length === 0 && (
                      <p className="text-sm text-muted-foreground/60 italic col-span-2">No significant signals detected.</p>
                    )}
                  </div>
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Explanation + Detailed Breakdown (full width, below) ── */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            className="space-y-4"
          >
            {/* Analysis Summary */}
            <div className="glass-panel rounded-2xl p-6 border border-border/40">
              <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4">
                <Brain className="w-4 h-4 text-primary" /> Analysis Summary
              </h3>
              <ul className="space-y-2">
                {result.explanation.map((exp, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-foreground/85 leading-relaxed">
                    <span className="text-primary mt-1 shrink-0">▰</span>
                    <span>{exp}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Detailed Breakdown Accordions */}
            <DetailsPanel
              title="Text Analysis Telemetry"
              icon={<FileText className="w-4 h-4 text-primary" />}
              score={result.text_analysis.score}
              flags={result.text_analysis.flags}
              signals={result.text_analysis.positive_signals}
              defaultOpen={true}
            />

            {result.image_analysis.has_image && (
              <ImageAnalysisPanel
                imageAnalysis={result.image_analysis}
                anomalyScore={result.text_analysis.anomaly_score}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
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

function DetailsPanel({
  title, icon, score, flags, signals, defaultOpen = false,
}: {
  title: string;
  icon: React.ReactNode;
  score: number;
  flags: string[];
  signals: string[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-display font-bold uppercase tracking-wider text-sm text-foreground">{title}</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-bold font-mono border",
            score >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
            score >= 40 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                         "text-red-400 bg-red-500/10 border-red-500/30"
          )}>
            {Math.round(score)}/100
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-6 border-t border-border/40 grid grid-cols-1 md:grid-cols-2 gap-6 bg-background/20">
              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-400 mb-3">
                  <AlertTriangle className="w-4 h-4" /> Detected Anomalies
                </h4>
                {flags.length > 0 ? (
                  <ul className="space-y-2">
                    {flags.map((flag, i) => (
                      <li key={i} className="text-sm bg-red-500/5 border border-red-500/20 text-red-400/90 px-3 py-2 rounded-lg flex items-start gap-2 leading-relaxed">
                        <span className="shrink-0 mt-0.5 text-xs">✕</span> {flag}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">
                    No significant anomalies detected.
                  </p>
                )}
              </div>

              <div>
                <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                  <CheckCircle className="w-4 h-4" /> Authenticity Signals
                </h4>
                {signals.length > 0 ? (
                  <ul className="space-y-2">
                    {signals.map((signal, i) => (
                      <li key={i} className="text-sm bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/90 px-3 py-2 rounded-lg flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-xs">✓</span> {signal}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">
                    No strong positive signals identified.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ImageAnalysisPanel({
  imageAnalysis,
  anomalyScore,
}: {
  imageAnalysis: AnalysisResult["image_analysis"];
  anomalyScore: number;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const contextMatch = anomalyScore > 30 ? "Weak" : "Neutral";
  const contextMatchColor = anomalyScore > 30 ? "text-red-400" : "text-yellow-400";

  const hasExifFlag = imageAnalysis.flags.some((f) => f.includes("EXIF metadata found"));
  const hasExifPositive = imageAnalysis.positive_signals.some((s) => s.includes("EXIF"));
  const metadataStatus = hasExifPositive ? "Present" : hasExifFlag ? "Missing" : "N/A";
  const metadataColor =
    metadataStatus === "Present" ? "text-emerald-400" :
    metadataStatus === "Missing" ? "text-red-400" : "text-muted-foreground";

  const notesFlags = imageAnalysis.flags.filter((f) => !f.startsWith("🔍"));
  const osintWarning = imageAnalysis.flags.find((f) => f.startsWith("🔍"));

  return (
    <div className="glass-panel rounded-xl overflow-hidden border border-border/40">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-secondary/20 hover:bg-secondary/40 transition-colors"
      >
        <div className="flex items-center gap-3">
          <ImageIcon className="w-4 h-4 text-primary" />
          <span className="font-display font-bold uppercase tracking-wider text-sm text-foreground">Image Analysis</span>
          <span className={cn(
            "px-2 py-0.5 rounded text-xs font-bold font-mono border",
            imageAnalysis.score >= 70 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" :
            imageAnalysis.score >= 40 ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30" :
                                         "text-red-400 bg-red-500/10 border-red-500/30"
          )}>
            {imageAnalysis.score}/100
          </span>
        </div>
        <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-6 border-t border-border/40 space-y-5 bg-background/20">

              {/* Status grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Metadata</p>
                  <p className={cn("text-sm font-bold", metadataColor)}>{metadataStatus}</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Authenticity</p>
                  <p className="text-sm font-bold text-yellow-400">Unverified</p>
                </div>
                <div className="bg-secondary/30 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Context Match</p>
                  <p className={cn("text-sm font-bold", contextMatchColor)}>{contextMatch}</p>
                </div>
              </div>

              {/* Notes */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Notes</h4>
                <ul className="space-y-2">
                  {osintWarning && (
                    <li className="text-sm bg-blue-500/5 border border-blue-500/20 text-blue-400/90 px-3 py-2 rounded-lg leading-relaxed">
                      {osintWarning}
                    </li>
                  )}
                  {anomalyScore > 30 && (
                    <li className="text-sm bg-red-500/5 border border-red-500/20 text-red-400/90 px-3 py-2 rounded-lg leading-relaxed">
                      ⚠️ Image does not verify the claim — possible context mismatch
                    </li>
                  )}
                  {notesFlags.map((flag, i) => (
                    <li key={i} className="text-sm bg-yellow-500/5 border border-yellow-500/20 text-yellow-400/90 px-3 py-2 rounded-lg leading-relaxed">
                      {flag}
                    </li>
                  ))}
                  {imageAnalysis.positive_signals.map((sig, i) => (
                    <li key={i} className="text-sm bg-emerald-500/5 border border-emerald-500/20 text-emerald-400/90 px-3 py-2 rounded-lg flex items-start gap-2">
                      <span className="shrink-0 mt-0.5 text-xs">✓</span> {sig}
                    </li>
                  ))}
                  {notesFlags.length === 0 && imageAnalysis.positive_signals.length === 0 && !osintWarning && (
                    <li className="text-sm text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">
                      No additional image notes.
                    </li>
                  )}
                </ul>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
