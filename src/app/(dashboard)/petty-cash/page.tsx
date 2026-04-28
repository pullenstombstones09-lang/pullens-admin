"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import {
  Wallet,
  Plus,
  ArrowDownLeft,
  Receipt,
  Clock,
  Filter,
  Camera,
  Search,
} from "lucide-react";
import CashInModal from "./cash-in-modal";
import SlipReturnModal from "./slip-return-modal";
import type {
  Employee,
  PettyCashOut,
  PettyCashIn,
  PettyCashSlip,
  PettyCashCategory,
  PettyCashOutStatus,
  PettyRecipientType,
} from "@/types/database";

type Tab = "cash-out" | "slips" | "history";

const CATEGORIES: { value: PettyCashCategory; label: string }[] = [
  { value: "diesel", label: "Diesel" },
  { value: "tolls", label: "Tolls" },
  { value: "airtime", label: "Airtime" },
  { value: "materials", label: "Materials" },
  { value: "casual_wages", label: "Casual wages" },
  { value: "taxi", label: "Taxi" },
  { value: "other", label: "Other" },
];

const STATUS_BADGE: Record<PettyCashOutStatus, { color: "green" | "amber" | "red" | "blue" | "grey"; label: string }> = {
  open: { color: "amber", label: "Open" },
  squared: { color: "green", label: "Squared" },
  partial: { color: "red", label: "Partial" },
  converted_to_loan: { color: "blue", label: "Loan" },
};

