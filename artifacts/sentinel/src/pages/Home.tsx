import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import { 
  UploadCloud, X, ShieldAlert, CheckCircle, AlertTriangle, 
  ChevronDown, Image as ImageIcon, FileText, Activity 
} from "lucide-react";
import { useAnalyzeContent } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetHistoryQueryKey } from "@workspace/api-client-react";
import { Gauge } from "@/components/ui/gauge";
import { cn, getStatusColor, getStatusGlow } from "@/lib/utils";
import type { AnalysisResult } from "@workspace/api-client-react/src/generated/api.schemas";

export default function Home() {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const queryClient = useQueryClient();
  
  const { mutate, isPending, error } = useAnalyzeContent({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    }
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 1
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
    // Explicitly casting to any to bypass strict Orval types if they strictly expect Blob and not File
    mutate({ data: { text, image: imageFile as any } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12 space-y-8">
      
      {/* Header */}
      <div className="max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
          War<span className="text-gradient">Frog</span>
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Paste suspected news content below. Our multi-modal engine will cross-reference 
          linguistic patterns and analyze provided media to detect disinformation, manipulation, and anomalies.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Input Column */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-panel p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-transparent" />
            
            <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
              <FileText className="w-4 h-4 text-primary" />
              Source Text
            </label>
            <textarea
              className="w-full h-64 bg-background/50 border border-border/50 rounded-xl p-4 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none font-sans text-base leading-relaxed"
              placeholder="Paste article text, social media post, or claim here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            <div className="mt-6">
              <label className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3">
                <ImageIcon className="w-4 h-4 text-primary" />
                Media Evidence <span className="text-xs opacity-50 lowercase normal-case">(optional)</span>
              </label>
              
              <div 
                {...getRootProps()} 
                className={cn(
                  "border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 relative overflow-hidden group",
                  isDragActive ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/50 hover:bg-secondary/30",
                  previewUrl ? "p-1 border-solid border-border/50 bg-background/50" : "h-32 flex flex-col items-center justify-center"
                )}
              >
                <input {...getInputProps()} />
                
                {previewUrl ? (
                  <div className="relative w-full h-40 rounded-lg overflow-hidden">
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-white font-medium text-sm">Click to replace</p>
                    </div>
                    <button 
                      onClick={clearImage}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-destructive text-white rounded-md transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <UploadCloud className={cn("w-8 h-8 mb-2 transition-colors", isDragActive ? "text-primary" : "text-muted-foreground")} />
                    <p className="text-sm font-medium text-foreground">Drag & drop image here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                  </>
                )}
              </div>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={isPending || !text.trim()}
              className="mt-6 w-full relative group overflow-hidden rounded-xl font-display font-bold tracking-widest uppercase py-4 bg-secondary text-foreground border border-border/50 hover:border-primary hover:text-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="absolute inset-0 w-full h-full bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative flex items-center justify-center gap-2">
                {isPending ? (
                  <>
                    <Activity className="w-5 h-5 animate-pulse text-primary" />
                    Analyzing Data...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-5 h-5 group-hover:text-primary transition-colors" />
                    Run Diagnostics
                  </>
                )}
              </span>
            </button>
            
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <p className="text-sm text-destructive font-medium">
                  {error.error?.error || "Analysis failed. Please check your connection and try again."}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-7">
          <AnimatePresence mode="wait">
            {!result && !isPending && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center border border-dashed border-border/30 rounded-2xl bg-secondary/10"
              >
                <div className="w-24 h-24 mb-6 rounded-full bg-secondary/30 flex items-center justify-center relative">
                  <div className="absolute inset-0 border border-muted-foreground/20 rounded-full animate-[spin_10s_linear_infinite]" />
                  <div className="absolute inset-2 border border-dashed border-primary/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
                  <Activity className="w-10 h-10 text-muted-foreground/50" />
                </div>
                <h3 className="text-xl font-display font-medium text-muted-foreground">AWAITING INPUT</h3>
                <p className="text-sm text-muted-foreground/60 mt-2 max-w-sm text-center">
                  System standing by. Enter source material to begin credibility assessment.
                </p>
              </motion.div>
            )}

            {isPending && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="h-full min-h-[400px] flex flex-col items-center justify-center border border-primary/20 rounded-2xl glass-panel relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-[shimmer_2s_infinite]" />
                
                <div className="relative w-32 h-32 flex items-center justify-center mb-8">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
                  <div className="absolute inset-0 rounded-full border-t-2 border-primary animate-spin" />
                  <div className="absolute inset-4 rounded-full border-b-2 border-primary/50 animate-[spin_2s_linear_infinite_reverse]" />
                  <ShieldAlert className="w-8 h-8 text-primary animate-pulse" />
                </div>
                
                <h3 className="text-2xl font-display font-bold text-foreground uppercase tracking-widest mb-2">Processing</h3>
                <div className="flex gap-1 mb-6">
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                
                <div className="space-y-3 w-64">
                  <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 w-3/4 animate-[pulse_1s_ease-in-out_infinite]" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center font-mono">Running heuristic models...</p>
                </div>
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Score Header Card */}
                <div className={cn("glass-panel rounded-2xl p-8 relative overflow-hidden", getStatusGlow(result.prediction))}>
                  <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-transparent via-current to-transparent opacity-50" />
                  
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="shrink-0 relative">
                      <Gauge value={result.credibility_score} />
                      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-32 h-8 bg-current blur-2xl opacity-20 pointer-events-none rounded-full" />
                    </div>
                    
                    <div className="flex-1 text-center md:text-left space-y-4">
                      <div>
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-1">Final Assessment</h2>
                        <div className="flex items-center justify-center md:justify-start gap-3">
                          <span className={cn(
                            "text-5xl font-display font-bold uppercase tracking-tight",
                            result.prediction === 'Real' ? 'text-success' : 
                            result.prediction === 'Fake' ? 'text-destructive' : 'text-warning'
                          )}>
                            {result.prediction}
                          </span>
                          {result.prediction === 'Real' && <CheckCircle className="w-8 h-8 text-success" />}
                          {result.prediction === 'Fake' && <X className="w-8 h-8 text-destructive" />}
                          {result.prediction === 'Uncertain' && <AlertTriangle className="w-8 h-8 text-warning" />}
                        </div>
                      </div>

                      <div className="bg-background/50 rounded-xl p-4 border border-border/50 text-sm text-foreground/90">
                        <ul className="space-y-2">
                          {result.explanation.map((exp, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-primary mt-1">▰</span>
                              <span>{exp}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Details Accordions */}
                <div className="space-y-4">
                  <DetailsPanel 
                    title="Text Analysis Telemetry" 
                    icon={<FileText className="w-5 h-5 text-primary" />}
                    score={result.text_analysis.score}
                    flags={result.text_analysis.flags}
                    signals={result.text_analysis.positive_signals}
                    defaultOpen={true}
                  />
                  
                  {result.image_analysis.has_image && (
                    <DetailsPanel 
                      title="Media Forensics" 
                      icon={<ImageIcon className="w-5 h-5 text-primary" />}
                      score={result.image_analysis.score}
                      flags={result.image_analysis.flags}
                      signals={result.image_analysis.positive_signals}
                    />
                  )}
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

function DetailsPanel({ title, icon, score, flags, signals, defaultOpen = false }: any) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="glass-panel rounded-xl overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between bg-secondary/30 hover:bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-display font-bold uppercase tracking-wider text-foreground">{title}</span>
          <div className={cn("px-2 py-0.5 rounded text-xs font-bold font-mono ml-2", getStatusColor(score))}>
            {Math.round(score)}/100
          </div>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-6 border-t border-border/50 grid grid-cols-1 md:grid-cols-2 gap-6 bg-background/30">
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-destructive mb-3">
                  <AlertTriangle className="w-4 h-4" /> Detected Anomalies
                </h4>
                {flags.length > 0 ? (
                  <ul className="space-y-2">
                    {flags.map((flag: string, i: number) => (
                      <li key={i} className="text-sm bg-destructive/10 border border-destructive/20 text-destructive/90 px-3 py-2 rounded-lg flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-xs">✕</span> {flag}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">No significant anomalies detected.</p>
                )}
              </div>
              
              <div>
                <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-success mb-3">
                  <CheckCircle className="w-4 h-4" /> Authenticity Signals
                </h4>
                {signals.length > 0 ? (
                  <ul className="space-y-2">
                    {signals.map((signal: string, i: number) => (
                      <li key={i} className="text-sm bg-success/10 border border-success/20 text-success/90 px-3 py-2 rounded-lg flex items-start gap-2">
                        <span className="shrink-0 mt-0.5 text-xs">✓</span> {signal}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic px-3 py-2 bg-secondary/20 rounded-lg">No strong positive signals identified.</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
