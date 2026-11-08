"use client";

import React, { useState, useRef, useCallback } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertCircle,
  X,
  FileUp,
  Loader2,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface UploadQueueItem {
  id: string;
  file: File;
  name: string;
  size: number;
  progress: number;
  status: "idle" | "uploading" | "vectorizing" | "ready" | "failed";
  errorMessage?: string;
}

interface AnimatedFileUploadProps {
  onFilesSelected?: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  className?: string;
  disabled?: boolean;
}

export function AnimatedFileUpload({
  onFilesSelected,
  accept = ".pdf,.txt,.md,.docx",
  maxFiles = 5,
  className,
  disabled = false,
}: AnimatedFileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      if (disabled) return;

      const droppedFiles = Array.from(e.dataTransfer.files).slice(0, maxFiles);
      if (droppedFiles.length > 0 && onFilesSelected) {
        onFilesSelected(droppedFiles);
      }
    },
    [disabled, maxFiles, onFilesSelected]
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selected = Array.from(e.target.files).slice(0, maxFiles);
      if (onFilesSelected) onFilesSelected(selected);
      e.target.value = "";
    }
  };

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Drop Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={cn(
          "relative group rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 cursor-pointer overflow-hidden",
          isDragOver
            ? "border-[#00D2FF] bg-sky-50/50 scale-[1.01] shadow-md"
            : "border-[#CBD5E1] bg-white hover:border-[#0F172A] hover:bg-[#FAF9F6] shadow-card",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple
          disabled={disabled}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {/* Dynamic Background Glow on Hover */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
            isDragOver && "opacity-100"
          )}
          style={{
            background:
              "radial-gradient(circle at 50% 50%, rgba(0, 210, 255, 0.08) 0%, transparent 60%)",
          }}
        />

        <div className="relative z-10 flex flex-col items-center justify-center space-y-3">
          {/* Animated Cloud Icon */}
          <div
            className={cn(
              "w-14 h-14 rounded-2xl bg-[#FAF9F6] border border-[#E6E6E1] flex items-center justify-center shadow-xs transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-md",
              isDragOver && "bg-sky-100 border-[#00D2FF] scale-110"
            )}
          >
            <UploadCloud
              className={cn(
                "w-7 h-7 text-[#0F172A] transition-colors duration-200",
                isDragOver ? "text-[#00D2FF]" : "group-hover:text-[#0284C7]"
              )}
            />
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#0F172A]">
              Drop files here, or <span className="text-[#0284C7] underline underline-offset-4">browse</span>
            </h4>
            <p className="text-xs text-[#52525B]">
              Supports PDF, Markdown, TXT, DOCX • Up to 25MB per document
            </p>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-mono font-medium bg-[#FAF9F6] text-[#64748B] border border-[#E6E6E1]">
            <HardDrive className="w-3 h-3 text-[#0284C7]" />
            <span>Automatic Chunker & Nemotron-3-Embed Vectorizer</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnimatedFileUpload;

