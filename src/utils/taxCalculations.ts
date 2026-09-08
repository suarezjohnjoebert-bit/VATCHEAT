import {
  Data1701Q,
  Data1702Q,
  Data2550Q,
  Data2551Q,
  Data1601C,
  Data1601EQ,
  PenaltiesData,
} from '../types/tax';

/**
 * Computes Individual Graduated Income Tax under Tax Code as amended by EOPT Law (RA 11976)
 */
export function computeGraduatedTax(taxableIncome: number): number {
  if (taxableIncome <= 250000) {
    return 0;
  }
  if (taxableIncome <= 400000) {
    return (taxableIncome - 250000) * 0.15;
  }
  if (taxableIncome <= 800000) {
    return 22500 + (taxableIncome - 400000) * 0.2;
  }
  if (taxableIncome <= 2000000) {
    return 102500 + (taxableIncome - 800000) * 0.25;
  }
  if (taxableIncome <= 8000000) {
    return 402500 + (taxableIncome - 2000000) * 0.3;
  }
  return 2202500 + (taxableIncome - 8000000) * 0.35;
}

/**
 * Approximate monthly withholding tax on compensation (Revised Withholding Tax Table)
 */
export function computeCompensationWithholding(taxableCompensation: number): number {
  if (taxableCompensation <= 20833) {
    return 0;
  }
  if (taxableCompensation <= 33333) {
    return (taxableCompensation - 20833) * 0.15;
  }
  if (taxableCompensation <= 66667) {
    return 1875 + (taxableCompensation - 33333) * 0.2;
  }
  if (taxableCompensation <= 166667) {
    return 8541.8 + (taxableCompensation - 66667) * 0.25;
  }
  if (taxableCompensation <= 666667) {
    return 33541.8 + (taxableCompensation - 166667) * 0.3;
  }
  return 183541.8 + (taxableCompensation - 666667) * 0.35;
}

export interface Result1701Q {
  totalGrossRevenues: number;
  allowableDeductions: number;
  deductionType: 'OSD (40%)' | 'Itemized' | '8% Fixed Reduction (₱250k)' | 'None (Mixed Income)';
  netTaxableIncome: number;
  taxDue: number;
  totalTaxCredits: number;
  netTaxPayable: number;
  isOverpayment: boolean;
  boxBreakdown: {
    lineGrossSales: number;
    lineNonOperating: number;
    lineTotalGross: number;
    lineDeductions: number;
    lineTaxableIncome: number;
    lineTaxDue: number;
    lineTotalCredits: number;
    lineNetTaxPayable: number;
  };
}

export function calculate1701Q(data: Data1701Q): Result1701Q {
  const lineGrossSales = data.grossSalesCurrentQuarter + data.grossSalesPriorQuarters;
  const lineNonOperating = data.nonOperatingIncome;
  const lineTotalGross = lineGrossSales + lineNonOperating;

  let allowableDeductions = 0;
  let deductionType: Result1701Q['deductionType'] = 'None (Mixed Income)';
  let netTaxableIncome = 0;
  let taxDue = 0;

  if (data.taxRegime === '8_percent') {
    if (data.taxpayerType === 'pure_business') {
      allowableDeductions = 250000; // P250,000 threshold
      deductionType = '8% Fixed Reduction (₱250k)';
      netTaxableIncome = Math.max(0, lineTotalGross - allowableDeductions);
    } else {
      allowableDeductions = 0;
      deductionType = 'None (Mixed Income)';
      netTaxableIncome = lineTotalGross;
    }
    taxDue = netTaxableIncome * 0.08;
  } else {
    // Graduated Rates
    if (data.deductionMethod === 'osd') {
      allowableDeductions = lineGrossSales * 0.4; // 40% of Gross Sales
      deductionType = 'OSD (40%)';
      netTaxableIncome = Math.max(0, lineTotalGross - allowableDeductions);
    } else {
      allowableDeductions = data.costOfSales + data.operatingExpenses;
      deductionType = 'Itemized';
      netTaxableIncome = Math.max(0, lineTotalGross - allowableDeductions);
    }
    taxDue = computeGraduatedTax(netTaxableIncome);
  }

  const totalTaxCredits =
    data.priorYearExcessCredits +
    data.quarterlyTaxPaidPriorQuarters +
    data.cwt2307Credits +
    data.otherTaxCredits;

  const netTaxPayable = taxDue - totalTaxCredits;
  const isOverpayment = netTaxPayable < 0;

  return {
    totalGrossRevenues: lineTotalGross,
    allowableDeductions,
    deductionType,
    netTaxableIncome,
    taxDue,
    totalTaxCredits,
    netTaxPayable,
    isOverpayment,
    boxBreakdown: {
      lineGrossSales,
      lineNonOperating,
      lineTotalGross,
      lineDeductions: allowableDeductions,
      lineTaxableIncome: netTaxableIncome,
      lineTaxDue: taxDue,
      lineTotalCredits: totalTaxCredits,
      lineNetTaxPayable: netTaxPayable,
    },
  };
}

