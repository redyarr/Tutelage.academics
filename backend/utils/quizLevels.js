// Per-level question split of a quiz section, e.g. { A1: 3, A2: 3, B1: 4 } for a 10-question section.

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/**
 * Cleans an incoming split: keeps known levels with whole numbers > 0. Returns null for
 * "no split" (empty / missing), so the section falls back to any-level questions.
 * Throws on bad values so the API can answer 400.
 */
function normalizeDistribution(input) {
  if (input === undefined || input === null || input === '') return null;
  const raw = typeof input === 'string' ? JSON.parse(input) : input;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('levelDistribution must be an object like { "A1": 3 }');
  const clean = {};
  for (const [level, value] of Object.entries(raw)) {
    if (!LEVELS.includes(level)) throw new Error(`Unknown level "${level}"`);
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) throw new Error(`${level} must be a whole number of 0 or more`);
    if (n > 0) clean[level] = n;
  }
  return Object.keys(clean).length ? clean : null;
}

/** Sum of a split (0 for none). */
const distributionTotal = (dist) => Object.values(dist || {}).reduce((sum, n) => sum + n, 0);

/** Error message when a split does not add up to the section's question count, else null. */
function distributionError(dist, questionCount) {
  if (!dist) return null;
  const total = distributionTotal(dist);
  return total === Number(questionCount)
    ? null
    : `The levels add up to ${total} questions, but the section has ${questionCount}. Make them match.`;
}

/** [[level, count], ...] in difficulty order (A1 first), skipping zeros — the order questions are served in. */
const levelPlan = (dist) => LEVELS.filter((l) => dist?.[l] > 0).map((l) => [l, dist[l]]);

module.exports = { LEVELS, normalizeDistribution, distributionTotal, distributionError, levelPlan };