export default function PettyCashPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>("cash-out");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [transactions, setTransactions] = useState<(PettyCashOut & { employee_name?: string })[]>([]);
  const [cashIns, setCashIns] = useState<PettyCashIn[]>([]);
  const [tinBalance, setTinBalance] = useState(0);
  const [lastCountDate, setLastCountDate] = useState<string | null>(null);
  const [lastVariance, setLastVariance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Cash In modal
  const [showCashIn, setShowCashIn] = useState(false);

  // Slip Return modal
  const [slipTarget, setSlipTarget] = useState<(PettyCashOut & { employee_name?: string }) | null>(null);

  // Give Cash form state
  const [recipientType, setRecipientType] = useState<PettyRecipientType>("employee");
  const [recipientEmployeeId, setRecipientEmployeeId] = useState("");
  const [recipientFreetext, setRecipientFreetext] = useState("");
  const [category, setCategory] = useState<PettyCashCategory>("diesel");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // History filters
  const [filterStatus, setFilterStatus] = useState<PettyCashOutStatus | "all">("all");
  const [filterRecipient, setFilterRecipient] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);

    // Fetch employees
    const { data: emps } = await supabase
      .from("employees")
      .select("id, full_name, pt_code, status")
      .eq("status", "active")
      .order("full_name");

    // Fetch petty cash outs
    const { data: outs } = await supabase
      .from("petty_cash_outs")
      .select("*")
      .order("date", { ascending: false });

    // Fetch petty cash ins
    const { data: ins } = await supabase
      .from("petty_cash_ins")
      .select("*")
      .order("date", { ascending: false });

    // Fetch tin balance from settings
    const { data: balSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "petty_cash_balance")
      .single();

    const { data: countSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "petty_cash_last_count")
      .single();

    const { data: varianceSetting } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "petty_cash_variance")
      .single();

    if (emps) setEmployees(emps as Employee[]);

    // Map employee names onto transactions
    const empMap = new Map((emps || []).map((e: { id: string; full_name: string }) => [e.id, e.full_name] as const));
    if (outs) {
      setTransactions(
        (outs as PettyCashOut[]).map((t) => ({
          ...t,
          employee_name: t.recipient_employee_id
            ? empMap.get(t.recipient_employee_id) || "Unknown"
            : t.recipient_name_freetext || "—",
        }))
      );
    }

    if (ins) setCashIns(ins as PettyCashIn[]);

    // Compute balance: sum of ins - sum of outs
    const totalIn = (ins || []).reduce((s: number, i: PettyCashIn) => s + i.amount, 0);
    const totalOut = (outs || []).reduce((s: number, o: PettyCashOut) => s + o.amount, 0);

    // If there's a stored balance, use it; else compute
    if (balSetting?.value !== undefined && balSetting.value !== null) {
      setTinBalance(Number(balSetting.value));
    } else {
      setTinBalance(totalIn - totalOut);
    }

    if (countSetting?.value) setLastCountDate(String(countSetting.value));
    if (varianceSetting?.value !== undefined) setLastVariance(Number(varianceSetting.value));

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Give Cash handler
  async function handleGiveCash(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      toast("error", "Enter a valid amount");
      return;
    }
    if (recipientType === "employee" && !recipientEmployeeId) {
      toast("error", "Select an employee");
      return;
    }
    if (recipientType === "casual" && !recipientFreetext.trim()) {
      toast("error", "Enter the casual worker's name");
      return;
    }

    setSubmitting(true);

    const row = {
      date: new Date().toISOString().slice(0, 10),
      recipient_type: recipientType,
      recipient_employee_id: recipientType === "employee" ? recipientEmployeeId : null,
      recipient_name_freetext: recipientType !== "employee" ? recipientFreetext.trim() : null,
      category,
      amount: Number(amount),
      reason: reason.trim() || null,
      issued_by: user?.id || null,
      status: "open" as PettyCashOutStatus,
    };

    const { error } = await supabase.from("petty_cash_outs").insert(row);

    if (error) {
      toast("error", "Failed to save: " + error.message);
    } else {
      toast("success", `${formatCurrency(Number(amount))} given — awaiting slip`);
      setAmount("");
      setReason("");
      setRecipientEmployeeId("");
      setRecipientFreetext("");
      await fetchData();
    }
    setSubmitting(false);
  }

  // Filter logic for history
  const filteredTransactions = transactions.filter((t) => {
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterRecipient) {
      const name = (t.employee_name || "").toLowerCase();
      if (!name.includes(filterRecipient.toLowerCase())) return false;
    }
    if (filterDateFrom && t.date < filterDateFrom) return false;
    if (filterDateTo && t.date > filterDateTo) return false;
    return true;
  });

  // Open transactions (for cash-out and slips tabs)
  const openTransactions = transactions.filter(
    (t) => t.status === "open" || t.status === "partial"
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1E40AF] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <h1 className="text-2xl font-black text-[#1E293B] mb-6">Petty Cash</h1>

      {/* --- TIN BALANCE STRIP --- */}
      <Card className="mb-6 bg-[#1E293B] text-white" padding="lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#1E40AF]/20">
              <Wallet className="h-7 w-7 text-[#1E40AF]" />
            </div>
            <div>
              <p className="text-sm text-white/60 font-medium">Tin Balance</p>
              <p className="text-3xl font-black tracking-tight text-white">
                {formatCurrency(tinBalance)}
              </p>
              {lastCountDate && (
                <p className="mt-0.5 text-xs text-white/40">
                  Last count: {formatDate(lastCountDate)}
                  {lastVariance !== null && (
                    <span
                      className={cn(
                        "ml-2",
                        lastVariance === 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      )}
                    >
                      Variance: {formatCurrency(lastVariance)}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="primary"
              size="lg"
              icon={<Plus className="h-5 w-5" />}
              onClick={() => setShowCashIn(true)}
            >
              Cash In
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="bg-white/10 hover:bg-white/20 text-white"
              icon={<ArrowDownLeft className="h-5 w-5" />}
              onClick={() => {
                setTab("cash-out");
                window.scrollTo({ top: 300, behavior: "smooth" });
              }}
            >
              Give Cash
            </Button>
          </div>
        </div>
      </Card>

      {/* --- TABS --- */}
      <div className="mb-6 flex gap-1 rounded-xl bg-white p-1 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
        {([
          { key: "cash-out" as Tab, label: "Cash Out", icon: <ArrowDownLeft className="h-4 w-4" /> },
          { key: "slips" as Tab, label: "Slip Return", icon: <Receipt className="h-4 w-4" /> },
          { key: "history" as Tab, label: "History", icon: <Clock className="h-4 w-4" /> },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold transition-all duration-150 min-h-[48px]",
              tab === t.key
                ? "bg-[#1E293B] text-white shadow-[0_2px_6px_rgba(26,26,46,0.3)]"
                : "text-[#333333]/60 hover:text-[#333333]"
            )}
          >
            {t.icon}
            {t.label}
            {t.key === "slips" && openTransactions.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                {openTransactions.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* --- CASH OUT TAB --- */}
      {tab === "cash-out" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Give Cash form */}
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Give Cash</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGiveCash} className="flex flex-col gap-4">
                {/* Recipient type toggle */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">
                    Recipient
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setRecipientType("employee")}
                      className={cn(
                        "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all min-h-[48px]",
                        recipientType === "employee"
                          ? "border-[#1E40AF] bg-[#1E40AF]/10 text-[#1E40AF]"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      )}
                    >
                      Employee
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientType("casual")}
                      className={cn(
                        "flex-1 rounded-lg border py-2.5 text-sm font-medium transition-all min-h-[48px]",
                        recipientType === "casual"
                          ? "border-[#1E40AF] bg-[#1E40AF]/10 text-[#1E40AF]"
                          : "border-gray-300 text-gray-500 hover:border-gray-400"
                      )}
                    >
                      Casual Worker
                    </button>
                  </div>

                  {recipientType === "employee" ? (
                    <select
                      value={recipientEmployeeId}
                      onChange={(e) => setRecipientEmployeeId(e.target.value)}
                      className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-[#333333] min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]"
                    >
                      <option value="">Select employee...</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.pt_code})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      placeholder="Casual worker name"
                      value={recipientFreetext}
                      onChange={(e) => setRecipientFreetext(e.target.value)}
                    />
                  )}
                </div>

                {/* Category */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PettyCashCategory)}
                    className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-[#333333] min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Amount */}
                <Input
                  label="Amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />

                {/* Reason */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">
                    Reason
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    placeholder="What's it for?"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-sm text-[#333333] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6] resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  loading={submitting}
                  className="mt-2"
                >
                  Give Cash
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Open transactions */}
          <Card padding="none">
            <div className="px-5 pt-5 pb-3">
              <CardTitle>
                Open Transactions{" "}
                <span className="text-sm font-normal text-gray-400">
                  ({openTransactions.length})
                </span>
              </CardTitle>
            </div>
            <div className="divide-y divide-gray-100">
              {openTransactions.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-gray-400">
                  No open transactions
                </p>
              )}
              {openTransactions.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSlipTarget(t)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 min-h-[56px]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#333333] truncate">
                      {t.employee_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(t.date)} &middot;{" "}
                      {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-[#333333]">
                      {formatCurrency(t.amount)}
                    </p>
                    <Badge color={STATUS_BADGE[t.status].color}>
                      {STATUS_BADGE[t.status].label}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* --- SLIP RETURN TAB --- */}
      {tab === "slips" && (
        <Card padding="none">
          <div className="px-5 pt-5 pb-3">
            <CardTitle>
              Awaiting Slips{" "}
              <span className="text-sm font-normal text-gray-400">
                ({openTransactions.length})
              </span>
            </CardTitle>
          </div>
          <div className="divide-y divide-gray-100">
            {openTransactions.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">
                All slips returned
              </p>
            )}
            {openTransactions.map((t) => (
              <button
                key={t.id}
                onClick={() => setSlipTarget(t)}
                className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 min-h-[56px]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 shrink-0">
                  <Camera className="h-5 w-5 text-amber-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#333333] truncate">
                    {t.employee_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(t.date)} &middot; {t.reason || "No reason given"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-[#333333]">
                    {formatCurrency(t.amount)}
                  </p>
                  <Badge color={STATUS_BADGE[t.status].color}>
                    {STATUS_BADGE[t.status].label}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* --- HISTORY TAB --- */}
      {tab === "history" && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <Card padding="md">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-xs font-medium text-gray-500">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as PettyCashOutStatus | "all")}
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                >
                  <option value="all">All</option>
                  <option value="open">Open</option>
                  <option value="squared">Squared</option>
                  <option value="partial">Partial</option>
                  <option value="converted_to_loan">Loan</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-xs font-medium text-gray-500">From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-xs font-medium text-gray-500">To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>
              <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-gray-500">Recipient</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search name..."
                    value={filterRecipient}
                    onChange={(e) => setFilterRecipient(e.target.value)}
                    className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Recipient</th>
                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Category</th>
                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Amount</th>
                    <th className="px-5 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredTransactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-gray-400">
                        No transactions found
                      </td>
                    </tr>
                  )}
                  {filteredTransactions.map((t) => (
                    <tr
                      key={t.id}
                      className="transition-colors hover:bg-gray-50 cursor-pointer"
                      onClick={() => {
                        if (t.status === "open" || t.status === "partial") {
                          setSlipTarget(t);
                        }
                      }}
                    >
                      <td className="px-5 py-3.5 whitespace-nowrap text-[#333333]">
                        {formatDate(t.date)}
                      </td>
                      <td className="px-5 py-3.5 text-[#333333] font-medium">
                        {t.employee_name}
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 capitalize">
                        {CATEGORIES.find((c) => c.value === t.category)?.label || t.category}
                      </td>
                      <td className="px-5 py-3.5 text-right font-semibold text-[#333333]">
                        {formatCurrency(t.amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge color={STATUS_BADGE[t.status].color}>
                          {STATUS_BADGE[t.status].label}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* --- MODALS --- */}
      {showCashIn && (
        <CashInModal
          onClose={() => setShowCashIn(false)}
          onSaved={() => {
            setShowCashIn(false);
            fetchData();
          }}
        />
      )}

      {slipTarget && (
        <SlipReturnModal
          transaction={slipTarget}
          onClose={() => setSlipTarget(null)}
          onSaved={() => {
            setSlipTarget(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}
