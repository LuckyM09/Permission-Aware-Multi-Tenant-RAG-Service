"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  createContext,
  useContext,
} from "react";
import {
  Send,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
  Check,
  Copy,
  RotateCw,
  Sparkles,
  User,
  Bot,
  AlertCircle,
  Menu,
  MessageSquare,
  Plus,
  Trash2,
  Shield,
  SlidersHorizontal,
} from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";

// =============================================================================
// TYPES & INTERFACES
// =============================================================================

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus =
  | "sending"
  | "sent"
  | "delivered"
  | "failed"
  | "streaming";

export interface ChatAttachment {
  id: string;
  name: string;
  size?: string;
  type?: "image" | "file" | "code";
  url?: string;
}

export interface ChatCitationImage {
  url: string;
  filename: string;
  page?: number;
  width?: number;
  height?: number;
}

export interface ChatCitationItem {
  index: number;
  chunk_id: string;
  document_id: string;
  document_title: string;
  similarity: number;
  visibility: "private" | "group" | "tenant";
  text?: string;
  text_snippet?: string;
  images?: ChatCitationImage[];
  score?: number;
}

export interface ChatMessageItem {
  id: string;
  role: MessageRole;
  content: string;
  author?: string;
  timestamp?: string;
  status?: MessageStatus;
  attachments?: ChatAttachment[];
  citations?: ChatCitationItem[];
}

export interface ChatConversationThread {
  id: string;
  title: string;
  timestamp: string;
  group?: "Today" | "Yesterday" | "Previous" | string;
  message_count?: number;
}

export interface ChatContextValue {
  messages: ChatMessageItem[];
  onSendMessage: (content: string, attachments?: ChatAttachment[]) => void;
  isGenerating?: boolean;
  activeThreadId?: string;
  onSelectThread?: (threadId: string) => void;
  onNewChat?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onInspectCitation?: (citation: ChatCitationItem) => void;
  onInspectImage?: (image: ChatCitationImage) => void;
  onToggleSettings?: () => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  threads?: ChatConversationThread[];
  accentColor?: string;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("Chat compound subcomponents must be used within <Chat>");
  }
  return ctx;
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

