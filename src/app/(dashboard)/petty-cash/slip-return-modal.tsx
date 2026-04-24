"use client";

import { useState, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { X, Camera, Upload, CheckCircle, AlertTriangle } from "lucide-react";
import type { PettyCashOut, PettyCashOutStatus } from "@/types/database";

interface SlipReturnModalProps {
  transaction: PettyCashOut & { employee_name?: string };
  onClose: () => void;
  onSaved: () => void;
}

export default function SlipReturnModal({
  transaction,
  onClose,
  onSaved,
}: SlipReturnModalProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [slipAmount, setSlipAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const parsedSlipAmount = Number(slipAmount) || 0;
  const difference = transaction.amount - parsedSlipAmount;
  const isSquared = parsedSlipAmount > 0 && Math.abs(difference) < 0.01;
  const isPartial = parsedSlipAmount > 0 && difference > 0.01;
  const isOver = parsedSlipAmount > 0 && difference < -0.01;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    // Preview for images
    if (f.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  }

  function handleCapture() {
    if (fileRef.current) {
      fileRef.current.setAttribute("capture", "environment");
      fileRef.current.click();
    }
  }

  function handleUpload() {
    if (fileRef.current) {
      fileRef.current.removeAttribute("capture");
      fileRef.current.click();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!slipAmount || parsedSlipAmount <= 0) {
      toast("error", "Enter the slip amount");
      return;
    }

    setSubmitting(true);

    let slipPhotoUrl: string | null = null;

    // Upload slip photo if provided
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `petty-cash-slips/${transaction.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        toast("error", "Failed to upload slip: " + uploadError.message);
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(path);
      slipPhotoUrl = urlData.publicUrl;
    }

    // Insert slip record
    const { error: slipError } = await supabase.from("petty_cash_slips").insert({
      petty_cash_out_id: transaction.id,
      slip_amount: parsedSlipAmount,
      slip_photo_url: slipPhotoUrl,
      returned_at: new Date().toISOString(),
      squared_by: user?.id || null,
    });

    if (slipError) {
      toast("error", "Failed to save slip: " + slipError.message);
      setSubmitting(false);
      return;
    }

    // Update transaction status
    const newStatus: PettyCashOutStatus = isSquared ? "squared" : "partial";

    const { error: updateError } = await supabase
      .from("petty_cash_outs")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);

    if (updateError) {
      toast("error", "Failed to update status: " + updateError.message);
    } else if (isSquared) {
      toast("success", "Slip squared successfully");
    } else if (isPartial) {
      toast(
        "info",
        `Shortfall of ${formatCurrency(difference)} recorded`
      );
    } else {
      toast("success", "Slip recorded");
    }

    setSubmitting(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Return Slip</h2>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Transaction details */}
        <div className="border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs">Recipient</p>
              <p className="font-medium text-[#333333]">
                {transaction.employee_name ||
                  transaction.recipient_name_freetext ||
                  "—"}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Date</p>
              <p className="font-medium text-[#333333]">
                {formatDate(transaction.date)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Cash Given</p>
              <p className="font-bold text-lg text-[#1A1A2E]">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-xs">Reason</p>
              <p className="font-medium text-[#333333]">
                {transaction.reason || "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          {/* Slip photo */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">
              Slip Photo
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            {preview ? (
              <div className="relative rounded-lg border border-gray-200 overflow-hidden">
                <img
                  src={preview}
                  alt="Slip preview"
                  className="w-full max-h-48 object-contain bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setPreview(null);
                  }}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCapture}
                  className="flex flex-1 flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-6 text-gray-400 hover:border-[#C4A35A] hover:text-[#C4A35A] transition-colors min-h-[48px]"
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-medium">Take Photo</span>
                </button>
                <button
                  type="button"
                  onClick={handleUpload}
                  className="flex flex-1 flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 py-6 text-gray-400 hover:border-[#C4A35A] hover:text-[#C4A35A] transition-colors min-h-[48px]"
                >
                  <Upload className="h-6 w-6" />
                  <span className="text-xs font-medium">Upload File</span>
                </button>
              </div>
            )}
            {file && !preview && (
              <p className="text-xs text-gray-500">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Slip amount */}
          <Input
            label="Slip Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={slipAmount}
            onChange={(e) => setSlipAmount(e.target.value)}
          />

          {/* Status indicator */}
          {parsedSlipAmount > 0 && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3",
                isSquared && "bg-emerald-50 border border-emerald-200",
                isPartial && "bg-amber-50 border border-amber-200",
                isOver && "bg-blue-50 border border-blue-200"
              )}
            >
              {isSquared && (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">
                      SQUARED
                    </p>
                    <p className="text-xs text-emerald-600">
                      Slip matches cash given
                    </p>
                  </div>
                </>
              )}
              {isPartial && (
                <>
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700">
                      PARTIAL — Shortfall {formatCurrency(difference)}
                    </p>
                    <p className="text-xs text-amber-600">
                      {formatCurrency(difference)} unaccounted for
                    </p>
                  </div>
                </>
              )}
              {isOver && (
                <>
                  <AlertTriangle className="h-5 w-5 text-blue-600 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700">
                      OVER — {formatCurrency(Math.abs(difference))} more than cash given
                    </p>
                    <p className="text-xs text-blue-600">
                      Slip exceeds the amount given
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              className="flex-1"
            >
              Save Slip
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
