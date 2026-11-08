"use client";

import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertProps {
  variant?: "default" | "info" | "success" | "warning" | "destructive";
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  variant = "default",
  title,
  children,
  dismissible = false,
  onDismiss,
  className,
}: AlertProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (onDismiss) onDismiss();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case "info":
        return {
          container: "bg-sky-50 border-sky-200 text-sky-900",
          icon: Info,
          iconColor: "text-[#0284C7]",
        };
      case "success":
        return {
          container: "bg-emerald-50 border-emerald-200 text-emerald-900",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
        };
      case "warning":
        return {
          container: "bg-amber-50 border-amber-200 text-amber-900",
          icon: AlertTriangle,
          iconColor: "text-amber-600",
        };
      case "destructive":
        return {
          container: "bg-rose-50 border-rose-200 text-rose-900",
          icon: AlertCircle,
          iconColor: "text-rose-600",
        };
      default:
        return {
          container: "bg-[#FAF9F6] border-[#E6E6E1] text-[#0F172A]",
          icon: Info,
          iconColor: "text-[#64748B]",
        };
    }
  };

  const { container, icon: Icon, iconColor } = getVariantStyles();

  return (
    <div
      role="alert"
      className={cn(
        "relative w-full rounded-2xl border p-4 shadow-xs transition-all flex items-start gap-3",
        container,
        className
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0 mt-0.5", iconColor)} />

      <div className="flex-1 min-w-0 space-y-1">
        {title && (
          <h5 className="text-xs font-bold leading-none tracking-tight">
            {title}
          </h5>
        )}
        <div className="text-xs leading-relaxed opacity-90">{children}</div>
      </div>

      {dismissible && (
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-md opacity-70 hover:opacity-100 hover:bg-black/5 transition-opacity cursor-pointer shrink-0"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default Alert;

