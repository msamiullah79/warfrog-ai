import { pgTable, serial, text, real, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const analysesTable = pgTable("analyses", {
  id: serial("id").primaryKey(),
  textContent: text("text_content").notNull(),
  textPreview: text("text_preview").notNull(),
  credibilityScore: real("credibility_score").notNull(),
  prediction: text("prediction").notNull(),
  explanation: jsonb("explanation").notNull().$type<string[]>(),
  textAnalysis: jsonb("text_analysis").notNull().$type<{
    score: number;
    confidence: number;
    flags: string[];
    positive_signals: string[];
  }>(),
  imageAnalysis: jsonb("image_analysis").notNull().$type<{
    score: number;
    has_image: boolean;
    flags: string[];
    positive_signals: string[];
  }>(),
  hasImage: boolean("has_image").notNull().default(false),
  analyzedAt: timestamp("analyzed_at").notNull().defaultNow(),
});

export const insertAnalysisSchema = createInsertSchema(analysesTable).omit({ id: true, analyzedAt: true });
export type InsertAnalysis = z.infer<typeof insertAnalysisSchema>;
export type Analysis = typeof analysesTable.$inferSelect;
