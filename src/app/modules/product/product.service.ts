import httpStatus from "http-status";
import ApiError from "../../../errors/ApiErrors.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import { IPaginationOptions } from "../../../interfaces/paginations.js";
import { Prisma, ProductStatus } from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { categoryService } from "../category/category.service.js";
import {
  dfsCollectSubtreeIds,
  dfsFindNode,
} from "../category/category.tree.js";


const productSearchableFields = ["name", "sku", "description"];

interface IProductFilters {
  searchTerm?: string;
  categoryId?: string;
  status?: string;
  minPrice?: string | number;
  maxPrice?: string | number;
}

interface ICreateProductPayload {
  name: string;
  sku: string;
  description?: string;
  price: number;
  stock?: number;
  status?: ProductStatus;
  categoryId: string;
}

type IUpdateProductPayload = Partial<ICreateProductPayload> & {
  description?: string | null;
};

const DEFAULT_RECOMMENDATION_LIMIT = 10;
const MAX_RECOMMENDATION_LIMIT = 50;

class ProductService {
  async createIntoDb(payload: ICreateProductPayload) {
    await this.assertCategoryExists(payload.categoryId);

    return prisma.product.create({
      data: {
        name: payload.name,
        sku: payload.sku,
        description: payload.description,
        price: payload.price,
        stock: payload.stock ?? 0,
        status: payload.status ?? ProductStatus.active,
        categoryId: payload.categoryId,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async getListFromDb(
    filters: IProductFilters,
    options: IPaginationOptions,
    isAdmin: boolean,
  ) {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(options);

    const where: Prisma.ProductWhereInput = { isDeleted: false };

    if (isAdmin) {
      if (filters.status) {
        where.status = filters.status as ProductStatus;
      }
    } else {
      where.status = ProductStatus.active;
    }

    if (filters.searchTerm) {
      where.OR = productSearchableFields.map((field) => ({
        [field]: { contains: filters.searchTerm, mode: "insensitive" },
      }));
    }

    if (filters.categoryId) {
      const subtreeIds = await categoryService.getSubtreeIds(
        filters.categoryId,
      );
      if (subtreeIds.length === 0) {
        return { meta: { page, limit, total: 0 }, data: [] };
      }
      where.categoryId = { in: subtreeIds };
    }

    const minPrice =
      filters.minPrice !== undefined ? Number(filters.minPrice) : undefined;
    const maxPrice =
      filters.maxPrice !== undefined ? Number(filters.maxPrice) : undefined;
    if (minPrice !== undefined && !Number.isNaN(minPrice)) {
      where.price = { ...(where.price as object), gte: Math.trunc(minPrice) };
    }
    if (maxPrice !== undefined && !Number.isNaN(maxPrice)) {
      where.price = { ...(where.price as object), lte: Math.trunc(maxPrice) };
    }

    const [data, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: { category: { select: { id: true, name: true, slug: true } } },
      }),
      prisma.product.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
  }

  async getByIdFromDb(id: string, isAdmin: boolean) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    const hiddenFromPublic =
      !product ||
      product.isDeleted ||
      (!isAdmin && product.status !== ProductStatus.active);

    if (hiddenFromPublic) {
      throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
    }

    return product;
  }

  async updateIntoDb(id: string, payload: IUpdateProductPayload) {
    await this.assertProductExists(id);
    if (payload.categoryId) {
      await this.assertCategoryExists(payload.categoryId);
    }

    return prisma.product.update({
      where: { id },
      data: {
        name: payload.name,
        sku: payload.sku,
        description: payload.description,
        price: payload.price,
        stock: payload.stock,
        status: payload.status,
        categoryId: payload.categoryId,
      },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async deleteFromDb(id: string) {
    await this.assertProductExists(id);

    return prisma.product.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    });
  }

  async getRecommendations(productId: string, rawLimit?: string | number) {
    const parsed = Number(rawLimit);
    const limit =
      Number.isFinite(parsed) && parsed > 0
        ? Math.min(Math.trunc(parsed), MAX_RECOMMENDATION_LIMIT)
        : DEFAULT_RECOMMENDATION_LIMIT;

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, categoryId: true, isDeleted: true, status: true },
    });
    if (
      !product ||
      product.isDeleted ||
      product.status !== ProductStatus.active
    ) {
      throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
    }

    const tree = await categoryService.getTree();

    const subtreeIds = dfsCollectSubtreeIds(tree, product.categoryId);
    const candidateCategoryIds =
      subtreeIds.length > 0 ? subtreeIds : [product.categoryId];

    const recommendations = await prisma.product.findMany({
      where: {
        id: { not: productId },
        categoryId: { in: candidateCategoryIds },
        status: ProductStatus.active,
        isDeleted: false,
      },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });

    if (recommendations.length < limit) {
      const categoryNode = dfsFindNode(tree, product.categoryId);
      const parentId = categoryNode?.parentId;
      if (parentId) {
        const widenedIds = dfsCollectSubtreeIds(tree, parentId).filter(
          (id) => !candidateCategoryIds.includes(id),
        );
        if (widenedIds.length > 0) {
          const extra = await prisma.product.findMany({
            where: {
              id: {
                not: productId,
                notIn: recommendations.map(
                  (r: (typeof recommendations)[number]) => r.id,
                ),
              },
              categoryId: { in: widenedIds },
              status: ProductStatus.active,
              isDeleted: false,
            },
            take: limit - recommendations.length,
            orderBy: { createdAt: "desc" },
            include: {
              category: { select: { id: true, name: true, slug: true } },
            },
          });
          recommendations.push(...extra);
        }
      }
    }

    return recommendations;
  }

  private async assertProductExists(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: { id: true, isDeleted: true },
    });
    if (!product || product.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "Product not found");
    }
  }

  private async assertCategoryExists(categoryId: string) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true, isDeleted: true },
    });
    if (!category || category.isDeleted) {
      throw new ApiError(httpStatus.NOT_FOUND, "Category not found");
    }
  }
}

export const productService = new ProductService();
