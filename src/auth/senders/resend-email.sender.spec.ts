import { ConfigService } from '@nestjs/config';
import { ResendEmailSender } from './resend-email.sender';

describe('ResendEmailSender', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });

  it('posts the OTP email to Resend', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(''),
    });
    const sender = new ResendEmailSender({
      getOrThrow: (key: string) => {
        if (key === 'RESEND_API_KEY') return 're_test';
        if (key === 'OTP_EMAIL_FROM') return 'SAHAY <noreply@example.com>';
        throw new Error(key);
      },
    } as unknown as ConfigService);

    await sender.sendOtp('mp1995singh@gmail.com', '424242');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const payload = requestBody(fetchMock);
    expect(payload).toContain('mp1995singh@gmail.com');
    expect(payload).toContain('424242');
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
