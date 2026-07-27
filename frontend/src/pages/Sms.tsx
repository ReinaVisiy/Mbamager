import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Search,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCcw,
  Trash2,
  Play,
  Filter,
  Calendar,
  ChevronRight,
  Copy,
  FileText,
  Check,
  Sparkles,
  ListFilter,
  ArrowUpDown,
  Send,
  Plus,
  ShieldAlert
} from 'lucide-react';

import { PageHeader } from '../components/common/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { smsService, parseSmsClient, SMSMessage, SMSImportRequest, ParsedSms } from '../services/sms';
import { scamService, ScamAnalysisResponse } from '../services/scam';
import { formatXAF, formatDate } from '../utils/format';

// Core preset SMS messages for Cameroon unbanked / underbanked operations
const PRESET_TEMPLATES = [
  {
    label: 'MTN Credit (Inflow)',
    sender: 'MTN_MoMo',
    body: 'Received 50000 XAF on 2026-07-19. Fee: 100 XAF. Ref: MTN1234567'
  },
  {
    label: 'MTN Debit (Outflow)',
    sender: 'MTN_MoMo',
    body: 'Sent 25000 XAF on 2026-07-19. Fee: 150 XAF. Ref: MTN7654321'
  },
  {
    label: 'Orange Credit (Inflow)',
    sender: 'OrangeMoney',
    body: 'Received 10000 XAF. Fee: 50 XAF. Ref: ORG987654'
  },
  {
    label: 'Orange Debit (Outflow)',
    sender: 'OrangeMoney',
    body: 'Sent 1500 XAF. Fee: 10 XAF. Ref: ORG456789'
  },
  {
    label: 'Cash Deposit',
    sender: 'Cash',
    body: 'Cash Deposit of 5000 XAF. Fee: 0 XAF. Ref: CSH332211'
  },
  {
    label: 'Cash Withdrawal',
    sender: 'Cash',
    body: 'Cash Withdrawal of 12000 XAF. Fee: 200 XAF. Ref: CSH556677'
  },
  {
    label: 'Bank Credit',
    sender: 'Bank',
    body: 'Bank Credit of 75000 XAF. Fee: 500 XAF. Ref: BNK112233'
  },
  {
    label: 'Bank Debit',
    sender: 'Bank',
    body: 'Bank Debit of 3000 XAF. Fee: 30 XAF. Ref: BNK445566'
  }
];

