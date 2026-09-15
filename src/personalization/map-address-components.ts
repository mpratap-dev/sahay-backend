import {
  STORED_GOOGLE_TYPES,
  type CurrentLocationFields,
  type GeocodeAddressComponent,
  type GeocodeResult,
  type GeocodedAddressFields,
  type StoredGoogleType,
} from './google-geocode.types';

const FIELD_BY_GOOGLE_TYPE: Record<
  StoredGoogleType,
  keyof GeocodedAddressFields
> = {
  premise: 'premise',
  neighborhood: 'neighborhood',
  sublocality_level_3: 'sublocalityLevel3',
  sublocality_level_2: 'sublocalityLevel2',
  sublocality_level_1: 'sublocalityLevel1',
  locality: 'locality',
  administrative_area_level_3: 'administrativeAreaLevel3',
  administrative_area_level_2: 'administrativeAreaLevel2',
  administrative_area_level_1: 'administrativeAreaLevel1',
  country: 'country',
  postal_code: 'postalCode',
};

export function emptyGeocodedAddressFields(): GeocodedAddressFields {
  return {
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
  };
}

export function mapAddressComponents(
  components: readonly GeocodeAddressComponent[],
): GeocodedAddressFields {
  const fields = emptyGeocodedAddressFields();

  for (const component of components) {
    const storedType = firstStoredType(component.types);
    if (!storedType) {
      continue;
    }

    const field = FIELD_BY_GOOGLE_TYPE[storedType];
    if (fields[field] !== null) {
      continue;
    }

    const longName = emptyToNull(component.long_name);
    fields[field] = longName;

    if (storedType === 'country') {
      const code = emptyToNull(component.short_name);
      fields.countryCode = code ? code.toUpperCase() : null;
    }
  }

  return fields;
}

export function mapGeocodeResult(
  result: GeocodeResult | null,
  latitude: number,
  longitude: number,
): CurrentLocationFields {
  const address = result
    ? mapAddressComponents(result.address_components)
    : emptyGeocodedAddressFields();

  return {
    latitude,
    longitude,
    ...address,
    placeId: result ? emptyToNull(result.place_id) : null,
  };
}

function firstStoredType(types: readonly string[]): StoredGoogleType | null {
  for (const type of types) {
    for (const stored of STORED_GOOGLE_TYPES) {
      if (type === stored) {
        return stored;
      }
    }
  }
  return null;
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
