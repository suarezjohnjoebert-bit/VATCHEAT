import React, { useState, useRef } from 'react';
import { Data2550Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2550Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import { downloadBirSlspExcelTemplate } from '../utils/excelVatTemplate';
import { BranchVatSchedule } from './BranchVatSchedule';
import { exportMultiBranchAnd2550QPdf } from '../utils/pdfExport';

interface Form2550QViewProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  data: Data2550Q;
  onChange: (updated: Data2550Q) => void;
}

export const Form2550QView: React.FC<Form2550QViewProps> = ({
  client,
  quarter,
  year,
  data,
  onChange,
}) => {
  const [showPenalties, setShowPenalties] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const result = calculate2550Q(data);

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportMultiBranchAnd2550QPdf({
        client,
        quarter,
        year,
        data2550Q: data,
        result2550Q: result,
      });
    } catch (err) {
      console.error('Failed to export PDF', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const updateField = (field: keyof Data2550Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleSyncFromBranchSchedule = (totals: {
    vatableSales: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    inputPurchasesServices: number;
    inputCapitalGoods: number;
  }) => {
    onChange({
      ...data,
      vatableSales: totals.vatableSales,
      zeroRatedSales: totals.zeroRatedSales,
      vatExemptSales: totals.vatExemptSales,
      inputPurchasesGoods: totals.inputPurchasesGoods,
      inputPurchasesServices: totals.inputPurchasesServices,
      inputCapitalGoods: totals.inputCapitalGoods,
    });
  };

  const handleDownloadTemplate = () => {
    downloadBirSlspExcelTemplate({
      type: 'Sales',
      quarter,
      monthLabel: '1st Month',
      client,
      includeSampleRow: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Main Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-xs font-bold bg-violet-600 text-white rounded">
              BIR Form 2550Q
            </span>
            <span className="text-xs text-slate-300 font-mono">
              {quarter} {year} • Quarterly Value-Added Tax Return
            </span>
          </div>
          <h2 className="text-base font-semibold mt-1">{client.tradeName}</h2>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download Landscape PDF Form Button */}
          <button
            id="download-pdf-summary-2550q-header-btn"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-violet-700 hover:bg-violet-800 text-white rounded-lg transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
            title="Download Landscape PDF of Multi-Branch Aggregation Summary, Schedules 1 to 3, and Form 2550Q VAT Summary"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5" />
                <span>Download PDF Summary (Landscape)</span>
              </>
            )}
          </button>

          {/* Download Template Button */}
          <button
            id="download-vat-template-btn"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-xs"
            title="Download formatted BIR SLSP Excel template (.xlsx)"
          >
            <Download className="w-3.5 h-3.5 text-violet-400" />
            <span>Download Template</span>
          </button>

          <button
            id="open-penalties-2550q-btn"
            onClick={() => setShowPenalties(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg transition-colors"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Late Penalties</span>
          </button>
        </div>
      </div>

      {/* Multi-Branch & Line of Business Schedule Component */}
      <BranchVatSchedule
        client={client}
        quarter={quarter}
        year={year}
        formType="2550Q"
        data2550Q={data}
        onSync2550Q={handleSyncFromBranchSchedule}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Output Taxable Sales */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Schedule 1: Sales / Receipts (Output Tax)
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700 font-medium">Vatable Sales / Receipts (12%)</div>
                  <div className="text-xs text-slate-400">Regular domestic sales subject to 12% VAT</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vatable-sales-2550q"
                    type="number"
                    value={data.vatableSales || ''}
                    onChange={(e) => updateField('vatableSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700">Sales to Government (12%)</div>
                  <div className="text-xs text-slate-400">Subject to standard 5% VAT withholding</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="govt-sales-2550q"
                    type="number"
                    value={data.salesToGovernment || ''}
                    onChange={(e) => updateField('salesToGovernment', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Zero-Rated Sales (0%)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="zero-rated-2550q"
                    type="number"
                    value={data.zeroRatedSales || ''}
                    onChange={(e) => updateField('zeroRatedSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">VAT-Exempt Sales</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="exempt-sales-2550q"
                    type="number"
                    value={data.vatExemptSales || ''}
                    onChange={(e) => updateField('vatExemptSales', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Input Tax on Purchases */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Schedule 2: Allowable Input Tax on Purchases (12%)
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Domestic Purchases of Goods</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="input-goods-2550q"
                    type="number"
                    value={data.inputPurchasesGoods || ''}
                    onChange={(e) => updateField('inputPurchasesGoods', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Domestic Purchases of Services</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="input-services-2550q"
                    type="number"
                    value={data.inputPurchasesServices || ''}
                    onChange={(e) => updateField('inputPurchasesServices', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Capital Goods Purchases</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="input-capital-2550q"
                    type="number"
                    value={data.inputCapitalGoods || ''}
                    onChange={(e) => updateField('inputCapitalGoods', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Quarter's Excess Input Tax</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-excess-input-2550q"
                    type="number"
                    value={data.priorQuarterExcessInputVat || ''}
                    onChange={(e) => updateField('priorQuarterExcessInputVat', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tax Credits / Withheld VAT */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Schedule 3: Tax Credits & Withholding VAT
            </div>

            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="text-sm text-slate-700">VAT Withheld on Sales to Govt (Form 2307)</div>
                  <div className="text-xs text-slate-400">5% standard final withholding VAT</div>
                </div>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vat-govt-withheld-2550q"
                    type="number"
                    value={data.withheldVat2307Govt || ''}
                    onChange={(e) => updateField('withheldVat2307Govt', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Other Creditable VAT Withheld</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="vat-other-withheld-2550q"
                    type="number"
                    value={data.withheldVat2307Private || ''}
                    onChange={(e) => updateField('withheldVat2307Private', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-sm text-slate-700">Prior Payments Made (Monthly 2550M)</label>
                <div className="relative w-full sm:w-60">
                  <span className="absolute left-3 top-2 text-sm text-slate-400 font-mono">₱</span>
                  <input
                    id="prior-payments-2550q"
                    type="number"
                    value={data.priorPaymentsThisQuarter || ''}
                    onChange={(e) => updateField('priorPaymentsThisQuarter', parseNumber(e.target.value))}
                    placeholder="0.00"
                    className="w-full pl-7 pr-3 py-1.5 text-sm font-mono text-right border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right VAT Summary (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 sticky top-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                2550Q VAT Summary
              </div>
              <button
                type="button"
                id="download-pdf-from-vat-summary-btn"
                onClick={handleExportPdf}
                disabled={isExportingPdf}
                className="flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-900 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded border border-violet-200 transition-colors cursor-pointer disabled:opacity-60"
                title="Download Landscape PDF Form (Aggregation, Schedules 1-3, VAT Summary)"
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FileText className="w-3 h-3" />
                )}
                <span>PDF Summary</span>
              </button>
            </div>

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Vatable Sales</span>
                <span className="font-mono font-medium">{formatPHP(result.vatableSales)}</span>
              </div>
              <div className="flex justify-between text-slate-900 font-semibold">
                <span>Output Tax Due (12%)</span>
                <span className="font-mono">{formatPHP(result.outputTax)}</span>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Input Tax from Purchases</span>
                  <span className="font-mono font-medium">{formatPHP(result.inputTaxPurchases)}</span>
                </div>
                <div className="flex justify-between text-slate-600 mt-1">
                  <span>Prior Quarter Excess Input</span>
                  <span className="font-mono font-medium">{formatPHP(data.priorQuarterExcessInputVat)}</span>
                </div>
                <div className="flex justify-between text-slate-800 font-medium mt-1">
                  <span>Total Available Input Tax</span>
                  <span className="font-mono">{formatPHP(result.totalAvailableInputTax)}</span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200">
                <div className="flex justify-between text-slate-600">
                  <span>Less: Creditable VAT Withheld</span>
                  <span className="font-mono font-medium text-emerald-700">
                    -{formatPHP(result.totalTaxCredits, false)}
                  </span>
                </div>
              </div>

              {/* Net VAT Banner */}
              <div
                className={`p-4 rounded-xl mt-4 border ${
                  result.isExcessInputVat
                    ? 'bg-blue-50 border-blue-200 text-blue-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="text-xs uppercase tracking-wider font-semibold opacity-80">
                  {result.isExcessInputVat ? 'Excess Input VAT to Next Quarter' : 'Net VAT Payable (To BIR)'}
                </div>
                <div className="text-2xl font-bold font-mono mt-1">
                  {result.isExcessInputVat
                    ? formatPHP(result.excessInputTax)
                    : formatPHP(Math.max(0, result.netVatPayable))}
                </div>
                <div className="text-xs mt-1 text-slate-500">
                  {result.isExcessInputVat
                    ? 'Available as input credit for succeeding quarters'
                    : 'Remit to BIR within statutory quarterly deadline'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PenaltiesModal
        isOpen={showPenalties}
        onClose={() => setShowPenalties(false)}
        basicTaxDue={result.netVatPayable}
        formName={`BIR Form 2550Q (${quarter} ${year})`}
      />
    </div>
  );
};
