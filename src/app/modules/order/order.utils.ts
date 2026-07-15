export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface PricedLine {
  productId: string;
  quantity: number;
  price: number;
}

export interface CalculatedLine extends PricedLine {
  subtotal: number;
}

export const mergeOrderItems = (items: OrderItemInput[]): OrderItemInput[] => {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({
    productId,
    quantity,
  }));
};

export const calculateOrderTotals = (
  lines: PricedLine[],
): { items: CalculatedLine[]; totalAmount: number } => {
  const items = lines.map((line) => {
    if (!Number.isInteger(line.price) || !Number.isInteger(line.quantity)) {
      throw new Error(
        `Order arithmetic requires integers (product ${line.productId}: price=${line.price}, quantity=${line.quantity})`,
      );
    }
    return { ...line, subtotal: line.price * line.quantity };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return { items, totalAmount };
};
