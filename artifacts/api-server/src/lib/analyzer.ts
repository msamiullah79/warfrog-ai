/**
 * Multi-modal fake news analysis engine.
 * Uses rule-based NLP + image metadata checks.
 * No GPU or model training required.
 *
 * Scoring philosophy (v3):
 * - Distinguish speculative language (misinformation signal) from cautious reporting (credibility signal)
 * - Negative uncertainty phrases (e.g. "reportedly", "sources say") → penalise
 * - Positive/responsible uncertainty phrases (e.g. "not yet confirmed", "preliminary assessment") → credit
 * - UNCERTAIN override fires only when negative_uncertainty_count >= 2 (not total uncertainty)
 * - Mixed signals (credibility + major anomaly) → UNCERTAIN
 * - No image provided → score based entirely on text
 * - Thresholds: 0–40 FAKE | 41–65 UNCERTAIN | 66–100 REAL (only if no major anomalies)
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
// NEGATIVE UNCERTAINTY — speculative / anonymous / unverified language
// Each occurrence is penalised. >= 2 total can trigger UNCERTAIN override.
// ─────────────────────────────────────────────────────────────

const NEGATIVE_UNCERTAINTY: Array<{ pattern: RegExp; label: string; penaltyPerMatch: number }> = [
  {
    pattern: /\breportedly\b/gi,
    label: "\"Reportedly\" — unverified claim, no named source",
    penaltyPerMatch: 10,
  },
  {
    pattern: /\bclaims?\s+that\b/gi,
    label: "\"Claims that\" — assertion presented without supporting evidence",
    penaltyPerMatch: 10,
  },
  {
    pattern: /\bsources?\s+say\b/gi,
    label: "\"Sources say\" — anonymous or uncited sourcing",
    penaltyPerMatch: 12,
  },
  {
    pattern: /\bunverified\s+reports?\b/gi,
    label: "\"Unverified reports\" — content explicitly noted as unverified",
    penaltyPerMatch: 14,
  },
  {
    pattern: /\ballegedly\b/gi,
    label: "\"Allegedly\" — unconfirmed allegation",
    penaltyPerMatch: 10,
  },
  {
    pattern: /\banonymous\s+source/gi,
    label: "Anonymous source cited — identity cannot be verified",
    penaltyPerMatch: 12,
  },
  {
    pattern: /\bpurportedly\b/gi,
    label: "\"Purportedly\" — uncertain or disputed attribution",
    penaltyPerMatch: 10,
  },
  {
    pattern: /\bsome\s+(people\s+)?(say|believe|claim)\b/gi,
    label: "Vague collective attribution — no specific source identified",
    penaltyPerMatch: 8,
  },
  {
    pattern: /\bunconfirmed\s+(report|claim|source|allegation)/gi,
    label: "\"Unconfirmed [claim/report]\" — explicitly flagged as unverified",
    penaltyPerMatch: 14,
  },
];

// ─────────────────────────────────────────────────────────────
// POSITIVE UNCERTAINTY — cautious, transparent, responsible journalism
// These are NOT penalised. They reflect honest reporting practice and earn a small bonus.
// ─────────────────────────────────────────────────────────────

const POSITIVE_UNCERTAINTY: Array<{ pattern: RegExp; label: string; bonusPerMatch: number }> = [
  {
    pattern: /\bnot\s+yet\s+confirmed\b/gi,
    label: "\"Not yet confirmed\" — responsible acknowledgment of pending verification",
    bonusPerMatch: 6,
  },
  {
    pattern: /\bofficials?\s+(have\s+)?not\s+(yet\s+)?confirmed\b/gi,
    label: "\"Officials have not confirmed\" — transparent attribution of uncertainty",
    bonusPerMatch: 6,
  },
  {
    pattern: /\bawaiting\s+(independent\s+)?verification\b/gi,
    label: "\"Awaiting verification\" — proactive disclosure of unverified status",
    bonusPerMatch: 7,
  },
  {
    pattern: /\bpreliminary\s+(assessment|findings?|results?|data)\b/gi,
    label: "\"Preliminary assessment/findings\" — appropriate scientific caution",
    bonusPerMatch: 6,
  },
  {
    pattern: /\bindependent\s+verification\s+(was\s+)?(not\s+)?(immediately\s+)?available\b/gi,
    label: "\"Independent verification not available\" — honest transparency about sourcing limits",
    bonusPerMatch: 7,
  },
  {
    pattern: /\b(could\s+not\s+be\s+independently\s+verified|was\s+unable\s+to\s+independently\s+verify)\b/gi,
    label: "Explicit statement of verification attempt — responsible journalistic practice",
    bonusPerMatch: 8,
  },
  {
    pattern: /\bsubject\s+to\s+(change|revision|further\s+review)\b/gi,
    label: "\"Subject to change\" — acknowledgment of evolving information",
    bonusPerMatch: 5,
  },
  {
    pattern: /\bsent\s+(a\s+)?(request|requests?)\s+for\s+comment\b/gi,
    label: "\"Sent request for comment\" — standard journalistic due-diligence",
    bonusPerMatch: 8,
  },
];

// ─────────────────────────────────────────────────────────────
// STRONG VERIFICATION SIGNALS
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
  /** Number of speculative / anonymous uncertainty phrases detected */
  negative_uncertainty_count: number;
  /** Number of responsible / cautious uncertainty phrases detected */
  positive_uncertainty_count: number;
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
 *
 * Baseline: 65 (neutral-cautious)
 * - Negative uncertainty: penalised per occurrence (capped per phrase type)
 * - Positive uncertainty: awarded a small bonus — treated as responsible journalism
 * - Hard anomalies and credibility signals work as before
 */
