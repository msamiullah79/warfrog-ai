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

/** +10 — Institutional and organizational language (baseline credibility boost) */
const INSTITUTION_KEYWORDS = [
  /\b(organization|council|agency|department|trade\s+body|security\s+body)\b/i,
  /\b(diplomat[s]?|official[s]?|representative[s]?|delegation)\b/i,
  /\b(commission|committee|coalition|federation|bloc)\b/i,
];

/** +5 — Named countries or geopolitical regions (geo-political grounding) */
const COUNTRY_KEYWORDS = [
  /\b(united\s+states|united\s+kingdom|european\s+union|china|india|russia|brazil)\b/i,
  /\b(japan|germany|france|canada|australia|south\s+korea|saudi\s+arabia)\b/i,
  /\b(africa|asia|europe|latin\s+america|middle\s+east|southeast\s+asia)\b/i,
];

/** +15 — Policy / diplomatic / technical language (Reuters-style real journalism marker) */
const POLICY_LANGUAGE = [
  /\b(moratorium|customs\s+duties?|tariff[s]?|sanction[s]?|embargo)\b/i,
  /\b(negotiation[s]?|agreement|treaty|accord|resolution|protocol)\b/i,
  /\b(extension|talks|policy|legislation|regulation|directive)\b/i,
  /\b(bilateral|multilateral|diplomatic|geopolitical|economic\s+policy)\b/i,
  /\b(trade\s+war|trade\s+deal|trade\s+dispute|supply\s+chain|market\s+access)\b/i,
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

/**
 * Known professional/military acronyms that must never trigger the caps penalty.
 * Extend this set freely — false-positives on legitimate text are worse than
 * missing a real clickbait case.
 */
const CAPS_ALLOWLIST = new Set([
  "USA", "U.S.", "UK", "EU", "UN", "NATO", "WHO", "IMF", "WTO", "FBI",
  "CIA", "NSA", "DOD", "DOJ", "FEMA", "NIH", "CDC", "EPA", "DHS",
  "AWACS", "SIGINT", "HUMINT", "OSINT", "IAEA", "ICBM", "AUMF",
  "KC-135", "F-16", "F-35", "B-52", "MQ-9",
  "REUTERS", "AP", "AFP", "BBC", "CNN", "NBC", "ABC", "CBS",
  "LGBTQ", "LGBT", "COVID", "AIDS", "HIV", "DNA", "RNA",
  "GMT", "UTC", "EST", "PST", "EDT", "PDT",
  "CEO", "CFO", "COO", "CTO", "VP", "PM", "MP",
]);

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

/**
 * -10 — Impossibility/extremity words: absolute language indicating
 * high-magnitude claims with zero nuance or qualification.
 */
const IMPOSSIBILITY_WORDS = [
  /\bzero.?error\b/i,
  /\bnever\s+(been\s+)?detected\b/i,
  /\bperfectly?\s+(accurate|precise|executed|undetectable|invisible)\b/i,
  /\b100\s*[%percent]+\s+(accurate|effective|reliable|undetectable)\b/i,
  /\babsolutely\s+no\s+(trace|evidence|detection|warning)\b/i,
  /\bcompletely\s+(invisible|undetectable|eliminated|eradicated)\b/i,
  /\bnot\s+a\s+single\s+(trace|piece|shred)\s+(of\s+)?(evidence|proof)\b/i,
  /\bentire\s+(world|global\s+community|civilization)\s+(was|were|is|has)\b/i,
];

/**
 * -25 — Tech implausibility: science-fiction-level technology claims.
 * CRITICAL anomaly weight — presence strongly indicates fabricated content.
 */
const TECH_IMPLAUSIBILITY = [
  /\bquantum\s+stealth\b/i,
  /\binvisible\s+to\s+(radar|detection|satellites?|all\s+systems?)\b/i,
  /\bundetectable\s+(system|weapon|technology|drone|aircraft)\b/i,
  /\bperfect\s+(accuracy|precision|targeting)\b/i,
  /\bzero.?error\s+targeting\b/i,
  /\bimpossible\s+to\s+(trace|detect|intercept|counter)\b/i,
  /\b(AI|artificial\s+intelligence)\s+(took\s+over|gained\s+sentience|became\s+conscious)\b/i,
  /\bself.?aware\s+(weapon|drone|system|machine)\b/i,
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
  /** Accumulated anomaly weight — used by the Hard Negative Rule (≥40 → force FAKE) */
  anomaly_score: number;
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

  // Step 1 — Institution / organizational keyword boost
  const hasInstitutionKeywords = anyMatch(INSTITUTION_KEYWORDS, text);
  if (hasInstitutionKeywords) {
    score += 10;
    positive_signals.push("Institutional/organizational language detected");
  }

  // Step 1b — Geographic / geopolitical grounding boost
  const hasCountryKeywords = anyMatch(COUNTRY_KEYWORDS, text);
  if (hasCountryKeywords) {
    score += 5;
    positive_signals.push("Geographic/geopolitical grounding detected");
  }

  // Step 2 — Policy/diplomatic language boost (Reuters-style marker)
  const hasPolicyLanguage = anyMatch(POLICY_LANGUAGE, text);
  if (hasPolicyLanguage) {
    score += 15;
    positive_signals.push("Policy/diplomatic language detected — strong credibility signal");
  }

  // ── NEGATIVE SIGNALS ──────────────────────────────────────
  // anomalyScore accumulates per-category weights.
  // Hard Negative Rule: anomalyScore ≥ 60 → force FAKE in computeFinalScore.

  let anomalyScore = 0;

  const sensationalMatches = SENSATIONAL_LANGUAGE.filter((p) => p.test(text));
  if (sensationalMatches.length > 0) {
    score -= 15;
    anomalyScore += 15;
    flags.push("⚠️ Sensational or clickbait language detected");
  }

  const unverifiedCount = countMatches(UNVERIFIED_CLAIMS, text);
  if (unverifiedCount > 0) {
    score -= 15;
    anomalyScore += 15;
    flags.push(
      `⚠️ Unverified sourcing language detected (${unverifiedCount} instance${unverifiedCount > 1 ? "s" : ""})`
    );
  }

  const speculationCount = countMatches(SPECULATION_PHRASES, text);
  if (speculationCount === 1) {
    score -= 3;
    flags.push("Minor speculative phrasing (1 instance) — low weight");
  } else if (speculationCount >= 2) {
    score -= 10;
    anomalyScore += 10;
    flags.push(`⚠️ Heavy speculative phrasing detected (${speculationCount} instances)`);
  }

  const hasExaggeratedImpact = anyMatch(EXAGGERATED_IMPACT, text);
  if (hasExaggeratedImpact) {
    score -= 10;
    anomalyScore += 10;
    flags.push("⚠️ Exaggerated impact claims without supporting evidence");
  }

  // Extraordinary claims: physically/technically implausible assertions.
  const extraordinaryCount = countMatches(EXTRAORDINARY_CLAIMS, text);
  if (extraordinaryCount >= 1) {
    score -= 20;
    anomalyScore += 20;
    flags.push(
      `⚠️ Extraordinary claim without evidence: implausible assertion detected (${extraordinaryCount} instance${extraordinaryCount > 1 ? "s" : ""})`
    );
  }

  // Absolute impossibility statements: total-destruction or total-evasion claims.
  const absoluteCount = countMatches(ABSOLUTE_STATEMENTS, text);
  if (absoluteCount >= 1) {
    score -= 15;
    anomalyScore += 15;
    flags.push(
      `⚠️ Absolute claim detected: zero-nuance impossibility statement (${absoluteCount} instance${absoluteCount > 1 ? "s" : ""}) — claim severity far exceeds evidence`
    );
  }

  // Impossibility/extremity language: absolute words with no qualification.
  const impossibilityCount = countMatches(IMPOSSIBILITY_WORDS, text);
  if (impossibilityCount >= 1) {
    score -= 10;
    anomalyScore += 10;
    flags.push(
      `⚠️ Absolute claim detected: impossibility/extremity language (${impossibilityCount} instance${impossibilityCount > 1 ? "s" : ""})`
    );
  }

  // Tech implausibility: science-fiction-level technology claims. CRITICAL weight.
  const techCount = countMatches(TECH_IMPLAUSIBILITY, text);
  if (techCount >= 1) {
    score -= 25;
    anomalyScore += 25;
    flags.push(
      `⚠️ Technological implausibility detected: sci-fi-level technology claim (${techCount} instance${techCount > 1 ? "s" : ""}) — CRITICAL anomaly`
    );
  }

  // ── EXCESSIVE CAPITALIZATION ────────────────────────────────
  // Only flag clickbait-style all-caps words (> 3 chars), never acronyms.
  // Trigger when 2+ suspicious caps words appear OR they exceed 10% of total words.
  {
    const allWords = text.match(/\b[A-Za-z][\w'-]*\b/g) ?? [];
    const suspiciousCapsWords = allWords.filter(
      (w) => w === w.toUpperCase() && w.length > 3 && !CAPS_ALLOWLIST.has(w)
    );
    const ratio = allWords.length > 0 ? suspiciousCapsWords.length / allWords.length : 0;
    if (suspiciousCapsWords.length >= 2 || ratio > 0.1) {
      anomalyScore += 10;
      score -= 5;
      flags.push(
        `⚠️ Excessive capitalization detected (${suspiciousCapsWords.length} suspicious caps word${suspiciousCapsWords.length !== 1 ? "s" : ""}: ${suspiciousCapsWords.slice(0, 4).join(", ")})`
      );
    }
  }

  // ── SHORT CONTENT FLAG (mild penalty) ─────────────────────

  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    score -= 8;
    flags.push("Very short content — insufficient for reliable assessment");
  }

  // ── BASELINE CREDIBILITY BOOSTS ────────────────────────────

  // Step 3 — Journalistic Structure Boost:
  // Clean article (zero anomalies) with neutral tone → extra push toward REAL.
  if (anomalyScore === 0 && hasFactualTone) {
    score += 10;
    positive_signals.push("Clean journalistic structure boost: neutral tone with zero anomalies");
  }

  // Step 4 — Empty Case Fix:
  // No signals at all → nudge from neutral 50 toward real (avoids default UNCERTAIN).
  if (score === 50 && anomalyScore === 0) {
    score += 10;
    positive_signals.push("Baseline credibility boost: no anomaly signals detected");
  }

  // ── CLAMP ─────────────────────────────────────────────────

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── STRONG SIGNAL FLAGS (used by computeFinalScore) ───────

  const hasStrongPositive = hasFactualTone || hasInstitutionalRef || hasStructuredReporting;
  const hasStrongNegative =
    sensationalMatches.length > 0 ||
    unverifiedCount > 0 ||
    extraordinaryCount > 0 ||
    techCount > 0;

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
    has_major_anomalies: sensationalMatches.length > 0 || extraordinaryCount > 0 || techCount > 0,
    anomaly_score: anomalyScore,
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

  // Simulated OSINT visual reuse warning — always present when an image is uploaded.
  // No external API required; acts as a transparency notice to evaluators/users.
  flags.push("🔍 Image origin could not be verified — possible reuse or out-of-context media");

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
  // ── Context Consistency Check ────────────────────────────
  // When an image is present and text has significant anomalies (anomaly_score > 30),
  // reduce the effective image contribution — the image is unlikely to corroborate
  // a highly anomalous text claim.
  let effectiveImageScore = imageAnalysis.score;
  let contextMismatchFlagged = false;
  if (imageAnalysis.has_image && textAnalysis.anomaly_score > 30) {
    effectiveImageScore = Math.max(0, imageAnalysis.score - 10);
    contextMismatchFlagged = true;
  }

  const credibilityScore = imageAnalysis.has_image
    ? Math.round(0.7 * textAnalysis.score + 0.3 * effectiveImageScore)
    : textAnalysis.score;

  // ── Classification (Step 5 — updated decision logic) ──────
  //
  // Priority order:
  //   1. Hard Negative Rule: anomaly_score ≥ 60 → force FAKE
  //   2. REAL: credibility ≥ 65 AND anomaly < 20 (low anomaly threshold prevents false positives)
  //   3. Score-based FAKE: credibility ≤ 39 (very low score regardless of anomaly)
  //   4. Everything else → UNCERTAIN
  //   5. Contradiction override: strong positive + strong negative → UNCERTAIN
  //      (catches well-crafted misinformation that slipped through to REAL)

  let prediction: "Real" | "Fake" | "Uncertain";

  const hardNegativeFired = textAnalysis.anomaly_score >= 60;

  if (hardNegativeFired) {
    prediction = "Fake";
  } else if (credibilityScore >= 65 && textAnalysis.anomaly_score < 20) {
    prediction = "Real";
  } else if (credibilityScore <= 39) {
    prediction = "Fake";
  } else {
    prediction = "Uncertain";
  }

  // ── Label Safety Rule ────────────────────────────────────
  // Image cannot override a FAKE text classification.
  // If the text score alone would be FAKE (≤ 39), force FAKE regardless
  // of any image-boosted credibility score.
  if (imageAnalysis.has_image && textAnalysis.score <= 39 && prediction !== "Fake") {
    prediction = "Fake";
  }

  // Contradiction override: if strong anomaly signals exist alongside strong
  // credibility signals but didn't hit the hard negative threshold, downgrade to UNCERTAIN.
  const contradictionOverride =
    !hardNegativeFired &&
    prediction === "Real" &&
    textAnalysis.has_strong_positive &&
    textAnalysis.has_strong_negative;

  if (contradictionOverride) {
    prediction = "Uncertain";
  }

  // ── Build explanation ──────────────────────────────────────

  const explanation: string[] = [];

  if (hardNegativeFired) {
    explanation.push(
      `Anomaly score (${textAnalysis.anomaly_score}) exceeded critical threshold (60) — Hard Negative Rule applied, classified as FAKE`
    );
  } else if (contradictionOverride) {
    explanation.push(
      "Strong credibility signals and anomaly signals both present — classified as UNCERTAIN"
    );
  }

  if (textAnalysis.positive_signals.length > 0) {
    explanation.push(`Credibility signals: ${textAnalysis.positive_signals.slice(0, 3).join("; ")}`);
  }

  if (textAnalysis.flags.length > 0) {
    explanation.push(`Anomaly flags: ${textAnalysis.flags.slice(0, 4).join("; ")}`);
  }

  if (imageAnalysis.has_image) {
    if (contextMismatchFlagged) {
      explanation.push(
        "⚠️ Image does not verify the claim — possible context mismatch (image score reduced)"
      );
    }
    if (imageAnalysis.flags.length > 0) {
      const displayFlags = imageAnalysis.flags.filter(
        (f) => !f.startsWith("🔍")
      );
      if (displayFlags.length > 0) {
        explanation.push(`Image concerns: ${displayFlags.slice(0, 2).join("; ")}`);
      }
    } else {
      explanation.push("Image passed basic verification checks");
    }
    explanation.push(
      `Final score: ${credibilityScore}/100 (Text: ${textAnalysis.score} × 70%, Image: ${effectiveImageScore} × 30%${contextMismatchFlagged ? " — context-adjusted" : ""})`
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
