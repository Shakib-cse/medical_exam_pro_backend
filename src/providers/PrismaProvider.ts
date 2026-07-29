import { InfrastructureProvider } from "@/core/InfrastructureProvider";
import { PrismaClient } from "@/generated/prisma/client";
import { errorMapperRegistry } from "@/core/errors/ErrorMapperRegistry";
import { AppError, ConflictError, NotFoundError } from "@/core/errors/AppError";
import { HTTPStatusCode } from "@/types/HTTPStatusCode";

export class PrismaProvider implements InfrastructureProvider<PrismaClient> {
  public name = "Prisma Database";

  constructor(private readonly prismaClient: PrismaClient) {
    errorMapperRegistry.register(this.mapPrismaError.bind(this));
  }

  public getClient(): PrismaClient {
    return this.prismaClient;
  }

  public async connect(): Promise<void> {
    await this.prismaClient.$connect();
  }

  public async disconnect(): Promise<void> {
    await this.prismaClient.$disconnect();
  }

  private mapPrismaError(err: any): AppError | null {
    if (err.code && typeof err.code === "string" && err.code.startsWith("P")) {
      switch (err.code) {
        case "P2002":
          return new ConflictError("A record with this data already exists", {
            fields: (err.meta as any)?.target,
            constraint: "unique_constraint",
          });
        case "P2025":
          return new NotFoundError("Record to update not found", {
            operation: err.meta,
          });
        case "P2003":
          return new AppError({
            statusCode: HTTPStatusCode.BAD_REQUEST,
            message: "Foreign key constraint failed",
            code: "FOREIGN_KEY_ERROR",
            details: { constraint: err.meta },
          });
        case "P2014":
          return new AppError({
            statusCode: HTTPStatusCode.BAD_REQUEST,
            message: "Invalid data provided",
            code: "INVALID_DATA",
            details: { relation: err.meta },
          });
        default:
          return new AppError({
            statusCode: HTTPStatusCode.INTERNAL_SERVER_ERROR,
            message: "Database operation failed",
            code: "DATABASE_ERROR",
            details: { prismaCode: err.code, meta: err.meta },
          });
      }
    }

    const errorMessage = err.message || "";
    if (
      errorMessage.includes("PrismaClient") ||
      errorMessage.includes("database connection")
    ) {
      return new AppError({
        statusCode: HTTPStatusCode.INTERNAL_SERVER_ERROR,
        message: "Database connection or execution failed",
        code: "DATABASE_RUNTIME_ERROR",
        details: { originalError: errorMessage },
      });
    }

    return null;
  }
}