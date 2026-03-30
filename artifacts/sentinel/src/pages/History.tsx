import { useState } from "react";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { 
  Trash2, AlertCircle, Shield, Calendar, Image as ImageIcon, 
  Search, ShieldAlert, Activity, CheckCircle, AlertTriangle, X
} from "lucide-react";
import { useGetHistory, useDeleteHistoryItem, useClearHistory } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetHistoryQueryKey } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import AnalysisDetailModal from "@/components/AnalysisDetailModal";

export default function History() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useGetHistory();
  
  const { mutate: deleteItem, isPending: isDeleting } = useDeleteHistoryItem({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() })
    }
  });

  const { mutate: clearAll, isPending: isClearing } = useClearHistory({
    mutation: {
      onSuccess: () => {
        setShowClearConfirm(false);
        queryClient.invalidateQueries({ queryKey: getGetHistoryQueryKey() });
      }
    }
  });

  const filteredItems = data?.items.filter(item => 
    item.text_preview.toLowerCase().includes(search.toLowerCase()) ||
    item.prediction.toLowerCase().includes(search.toLowerCase())
  ) || [];

  function handleRerun(text: string) {
    sessionStorage.setItem("rerun_text", text);
    setSelectedId(null);
    navigate("/");
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2 flex items-center gap-3">
            <Shield className="w-8 h-8 text-primary" />
            Analysis <span className="text-gradient">Logs</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Review past scans, credibility scores, and intelligence reports.
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-secondary/30 border border-border/50 rounded-xl pl-10 pr-4 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>
          
          {data?.items.length ? (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive hover:text-white rounded-xl text-sm font-bold uppercase tracking-wider transition-colors shrink-0"
            >
              Purge All
            </button>
          ) : null}
        </div>
      </div>

      {/* Clear Confirmation Dialog */}
      <AnimatePresence>
        {showClearConfirm && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              className="glass-panel p-6 rounded-2xl max-w-md w-full border-destructive/30 glow-red"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-destructive/20 rounded-full text-destructive">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-display font-bold text-foreground">Purge All Records?</h3>
                  <p className="text-muted-foreground text-sm mt-2">
                    This action is irreversible. All telemetry and analysis data will be permanently deleted from the active database.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button 
                  onClick={() => setShowClearConfirm(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  disabled={isClearing}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => clearAll()}
                  disabled={isClearing}
                  className="px-4 py-2 bg-destructive text-white rounded-lg text-sm font-bold tracking-wider uppercase flex items-center gap-2 hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {isClearing ? <Activity className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Confirm Purge
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-4">
          <Activity className="w-8 h-8 text-primary animate-pulse" />
          <p className="text-muted-foreground font-mono text-sm">Querying database...</p>
        </div>
      ) : error ? (
        <div className="p-6 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
          <ShieldAlert className="w-8 h-8 text-destructive mx-auto mb-3" />
          <p className="text-destructive font-medium">Failed to retrieve logs.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-20 border border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center bg-secondary/10 text-center px-4">
          <Shield className="w-12 h-12 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-display font-medium text-foreground mb-1">No Records Found</h3>
          <p className="text-muted-foreground text-sm">
            {search ? "No logs match your filter criteria." : "The database is currently empty. Run an analysis to populate logs."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredItems.map((item, index) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2, delay: index * 0.05 }}
                onClick={() => setSelectedId(item.id)}
                className="glass-panel p-5 rounded-2xl flex flex-col group hover:border-primary/40 hover:shadow-[0_0_18px_rgba(99,240,215,0.08)] hover:scale-[1.015] transition-all cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider",
                      item.prediction === 'Real' ? "bg-success/20 text-success border border-success/30" :
                      item.prediction === 'Fake' ? "bg-destructive/20 text-destructive border border-destructive/30" :
                      "bg-warning/20 text-warning border border-warning/30"
                    )}>
                      {item.prediction === 'Real' && <CheckCircle className="w-3 h-3" />}
                      {item.prediction === 'Fake' && <X className="w-3 h-3" />}
                      {item.prediction === 'Uncertain' && <AlertTriangle className="w-3 h-3" />}
                      {item.prediction}
                    </span>
                    <span className="px-2 py-1 bg-secondary/50 rounded text-xs font-mono text-muted-foreground border border-border/50">
                      {Math.round(item.credibility_score)}/100
                    </span>
                  </div>
                  
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteItem({ id: item.id }); }}
                    disabled={isDeleting}
                    className="p-1.5 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Delete Record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-sm text-foreground/80 flex-1 mb-4 line-clamp-4 leading-relaxed font-sans">
                  "{item.text_preview}..."
                </p>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border/50 mt-auto">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(item.analyzed_at), "MMM d, HH:mm")}
                  </div>
                  {item.has_image && (
                    <div className="flex items-center gap-1 text-primary" title="Included Media Analysis">
                      <ImageIcon className="w-3.5 h-3.5" /> Media
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Detail modal */}
      <AnimatePresence>
        {selectedId !== null && (
          <AnalysisDetailModal
            id={selectedId}
            onClose={() => setSelectedId(null)}
            onRerun={handleRerun}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
