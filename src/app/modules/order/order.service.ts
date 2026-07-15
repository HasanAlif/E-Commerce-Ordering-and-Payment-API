import httpStatus from "http-status";
import config from "../../../config/index.js";
import ApiError from "../../../errors/ApiErrors.js";
import { paginationHelper } from "../../../helpers/paginationHelper.js";
import { IPaginationOptions } from "../../../interfaces/paginations.js";
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ProductStatus,
} from "../../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import {
  calculateOrderTotals,
  mergeOrderItems,
  OrderItemInput,
} from "./order.utils.js";

interface IRequester {
  id: string;
  role: string;
}

interface IOrderFilters {
  status?: string;
  userId?: string;
}

const ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
    },
  },
  payments: {
    select: {
      id: true,
      provider: true,
      transactionId: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.OrderInclude;

class OrderService {
  async createIntoDb(userId: string, payload: { items: OrderItemInput[] }) {
    const mergedItems = mergeOrderItems(payload.items);
    const productIds = mergedItems.map((item) => item.productId);

    return prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isDeleted: false },
        select: { id: true, name: true, price: true, stock: true, status: true },
      });
      const productsById = new Map(products.map((p) => [p.id, p]));

      for (const item of mergedItems) {
        const product = productsById.get(item.productId);
        if (!product) {
          throw new ApiError(
            httpStatus.NOT_FOUND,
            `Product not found: ${item.productId}`,
          );
        }
        if (product.status !== ProductStatus.active) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Product is not available for purchase: ${product.name}`,
          );
        }
        if (product.stock < item.quantity) {
          throw new ApiError(
            httpStatus.BAD_REQUEST,
            `Insufficient stock for ${product.name}: requested ${item.quantity}, available ${product.stock}`,
          );
        }
      }

      const { items, totalAmount } = calculateOrderTotals(
        mergedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: productsById.get(item.productId)!.price,
        })),
      );

      return tx.order.create({
        data: {
          userId,
          totalAmount,
          currency: config.default_currency,
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.price,
              subtotal: item.subtotal,
            })),
          },
        },
        include: ORDER_INCLUDE,
      });
    });
  }

  async getMyOrders(userId: string, options: IPaginationOptions) {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(options);

    const where: Prisma.OrderWhereInput = { userId };

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: ORDER_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
  }

  async getByIdFromDb(id: string, requester: IRequester) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: ORDER_INCLUDE,
    });

    if (!order || (requester.role !== "ADMIN" && order.userId !== requester.id)) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    return order;
  }

  async getListFromDb(filters: IOrderFilters, options: IPaginationOptions) {
    const { page, limit, skip, sortBy, sortOrder } =
      paginationHelper.calculatePagination(options);

    const where: Prisma.OrderWhereInput = {};
    if (filters.status) {
      where.status = filters.status as OrderStatus;
    }
    if (filters.userId) {
      where.userId = filters.userId;
    }

    const [data, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: ORDER_INCLUDE,
      }),
      prisma.order.count({ where }),
    ]);

    return { meta: { page, limit, total }, data };
  }

  async cancelOrder(id: string, requester: IRequester) {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        payments: { where: { status: PaymentStatus.pending }, select: { id: true } },
      },
    });

    if (!order || (requester.role !== "ADMIN" && order.userId !== requester.id)) {
      throw new ApiError(httpStatus.NOT_FOUND, "Order not found");
    }

    if (order.status !== OrderStatus.pending) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        `Only pending orders can be canceled (current status: ${order.status})`,
      );
    }

    if (order.payments.length > 0) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "A payment for this order is still pending. Sync its status first via POST /api/payments/stripe/verify or POST /api/payments/bkash/query/:transactionId, then retry.",
      );
    }

    return prisma.order.update({
      where: { id },
      data: { status: OrderStatus.canceled },
      include: ORDER_INCLUDE,
    });
  }
}

export const orderService = new OrderService();
