import { Router, type IRouter, Request, Response } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { analysesTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { analyzeText, analyzeImage, computeFinalScore } from "../lib/analyzer.js";

const router: IRouter = Router();

// Configure multer — store files in memory so we can read the buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

/**
 * POST /api/analyze
 * Analyzes news text + optional image for credibility.
 */
router.post(
  "/analyze",
  upload.single("image"),
  async (req: Request, res: Response) => {
    const text = req.body?.text as string | undefined;

    if (!text || text.trim().length === 0) {
      res.status(400).json({ error: "Text is required for analysis" });
      return;
    }

    const imageBuffer = req.file?.buffer ?? null;
    const mimeType = req.file?.mimetype ?? null;

    // Run analysis modules
    const textAnalysis = analyzeText(text.trim());
    const imageAnalysis = analyzeImage(imageBuffer, mimeType);
    const fullResult = computeFinalScore(textAnalysis, imageAnalysis);

    // Persist to DB
    const textPreview = text.trim().slice(0, 200) + (text.length > 200 ? "..." : "");

    const [inserted] = await db
      .insert(analysesTable)
      .values({
        textContent: text.trim(),
        textPreview,
        credibilityScore: fullResult.credibility_score,
        prediction: fullResult.prediction,
        explanation: fullResult.explanation,
        textAnalysis: fullResult.text_analysis,
        imageAnalysis: fullResult.image_analysis,
        hasImage: imageAnalysis.has_image,
      })
      .returning();

    res.json({
      id: inserted.id,
      credibility_score: fullResult.credibility_score,
      prediction: fullResult.prediction,
      explanation: fullResult.explanation,
      text_analysis: fullResult.text_analysis,
      image_analysis: fullResult.image_analysis,
      analyzed_at: inserted.analyzedAt,
      text_preview: textPreview,
    });
  }
);

/**
 * GET /api/history
 * Returns all past analyses, newest first.
 */
router.get("/history", async (_req: Request, res: Response) => {
  const items = await db
    .select({
      id: analysesTable.id,
      credibilityScore: analysesTable.credibilityScore,
      prediction: analysesTable.prediction,
      textPreview: analysesTable.textPreview,
      analyzedAt: analysesTable.analyzedAt,
      hasImage: analysesTable.hasImage,
    })
    .from(analysesTable)
    .orderBy(desc(analysesTable.analyzedAt))
    .limit(100);

  res.json({
    items: items.map((item) => ({
      id: item.id,
      credibility_score: item.credibilityScore,
      prediction: item.prediction,
      text_preview: item.textPreview,
      analyzed_at: item.analyzedAt,
      has_image: item.hasImage,
    })),
    total: items.length,
  });
});

/**
 * GET /api/history/:id
 * Returns full analysis detail for a single record.
 */
router.get("/history/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [item] = await db
    .select()
    .from(analysesTable)
    .where(eq(analysesTable.id, id))
    .limit(1);

  if (!item) {
    res.status(404).json({ error: "History item not found" });
    return;
  }

  res.json({
    id: item.id,
    credibility_score: item.credibilityScore,
    prediction: item.prediction,
    explanation: item.explanation,
    text_analysis: item.textAnalysis,
    image_analysis: item.imageAnalysis,
    analyzed_at: item.analyzedAt,
    text_preview: item.textPreview,
    text_content: item.textContent,
  });
});

/**
 * DELETE /api/history
 * Clears all history.
 */
router.delete("/history", async (_req: Request, res: Response) => {
  await db.delete(analysesTable);
  res.json({ message: "History cleared successfully" });
});

/**
 * DELETE /api/history/:id
 * Deletes a specific history record.
 */
router.delete("/history/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const deleted = await db
    .delete(analysesTable)
    .where(eq(analysesTable.id, id))
    .returning({ id: analysesTable.id });

  if (deleted.length === 0) {
    res.status(404).json({ error: "History item not found" });
    return;
  }

  res.json({ message: "History item deleted" });
});

export default router;
