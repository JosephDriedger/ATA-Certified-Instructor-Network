
/**
 * RecommendationService — orchestrates the recommendation pipeline.
 *
 * Flow:
 *   1. Load event + school from DB
 *   2. Fetch candidates via RecommendationQuery (single SQL query)
 *   3. Score each candidate with Scorer (pure JS, no DB)
 *   4. Sort by total score DESC, break ties by rank index
 *   5. Slice to requested limit
 *   6. Return enriched result object ready for the view
 */

const Event               = require('../models/Event');
const School              = require('../models/School');
const RecommendationQuery = require('./RecommendationQuery');
const Scorer              = require('./Scorer');

// Fetch generously so the ranking is representative even after hard filters.
// We score all candidates and slice at the end.
const CANDIDATE_MULTIPLIER = 5;
const MAX_CANDIDATES       = 200;

class RecommendationService {

    /**
     * @param {number} eventId
     * @param {object} options
     * @param {number} [options.limit=20]   Max recommendations to return
     * @returns {Promise<RecommendationResult>}
     */
    static async recommend(eventId, { limit = 20 } = {}) {
        // ── 1. Load entities ──────────────────────────────────────────────────
        const event = await Event.findById(eventId);
        if (!event) throw new Error(`Event ${eventId} not found.`);

        const school = event.school_id
            ? await School.findById(event.school_id)
            : null;

        // ── 2. Fetch candidates ───────────────────────────────────────────────
        const maxCandidates = Math.min(limit * CANDIDATE_MULTIPLIER, MAX_CANDIDATES);
        const candidates    = await RecommendationQuery.getCandidates(event, { maxCandidates });

        // ── 3. Score ──────────────────────────────────────────────────────────
        const ranked = candidates.map(c => {
            const score = Scorer.compute(c, event);
            const tier  = Scorer.tier(score.total);
            return { ...c, score, tier };
        });

        // ── 4. Sort (score DESC → rank index DESC for ties) ───────────────────
        ranked.sort((a, b) => {
            const scoreDiff = b.score.total - a.score.total;
            if (scoreDiff !== 0) return scoreDiff;
            // Tie-break: higher rank wins
            const aRankIdx = Scorer.RANKS.indexOf(a.rank);
            const bRankIdx = Scorer.RANKS.indexOf(b.rank);
            return bRankIdx - aRankIdx;
        });

        // ── 5. Trim + annotate position ───────────────────────────────────────
        const recommendations = ranked.slice(0, limit).map((r, i) => ({
            ...r,
            position: i + 1
        }));

        // ── 6. Return ─────────────────────────────────────────────────────────
        return {
            event,
            school,
            recommendations,
            totalCandidates: candidates.length,
            meta: {
                weights:     Scorer.WEIGHTS,
                eventType:   event.event_type,
                eventDate:   event.start_datetime,
                minRankIdx:  Scorer.MIN_RANK_IDX[event.event_type] ?? 0,
                minRankLabel: Scorer.RANKS[Scorer.MIN_RANK_IDX[event.event_type] ?? 0] ?? null
            }
        };
    }
}

module.exports = RecommendationService;
