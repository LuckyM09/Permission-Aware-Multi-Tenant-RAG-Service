"use client";

import React, {
  forwardRef,
  useRef,
  useEffect,
  useState,
  createContext,
  useContext,
  ReactNode,
} from "react";
import {
  Send,
  Paperclip,
  Copy,
  Check,
  RotateCw,
  Sparkles,
  User,
  Bot,
  X,
  CornerDownLeft,
} from "lucide-react";
import { cn, copyToClipboard } from "@/lib/utils";

// =============================================================================
// EASYUI CHAT PRIMITIVES (Surajmaurya1/easyui/chat)
// =============================================================================

export interface ChatContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const ChatContainer = forwardRef<HTMLDivElement, ChatContainerProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col h-full w-full bg-white rounded-2xl border border-[#E6E6E1] overflow-hidden shadow-card transition-all",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChatContainer.displayName = "ChatContainer";

// Message List
export interface ChatMessageListProps extends React.HTMLAttributes<HTMLDivElement> {
  autoScroll?: boolean;
}

export const ChatMessageList = forwardRef<HTMLDivElement, ChatMessageListProps>(
  ({ className, children, autoScroll = true, ...props }, ref) => {
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (autoScroll && listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight;
      }
    }, [children, autoScroll]);

    return (
      <div
        ref={ref || listRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scroll-smooth focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChatMessageList.displayName = "ChatMessageList";

// Chat Bubble (Sent vs Received)
export interface ChatBubbleProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "sent" | "received";
  layout?: "default" | "ai";
}

export const ChatBubble = forwardRef<HTMLDivElement, ChatBubbleProps>(
  ({ className, variant = "received", layout = "default", children, ...props }, ref) => {
    const isSent = variant === "sent";

    return (
      <div
        ref={ref}
        className={cn(
          "flex gap-3 group/bubble w-full animate-in fade-in slide-in-from-bottom-1 duration-200",
          isSent ? "flex-row-reverse justify-start" : "flex-row justify-start",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
ChatBubble.displayName = "ChatBubble";

// Chat Bubble Avatar
export interface ChatBubbleAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string;
  fallback?: string;
  isAi?: boolean;
  status?: "online" | "offline" | "busy";
}

export const ChatBubbleAvatar = forwardRef<HTMLDivElement, ChatBubbleAvatarProps>(
  ({ className, src, fallback, isAi = false, status = "online", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative w-8 h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs select-none shadow-2xs transition-transform group-hover/bubble:scale-105",
          isAi
            ? "bg-[#FAF9F6] text-[#0284C7] border border-[#E6E6E1]"
            : "bg-[#0F172A] text-white",
          className
        )}
        {...props}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="Avatar" className="w-full h-full object-cover rounded-xl" />
        ) : fallback ? (
          <span>{fallback}</span>
        ) : isAi ? (
          <Bot className="w-4 h-4 text-[#00D2FF]" />
        ) : (
          <User className="w-4 h-4 text-white" />
        )}

        {status && (
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white",
              status === "online" && "bg-emerald-500",
              status === "busy" && "bg-amber-500",
              status === "offline" && "bg-slate-300"
            )}
          />
        )}
      </div>
    );
  }
);
ChatBubbleAvatar.displayName = "ChatBubbleAvatar";

// Chat Bubble Message
export interface ChatBubbleMessageProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "sent" | "received";
  isLoading?: boolean;
}

export const ChatBubbleMessage = forwardRef<HTMLDivElement, ChatBubbleMessageProps>(
  ({ className, variant = "received", isLoading = false, children, ...props }, ref) => {
    const isSent = variant === "sent";

    return (
      <div
        ref={ref}
        className={cn(
          "max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-xs sm:text-sm leading-relaxed transition-all relative break-words",
          isSent
            ? "bg-[#0F172A] text-white rounded-tr-xs shadow-xs"
            : "bg-[#FAF9F6] text-[#0F172A] border border-[#E6E6E1] rounded-tl-xs shadow-2xs hover:border-[#D1D5DB]",
          className
        )}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center gap-1.5 py-1 px-1">
            <span className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse" />
            <span
              className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-2 h-2 rounded-full bg-[#00D2FF] animate-pulse"
              style={{ animationDelay: "300ms" }}
            />
          </div>
        ) : (
          children
        )}
      </div>
    );
  }
);
ChatBubbleMessage.displayName = "ChatBubbleMessage";

// Chat Bubble Timestamp
export interface ChatBubbleTimestampProps extends React.HTMLAttributes<HTMLSpanElement> {
  timestamp: string;
}

export const ChatBubbleTimestamp = forwardRef<HTMLSpanElement, ChatBubbleTimestampProps>(
  ({ className, timestamp, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "text-[10px] text-[#94A3B8] font-mono select-none px-1",
          className
        )}
        {...props}
      >
        {timestamp}
      </span>
    );
  }
);
ChatBubbleTimestamp.displayName = "ChatBubbleTimestamp";

// Chat Bubble Action Wrapper & Button
export interface ChatBubbleActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  label?: string;
}

export const ChatBubbleAction = forwardRef<HTMLButtonElement, ChatBubbleActionProps>(
  ({ className, icon, label, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          "p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#FAF9F6] border border-transparent hover:border-[#E6E6E1] transition-all cursor-pointer shadow-2xs active:scale-95",
          className
        )}
        {...props}
      >
        {icon}
        {label && <span className="text-[10px] font-medium ml-1">{label}</span>}
        {children}
      </button>
    );
  }
);
ChatBubbleAction.displayName = "ChatBubbleAction";

export const ChatBubbleActionWrapper = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-opacity pt-1 px-1",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
ChatBubbleActionWrapper.displayName = "ChatBubbleActionWrapper";

// Chat Copy Action Button
export const ChatCopyButton: React.FC<{ content: string; className?: string }> = ({
  content,
  className,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ChatBubbleAction
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy response"}
      aria-label="Copy response to clipboard"
      className={className}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-emerald-600" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </ChatBubbleAction>
  );
};

// Chat Input Bar / Composer
export interface ChatInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onKeyDownSubmit?: () => void;
}

export const ChatInput = forwardRef<HTMLTextAreaElement, ChatInputProps>(
  ({ className, onKeyDownSubmit, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onKeyDownSubmit?.();
      }
    };

    return (
      <textarea
        ref={ref}
        rows={1}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full resize-none bg-transparent px-3 py-2 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none max-h-32 min-h-[40px] leading-relaxed",
          className
        )}
        {...props}
      />
    );
  }
);
ChatInput.displayName = "ChatInput";

// Chat Composer Container
export interface ChatComposerProps extends React.FormHTMLAttributes<HTMLFormElement> {
  onSend?: () => void;
  isLoading?: boolean;
}

export const ChatComposer = forwardRef<HTMLFormElement, ChatComposerProps>(
  ({ className, onSend, isLoading = false, children, ...props }, ref) => {
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSend?.();
    };

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className={cn(
          "p-3 sm:p-4 border-t border-[#E6E6E1] bg-white flex flex-col gap-2 shrink-0 relative",
          className
        )}
        {...props}
      >
        <div className="flex items-end gap-2 p-1.5 rounded-2xl border border-[#E6E6E1] bg-[#FAF9F6] focus-within:border-[#0F172A] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F172A]/10 transition-all shadow-2xs">
          {children}
        </div>
      </form>
    );
  }
);
ChatComposer.displayName = "ChatComposer";

