import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import {
  IdentifierError,
  type OtpChannel,
  normalizeDestination,
} from './identifiers';
import { EMAIL_SENDER, type EmailSender } from './senders/email-sender';
import { SMS_SENDER, type SmsSender } from './senders/sms-sender';

const OTP_TTL_SECONDS = 300;
const COOLDOWN_SECONDS = 30;
const HOUR_LIMIT = 5;
const HOUR_WINDOW_SECONDS = 3600;
const MAX_ATTEMPTS = 5;
const IP_HOUR_LIMIT = 20;

export type StartOtpResult = {
  ok: true;
  expiresInSeconds: number;
  retryAfterSeconds: number;
};

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    @Inject(SMS_SENDER) private readonly smsSender: SmsSender,
    @Inject(EMAIL_SENDER) private readonly emailSender: EmailSender,
  ) {}

  async start(
    channel: OtpChannel,
    destinationRaw: string,
    ip: string,
  ): Promise<StartOtpResult> {
    let destination: string;
    try {
      destination = normalizeDestination(channel, destinationRaw);
    } catch (error) {
      if (error instanceof IdentifierError) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }

    await this.assertRateLimits(channel, destination, ip);

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const hash = this.hashOtp(code);
    const key = this.otpKey(channel, destination);
    await this.redis.set(
      key,
      JSON.stringify({ hash, attempts: 0 }),
      'EX',
      OTP_TTL_SECONDS,
    );

    try {
      if (channel === 'sms') {
        await this.smsSender.sendOtp(destination, code);
      } else {
        await this.emailSender.sendOtp(destination, code);
      }
    } catch (error) {
      await this.redis.del(key);
      this.logger.error(error);
      throw new HttpException(
        'Unable to send verification code',
        HttpStatus.BAD_GATEWAY,
      );
    }

    return {
      ok: true,
      expiresInSeconds: OTP_TTL_SECONDS,
      retryAfterSeconds: COOLDOWN_SECONDS,
    };
  }

  async verify(
    channel: OtpChannel,
    destinationRaw: string,
    code: string,
  ): Promise<string> {
    let destination: string;
    try {
      destination = normalizeDestination(channel, destinationRaw);
    } catch (error) {
      if (error instanceof IdentifierError) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
      }
      throw error;
    }

    const key = this.otpKey(channel, destination);
    const raw = await this.redis.get(key);
    if (!raw) {
      throw new HttpException(
        'Invalid or expired code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const parsed = JSON.parse(raw) as { hash: string; attempts: number };
    if (parsed.attempts >= MAX_ATTEMPTS) {
      await this.redis.del(key);
      throw new HttpException(
        'Too many attempts. Request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const incoming = this.hashOtp(code.trim());
    if (!this.hashesMatch(parsed.hash, incoming)) {
      parsed.attempts += 1;
      const ttl = await this.redis.ttl(key);
      if (ttl > 0) {
        await this.redis.set(key, JSON.stringify(parsed), 'EX', ttl);
      }
      if (parsed.attempts >= MAX_ATTEMPTS) {
        await this.redis.del(key);
      }
      throw new HttpException(
        'Invalid or expired code',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.redis.del(key);
    return destination;
  }

  private async assertRateLimits(
    channel: OtpChannel,
    destination: string,
    ip: string,
  ): Promise<void> {
    const destHourKey = `otp:hr:${channel}:${destination}`;
    const destCount = await this.incrWithWindow(
      destHourKey,
      HOUR_WINDOW_SECONDS,
    );
    if (destCount > HOUR_LIMIT) {
      throw new HttpException(
        'Too many codes requested. Try later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const ipHourKey = `otp:hr:ip:${ip}`;
    const ipCount = await this.incrWithWindow(ipHourKey, HOUR_WINDOW_SECONDS);
    if (ipCount > IP_HOUR_LIMIT) {
      throw new HttpException(
        'Too many codes requested. Try later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const cooldownKey = `otp:cd:${channel}:${destination}`;
    const set = await this.redis.set(
      cooldownKey,
      '1',
      'EX',
      COOLDOWN_SECONDS,
      'NX',
    );
    if (set !== 'OK') {
      const retryAfterSeconds = Math.max(await this.redis.ttl(cooldownKey), 1);
      throw new HttpException(
        {
          message: 'Wait before requesting another code',
          retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private async incrWithWindow(key: string, windowSeconds: number) {
    const count = await this.redis.incr(key);
    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    return count;
  }

  private otpKey(channel: OtpChannel, destination: string) {
    return `otp:${channel}:${destination}`;
  }

  private hashOtp(code: string): string {
    const pepper = this.configService.getOrThrow<string>('OTP_PEPPER');
    return createHash('sha256').update(`${pepper}:${code}`).digest('hex');
  }

  private hashesMatch(stored: string, incoming: string): boolean {
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(incoming, 'hex');
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  }
}
