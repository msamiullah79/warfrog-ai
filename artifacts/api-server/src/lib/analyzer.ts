/**
 * Multi-modal fake news analysis engine.
 * Uses rule-based NLP + image metadata checks.
 * No GPU or model training required.
 *
 * Scoring philosophy (v2):
 * - Be cautious: do not promote content to REAL unless it is clearly verified
 * - Mixed signals (credibility + anomaly) → UNCERTAIN
 * - Multiple uncertainty phrases (>=2) → force UNCERTAIN
 * - No image provided → score based entirely on text (no artificial image boost)
 * - Thresholds: 0-40 FAKE | 41-65 UNCERTAIN | 66-100 REAL (only if no major anomalies)
 */

// ─────────────────────────────────────────────────────────────
// FAKE / ANOMALY INDICATORS
// ─────────────────────────────────────────────────────────────

const FAKE_INDICATORS = [
  { pattern: /\b(BREAKING|URGENT|EXCLUSIVE|SHOCKING|BOMBSHELL)\b/i, label: "Sensational headline keywords detected", weight: 14 },
  { pattern: /\b(you won'?t believe|mind.?blow|jaw.?drop|unbelievable)\b/i, label: "Clickbait language detected", weight: 12 },
  { pattern: /\b(they don'?t want you to know|coverup|cover.?up|hidden truth)\b/i, label: "Conspiracy-style language detected", weight: 18 },
  { pattern: /\b(miracle cure|100% guaranteed|scientifically proven to)\b/i, label: "Unverified absolute claims detected", weight: 12 },
  { pattern: /\b(illuminati|deep state|new world order|globalist|cabal)\b/i, label: "Extreme conspiracy terminology detected", weight: 25 },
  { pattern: /\b(share before deleted|must share|going viral|spread the word)\b/i, label: "Viral share-bait language detected", weight: 14 },
  { pattern: /[!]{2,}/, label: "Excessive exclamation marks detected", weight: 8 },
  { pattern: /[A-Z]{5,}/, label: "Excessive capitalization detected", weight: 7 },
  { pattern: /\b(hoax|fabricated|staged|false flag|psyop)\b/i, label: "Disinformation terminology detected", weight: 20 },
  { pattern: /\b(mainstream media|msm|lamestream|fake news media)\b/i, label: "Anti-media bias indicators", weight: 10 },
];

// ─────────────────────────────────────────────────────────────
// UNCERTAINTY / SPECULATION INDICATORS
// These are scored separately and can force UNCERTAIN classification.
// Each occurrence carries a higher individual penalty than before.
// ─────────────────────────────────────────────────────────────

const UNCERTAINTY_INDICATORS = [
  { pattern: /\breportedly\b/gi, label: "\"Reportedly\" — unverified claim marker" },
  { pattern: /\bunconfirmed\b/gi, label: "\"Unconfirmed\" — lack of verification stated" },
  { pattern: /\bsources?\s+say\b/gi, label: "\"Sources say\" — anonymous or uncited sourcing" },
  { pattern: /\bclaims?\s+that\b/gi, label: "\"Claims that\" — assertion without evidence" },
  { pattern: /\bno\s+official\s+confirmation\b/gi, label: "\"No official confirmation\" — explicitly unverified" },
  { pattern: /\ballegedly\b/gi, label: "\"Allegedly\" — unconfirmed allegation" },
  { pattern: /\banonymous\s+source/gi, label: "Anonymous source cited — cannot be verified" },
  { pattern: /\bcould\s+not\s+be\s+(independently\s+)?verified\b/gi, label: "Explicit statement of unverifiability" },
  { pattern: /\bpurportedly\b/gi, label: "\"Purportedly\" — uncertain attribution" },
  { pattern: /\bsome\s+(people\s+)?(say|believe|claim)\b/gi, label: "Vague collective attribution detected" },
];

// ─────────────────────────────────────────────────────────────
// STRONG VERIFICATION SIGNALS
// These carry higher weight than general structural signals.
// ─────────────────────────────────────────────────────────────

const CREDIBILITY_INDICATORS = [
  { pattern: /\b(according to [A-Z][a-z]|cited by|as reported by|published in)\b/i, label: "Named source attribution", weight: 14 },
  { pattern: /\bpeer.?reviewed\b/i, label: "Peer-reviewed content referenced", weight: 16 },
  { pattern: /\b(study|research|investigation|analysis)\s+(by|from|at|published)\b/i, label: "Attributed research referenced", weight: 12 },
  { pattern: /\b(percent|percentage|\d+%)\b/i, label: "Specific statistical data present", weight: 10 },
  { pattern: /\b(said in a statement|told reporters|in a press conference|confirmed by)\b/i, label: "Formal on-record attribution", weight: 14 },
  { pattern: /\b(correction|editor's note|clarification|retraction)\b/i, label: "Editorial transparency markers present", weight: 10 },
  { pattern: /\bhttps?:\/\/[^\s]{10,}/i, label: "Cited external source link", weight: 12 },
  { pattern: /\b(survey of|sample of|study of)\s+\d+/i, label: "Quantified study sample referenced", weight: 12 },
];

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface TextAnalysisResult {
  score: number;
  confidence: number;
  flags: string[];
  positive_signals: string[];
  uncertainty_count: number;
  has_major_anomalies: boolean;
}

export interface ImageAnalysisResult {
  score: number;
  has_image: boolean;
  flags: string[];
  positive_signals: string[];
}

export interface FullAnalysisResult {
  credibility_score: number;
  prediction: "Real" | "Fake" | "Uncertain";
  explanation: string[];
  text_analysis: TextAnalysisResult;
  image_analysis: ImageAnalysisResult;
}

// ─────────────────────────────────────────────────────────────
// TEXT ANALYSIS
// ─────────────────────────────────────────────────────────────

/**
 * Analyzes news text for credibility using pattern matching.
 * Returns a 0–100 score and detailed breakdown.
 *
 * Scoring baseline: 65 (neutral-cautious, not generous)
 * Penalty weights are applied per-match (including repeated occurrences for uncertainty phrases).
 * Bonus weights are lower than penalty weights to keep the system conservative.
 */
export function analyzeText(text: string): TextAnalysisResult {
  const flags: string[] = [];
  const positive_signals: string[] = [];
  let penaltyPoints = 0;
  let bonusPoints = 0;
  let uncertaintyCount = 0;

  // 1. Check hard anomaly indicators
  let hasMajorAnomalies = false;
  for (const indicator of FAKE_INDICATORS) {
    if (indicator.pattern.test(text)) {
      flags.push(indicator.label);
      penaltyPoints += indicator.weight;
      if (indicator.weight >= 14) hasMajorAnomalies = true;
    }
  }

  // 2. Count uncertainty phrases — each occurrence is penalised individually
  //    so a text riddled with "reportedly" is penalised more than one that uses it once.
  const uncertaintyHits: string[] = [];
  for (const indicator of UNCERTAINTY_INDICATORS) {
    const matches = text.match(indicator.pattern);
    if (matches) {
      const count = matches.length;
      uncertaintyCount += count;
      // 12 points per occurrence, capped at 30 per phrase type to avoid runaway
      const phrasePenalty = Math.min(count * 12, 30);
      penaltyPoints += phrasePenalty;
      uncertaintyHits.push(`${indicator.label} (×${count})`);
    }
  }
  // Add uncertainty hits as flags
  flags.push(...uncertaintyHits);

  // 3. Check verification / credibility signals
  for (const indicator of CREDIBILITY_INDICATORS) {
    if (indicator.pattern.test(text)) {
      positive_signals.push(indicator.label);
      bonusPoints += indicator.weight;
    }
  }

  // 4. Length check — reduced weight (was +5 bonus, now only a mild flag for very short)
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    flags.push("Very short content — insufficient for credibility assessment");
    penaltyPoints += 8;
  }
  // No bonus for long articles — length alone is not a credibility signal

  // 5. Sentence variety — kept as a minor flag only
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
  if (avgSentenceLength < 5 && wordCount > 20) {
    flags.push("Very short average sentence length — possible low-quality content");
    penaltyPoints += 4;
  }

  // 6. Direct quotations — still a credibility signal but weight reduced (was 8, now 6)
  const quoteMatches = text.match(/[""].+?[""]/g) || text.match(/".+?"/g) || [];
  if (quoteMatches.length > 0) {
    positive_signals.push("Direct quotations present");
    bonusPoints += 6;
  }

  // Compute raw score from a cautious baseline of 65
  const rawScore = Math.max(0, Math.min(100, 65 - penaltyPoints + bonusPoints));

  // Confidence based on signal count
  const totalSignals = flags.length + positive_signals.length;
  const confidence = Math.min(0.95, 0.4 + totalSignals * 0.05);

  return {
    score: Math.round(rawScore),
    confidence: Math.round(confidence * 100) / 100,
    flags,
    positive_signals,
    uncertainty_count: uncertaintyCount,
    has_major_anomalies: hasMajorAnomalies,
  };
}

// ─────────────────────────────────────────────────────────────
// IMAGE ANALYSIS
// ─────────────────────────────────────────────────────────────

/**
 * Analyzes image metadata and basic properties.
 * When no image is provided, returns has_image: false and score: null
 * so the final scorer can ignore it entirely.
 */
export function analyzeImage(
  imageBuffer: Buffer | null,
  mimeType: string | null
): ImageAnalysisResult {
  if (!imageBuffer || !mimeType) {
    // No artificial score — final scorer will use text-only when has_image is false
    return {
      score: 0,
      has_image: false,
      flags: [],
      positive_signals: ["No image provided — analysis is text-only"],
    };
  }

  const flags: string[] = [];
  const positive_signals: string[] = [];
  let score = 80;

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    flags.push("Unusual image format detected");
    score -= 15;
  } else {
    positive_signals.push(`Valid image format (${mimeType})`);
  }

  const fileSizeKb = imageBuffer.length / 1024;
  if (fileSizeKb < 5) {
    flags.push("Image file size very small — may be a placeholder or thumbnail");
    score -= 10;
  } else if (fileSizeKb > 10) {
    positive_signals.push("Image has reasonable file size");
  }

  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) {
    const hasExif = checkJpegExif(imageBuffer);
    if (!hasExif) {
      flags.push("No EXIF metadata found — image may have been scrubbed or is a screenshot");
      score -= 12;
    } else {
      positive_signals.push("EXIF metadata present in image");
      score += 5;
    }
  } else if (mimeType.includes("png")) {
    positive_signals.push("PNG format — metadata handling is standard");
  }

  if (mimeType.includes("png") && fileSizeKb > 500) {
    flags.push("Large PNG file — possible screenshot");
    score -= 3;
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    has_image: true,
    flags,
    positive_signals,
  };
}

/**
 * Checks if a JPEG buffer contains EXIF data.
 */
function checkJpegExif(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) break;
    const markerType = buffer[offset + 1];
    if (markerType === 0xe1) {
      const exifStr = buffer.slice(offset + 4, offset + 8).toString("ascii");
      return exifStr === "Exif";
    }
    if (markerType === 0xda) break;
    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// FINAL CREDIBILITY SCORE
// ─────────────────────────────────────────────────────────────

/**
 * Combines text and image scores into a final credibility result.
 *
 * Key rules:
 * 1. If no image: final score = text score only (no image weight applied)
 * 2. If image present: final score = 0.7 × text + 0.3 × image
 * 3. If uncertainty_count >= 2: force UNCERTAIN regardless of score
 * 4. If text has both credibility signals AND major anomalies: force UNCERTAIN
 * 5. Thresholds: <=40 FAKE | 41-65 UNCERTAIN | >=66 REAL (only when no override)
 */
export function computeFinalScore(
  textAnalysis: TextAnalysisResult,
  imageAnalysis: ImageAnalysisResult
): FullAnalysisResult {
  // Improvement #6: no image → pure text score
  const credibilityScore = imageAnalysis.has_image
    ? Math.round(0.7 * textAnalysis.score + 0.3 * imageAnalysis.score)
    : textAnalysis.score;

  const hasBothSignals =
    textAnalysis.positive_signals.length > 0 && textAnalysis.has_major_anomalies;

  // Determine raw prediction from thresholds
  let prediction: "Real" | "Fake" | "Uncertain";
  if (credibilityScore >= 66) {
    prediction = "Real";
  } else if (credibilityScore <= 40) {
    prediction = "Fake";
  } else {
    prediction = "Uncertain";
  }

  // Override rules (applied after thresholds)
  const uncertaintyOverride = textAnalysis.uncertainty_count >= 2;
  const contradictionOverride = hasBothSignals && prediction === "Real";

  if (uncertaintyOverride || contradictionOverride) {
    prediction = "Uncertain";
  }

  // Build explanation
  const explanation: string[] = [];

  if (textAnalysis.uncertainty_count >= 2) {
    explanation.push(
      `${textAnalysis.uncertainty_count} uncertainty phrase(s) detected — classification limited to UNCERTAIN`
    );
  }

  if (contradictionOverride) {
    explanation.push(
      "Both credibility signals and anomaly signals are present — classification downgraded to UNCERTAIN"
    );
  }

  if (textAnalysis.flags.length > 0) {
    explanation.push(`Anomaly flags: ${textAnalysis.flags.slice(0, 4).join("; ")}`);
  }

  if (textAnalysis.positive_signals.length > 0) {
    explanation.push(
      `Credibility signals: ${textAnalysis.positive_signals.slice(0, 3).join("; ")}`
    );
  }

  if (imageAnalysis.has_image) {
    if (imageAnalysis.flags.length > 0) {
      explanation.push(`Image concerns: ${imageAnalysis.flags.slice(0, 2).join("; ")}`);
    } else {
      explanation.push("Image passed basic verification checks");
    }
    explanation.push(
      `Final score: ${credibilityScore}/100 (Text: ${textAnalysis.score} × 70%, Image: ${imageAnalysis.score} × 30%)`
    );
  } else {
    explanation.push("No image provided — score based entirely on text");
    explanation.push(`Final score: ${credibilityScore}/100 (text only)`);
  }

  if (prediction === "Real") {
    explanation.push("Content meets credibility threshold with no major anomalies");
  } else if (prediction === "Fake") {
    explanation.push("Content shows strong indicators associated with misinformation");
  } else {
    explanation.push("Content shows mixed or uncertain signals — manual verification recommended");
  }

  return {
    credibility_score: credibilityScore,
    prediction,
    explanation,
    text_analysis: textAnalysis,
    image_analysis: imageAnalysis,
  };
}
