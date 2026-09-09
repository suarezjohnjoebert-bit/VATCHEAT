import React, { useState, useEffect, useRef } from 'react';
import { ClientProfile, Quarter, Data2550Q } from '../types/tax';
import {
  ClientBranchSchedule,
  BirUploadedFileRecord,
  PurchasesReportingMode,
  MonthIndex,
  BirTransactionRow,
} from '../types/branchVat';
import {
  downloadBirSlspExcelTemplate,
  parseBirSlspExcelFile,
} from '../utils/excelVatTemplate';
import { formatPHP } from '../utils/formatters';
import { exportMultiBranchAnd2550QPdf } from '../utils/pdfExport';
import {
  Building,
  Plus,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Table,
  Check,
  RotateCcw,
  Eye,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
  Loader2,
} from 'lucide-react';

interface BranchVatScheduleProps {
  client: ClientProfile;
  quarter: Quarter;
  year: number;
  formType: '2550Q' | '2551Q';
  data2550Q?: Data2550Q;
  onSync2550Q?: (data: {
    vatableSales: number;
    zeroRatedSales: number;
    vatExemptSales: number;
    inputPurchasesGoods: number;
    inputPurchasesServices: number;
    inputCapitalGoods: number;
  }) => void;
  onSync2551Q?: (data: {
    grossSales: number;
    exemptSales: number;
  }) => void;
}

const getMonthLabelsForQuarter = (quarter: Quarter): { index: MonthIndex; label: string; name: string }[] => {
  switch (quarter) {
    case 'Q1':
      return [
        { index: 1, label: '1st Month', name: 'January' },
        { index: 2, label: '2nd Month', name: 'February' },
        { index: 3, label: '3rd Month', name: 'March' },
      ];
    case 'Q2':
      return [
        { index: 1, label: '1st Month', name: 'April' },
        { index: 2, label: '2nd Month', name: 'May' },
        { index: 3, label: '3rd Month', name: 'June' },
      ];
    case 'Q3':
      return [
        { index: 1, label: '1st Month', name: 'July' },
        { index: 2, label: '2nd Month', name: 'August' },
        { index: 3, label: '3rd Month', name: 'September' },
      ];
    case 'Q4':
      return [
        { index: 1, label: '1st Month', name: 'October' },
        { index: 2, label: '2nd Month', name: 'November' },
        { index: 3, label: '3rd Month', name: 'December' },
      ];
  }
};

