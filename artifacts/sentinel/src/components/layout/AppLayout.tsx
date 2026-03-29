import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Shield, Activity, History } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background relative flex flex-col overflow-hidden">
      {/* Background ambient light */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-destructive/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/5 glass-panel">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 group-hover:border-primary/50 group-hover:bg-primary/20 transition-all">
              <Shield className="w-5 h-5 text-primary" />
              <div className="absolute inset-0 rounded-lg shadow-[0_0_15px_rgba(0,240,255,0.3)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="font-display font-bold text-xl tracking-wider text-foreground">
              SENTINEL<span className="text-primary">.CORE</span>
            </span>
          </Link>

          <nav className="flex items-center gap-1 sm:gap-2">
            <Link 
              href="/" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                location === "/" 
                  ? "bg-secondary text-primary shadow-[inset_0_-2px_0_hsl(var(--primary))]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Analyze</span>
            </Link>
            <Link 
              href="/history" 
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
                location === "/history" 
                  ? "bg-secondary text-primary shadow-[inset_0_-2px_0_hsl(var(--primary))]" 
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <History className="w-4 h-4" />
              <span className="hidden sm:inline">History</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative z-10">
        {children}
      </main>
    </div>
  );
}
