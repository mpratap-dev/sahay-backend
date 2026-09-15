import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGeocodeClient } from './google-geocode.client';

describe('GoogleGeocodeClient', () => {
  const fetchMock = jest.fn<Promise<Response>, [URL]>();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  it('throws when the Maps API key is missing', async () => {
    const client = new GoogleGeocodeClient({
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService);

    await expect(client.reverseGeocode(28.6, 77.2)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null for ZERO_RESULTS', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: 'ZERO_RESULTS', results: [] }),
    );
    const client = new GoogleGeocodeClient({
      get: jest.fn().mockReturnValue('maps-key'),
    } as unknown as ConfigService);

    await expect(client.reverseGeocode(28.6, 77.2)).resolves.toBeNull();
  });

  it('throws for a non-OK geocode status', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'REQUEST_DENIED',
        results: [],
        error_message: 'denied',
      }),
    );
    const client = new GoogleGeocodeClient({
      get: jest.fn().mockReturnValue('maps-key'),
    } as unknown as ConfigService);

    await expect(client.reverseGeocode(28.6, 77.2)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('returns the first result on OK', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        status: 'OK',
        results: [
          {
            place_id: 'place-1',
            address_components: [
              {
                long_name: 'Delhi',
                short_name: 'Delhi',
                types: ['locality', 'political'],
              },
            ],
          },
        ],
      }),
    );
    const client = new GoogleGeocodeClient({
      get: jest.fn().mockReturnValue('maps-key'),
    } as unknown as ConfigService);

    await expect(client.reverseGeocode(28.6, 77.2)).resolves.toEqual({
      place_id: 'place-1',
      address_components: [
        {
          long_name: 'Delhi',
          short_name: 'Delhi',
          types: ['locality', 'political'],
        },
      ],
    });
  });
});

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  } as Response;
}
