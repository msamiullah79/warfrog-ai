/**
 * Multi-modal fake news analysis engine — v4 (simplified pure scoring)
 *
 * Scoring philosophy:
 * - Baseline: 50 (neutral)
 * - Apply positive and negative signal adjustments
 * - Single override rule: strong positive + strong negative → UNCERTAIN
 * - No image: use text score only (no default image score blending)
 * - Thresholds: 0–39 FAKE | 40–69 UNCERTAIN | 70–100 REAL
 */

// ─────────────────────────────────────────────────────────────
// POSITIVE SIGNALS
// ─────────────────────────────────────────────────────────────

/** +10 — Neutral, factual tone indicators */
const FACTUAL_TONE = [
  /\b(according to|confirmed|reported|stated|announced|published)\b/i,
  /\b(data shows?|evidence (suggests?|indicates?)|findings? (show|suggest|indicate))\b/i,
  /\b(in a statement|on record|officially)\b/i,
];

/** +10 — Structured, multi-paragraph reporting indicators */
const STRUCTURED_REPORTING = [
  /\b(however|in contrast|on the other hand|meanwhile|additionally|furthermore)\b/i,
  /\b(background|context|previously|in response|following)\b/i,
  /\b(correction|clarification|editor.?s note|update)\b/i,
];

/** +5 — Contextual attribution (softer sourcing that still adds credibility) */
const CONTEXTUAL_ATTRIBUTION = [
  /\baccording to officials?\b/i,
  /\bauthorities?\s+said\b/i,
  /\banalysts?\s+stated\b/i,
  /\breports?\s+indicate\b/i,
  /\bspokesperson\s+(said|confirmed|stated|told)\b/i,
  /\bofficials?\s+(told|confirmed|stated|said)\b/i,
  /\bdata\s+(shows?|indicates?|suggests?)\b/i,
];

/** +10 — Named officials or institutional references */
const INSTITUTIONAL_REFERENCES = [
  /\b(president|minister|senator|governor|director|secretary|spokesperson|commissioner)\b/i,
  /\b(WHO|UN|NATO|CDC|FBI|CIA|Pentagon|parliament|congress|senate|supreme court)\b/i,
  /\b(university|hospital|institute|agency|department|ministry|bureau|authority)\b/i,
  /\b(professor|dr\.|doctor|researcher|scientist|analyst|expert)\b/i,
];

/** +5 — Responsible uncertainty (cautious, transparent journalism) */
const RESPONSIBLE_UNCERTAINTY = [
  /\bnot\s+yet\s+confirmed\b/i,
  /\bofficials?\s+(have\s+)?not\s+(yet\s+)?confirmed\b/i,
  /\bawaiting\s+(independent\s+)?verification\b/i,
  /\bpreliminary\s+(assessment|findings?|results?|data)\b/i,
  /\bindependent\s+verification\s+(was\s+)?(not\s+)?(immediately\s+)?available\b/i,
  /\bcould\s+not\s+be\s+independently\s+verified\b/i,
  /\bsubject\s+to\s+(change|revision|further\s+review)\b/i,
  /\bsent\s+(a\s+)?request\s+for\s+comment\b/i,
];

// ─────────────────────────────────────────────────────────────
// NEGATIVE SIGNALS
// ─────────────────────────────────────────────────────────────

