export class PrismaClient {
  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}
}

export type Prisma = {
  InputJsonValue: string | number | boolean | null | object;
  ArticleWhereInput: Record<string, unknown>;
};
