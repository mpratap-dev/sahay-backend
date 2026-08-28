export class PrismaClient {
  $connect(): Promise<void> {
    return Promise.resolve();
  }

  $disconnect(): Promise<void> {
    return Promise.resolve();
  }
}

export type Prisma = {
  InputJsonValue: string | number | boolean | null | object;
  ArticleWhereInput: Record<string, unknown>;
  ContentItemWhereInput: Record<string, unknown>;
};
