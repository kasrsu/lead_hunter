/**
 * Shared display helpers. Kept tiny and pure so every screen formats the same
 * classification/scorecard labels the same way.
 */

/** "DIGITAL_WEAKNESS_OPPORTUNITY" → "Digital weakness opportunity" */
export function humanizeLabel(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}
