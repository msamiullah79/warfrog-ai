/**
 * Multi-modal fake news analysis engine.
 * Uses rule-based NLP + image metadata checks.
 * No GPU or model training required.
 */

// Sensational / clickbait patterns that indicate potential fake news
const FAKE_INDICATORS = [
  { pattern: /\b(BREAKING|URGENT|EXCLUSIVE|SHOCKING|BOMBSHELL)\b/i, label: "Sensational headline keywords detected", weight: 15 },
  { pattern: /\b(you won'?t believe|mind.?blow|jaw.?drop|unbelievable)\b/i, label: "Clickbait language detected", weight: 12 },
  { pattern: /\b(they don'?t want you to know|secret|coverup|cover.?up|hidden truth)\b/i, label: "Conspiracy-style language detected", weight: 18 },
  { pattern: /\b(miracle|cure|100%|guaranteed|proven|scientifically proven)\b/i, label: "Unverified absolute claims detected", weight: 10 },
  { pattern: /\b(illuminati|deep state|new world order|globalist|cabal)\b/i, label: "Extreme conspiracy terminology detected", weight: 25 },
  { pattern: /\b(share before deleted|must share|going viral|spread the word)\b/i, label: "Viral share-bait language detected", weight: 14 },
  { pattern: /[!]{2,}/, label: "Excessive exclamation marks detected", weight: 8 },
  { pattern: /[A-Z]{5,}/, label: "Excessive capitalization detected", weight: 7 },
  { pattern: /\b(allegedly|reportedly|sources say|anonymous source)\b/i, label: "Unverified sourcing language", weight: 8 },
  { pattern: /\b(hoax|fabricated|staged|false flag|psyop)\b/i, label: "Disinformation terminology detected", weight: 20 },
  { pattern: /\b(mainstream media|msm|lamestream|fake news media)\b/i, label: "Anti-media bias indicators", weight: 10 },
];

// Credibility signals that suggest the article is legitimate
const CREDIBILITY_INDICATORS = [
  { pattern: /\b(according to|cited|referenced|published in|peer.?reviewed)\b/i, label: "Proper sourcing language", weight: 12 },
  { pattern: /\b(study|research|analysis|investigation|report)\b/i, label: "Research-based content indicators", weight: 8 },
  { pattern: /\b(percent|statistics|data|survey|sample size)\b/i, label: "Statistical data references", weight: 10 },
  { pattern: /\b(university|institute|department|ministry|official)\b/i, label: "Institutional references present", weight: 10 },
  { pattern: /\b(said in a statement|told reporters|press conference|spokesperson)\b/i, label: "Formal attribution present", weight: 12 },
  { pattern: /\b(correction|update|editor's note|clarification)\b/i, label: "Journalistic transparency markers", weight: 8 },
  { pattern: /\b(however|nevertheless|on the other hand|in contrast)\b/i, label: "Balanced reporting language", weight: 6 },
  { pattern: /\bhttps?:\/\/[^\s]+/i, label: "External links/sources included", weight: 10 },
];

interface TextAnalysisResult {
  score: number;
  confidence: number;
  flags: string[];
  positive_signals: string[];
}

interface ImageAnalysisResult {
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

/**
 * Analyzes text for fake news signals using pattern matching.
 * Returns a 0-100 credibility score and breakdown.
 */
export function analyzeText(text: string): TextAnalysisResult {
  const flags: string[] = [];
  const positive_signals: string[] = [];
  let penaltyPoints = 0;
  let bonusPoints = 0;

  // Check fake indicators
  for (const indicator of FAKE_INDICATORS) {
    if (indicator.pattern.test(text)) {
      flags.push(indicator.label);
      penaltyPoints += indicator.weight;
    }
  }

  // Check credibility indicators
  for (const indicator of CREDIBILITY_INDICATORS) {
    if (indicator.pattern.test(text)) {
      positive_signals.push(indicator.label);
      bonusPoints += indicator.weight;
    }
  }

  // Length analysis — very short articles can't be well-sourced
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  if (wordCount < 30) {
    flags.push("Very short content — insufficient for credibility assessment");
    penaltyPoints += 10;
  } else if (wordCount > 200) {
    positive_signals.push("Substantial article length indicates detailed reporting");
    bonusPoints += 5;
  }

  // Sentence variety check — fake news tends to be short punchy sentences
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const avgSentenceLength = wordCount / Math.max(sentences.length, 1);
  if (avgSentenceLength < 5 && wordCount > 20) {
    flags.push("Very short average sentence length — possible low-quality content");
    penaltyPoints += 5;
  }

  // Quote presence — real news quotes people
  const quoteMatches = text.match(/[""].+?[""]/g) || text.match(/".+?"/g) || [];
  if (quoteMatches.length > 0) {
    positive_signals.push("Direct quotations present");
    bonusPoints += 8;
  }

  // Compute raw score: start at 70 (neutral-positive), subtract penalties, add bonuses
  const rawScore = Math.max(0, Math.min(100, 70 - penaltyPoints + bonusPoints));

  // Confidence based on how many signals we found total
  const totalSignals = flags.length + positive_signals.length;
  const confidence = Math.min(0.95, 0.5 + totalSignals * 0.05);

  return {
    score: Math.round(rawScore),
    confidence: Math.round(confidence * 100) / 100,
    flags,
    positive_signals,
  };
}

/**
 * Analyzes image metadata and basic properties.
 * Checks for EXIF presence, suspicious characteristics.
 */
export function analyzeImage(
  imageBuffer: Buffer | null,
  mimeType: string | null
): ImageAnalysisResult {
  if (!imageBuffer || !mimeType) {
    return {
      score: 70, // Neutral when no image provided
      has_image: false,
      flags: [],
      positive_signals: ["No image provided — text-only analysis"],
    };
  }

  const flags: string[] = [];
  const positive_signals: string[] = [];
  let score = 80; // Start optimistic

  // Check MIME type
  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(mimeType.toLowerCase())) {
    flags.push("Unusual image format detected");
    score -= 15;
  } else {
    positive_signals.push(`Valid image format (${mimeType})`);
  }

  // Check file size — extremely small images can be thumbnails/stolen stock
  const fileSizeKb = imageBuffer.length / 1024;
  if (fileSizeKb < 5) {
    flags.push("Image file size very small — may be a placeholder or thumbnail");
    score -= 10;
  } else if (fileSizeKb > 10) {
    positive_signals.push("Image has reasonable file size");
  }

  // Check for JPEG EXIF signature
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

  // PNG screenshots tend to be very large in file size with even dimensions
  // Just note it as a potential indicator, not a penalty
  if (mimeType.includes("png") && fileSizeKb > 500) {
    flags.push("Large PNG file — could be a screenshot (minor concern)");
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
  // JPEG starts with FFD8, EXIF marker is FF E1 followed by "Exif"
  if (buffer.length < 4) return false;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return false;

  let offset = 2;
  while (offset < buffer.length - 4) {
    if (buffer[offset] !== 0xff) break;
    const markerType = buffer[offset + 1];
    if (markerType === 0xe1) {
      // APP1 marker — check for "Exif" string
      const exifStr = buffer.slice(offset + 4, offset + 8).toString("ascii");
      return exifStr === "Exif";
    }
    if (markerType === 0xda) break; // Start of scan — no more metadata
    const segmentLength = buffer.readUInt16BE(offset + 2);
    offset += 2 + segmentLength;
  }
  return false;
}

/**
 * Combines text and image analysis into a final credibility score.
 * Weights: 70% text, 30% image.
 */
export function computeFinalScore(
  textAnalysis: TextAnalysisResult,
  imageAnalysis: ImageAnalysisResult
): FullAnalysisResult {
  const credibilityScore =
    Math.round(0.7 * textAnalysis.score + 0.3 * imageAnalysis.score);

  let prediction: "Real" | "Fake" | "Uncertain";
  if (credibilityScore >= 65) {
    prediction = "Real";
  } else if (credibilityScore <= 40) {
    prediction = "Fake";
  } else {
    prediction = "Uncertain";
  }

  // Build explanation
  const explanation: string[] = [];

  if (textAnalysis.flags.length > 0) {
    explanation.push(`Text analysis flagged: ${textAnalysis.flags.slice(0, 3).join("; ")}`);
  }
  if (textAnalysis.positive_signals.length > 0) {
    explanation.push(`Credibility signals found: ${textAnalysis.positive_signals.slice(0, 2).join("; ")}`);
  }
  if (imageAnalysis.has_image) {
    if (imageAnalysis.flags.length > 0) {
      explanation.push(`Image concerns: ${imageAnalysis.flags.slice(0, 2).join("; ")}`);
    } else {
      explanation.push("Image passed basic verification checks");
    }
  } else {
    explanation.push("No image provided — analysis based on text only");
  }

  explanation.push(
    `Final score: ${credibilityScore}/100 (Text: ${textAnalysis.score}, Image: ${imageAnalysis.score})`
  );

  if (credibilityScore >= 65) {
    explanation.push("Content shows characteristics consistent with credible reporting");
  } else if (credibilityScore <= 40) {
    explanation.push("Content shows multiple indicators associated with misinformation");
  } else {
    explanation.push("Content shows mixed signals — manual verification recommended");
  }

  return {
    credibility_score: credibilityScore,
    prediction,
    explanation,
    text_analysis: textAnalysis,
    image_analysis: imageAnalysis,
  };
}
