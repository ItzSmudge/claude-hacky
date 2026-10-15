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
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");

function topicFeatures(topics: string[]): PaperFeature[] {
  const seen = new Set<string>();
  const out: PaperFeature[] = [];
  for (const topic of topics) {
    const label = topic.trim();
    const slug = slugify(label);
    // Punctuation-only topics slug to ""; "C++" and "C#" share "c" (acceptable).
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(feature("topic", slug, label));
    if (out.length === MAX_TOPICS) break;
  }
  return out;
}

// English function words plus words that appear in most paper titles and carry no preference.
const STOPWORDS = new Set(
  (
    "about above across after again against also among amongst and are because been before " +
    "being between both but can could does doing down during each from further have having here " +
    "into itself just more most much must other over same should some such than that their " +
    "them then there these they this those through under until upon very were what when where " +
    "versus whether which while whom will with within without would your " +
    "analyse analysis approach based case data effect evidence finding impact implication " +
    "investigation outcome paper research result review role study using toward towards"
  ).split(" "),
);

// Words ending in -s / -ies that are not plurals.
const NOT_PLURAL = new Set(
  "always bias diabetes ethics news physics series species statistics whereas".split(" "),
);

/** Crude plural fold: studies → study, adolescents → adolescent, analyses → analysis. */
function singular(word: string): string {
  if (NOT_PLURAL.has(word)) return word;
  if (word.endsWith("yses")) return `${word.slice(0, -2)}is`;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("s") && !/(ss|us|is|cs)$/.test(word)) return word.slice(0, -1);
  return word;
}

/** Study-design words: left to the `study` feature so one signal isn't learnt twice. */
const STUDY_WORD =
  /^(?:reviews?|systematic|scoping|umbrella|narrative|meta-?analys[ie]s|longitudinal|cohorts?|panels?|prospective|follow-up|cross-lagged|randomi[sz]ed|controlled|trials?|rcts?|interventions?|cross-sectional|surveys?|questionnaires?|qualitative|interviews?|focus|thematic)$/;

function keywordFeatures(title: string): PaperFeature[] {
  // NFC so "é" and "e + ◌́" match; hyphenated compounds stay whole (well-being).
  const words =
    title
      .normalize("NFC")
      .toLowerCase()
      .match(/[\p{L}\p{M}]+(?:-[\p{L}\p{M}]+)*/gu) ?? [];
  const seen = new Set<string>();
  const out: PaperFeature[] = [];
  for (const raw of words) {
    const word = singular(raw);
    if (word.length < MIN_KEYWORD_LENGTH || seen.has(word)) continue;
    if (STOPWORDS.has(raw) || STOPWORDS.has(word) || STUDY_WORD.test(raw)) continue;
    seen.add(word);
    out.push(feature("keyword", word, word));
    if (out.length === MAX_KEYWORDS) break;
  }
  return out;
}

const STUDY_TYPES: { slug: string; label: string; pattern: RegExp }[] = [
  {
    slug: "review",
    label: "Reviews",
    // "A survey of deep learning methods" is a literature review, not a questionnaire.
    pattern:
      /\breviews?\b|\bmeta[- ]?analy|\bsurvey (?:of|on) (?:the )?(?:[\p{L}-]+ ){0,3}(?:literature|methods|approaches|techniques|research|models)\b/iu,
  },
  {
    slug: "longitudinal",
    label: "Longitudinal studies",
    // Narrow "prospective"/"panel": "prospective teachers" and "expert panel" are common.
    pattern:
      /\blongitudinal\b|\bcohorts?\b|\bprospective (?:cohort|study|studies|design)\b|\bpanel (?:study|studies|data|survey|models?)\b|\bfollow(?:ed)?[- ]?up\b|\bcross-lagged\b/i,
  },
  {
    slug: "trial",
    label: "Trials and interventions",
    pattern: /\brandomi[sz]ed\b|\bcontrolled trials?\b|\bRCTs?\b|\binterventions?\b/i,
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
  const matched = STUDY_TYPES.filter((s) => s.pattern.test(title));
  // A literature "survey" is already a review; don't also call it a questionnaire study.
  const isReview = matched.some((s) => s.slug === "review");
  return matched
    .filter((s) => !(isReview && s.slug === "cross-sectional"))
    .map((s) => feature("study", s.slug, s.label));
}

function yearFeature(year: number | undefined, now: Date): PaperFeature[] {
  if (!year || !Number.isFinite(year)) return [];
  const age = now.getUTCFullYear() - year;
  // Online-first papers often carry next year's date: count them as recent.
  if (age < -1) return [];
  if (age <= 2) return [feature("year", "recent", "Last 3 years")];
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
    ...unique(topicFeatures(paper.topics)),
    ...unique(keywordFeatures(paper.title)),
    ...unique(studyFeatures(paper.title)),
    ...yearFeature(paper.year, now),
    ...venueFeature(paper, credibility),
    ...citedFeature(paper.citationCount),
  ];
}
