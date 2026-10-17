import { describe, expect, it } from "vitest";
import { calculatePrintCost, calculatePrintOrderTotal } from "@/lib/print/pricing";
import { printSchema } from "@/lib/validation/printSchema";

describe("Print Pricing Engine & Validation", () => {
  it("calculates 5 pages, B&W, single, 1 copy = 10", () => {
    const cost = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
    });
    expect(cost).toBe(10);
  });

  it("calculates 5 pages, B&W, double, 1 copy = 12", () => {
    const cost = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: true,
      copies: 1,
    });
    expect(cost).toBe(12);
  });

  it("calculates 5 pages, colour, single, 1 copy = 50", () => {
    const cost = calculatePrintCost({
      pages: 5,
      colour: true,
      doubleSided: false,
      copies: 1,
    });
    expect(cost).toBe(50);
  });

  it("calculates 5 pages, colour, double, 1 copy = 60", () => {
    const cost = calculatePrintCost({
      pages: 5,
      colour: true,
      doubleSided: true,
      copies: 1,
    });
    expect(cost).toBe(60);
  });

  it("calculates 5 pages, B&W, single, 3 copies = 30", () => {
    const cost = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 3,
    });
    expect(cost).toBe(30);
  });

  it("calculates 10 pages, colour, double, 2 copies = 200", () => {
    const cost = calculatePrintCost({
      pages: 10,
      colour: true,
      doubleSided: true,
      copies: 2,
    });
    expect(cost).toBe(200);
  });

  it("rejects pages 0 and negative copies via Zod schema", () => {
    const zeroPages = printSchema.safeParse({
      pages: 0,
      copies: 1,
      colour: false,
      doubleSided: false,
      paperSize: "A4",
      binding: false,
      stapling: false,
      fulfillment: "PICKUP",
      paymentMethod: "CASH",
    });
    expect(zeroPages.success).toBe(false);
    if (!zeroPages.success) {
      expect(zeroPages.error.flatten().fieldErrors).toHaveProperty("pages");
    }

    const negativeCopies = printSchema.safeParse({
      pages: 5,
      copies: -1,
      colour: false,
      doubleSided: false,
      paperSize: "A4",
      binding: false,
      stapling: false,
      fulfillment: "PICKUP",
      paymentMethod: "CASH",
    });
    expect(negativeCopies.success).toBe(false);
    if (!negativeCopies.success) {
      expect(negativeCopies.error.flatten().fieldErrors).toHaveProperty("copies");
    }
  });

  it("ignores a client-sent printing cost (calculatePrintCost takes no cost input)", () => {
    const cost = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
      printing_cost: 9999,
      printingCost: 9999,
      total_amount: 99999,
      totalAmount: 99999,
    } as any);
    expect(cost).toBe(10);
  });

  it("adds binding fee and stapling fee per order", () => {
    const costWithBinding = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
      binding: true,
      stapling: false,
    });
    expect(costWithBinding).toBe(30);

    const costWithStapling = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
      binding: false,
      stapling: true,
    });
    expect(costWithStapling).toBe(12);

    const costWithBoth = calculatePrintCost({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
      binding: true,
      stapling: true,
    });
    expect(costWithBoth).toBe(32);
  });

  it("calculates order total with delivery fee and platform fee", () => {
    const pickupOrder = calculatePrintOrderTotal({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
      fulfillment: "PICKUP",
    });
    expect(pickupOrder.printing_cost).toBe(10);
    expect(pickupOrder.delivery_fee).toBe(0);
    expect(pickupOrder.platform_fee).toBe(0);
    expect(pickupOrder.total_amount).toBe(10);

    const deliveryOrder = calculatePrintOrderTotal({
      pages: 5,
      colour: false,
      doubleSided: false,
      copies: 1,
      fulfillment: "DELIVERY",
    });
    expect(deliveryOrder.printing_cost).toBe(10);
    expect(deliveryOrder.delivery_fee).toBe(5);
    expect(deliveryOrder.platform_fee).toBe(0);
    expect(deliveryOrder.total_amount).toBe(15);
  });
});