export default function Sms() {
  const queryClient = useQueryClient();
  
  // UI Tabs / Filters
  const [activeTab, setActiveTab] = React.useState<'import' | 'unprocessed'>('import');
  const [importMode, setImportMode] = React.useState<'single' | 'batch'>('single');
  
  // Filters state for unprocessed messages
  const [statusFilter, setStatusFilter] = React.useState<'unprocessed' | 'processed'>('unprocessed');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [providerFilter, setProviderFilter] = React.useState<'ALL' | 'MTN_MOMO' | 'ORANGE_MONEY' | 'CASH' | 'BANK' | 'UNPARSED'>('ALL');
  const [sortOrder, setSortOrder] = React.useState<'newest' | 'oldest'>('newest');

  // Single Import Inputs
  const [senderType, setSenderType] = React.useState<string>('MTN_MoMo');
  const [customSender, setCustomSender] = React.useState<string>('');
  const [singleBody, setSingleBody] = React.useState<string>('');
  
  // Batch Import Inputs
  const [batchBody, setBatchBody] = React.useState<string>('');

  // Local Session processed list (since we only have /unprocessed in the backend)
  const [sessionProcessed, setSessionProcessed] = React.useState<SMSMessage[]>([]);
  
  // Transaction Results display for single import
  const [lastSingleImportResult, setLastSingleImportResult] = React.useState<{
    sms: SMSMessage;
    parsed: ParsedSms | null;
    success: boolean;
    errorMsg?: string;
  } | null>(null);

  // Batch Results display
  const [lastBatchImportResult, setLastBatchImportResult] = React.useState<{
    successCount: number;
    duplicateCount: number;
    failedCount: number;
    messages: { body: string; processed: boolean; ref?: string; error?: string }[];
  } | null>(null);

  // Computed final sender value for single import
  const finalSender = senderType === 'CUSTOM' ? customSender : senderType;

  // React Query for Unprocessed SMS list
  const {
    data: unprocessedSms,
    isLoading: isUnprocessedLoading,
    isError: isUnprocessedError,
    refetch: refetchUnprocessed
  } = useQuery({
    queryKey: ['unprocessedSms'],
    queryFn: () => smsService.getUnprocessed(),
    refetchInterval: 10000, // Auto-refresh list every 10s as requested
  });

  // MUTATIONS
  // 1. Single SMS Import
  const singleImportMutation = useMutation({
    mutationFn: (payload: SMSImportRequest) => smsService.importSingle(payload),
    onSuccess: (sms) => {
      // Parse client-side to display parsed details
      const parsed = parseSmsClient(sms.message_body, sms.sender);
      setLastSingleImportResult({
        sms,
        parsed,
        success: true
      });
      
      // If it parsed successfully, it created a transaction (unless duplicate)
      if (sms.processed) {
        setSessionProcessed((prev) => [sms, ...prev]);
      }
      
      // Clear inputs
      setSingleBody('');
      setCustomSender('');
      setScamResult(null);
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['unprocessedSms'] });
    },
    onError: (error: any) => {
      // Find what the error is
      setLastSingleImportResult({
        sms: {
          id: 0,
          user_id: 0,
          sender: finalSender,
          message_body: singleBody,
          received_at: new Date().toISOString(),
          processed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        parsed: parseSmsClient(singleBody, finalSender),
        success: false,
        errorMsg: error.message || 'Verification Failed: Please verify active account setup for this provider.'
      });
    }
  });

  // 2. Batch SMS Import
  const batchImportMutation = useMutation({
    mutationFn: (payload: SMSImportRequest[]) => smsService.importBatch(payload),
    onSuccess: (smsList) => {
      let successCount = 0;
      let duplicateCount = 0;
      let failedCount = 0;
      const detailsList: any[] = [];

      smsList.forEach(sms => {
        const parsed = parseSmsClient(sms.message_body, sms.sender);
        if (sms.processed) {
          successCount++;
          setSessionProcessed((prev) => [sms, ...prev]);
          detailsList.push({
            body: sms.message_body,
            processed: true,
            ref: parsed?.ref || 'N/A'
          });
        } else {
          // Unprocessed but stored
          failedCount++;
          detailsList.push({
            body: sms.message_body,
            processed: false,
            error: 'No active account matching this provider'
          });
        }
      });

      setLastBatchImportResult({
        successCount,
        duplicateCount,
        failedCount,
        messages: detailsList
      });

      // Clear batch input
      setBatchBody('');

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['unprocessedSms'] });
    },
    onError: (error: any) => {
      setLastBatchImportResult({
        successCount: 0,
        duplicateCount: 0,
        failedCount: 1,
        messages: [{
          body: 'Batch Processing Error',
          processed: false,
          error: error.message || 'Batch failed. Check if all providers have active accounts registered.'
        }]
      });
    }
  });

  // 3. Manual Process Stored SMS
  const manualProcessMutation = useMutation({
    mutationFn: (id: number) => smsService.processStored(id),
    onSuccess: (sms) => {
      // Successfully processed, remove from unprocessed and add to sessionProcessed
      setSessionProcessed((prev) => [sms, ...prev]);
      queryClient.invalidateQueries({ queryKey: ['unprocessedSms'] });
    },
    onError: (error: any, id: number) => {
      alert(`Manual extraction failed for SMS #${id}: ${error.message || 'Missing active account'}`);
    }
  });

  // 4. Scam Sentinel: check the currently-typed single-import message for fraud risk
  const [scamResult, setScamResult] = React.useState<ScamAnalysisResponse | null>(null);
  const scamCheckMutation = useMutation({
    mutationFn: () => scamService.analyze({ text: singleBody, sender: finalSender }),
    onSuccess: (result) => setScamResult(result),
    onError: () => setScamResult(null),
  });

  // Live client-side parsing preview for single import text area
  const livePreview = React.useMemo(() => {
    if (!singleBody.trim()) return null;
    return parseSmsClient(singleBody, finalSender);
  }, [singleBody, finalSender]);

  // COMBINE & FILTER LOGICS
  // Unprocessed messages filtered
  const filteredUnprocessed = React.useMemo(() => {
    if (!unprocessedSms) return [];

    let list = [...unprocessedSms];

    // Filter by text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        item.message_body.toLowerCase().includes(q) ||
        item.sender.toLowerCase().includes(q)
      );
    }

    // Filter by provider
    if (providerFilter !== 'ALL') {
      list = list.filter(item => {
        const parsed = parseSmsClient(item.message_body, item.sender);
        if (providerFilter === 'UNPARSED') {
          return parsed === null;
        }
        return parsed?.provider === providerFilter;
      });
    }

    // Sort
    list.sort((a, b) => {
      const tA = new Date(a.received_at).getTime();
      const tB = new Date(b.received_at).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [unprocessedSms, searchQuery, providerFilter, sortOrder]);

  // Processed messages filtered
  const filteredProcessed = React.useMemo(() => {
    let list = [...sessionProcessed];

    // Filter by text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item =>
        item.message_body.toLowerCase().includes(q) ||
        item.sender.toLowerCase().includes(q)
      );
    }

    // Filter by provider
    if (providerFilter !== 'ALL') {
      list = list.filter(item => {
        const parsed = parseSmsClient(item.message_body, item.sender);
        if (providerFilter === 'UNPARSED') {
          return parsed === null;
        }
        return parsed?.provider === providerFilter;
      });
    }

    // Sort
    list.sort((a, b) => {
      const tA = new Date(a.received_at).getTime();
      const tB = new Date(b.received_at).getTime();
      return sortOrder === 'newest' ? tB - tA : tA - tB;
    });

    return list;
  }, [sessionProcessed, searchQuery, providerFilter, sortOrder]);

  // Handle single import submit
  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleBody.trim()) return;

    setLastSingleImportResult(null);
    setLastBatchImportResult(null);

    singleImportMutation.mutate({
      sender: finalSender,
      message_body: singleBody,
      received_at: new Date().toISOString()
    });
  };

  // Handle batch import submit
  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchBody.trim()) return;

    setLastSingleImportResult(null);
    setLastBatchImportResult(null);

    // Split messages by newlines
    const lines = batchBody.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (lines.length === 0) return;

    const payload: SMSImportRequest[] = lines.map(line => {
      // Attempt to infer sender
      let inferredSender = 'MTN_MoMo';
      const lUpper = line.toUpperCase();
      if (lUpper.includes('ORANGE')) {
        inferredSender = 'OrangeMoney';
      } else if (lUpper.includes('CASH')) {
        inferredSender = 'Cash';
      } else if (lUpper.includes('BANK')) {
        inferredSender = 'Bank';
      }

      return {
        sender: inferredSender,
        message_body: line,
        received_at: new Date().toISOString()
      };
    });

    batchImportMutation.mutate(payload);
  };

  const handleApplyPreset = (preset: typeof PRESET_TEMPLATES[0]) => {
    setSenderType(preset.sender);
    setSingleBody(preset.body);
    setLastSingleImportResult(null);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* HEADER SECTION */}
      <PageHeader
        title="Regional SMS Processing Center"
        description="Extract and automatically sync liquid transaction flows from MTN Mobile Money, Orange Money, Cash Desk, and regional banking SMS text buffers."
      />

      {/* CORE INTERACTIVE TABS */}
      <div className="flex border-b border-slate-900 pb-px">
        <button
          onClick={() => setActiveTab('import')}
          className={`pb-4 px-6 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'import'
              ? 'border-gold text-white'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <UploadCloud className="w-4 h-4" />
            SMS Extraction Sandbox
          </span>
        </button>
        <button
          onClick={() => setActiveTab('unprocessed')}
          className={`pb-4 px-6 text-xs font-mono font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer relative ${
            activeTab === 'unprocessed'
              ? 'border-gold text-white'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Unprocessed Message Queue
            {unprocessedSms && unprocessedSms.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-rose-500 text-[9px] font-mono font-bold text-white rounded-full">
                {unprocessedSms.length}
              </span>
            )}
          </span>
        </button>
      </div>

      {activeTab === 'import' ? (
        /* TAB 1: EXTRACTION SANDBOX */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* CONTROL FORM PANEL */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="border border-slate-900 bg-slate-950/40">
              <CardHeader className="border-b border-slate-900/40 flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-xs font-mono font-black text-slate-400 tracking-wider uppercase">
                    Import Method
                  </CardTitle>
                  <CardDescription className="text-[11px] text-slate-500">
                    Paste raw SMS notifications directly to trigger immediate ledger classification.
                  </CardDescription>
                </div>
                {/* Method selector */}
                <div className="flex bg-slate-950 border border-slate-900 rounded-xl p-1 shrink-0">
                  <button
                    onClick={() => { setImportMode('single'); setLastSingleImportResult(null); }}
                    className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg cursor-pointer ${
                      importMode === 'single' ? 'bg-slate-850 text-white border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Single Message
                  </button>
                  <button
                    onClick={() => { setImportMode('batch'); setLastBatchImportResult(null); }}
                    className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg cursor-pointer ${
                      importMode === 'batch' ? 'bg-slate-850 text-white border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    Batch List
                  </button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                
                {importMode === 'single' ? (
                  /* SINGLE IMPORT FORM */
                  <form onSubmit={handleSingleSubmit} className="space-y-4">
                    {/* SENDER SELECTOR */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                          SMS Origin Sender
                        </label>
                        <select
                          value={senderType}
                          onChange={(e) => {
                            setSenderType(e.target.value);
                            if (e.target.value !== 'CUSTOM') setCustomSender('');
                          }}
                          className="w-full h-10 px-3 bg-slate-950 border border-slate-900 text-xs font-medium text-slate-200 rounded-xl outline-none focus:border-slate-800"
                        >
                          <option value="MTN_MoMo">MTN Mobile Money (MTN_MoMo)</option>
                          <option value="OrangeMoney">Orange Money (OrangeMoney)</option>
                          <option value="Cash">Cash Counter (Cash)</option>
                          <option value="Bank">Commercial Bank (Bank)</option>
                          <option value="CUSTOM">Custom Address / Phone...</option>
                        </select>
                      </div>

                      {senderType === 'CUSTOM' && (
                        <div className="space-y-2 animate-fade-in">
                          <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                            Sender Number or Code
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. +237677000111 or SG-CAM"
                            value={customSender}
                            onChange={(e) => setCustomSender(e.target.value)}
                            className="w-full h-10 px-3 bg-slate-950 border border-slate-900 text-xs font-medium text-slate-200 rounded-xl outline-none focus:border-slate-800"
                          />
                        </div>
                      )}
                    </div>

                    {/* TEXTAREA INPUT */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                        Raw Message Text Content
                      </label>
                      <textarea
                        required
                        rows={5}
                        placeholder="Paste Cameroon SMS notification block here..."
                        value={singleBody}
                        onChange={(e) => {
                          setSingleBody(e.target.value);
                          setScamResult(null);
                        }}
                        className="w-full p-4 bg-slate-950 border border-slate-900 text-xs font-mono text-slate-200 rounded-2xl outline-none focus:border-slate-800 resize-none leading-relaxed"
                      />
                    </div>

                    {/* LIVE PARSING PREVIEW BADGE */}
                    {livePreview ? (
                      <div className="p-3.5 bg-emerald-500/5 border border-emerald-950/30 rounded-xl flex items-center justify-between text-[11px] text-emerald-400">
                        <span className="flex items-center gap-2 font-medium">
                          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                          Parsed Client Preview: Valid <span className="font-bold">{livePreview.provider.replace('_', ' ')}</span> Message
                        </span>
                        <span className="font-mono font-black">{formatXAF(livePreview.amount)} ({livePreview.direction})</span>
                      </div>
                    ) : singleBody.trim() ? (
                      <div className="p-3.5 bg-amber-500/5 border border-amber-950/30 rounded-xl flex items-center gap-2 text-[11px] text-amber-400 font-medium">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
                        Regex Mismatch Preview: SMS body will be marked unprocessed. You can manually classify it later.
                      </div>
                    ) : null}

                    {/* SCAM SENTINEL CHECK */}
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={scamCheckMutation.isPending || !singleBody.trim()}
                        onClick={() => scamCheckMutation.mutate()}
                        className="h-9 px-4 font-mono font-bold text-[11px] uppercase gap-2"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        {scamCheckMutation.isPending ? 'Checking...' : 'Check for Scams'}
                      </Button>

                      {scamResult ? (
                        <div
                          className={`p-3.5 rounded-xl border text-[11px] font-medium space-y-1.5 ${
                            scamResult.risk_level === 'HIGH'
                              ? 'bg-red-500/5 border-red-950/30 text-red-400'
                              : scamResult.risk_level === 'MEDIUM'
                              ? 'bg-amber-500/5 border-amber-950/30 text-amber-400'
                              : 'bg-emerald-500/5 border-emerald-950/30 text-emerald-400'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 shrink-0" />
                            <span className="font-bold uppercase tracking-wide">
                              {scamResult.risk_level} risk
                            </span>
                            <span className="font-mono opacity-70">
                              ({Math.round(scamResult.risk_score * 100)}%)
                            </span>
                          </div>
                          {scamResult.reasons.length > 0 && (
                            <ul className="list-disc list-inside space-y-0.5 opacity-90">
                              {scamResult.reasons.map((reason, i) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          )}
                          <p className="opacity-90">{scamResult.recommended_action}</p>
                        </div>
                      ) : null}
                    </div>

                    {/* SUBMIT */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={singleImportMutation.isPending || !singleBody.trim()}
                        className="h-10 px-6 font-mono font-bold text-xs uppercase"
                      >
                        {singleImportMutation.isPending ? 'Syncing Flow...' : 'Import SMS Log'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  /* BATCH IMPORT FORM */
                  <form onSubmit={handleBatchSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                        Batch Raw Logs (One SMS per line)
                      </label>
                      <textarea
                        required
                        rows={8}
                        placeholder="Paste multiple SMS notification records, separated by newlines..."
                        value={batchBody}
                        onChange={(e) => setBatchBody(e.target.value)}
                        className="w-full p-4 bg-slate-950 border border-slate-900 text-xs font-mono text-slate-200 rounded-2xl outline-none focus:border-slate-800 resize-none leading-relaxed"
                      />
                    </div>

                    <p className="text-[10px] text-slate-500 font-medium">
                      Note: The system will automatically classify each line into corresponding MTN, Orange, Cash, or Bank providers sequentially.
                    </p>

                    {/* SUBMIT */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="submit"
                        disabled={batchImportMutation.isPending || !batchBody.trim()}
                        className="h-10 px-6 font-mono font-bold text-xs uppercase"
                      >
                        {batchImportMutation.isPending ? 'Syncing Batch...' : 'Process Batch Logs'}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>

            {/* RESULTS VIEW */}
            {lastSingleImportResult && (
              <Card className={`border ${lastSingleImportResult.success ? 'border-emerald-950/30 bg-emerald-950/5' : 'border-rose-950/30 bg-rose-950/5'}`}>
                <CardHeader>
                  <CardTitle className="text-xs font-mono font-black tracking-wider flex items-center gap-2 uppercase">
                    {lastSingleImportResult.success ? (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <span className="text-emerald-400">Ledger Import Completed Successfully</span>
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-5 h-5 text-rose-400" />
                        <span className="text-rose-400">Import Refused / Validation Fail</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {lastSingleImportResult.success ? (
                    lastSingleImportResult.sms.processed && lastSingleImportResult.parsed ? (
                      /* SUCCESSFUL EXTRACTION */
                      <div className="space-y-4">
                        <p className="text-xs text-slate-300 font-medium">
                          The SMS notification was parsed successfully and a standard liquid transaction transaction has been registered automatically:
                        </p>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-950 border border-slate-900 p-4 rounded-xl font-mono text-xs">
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Provider</span>
                            <span className="text-slate-300 font-semibold">{lastSingleImportResult.parsed.provider.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Amount Flow</span>
                            <span className="text-emerald-400 font-bold">{formatXAF(lastSingleImportResult.parsed.amount)}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Direction</span>
                            <span className={`font-bold ${lastSingleImportResult.parsed.direction === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {lastSingleImportResult.parsed.direction}
                            </span>
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Fee Accrued</span>
                            <span className="text-slate-400 font-bold">{formatXAF(lastSingleImportResult.parsed.fee)}</span>
                          </div>
                        </div>

                        <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                          <span className="text-[9px] font-mono font-bold text-slate-500 uppercase block">Narrative Description</span>
                          <span className="text-xs text-slate-300 font-semibold">{lastSingleImportResult.parsed.narrative}</span>
                        </div>
                      </div>
                    ) : (
                      /* UNPROCESSED BUT SAVED */
                      <div className="space-y-2">
                        <p className="text-xs text-slate-300 font-semibold">
                          SMS Log successfully saved to Database, but could not be parsed automatically.
                        </p>
                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                          This happens when the SMS message layout does not match standard deterministic carrier structures. It is currently placed in your <span className="text-slate-300 font-semibold">Unprocessed Messages Queue</span> where you can manually evaluate or inspect it.
                        </p>
                      </div>
                    )
                  ) : (
                    /* ERROR CONTAINER */
                    <div className="space-y-3">
                      <p className="text-xs text-slate-300 font-semibold leading-relaxed">
                        {lastSingleImportResult.errorMsg}
                      </p>
                      
                      {lastSingleImportResult.parsed && (
                        <div className="p-4 bg-slate-950 border border-slate-900 rounded-2xl space-y-2.5">
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                            Pre-parser diagnostics
                          </p>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            The SMS pattern matches <span className="text-slate-300 font-semibold">{lastSingleImportResult.parsed.provider.replace('_', ' ')}</span> structure, but you do not have an active wallet configured for this provider in your Accounts ledger. 
                          </p>
                          <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5 pt-1">
                            <span>How to fix:</span>
                            <span className="text-slate-300 font-medium">Navigate to 'Accounts' and register an active MTN or Orange Money wallet.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {lastBatchImportResult && (
              <Card className="border border-slate-900 bg-slate-950/40">
                <CardHeader className="border-b border-slate-900/40">
                  <CardTitle className="text-xs font-mono font-black text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                    <FileText className="w-4 h-4 text-slate-400" />
                    Batch Run Summary Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center font-mono text-xs">
                    <div className="bg-emerald-500/5 border border-emerald-950/30 p-3 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Processed</span>
                      <span className="text-emerald-400 font-black text-base">{lastBatchImportResult.successCount}</span>
                    </div>
                    <div className="bg-slate-950 border border-slate-900 p-3 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Duplicates</span>
                      <span className="text-slate-400 font-black text-base">{lastBatchImportResult.duplicateCount}</span>
                    </div>
                    <div className="bg-rose-500/5 border border-rose-950/30 p-3 rounded-xl">
                      <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Unprocessed</span>
                      <span className="text-rose-400 font-black text-base">{lastBatchImportResult.failedCount}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                      Individual Results Log
                    </h4>
                    <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                      {lastBatchImportResult.messages.map((msg, idx) => (
                        <div key={idx} className="p-3 bg-slate-950 border border-slate-900 rounded-xl flex flex-col gap-1">
                          <span className="text-[10px] font-mono text-slate-300 font-semibold line-clamp-1">
                            {msg.body}
                          </span>
                          <div className="flex justify-between items-center text-[10px] pt-1">
                            <span className={`font-mono font-bold uppercase ${msg.processed ? 'text-emerald-400' : 'text-amber-500'}`}>
                              {msg.processed ? 'Integrated successfully' : 'Stored unprocessed'}
                            </span>
                            {msg.ref && <span className="font-mono text-slate-500">Ref: {msg.ref}</span>}
                            {msg.error && <span className="font-mono text-rose-400/80">{msg.error}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          </div>

          {/* SIDEBAR PRESETS / HISTORY CORES */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* PRESETS CONTAINER */}
            <Card className="border border-slate-900 bg-slate-950/40">
              <CardHeader className="pb-3 border-b border-slate-900/40">
                <CardTitle className="text-xs font-mono font-black text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  SMS Parsing Patterns
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Select a Cameroon mobile carrier preset flow to instantly inject mock inputs into the single sandbox field.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 pb-4">
                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                  {PRESET_TEMPLATES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className="w-full text-left p-3 bg-slate-950 border border-slate-900 rounded-xl hover:border-slate-800 transition-colors cursor-pointer group flex justify-between items-center"
                    >
                      <div>
                        <span className="text-[11px] font-bold text-slate-200 group-hover:text-white block">
                          {preset.label}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500 truncate block max-w-[190px]">
                          {preset.body}
                        </span>
                      </div>
                      <Plus className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* SESSION HISTORY PANEL */}
            <Card className="border border-slate-900 bg-slate-950/40">
              <CardHeader className="pb-3 border-b border-slate-900/40">
                <CardTitle className="text-xs font-mono font-black text-slate-400 tracking-wider flex items-center gap-2 uppercase">
                  <ListFilter className="w-4 h-4 text-slate-400" />
                  Session Import History
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500">
                  Logs representing message streams processed during this active tab connection.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                {sessionProcessed.length === 0 ? (
                  <div className="text-center py-8 text-slate-600 text-xs font-medium">
                    No transactions registered this session yet.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
                    {sessionProcessed.map((sms, idx) => {
                      const parsed = parseSmsClient(sms.message_body, sms.sender);
                      return (
                        <div key={idx} className="p-3 bg-slate-950 border border-slate-900 rounded-xl space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-slate-300">{sms.sender}</span>
                            <span className="text-slate-500">{formatDate(sms.received_at)}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate font-mono">
                            {sms.message_body}
                          </p>
                          {parsed && (
                            <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-900/50">
                              <span className="font-semibold text-emerald-400">Parsed: {parsed.provider.replace('_', ' ')}</span>
                              <span className="font-mono font-bold text-slate-300">{formatXAF(parsed.amount)}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>

        </div>
      ) : (
        /* TAB 2: UNPROCESSED MESSAGES QUEUE */
        <div className="space-y-6">
          
          {/* CONTROL BAR: SEARCH & FILTERS */}
          <Card className="border border-slate-900 bg-slate-950/40">
            <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
              
              {/* SUB-TABS (Processed vs Unprocessed) */}
              <div className="flex bg-slate-950 border border-slate-900 rounded-xl p-1 shrink-0 self-start md:self-auto">
                <button
                  onClick={() => setStatusFilter('unprocessed')}
                  className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'unprocessed' ? 'bg-slate-850 text-white border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Unprocessed Waiting
                  {unprocessedSms && unprocessedSms.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded-full font-mono font-black text-[9px]">
                      {unprocessedSms.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setStatusFilter('processed')}
                  className={`px-3 py-1.5 text-[10px] font-mono font-bold rounded-lg cursor-pointer flex items-center gap-1.5 ${
                    statusFilter === 'processed' ? 'bg-slate-850 text-white border border-slate-800' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Processed This Session
                  {sessionProcessed.length > 0 && (
                    <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-mono font-black text-[9px]">
                      {sessionProcessed.length}
                    </span>
                  )}
                </button>
              </div>

              {/* SEARCH & FILTERS GROUP */}
              <div className="flex-1 flex flex-wrap gap-3 items-center justify-end">
                {/* Search */}
                <div className="relative flex-1 max-w-[280px]">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search logs by keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-9 pl-9 pr-3 bg-slate-950 border border-slate-900 text-xs text-slate-200 rounded-xl outline-none focus:border-slate-800"
                  />
                </div>

                {/* Provider Selector */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    value={providerFilter}
                    onChange={(e: any) => setProviderFilter(e.target.value)}
                    className="h-9 px-2 bg-slate-950 border border-slate-900 text-xs font-medium text-slate-300 rounded-xl outline-none focus:border-slate-800"
                  >
                    <option value="ALL">All Providers</option>
                    <option value="MTN_MOMO">MTN MoMo</option>
                    <option value="ORANGE_MONEY">Orange Money</option>
                    <option value="CASH">Cash Desk</option>
                    <option value="BANK">Bank</option>
                    <option value="UNPARSED">Unrecognized</option>
                  </select>
                </div>

                {/* Sort Order */}
                <button
                  onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
                  className="h-9 px-3 bg-slate-950 border border-slate-900 text-xs font-mono font-bold text-slate-400 rounded-xl hover:border-slate-800 flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
                  {sortOrder === 'newest' ? 'Newest' : 'Oldest'}
                </button>

                {/* Manual Force Sync */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchUnprocessed()}
                  className="h-9 px-2.5 hover:border-slate-800/80 shrink-0"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${isUnprocessedLoading ? 'animate-spin text-emerald-400' : ''}`} />
                </Button>
              </div>

            </CardContent>
          </Card>

          {/* ACTIVE QUEUE LIST GRID */}
          {isUnprocessedLoading ? (
            /* SKELETON LOADERS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="h-44 animate-pulse bg-slate-900/40 border border-slate-900 rounded-2xl" />
              <Card className="h-44 animate-pulse bg-slate-900/40 border border-slate-900 rounded-2xl" />
              <Card className="h-44 animate-pulse bg-slate-900/40 border border-slate-900 rounded-2xl" />
            </div>
          ) : isUnprocessedError ? (
            /* FAILURE ERROR STATE */
            <ErrorState
              title="Failed to Sync SMS Queue"
              message="The system encountered database connection problems while fetching stored unprocessed notifications. Validate networking."
              onRetry={refetchUnprocessed}
            />
          ) : (
            statusFilter === 'unprocessed' ? (
              /* VIEW: UNPROCESSED messages */
              filteredUnprocessed.length === 0 ? (
                <EmptyState
                  icon={MessageSquare}
                  title="No SMS waiting to be processed"
                  description={
                    searchQuery || providerFilter !== 'ALL'
                      ? 'No pending logs found matching your query filters. Try adjusting keywords.'
                      : 'Excellent! All SMS logs have been successfully resolved, categorized, and recorded.'
                  }
                  actionText={searchQuery || providerFilter !== 'ALL' ? 'Clear Filters' : 'Import New Logs'}
                  onAction={() => {
                    if (searchQuery || providerFilter !== 'ALL') {
                      setSearchQuery('');
                      setProviderFilter('ALL');
                    } else {
                      setActiveTab('import');
                    }
                  }}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredUnprocessed.map((sms) => {
                    const parsed = parseSmsClient(sms.message_body, sms.sender);
                    const isManualProcessLoading = manualProcessMutation.isPending && manualProcessMutation.variables === sms.id;

                    return (
                      <Card key={sms.id} className="border border-slate-900 bg-slate-950/40 relative overflow-hidden flex flex-col justify-between">
                        {/* Status tag */}
                        <div className="absolute top-4 right-4 flex gap-1">
                          {parsed ? (
                            <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-950/40 text-emerald-400 font-mono font-bold text-[8.5px] rounded-lg tracking-wider uppercase">
                              Parseable Format
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-950/40 text-amber-400 font-mono font-bold text-[8.5px] rounded-lg tracking-wider uppercase">
                              Unrecognized
                            </span>
                          )}
                        </div>

                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-mono font-bold text-slate-300">
                            {sms.sender}
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            {formatDate(sms.received_at, true)}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                          {/* Body Text content */}
                          <div className="p-3 bg-slate-950 border border-slate-900/60 rounded-xl leading-relaxed font-mono text-[11px] text-slate-400 flex-1">
                            {sms.message_body}
                          </div>

                          {/* Reason and Details diagnostics */}
                          {parsed ? (
                            <div className="p-3 bg-slate-950 border border-slate-900/40 rounded-xl flex items-center justify-between text-[11.5px]">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider">Estimated Flow</span>
                                <span className="font-bold text-slate-200">{parsed.provider.replace('_', ' ')}</span>
                              </div>
                              <span className="font-mono font-black text-emerald-400">{formatXAF(parsed.amount)}</span>
                            </div>
                          ) : (
                            <div className="p-3 bg-rose-500/5 border border-rose-950/30 rounded-xl text-[10px] font-medium text-rose-400/90 leading-relaxed flex items-start gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
                              <span>Reason: Format does not match any deterministic carrier regex structures. Must parse manually.</span>
                            </div>
                          )}

                          {/* Extraction Submit Actions */}
                          <div className="flex justify-end pt-1">
                            <Button
                              size="sm"
                              variant={parsed ? 'primary' : 'outline'}
                              onClick={() => manualProcessMutation.mutate(sms.id)}
                              disabled={isManualProcessLoading}
                              className="w-full sm:w-auto h-8 px-4 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5"
                            >
                              {isManualProcessLoading ? (
                                <>
                                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                                  Evaluating...
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 shrink-0" />
                                  Process SMS
                                </>
                              )}
                            </Button>
                          </div>

                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            ) : (
              /* VIEW: PROCESSED messages session */
              filteredProcessed.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No processed logs"
                  description="You have not parsed or processed any messages during this active session yet."
                  actionText="Go to Import Sandbox"
                  onAction={() => setActiveTab('import')}
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProcessed.map((sms) => {
                    const parsed = parseSmsClient(sms.message_body, sms.sender);
                    return (
                      <Card key={sms.id} className="border border-emerald-950/20 bg-emerald-950/5 relative overflow-hidden">
                        <div className="absolute top-4 right-4">
                          <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-950/60 text-emerald-400 font-mono font-bold text-[8.5px] rounded-lg tracking-wider uppercase flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Resolved & Integrated
                          </span>
                        </div>

                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs font-mono font-bold text-slate-300">
                            {sms.sender}
                          </CardTitle>
                          <CardDescription className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            {formatDate(sms.received_at, true)}
                          </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-4">
                          <div className="p-3 bg-slate-950 border border-slate-900/60 rounded-xl leading-relaxed font-mono text-[11px] text-slate-400">
                            {sms.message_body}
                          </div>

                          {parsed && (
                            <div className="p-3 bg-slate-950 border border-slate-900/40 rounded-xl flex items-center justify-between text-[11.5px]">
                              <div className="flex flex-col">
                                <span className="text-[8px] font-mono font-bold text-slate-500 uppercase tracking-wider">Flow Account</span>
                                <span className="font-bold text-slate-300">{parsed.provider.replace('_', ' ')}</span>
                              </div>
                              <span className="font-mono font-black text-emerald-400">{formatXAF(parsed.amount)}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )
            )
          )}

        </div>
      )}

    </div>
  );
}