/** -15 — Sensational / clickbait language */
const SENSATIONAL_LANGUAGE = [
  /\b(BREAKING|URGENT|BOMBSHELL|SHOCKING|EXPLOSIVE|EXPOSED)\b/i,
  /\b(massive destruction|total collapse|complete disaster|wiped out|obliterated)\b/i,
  /\b(you won'?t believe|mind.?blow|jaw.?drop|unbelievable|insane)\b/i,
  /\b(share before deleted|must share|going viral|spread the word|wake up)\b/i,
  /\b(illuminati|deep state|new world order|cabal|globalist|psyop|false flag)\b/i,
  /\b(hoax|fabricated|staged|cover.?up|hidden truth|they don'?t want you to know)\b/i,
];

/** -15 — Strong unverified / speculative sourcing */
const UNVERIFIED_CLAIMS = [
  /\breportedly\b/gi,
  /\bclaims?\s+that\b/gi,
  /\bsources?\s+say\b/gi,
  /\ballegedly\b/gi,
  /\banonymous\s+source/gi,
  /\bunverified\s+reports?\b/gi,
  /\bpurportedly\b/gi,
  /\bsome\s+(people\s+)?(say|believe|claim)\b/gi,
];

/** -10 — Speculation / hedging without basis */
const SPECULATION_PHRASES = [
  /\bmay\s+have\b/gi,
  /\bcould\s+indicate\b/gi,
  /\banalysts?\s+believe\b/gi,
  /\bexperts?\s+fear\b/gi,
  /\bsuspected\s+to\b/gi,
  /\bthought\s+to\s+be\b/gi,
  /\bappears?\s+to\b/gi,
  /\bseems?\s+to\b/gi,
];

/** -10 — Exaggerated impact without evidence */
const EXAGGERATED_IMPACT = [
  /\b(hundreds of thousands|millions? (are|will be)|entire (country|nation|world))\b/i,
  /\b(unprecedented|never before seen|history.?making|once.?in.?a.?lifetime)\b/i,
  /\b(100%|guaranteed|proven beyond|absolute proof|definitive evidence)\b/i,
  /\b(everyone (knows?|agrees?|says?)|nobody (talks? about|reports?))\b/i,
];

/** -5 — Excessive capitalization */
const EXCESSIVE_CAPS = /[A-Z]{5,}/;

/**
 * -20 — Extraordinary claims: physically/technically implausible assertions
 * with zero grounding in real-world constraints.
 * These indicate fantasy-level content regardless of surrounding tone.
 */
const EXTRAORDINARY_CLAIMS = [
  /\binvisible\s+(drone|aircraft|weapon|tech|technology)\b/i,
  /\badvanced\s+cloaking\s+system/i,
  /\bundetectable\s+by\s+(all|any|every)\b/i,
  /\bno\s+(satellite|global)\s+(detection|monitoring)\b/i,
  /\bwithout\s+(leaving\s+)?(any\s+)?(detectable\s+)?trace/i,
  /\bpenetrat\w*\s+(deep\s+)?underground\s+\w+\s+(instantly|immediately)\b/i,
  /\bexperimental\s+weapons?\s+capable\s+of\b/i,
  /\bunderground\s+military\s+city\b/i,
  /\bpreviously\s+unknown\s+(military\s+)?(alliance|coalition|group)\b/i,
  /\bsecret\s+(military\s+)?alliance\b/i,
];

/**
 * -15 — Absolute impossibility statements: zero-nuance total-destruction or
 * total-evasion claims that demand extraordinary evidence which is absent.
 */
const ABSOLUTE_STATEMENTS = [
  /\bwiping\s+out\s+entire\b/i,
  /\bentirely?\s+wipe[sd]?\s+out\b/i,
  /\bleft\s+no\s+survivors?\b/i,
  /\beras(e|ed|ing)\s+all\s+(infrastructure|evidence|traces?)\b/i,
  /\bcompletely\s+(destroy|destroyed|erase[sd]?)\s+\w+\s+without\b/i,
  /\bnew\s+era\s+of\s+undetectable\b/i,
  /\bgovernments?\s+worldwide\s+(have\s+)?refused\s+to\s+comment\b/i,
  /\bno\s+country\s+or\s+(agency|government|organization)\s+(has|have)\s+(confirmed|detected|reported)\b/i,
];

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────

export interface TextAnalysisResult {
  score: number;
  confidence: number;
  flags: string[];
  positive_signals: string[];
  has_strong_positive: boolean;
  has_strong_negative: boolean;
  negative_uncertainty_count: number;
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
// HELPERS
// ─────────────────────────────────────────────────────────────

/** Returns true if any pattern in the list matches the text. */
function anyMatch(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text));
}

/** Returns match count across all patterns in the list. */
function countMatches(patterns: RegExp[], text: string): number {
  return patterns.reduce((sum, p) => {
    const m = text.match(new RegExp(p.source, p.flags.includes("g") ? p.flags : p.flags + "g"));
    return sum + (m ? m.length : 0);
  }, 0);
}

// ─────────────────────────────────────────────────────────────
// TEXT ANALYSIS
// ─────────────────────────────────────────────────────────────

/**
 * Analyzes news text using a pure additive/subtractive scoring model.
 * Baseline: 50. Final score clamped to [0, 100].
 */
export function analyzeText(text: string): TextAnalysisResult {
  const flags: string[] = [];
  const positive_signals: string[] = [];
  let score = 50;

  // ── POSITIVE SIGNALS ──────────────────────────────────────

  const hasFactualTone = anyMatch(FACTUAL_TONE, text);
  if (hasFactualTone) {
    score += 15;
    positive_signals.push("Neutral, factual tone detected");
  }

  const hasStructuredReporting = anyMatch(STRUCTURED_REPORTING, text);
  if (hasStructuredReporting) {
    score += 12;
    positive_signals.push("Structured, multi-perspective reporting detected");
  }

  const hasContextualAttribution = anyMatch(CONTEXTUAL_ATTRIBUTION, text);
  if (hasContextualAttribution) {
    score += 5;
    positive_signals.push("Contextual attribution language present");
  }

  const hasInstitutionalRef = anyMatch(INSTITUTIONAL_REFERENCES, text);
  if (hasInstitutionalRef) {
    score += 10;
    positive_signals.push("Official or institutional references present");
  }

  const responsibleUncertaintyCount = countMatches(RESPONSIBLE_UNCERTAINTY, text);
  if (responsibleUncertaintyCount > 0) {
    score += 5;
    positive_signals.push(
      `Responsible uncertainty language present (${responsibleUncertaintyCount} instance${responsibleUncertaintyCount > 1 ? "s" : ""})`
    );
  }

  // ── NEGATIVE SIGNALS ──────────────────────────────────────

  const sensationalMatches = SENSATIONAL_LANGUAGE.filter((p) => p.test(text));
  if (sensationalMatches.length > 0) {
    score -= 15;
    flags.push("Sensational or clickbait language detected");
  }

  const unverifiedCount = countMatches(UNVERIFIED_CLAIMS, text);
  if (unverifiedCount > 0) {
    score -= 15;
    flags.push(
      `Strong unverified sourcing language detected (${unverifiedCount} instance${unverifiedCount > 1 ? "s" : ""})`
    );
  }

  const speculationCount = countMatches(SPECULATION_PHRASES, text);
  if (speculationCount === 1) {
    // Single instance of speculation is a minor concern, not a major anomaly.
    // Does NOT block REAL classification when strong credibility signals are present.
    score -= 3;
    flags.push("Minor speculative phrasing detected (1 instance) — low weight");
  } else if (speculationCount >= 2) {
    // Repeated speculation is a meaningful signal — apply the full penalty.
    score -= 10;
    flags.push(`Heavy speculative phrasing detected (${speculationCount} instances)`);
  }

  const hasExaggeratedImpact = anyMatch(EXAGGERATED_IMPACT, text);
  if (hasExaggeratedImpact) {
    score -= 10;
    flags.push("Exaggerated impact claims without supporting evidence");
  }

  // Extraordinary claims: physically/technically implausible assertions.
  // Fired regardless of surrounding tone — positive signals cannot redeem these.
  const extraordinaryCount = countMatches(EXTRAORDINARY_CLAIMS, text);
  if (extraordinaryCount >= 1) {
    score -= 20;
    flags.push(
      `Extraordinary or implausible claim detected (${extraordinaryCount} instance${extraordinaryCount > 1 ? "s" : ""}) — high anomaly weight`
    );
  }

  // Absolute impossibility statements: zero-nuance total-destruction or total-evasion claims.
  const absoluteCount = countMatches(ABSOLUTE_STATEMENTS, text);
  if (absoluteCount >= 1) {
    score -= 15;
    flags.push(
      `Absolute impossibility statement detected (${absoluteCount} instance${absoluteCount > 1 ? "s" : ""}) — claim severity exceeds evidence`
    );
  }

  if (EXCESSIVE_CAPS.test(text)) {
    score -= 5;
    flags.push("Excessive capitalization detected");
  }

  // ── SHORT CONTENT FLAG (mild penalty) ─────────────────────

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    score -= 8;
    flags.push("Very short content — insufficient for reliable assessment");
  }

  // ── CLAMP ─────────────────────────────────────────────────

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── STRONG SIGNAL FLAGS (used by computeFinalScore) ───────

  const hasStrongPositive = hasFactualTone || hasInstitutionalRef || hasStructuredReporting;
  const hasStrongNegative =
    sensationalMatches.length > 0 || unverifiedCount > 0 || extraordinaryCount > 0;

  const totalSignals = flags.length + positive_signals.length;
  const confidence = Math.min(0.95, 0.4 + totalSignals * 0.06);

  return {
    score,
    confidence: Math.round(confidence * 100) / 100,
    flags,
    positive_signals,
    has_strong_positive: hasStrongPositive,
    has_strong_negative: hasStrongNegative,
    negative_uncertainty_count: unverifiedCount,
    positive_uncertainty_count: responsibleUncertaintyCount,
    has_major_anomalies: sensationalMatches.length > 0 || extraordinaryCount > 0,
  };
}

