import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private readonly prisma: PrismaService) {}

  findActiveSources() {
    return this.prisma.source.findMany({
      where: { isActive: true },
    });
  }

  findById(id: string) {
    return this.prisma.source.findUnique({
      where: { id },
    });
  }
}
