import httpStatus from "http-status";
import config from "../../../config/index.js";
import ApiError from "../../../errors/ApiErrors.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import { IPaginationOptions } from "../../../interfaces/paginations.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { redisDel, redisGet, redisSet } from "../../lib/redis.js";
import {
  buildCategoryTree,
  CategoryTreeNode,
  dfsCollectSubtreeIds,
} from "./category.tree.js";

const categorySearchableFields = ["name", "slug"];
const CATEGORY_TREE_CACHE_KEY = "category:tree";

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

interface ICategoryFilters {
  searchTerm?: string;
  parentId?: string;
}

interface ICreateCategoryPayload {
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
}

type IUpdateCategoryPayload = Partial<ICreateCategoryPayload> & {
  description?: string | null;
};

class CategoryService {
  async createIntoDb(payload: ICreateCategoryPayload) {
    const parentId = payload.parentId ?? null;
    if (parentId) {
      await this.assertCategoryExists(parentId, "Parent category not found");
    }

    const result = await prisma.category.create({
      data: {
        name: payload.name,
        slug: payload.slug || slugify(payload.name),
        description: payload.description,
        parentId,
      },
    });

    await this.invalidateTreeCache();
    return result;
  }

  async getListFromDb(filters: ICategoryFilters, options: IPaginationOptions) {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(options);

    const where: Prisma.CategoryWhereInput = { isDeleted: false };
    if (filters.searchTerm) {
      where.OR = categorySearchableFields.map((field) => ({
        [field]: { contains: filters.searchTerm, mode: "insensitive" },
      }));
    }
    if (filters.parentId) {
      where.parentId = filters.parentId;
    }

    const [data, total] = await Promise.all([
      prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.category.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
  }

  async getTree(): Promise<CategoryTreeNode[]> {
    const cached = await redisGet(CATEGORY_TREE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as CategoryTreeNode[];
    }

    const rows = await prisma.category.findMany({
      where: { isDeleted: false },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        parentId: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const tree = buildCategoryTree(rows);

    const stored = await redisSet(
      CATEGORY_TREE_CACHE_KEY,
      JSON.stringify(tree),
      config.redis.category_tree_ttl,
    );
    console.log("Category tree built from DB", { cached: stored });

    return tree;
  }

  async getSubtreeIds(categoryId: string): Promise<string[]> {
    const tree = await this.getTree();
    return dfsCollectSubtreeIds(tree, categoryId);
  }

  async getByIdFromDb(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        children: { where: { isDeleted: false } },
        _count: {
          select: { products: { where: { isDeleted: false } } },
        },
      },
    });

    if (!category || category.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
    }

    return category;
  }

  async updateIntoDb(id: string, payload: IUpdateCategoryPayload) {
    await this.assertCategoryExists(id, "Category not found");

    if (payload.parentId !== undefined && payload.parentId !== null) {
      await this.assertCategoryExists(
        payload.parentId,
        "Parent category not found",
      );
      await this.assertNoCycle(id, payload.parentId);
    }

    const result = await prisma.category.update({
      where: { id },
      data: {
        name: payload.name,
        slug: payload.slug,
        description: payload.description,
        parentId: payload.parentId,
      },
    });

    await this.invalidateTreeCache();
    return result;
  }

  async deleteFromDb(id: string) {
    await this.assertCategoryExists(id, "Category not found");

    const [childCount, productCount] = await Promise.all([
      prisma.category.count({ where: { parentId: id, isDeleted: false } }),
      prisma.product.count({ where: { categoryId: id, isDeleted: false } }),
    ]);

    if (childCount > 0) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Cannot delete a category that has subcategories. Delete or move them first.",
      );
    }
    if (productCount > 0) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Cannot delete a category that has products. Delete or move them first.",
      );
    }

    const result = await prisma.category.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });

    await this.invalidateTreeCache();
    return result;
  }

  private async assertCategoryExists(id: string, message: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      select: { id: true, isDeleted: true },
    });
    if (!category || category.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, message);
    }
  }

  private async assertNoCycle(categoryId: string, newParentId: string) {
    let current: string | null = newParentId;
    while (current) {
      if (current === categoryId) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "Cannot set parent: this would create a cycle in the category tree",
        );
      }
      const parent: { parentId: string | null } | null =
        await prisma.category.findUnique({
          where: { id: current },
          select: { parentId: true },
        });
      current = parent?.parentId ?? null;
    }
  }

  private async invalidateTreeCache() {
    await redisDel(CATEGORY_TREE_CACHE_KEY);
  }
}

export const categoryService = new CategoryService();
