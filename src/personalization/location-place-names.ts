import type { LocationViewDto } from './dto/personalization.dto';

const MIN_PLACE_NAME_LENGTH = 3;

type LocationFields = Pick<
  LocationViewDto,
  | 'neighborhood'
  | 'sublocalityLevel3'
  | 'sublocalityLevel2'
  | 'sublocalityLevel1'
  | 'locality'
  | 'administrativeAreaLevel3'
  | 'administrativeAreaLevel2'
  | 'administrativeAreaLevel1'
>;

/**
 * Collects searchable place names from stored geocode fields for nearby feed
 * candidate matching. Matches articles whose title or summary mentions any name.
 *
 * This is a V1 text-match bridge until ContentItem carries structured geo
 * metadata (see docs/roadmap.md R1).
 */
export function placeNamesFromLocation(location: LocationFields): string[] {
  const fields = [
    location.neighborhood,
    location.sublocalityLevel3,
    location.sublocalityLevel2,
    location.sublocalityLevel1,
    location.locality,
    location.administrativeAreaLevel3,
    location.administrativeAreaLevel2,
    location.administrativeAreaLevel1,
  ];

  const seen = new Set<string>();
  const names: string[] = [];

  for (const field of fields) {
    const trimmed = field?.trim();
    if (!trimmed || trimmed.length < MIN_PLACE_NAME_LENGTH) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    names.push(trimmed);
  }

  return names;
}
