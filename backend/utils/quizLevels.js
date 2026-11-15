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

const shuffled = (list, random) => {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

/**
 * Lays out one section of the quiz as `questionCount` numbered places.
 * Each passage ({ id, startPosition, endPosition }) puts its questions, by displayOrder, on its own
 * numbers; every other number gets a random standalone question (passageId null). With a level
 * split, passage questions count toward their own levels and the random ones make up the rest,
 * easy → hard. Pass active passages and questions only. Returns the questions in quiz order;
 * shorter than questionCount when the bank runs out (the caller warns).
 */
function arrangeSection({ questionCount, levelDistribution, passages = [], questions }, random = Math.random) {
  const places = Array(questionCount).fill(null);
  const byOrder = (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.id - b.id;
  for (const p of passages) {
    if (p.startPosition < 1 || p.endPosition > questionCount) continue; // the admin API prevents this
    questions
      .filter((q) => q.passageId === p.id)
      .sort(byOrder)
      .slice(0, p.endPosition - p.startPosition + 1)
      .forEach((q, i) => { places[p.startPosition - 1 + i] = q; });
  }

  const placed = places.filter(Boolean);
  const free = questionCount - placed.length;
  const pool = shuffled(questions.filter((q) => !q.passageId), random);
  const plan = levelPlan(levelDistribution);
  const randoms = (plan.length
    ? plan.flatMap(([level, n]) => {
        const need = n - placed.filter((q) => q.level === level).length;
        return need > 0 ? pool.filter((q) => q.level === level).slice(0, need) : [];
      })
    : pool
  ).slice(0, free);

  let next = 0;
  return places.map((q) => q ?? randoms[next++]).filter(Boolean);
}

/**
 * Error message for a passage covering questions start-end of a section with `questionCount`
 * questions, next to the section's `others` passages ({ title, startPosition, endPosition }); else null.
 */
function passageRangeError(start, end, questionCount, others = []) {
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
    return 'Choose a range like "from question 1 to 4".';
  }
  if (end > questionCount) return `This section has only ${questionCount} questions.`;
  const clash = others.find((o) => start <= o.endPosition && o.startPosition <= end);
  return clash ? `Questions ${clash.startPosition}-${clash.endPosition} already belong to "${clash.title}".` : null;
}

module.exports = { LEVELS, normalizeDistribution, distributionTotal, distributionError, levelPlan, arrangeSection, passageRangeError };
