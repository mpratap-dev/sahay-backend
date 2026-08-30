import { ConfigService } from '@nestjs/config';
import { Msg91SmsSender } from './msg91-sms.sender';

describe('Msg91SmsSender', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('posts the OTP to the MSG91 flow API', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
    const sender = new Msg91SmsSender({
      getOrThrow: (key: string) => {
        if (key === 'MSG91_AUTH_KEY') return 'auth-key';
        if (key === 'MSG91_OTP_TEMPLATE_ID') return 'template-1';
        throw new Error(key);
      },
      get: (key: string) => (key === 'MSG91_OTP_VAR' ? 'otp' : undefined),
    } as unknown as ConfigService);

    await sender.sendOtp('+919876543210', '654321');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = requestBody(fetchMock);
    expect(payload).toContain('919876543210');
    expect(payload).toContain('654321');
  });

  it('throws when MSG91 returns an error', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('nope'),
    });
    const sender = new Msg91SmsSender({
      getOrThrow: () => 'x',
      get: () => 'otp',
    } as unknown as ConfigService);
    await expect(sender.sendOtp('+919876543210', '111111')).rejects.toThrow(
      'Failed to send SMS OTP',
    );
  });
});

function requestBody(mock: jest.Mock): string {
  const call: unknown = mock.mock.calls[0];
  if (!Array.isArray(call) || call.length < 2) {
    return '';
  }
  const init: unknown = call[1];
  if (typeof init !== 'object' || init === null || !('body' in init)) {
    return '';
  }
  return String(init.body);
}