export interface Result1702Q {
  grossSales: number;
  costOfSales: number;
  grossIncomeFromOperations: number;
  totalGrossIncome: number;
  operatingExpenses: number;
  netTaxableIncome: number;
  ncitTaxDue: number;
  mcitTaxDue: number;
  appliedTaxType: 'Regular (25%)' | 'MSME (20%)' | 'MCIT (2%)';
  taxDue: number;
  totalTaxCredits: number;
  netTaxPayable: number;
  isOverpayment: boolean;
}

export function calculate1702Q(data: Data1702Q): Result1702Q {
  const grossSales = data.grossSales;
  const costOfSales = data.costOfSales;
  const grossIncomeFromOperations = Math.max(0, grossSales - costOfSales);
  const totalGrossIncome = grossIncomeFromOperations + data.nonOperatingIncome;
  const operatingExpenses = data.operatingExpenses;
  const netTaxableIncome = Math.max(0, totalGrossIncome - operatingExpenses);

  const ratePercent = data.rateOption === 'msme_20' ? 0.2 : 0.25;
  const ncitTaxDue = netTaxableIncome * ratePercent;
  const mcitTaxDue = data.isMCOptional ? grossIncomeFromOperations * 0.02 : 0;

  let taxDue = ncitTaxDue;
  let appliedTaxType: Result1702Q['appliedTaxType'] =
    data.rateOption === 'msme_20' ? 'MSME (20%)' : 'Regular (25%)';

  if (data.isMCOptional && mcitTaxDue > ncitTaxDue) {
    taxDue = mcitTaxDue;
    appliedTaxType = 'MCIT (2%)';
  }

  const totalTaxCredits =
    data.priorYearExcessCredits +
    data.priorQuarterTaxPaid +
    data.cwt2307Credits +
    data.otherTaxCredits;

  const netTaxPayable = taxDue - totalTaxCredits;

  return {
    grossSales,
    costOfSales,
    grossIncomeFromOperations,
    totalGrossIncome,
    operatingExpenses,
    netTaxableIncome,
    ncitTaxDue,
    mcitTaxDue,
    appliedTaxType,
    taxDue,
    totalTaxCredits,
    netTaxPayable,
    isOverpayment: netTaxPayable < 0,
  };
}

export interface Result2550Q {
  vatableSales: number;
  outputTax: number;
  totalSales: number;
  inputTaxPurchases: number;
  totalAvailableInputTax: number;
  netVatBeforeCredits: number;
  excessInputTax: number;
  totalTaxCredits: number;
  netVatPayable: number;
  isExcessInputVat: boolean;
}

export function calculate2550Q(data: Data2550Q): Result2550Q {
  const totalSales =
    data.vatableSales + data.salesToGovernment + data.zeroRatedSales + data.vatExemptSales;
  const outputTax = (data.vatableSales + data.salesToGovernment) * 0.12;

  const inputTaxPurchases =
    (data.inputPurchasesGoods +
      data.inputPurchasesServices +
      data.inputCapitalGoods +
      data.inputImportations) *
    0.12;

  const totalAvailableInputTax = inputTaxPurchases + data.priorQuarterExcessInputVat;

  const netVatBeforeCredits = Math.max(0, outputTax - totalAvailableInputTax);
  const excessInputTax = Math.max(0, totalAvailableInputTax - outputTax);

  const totalTaxCredits =
    data.withheldVat2307Govt + data.withheldVat2307Private + data.priorPaymentsThisQuarter;

  const netVatPayable = netVatBeforeCredits - totalTaxCredits;

  return {
    vatableSales: data.vatableSales,
    outputTax,
    totalSales,
    inputTaxPurchases,
    totalAvailableInputTax,
    netVatBeforeCredits,
    excessInputTax,
    totalTaxCredits,
    netVatPayable,
    isExcessInputVat: excessInputTax > 0 || netVatPayable < 0,
  };
}

export interface Result2551Q {
  grossSales: number;
  exemptSales: number;
  taxableSales: number;
  taxRatePercent: number;
  taxDue: number;
  totalTaxCredits: number;
  netPercentageTaxPayable: number;
  isOverpayment: boolean;
}

export function calculate2551Q(data: Data2551Q): Result2551Q {
  const taxableSales = Math.max(0, data.grossSalesCurrentQuarter - data.exemptSales);
  const taxRate = data.taxRatePercent / 100;
  const taxDue = taxableSales * taxRate;
  const totalTaxCredits = data.cwt2307Credits + data.priorQuarterTaxPaid;
  const netPercentageTaxPayable = taxDue - totalTaxCredits;

  return {
    grossSales: data.grossSalesCurrentQuarter,
    exemptSales: data.exemptSales,
    taxableSales,
    taxRatePercent: data.taxRatePercent,
    taxDue,
    totalTaxCredits,
    netPercentageTaxPayable,
    isOverpayment: netPercentageTaxPayable < 0,
  };
}