export interface ChatHeaderProps {
  title?: string;
  subtitle?: string;
  modelBadge?: string;
  onClearChat?: () => void;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  title = "AI Assistant",
  subtitle = "NVIDIA Nemotron 3.5 • Anti-Leak Grounded",
  modelBadge,
  onClearChat,
  className,
}) => {
  const { isSidebarOpen, setIsSidebarOpen, threads, onToggleSettings } = useChat();

  return (
    <div
      className={cn(
        "px-4 sm:px-5 py-3 border-b border-[#E6E6E1] bg-white flex items-center justify-between gap-3 select-none shrink-0",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {threads && threads.length > 0 && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg border border-[#E6E6E1] bg-white text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0] active:scale-95 transition-transform md:hidden focus-ring cursor-pointer"
            aria-label="Toggle chat thread history"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] flex items-center justify-center text-[#0284C7] shrink-0 shadow-2xs">
          <Bot className="w-4 h-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">{title}</h3>
            {modelBadge && (
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                {modelBadge}
              </span>
            )}
          </div>
          {subtitle && <p className="text-[11px] text-[#64748B] truncate font-sans">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {onToggleSettings && (
          <button
            type="button"
            onClick={onToggleSettings}
            title="Retrieval Settings"
            aria-label="Toggle search and retrieval settings"
            className="p-1.5 rounded-lg border border-[#E6E6E1] bg-white text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0] active:scale-95 transition-all focus-ring cursor-pointer shadow-2xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        )}

        {onClearChat && (
          <button
            type="button"
            onClick={onClearChat}
            title="Clear conversation"
            aria-label="Clear chat history"
            className="p-1.5 rounded-lg border border-[#E6E6E1] bg-white text-[#64748B] hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:scale-95 transition-all focus-ring cursor-pointer shadow-2xs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export interface ChatSidebarProps {
  className?: string;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({ className }) => {
  const {
    threads = [],
    activeThreadId,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    isSidebarOpen,
    setIsSidebarOpen,
  } = useChat();

  const grouped = useMemo(() => {
    const groups: Record<string, ChatConversationThread[]> = {};
    threads.forEach((t) => {
      const g = t.group || "Today";
      if (!groups[g]) groups[g] = [];
      groups[g].push(t);
    });
    return groups;
  }, [threads]);

  return (
    <>
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 md:hidden"
        />
      )}

      <aside
        className={cn(
          "w-64 h-full min-h-0 border-r border-[#E6E6E1] bg-[#F8FAFC] flex flex-col shrink-0 overflow-hidden transition-transform duration-200 z-50",
          "fixed inset-y-0 left-0 md:static md:translate-x-0",
          isSidebarOpen
            ? "translate-x-0 shadow-xl md:shadow-none"
            : "-translate-x-full md:translate-x-0",
          className
        )}
      >
        <div className="p-3 border-b border-[#E6E6E1] bg-white flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onNewChat?.();
              setIsSidebarOpen(false);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl border border-[#E6E6E1] bg-[#FAF9F6] hover:bg-[#F4F4F0] text-xs font-semibold text-[#0F172A] transition-colors focus-ring cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>New Conversation</span>
          </button>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
            className="p-2 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#F4F4F0] text-[#64748B] hover:text-[#0F172A] transition-colors md:hidden focus-ring cursor-pointer shadow-2xs"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-3 font-sans text-xs">
          {(Object.entries(grouped) as [string, ChatConversationThread[]][]).map(
            ([groupTitle, list]) => (
              <div key={groupTitle} className="space-y-1">
                <div className="px-2 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94A3B8]">
                  {groupTitle}
                </div>
                {list.map((thread) => {
                  const isActive = thread.id === activeThreadId;
                  return (
                    <div
                      key={thread.id}
                      className={cn(
                        "group/thread w-full flex items-center justify-between rounded-lg px-2.5 py-1.5 transition-colors focus-ring cursor-pointer text-xs",
                        isActive
                          ? "bg-white text-[#0F172A] font-semibold border border-[#E6E6E1] shadow-2xs"
                          : "text-[#52525B] hover:text-[#0F172A] hover:bg-white/60"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          onSelectThread?.(thread.id);
                          setIsSidebarOpen(false);
                        }}
                        className="flex-1 flex items-center gap-2 truncate text-left"
                      >
                        <MessageSquare className="w-3.5 h-3.5 shrink-0 text-[#94A3B8]" />
                        <span className="truncate">{thread.title}</span>
                      </button>

                      {onDeleteThread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteThread(thread.id);
                          }}
                          aria-label={`Delete conversation ${thread.title}`}
                          className="opacity-0 group-hover/thread:opacity-100 hover:text-rose-600 p-1 rounded transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </aside>
    </>
  );
};

export const ChatCodeBlock: React.FC<{ language?: string; code: string }> = ({
  language,
  code,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-2 rounded-xl border border-[#1E293B] bg-[#0F172A] text-white overflow-hidden shadow-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#1E293B]/70 border-b border-[#334155] text-[10px] font-mono text-[#94A3B8]">
        <span className="uppercase tracking-wider font-semibold text-[9px] text-[#00D2FF]">
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-3 h-3 text-emerald-400" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <pre className="p-3.5 font-mono text-[11px] leading-relaxed max-w-full overflow-x-auto text-[#E2E8F0]">
        <code>{code}</code>
      </pre>
    </div>
  );
};

function renderChatMessageContent(content: string, isUser: boolean) {
  if (isUser) {
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  if (!content.includes("```")) {
    const parts = content.split(/(`[^`]+`)/g);
    return (
      <div className="whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          if (part.startsWith("`") && part.endsWith("`")) {
            return (
              <code
                key={i}
                className="px-1.5 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] font-mono text-[11px]"
              >
                {part.slice(1, -1)}
              </code>
            );
          }
          return part;
        })}
      </div>
    );
  }

  const chunks: Array<{ type: "text" | "code"; language?: string; text: string }> = [];
  const lines = content.split("\n");
  let currentText: string[] = [];
  let inCode = false;
  let codeLang = "";
  let codeLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("```")) {
      if (!inCode) {
        if (currentText.length > 0) {
          chunks.push({ type: "text", text: currentText.join("\n") });
          currentText = [];
        }
        inCode = true;
        codeLang = line.trim().replace(/^```/, "") || "text";
        codeLines = [];
      } else {
        inCode = false;
        chunks.push({
          type: "code",
          language: codeLang,
          text: codeLines.join("\n"),
        });
        codeLines = [];
      }
    } else if (inCode) {
      codeLines.push(line);
    } else {
      currentText.push(line);
    }
  }

  if (inCode && codeLines.length > 0) {
    chunks.push({ type: "code", language: codeLang, text: codeLines.join("\n") });
  } else if (currentText.length > 0) {
    chunks.push({ type: "text", text: currentText.join("\n") });
  }

  return (
    <div className="space-y-2">
      {chunks.map((chunk, idx) => {
        if (chunk.type === "code") {
          return (
            <ChatCodeBlock
              key={idx}
              language={chunk.language}
              code={chunk.text}
            />
          );
        }

        const parts = chunk.text.split(/(`[^`]+`)/g);
        return (
          <div key={idx} className="whitespace-pre-wrap leading-relaxed">
            {parts.map((part, pIdx) => {
              if (part.startsWith("`") && part.endsWith("`")) {
                return (
                  <code
                    key={pIdx}
                    className="px-1.5 py-0.5 rounded bg-[#F1F5F9] border border-[#E2E8F0] text-[#0F172A] font-mono text-[11px]"
                  >
                    {part.slice(1, -1)}
                  </code>
                );
              }
              return part;
            })}
          </div>
        );
      })}
    </div>
  );
}

export interface ChatMessageProps {
  message: ChatMessageItem;
  onRetry?: (messageId: string) => void;
  className?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRetry,
  className,
}) => {
  const { onInspectCitation, onInspectImage } = useChat();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";

  const handleCopy = () => {
    copyToClipboard(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "flex gap-3 text-xs animate-in fade-in duration-150",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "w-7 h-7 rounded-xl border flex items-center justify-center shrink-0 shadow-2xs",
          isUser
            ? "bg-[#0F172A] text-white border-[#0F172A]"
            : "bg-white border-[#E6E6E1] text-[#0284C7]"
        )}
      >
        {isUser ? (
          <User className="w-3.5 h-3.5" />
        ) : (
          <Bot className="w-3.5 h-3.5" />
        )}
      </div>

      {/* Bubble + Metadata */}
      <div
        className={cn(
          "flex flex-col max-w-[92%] sm:max-w-[82%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] font-mono text-[#64748B]">
          <span>{message.author || (isUser ? "You" : "VaultRAG Assistant")}</span>
          {message.timestamp && <span>• {message.timestamp}</span>}
        </div>

        <div
          className={cn(
            "p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed transition-colors break-words overflow-hidden",
            isUser
              ? "bg-[#0F172A] text-white border border-[#0F172A] rounded-tr-xs shadow-xs"
              : "bg-white text-[#0F172A] border border-[#E6E6E1] rounded-tl-xs shadow-xs space-y-3"
          )}
        >
          {message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 pb-2 border-b border-[#E6E6E1]">
              {message.attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] text-[10px] font-mono text-[#0F172A]"
                >
                  {att.type === "image" ? (
                    <ImageIcon className="w-3 h-3 text-[#64748B]" />
                  ) : (
                    <FileText className="w-3 h-3 text-[#64748B]" />
                  )}
                  <span className="truncate max-w-[120px]">{att.name}</span>
                  {att.size && (
                    <span className="text-[#64748B]">({att.size})</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {renderChatMessageContent(message.content, isUser)}

          {message.status === "streaming" && (
            <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-[#0284C7] animate-pulse" />
          )}

          {!isUser && message.citations && message.citations.length > 0 && (
            <div className="pt-3 mt-3 border-t border-[#E6E6E1] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-[#64748B]">
                <span className="flex items-center gap-1.5 text-[#0F172A] font-semibold">
                  <Shield className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Grounded Citations ({message.citations.length}):</span>
                </span>
                <span className="text-[10px] text-[#64748B] font-mono">
                  Click badge to inspect chunk
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {message.citations.map((cite, cIdx) => {
                  const cleanTitle = (cite.document_title || "Document").replace(/\.[^/.]+$/, "");
                  const score = Math.round((cite.similarity || cite.score || 0) * 100);
                  const scoreBadge =
                    score >= 80
                      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                      : "text-sky-700 bg-sky-50 border-sky-200";
                  return (
                    <button
                      key={cite.chunk_id || cIdx}
                      type="button"
                      onClick={() => onInspectCitation?.(cite)}
                      title={`${cite.document_title || "Document"} • Match: ${score}% • Click to inspect`}
                      className="px-2.5 py-1 rounded-lg border border-[#E6E6E1] bg-[#FAF9F6] hover:border-[#0284C7] hover:bg-white text-[11px] text-[#0F172A] transition-all flex items-center gap-1.5 font-mono shadow-2xs cursor-pointer group"
                    >
                      <span className="font-bold text-[#0284C7]">
                        [{cite.index || cIdx + 1}]
                      </span>
                      <span className="truncate max-w-[160px] sm:max-w-[220px] font-sans font-medium text-[#18181B]">
                        {cleanTitle}
                      </span>
                      <span className={`text-[10px] font-mono font-semibold px-1 py-0.2 rounded border ${scoreBadge}`}>
                        {score}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {!isUser &&
            message.citations?.some(
              (c) => Array.isArray(c.images) && c.images.length > 0
            ) && (
              <div className="pt-2 mt-2 border-t border-[#E6E6E1] space-y-1.5">
                <span className="text-[10px] uppercase font-mono font-semibold text-[#64748B] block">
                  Extracted Figures
                </span>
                <div className="flex flex-wrap gap-2">
                  {message.citations
                    .flatMap((c) => c.images || [])
                    .map((img, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => onInspectImage?.(img)}
                        className="rounded-lg border border-[#E6E6E1] bg-[#FAF9F6] p-1 hover:border-[#0284C7] transition-colors cursor-pointer text-left"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.url}
                          alt={img.filename}
                          className="h-16 w-auto max-w-[140px] object-cover rounded"
                        />
                        <div className="text-[9px] font-mono text-[#64748B] truncate max-w-[140px] mt-0.5">
                          P.{img.page || 1} • {img.filename}
                        </div>
                      </button>
                    ))}
                </div>
              </div>
            )}

          {message.status === "failed" && (
            <div className="mt-2 flex items-center gap-2 text-rose-600 font-sans text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Failed to generate response</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={() => onRetry(message.id)}
                  className="underline underline-offset-2 ml-1 text-[#0F172A] font-semibold cursor-pointer"
                >
                  Retry
                </button>
              )}
            </div>
          )}
        </div>

        {isAssistant && message.status !== "streaming" && (
          <div className="flex items-center gap-1 mt-1 px-1">
            <button
              type="button"
              onClick={handleCopy}
              title="Copy message"
              aria-label={copied ? "Message copied" : "Copy message"}
              className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F4F0] active:scale-95 transition-all focus-ring cursor-pointer"
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export interface ChatMessagesProps {
  className?: string;
  emptyPlaceholder?: React.ReactNode;
}

export const ChatMessages: React.FC<ChatMessagesProps> = ({
  className,
  emptyPlaceholder,
}) => {
  const { messages, isGenerating } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === "function") {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isGenerating]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center p-6 sm:p-8 text-center text-xs text-[#52525B]">
        {emptyPlaceholder || (
          <div className="max-w-sm space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#E6E6E1] flex items-center justify-center text-[#0284C7] mx-auto mb-3 shadow-2xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <h4 className="font-bold text-[#0F172A] text-sm">
              Context-Fenced AI Dialogue
            </h4>
            <p className="text-xs text-[#64748B] leading-relaxed">
              Ask anything grounded in your tenant&apos;s indexed documents with 100%
              permission isolation.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4",
        className
      )}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export interface ChatComposerProps {
  placeholder?: string;
  allowAttachments?: boolean;
  onStopGenerating?: () => void;
  className?: string;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  placeholder = "Ask a question about your indexed documents...",
  allowAttachments = true,
  onStopGenerating,
  className,
}) => {
  const { onSendMessage, isGenerating, accentColor } = useChat();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if ((!input.trim() && attachments.length === 0) || isGenerating) return;
    onSendMessage(input.trim(), attachments);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAtts: ChatAttachment[] = Array.from(files).map((f, i) => ({
      id: `att-${Date.now()}-${i}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      type: f.type.startsWith("image/") ? "image" : "file",
    }));

    setAttachments((prev) => [...prev, ...newAtts]);
    e.target.value = "";
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  }, [input]);

  return (
    <div
      className={cn(
        "p-3 sm:p-4 border-t border-[#E6E6E1] bg-white shrink-0",
        className
      )}
    >
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 overflow-hidden animate-in fade-in duration-100">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] text-[10px] font-mono text-[#0F172A]"
            >
              {att.type === "image" ? (
                <ImageIcon className="w-3 h-3 text-[#64748B]" />
              ) : (
                <FileText className="w-3 h-3 text-[#64748B]" />
              )}
              <span className="truncate max-w-[110px]">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                aria-label={`Remove attachment ${att.name}`}
                className="text-[#64748B] hover:text-[#0F172A] ml-1 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative rounded-2xl border border-[#E2E8F0] bg-[#FAF9F6] p-2 focus-within:border-[#0F172A] focus-within:bg-white transition-all shadow-2xs">
        <label htmlFor="chat-composer-textarea" className="sr-only">
          {placeholder}
        </label>
        <textarea
          id="chat-composer-textarea"
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className="w-full resize-none bg-transparent px-2.5 py-1.5 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none font-sans max-h-40 leading-relaxed"
        />

        <div className="flex items-center justify-between pt-2 px-1 border-t border-[#E6E6E1]/60 text-xs">
          <div className="flex items-center gap-1.5">
            {allowAttachments && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach file or image"
                  aria-label="Attach file"
                  className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F4F0] transition-colors focus-ring cursor-pointer"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            <span className="text-[10px] font-mono text-[#94A3B8] hidden sm:inline">
              Return to send, Shift+Return for newline
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {isGenerating && onStopGenerating && (
              <button
                type="button"
                onClick={onStopGenerating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-semibold text-xs shadow-xs focus-ring cursor-pointer transition-transform"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span>Stop</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isGenerating}
              title="Send message"
              aria-label="Send message"
              style={accentColor ? { backgroundColor: accentColor } : undefined}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all font-semibold text-xs focus-ring cursor-pointer shadow-xs",
                accentColor && "text-white"
              )}
            >
              {isGenerating ? (
                <RotateCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-[#00D2FF]" />
              )}
              <span>Send</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface ChatProps {
  messages: ChatMessageItem[];
  onSendMessage: (content: string, attachments?: ChatAttachment[]) => void;
  isGenerating?: boolean;
  threads?: ChatConversationThread[];
  activeThreadId?: string;
  accentColor?: string;
  onSelectThread?: (threadId: string) => void;
  onNewChat?: () => void;
  onDeleteThread?: (threadId: string) => void;
  onClearChat?: () => void;
  onInspectCitation?: (citation: ChatCitationItem) => void;
  onInspectImage?: (image: ChatCitationImage) => void;
  onToggleSettings?: () => void;
  className?: string;
  children?: React.ReactNode;
}

export const Chat: React.FC<ChatProps> = ({
  messages,
  onSendMessage,
  isGenerating = false,
  threads,
  activeThreadId,
  accentColor,
  onSelectThread,
  onNewChat,
  onDeleteThread,
  onClearChat,
  onInspectCitation,
  onInspectImage,
  onToggleSettings,
  className,
  children,
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const contextValue: ChatContextValue = {
    messages,
    onSendMessage,
    isGenerating,
    threads,
    activeThreadId,
    accentColor,
    onSelectThread,
    onNewChat,
    onDeleteThread,
    onInspectCitation,
    onInspectImage,
    onToggleSettings,
    isSidebarOpen,
    setIsSidebarOpen,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      <div
        className={cn(
          "w-full h-full min-h-0 flex rounded-2xl border border-[#E6E6E1] bg-white text-[#0F172A] shadow-card overflow-hidden transition-colors font-sans",
          className
        )}
      >
        {children || (
          <>
            {threads && threads.length > 0 && <ChatSidebar />}
            <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col bg-[#FAF9F6] overflow-hidden">
              <ChatHeader onClearChat={onClearChat} />
              <ChatMessages />
              <ChatComposer />
            </div>
          </>
        )}
      </div>
    </ChatContext.Provider>
  );
};
