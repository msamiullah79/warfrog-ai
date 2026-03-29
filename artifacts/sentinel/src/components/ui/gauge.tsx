import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GaugeProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  animate?: boolean;
}

export function Gauge({ value, size = 160, strokeWidth = 12, className, animate = true }: GaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;

  let color = "stroke-destructive";
  if (value >= 70) color = "stroke-success";
  else if (value >= 40) color = "stroke-warning";

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 transform">
        {/* Background Circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        {/* Progress Circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          className={cn("transition-colors duration-500 ease-in-out", color)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={animate ? { strokeDashoffset: circumference } : { strokeDashoffset: offset }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          initial={animate ? { opacity: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="font-display text-4xl font-bold tracking-tighter text-foreground"
        >
          {Math.round(value)}
        </motion.span>
        <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase mt-1">
          Score
        </span>
      </div>
    </div>
  );
}
