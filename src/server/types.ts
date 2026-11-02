export type Role = "owner" | "barber";

export type ShopContext = {
  userId: string;
  shopId: string;
  memberId: string;
  role: Role;
  displayName: string;
  commissionPercent: number;
  shopName: string;
  currency: string;
  timezone: string;
};

export type PaymentMethod = "cash" | "transfer" | "card";

export type CheckoutReceipt = {
  id: string;
  serviceName: string;
  charged: number;
  tip: number;
  commissionAmount: number;
  paymentMethod: PaymentMethod;
};
