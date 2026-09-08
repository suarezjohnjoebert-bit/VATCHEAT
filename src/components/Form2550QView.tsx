import React, { useState, useRef } from 'react';
import { Data2550Q, ClientProfile, Quarter } from '../types/tax';
import { calculate2550Q } from '../utils/taxCalculations';
import { formatPHP, parseNumber } from '../utils/formatters';
import {
  Copy,
  Check,
  AlertTriangle,
  Upload,
  Download,
  FileSpreadsheet,
  Building2,
  Calendar,
  ChevronDown,
  ChevronUp,
  XCircle,
} from 'lucide-react';
import { PenaltiesModal } from './PenaltiesModal';
import {
  downloadVatExcelTemplate,
  parseVatExcelBuffer,
  applyParsedVatToData2550Q,
  ParsedVatExcelResult,
} from '../utils/excelVatTemplate';

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
  const [copied, setCopied] = useState(false);
  const [uploadedResult, setUploadedResult] = useState<ParsedVatExcelResult | null>(null);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [uploadSuccessMsg, setUploadSuccessMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const result = calculate2550Q(data);

  const updateField = (field: keyof Data2550Q, value: any) => {
    onChange({
      ...data,
      [field]: value,
    });
  };

  const handleCopySummary = () => {
    const text = [
      `BIR FORM 2550Q - ${quarter} ${year}`,
      `Client: ${client.registeredName} (TIN: ${client.tin})`,
      `Vatable Sales (12%): ₱${result.vatableSales.toLocaleString()}`,
      `Output VAT Due: ₱${result.outputTax.toLocaleString()}`,
      `Total Available Input VAT: ₱${result.totalAvailableInputTax.toLocaleString()}`,
      `Net VAT Before Credits: ₱${result.netVatBeforeCredits.toLocaleString()}`,
      `Creditable VAT Withheld (2307): ₱${result.totalTaxCredits.toLocaleString()}`,
      result.isExcessInputVat
        ? `Excess Input VAT Carried Over: ₱${result.excessInputTax.toLocaleString()}`
        : `Net VAT Payable: ₱${result.netVatPayable.toLocaleString()}`,
    ].join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTemplate = () => {
    downloadVatExcelTemplate(client.tradeName, quarter, year);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const parsed = parseVatExcelBuffer(buffer, file.name);

        if (parsed.rowCount === 0) {
          setUploadError('No valid branch or monthly rows found in the uploaded file. Please use the provided template.');
          return;
        }

        setUploadedResult(parsed);
        setShowBreakdown(true);

        // Apply parsed figures to Form 2550Q
        const updated = applyParsedVatToData2550Q(parsed, data);
        onChange(updated);

        setUploadSuccessMsg(
          `Successfully loaded ${parsed.rowCount} records across ${parsed.branches.length} branch(es) for Months 1, 2, and 3!`
        );

        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (err: any) {
        setUploadError(`Failed to process Excel file: ${err.message || 'Check file format'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={handleFileUpload}
      />

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
          {/* Download Template Button */}
          <button
            id="download-vat-template-btn"
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors shadow-xs"
            title="Download formatted Excel template (.xlsx) for multi-branch/monthly VAT entry"
          >
            <Download className="w-3.5 h-3.5 text-violet-400" />
            <span>Download Template</span>
          </button>

          {/* Upload Excel Button */}
          <button
            id="upload-vat-excel-btn"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-xs font-semibold"
            title="Upload completed branch/monthly VAT Excel file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Excel</span>
          </button>

          <button
            id="copy-2550q-btn"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Summary'}</span>
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

      {/* Success Notification */}
      {uploadSuccessMsg && (
        <div className="flex items-center justify-between p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{uploadSuccessMsg}</span>
          </div>
          <button
            onClick={() => setUploadSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Error Notification */}
      {uploadError && (
        <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={() => setUploadError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Excel Upload Info / Branch & Month Breakdown Panel */}
      {uploadedResult && (
        <div className="bg-white border border-violet-200 rounded-xl shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-4 bg-violet-50/70 border-b border-violet-100">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-5 h-5 text-violet-700" />
              <div>
                <div className="text-sm font-bold text-violet-950 flex items-center gap-2">
                  <span>Uploaded Excel Breakdown: {uploadedResult.fileName}</span>
                  <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-violet-200/80 text-violet-900 font-mono">
                    {uploadedResult.rowCount} rows • {uploadedResult.branches.length} branch(es)
                  </span>
                </div>
                <div className="text-xs text-violet-700 mt-0.5">
                  Multi-Branch & 3-Month quarterly data loaded directly into BIR Form 2550Q schedules below
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBreakdown(!showBreakdown)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 rounded-lg transition-colors"
              >
                {showBreakdown ? (
                  <>
                    <span>Hide Breakdown</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>View Breakdown</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              <button
                onClick={() => setUploadedResult(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                title="Dismiss breakdown view"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showBreakdown && (
            <div className="p-4 space-y-5">
              {/* Monthly Breakdown Cards */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-violet-600" />
                  <span>Quarterly Breakdown by Month (1st, 2nd, and 3rd Month of Quarter)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {uploadedResult.summaryByMonth.map((m) => (
                    <div
                      key={m.month}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-slate-800 border-b border-slate-200 pb-1">
                        <span>{m.monthLabel}</span>
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-violet-100 text-violet-800 font-mono">
                          Month {m.month}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Vatable Sales:</span>
                        <span className="font-mono font-medium text-slate-900">{formatPHP(m.sales)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Output Tax (12%):</span>
                        <span className="font-mono font-medium text-violet-700">{formatPHP(m.outputTax)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Input Purchases:</span>
                        <span className="font-mono font-medium text-slate-800">{formatPHP(m.inputPurchases)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Branch / Line of Business Table */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-violet-600" />
                  <span>Breakdown by Branch or Line of Business</span>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Branch / Line of Business</th>
                        <th className="py-2.5 px-3 text-right">Month 1 Sales</th>
                        <th className="py-2.5 px-3 text-right">Month 2 Sales</th>
                        <th className="py-2.5 px-3 text-right">Month 3 Sales</th>
                        <th className="py-2.5 px-3 text-right">Total Qtr Sales</th>
                        <th className="py-2.5 px-3 text-right">Output VAT (12%)</th>
                        <th className="py-2.5 px-3 text-right">Input Purchases</th>
                        <th className="py-2.5 px-3 text-right font-bold text-slate-900">Est. Net VAT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {uploadedResult.summaryByBranch.map((b, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80">
                          <td className="py-2 px-3 font-medium text-slate-900 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-violet-600"></span>
                            <span>{b.branch}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{formatPHP(b.month1Sales)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{formatPHP(b.month2Sales)}</td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">{formatPHP(b.month3Sales)}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                            {formatPHP(b.totalSales)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-violet-700 font-medium">
                            {formatPHP(b.outputTax)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {formatPHP(b.totalInputPurchases)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatPHP(b.netVatEstimated)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold border-t border-slate-200 text-slate-900">
                      <tr>
                        <td className="py-2.5 px-3">Total Consolidated</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatPHP(uploadedResult.summaryByBranch.reduce((s, b) => s + b.month1Sales, 0))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatPHP(uploadedResult.summaryByBranch.reduce((s, b) => s + b.month2Sales, 0))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatPHP(uploadedResult.summaryByBranch.reduce((s, b) => s + b.month3Sales, 0))}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-violet-900">
                          {formatPHP(uploadedResult.totals.vatableSales + uploadedResult.totals.salesToGovernment)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-violet-700">
                          {formatPHP(result.outputTax)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {formatPHP(
                            uploadedResult.totals.inputPurchasesGoods +
                              uploadedResult.totals.inputPurchasesServices +
                              uploadedResult.totals.inputCapitalGoods +
                              uploadedResult.totals.inputImportations
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-800">
                          {formatPHP(result.netVatPayable)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

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
              <span className="text-xs font-mono text-slate-500">Auto-Computed</span>
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
