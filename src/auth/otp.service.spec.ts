import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpException } from '@nestjs/common';
import { OtpService } from './otp.service';
import { RedisService } from '../redis/redis.service';
import { EMAIL_SENDER } from './senders/email-sender';
import { SMS_SENDER } from './senders/sms-sender';

type Store = Map<string, { value: string; expiresAt: number }>;

function createFakeRedis() {
  const store: Store = new Map();
  const now = () => Date.now();

  const fake = {
    get(key: string) {
      const row = store.get(key);
      if (!row || row.expiresAt < now()) {
        store.delete(key);
        return Promise.resolve(null);
      }
      return Promise.resolve(row.value);
    },
    set(key: string, value: string, ...args: Array<string | number>) {
      let ttl: number | undefined;
      let nx = false;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === 'EX') {
          ttl = Number(args[i + 1]);
        }
        if (args[i] === 'NX') {
          nx = true;
        }
      }
      const existing = store.get(key);
      if (nx && existing && existing.expiresAt >= now()) {
        return Promise.resolve(null);
      }
      store.set(key, {
        value,
        expiresAt: ttl ? now() + ttl * 1000 : now() + 86_400_000,
      });
      return Promise.resolve('OK');
    },
    async incr(key: string) {
      const current = await fake.get(key);
      const next = String((current ? Number(current) : 0) + 1);
      const existing = store.get(key);
      store.set(key, {
        value: next,
        expiresAt: existing?.expiresAt ?? now() + 86_400_000,
      });
      return Number(next);
    },
    expire(key: string, seconds: number) {
      const row = store.get(key);
      if (!row) {
        return Promise.resolve(0);
      }
      row.expiresAt = now() + seconds * 1000;
      return Promise.resolve(1);
    },
    ttl(key: string) {
      const row = store.get(key);
      if (!row) {
        return Promise.resolve(-2);
      }
      return Promise.resolve(
        Math.max(0, Math.ceil((row.expiresAt - now()) / 1000)),
      );
    },
    del(key: string) {
      store.delete(key);
      return Promise.resolve(1);
    },
  };
  return fake;
}

describe('OtpService', () => {
  let service: OtpService;
  let sms: { sendOtp: jest.Mock };
  let email: { sendOtp: jest.Mock };

  beforeEach(async () => {
    sms = { sendOtp: jest.fn().mockResolvedValue(undefined) };
    email = { sendOtp: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OtpService,
        { provide: RedisService, useValue: createFakeRedis() },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'OTP_PEPPER') {
                return 'test-otp-pepper-16';
              }
              throw new Error(key);
            },
          },
        },
        { provide: SMS_SENDER, useValue: sms },
        { provide: EMAIL_SENDER, useValue: email },
      ],
    }).compile();

    service = module.get(OtpService);
  });

  it('sends SMS OTP and verifies it', async () => {
    await service.start('sms', '9876543210', '127.0.0.1');
    expect(sms.sendOtp).toHaveBeenCalledTimes(1);
    const [, code] = sms.sendOtp.mock.calls[0] as [string, string];
    expect(code).toMatch(/^\d{6}$/);
    const destination = await service.verify('sms', '9876543210', code);
    expect(destination).toBe('+919876543210');
  });

  it('sends email OTP via email sender', async () => {
    await service.start('email', 'mp1995singh@gmail.com', '127.0.0.1');
    expect(email.sendOtp).toHaveBeenCalledWith(
      'mp1995singh@gmail.com',
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('rejects a wrong code', async () => {
    await service.start('sms', '9876543210', '127.0.0.1');
    await expect(
      service.verify('sms', '9876543210', '000000'),
    ).rejects.toBeInstanceOf(HttpException);
  });

  it('rate-limits a second start within cooldown', async () => {
    await service.start('sms', '9876543210', '127.0.0.1');
    await expect(
      service.start('sms', '9876543210', '127.0.0.1'),
    ).rejects.toBeInstanceOf(HttpException);
  });
});
