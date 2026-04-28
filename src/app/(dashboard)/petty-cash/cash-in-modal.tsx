"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, cn } from "@/lib/utils";
import { X, Plus } from "lucide-react";

const SOURCES = [
  { value: "bank", label: "Bank Withdrawal" },
  { value: "nisha", label: "Nisha" },
  { value: "other", label: "Other" },
];

interface CashInModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export default function CashInModal({ onClose, onSaved }: CashInModalProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [amount, setAmount] = useState("");
  const [source, setSource] = useState("bank");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!amount || Number(amount) <= 0) {
      toast("error", "Enter a valid amount");
      return;
    }

    setSubmitting(true);

    const row = {
      date: new Date().toISOString().slice(0, 10),
      amount: Number(amount),
      source,
      source_user: user?.id || null,
      notes: notes.trim() || null,
    };

    const { error } = await supabase.from("petty_cash_ins").insert(row);

    if (error) {
      toast("error", "Failed to save: " + error.message);
    } else {
      toast("success", `${formatCurrency(Number(amount))} added to tin`);
      onSaved();
    }

    setSubmitting(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.16),0_2px_8px_rgba(0,0,0,0.08)]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <Plus className="h-5 w-5 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-[#1E293B]">Cash In</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-5 flex flex-col gap-4">
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Source</label>
            <div className="grid grid-cols-2 gap-2">
              {SOURCES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSource(s.value)}
                  className={cn(
                    "rounded-lg border py-3 text-sm font-medium transition-all min-h-[48px]",
                    source === s.value
                      ? "border-[#1E40AF] bg-[#1E40AF]/10 text-[#1E40AF]"
                      : "border-gray-300 text-gray-500 hover:border-gray-400"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#333333]">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes..."
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-sm text-[#333333] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6] resize-none"
            />
          </div>

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
              Save
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
