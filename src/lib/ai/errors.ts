/** Typed failures from the AI layer. Callers branch on class, never on message text. */

/** The API key or model configuration is missing. Not retryable. */
export class AiConfigError extends Error {
  override name = "AiConfigError";
}

/** The model declined (stop_reason "refusal"), after any server-side fallback. */
export class AiRefusalError extends Error {
  override name = "AiRefusalError";
  constructor(
    readonly category: string | null,
    readonly explanation: string | null,
  ) {
    super(`The model declined this request${category ? ` (${category})` : ""}.`);
  }
}

/** The reply was cut off (`truncated`) or still failed the schema after one repair (`invalid`). */
export class AiOutputError extends Error {
  override name = "AiOutputError";
  constructor(
    readonly reason: "invalid" | "truncated",
    readonly issues: string[] = [],
  ) {
    super(
      reason === "truncated"
        ? "The model's reply was cut off before the JSON was complete."
        : `The model's reply did not match the schema: ${issues.join("; ")}`,
    );
  }
}
