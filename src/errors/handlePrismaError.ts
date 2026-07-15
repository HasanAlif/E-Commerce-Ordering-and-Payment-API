import { Prisma } from "../generated/prisma/client.js";

interface PrismaErrorSource {
  type: string;
  field?: string;
  message: string;
}

interface PrismaErrorResult {
  statusCode: number;
  message: string;
  errorSources: PrismaErrorSource[];
}

const handlePrismaError = (
  err: Prisma.PrismaClientKnownRequestError,
): PrismaErrorResult => {
  switch (err.code) {
    case "P2002": {
      const target = err.meta?.target;
      const field = Array.isArray(target)
        ? target.join(", ")
        : target || "field";
      return {
        statusCode: 409,
        message: `Duplicate value for ${field}`,
        errorSources: [
          {
            type: "UniqueConstraint",
            field: String(field),
            message: `${field} already exists`,
          },
        ],
      };
    }
    case "P2025":
      return {
        statusCode: 404,
        message: String(err.meta?.cause ?? "Record not found"),
        errorSources: [
          { type: "NotFound", message: "The requested record does not exist" },
        ],
      };
    case "P2003": {
      const fkField = String(err.meta?.field_name ?? "field");
      return {
        statusCode: 400,
        message: `Foreign key constraint failed on ${fkField}`,
        errorSources: [
          {
            type: "ForeignKey",
            field: fkField,
            message: "Related record not found",
          },
        ],
      };
    }
    case "P2014":
      return {
        statusCode: 400,
        message: "Required relation violation",
        errorSources: [{ type: "RelationViolation", message: err.message }],
      };
    default:
      return {
        statusCode: 500,
        message: "Database error",
        errorSources: [{ type: "PrismaError", message: err.message }],
      };
  }
};

export default handlePrismaError;
