import type { ProjectRelations } from "@/lib/ai/schemas";
import type { ProjectContext } from "@/types/domain";

/** A saved paper as the relations view shows it. All of it is code-made, never from the model. */
export interface RelationPaper {
  id: string;
  title: string;
  year?: number;
  citeKey: string;
}

type Claim = ProjectContext["claims"][number];

export interface ClaimSides {
  claim: Claim;
  supports: RelationPaper[];
  challenges: RelationPaper[];
}

export interface ResolvedRelations {
  /** Claims the saved set argues about: at least one paper on each side. */
  debated: ClaimSides[];
  /** Claims with papers on one side only. */
  oneSided: ClaimSides[];
  methods: { label: string; papers: RelationPaper[] }[];
  pairs: { a: RelationPaper; b: RelationPaper; kind: "complement" | "contrast"; note: string }[];
}

/**
 * Pure. Maps the AI-05 response's ids to the library's own papers. Unknown ids are dropped (a
 * paper removed since, or anything the server didn't vouch for), along with method groups left
 * with fewer than two papers, pairs missing a side, and claims that aren't in the brief.
 */
export function resolveRelations(
  relations: ProjectRelations,
  papers: readonly RelationPaper[],
  claims: readonly Claim[],
): ResolvedRelations {
  const byId = new Map(papers.map((p) => [p.id, p]));
  const known = (ids: readonly string[]) =>
    [...new Set(ids)].flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  const groups = new Map(relations.claims.map((c) => [c.claimId, c]));

  const sides = claims.flatMap((claim) => {
    const group = groups.get(claim.id);
    if (!group) return [];
    const entry = { claim, supports: known(group.supports), challenges: known(group.challenges) };
    return entry.supports.length || entry.challenges.length ? [entry] : [];
  });

  return {
    debated: sides.filter((s) => s.supports.length && s.challenges.length),
    oneSided: sides.filter((s) => !(s.supports.length && s.challenges.length)),
    methods: relations.methods.flatMap(({ label, paperIds }) => {
      const group = known(paperIds);
      return group.length >= 2 ? [{ label, papers: group }] : [];
    }),
    pairs: relations.pairs.flatMap(({ a, b, kind, note }) => {
      const [pa, pb] = [byId.get(a), byId.get(b)];
      return pa && pb && pa !== pb ? [{ a: pa, b: pb, kind, note }] : [];
    }),
  };
}
