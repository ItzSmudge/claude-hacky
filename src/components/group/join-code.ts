// GR-01: join codes as typed, pasted or taken from a link. Generated codes are 6 characters from
// an unambiguous alphabet (supabase/migrations: generate_join_code); the demo's is DEMO42.
const VALID = /^[A-Z0-9]{4,12}$/;

/** The code in canonical form ("ABC234"), or null if it can't be one. */
export function normaliseJoinCode(input: string): string | null {
  let raw = input;
  try {
    raw = decodeURIComponent(input);
  } catch {
    return null;
  }
  const code = raw.replace(/[\s-]/g, "").toUpperCase();
  return VALID.test(code) ? code : null;
}

/** The link that joins `code`, e.g. https://…/app/join/ABC234. */
export function inviteUrl(origin: string, code: string): string {
  return `${origin.replace(/\/+$/, "")}/app/join/${code}`;
}
