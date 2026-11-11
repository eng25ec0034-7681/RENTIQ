/**
 * RENTIT print pricing.
 *
 * Rates (rupees, whole numbers):
 *   Black & white, single side .......... ₹2 per side
 *   Black & white, front + back ......... ₹3 per sheet (two sides on one sheet)
 *   Colour, single side ................. ₹10 per side
 *   Colour, front + back ................ ₹18 per sheet
 *   A3 .................................. twice the A4 rate
 *   Stapling ............................ ₹2 per order
 *   Spiral binding ...................... ₹40 per order
 *   Soft binding ........................ ₹30 per order
 *
 * Stationery is priced from the catalogue in the database, never from the
 * client, so a tampered request cannot lower the bill.
 */

export type BindingType = "NONE" | "STAPLE" | "SPIRAL" | "SOFT";
export type PaperSize = "A4" | "A3";
export type Fulfillment = "PICKUP" | "DELIVERY";

export const PRINT_RATES = {
  bwSinglePerSide: 2,
  bwDoublePerSheet: 3,
  colourSinglePerSide: 10,
  colourDoublePerSheet: 18,
  a3Multiplier: 2,
  stapling: 2,
  spiralBinding: 40,
  softBinding: 30,
  delivery: 5,
  platformFee: 0,
} as const;

export const BINDING_OPTIONS: { value: BindingType; label: string; fee: number }[] = [
  { value: "NONE", label: "No binding", fee: 0 },
  { value: "STAPLE", label: "Stapled", fee: PRINT_RATES.stapling },
  { value: "SPIRAL", label: "Spiral binding", fee: PRINT_RATES.spiralBinding },
  { value: "SOFT", label: "Soft binding", fee: PRINT_RATES.softBinding },
];

export interface StationeryPick {
  code: string;
  qty: number;
}

export interface PrintOrderInput {
  pages: number;
  copies: number;
  colour?: boolean;
  doubleSided?: boolean;
  paperSize?: PaperSize;
  bindingType?: BindingType;
  fulfillment?: Fulfillment;
  stationery?: StationeryPick[];
}

export interface PrintTotalLine {
  label: string;
  detail?: string;
  amount: number;
}

export interface PrintTotals {
  sheets: number;
  ratePerUnit: number;
  printCost: number;
  bindingFee: number;
  stationeryTotal: number;
  deliveryFee: number;
  platformFee: number;
  total: number;
  lines: PrintTotalLine[];
}

export interface CatalogueEntry {
  name: string;
  price: number;
}

export function calculatePrintTotals(
  input: PrintOrderInput,
  catalogue: Record<string, CatalogueEntry> = {}
): PrintTotals {
  const pages = Math.max(1, Math.floor(input.pages || 1));
  const copies = Math.max(1, Math.floor(input.copies || 1));
  const colour = Boolean(input.colour);
  const doubleSided = Boolean(input.doubleSided);
  const paperSize: PaperSize = input.paperSize === "A3" ? "A3" : "A4";
  const bindingType: BindingType = input.bindingType ?? "NONE";

  const sheets = doubleSided ? Math.ceil(pages / 2) : pages;

  const ratePerUnit = colour
    ? doubleSided
      ? PRINT_RATES.colourDoublePerSheet
      : PRINT_RATES.colourSinglePerSide
    : doubleSided
    ? PRINT_RATES.bwDoublePerSheet
    : PRINT_RATES.bwSinglePerSide;

  const paperMultiplier = paperSize === "A3" ? PRINT_RATES.a3Multiplier : 1;
  const printCost = ratePerUnit * sheets * copies * paperMultiplier;

  const bindingFee =
    bindingType === "STAPLE"
      ? PRINT_RATES.stapling
      : bindingType === "SPIRAL"
      ? PRINT_RATES.spiralBinding
      : bindingType === "SOFT"
      ? PRINT_RATES.softBinding
      : 0;

  const stationeryLines: PrintTotalLine[] = [];
  let stationeryTotal = 0;

  for (const pick of input.stationery ?? []) {
    const entry = catalogue[pick.code];
    const qty = Math.max(0, Math.floor(pick.qty || 0));
    if (!entry || qty === 0) continue;
    const amount = entry.price * qty;
    stationeryTotal += amount;
    stationeryLines.push({
      label: entry.name,
      detail: `${qty} × ₹${entry.price}`,
      amount,
    });
  }

  const deliveryFee = input.fulfillment === "DELIVERY" ? PRINT_RATES.delivery : 0;
  const platformFee = PRINT_RATES.platformFee;

  const total = printCost + bindingFee + stationeryTotal + deliveryFee + platformFee;

  const modeLabel = colour ? "Colour" : "Black & white";
  const sidesLabel = doubleSided ? "front & back" : "single side";

  const lines: PrintTotalLine[] = [
    {
      label: "Printing",
      detail: `${pages} page${pages === 1 ? "" : "s"} × ${copies} cop${
        copies === 1 ? "y" : "ies"
      }  ${modeLabel}, ${sidesLabel}  ${paperSize}`,
      amount: printCost,
    },
  ];

  if (bindingFee > 0) {
    lines.push({
      label: BINDING_OPTIONS.find((b) => b.value === bindingType)?.label ?? "Binding",
      amount: bindingFee,
    });
  }

  lines.push(...stationeryLines);

  if (deliveryFee > 0) {
    lines.push({ label: "Delivery", amount: deliveryFee });
  }

  if (platformFee > 0) {
    lines.push({ label: "Platform fee", amount: platformFee });
  }

  return {
    sheets,
    ratePerUnit,
    printCost,
    bindingFee,
    stationeryTotal,
    deliveryFee,
    platformFee,
    total,
    lines,
  };
}

