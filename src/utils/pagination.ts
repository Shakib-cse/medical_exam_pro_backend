// src/utils/pagination.ts
export interface PrismaModelDelegate<T> {
  findMany(args: Record<string, unknown>): Promise<T[]>;
  count(args: Record<string, unknown>): Promise<number>;
}

export async function paginate<T>(
  model: PrismaModelDelegate<T>,
  args: Record<string, unknown>,
  page: number = 1,
  limit: number = 10,
) {
  const safePage = Math.max(1, page);
  const skip = (safePage - 1) * limit;
  const [data, total] = await Promise.all([
    model.findMany({ ...args, skip, take: limit }),
    model.count({ where: args.where }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
