import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const sourceWithFeedsArgs = {
  include: { feeds: true },
} satisfies Prisma.SourceDefaultArgs;

export type SourceWithFeeds = Prisma.SourceGetPayload<
  typeof sourceWithFeedsArgs
>;

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  findActiveSources() {
    return this.prisma.source.findMany({
      where: { isActive: true },
    });
  }

  findById(id: string): Promise<SourceWithFeeds | null> {
    return this.prisma.source.findUnique({
      where: { id },
      ...sourceWithFeedsArgs,
    });
  }
}
