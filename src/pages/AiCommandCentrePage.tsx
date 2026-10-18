import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext.tsx';
import { api } from '../api/client.ts';
import { CurrencyFormat } from '../components/common/CurrencyFormat.tsx';
import { ChatMessage, AiActionProposal } from '../types/index.ts';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User as UserIcon, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Loader2, 
  ChevronDown, 
  ChevronUp, 
  ShieldCheck, 
  ArrowRight,
  Brain,
  Check,
  Mic,
  MicOff,
  Percent,
  Lock,
  Wrench
} from 'lucide-react';

const SUGGESTED_QUERIES = [
  'Mehra Electronics ka kitna baaki hai? Unko WhatsApp reminder bhej do',
  'Low stock items ka PO draft karo with preferred suppliers',
  'Which orders are on Credit Hold under Udhaar gatekeeper?',
  'What service appointments are scheduled tomorrow?',
  'Summarize today\'s collections and overdue receivables',
  'Which customers have High credit risk scores?',
];

export const AiCommandCentrePage: React.FC = () => {
  const { user, business, showToast, triggerRefresh, isListening, startListening, stopListening } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-init-1',
      role: 'assistant',
      content: `Namaste ${user?.name || 'Sir'}! I am **RazBuddy AI**, your operational copilot at **${business?.name}**.\n\nI am equipped with native **Gemini Function Tools** to autonomously inspect ledgers and prepare executable operations:\n• Multi-Item Purchase Orders (grouped by preferred vendor)\n• 1-Click WhatsApp Payment Reminders with Razorpay Links\n• Udhaar Credit Hold Overrides\n• Service Appointment Confirmations\n\nYou can speak or type in **Hinglish, Hindi, or English**!`,
      timestamp: 'Just now',
      thinking: 'Initialized operational connection with live data store and verified role authorizations.',
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Listen for voice inputs dispatched from top bar
  useEffect(() => {
    const handleVoiceEvent = (e: any) => {
      if (e.detail) {
        handleSend(e.detail);
      }
    };
    window.addEventListener('razbuddy-voice-input', handleVoiceEvent);
    return () => window.removeEventListener('razbuddy-voice-input', handleVoiceEvent);
  }, []);

  const handleSend = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res = await api.aiChat(q);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: res.content,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        thinking: res.thinking,
        actionProposal: res.actionProposal,
        functionCalls: res.functionCalls,
      };
      setMessages(prev => [...prev, aiMsg]);
      if (res.thinking) {
        setExpandedThinking(prev => ({ ...prev, [aiMsg.id]: true }));
      }
    } catch (err: any) {
      showToast(err.message || 'AI request failed', 'error');
      setMessages(prev => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: 'assistant',
          content: `I encountered an issue processing this request: ${err.message}. Please try one of the suggested prompts below.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (proposalId: string) => {
    setExecutingProposalId(proposalId);
    try {
      const res = await api.executeAiAction(proposalId);
      showToast(res.result || 'Action executed successfully', 'success');
      setMessages(prev => prev.map(m => {
        if (m.actionProposal && m.actionProposal.id === proposalId) {
          return {
            ...m,
            actionProposal: {
              ...m.actionProposal,
              status: 'executed',
              executionResult: res.result,
            }
          };
        }
        return m;
      }));
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setExecutingProposalId(null);
    }
  };

  const handleRejectAction = async (proposalId: string) => {
    try {
      await api.rejectAiAction(proposalId);
      setMessages(prev => prev.map(m => {
        if (m.actionProposal && m.actionProposal.id === proposalId) {
          return {
            ...m,
            actionProposal: {
              ...m.actionProposal,
              status: 'rejected',
            }
          };
        }
        return m;
      }));
      showToast('Action proposal rejected and logged in telemetry', 'info');
      triggerRefresh();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening((transcript) => {
        setInputQuery(transcript);
        handleSend(transcript);
      });
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col max-w-6xl mx-auto bg-white rounded-lg border border-[#E5E7E0] shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-[#E5E7E0] bg-[#F7F7F4] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-[#6D876D] flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-[#252923]">RazBuddy AI Command Centre</h2>
              <span className="text-[10px] bg-[#6D876D]/20 text-[#384c38] px-2 py-0.5 rounded font-mono font-semibold flex items-center gap-1">
                <Brain className="w-3 h-3 text-[#6D876D]" /> Gemini 4 Argon • Native Tools
              </span>
            </div>
            <p className="text-[11px] text-[#73766F]">
              Server-side function calling & Hindi/Hinglish understanding for {business?.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleVoice}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-xs font-medium cursor-pointer transition-colors ${
              isListening
                ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                : 'bg-white hover:bg-stone-50 border-[#E5E7E0] text-[#73766F]'
            }`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-[#6D876D]" />}
            <span>{isListening ? 'Listening...' : 'Voice Input'}</span>
          </button>
        </div>
      </div>

      {/* Suggested Hinglish & English Queries Bar */}
      <div className="p-2 border-b border-[#E5E7E0] bg-stone-50/50 flex items-center gap-1.5 overflow-x-auto shrink-0 text-xs">
        <span className="text-[10px] font-semibold text-[#73766F] uppercase tracking-wider px-1 shrink-0">
          Hinglish Presets:
        </span>
        {SUGGESTED_QUERIES.map((sq, i) => (
          <button
            key={i}
            onClick={() => handleSend(sq)}
            className="px-2.5 py-1 rounded bg-white hover:bg-[#6D876D]/10 hover:border-[#6D876D]/30 border border-[#E5E7E0] text-[11px] text-[#252923] whitespace-nowrap transition-colors cursor-pointer"
          >
            {sq}
          </button>
        ))}
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded bg-[#6D876D] text-white flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div className={`space-y-3 max-w-2xl ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              {/* Thinking Accordion (High Thinking Mode) */}
              {msg.thinking && (
                <div className="border border-[#E5E7E0] rounded bg-stone-50 text-[11px] overflow-hidden">
                  <button
                    onClick={() =>
                      setExpandedThinking(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))
                    }
                    className="w-full px-3 py-1.5 flex items-center justify-between text-[#73766F] hover:text-[#252923] font-mono cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-[#6D876D]" /> Reasoning & Function Calls
                    </span>
                    {expandedThinking[msg.id] ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                  {expandedThinking[msg.id] && (
                    <div className="px-3 py-2 border-t border-[#E5E7E0] text-[#73766F] font-mono text-[10px] leading-relaxed bg-white">
                      {msg.thinking}
                    </div>
                  )}
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`p-3.5 rounded-lg text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[#6D876D] text-white rounded-tr-none'
                    : 'bg-[#F7F7F4] border border-[#E5E7E0] text-[#252923] rounded-tl-none whitespace-pre-wrap'
                }`}
              >
                {msg.content}
              </div>

              {/* Action Proposal Card (Approval Engine) */}
              {msg.actionProposal && (
                <div className="border border-[#6D876D]/40 bg-white rounded-lg p-4 space-y-3 shadow-md animate-in fade-in duration-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-[#6D876D] uppercase tracking-wider font-mono">
                        Native Action Tool: {msg.actionProposal.actionType}
                      </span>
                      <h4 className="text-sm font-bold text-[#252923] mt-0.5">
                        {msg.actionProposal.title}
                      </h4>
                      <p className="text-xs text-[#73766F] mt-1">
                        {msg.actionProposal.description}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold ${
                      msg.actionProposal.status === 'executed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : msg.actionProposal.status === 'rejected'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}>
                      {msg.actionProposal.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Financial impact */}
                  {msg.actionProposal.financialImpact && (
                    <div className="p-2.5 bg-[#F7F7F4] rounded border border-[#E5E7E0] flex items-center justify-between text-xs">
                      <span className="text-[#73766F] font-medium">Financial Commitment:</span>
                      <span className="font-semibold text-[#252923]">
                        <CurrencyFormat amount={msg.actionProposal.financialImpact.amount} /> ({msg.actionProposal.financialImpact.description})
                      </span>
                    </div>
                  )}

                  {/* Validation checks */}
                  {msg.actionProposal.validation && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-semibold text-[#73766F] uppercase tracking-wider">
                        Business Constraint Validations
                      </div>
                      <div className="space-y-1">
                        {msg.actionProposal.validation.checks.map((chk, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs text-[#252923]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span><strong>{chk.rule}:</strong> {chk.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Affected records */}
                  {msg.actionProposal.affectedRecords && (
                    <div className="text-[11px] text-[#73766F] bg-white p-2 rounded border border-[#E5E7E0]">
                      <span className="font-medium text-[#252923]">Affected Records:</span>{' '}
                      {msg.actionProposal.affectedRecords.map(r => r.label).join(', ')}
                    </div>
                  )}

                  {/* Controls / Result */}
                  {msg.actionProposal.status === 'pending_approval' ? (
                    <div className="pt-2 border-t border-[#E5E7E0] flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleRejectAction(msg.actionProposal!.id)}
                        className="px-3 py-1.5 border border-[#E5E7E0] text-[#73766F] hover:text-rose-700 rounded text-xs font-medium cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleExecuteAction(msg.actionProposal!.id)}
                        disabled={executingProposalId === msg.actionProposal.id}
                        className="px-4 py-1.5 bg-[#6D876D] hover:bg-[#5a725a] disabled:opacity-50 text-white rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        {executingProposalId === msg.actionProposal.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        Approve & Execute Operation
                      </button>
                    </div>
                  ) : msg.actionProposal.status === 'executed' ? (
                    <div className="p-2.5 bg-emerald-50 rounded border border-emerald-200 text-xs text-emerald-800 font-medium">
                      ✓ {msg.actionProposal.executionResult || 'Operation executed and logged to audit trail.'}
                    </div>
                  ) : (
                    <div className="p-2.5 bg-stone-100 rounded border border-stone-200 text-xs text-stone-600">
                      Proposal rejected by operator.
                    </div>
                  )}
                </div>
              )}

              <div className="text-[10px] text-[#73766F] font-mono px-1">
                {msg.timestamp}
              </div>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded bg-stone-300 text-stone-800 flex items-center justify-center shrink-0 mt-0.5">
                <UserIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#6D876D] text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 bg-[#F7F7F4] rounded-lg border border-[#E5E7E0] text-xs text-[#73766F] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-[#6D876D]" />
              <span>Invoking Gemini 4 Argon reasoning with live database function declarations...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#E5E7E0] bg-[#F7F7F4]/50">
        <form
          onSubmit={e => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={inputQuery}
            onChange={e => setInputQuery(e.target.value)}
            placeholder="Type or speak in Hinglish (e.g. Mehra Electronics ka kitna baaki hai? / Low stock items ka PO banao)..."
            className="flex-1 px-4 py-2.5 bg-white border border-[#E5E7E0] rounded-lg text-xs text-[#252923] placeholder-[#73766F] focus:outline-hidden focus:border-[#6D876D] shadow-2xs"
          />
          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="px-4 py-2.5 bg-[#6D876D] hover:bg-[#5a725a] disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