export function calculateStationeryTotal(
  picks: StationeryPick[],
  catalogue: Record<string, CatalogueEntry> = {}
): number {
  return picks.reduce((sum, pick) => {
    const entry = catalogue[pick.code];
    const qty = Math.max(0, Math.floor(pick.qty || 0));
    return sum + (entry ? entry.price * qty : 0);
  }, 0);
}

// Backward-compatible exports for existing test suites
export interface PrintPricingInput {
  pages: number;
  copies: number;
  colour?: boolean;
  doubleSided?: boolean;
  double_sided?: boolean;
  paperSize?: "A4" | "A3";
  paper_size?: "A4" | "A3";
  binding?: boolean;
  stapling?: boolean;
  fulfillment?: "PICKUP" | "DELIVERY";
  paymentMethod?: "CASH" | "UPI";
  payment_method?: "CASH" | "UPI";
  [key: string]: any;
}

export interface PrintSettings {
  bw_single_per_side?: number;
  bw_double_per_sheet?: number;
  colour_single_per_side?: number;
  colour_double_per_sheet?: number;
  binding_fee?: number;
  stapling_fee?: number;
  delivery_fee?: number;
  platform_fee?: number;
  security_deposit?: number;
}

export const DEFAULT_PRINT_SETTINGS: Required<PrintSettings> = {
  bw_single_per_side: 2,
  bw_double_per_sheet: 4,
  colour_single_per_side: 10,
  colour_double_per_sheet: 20,
  binding_fee: 20,
  stapling_fee: 2,
  delivery_fee: 5,
  platform_fee: 0,
  security_deposit: 0,
};

export function calculatePrintCost(
  input: PrintPricingInput,
  settings?: PrintSettings
): number {
  const bwSingle = settings?.bw_single_per_side ?? DEFAULT_PRINT_SETTINGS.bw_single_per_side;
  const bwDouble = settings?.bw_double_per_sheet ?? DEFAULT_PRINT_SETTINGS.bw_double_per_sheet;
  const colourSingle = settings?.colour_single_per_side ?? DEFAULT_PRINT_SETTINGS.colour_single_per_side;
  const colourDouble = settings?.colour_double_per_sheet ?? DEFAULT_PRINT_SETTINGS.colour_double_per_sheet;
  const bindingFee = settings?.binding_fee ?? DEFAULT_PRINT_SETTINGS.binding_fee;
  const staplingFee = settings?.stapling_fee ?? DEFAULT_PRINT_SETTINGS.stapling_fee;

  const pages = Math.max(0, input.pages || 0);
  const copies = Math.max(0, input.copies ?? 1);
  const isColour = Boolean(input.colour);
  const isDoubleSided = Boolean(input.doubleSided ?? input.double_sided);
  const isBinding = Boolean(input.binding);
  const isStapling = Boolean(input.stapling);

  let printingCost = 0;

  if (isDoubleSided) {
    const physicalSheets = Math.ceil(pages / 2);
    const perSheet = isColour ? colourDouble : bwDouble;
    printingCost = physicalSheets * perSheet * copies;
  } else {
    const perSide = isColour ? colourSingle : bwSingle;
    printingCost = pages * copies * perSide;
  }

  if (isBinding) {
    printingCost += bindingFee;
  }

  if (isStapling) {
    printingCost += staplingFee;
  }

  return Math.round(printingCost);
}

export function calculatePrintOrderTotal(
  input: PrintPricingInput,
  settings?: PrintSettings
): {
  printing_cost: number;
  delivery_fee: number;
  platform_fee: number;
  total_amount: number;
} {
  const printing_cost = calculatePrintCost(input, settings);
  const isDelivery = input.fulfillment === "DELIVERY";
  const delivery_fee = isDelivery
    ? (settings?.delivery_fee ?? DEFAULT_PRINT_SETTINGS.delivery_fee)
    : 0;
  const platform_fee = settings?.platform_fee ?? DEFAULT_PRINT_SETTINGS.platform_fee;
  const total_amount = printing_cost + delivery_fee + platform_fee;

  return {
    printing_cost,
    delivery_fee,
    platform_fee,
    total_amount,
  };
}
