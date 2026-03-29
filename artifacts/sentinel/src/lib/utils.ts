import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): number {
  return Math.round(score);
}

export function getStatusColor(score: number) {
  if (score >= 70) return "text-success border-success/30 bg-success/10";
  if (score >= 40) return "text-warning border-warning/30 bg-warning/10";
  return "text-destructive border-destructive/30 bg-destructive/10";
}

export function getStatusGlow(prediction: string) {
  switch(prediction.toLowerCase()) {
    case 'real': return 'glow-green';
    case 'fake': return 'glow-red';
    case 'uncertain': return 'glow-yellow';
    default: return 'glow-cyan';
  }
}
