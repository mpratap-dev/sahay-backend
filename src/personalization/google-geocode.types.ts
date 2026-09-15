export type GeocodeAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

export type GeocodeResult = {
  address_components: GeocodeAddressComponent[];
  place_id: string;
};

export type GeocodeResponse = {
  status: string;
  results: GeocodeResult[];
  error_message?: string;
};

export type GeocodedAddressFields = {
  premise: string | null;
  neighborhood: string | null;
  sublocalityLevel3: string | null;
  sublocalityLevel2: string | null;
  sublocalityLevel1: string | null;
  locality: string | null;
  administrativeAreaLevel3: string | null;
  administrativeAreaLevel2: string | null;
  administrativeAreaLevel1: string | null;
  country: string | null;
  countryCode: string | null;
  postalCode: string | null;
};

export type CurrentLocationFields = GeocodedAddressFields & {
  latitude: number;
  longitude: number;
  placeId: string | null;
};

export const STORED_GOOGLE_TYPES = [
  'premise',
  'neighborhood',
  'sublocality_level_3',
  'sublocality_level_2',
  'sublocality_level_1',
  'locality',
  'administrative_area_level_3',
  'administrative_area_level_2',
  'administrative_area_level_1',
  'country',
  'postal_code',
] as const;

export type StoredGoogleType = (typeof STORED_GOOGLE_TYPES)[number];