export function analyzeText(text: string): TextAnalysisResult {
  const flags: string[] = [];
  const positive_signals: string[] = [];
  let penaltyPoints = 0;
  let bonusPoints = 0;
  let negativePhraseCount = 0;
  let positivePhraseCount = 0;

  // 1. Hard anomaly indicators
  let hasMajorAnomalies = false;
  for (const indicator of FAKE_INDICATORS) {
    if (indicator.pattern.test(text)) {
      flags.push(indicator.label);
      penaltyPoints += indicator.weight;
      if (indicator.weight >= 14) hasMajorAnomalies = true;
    }
  }

  // 2. Negative uncertainty — speculative language (penalise per occurrence)
  for (const indicator of NEGATIVE_UNCERTAINTY) {
    const matches = text.match(indicator.pattern);
    if (matches) {
      const count = matches.length;
      negativePhraseCount += count;
      // Cap penalty per phrase type to prevent runaway from a single repeated word
      const penalty = Math.min(count * indicator.penaltyPerMatch, 28);
      penaltyPoints += penalty;
      flags.push(`${indicator.label} (×${count})`);
    }
  }

  // 3. Positive uncertainty — responsible journalism (bonus, no penalty)
  for (const indicator of POSITIVE_UNCERTAINTY) {
    const matches = text.match(indicator.pattern);
    if (matches) {
      const count = matches.length;
      positivePhraseCount += count;
      // Small bonus; each phrase type capped so it can't inflate the score artificially
      const bonus = Math.min(count * indicator.bonusPerMatch, 14);
      bonusPoints += bonus;
      positive_signals.push(`${indicator.label} (×${count})`);
    }
  }

  // 4. Verification / credibility signals
  for (const indicator of CREDIBILITY_INDICATORS) {
    if (indicator.pattern.test(text)) {
      positive_signals.push(indicator.label);
      bonusPoints += indicator.weight;
    }
  }

  // 5. Length — only flag very short content, no bonus for length
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    flags.push("Very short content — insufficient for credibility assessment");
    penaltyPoints += 8;
  }

  // 6. Sentence length — very short avg sentence is a minor flag
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
  if (avgSentenceLength < 5 && wordCount > 20) {
    flags.push("Very short average sentence length — possible low-quality content");
    penaltyPoints += 4;
  }

  // 7. Direct quotations — credibility signal
  const quoteMatches = text.match(/[""].+?[""]/g) || text.match(/".+?"/g) || [];
  if (quoteMatches.length > 0) {
    positive_signals.push("Direct quotations present");
    bonusPoints += 6;
  }

  // Compute raw score from cautious baseline
  const rawScore = Math.max(0, Math.min(100, 65 - penaltyPoints + bonusPoints));

  const totalSignals = flags.length + positive_signals.length;
  const confidence = Math.min(0.95, 0.4 + totalSignals * 0.05);

  return {
    score: Math.round(rawScore),
    confidence: Math.round(confidence * 100) / 100,
    flags,
    positive_signals,
    negative_uncertainty_count: negativePhraseCount,
    positive_uncertainty_count: positivePhraseCount,
    has_major_anomalies: hasMajorAnomalies,
  };
}

