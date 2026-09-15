import type { GeocodeAddressComponent } from './google-geocode.types';
import {
  mapAddressComponents,
  mapGeocodeResult,
} from './map-address-components';

const sampleComponents: GeocodeAddressComponent[] = [
  { long_name: '32/1', short_name: '32/1', types: ['premise'] },
  {
    long_name: 'Uttam Vihar',
    short_name: 'Uttam Vihar',
    types: ['neighborhood', 'political'],
  },
  {
    long_name: 'Block RZ',
    short_name: 'Block RZ',
    types: ['political', 'sublocality', 'sublocality_level_3'],
  },
  {
    long_name: 'Uttam Nagar',
    short_name: 'Uttam Nagar',
    types: ['political', 'sublocality', 'sublocality_level_2'],
  },
  {
    long_name: 'Bindapur',
    short_name: 'Bindapur',
    types: ['political', 'sublocality', 'sublocality_level_1'],
  },
  {
    long_name: 'Delhi',
    short_name: 'Delhi',
    types: ['locality', 'political'],
  },
  {
    long_name: 'South West Delhi',
    short_name: 'South West Delhi',
    types: ['administrative_area_level_3', 'political'],
  },
  {
    long_name: 'Delhi Division',
    short_name: 'Delhi Division',
    types: ['administrative_area_level_2', 'political'],
  },
  {
    long_name: 'Delhi',
    short_name: 'DL',
    types: ['administrative_area_level_1', 'political'],
  },
  {
    long_name: 'India',
    short_name: 'IN',
    types: ['country', 'political'],
  },
  {
    long_name: '110059',
    short_name: '110059',
    types: ['postal_code'],
  },
];

describe('mapAddressComponents', () => {
  it('maps sample Google components in API order using long_name', () => {
    expect(mapAddressComponents(sampleComponents)).toEqual({
      premise: '32/1',
      neighborhood: 'Uttam Vihar',
      sublocalityLevel3: 'Block RZ',
      sublocalityLevel2: 'Uttam Nagar',
      sublocalityLevel1: 'Bindapur',
      locality: 'Delhi',
      administrativeAreaLevel3: 'South West Delhi',
      administrativeAreaLevel2: 'Delhi Division',
      administrativeAreaLevel1: 'Delhi',
      country: 'India',
      countryCode: 'IN',
      postalCode: '110059',
    });
  });

  it('maps sublocality when political is listed first', () => {
    const fields = mapAddressComponents([
      {
        long_name: 'Block RZ',
        short_name: 'Block RZ',
        types: ['political', 'sublocality', 'sublocality_level_3'],
      },
    ]);
    expect(fields.sublocalityLevel3).toBe('Block RZ');
    expect(fields).not.toHaveProperty('political');
  });
});

describe('mapGeocodeResult', () => {
  it('includes placeId from the first result', () => {
    expect(
      mapGeocodeResult(
        {
          place_id: 'ChIJzdwVxSwbDTkRVk5014Y2Cxg',
          address_components: sampleComponents,
        },
        28.6078,
        77.0643,
      ),
    ).toMatchObject({
      latitude: 28.6078,
      longitude: 77.0643,
      placeId: 'ChIJzdwVxSwbDTkRVk5014Y2Cxg',
      locality: 'Delhi',
    });
  });

  it('returns null address fields when there is no result', () => {
    expect(mapGeocodeResult(null, 28, 77)).toEqual({
      latitude: 28,
      longitude: 77,
      premise: null,
      neighborhood: null,
      sublocalityLevel3: null,
      sublocalityLevel2: null,
      sublocalityLevel1: null,
      locality: null,
      administrativeAreaLevel3: null,
      administrativeAreaLevel2: null,
      administrativeAreaLevel1: null,
      country: null,
      countryCode: null,
      postalCode: null,
      placeId: null,
    });
  });
});
