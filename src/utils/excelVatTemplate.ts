import * as XLSX from 'xlsx';
import { Data2550Q } from '../types/tax';

export interface BranchVatRecord {
  branchOrLineOfBusiness: string;
  monthOfQuarter: 1 | 2 | 3;
  vatableSales: number;
  salesToGovernment: number;
  zeroRatedSales: number;
  vatExemptSales: number;
  inputPurchasesGoods: number;
  inputPurchasesServices: number;
  inputCapitalGoods: number;
  inputImportations: number;
  withheldVat2307Govt: number;
  withheldVat2307Private: number;
}

export interface BranchVatSummary {
  branch: string;
  month1Sales: number;
  month2Sales: number;
  month3Sales: number;
  totalSales: number;
  outputTax: number;
  totalInputPurchases: number;
  totalInputTax: number;
  netVatEstimated: number;
}

export interface MonthlyVatSummary {
  month: 1 | 2 | 3;
  monthLabel: string;
  sales: number;
  outputTax: number;
  inputPurchases: number;
  estimatedInputTax: number;
}

export interface ParsedVatExcelResult {
  records: BranchVatRecord[];
  totals: {
    vatableSales: number;
    salesToGovernment: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    inputPurchasesServices: number;
    inputCapitalGoods: number;
    inputImportations: number;
    withheldVat2307Govt: number;
    withheldVat2307Private: number;
  };
  branches: string[];
  summaryByBranch: BranchVatSummary[];
  summaryByMonth: MonthlyVatSummary[];
  rowCount: number;
  fileName: string;
}

/**
 * Downloads pre-formatted Excel template (.xlsx) for branch/line of business monthly VAT data.
 */
export function downloadVatExcelTemplate(clientTradeName: string, quarter: string, year: number) {
  const header = [
    'Branch / Line of Business',
    'Month of Quarter (1, 2, or 3)',
    'Vatable Sales (12%)',
    'Sales to Government',
    'Zero-Rated Sales',
    'VAT Exempt Sales',
    'Input Purchases - Goods',
    'Input Purchases - Services',
    'Input Capital Goods',
    'Input Importations',
    'Creditable VAT Withheld - Govt (2307)',
    'Creditable VAT Withheld - Private (2307)',
  ];

  // Sample data demonstrating 2 branches across 3 months of the quarter
  const sampleRows = [
    ['Main Branch - Metro Manila', 1, 480000, 0, 0, 0, 190000, 45000, 0, 0, 0, 0],
    ['Main Branch - Metro Manila', 2, 530000, 0, 0, 0, 210000, 50000, 0, 0, 0, 0],
    ['Main Branch - Metro Manila', 3, 590000, 60000, 0, 0, 225000, 52000, 0, 0, 3000, 0],
    ['Branch 2 - Cebu Distribution', 1, 290000, 0, 0, 0, 115000, 28000, 0, 0, 0, 0],
    ['Branch 2 - Cebu Distribution', 2, 320000, 0, 0, 0, 128000, 31000, 0, 0, 0, 0],
    ['Branch 2 - Cebu Distribution', 3, 345000, 0, 0, 0, 134000, 33000, 0, 0, 0, 0],
  ];

  const sheetData = [header, ...sampleRows];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Set column widths for clean look in Excel
  ws['!cols'] = [
    { wch: 30 }, // Branch Name
    { wch: 28 }, // Month of Quarter
    { wch: 20 }, // Vatable Sales
    { wch: 20 }, // Sales to Govt
    { wch: 18 }, // Zero-rated
    { wch: 18 }, // Exempt
    { wch: 24 }, // Input Goods
    { wch: 24 }, // Input Services
    { wch: 20 }, // Capital Goods
    { wch: 18 }, // Importations
    { wch: 32 }, // 2307 Govt
    { wch: 32 }, // 2307 Private
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'BIR_2550Q_Data');

  const sanitizedClient = clientTradeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  XLSX.writeFile(wb, `BIR_2550Q_Template_${sanitizedClient}_${quarter}_${year}.xlsx`);
}

/**
 * Normalizes string keys to match common header variations in Excel/CSV
 */
function cleanKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Parses numeric cell values safely
 */
function parseCellNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/,/g, '').replace(/₱/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Parses uploaded Excel / CSV ArrayBuffer into structured branch and monthly data.
 */
export function parseVatExcelBuffer(buffer: ArrayBuffer, fileName: string): ParsedVatExcelResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];

  // Convert to JSON with raw values
  const rawRows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const records: BranchVatRecord[] = [];

  for (const row of rawRows) {
    // Map columns by matching clean keys
    const entries = Object.entries(row);
    let branchName = 'Main Branch / Head Office';
    let monthNum: 1 | 2 | 3 = 1;
    let vatableSales = 0;
    let salesToGovernment = 0;
    let zeroRatedSales = 0;
    let vatExemptSales = 0;
    let inputPurchasesGoods = 0;
    let inputPurchasesServices = 0;
    let inputCapitalGoods = 0;
    let inputImportations = 0;
    let withheldVat2307Govt = 0;
    let withheldVat2307Private = 0;

    for (const [key, val] of entries) {
      const k = cleanKey(key);

      if (k.includes('branch') || k.includes('lineofbusiness') || k.includes('store') || k.includes('unit')) {
        const strVal = String(val).trim();
        if (strVal) branchName = strVal;
      } else if (k.includes('month') || k === 'm') {
        const rawM = String(val).toLowerCase();
        if (rawM.includes('3') || rawM.includes('3rd') || rawM.includes('third')) monthNum = 3;
        else if (rawM.includes('2') || rawM.includes('2nd') || rawM.includes('second')) monthNum = 2;
        else monthNum = 1;
      } else if (k.includes('vatablesale') || k === 'sales' || k === 'grosssales' || k.includes('vatablesales12')) {
        vatableSales = parseCellNumber(val);
      } else if (k.includes('government') || k.includes('salestogovt') || k.includes('salestogovernment')) {
        salesToGovernment = parseCellNumber(val);
      } else if (k.includes('zerorated') || k.includes('zero')) {
        zeroRatedSales = parseCellNumber(val);
      } else if (k.includes('exempt')) {
        vatExemptSales = parseCellNumber(val);
      } else if (k.includes('goods') && (k.includes('input') || k.includes('purchase'))) {
        inputPurchasesGoods = parseCellNumber(val);
      } else if (k.includes('service') && (k.includes('input') || k.includes('purchase'))) {
        inputPurchasesServices = parseCellNumber(val);
      } else if (k.includes('capital') || k.includes('depreciable')) {
        inputCapitalGoods = parseCellNumber(val);
      } else if (k.includes('import')) {
        inputImportations = parseCellNumber(val);
      } else if ((k.includes('2307') || k.includes('withheld')) && k.includes('govt')) {
        withheldVat2307Govt = parseCellNumber(val);
      } else if ((k.includes('2307') || k.includes('withheld')) && k.includes('private')) {
        withheldVat2307Private = parseCellNumber(val);
      }
    }

    // Only add if row has any non-empty data
    if (
      vatableSales > 0 ||
      salesToGovernment > 0 ||
      zeroRatedSales > 0 ||
      vatExemptSales > 0 ||
      inputPurchasesGoods > 0 ||
      inputPurchasesServices > 0 ||
      inputCapitalGoods > 0 ||
      inputImportations > 0 ||
      withheldVat2307Govt > 0 ||
      withheldVat2307Private > 0
    ) {
      records.push({
        branchOrLineOfBusiness: branchName,
        monthOfQuarter: monthNum,
        vatableSales,
        salesToGovernment,
        zeroRatedSales,
        vatExemptSales,
        inputPurchasesGoods,
        inputPurchasesServices,
        inputCapitalGoods,
        inputImportations,
        withheldVat2307Govt,
        withheldVat2307Private,
      });
    }
  }

  // Calculate aggregated totals
  const totals = records.reduce(
    (acc, r) => ({
      vatableSales: acc.vatableSales + r.vatableSales,
      salesToGovernment: acc.salesToGovernment + r.salesToGovernment,
      zeroRatedSales: acc.zeroRatedSales + r.zeroRatedSales,
      vatExemptSales: acc.vatExemptSales + r.vatExemptSales,
      inputPurchasesGoods: acc.inputPurchasesGoods + r.inputPurchasesGoods,
      inputPurchasesServices: acc.inputPurchasesServices + r.inputPurchasesServices,
      inputCapitalGoods: acc.inputCapitalGoods + r.inputCapitalGoods,
      inputImportations: acc.inputImportations + r.inputImportations,
      withheldVat2307Govt: acc.withheldVat2307Govt + r.withheldVat2307Govt,
      withheldVat2307Private: acc.withheldVat2307Private + r.withheldVat2307Private,
    }),
    {
      vatableSales: 0,
      salesToGovernment: 0,
      zeroRatedSales: 0,
      vatExemptSales: 0,
      inputPurchasesGoods: 0,
      inputPurchasesServices: 0,
      inputCapitalGoods: 0,
      inputImportations: 0,
      withheldVat2307Govt: 0,
      withheldVat2307Private: 0,
    }
  );

  // Group by branch
  const branchMap = new Map<string, BranchVatRecord[]>();
  for (const r of records) {
    const list = branchMap.get(r.branchOrLineOfBusiness) || [];
    list.push(r);
    branchMap.set(r.branchOrLineOfBusiness, list);
  }

  const branches = Array.from(branchMap.keys());

  const summaryByBranch: BranchVatSummary[] = branches.map((branch) => {
    const branchRecords = branchMap.get(branch) || [];
    let m1 = 0;
    let m2 = 0;
    let m3 = 0;
    let totalSales = 0;
    let totalInputPurchases = 0;

    for (const br of branchRecords) {
      const sales = br.vatableSales + br.salesToGovernment;
      if (br.monthOfQuarter === 1) m1 += sales;
      if (br.monthOfQuarter === 2) m2 += sales;
      if (br.monthOfQuarter === 3) m3 += sales;
      totalSales += sales;
      totalInputPurchases +=
        br.inputPurchasesGoods + br.inputPurchasesServices + br.inputCapitalGoods + br.inputImportations;
    }

    const outputTax = totalSales * 0.12;
    const totalInputTax = totalInputPurchases * 0.12;
    const netVatEstimated = outputTax - totalInputTax;

    return {
      branch,
      month1Sales: m1,
      month2Sales: m2,
      month3Sales: m3,
      totalSales,
      outputTax,
      totalInputPurchases,
      totalInputTax,
      netVatEstimated,
    };
  });

  // Group by Month (1, 2, 3)
  const month1Records = records.filter((r) => r.monthOfQuarter === 1);
  const month2Records = records.filter((r) => r.monthOfQuarter === 2);
  const month3Records = records.filter((r) => r.monthOfQuarter === 3);

  const getMonthSummary = (month: 1 | 2 | 3, monthLabel: string, recs: BranchVatRecord[]): MonthlyVatSummary => {
    const sales = recs.reduce((sum, r) => sum + r.vatableSales + r.salesToGovernment, 0);
    const inputPurchases = recs.reduce(
      (sum, r) => sum + r.inputPurchasesGoods + r.inputPurchasesServices + r.inputCapitalGoods + r.inputImportations,
      0
    );
    return {
      month,
      monthLabel,
      sales,
      outputTax: sales * 0.12,
      inputPurchases,
      estimatedInputTax: inputPurchases * 0.12,
    };
  };

  const summaryByMonth: MonthlyVatSummary[] = [
    getMonthSummary(1, '1st Month of Quarter', month1Records),
    getMonthSummary(2, '2nd Month of Quarter', month2Records),
    getMonthSummary(3, '3rd Month of Quarter', month3Records),
  ];

  return {
    records,
    totals,
    branches,
    summaryByBranch,
    summaryByMonth,
    rowCount: records.length,
    fileName,
  };
}

/**
 * Applies parsed Excel totals into the BIR 2550Q form state
 */
export function applyParsedVatToData2550Q(parsed: ParsedVatExcelResult, prev: Data2550Q): Data2550Q {
  return {
    ...prev,
    vatableSales: parsed.totals.vatableSales,
    salesToGovernment: parsed.totals.salesToGovernment,
    zeroRatedSales: parsed.totals.zeroRatedSales,
    vatExemptSales: parsed.totals.vatExemptSales,
    inputPurchasesGoods: parsed.totals.inputPurchasesGoods,
    inputPurchasesServices: parsed.totals.inputPurchasesServices,
    inputCapitalGoods: parsed.totals.inputCapitalGoods,
    inputImportations: parsed.totals.inputImportations,
    withheldVat2307Govt: parsed.totals.withheldVat2307Govt,
    withheldVat2307Private: parsed.totals.withheldVat2307Private,
  };
}