// ─────────────────────────────────────────────────────────────
// IMAGE ANALYSIS
// ─────────────────────────────────────────────────────────────

/**
 * Analyzes image metadata and basic file properties.
 * Returns has_image: false when no image is supplied;
 * computeFinalScore uses text-only in that case.
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

function checkJpegExif(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;
  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) break;
    const markerType = buffer[offset + 1];
    if (markerType === 0xe1) {
      return buffer.slice(offset + 4, offset + 8).toString("ascii") === "Exif";
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
 * Combines text (and optional image) into a final credibility result.
 *
 * Classification:
 *   0–39   → Fake
 *   40–69  → Uncertain
 *   70–100 → Real
 *
 * Single override rule:
 *   strong positive signals AND strong negative signals → Uncertain
 *   (handles subtle / well-crafted misinformation)
 *
 * No image: final score = text score only (no blending).
 */
export function computeFinalScore(
  textAnalysis: TextAnalysisResult,
  imageAnalysis: ImageAnalysisResult
): FullAnalysisResult {
  const credibilityScore = imageAnalysis.has_image
    ? Math.round(0.7 * textAnalysis.score + 0.3 * imageAnalysis.score)
    : textAnalysis.score;

  // Classify by threshold
  let prediction: "Real" | "Fake" | "Uncertain";
  if (credibilityScore >= 70) {
    prediction = "Real";
  } else if (credibilityScore <= 39) {
    prediction = "Fake";
  } else {
    prediction = "Uncertain";
  }

  // Single override: conflicting strong signals → Uncertain
  const contradictionOverride =
    textAnalysis.has_strong_positive && textAnalysis.has_strong_negative;

  if (contradictionOverride && prediction !== "Fake") {
    prediction = "Uncertain";
  }

  // ── Build explanation ──────────────────────────────────────

  const explanation: string[] = [];

  if (contradictionOverride) {
    explanation.push(
      "Strong credibility signals and strong anomaly signals both present — classified as UNCERTAIN"
    );
  }

  if (textAnalysis.positive_signals.length > 0) {
    explanation.push(`Credibility signals: ${textAnalysis.positive_signals.slice(0, 3).join("; ")}`);
  }

  if (textAnalysis.flags.length > 0) {
    explanation.push(`Anomaly flags: ${textAnalysis.flags.slice(0, 4).join("; ")}`);
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
    explanation.push("Content meets credibility threshold — consistent with real reporting");
  } else if (prediction === "Fake") {
    explanation.push("Content shows strong indicators associated with misinformation");
  } else {
    explanation.push("Mixed signals detected — manual verification recommended");
  }

  return {
    credibility_score: credibilityScore,
    prediction,
    explanation,
    text_analysis: textAnalysis,
    image_analysis: imageAnalysis,
  };
}
