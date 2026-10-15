import type { Credibility, Paper } from "@/types/domain";

/**
 * Ranking features per paper (RK-01). Pure and deterministic. Inputs are scholar data (`paper`)
 * and code-computed `credibility.inputs` only — never the LLM analysis.
 * `id` is the weight key for RK-02; `label` is short UI copy for RK-03.
 */

export type FeatureKind = "topic" | "keyword" | "study" | "year" | "venue" | "cited";

export interface PaperFeature {
  id: string;
  kind: FeatureKind;
  label: string;
}

const MAX_TOPICS = 5;
const MAX_KEYWORDS = 8;
const MIN_KEYWORD_LENGTH = 4;

const feature = (kind: FeatureKind, slug: string, label: string): PaperFeature => ({
  id: `${kind}:${slug}`,
  kind,
  label,
});

const slugify = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

function topicFeatures(topics: string[]): PaperFeature[] {
  return topics
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => feature("topic", slugify(t), t))
    .slice(0, MAX_TOPICS * 2); // dedupe happens in extractFeatures; cap after it
}

// English function words plus words that appear in most paper titles and carry no preference.
const STOPWORDS = new Set(
  (
    "about above after again against also among amongst and are because been before being " +
    "between both but can could does doing down during each from further have having here " +
    "into itself just more most much must other over same should some such than that their " +
    "them then there these they this those through under until upon very were what when where " +
    "which while whom will with within without would your " +
    "analysis approach based case data effect evidence finding impact implication " +
    "investigation outcome paper research result review role study using toward towards"
  ).split(" "),
);

/** Crude plural fold: studies → study, adolescents → adolescent; keeps stress/status/analysis. */
function singular(word: string): string {
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !/(ss|us|is)$/.test(word)) return word.slice(0, -1);
  return word;
}

function keywordFeatures(title: string): PaperFeature[] {
  // Hyphenated compounds stay whole: well-being, cross-sectional.
  const words = title.toLowerCase().match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];
  const seen = new Set<string>();
  const out: PaperFeature[] = [];
  for (const raw of words) {
    if (raw.length < MIN_KEYWORD_LENGTH) continue;
    const word = singular(raw);
    if (STOPWORDS.has(word) || seen.has(word)) continue;
    seen.add(word);
    out.push(feature("keyword", word, word));
    if (out.length === MAX_KEYWORDS) break;
  }
  return out;
}

const STUDY_TYPES: { slug: string; label: string; pattern: RegExp }[] = [
  { slug: "review", label: "Reviews", pattern: /\breviews?\b|\bmeta-?analy/i },
  {
    slug: "longitudinal",
    label: "Longitudinal studies",
    pattern:
      /\blongitudinal\b|\bcohort\b|\bpanel\b|\bprospective\b|\bfollow-?up\b|\bcross-lagged\b/i,
  },
  {
    slug: "trial",
    label: "Trials and interventions",
    pattern: /\brandomi[sz]ed\b|\bcontrolled trial\b|\bRCTs?\b|\binterventions?\b/i,
  },
  {
    slug: "cross-sectional",
    label: "Surveys",
    pattern: /\bcross-sectional\b|\bsurveys?\b|\bquestionnaires?\b/i,
  },
  {
    slug: "qualitative",
    label: "Qualitative studies",
    pattern: /\bqualitative\b|\binterviews?\b|\bfocus groups?\b|\bthematic\b/i,
  },
];

function studyFeatures(title: string): PaperFeature[] {
  return STUDY_TYPES.filter((s) => s.pattern.test(title)).map((s) =>
    feature("study", s.slug, s.label),
  );
}

function yearFeature(year: number | undefined, now: Date): PaperFeature[] {
  if (!year || !Number.isFinite(year)) return [];
  const age = now.getUTCFullYear() - year;
  if (age < 0) return [];
  if (age <= 2) return [feature("year", "last-2-years", "Last 2 years")];
  if (age <= 5) return [feature("year", "3-5-years", "3–5 years old")];
  if (age <= 10) return [feature("year", "6-10-years", "6–10 years old")];
  return [feature("year", "older", "Older than 10 years")];
}

const VENUE_LABELS = {
  journal: "Journals",
  conference: "Conference papers",
  preprint: "Preprints",
  book: "Books",
} as const;
type VenueType = keyof typeof VENUE_LABELS;

const isVenueType = (value: unknown): value is VenueType =>
  typeof value === "string" && Object.hasOwn(VENUE_LABELS, value);

function guessVenueType(venue: string | undefined): VenueType | undefined {
  if (!venue) return undefined;
  if (/\b(arxiv|biorxiv|medrxiv|psyarxiv|ssrn|research square|osf)\b/i.test(venue)) {
    return "preprint";
  }
  if (/\b(conference|proceedings|symposium|workshop)\b/i.test(venue)) return "conference";
  if (/\b(book|chapter|handbook)\b/i.test(venue)) return "book";
  return undefined;
}

function venueFeature(paper: Paper, credibility: Credibility | undefined): PaperFeature[] {
  const fromInputs = credibility?.inputs.venueType;
  const type = isVenueType(fromInputs) ? fromInputs : guessVenueType(paper.venue);
  return type ? [feature("venue", type, VENUE_LABELS[type])] : [];
}

function citedFeature(count: number | undefined): PaperFeature[] {
  if (count === undefined || !Number.isFinite(count) || count < 0) return [];
  if (count < 10) return [feature("cited", "rarely", "Rarely cited")];
  if (count < 100) return [feature("cited", "some", "Cited")];
  if (count < 1000) return [feature("cited", "well", "Well cited")];
  return [feature("cited", "highly", "Highly cited")];
}

/** Features in kind order (topic, keyword, study, year, venue, cited), unique by id. */
export function extractFeatures(
  paper: Paper,
  { credibility, now = new Date() }: { credibility?: Credibility; now?: Date } = {},
): PaperFeature[] {
  const seen = new Set<string>();
  const unique = (features: PaperFeature[]) =>
    features.filter((f) => !seen.has(f.id) && seen.add(f.id));

  return [
    ...unique(topicFeatures(paper.topics)).slice(0, MAX_TOPICS),
    ...unique(keywordFeatures(paper.title)),
    ...unique(studyFeatures(paper.title)),
    ...yearFeature(paper.year, now),
    ...venueFeature(paper, credibility),
    ...citedFeature(paper.citationCount),
  ];
}