export interface Result1601C {
  totalGrossCompensation: number;
  totalNonTaxableCompensation: number;
  taxableCompensation: number;
  taxRequiredWithheld: number;
  adjustments: number;
  priorRemittance: number;
  netTaxRemitted: number;
}

export function calculate1601C(data: Data1601C): Result1601C {
  const totalNonTaxableCompensation =
    data.minimumWageEarners +
    data.statutoryContributions +
    data.thirteenthMonthAndDeMinimis +
    data.otherNonTaxableCompensation;

  const taxableCompensation = Math.max(0, data.totalGrossCompensation - totalNonTaxableCompensation);
  const taxRequiredWithheld = computeCompensationWithholding(taxableCompensation);
  const netTaxRemitted =
    taxRequiredWithheld + data.taxWithheldAdjustments - data.taxRemittedPreviously;

  return {
    totalGrossCompensation: data.totalGrossCompensation,
    totalNonTaxableCompensation,
    taxableCompensation,
    taxRequiredWithheld,
    adjustments: data.taxWithheldAdjustments,
    priorRemittance: data.taxRemittedPreviously,
    netTaxRemitted,
  };
}

export interface Result1601EQ {
  totalTaxBase: number;
  totalTaxWithheld: number;
  priorMonthTaxRemitted: number;
  overpaymentPreviousPeriod: number;
  netAmountPayable: number;
  lineBreakdowns: {
    id: string;
    atc: string;
    description: string;
    ratePercent: number;
    taxBase: number;
    taxWithheld: number;
  }[];
}

export function calculate1601EQ(data: Data1601EQ): Result1601EQ {
  let totalTaxBase = 0;
  let totalTaxWithheld = 0;

  const lineBreakdowns = data.lineItems.map((item) => {
    const itemWithheld = item.taxBase * (item.ratePercent / 100);
    totalTaxBase += item.taxBase;
    totalTaxWithheld += itemWithheld;
    return {
      ...item,
      taxWithheld: itemWithheld,
    };
  });

  const netAmountPayable =
    totalTaxWithheld - (data.priorMonthTaxRemitted + data.overpaymentPreviousPeriod);

  return {
    totalTaxBase,
    totalTaxWithheld,
    priorMonthTaxRemitted: data.priorMonthTaxRemitted,
    overpaymentPreviousPeriod: data.overpaymentPreviousPeriod,
    netAmountPayable,
    lineBreakdowns,
  };
}

/**
 * BIR Surcharge, Interest (12% per annum under NIRC as amended by EOPT Act), Compromise Penalty table
 */
export function calculatePenalties(basicTaxDue: number, penalties: PenaltiesData): {
  basicTaxDue: number;
  surcharge: number;
  interest: number;
  compromise: number;
  totalPenalties: number;
  totalAmountPayable: number;
} {
  if (basicTaxDue <= 0) {
    return {
      basicTaxDue: 0,
      surcharge: 0,
      interest: 0,
      compromise: 0,
      totalPenalties: 0,
      totalAmountPayable: 0,
    };
  }

  // Surcharge: 25% for simple late filing (Note: EOPT Act removes wrong venue surcharge)
  const surcharge = penalties.includeSurcharge ? basicTaxDue * 0.25 : 0;

  // Interest: 12% per annum under NIRC Sec 249 as amended by EOPT Act (RA 11976)
  const days = Math.max(0, penalties.daysLate);
  const interest = penalties.includeInterest ? basicTaxDue * 0.12 * (days / 365) : 0;

  // BIR Compromise Penalty schedule (RMO 7-2015)
  let compromise = 0;
  if (penalties.includeCompromise) {
    if (basicTaxDue <= 5000) compromise = 1000;
    else if (basicTaxDue <= 10000) compromise = 2000;
    else if (basicTaxDue <= 20000) compromise = 3000;
    else if (basicTaxDue <= 50000) compromise = 5000;
    else if (basicTaxDue <= 100000) compromise = 10000;
    else if (basicTaxDue <= 500000) compromise = 15000;
    else if (basicTaxDue <= 1000000) compromise = 20000;
    else if (basicTaxDue <= 5000000) compromise = 30000;
    else if (basicTaxDue <= 10000000) compromise = 40000;
    else compromise = 50000;
  }

  const totalPenalties = surcharge + interest + compromise;
  const totalAmountPayable = basicTaxDue + totalPenalties;

  return {
    basicTaxDue,
    surcharge,
    interest,
    compromise,
    totalPenalties,
    totalAmountPayable,
  };
}
