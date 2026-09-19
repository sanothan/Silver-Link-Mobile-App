import { isVolunteerRatingScore } from './volunteerRatingValidation';
import { VOLUNTEER_RATING_SCALE } from '../types/volunteerRating';
import type { VolunteerRatingRecord, VolunteerRatingSummary } from '../types/volunteerRating';

/** Every step of the scale starts at zero, so a summary always has the full shape. */
function emptyDistribution(): Record<number, number> {
  const distribution: Record<number, number> = {};
  for (const option of VOLUNTEER_RATING_SCALE) distribution[option.value] = 0;
  return distribution;
}

export function emptyVolunteerRatingSummary(volunteerId: string): VolunteerRatingSummary {
  return { volunteerId, count: 0, average: null, distribution: emptyDistribution() };
}

/** One decimal place, so 4.25 reads as 4.3 rather than 4.25 or a rounded-away 4. */
function roundToOneDecimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * A volunteer's rating summary, calculated from their stored ratings.
 *
 * Ratings belonging to another volunteer, and any score that is not on the agreed scale,
 * are ignored rather than averaged in - a single bad document should not be able to skew
 * a volunteer's reputation. An unrated volunteer gets `average: null`, never 0, so the UI
 * can say "not yet rated" instead of showing them as the worst possible score.
 */
export function summariseVolunteerRatings(
  volunteerId: string,
  ratings: VolunteerRatingRecord[],
): VolunteerRatingSummary {
  const summary = emptyVolunteerRatingSummary(volunteerId);
  let total = 0;

  for (const rating of ratings) {
    if (rating.volunteerId !== volunteerId) continue;
    if (!isVolunteerRatingScore(rating.score)) continue;
    summary.distribution[rating.score] += 1;
    summary.count += 1;
    total += rating.score;
  }

  if (summary.count > 0) summary.average = roundToOneDecimal(total / summary.count);
  return summary;
}

/** The average as the screen shows it, including the wording for an unrated volunteer. */
export function formatRatingSummary(summary: VolunteerRatingSummary): string {
  if (summary.count === 0 || summary.average === null) return 'Not yet rated';
  return `${summary.average.toFixed(1)} out of 5 (${summary.count} rating${summary.count === 1 ? '' : 's'})`;
}