// ─────────────────────────────────────────────────────────────
// IMAGE ANALYSIS
// ─────────────────────────────────────────────────────────────

/**
 * Analyzes image metadata and basic properties.
 * When no image is provided score = 0 and has_image = false;
 * computeFinalScore uses text only in that case.
 */
export function analyzeImage(
  imageBuffer: Buffer | null,
  mimeType: string | null
): ImageAnalysisResult {
  if (!imageBuffer || !mimeType) {
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
 * Override rules (applied after threshold classification):
 *  1. negative_uncertainty_count >= 2 → force UNCERTAIN
 *     (positive_uncertainty_count alone does NOT trigger this)
 *  2. text has both credibility signals AND major anomalies → force UNCERTAIN
 *
 * Thresholds: <=40 FAKE | 41–65 UNCERTAIN | >=66 REAL
 * No image → score is 100% text, no blending.
 */
export function computeFinalScore(
  textAnalysis: TextAnalysisResult,
  imageAnalysis: ImageAnalysisResult
): FullAnalysisResult {
  const credibilityScore = imageAnalysis.has_image
    ? Math.round(0.7 * textAnalysis.score + 0.3 * imageAnalysis.score)
    : textAnalysis.score;

  const hasBothSignals =
    textAnalysis.positive_signals.length > 0 && textAnalysis.has_major_anomalies;

  // Classify by threshold
  let prediction: "Real" | "Fake" | "Uncertain";
  if (credibilityScore >= 66) {
    prediction = "Real";
  } else if (credibilityScore <= 40) {
    prediction = "Fake";
  } else {
    prediction = "Uncertain";
  }

  // Override: speculative language only (NOT positive uncertainty)
  const speculationOverride = textAnalysis.negative_uncertainty_count >= 2;
  // Override: contradiction between credibility signals and hard anomalies
  const contradictionOverride = hasBothSignals && prediction === "Real";

  if (speculationOverride || contradictionOverride) {
    prediction = "Uncertain";
  }

  // ── Build explanation ──────────────────────────────────────

  const explanation: string[] = [];

  if (speculationOverride) {
    explanation.push(
      `${textAnalysis.negative_uncertainty_count} speculative phrase(s) detected — classification capped at UNCERTAIN`
    );
  }

  if (contradictionOverride) {
    explanation.push(
      "Credibility signals and anomaly signals both present — classification downgraded to UNCERTAIN"
    );
  }

  // Responsible journalism note (only when positive uncertainty is the dominant signal)
  if (
    textAnalysis.positive_uncertainty_count > 0 &&
    textAnalysis.negative_uncertainty_count === 0
  ) {
    explanation.push(
      `${textAnalysis.positive_uncertainty_count} responsible uncertainty phrase(s) detected — treated as cautious reporting`
    );
  } else if (
    textAnalysis.positive_uncertainty_count > 0 &&
    textAnalysis.negative_uncertainty_count > 0
  ) {
    explanation.push(
      `Mixed uncertainty signals: ${textAnalysis.positive_uncertainty_count} responsible phrase(s), ${textAnalysis.negative_uncertainty_count} speculative phrase(s)`
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