export const BranchVatSchedule: React.FC<BranchVatScheduleProps> = ({
  client,
  quarter,
  year,
  formType,
  data2550Q,
  onSync2550Q,
  onSync2551Q,
}) => {
  const isVat = formType === '2550Q';
  const monthList = getMonthLabelsForQuarter(quarter);
  const storageKey = `bir_branch_schedule_${client.id}_${year}_${quarter}`;

  // Branches state
  const [branches, setBranches] = useState<ClientBranchSchedule[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.branches && parsed.branches.length > 0) return parsed.branches;
      }
    } catch (e) {
      console.error('Failed to load branch schedule', e);
    }
    return [
      {
        id: 'branch-main',
        name: client.tradeName ? `${client.tradeName} - Main Office` : 'Main Branch / Head Office',
        salesFiles: {},
        purchasesFiles: {},
      },
    ];
  });

  // Client Branch structure: Has branches vs. Single unit (no branches)
  const [hasBranches, setHasBranches] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.hasBranches === 'boolean') return parsed.hasBranches;
      }
    } catch (e) {}
    if (typeof client.hasBranches === 'boolean') return client.hasBranches;
    return false;
  });

  useEffect(() => {
    if (typeof client.hasBranches === 'boolean') {
      setHasBranches(client.hasBranches);
    }
  }, [client.id, client.hasBranches]);

  // Purchases Mode state: 'consolidated' or 'per-branch'
  const [purchasesMode, setPurchasesMode] = useState<PurchasesReportingMode>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.purchasesMode) return parsed.purchasesMode;
      }
    } catch (e) {
      console.error('Failed to load purchases mode', e);
    }
    return 'consolidated';
  });

  // Consolidated purchases file (if purchasesMode === 'consolidated')
  const [consolidatedPurchasesFile, setConsolidatedPurchasesFile] = useState<BirUploadedFileRecord | undefined>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.consolidatedPurchasesFile) return parsed.consolidatedPurchasesFile;
      }
    } catch (e) {
      console.error('Failed to load consolidated purchases', e);
    }
    return undefined;
  });

  // UI state
  const [isSectionOpen, setIsSectionOpen] = useState(true);
  const [activeBranchId, setActiveBranchId] = useState<string>(branches[0]?.id || 'branch-main');
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = useState<string>('');
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);
  const [uploadErrorMsg, setUploadErrorMsg] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<BirUploadedFileRecord | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<ClientBranchSchedule | null>(null);

  // Horizontal branch tab scrolling ref & state
  const tabsContainerRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const checkScrollState = () => {
    const el = tabsContainerRef.current;
    if (el) {
      setCanScrollLeft(el.scrollLeft > 4);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    }
  };

  useEffect(() => {
    checkScrollState();
    const el = tabsContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScrollState);
    window.addEventListener('resize', checkScrollState);
    return () => {
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
    };
  }, [branches.length]);

  // Auto scroll active tab into view when activeBranchId changes
  useEffect(() => {
    if (activeBranchId && tabsContainerRef.current) {
      const activeEl = tabsContainerRef.current.querySelector(`[data-branch-id="${activeBranchId}"]`);
      if (activeEl) {
        (activeEl as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    checkScrollState();
  }, [activeBranchId, branches.length]);

  const scrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const scrollAmount = 240;
      tabsContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
      setTimeout(checkScrollState, 200);
    }
  };

  // Hidden file input handling
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentUploadTarget = useRef<{
    fileType: 'sales' | 'purchases';
    branchId?: string;
    monthIndex?: MonthIndex | 'consolidated';
  } | null>(null);

  // Save to localStorage whenever branches, purchasesMode, consolidatedPurchasesFile, or hasBranches changes
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          branches,
          purchasesMode,
          consolidatedPurchasesFile,
          hasBranches,
        })
      );
    } catch (e) {
      console.error('Failed to persist branch schedule', e);
    }
  }, [branches, purchasesMode, consolidatedPurchasesFile, hasBranches, storageKey]);

  // Sync activeBranchId if list changes
  useEffect(() => {
    if (!branches.some((b) => b.id === activeBranchId) && branches.length > 0) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId]);

  // Handle Add Branch
  const handleAddBranch = () => {
    const newIndex = branches.length + 1;
    const newBranch: ClientBranchSchedule = {
      id: `branch-${Date.now()}`,
      name: `Branch ${newIndex} - Line of Business`,
      salesFiles: {},
      purchasesFiles: {},
    };
    setBranches([...branches, newBranch]);
    setActiveBranchId(newBranch.id);
    setSyncSuccessMsg(`Added new branch "${newBranch.name}".`);
  };

  // Handle Remove / Delete Branch via in-app confirmation modal
  const handleRemoveBranch = (id: string) => {
    const branchToRemove = branches.find((b) => b.id === id);
    if (branchToRemove) {
      setBranchToDelete(branchToRemove);
    }
  };

  const handleConfirmDeleteBranch = () => {
    if (!branchToDelete) return;
    const targetId = branchToDelete.id;
    const targetName = branchToDelete.name;

    if (branches.length <= 1) {
      // If deleting the only branch in the schedule, reset it to a clean blank branch
      const resetBranch: ClientBranchSchedule = {
        id: `branch-${Date.now()}`,
        name: hasBranches ? 'Branch 1 - Main Office' : 'Main Branch / Head Office',
        salesFiles: {},
        purchasesFiles: {},
      };
      setBranches([resetBranch]);
      setActiveBranchId(resetBranch.id);
      setSyncSuccessMsg(`Branch "${targetName}" data and uploaded files have been deleted.`);
    } else {
      const updated = branches.filter((b) => b.id !== targetId);
      setBranches(updated);
      if (activeBranchId === targetId && updated.length > 0) {
        setActiveBranchId(updated[0].id);
      }
      setSyncSuccessMsg(`Branch "${targetName}" has been successfully deleted.`);
    }
    setBranchToDelete(null);
  };

  // Handle Edit Branch Name directly
  const handleUpdateBranchName = (id: string, newName: string) => {
    setBranches((prev) =>
      prev.map((b) => (b.id === id ? { ...b, name: newName } : b))
    );
  };

  // Handle Rename Branch via modal/inline
  const handleSaveRename = (id: string) => {
    if (!editingBranchName.trim()) {
      setEditingBranchId(null);
      return;
    }
    handleUpdateBranchName(id, editingBranchName.trim());
    setEditingBranchId(null);
  };

  // Handle Download Template
  const handleDownloadTemplate = (
    type: 'Sales' | 'Purchases',
    monthIndex: MonthIndex | 'consolidated',
    branchName?: string
  ) => {
    const monthLabel =
      monthIndex === 'consolidated'
        ? 'Consolidated'
        : monthIndex === 1
        ? '1st Month'
        : monthIndex === 2
        ? '2nd Month'
        : '3rd Month';

    downloadBirSlspExcelTemplate({
      type,
      quarter,
      monthLabel,
      client,
      branchName,
      includeSampleRow: true,
    });
  };

  // Trigger File Upload Dialog
  const triggerFileUpload = (
    fileType: 'sales' | 'purchases',
    monthIndex: MonthIndex | 'consolidated',
    branchId?: string
  ) => {
    currentUploadTarget.current = { fileType, monthIndex, branchId };
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Handle File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUploadTarget.current) return;

    const { fileType, monthIndex, branchId } = currentUploadTarget.current;
    setUploadErrorMsg(null);
    setSyncSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const currentBranch = branches.find((b) => b.id === branchId);
        const parsed = parseBirSlspExcelFile(
          buffer,
          file.name,
          fileType,
          monthIndex,
          branchId,
          currentBranch?.name,
          quarter
        );

        if (fileType === 'purchases' && monthIndex === 'consolidated') {
          setConsolidatedPurchasesFile(parsed);
          setSyncSuccessMsg(`Loaded Consolidated Purchases Excel (${parsed.rowCount} record(s))`);
        } else if (branchId) {
          const monthKey = monthIndex === 1 ? 'month1' : monthIndex === 2 ? 'month2' : 'month3';
          setBranches((prev) =>
            prev.map((b) => {
              if (b.id !== branchId) return b;
              if (fileType === 'sales') {
                return {
                  ...b,
                  salesFiles: {
                    ...b.salesFiles,
                    [monthKey]: parsed,
                  },
                };
              } else {
                return {
                  ...b,
                  purchasesFiles: {
                    ...(b.purchasesFiles || {}),
                    [monthKey]: parsed,
                  },
                };
              }
            })
          );
          setSyncSuccessMsg(
            `Loaded ${fileType === 'sales' ? 'Sales' : 'Purchases'} Excel for Month ${monthIndex} (${parsed.rowCount} record(s))`
          );
        }
      } catch (err: any) {
        console.error('Error parsing file', err);
        setUploadErrorMsg(`Failed to parse Excel file: ${err.message || 'Invalid format'}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Handle Remove Uploaded File
  const handleRemoveFile = (
    fileType: 'sales' | 'purchases',
    monthIndex: MonthIndex | 'consolidated',
    branchId?: string
  ) => {
    if (fileType === 'purchases' && monthIndex === 'consolidated') {
      setConsolidatedPurchasesFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setSyncSuccessMsg('Consolidated Purchases document deleted. You can now upload the correct document.');
      return;
    }
    if (!branchId) return;
    const monthKey = monthIndex === 1 ? 'month1' : monthIndex === 2 ? 'month2' : 'month3';

    setBranches((prev) =>
      prev.map((b) => {
        if (b.id !== branchId) return b;
        if (fileType === 'sales') {
          const updated = { ...b.salesFiles };
          delete updated[monthKey];
          return { ...b, salesFiles: updated };
        } else {
          const updated = { ...(b.purchasesFiles || {}) };
          delete updated[monthKey];
          return { ...b, purchasesFiles: updated };
        }
      })
    );

    if (fileInputRef.current) fileInputRef.current.value = '';
    setSyncSuccessMsg(
      `Deleted ${fileType === 'sales' ? 'Sales' : 'Purchases'} ${monthIndex === 'consolidated' ? 'Consolidated' : `Month ${monthIndex}`} document. You can now upload the correct document.`
    );
  };

  // Aggregate Totals across all branches
  // Per BIR SLSP: Row 1999 Column E = Gross, F = Exempt, G = Zero-Rated, H = Taxable (exclusive of VAT), L = Output/Input Tax
  // Aggregation summary reflects only Columns F, G, H, and L
  const aggregatedTotals = React.useMemo(() => {
    let salesColF = 0; // Column F: Exempt Sales
    let salesColG = 0; // Column G: Zero-Rated Sales
    let salesColH = 0; // Column H: Taxable Sales (Exclusive of VAT)
    let salesColL = 0; // Column L: Output Tax (VAT on Sales)
    let salesGross = 0;

    let purchasesColF = 0; // Column F: Exempt Purchases
    let purchasesColG = 0; // Column G: Zero-Rated Purchases
    let purchasesColH = 0; // Column H: Taxable Purchases (Exclusive of VAT)
    let purchasesColL = 0; // Column L: Input Tax (VAT on Purchases)
    let purchasesGross = 0;

    // Sum Sales across all branches & all months
    branches.forEach((branch) => {
      [branch.salesFiles.month1, branch.salesFiles.month2, branch.salesFiles.month3].forEach((f) => {
        if (f) {
          salesGross += f.totals.grossAmount || 0;
          salesColF += f.totals.exemptAmount || 0;
          salesColG += f.totals.zeroRatedAmount || 0;
          salesColH += f.totals.taxableAmount || 0;
          salesColL += f.totals.taxAmount || 0;
        }
      });
    });

    // Sum Purchases
    if (purchasesMode === 'consolidated') {
      if (consolidatedPurchasesFile) {
        purchasesGross += consolidatedPurchasesFile.totals.grossAmount || 0;
        purchasesColF += consolidatedPurchasesFile.totals.exemptAmount || 0;
        purchasesColG += consolidatedPurchasesFile.totals.zeroRatedAmount || 0;
        purchasesColH += consolidatedPurchasesFile.totals.taxableAmount || 0;
        purchasesColL += consolidatedPurchasesFile.totals.taxAmount || 0;
      }
    } else {
      branches.forEach((branch) => {
        const pf = branch.purchasesFiles;
        if (pf) {
          [pf.month1, pf.month2, pf.month3].forEach((f) => {
            if (f) {
              purchasesGross += f.totals.grossAmount || 0;
              purchasesColF += f.totals.exemptAmount || 0;
              purchasesColG += f.totals.zeroRatedAmount || 0;
              purchasesColH += f.totals.taxableAmount || 0;
              purchasesColL += f.totals.taxAmount || 0;
            }
          });
        }
      });
    }

    const netVatPayable = salesColL - purchasesColL;

    return {
      salesColF,
      salesColG,
      salesColH,
      salesColL,
      salesGross,
      purchasesColF,
      purchasesColG,
      purchasesColH,
      purchasesColL,
      purchasesGross,
      netVatPayable,
    };
  }, [branches, purchasesMode, consolidatedPurchasesFile]);

  // Handle Sync to Active Form
  const handleSyncToForm = () => {
    if (isVat && onSync2550Q) {
      onSync2550Q({
        vatableSales: aggregatedTotals.salesColH,
        zeroRatedSales: aggregatedTotals.salesColG,
        vatExemptSales: aggregatedTotals.salesColF,
        inputPurchasesGoods: aggregatedTotals.purchasesColH,
        inputPurchasesServices: 0,
        inputCapitalGoods: 0,
      });
      setSyncSuccessMsg('Successfully synced multi-branch Columns F, G, H, and L to BIR Form 2550Q!');
    } else if (!isVat && onSync2551Q) {
      onSync2551Q({
        grossSales: aggregatedTotals.salesColH || aggregatedTotals.salesGross,
        exemptSales: aggregatedTotals.salesColF,
      });
      setSyncSuccessMsg('Successfully synced multi-branch Sales to BIR Form 2551Q!');
    }
    setTimeout(() => setSyncSuccessMsg(null), 4000);
  };

  // Handle PDF Export
  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      await exportMultiBranchAnd2550QPdf({
        client,
        quarter,
        year,
        branches,
        purchasesMode,
        aggregatedTotals,
        data2550Q,
      });
      setSyncSuccessMsg('Multi-Branch Aggregation & 2550Q VAT Summary PDF generated and downloaded successfully.');
      setTimeout(() => setSyncSuccessMsg(null), 5000);
    } catch (err) {
      console.error('Failed to export PDF', err);
      setUploadErrorMsg('Failed to generate PDF. Please try again.');
      setTimeout(() => setUploadErrorMsg(null), 5000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx, .xls, .csv"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Main Section Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-violet-300">
                Multi-Branch & Line of Business Schedule
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-500/20 text-violet-200 border border-violet-500/30">
                {quarter} {year}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white">
              {client.tradeName} — Branch Monthly Excel Filings
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Download PDF Form Button in schedule header */}
          <button
            type="button"
            id="download-pdf-schedule-header-btn"
            onClick={handleExportPdf}
            disabled={isExportingPdf}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800/90 hover:bg-slate-700 text-slate-100 rounded-lg transition-colors border border-slate-600/80 shadow-2xs disabled:opacity-60 cursor-pointer"
            title="Download Landscape PDF of Multi-Branch Aggregation Summary, Schedules 1-3, and Form 2550Q VAT Summary"
          >
            {isExportingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-300" />
                <span>Exporting PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-violet-300" />
                <span>Export PDF (Landscape)</span>
              </>
            )}
          </button>

          {/* Quick sync button */}
          <button
            id="sync-branch-totals-btn"
            onClick={handleSyncToForm}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors shadow-xs"
            title={`Transfer aggregated branch figures directly into BIR Form ${formType}`}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Sync to {formType}</span>
          </button>

          {/* Toggle expand/collapse */}
          <button
            onClick={() => setIsSectionOpen(!isSectionOpen)}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-700/60 rounded-lg transition-colors"
            title={isSectionOpen ? 'Collapse Section' : 'Expand Section'}
          >
            {isSectionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isSectionOpen && (
        <div className="p-4 sm:p-6 space-y-6">
          {/* Notifications */}
          {syncSuccessMsg && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-medium">{syncSuccessMsg}</span>
            </div>
          )}

          {uploadErrorMsg && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{uploadErrorMsg}</span>
            </div>
          )}

          {/* Top Control Bar: Branch Structure Toggle, Branch Counter & Add Branch + Purchases Mode Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-200">
            {/* Branch Structure Selection (No branch vs. Has branches) & Add Branch */}
            <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-violet-600" />
                  <span>Branch Structure</span>
                </div>
                <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
                  <button
                    type="button"
                    id="branch-structure-no-btn"
                    onClick={() => setHasBranches(false)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      !hasBranches
                        ? 'bg-white text-slate-900 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Client operates as a single business unit or head office with no separate branches"
                  >
                    No Branch (Single Unit)
                  </button>
                  <button
                    type="button"
                    id="branch-structure-yes-btn"
                    onClick={() => setHasBranches(true)}
                    className={`px-3 py-1.5 rounded-md transition-all ${
                      hasBranches
                        ? 'bg-violet-600 text-white shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="Client operates with multiple branches or distinct lines of business"
                  >
                    Has Branches ({branches.length})
                  </button>
                </div>
              </div>

              {/* Only show Add Branch button if client has branches */}
              {hasBranches && (
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <button
                    id="add-branch-btn"
                    onClick={handleAddBranch}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors shadow-2xs"
                    title="Add another branch or line of business to the quarterly schedule"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Branch</span>
                  </button>
                </div>
              )}
            </div>

            {/* Purchases Reporting Mode */}
            <div className="lg:col-span-6 flex flex-col sm:flex-row sm:items-center justify-between lg:justify-end gap-3 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-200">
              <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" />
                Purchases Filing Mode:
              </span>

              <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
                <button
                  type="button"
                  id="purchases-mode-consolidated-btn"
                  onClick={() => setPurchasesMode('consolidated')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    purchasesMode === 'consolidated'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Upload 1 consolidated Excel file for all purchases across all branches"
                >
                  📦 Consolidated (1 File)
                </button>
                <button
                  type="button"
                  id="purchases-mode-per-branch-btn"
                  onClick={() => setPurchasesMode('per-branch')}
                  className={`px-3 py-1.5 rounded-md transition-all ${
                    purchasesMode === 'per-branch'
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Upload separate monthly Excel files (Months 1, 2, 3) for each branch"
                >
                  🏢 Per Branch (3 Files/Branch)
                </button>
              </div>
            </div>
          </div>

          {/* Consolidated Purchases Section (Shown when Consolidated Purchases is Active) */}
          {purchasesMode === 'consolidated' && (
            <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 bg-amber-100 text-amber-800 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4" />
                  </span>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                      Consolidated Purchases (Single Quarterly Reporting)
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Upload 1 Excel file covering all purchases across all branches for {quarter} {year}.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="download-consolidated-purchases-template-btn"
                    onClick={() => handleDownloadTemplate('Purchases', 'consolidated')}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                    title="Download pre-formatted Purchases Excel template with Cell A1: Purchases - [Quarter] - Consolidated"
                  >
                    <Download className="w-3.5 h-3.5 text-amber-600" />
                    <span>Download Template</span>
                  </button>
                </div>
              </div>

              {/* Upload Card / Slot */}
              {consolidatedPurchasesFile ? (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-amber-300 rounded-lg shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <span>{consolidatedPurchasesFile.fileName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded-full font-medium">
                          {consolidatedPurchasesFile.rowCount} row(s)
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-3 mt-0.5">
                        <span>Gross: {formatPHP(consolidatedPurchasesFile.totals.grossAmount)}</span>
                        <span>•</span>
                        <span>Taxable: {formatPHP(consolidatedPurchasesFile.totals.taxableAmount)}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-700">
                          Input Tax: {formatPHP(consolidatedPurchasesFile.totals.taxAmount)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      onClick={() => setPreviewFile(consolidatedPurchasesFile)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
                      title="View transaction rows"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      <span>View</span>
                    </button>
                    <button
                      onClick={() => triggerFileUpload('purchases', 'consolidated')}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 rounded-md transition-colors"
                      title="Replace file"
                    >
                      <Upload className="w-3.5 h-3.5 text-violet-600" />
                      <span>Re-upload</span>
                    </button>
                    <button
                      onClick={() => handleRemoveFile('purchases', 'consolidated')}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors"
                      title="Delete uploaded file so you can upload again"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => triggerFileUpload('purchases', 'consolidated')}
                  className="border-2 border-dashed border-amber-300 hover:border-amber-400 bg-white/60 hover:bg-white rounded-lg p-4 text-center cursor-pointer transition-colors"
                >
                  <Upload className="w-5 h-5 mx-auto text-amber-600 mb-1" />
                  <div className="text-xs font-semibold text-slate-800">
                    Upload Consolidated Purchases Excel (.xlsx)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Click to browse or drag and drop file adhering to BIR SLSP layout (A1: Purchases - {quarter} - Consolidated)
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Branch Tabs Header (Only displayed when client has branches) */}
          {hasBranches && (
            <div className="border-b border-slate-200 pb-2">
              <div className="flex items-center gap-1.5">
                {/* Scroll Left Button */}
                <button
                  type="button"
                  id="scroll-branch-tabs-left-btn"
                  onClick={() => scrollTabs('left')}
                  disabled={!canScrollLeft}
                  className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                    canScrollLeft
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                  }`}
                  title="Scroll branch tabs left"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Horizontally Scrollable Tabs Track */}
                <div
                  ref={tabsContainerRef}
                  onScroll={checkScrollState}
                  onWheel={(e) => {
                    if (tabsContainerRef.current) {
                      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                        tabsContainerRef.current.scrollLeft += e.deltaY;
                      }
                    }
                  }}
                  className="flex items-center gap-2 overflow-x-auto py-1 px-1 scroll-smooth flex-1 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
                  style={{ scrollbarWidth: 'thin' }}
                >
                  {branches.map((b) => {
                    const isActive = b.id === activeBranchId;
                    const salesCount = [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].filter(Boolean).length;
                    const purchasesCount = purchasesMode === 'per-branch'
                      ? [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].filter(Boolean).length
                      : 0;

                    return (
                      <div key={b.id} data-branch-id={b.id} className="relative flex items-center group shrink-0">
                        {editingBranchId === b.id ? (
                          <div className="flex items-center gap-1 bg-white px-2 py-1 border border-violet-500 rounded-lg shadow-xs">
                            <input
                              type="text"
                              value={editingBranchName}
                              onChange={(e) => setEditingBranchName(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(b.id)}
                              className="text-xs font-semibold text-slate-800 focus:outline-none w-36"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(b.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                              title="Save branch name"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => setEditingBranchId(null)}
                              className="p-1 text-slate-400 hover:bg-slate-100 rounded"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center">
                            <button
                              onClick={() => setActiveBranchId(b.id)}
                              onDoubleClick={() => {
                                setEditingBranchId(b.id);
                                setEditingBranchName(b.name);
                              }}
                              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                                isActive
                                  ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600 shadow-2xs'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                              }`}
                              title="Click to switch active branch; Double click to rename"
                            >
                              <Building className="w-3.5 h-3.5" />
                              <span>{b.name}</span>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                  salesCount === 3
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-200/70 text-slate-600'
                                }`}
                              >
                                {salesCount}/3 Sales
                                {purchasesMode === 'per-branch' ? ` • ${purchasesCount}/3 Purch` : ''}
                              </span>
                            </button>

                            {/* Delete Branch button on tab (if more than 1 branch) */}
                            {branches.length > 1 && (
                              <button
                                type="button"
                                id={`delete-branch-tab-btn-${b.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveBranch(b.id);
                                }}
                                className="ml-1 p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title={`Delete branch "${b.name}"`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Scroll Right Button */}
                <button
                  type="button"
                  id="scroll-branch-tabs-right-btn"
                  onClick={() => scrollTabs('right')}
                  disabled={!canScrollRight}
                  className={`p-1.5 rounded-lg border transition-all shrink-0 ${
                    canScrollRight
                      ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-2xs cursor-pointer'
                      : 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-40'
                  }`}
                  title="Scroll branch tabs right"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Active Branch Content & Name Editor */}
          <div className="space-y-6">
            {/* Editable Branch Name & Controls Header */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1 max-w-xl">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor={`branch-name-${activeBranch.id}`}
                    className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <Building className="w-3.5 h-3.5 text-violet-600" />
                    <span>{hasBranches ? 'Branch / Line of Business Name:' : 'Line of Business / Unit Name:'}</span>
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    id={`branch-name-${activeBranch.id}`}
                    value={activeBranch.name}
                    onChange={(e) => handleUpdateBranchName(activeBranch.id, e.target.value)}
                    placeholder="Enter branch or line of business name..."
                    className="w-full px-3 py-1.5 text-sm font-semibold text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:outline-hidden transition-all shadow-2xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap self-start md:self-center">
                {/* Delete Active Branch button */}
                {hasBranches && (
                  <button
                    type="button"
                    id={`delete-active-branch-btn-${activeBranch.id}`}
                    onClick={() => handleRemoveBranch(activeBranch.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors shadow-2xs cursor-pointer"
                    title={`Delete "${activeBranch.name}" and remove all its uploaded files`}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                    <span>Delete Branch</span>
                  </button>
                )}

                {/* Batch Download Templates for this branch */}
                <button
                  id={`download-all-sales-templates-${activeBranch.id}`}
                  onClick={() => {
                    monthList.forEach((m) => {
                      handleDownloadTemplate('Sales', m.index, activeBranch.name);
                    });
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg shadow-2xs transition-colors"
                  title="Download all 3 monthly Sales Excel templates for this branch"
                >
                  <Download className="w-3.5 h-3.5 text-violet-600" />
                  <span>Download 3 Sales Templates</span>
                </button>
              </div>
            </div>

            {/* Sales Upload Slots: 3 Months */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-600 inline-block" />
                  Sales Excel Uploads (1st, 2nd, and 3rd Month of {quarter})
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {monthList.map((m) => {
                  const monthKey = m.index === 1 ? 'month1' : m.index === 2 ? 'month2' : 'month3';
                  const uploadedFile = activeBranch.salesFiles[monthKey];

                  return (
                    <div
                      key={m.index}
                      className={`p-4 rounded-xl border transition-all ${
                        uploadedFile
                          ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            {m.label}
                          </span>
                          <h5 className="text-xs font-bold text-slate-900">{m.name}</h5>
                        </div>

                        <button
                          onClick={() => handleDownloadTemplate('Sales', m.index, activeBranch.name)}
                          className="flex items-center gap-1 text-[11px] font-medium text-violet-600 hover:text-violet-800 hover:underline"
                          title={`Download template for Sales - ${quarter} - ${m.label}`}
                        >
                          <Download className="w-3 h-3" />
                          <span>Template</span>
                        </button>
                      </div>

                      {uploadedFile ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-emerald-800 truncate max-w-[160px]" title={uploadedFile.fileName}>
                              {uploadedFile.fileName}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full font-mono">
                              {uploadedFile.rowCount} rows
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-emerald-200 text-[11px] space-y-1">
                            <div className="flex justify-between text-slate-600">
                              <span>Gross Sales:</span>
                              <span className="font-mono font-medium">{formatPHP(uploadedFile.totals.grossAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-600">
                              <span>Taxable (12%):</span>
                              <span className="font-mono font-medium">{formatPHP(uploadedFile.totals.taxableAmount)}</span>
                            </div>
                            <div className="flex justify-between text-slate-900 font-semibold border-t border-slate-100 pt-1">
                              <span>Output Tax:</span>
                              <span className="font-mono text-emerald-700">{formatPHP(uploadedFile.totals.taxAmount)}</span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <button
                              onClick={() => setPreviewFile(uploadedFile)}
                              className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1"
                              title="View file preview"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Data</span>
                            </button>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => triggerFileUpload('sales', m.index, activeBranch.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-violet-700 bg-violet-50 hover:bg-violet-100 px-2 py-0.5 rounded border border-violet-200 transition-colors"
                                title="Re-upload replacement Sales Excel file"
                              >
                                <Upload className="w-3 h-3" />
                                <span>Re-upload</span>
                              </button>
                              <button
                                onClick={() => handleRemoveFile('sales', m.index, activeBranch.id)}
                                className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                                title="Delete uploaded file so you can upload again"
                              >
                                <Trash2 className="w-3 h-3 text-rose-600" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={() => triggerFileUpload('sales', m.index, activeBranch.id)}
                          className="border border-dashed border-slate-300 hover:border-violet-500 rounded-lg p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-violet-50/30 transition-colors"
                        >
                          <Upload className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                          <div className="text-xs font-medium text-slate-700">
                            Upload Month {m.index} Sales
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Sales - {quarter} - {m.label} (.xlsx)
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Purchases Upload Slots (Only shown if Purchases Mode is Per-Branch) */}
            {purchasesMode === 'per-branch' && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                    Purchases Excel Uploads for {activeBranch.name} (1st, 2nd, and 3rd Month)
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {monthList.map((m) => {
                    const monthKey = m.index === 1 ? 'month1' : m.index === 2 ? 'month2' : 'month3';
                    const uploadedFile = activeBranch.purchasesFiles?.[monthKey];

                    return (
                      <div
                        key={m.index}
                        className={`p-4 rounded-xl border transition-all ${
                          uploadedFile
                            ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                              {m.label} Purchases
                            </span>
                            <h5 className="text-xs font-bold text-slate-900">{m.name}</h5>
                          </div>

                          <button
                            onClick={() => handleDownloadTemplate('Purchases', m.index, activeBranch.name)}
                            className="flex items-center gap-1 text-[11px] font-medium text-amber-700 hover:underline"
                            title={`Download template for Purchases - ${quarter} - ${m.label}`}
                          >
                            <Download className="w-3 h-3" />
                            <span>Template</span>
                          </button>
                        </div>

                        {uploadedFile ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-amber-900 truncate max-w-[160px]" title={uploadedFile.fileName}>
                                {uploadedFile.fileName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full font-mono">
                                {uploadedFile.rowCount} rows
                              </span>
                            </div>

                            <div className="bg-white p-2 rounded-lg border border-amber-200 text-[11px] space-y-1">
                              <div className="flex justify-between text-slate-600">
                                <span>Gross Purchases:</span>
                                <span className="font-mono font-medium">{formatPHP(uploadedFile.totals.grossAmount)}</span>
                              </div>
                              <div className="flex justify-between text-slate-600">
                                <span>Goods / Services:</span>
                                <span className="font-mono font-medium">
                                  {formatPHP(uploadedFile.totals.goodsOtherThanCapitalAmount + uploadedFile.totals.servicesAmount)}
                                </span>
                              </div>
                              <div className="flex justify-between text-slate-900 font-semibold border-t border-slate-100 pt-1">
                                <span>Input Tax:</span>
                                <span className="font-mono text-amber-700">{formatPHP(uploadedFile.totals.taxAmount)}</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-1">
                              <button
                                onClick={() => setPreviewFile(uploadedFile)}
                                className="text-[11px] text-slate-600 hover:text-slate-900 flex items-center gap-1"
                                title="View file preview"
                              >
                                <Eye className="w-3 h-3" />
                                <span>View Data</span>
                              </button>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => triggerFileUpload('purchases', m.index, activeBranch.id)}
                                  className="flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors"
                                  title="Re-upload replacement Purchases Excel file"
                                >
                                  <Upload className="w-3 h-3" />
                                  <span>Re-upload</span>
                                </button>
                                <button
                                  onClick={() => handleRemoveFile('purchases', m.index, activeBranch.id)}
                                  className="flex items-center gap-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-0.5 rounded border border-rose-200 transition-colors"
                                  title="Delete uploaded file so you can upload again"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => triggerFileUpload('purchases', m.index, activeBranch.id)}
                            className="border border-dashed border-slate-300 hover:border-amber-500 rounded-lg p-4 text-center cursor-pointer bg-slate-50/50 hover:bg-amber-50/30 transition-colors"
                          >
                            <Upload className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                            <div className="text-xs font-medium text-slate-700">
                              Upload Month {m.index} Purchases
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Purchases - {quarter} - {m.label} (.xlsx)
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Consolidated Rollup Summary Table */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Table className="w-4 h-4 text-violet-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                  Multi-Branch Aggregation Summary ({quarter} {year})
                </h4>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  id="download-pdf-summary-btn"
                  onClick={handleExportPdf}
                  disabled={isExportingPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-700 hover:bg-violet-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                  title="Download landscape PDF containing Multi-Branch Aggregation Summary, Schedules 1 to 3, and Form 2550Q VAT Summary"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download PDF Summary (Landscape)</span>
                    </>
                  )}
                </button>

                <div className="text-xs text-slate-500 hidden md:flex items-center gap-1">
                  <span>← Scroll horizontally to view all columns →</span>
                </div>
              </div>
            </div>

            {/* Horizontally scrollable aggregation table container */}
            <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
              <table className="min-w-[1100px] w-full text-left text-xs border-collapse">
                <thead>
                  {/* Category Header Row */}
                  <tr className="border-b border-slate-200">
                    <th
                      rowSpan={2}
                      className="py-3 px-3.5 bg-slate-100 text-slate-800 font-bold border-r border-slate-200 w-52 sticky left-0 z-10"
                    >
                      Branch / Line of Business
                    </th>
                    <th
                      colSpan={4}
                      className="py-2 px-3 text-center bg-violet-100/90 text-violet-950 font-bold border-r border-violet-200"
                    >
                      SALES
                    </th>
                    <th
                      colSpan={4}
                      className="py-2 px-3 text-center bg-amber-100/90 text-amber-950 font-bold border-r border-amber-200"
                    >
                      PURCHASES
                    </th>
                    <th
                      rowSpan={2}
                      className="py-3 px-3.5 text-right bg-slate-100 text-slate-800 font-bold w-36"
                    >
                      Net VAT Due / (Payable)
                    </th>
                  </tr>

                  {/* Individual Column Sub-headers */}
                  <tr className="bg-slate-50 text-[11px] text-slate-700 font-semibold border-b border-slate-200">
                    {/* Sales Columns */}
                    <th className="py-2 px-2.5 text-right bg-violet-50/60 font-semibold border-r border-slate-200">
                      <span>Exempt Sales</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-violet-50/60 font-semibold border-r border-slate-200">
                      <span>Zero-Rated Sales</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-violet-50/60 font-semibold border-r border-slate-200">
                      <span>Taxable (Excl. VAT)</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-violet-100/50 font-bold text-violet-900 border-r border-violet-200">
                      <span>Output Tax (VAT)</span>
                    </th>

                    {/* Purchases Columns */}
                    <th className="py-2 px-2.5 text-right bg-amber-50/60 font-semibold border-r border-slate-200">
                      <span>Exempt Purchases</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-50/60 font-semibold border-r border-slate-200">
                      <span>Zero-Rated Purch.</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-50/60 font-semibold border-r border-slate-200">
                      <span>Taxable (Excl. VAT)</span>
                    </th>
                    <th className="py-2 px-2.5 text-right bg-amber-100/50 font-bold text-amber-900 border-r border-amber-200">
                      <span>Input Tax (VAT)</span>
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {branches.map((b) => {
                    // Branch Sales Totals (Sum of Months 1, 2, 3)
                    const sFiles = [b.salesFiles.month1, b.salesFiles.month2, b.salesFiles.month3].filter(Boolean);
                    const bSalesF = sFiles.reduce((acc, f) => acc + (f?.totals.exemptAmount || 0), 0);
                    const bSalesG = sFiles.reduce((acc, f) => acc + (f?.totals.zeroRatedAmount || 0), 0);
                    const bSalesH = sFiles.reduce((acc, f) => acc + (f?.totals.taxableAmount || 0), 0);
                    const bSalesL = isVat
                      ? sFiles.reduce((acc, f) => acc + (f?.totals.taxAmount || 0), 0)
                      : (bSalesF + bSalesG + bSalesH) * 0.03;

                    // Branch Purchases Totals (if per-branch)
                    const pFiles = purchasesMode === 'per-branch'
                      ? [b.purchasesFiles?.month1, b.purchasesFiles?.month2, b.purchasesFiles?.month3].filter(Boolean)
                      : [];
                    const bPurchF = pFiles.reduce((acc, f) => acc + (f?.totals.exemptAmount || 0), 0);
                    const bPurchG = pFiles.reduce((acc, f) => acc + (f?.totals.zeroRatedAmount || 0), 0);
                    const bPurchH = pFiles.reduce((acc, f) => acc + (f?.totals.taxableAmount || 0), 0);
                    const bPurchL = pFiles.reduce((acc, f) => acc + (f?.totals.taxAmount || 0), 0);

                    const branchNetVat = bSalesL - bPurchL;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                        {/* Branch Name */}
                        <td className="py-2 px-3.5 font-medium text-slate-900 flex items-center gap-1.5 border-r border-slate-200 sticky left-0 bg-white z-10">
                          <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{b.name}</span>
                        </td>

                        {/* Sales Columns */}
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {formatPHP(bSalesF)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {formatPHP(bSalesG)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">
                          {formatPHP(bSalesH)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-violet-700 bg-violet-50/30 border-r border-violet-200">
                          {formatPHP(bSalesL)}
                        </td>

                        {/* Purchases Columns */}
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchF) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-600 border-r border-slate-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchG) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchH) : '—'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-amber-700 bg-amber-50/30 border-r border-amber-200">
                          {purchasesMode === 'per-branch' ? formatPHP(bPurchL) : '—'}
                        </td>

                        {/* Net VAT */}
                        <td className="py-2 px-3.5 text-right font-mono font-semibold text-slate-900">
                          {purchasesMode === 'per-branch' ? formatPHP(branchNetVat) : formatPHP(bSalesL)}
                        </td>
                      </tr>
                    );
                  })}

                  {/* If Consolidated Purchases is active, show consolidated purchases row */}
                  {purchasesMode === 'consolidated' && (
                    <tr className="bg-amber-50/40">
                      <td className="py-2.5 px-3.5 font-medium text-amber-950 flex items-center gap-1.5 italic border-r border-amber-200 sticky left-0 bg-amber-50/40 z-10">
                        <span>📦 Consolidated Purchases (All Branches)</span>
                      </td>

                      {/* Sales cols blank for consolidated purchases */}
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-slate-200">—</td>
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-slate-200">—</td>
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-slate-200">—</td>
                      <td className="py-2 px-2.5 text-right text-slate-400 border-r border-violet-200">—</td>

                      {/* Purchases cols */}
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {formatPHP(aggregatedTotals.purchasesColF)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono text-slate-700 border-r border-slate-200">
                        {formatPHP(aggregatedTotals.purchasesColG)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-medium text-slate-900 border-r border-slate-200">
                        {formatPHP(aggregatedTotals.purchasesColH)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono font-bold text-amber-800 bg-amber-100/40 border-r border-amber-200">
                        {formatPHP(aggregatedTotals.purchasesColL)}
                      </td>

                      {/* Net Effect */}
                      <td className="py-2 px-3.5 text-right font-mono font-semibold text-amber-900">
                        -{formatPHP(aggregatedTotals.purchasesColL)}
                      </td>
                    </tr>
                  )}

                  {/* Grand Total Row */}
                  <tr className="bg-slate-900 text-white font-bold">
                    <td className="py-3 px-3.5 uppercase tracking-wider text-xs border-r border-slate-800 sticky left-0 bg-slate-900 z-10">
                      Grand Total
                    </td>

                    {/* Sales Column F */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(aggregatedTotals.salesColF)}
                    </td>

                    {/* Sales Column G */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(aggregatedTotals.salesColG)}
                    </td>

                    {/* Sales Column H */}
                    <td className="py-3 px-2.5 text-right font-mono text-white text-sm border-r border-slate-800">
                      {formatPHP(aggregatedTotals.salesColH)}
                    </td>

                    {/* Sales Column L (Output VAT) */}
                    <td className="py-3 px-2.5 text-right font-mono text-violet-300 text-sm bg-violet-950/60 border-r border-violet-800">
                      {formatPHP(aggregatedTotals.salesColL)}
                    </td>

                    {/* Purchases Column F */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(aggregatedTotals.purchasesColF)}
                    </td>

                    {/* Purchases Column G */}
                    <td className="py-3 px-2.5 text-right font-mono text-slate-300 border-r border-slate-800">
                      {formatPHP(aggregatedTotals.purchasesColG)}
                    </td>

                    {/* Purchases Column H */}
                    <td className="py-3 px-2.5 text-right font-mono text-white text-sm border-r border-slate-800">
                      {formatPHP(aggregatedTotals.purchasesColH)}
                    </td>

                    {/* Purchases Column L (Input VAT) */}
                    <td className="py-3 px-2.5 text-right font-mono text-amber-300 text-sm bg-amber-950/60 border-r border-amber-800">
                      {formatPHP(aggregatedTotals.purchasesColL)}
                    </td>

                    {/* Net VAT Payable */}
                    <td className="py-3 px-3.5 text-right font-mono text-emerald-400 text-sm">
                      {formatPHP(aggregatedTotals.netVatPayable)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Details Modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-violet-600 text-white">
                    {previewFile.fileType.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-300 font-mono">
                    {previewFile.fileName}
                  </span>
                </div>
                <h4 className="text-sm font-semibold mt-1">
                  BIR SLSP Sheet Preview ({previewFile.rowCount} record(s))
                </h4>
              </div>

              <button
                onClick={() => setPreviewFile(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Header TIN:</span>
                <span className="font-mono font-medium text-slate-900">{previewFile.tinHeader || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Owner Name:</span>
                <span className="font-medium text-slate-900 truncate block">{previewFile.ownerNameHeader || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Gross:</span>
                <span className="font-mono font-bold text-slate-900">{formatPHP(previewFile.totals.grossAmount)}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Total Tax:</span>
                <span className="font-mono font-bold text-violet-700">{formatPHP(previewFile.totals.taxAmount)}</span>
              </div>
            </div>

            <div className="p-4 overflow-auto flex-1">
              {previewFile.transactions && previewFile.transactions.length > 0 ? (
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <th className="py-2 px-2">Row</th>
                      <th className="py-2 px-2">Month</th>
                      <th className="py-2 px-2">TIN</th>
                      <th className="py-2 px-3">Registered Name</th>
                      <th className="py-2 px-3">Address</th>
                      <th className="py-2 px-2 text-right">Gross</th>
                      <th className="py-2 px-2 text-right">Taxable</th>
                      <th className="py-2 px-2 text-right">Tax</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {previewFile.transactions.map((t, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-1.5 px-2 text-slate-400">{t.rowNum}</td>
                        <td className="py-1.5 px-2 text-slate-600">{t.taxableMonth || '—'}</td>
                        <td className="py-1.5 px-2 text-slate-800">{t.tin || '—'}</td>
                        <td className="py-1.5 px-3 font-sans text-slate-900 truncate max-w-[150px]">{t.registeredName}</td>
                        <td className="py-1.5 px-3 font-sans text-slate-600 truncate max-w-[150px]">{t.address}</td>
                        <td className="py-1.5 px-2 text-right text-slate-800">{formatPHP(t.grossAmount)}</td>
                        <td className="py-1.5 px-2 text-right text-slate-800">{formatPHP(t.taxableAmount)}</td>
                        <td className="py-1.5 px-2 text-right font-bold text-violet-700">{formatPHP(t.taxAmount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs">
                  No individual line items entered. Summary totals were read directly from Report Summary Row 1999.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setPreviewFile(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Branch In-App Confirmation Modal */}
      {branchToDelete && (
        <div
          id="delete-branch-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
          onClick={() => setBranchToDelete(null)}
        >
          <div
            id="delete-branch-modal"
            className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-rose-800">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-950">Delete Branch</h3>
                  <p className="text-[11px] text-rose-700">{quarter} {year} Schedule</p>
                </div>
              </div>
              <button
                type="button"
                id="close-delete-branch-modal-btn"
                onClick={() => setBranchToDelete(null)}
                className="p-1 rounded-md text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                  <Building className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase text-slate-500 block">Branch to Delete</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">{branchToDelete.name}</span>
                </div>
              </div>

              {branches.length > 1 ? (
                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    Are you sure you want to delete this branch? This action will permanently remove{' '}
                    <strong className="text-slate-900">{branchToDelete.name}</strong> and all of its uploaded monthly Sales and Purchases files.
                  </p>
                  {(() => {
                    const salesCount = Object.keys(branchToDelete.salesFiles || {}).length;
                    const purchCount = Object.keys(branchToDelete.purchasesFiles || {}).length;
                    if (salesCount > 0 || purchCount > 0) {
                      return (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                          <span>
                            Warning: <strong>{salesCount} Sales</strong> {purchasesMode === 'per-branch' ? `and ${purchCount} Purchases ` : ''}file(s) associated with this branch will be permanently removed.
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              ) : (
                <div className="text-xs text-slate-600 space-y-2">
                  <p>
                    This is currently the <strong>only branch</strong> in this quarterly schedule. Deleting it will clear all uploaded monthly Sales and Purchases files and reset this branch to a clean blank state.
                  </p>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                    <span>All uploaded records for this branch will be cleared.</span>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                id="cancel-delete-branch-btn"
                onClick={() => setBranchToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-delete-branch-btn"
                onClick={handleConfirmDeleteBranch}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{branches.length > 1 ? 'Delete Branch' : 'Delete & Reset Branch'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
