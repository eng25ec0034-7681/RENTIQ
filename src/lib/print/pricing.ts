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

/**
 * Pure function to calculate print cost in integer rupees.
 * Any client-sent cost parameters are ignored.
 */
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
