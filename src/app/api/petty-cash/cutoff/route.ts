import { NextResponse } from "next/server";
import { createServiceRoleSupabase } from "@/lib/supabase/server";

/**
 * Petty Cash Cutoff — Thursday 16:00 SAST
 *
 * Finds all open/partial petty_cash_outs where the recipient is a permanent employee.
 * Creates loan rows for unreconciled amounts.
 * Updates petty_cash_out status to converted_to_loan.
 * Links loan.petty_cash_ref to the original transaction.
 */
export async function POST() {
  try {
    const supabase = await createServiceRoleSupabase();

    // 1. Find all open/partial petty cash outs for employees
    const { data: openOuts, error: fetchError } = await supabase
      .from("petty_cash_outs")
      .select("*")
      .in("status", ["open", "partial"])
      .eq("recipient_type", "employee")
      .not("recipient_employee_id", "is", null);

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to fetch open transactions", detail: fetchError.message },
        { status: 500 }
      );
    }

    if (!openOuts || openOuts.length === 0) {
      return NextResponse.json({
        message: "No open employee transactions to convert",
        converted: 0,
        loans_created: 0,
      });
    }

    // 2. For each, calculate unreconciled amount (amount minus any slip returns)
    const results: {
      transaction_id: string;
      employee_id: string;
      original_amount: number;
      slip_total: number;
      shortfall: number;
      loan_id: string | null;
    }[] = [];

    for (const out of openOuts) {
      // Get sum of slip amounts for this transaction
      const { data: slips } = await supabase
        .from("petty_cash_slips")
        .select("slip_amount")
        .eq("petty_cash_out_id", out.id);

      const slipTotal = (slips || []).reduce(
        (sum: number, s: { slip_amount: number }) => sum + s.slip_amount,
        0
      );

      const shortfall = out.amount - slipTotal;

      if (shortfall <= 0) {
        // Already squared, just update status
        await supabase
          .from("petty_cash_outs")
          .update({ status: "squared", updated_at: new Date().toISOString() })
          .eq("id", out.id);

        results.push({
          transaction_id: out.id,
          employee_id: out.recipient_employee_id,
          original_amount: out.amount,
          slip_total: slipTotal,
          shortfall: 0,
          loan_id: null,
        });
        continue;
      }

      // 3. Create loan row
      const { data: loan, error: loanError } = await supabase
        .from("loans")
        .insert({
          employee_id: out.recipient_employee_id,
          date_advanced: new Date().toISOString().slice(0, 10),
          amount: shortfall,
          weekly_deduction: shortfall, // Full deduction next payroll
          outstanding: shortfall,
          purpose: `Petty cash shortfall — ${out.category} (${out.date})`,
          auto_generated_from_petty: true,
          petty_cash_ref: out.id,
          status: "active",
        })
        .select("id")
        .single();

      if (loanError) {
        console.error(
          `Failed to create loan for transaction ${out.id}:`,
          loanError.message
        );
        results.push({
          transaction_id: out.id,
          employee_id: out.recipient_employee_id,
          original_amount: out.amount,
          slip_total: slipTotal,
          shortfall,
          loan_id: null,
        });
        continue;
      }

      // 4. Update petty_cash_out status
      await supabase
        .from("petty_cash_outs")
        .update({
          status: "converted_to_loan",
          updated_at: new Date().toISOString(),
        })
        .eq("id", out.id);

      // 5. Audit log
      await supabase.from("audit_log").insert({
        action: "petty_cash_cutoff",
        entity_type: "petty_cash_out",
        entity_id: out.id,
        after_state: {
          loan_id: loan.id,
          shortfall,
          slip_total: slipTotal,
          original_amount: out.amount,
        },
      });

      results.push({
        transaction_id: out.id,
        employee_id: out.recipient_employee_id,
        original_amount: out.amount,
        slip_total: slipTotal,
        shortfall,
        loan_id: loan.id,
      });
    }

    const loansCreated = results.filter((r) => r.loan_id !== null).length;
    const totalShortfall = results.reduce((s, r) => s + r.shortfall, 0);

    return NextResponse.json({
      message: `Cutoff complete. ${loansCreated} loans created.`,
      converted: openOuts.length,
      loans_created: loansCreated,
      total_shortfall: totalShortfall,
      details: results,
    });
  } catch (err) {
    console.error("Petty cash cutoff error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
