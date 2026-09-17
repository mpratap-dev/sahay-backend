import { placeNamesFromLocation } from './location-place-names';

describe('placeNamesFromLocation', () => {
  const emptyLocation = {
    neighborhood: null,
    sublocalityLevel3: null,
    sublocalityLevel2: null,
    sublocalityLevel1: null,
    locality: null,
    administrativeAreaLevel3: null,
    administrativeAreaLevel2: null,
    administrativeAreaLevel1: null,
  };

  it('returns all distinct place names from location fields', () => {
    expect(
      placeNamesFromLocation({
        ...emptyLocation,
        neighborhood: 'Bindapur',
        sublocalityLevel2: 'Uttam Nagar',
        sublocalityLevel1: 'Bindapur',
        locality: 'New Delhi',
        administrativeAreaLevel1: 'Delhi',
      }),
    ).toEqual(['Bindapur', 'Uttam Nagar', 'New Delhi', 'Delhi']);
  });

  it('skips names shorter than the minimum length', () => {
    expect(
      placeNamesFromLocation({
        ...emptyLocation,
        locality: 'New Delhi',
        administrativeAreaLevel1: 'DL',
      }),
    ).toEqual(['New Delhi']);
  });

  it('returns empty array when no usable place names exist', () => {
    expect(placeNamesFromLocation(emptyLocation)).toEqual([]);
  });
});
