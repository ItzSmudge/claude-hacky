/**
 * Sets KEY=value lines in dotenv text. Existing keys are replaced in place (dropping any inline
 * comment), missing keys are appended. Other lines are preserved byte-for-byte.
 * @param {string} text
 * @param {Record<string, string>} values
 */
export function upsertEnv(text, values) {
  const remaining = new Map(Object.entries(values));
  const lines = text.split("\n").map((line) => {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (m && remaining.has(m[1])) {
      const value = remaining.get(m[1]);
      remaining.delete(m[1]);
      return `${m[1]}=${value}`;
    }
    return line;
  });
  if (remaining.size) {
    if (lines.at(-1) === "") lines.pop();
    for (const [k, v] of remaining) lines.push(`${k}=${v}`);
    lines.push("");
  }
  return lines.join("\n");
}
