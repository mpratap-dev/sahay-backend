import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GeocodeAddressComponent,
  GeocodeResponse,
  GeocodeResult,
} from './google-geocode.types';

@Injectable()
export class GoogleGeocodeClient {
  private readonly logger = new Logger(GoogleGeocodeClient.name);

  constructor(private readonly configService: ConfigService) {}

  async reverseGeocode(
    latitude: number,
    longitude: number,
  ): Promise<GeocodeResult | null> {
    const apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Google Maps geocoding is not configured',
      );
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('latlng', `${latitude},${longitude}`);
    url.searchParams.set('key', apiKey);

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(
        `Google Geocoding request failed to send: ${String(error)}`,
      );
      throw new ServiceUnavailableException(
        'Google Maps geocoding is unavailable',
      );
    }

    if (!response.ok) {
      this.logger.error(
        `Google Geocoding HTTP error: ${String(response.status)}`,
      );
      throw new ServiceUnavailableException(
        'Google Maps geocoding is unavailable',
      );
    }

    const payload: unknown = await response.json();
    const parsed = parseGeocodeResponse(payload);
    if (!parsed) {
      this.logger.error('Google Geocoding returned an unexpected payload');
      throw new ServiceUnavailableException(
        'Google Maps geocoding is unavailable',
      );
    }

    if (parsed.status === 'ZERO_RESULTS') {
      return null;
    }

    if (parsed.status !== 'OK' || parsed.results.length === 0) {
      this.logger.error(
        `Google Geocoding returned a non-OK status: ${parsed.status}${
          parsed.error_message ? ` (${parsed.error_message})` : ''
        }`,
      );
      throw new ServiceUnavailableException(
        'Google Maps geocoding is unavailable',
      );
    }

    return parsed.results[0] ?? null;
  }
}

function parseGeocodeResponse(payload: unknown): GeocodeResponse | null {
  if (!isRecord(payload) || typeof payload.status !== 'string') {
    return null;
  }

  const errorMessage = payload.error_message;
  if (errorMessage !== undefined && typeof errorMessage !== 'string') {
    return null;
  }

  if (!Array.isArray(payload.results)) {
    return null;
  }

  const results: GeocodeResult[] = [];
  for (const item of payload.results) {
    const result = parseGeocodeResult(item);
    if (!result) {
      return null;
    }
    results.push(result);
  }

  return {
    status: payload.status,
    results,
    ...(typeof errorMessage === 'string'
      ? { error_message: errorMessage }
      : {}),
  };
}

function parseGeocodeResult(value: unknown): GeocodeResult | null {
  if (!isRecord(value) || typeof value.place_id !== 'string') {
    return null;
  }
  if (!Array.isArray(value.address_components)) {
    return null;
  }

  const addressComponents: GeocodeAddressComponent[] = [];
  for (const item of value.address_components) {
    const component = parseAddressComponent(item);
    if (!component) {
      return null;
    }
    addressComponents.push(component);
  }

  return {
    place_id: value.place_id,
    address_components: addressComponents,
  };
}

function parseAddressComponent(value: unknown): GeocodeAddressComponent | null {
  if (
    !isRecord(value) ||
    typeof value.long_name !== 'string' ||
    typeof value.short_name !== 'string' ||
    !Array.isArray(value.types)
  ) {
    return null;
  }

  const types: string[] = [];
  for (const type of value.types) {
    if (typeof type !== 'string') {
      return null;
    }
    types.push(type);
  }

  return {
    long_name: value.long_name,
    short_name: value.short_name,
    types,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
