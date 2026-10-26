import { AppError } from '../utils/errors';
import { fromPaise, toPaise } from '../utils/money';

export interface LineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CalculatedLine {
  description: string;
  quantityHundredths: number;
  unitPricePaise: number;
  taxRateBp: number;
  lineTotalPaise: number;
  taxPaise: number;
}

/** All amounts in integer paise. */
export interface InvoiceCalculation {
  lines: CalculatedLine[];
  subtotal: number;
  tax: number;
  total: number;
}

export function calculateLine(line: LineInput): CalculatedLine {
  if (!line.description || !line.description.trim()) {
    throw new AppError(422, 'Line description is required');
  }
  const quantityHundredths = Math.round(line.quantity * 100);
  const unitPricePaise = toPaise(line.unitPrice);
  const taxRateBp = Math.round(line.taxRate * 100);

  if (!Number.isFinite(quantityHundredths) || quantityHundredths <= 0) {
    throw new AppError(422, 'Quantity must be greater than 0');
  }
  if (unitPricePaise <= 0) {
    throw new AppError(422, 'Unit price must be greater than 0');
  }
  if (!Number.isFinite(taxRateBp) || taxRateBp < 0 || taxRateBp > 10000) {
    throw new AppError(422, 'Tax rate must be between 0 and 100');
  }

  // line_total = qty x unit_price (excl. tax); tax is rounded half-up per line.
  const lineTotalPaise = Math.round((quantityHundredths * unitPricePaise) / 100);
  const taxPaise = Math.round((lineTotalPaise * taxRateBp) / 10000);

  return {
    description: line.description.trim(),
    quantityHundredths,
    unitPricePaise,
    taxRateBp,
    lineTotalPaise,
    taxPaise,
  };
}

export function calculateInvoice(lines: LineInput[]): InvoiceCalculation {
  if (!lines || lines.length === 0) {
    throw new AppError(422, 'An invoice needs at least one line item');
  }
  const calculated = lines.map(calculateLine);
  const subtotal = calculated.reduce((sum, l) => sum + l.lineTotalPaise, 0);
  const tax = calculated.reduce((sum, l) => sum + l.taxPaise, 0);
  return { lines: calculated, subtotal, tax, total: subtotal + tax };
}

/** Row shape for InvoiceItem.create / bulkCreate (minus invoiceId). */
export function toItemAttributes(line: CalculatedLine) {
  return {
    description: line.description,
    quantity: (line.quantityHundredths / 100).toFixed(2),
    unitPrice: fromPaise(line.unitPricePaise),
    taxRate: (line.taxRateBp / 100).toFixed(2),
    lineTotal: fromPaise(line.lineTotalPaise),
  };
}

/** Status of an issued invoice given how much has been paid (paise). */
export function deriveStatus(totalPaise: number, paidPaise: number): 'issued' | 'partly_paid' | 'paid' {
  if (paidPaise <= 0) return 'issued';
  if (paidPaise >= totalPaise) return 'paid';
  return 'partly_paid';
}