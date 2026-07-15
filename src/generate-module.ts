import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODULES_DIR = path.join(__dirname, "app", "modules");

const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

const generateModule = (moduleName: string) => {
  if (!moduleName) {
    console.error("Please provide a module name!");
    console.error("Usage: npm run generate <module-name>");
    process.exit(1);
  }

  const modulePath = path.join(MODULES_DIR, moduleName);

  if (fs.existsSync(modulePath)) {
    console.error(`Module '${moduleName}' already exists!`);
    process.exit(1);
  }

  fs.mkdirSync(modulePath, { recursive: true });

  const cap = capitalize(moduleName);

  const files: Record<string, string> = {
    controller: `import { Request, Response } from "express";
import httpStatus from "http-status";
import catchAsync from "../../../shared/catchAsync.js";
import sendResponse from "../../../shared/sendResponse.js";
import { ${moduleName}Service } from "./${moduleName}.service.js";

const create${cap} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.createIntoDb(req.body);
  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "${cap} created successfully",
    data: result,
  });
});

const get${cap}List = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.getListFromDb();
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "${cap} list retrieved successfully",
    data: result,
  });
});

const get${cap}ById = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.getByIdFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "${cap} details retrieved successfully",
    data: result,
  });
});

const update${cap} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.updateIntoDb(req.params.id, req.body);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "${cap} updated successfully",
    data: result,
  });
});

const delete${cap} = catchAsync(async (req: Request, res: Response) => {
  const result = await ${moduleName}Service.deleteFromDb(req.params.id);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "${cap} deleted successfully",
    data: result,
  });
});

export const ${moduleName}Controller = {
  create${cap},
  get${cap}List,
  get${cap}ById,
  update${cap},
  delete${cap},
};`,

    service: `import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors.js";
import { prisma } from "../../lib/prisma.js";

const createIntoDb = async (data: { name: string; description?: string }) => {
  const result = await prisma.${moduleName}.create({ data });
  return result;
};

const getListFromDb = async () => {
  const result = await prisma.${moduleName}.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: "desc" },
  });
  return result;
};

const getByIdFromDb = async (id: string) => {
  const result = await prisma.${moduleName}.findUnique({ where: { id } });
  if (!result || result.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "${cap} not found");
  }
  return result;
};

const updateIntoDb = async (id: string, data: { name?: string; description?: string }) => {
  const existing = await prisma.${moduleName}.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "${cap} not found");
  }

  const result = await prisma.${moduleName}.update({
    where: { id },
    data,
  });
  return result;
};

const deleteFromDb = async (id: string) => {
  const existing = await prisma.${moduleName}.findUnique({ where: { id } });
  if (!existing || existing.isDeleted) {
    throw new ApiError(httpStatus.NOT_FOUND, "${cap} not found");
  }

  const result = await prisma.${moduleName}.update({
    where: { id },
    data: { isDeleted: true, deletedAt: new Date() },
  });
  return result;
};

export const ${moduleName}Service = {
  createIntoDb,
  getListFromDb,
  getByIdFromDb,
  updateIntoDb,
  deleteFromDb,
};`,

    route: `import express from "express";
import auth from "../../middlewares/auth.js";
import validateRequest from "../../middlewares/validateRequest.js";
import { ${moduleName}Controller } from "./${moduleName}.controller.js";
import { ${moduleName}Validation } from "./${moduleName}.validation.js";

const router = express.Router();

router.post(
  "/",
  auth("ADMIN"),
  validateRequest(${moduleName}Validation.createSchema),
  ${moduleName}Controller.create${cap},
);

router.get("/", auth(), ${moduleName}Controller.get${cap}List);

router.get("/:id", auth(), ${moduleName}Controller.get${cap}ById);

router.put(
  "/:id",
  auth("ADMIN"),
  validateRequest(${moduleName}Validation.updateSchema),
  ${moduleName}Controller.update${cap},
);

router.delete("/:id", auth("ADMIN"), ${moduleName}Controller.delete${cap});

export const ${moduleName}Routes = router;`,

    validation: `import { z } from "zod";

const createSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .min(1, "Name cannot be empty"),
  description: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1, "Name cannot be empty").optional(),
  description: z.string().optional(),
});

export const ${moduleName}Validation = {
  createSchema,
  updateSchema,
};`,
  };

  for (const [key, content] of Object.entries(files)) {
    const filePath = path.join(modulePath, `${moduleName}.${key}.ts`);
    fs.writeFileSync(filePath, content.trim());
    console.log(`  Created: ${moduleName}/${moduleName}.${key}.ts`);
  }

  console.log(`\nModule '${moduleName}' created successfully!`);
  console.log(`\nNext steps:`);
  console.log(`  1. Add a corresponding model to prisma/schema.prisma:`);
  console.log(`     model ${cap} {`);
  console.log(`       id          String    @id @default(uuid())`);
  console.log(`       name        String    @db.VarChar(255)`);
  console.log(`       description String?   @db.Text`);
  console.log(`       isDeleted   Boolean   @default(false)`);
  console.log(`       deletedAt   DateTime?`);
  console.log(`       createdAt   DateTime  @default(now())`);
  console.log(`       updatedAt   DateTime  @updatedAt`);
  console.log(`       @@index([isDeleted])`);
  console.log(`       @@map("${moduleName}s")`);
  console.log(`     }`);
  console.log(`  2. Run: npx prisma generate`);
  console.log(`  3. Run: npx prisma migrate dev --name add-${moduleName}`);
  console.log(`  4. Register the route in src/app/routes/index.ts:`);
  console.log(
    `     import { ${moduleName}Routes } from "../modules/${moduleName}/${moduleName}.route.js";`,
  );
  console.log(`     { path: "/${moduleName}s", route: ${moduleName}Routes }`);
};

const [, , moduleName] = process.argv;
generateModule(moduleName);
