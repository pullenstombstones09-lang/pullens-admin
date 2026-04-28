import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceRoleSupabase } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are Pullens Tombstones' HR compliance advisor. You provide expert guidance on South African labour law for a tombstone manufacturing business with approximately 38 employees in Pietermaritzburg, KwaZulu-Natal.

You MUST base all advice on:

1. **Labour Relations Act 66 of 1995 (LRA)** — especially sections on unfair dismissal (s188, s189), unfair labour practice (s186), and the right to fair procedure.
2. **Basic Conditions of Employment Act 75 of 1997 (BCEA)** — working hours, leave, termination notice periods.
3. **Code of Good Practice: Dismissal (Schedule 8 of the LRA, updated September 2025)** — substantive and procedural fairness requirements.
4. **CCMA Guidelines on Misconduct Arbitrations** — burden of proof, progressive discipline.

## Pullens Disciplinary Code

### Category A — Minor Misconduct (Progressive)
Offences: Late coming, leaving early without permission, untidy work area, failure to clock in/out, personal phone use during work hours, minor negligence.
Sanctions: 1st offence → Verbal warning (valid 3 months). 2nd offence → Written warning (valid 6 months). 3rd offence → Final written warning (valid 12 months). 4th offence → Dismissal after hearing.

### Category B — Serious Misconduct (Accelerated Progressive)
Offences: Absent without leave (AWOL), negligence causing damage, insubordination (refusal of reasonable instruction), failure to follow safety procedures, horseplay, sleeping on duty.
Sanctions: 1st offence → Written warning (valid 6 months). 2nd offence → Final written warning (valid 12 months). 3rd offence → Dismissal after hearing.

### Category C — Gross Misconduct (Possible Summary Dismissal)
Offences: Theft, fraud, assault/fighting, being under the influence of alcohol/drugs at work, gross insubordination, wilful damage to property, sexual harassment, bringing the company into disrepute, possession of dangerous weapons.
Sanctions: 1st offence → Disciplinary hearing, possible dismissal. Always requires formal hearing with chairperson, notice of charges, right to representation.

## Critical Legal Principles

- **Audi alteram partem**: The employee MUST always be given an opportunity to state their case BEFORE any sanction is imposed. No exceptions.
- **Progressive discipline**: Dismissal should generally be a last resort, except for Category C offences where trust has been irreparably broken.
- **Substantive fairness**: Was there a valid reason for the action? Was the rule reasonable? Did the employee know the rule? Was the rule applied consistently?
- **Procedural fairness**: Was the employee notified of the charges? Given time to prepare? Allowed representation? Given a chance to respond? Was the decision-maker impartial?
- **CCMA exposure**: An unfair dismissal referral can be lodged within 30 days. Reinstatement or compensation of up to 12 months' remuneration can be awarded.
- **Prior warnings**: Always check the employee's disciplinary record. Expired warnings cannot be used for progressive discipline but may show a pattern.
- **Consistency**: Similar offences must receive similar sanctions across employees, or the employer risks an unfair discrimination / unfair labour practice finding.

## Response Format

You MUST respond with valid JSON in exactly this structure (no markdown, no wrapping):

{
  "classification": {
    "category": "A" | "B" | "C",
    "misconduct_type": "string — name of the offence",
    "description": "string — brief description of why this category applies"
  },
  "legal_framework": [
    "string — cite specific legislation sections, e.g. 'LRA s188(1)(a) — fair reason for dismissal'",
    "string — at least 3 citations"
  ],
  "steps": [
    "string — numbered procedural steps to follow, in order",
    "string — include investigation, notice, hearing, outcome steps as appropriate"
  ],
  "documents": [
    "string — list each document needed, e.g. 'Written notification of charges'",
    "string — include warning forms, hearing notices, outcome letters as appropriate"
  ],
  "ccma_risk": "string — specific CCMA exposure warning for this scenario, including potential remedies and timeframes",
  "recommended_level": "verbal" | "written" | "final" | "hearing"
}

NEVER recommend dismissal without a hearing. NEVER skip progressive discipline for Category A or B offences unless the employee has prior active warnings. ALWAYS cite specific legislation. ALWAYS warn about CCMA exposure.`;

interface RequestBody {
  employee_id: string;
  incident_description: string;
  incident_type: string;
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get("pullens-user");
    let advisedBy: string | null = null;
    if (userCookie?.value) {
      try {
        const parsed = JSON.parse(decodeURIComponent(userCookie.value));
        advisedBy = parsed.name || parsed.id || null;
      } catch {}
    }

    const body = (await request.json()) as RequestBody;
    const { employee_id, incident_description, incident_type } = body;

    if (!employee_id || !incident_description) {
      return NextResponse.json(
        { error: "employee_id and incident_description are required" },
        { status: 400 }
      );
    }

    const supabase = await createServiceRoleSupabase();

    // Fetch employee data
    const { data: employee, error: empError } = await supabase
      .from("employees")
      .select("id, full_name, pt_code, start_date, occupation, status")
      .eq("id", employee_id)
      .single();

    if (empError || !employee) {
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    // Fetch prior warnings
    const { data: warnings } = await supabase
      .from("warnings")
      .select("id, category, level, offence, issued_date, expiry_date, status")
      .eq("employee_id", employee_id)
      .order("issued_date", { ascending: false });

    // Fetch prior incidents
    const { data: priorIncidents } = await supabase
      .from("incidents")
      .select("id, incident_date, description, classification")
      .eq("employee_id", employee_id)
      .order("incident_date", { ascending: false })
      .limit(10);

    // Build context for Claude
    const activeWarnings = (warnings || []).filter((w) => w.status === "active");
    const warningsSummary =
      activeWarnings.length > 0
        ? activeWarnings
            .map(
              (w) =>
                `${w.level} warning (Category ${w.category}) for "${w.offence}" on ${w.issued_date}, expires ${w.expiry_date || "N/A"}`
            )
            .join("\n")
        : "No active warnings on record.";

    const incidentsSummary =
      (priorIncidents || []).length > 0
        ? (priorIncidents || [])
            .map(
              (i) =>
                `${i.incident_date}: ${i.description} (${i.classification || "unclassified"})`
            )
            .join("\n")
        : "No prior incidents on record.";

    const startDate = employee.start_date || "Unknown";
    const yearsService = employee.start_date
      ? Math.floor(
          (Date.now() - new Date(employee.start_date).getTime()) /
            (365.25 * 24 * 60 * 60 * 1000)
        )
      : null;

    const userPrompt = `Employee: ${employee.full_name} (${employee.pt_code})
Job title: ${employee.occupation || "General worker"}
Start date: ${startDate}${yearsService !== null ? ` (${yearsService} years service)` : ""}
Status: ${employee.status}

ACTIVE WARNINGS:
${warningsSummary}

PRIOR INCIDENTS:
${incidentsSummary}

CURRENT INCIDENT:
Type: ${incident_type}
Description: ${incident_description}

Provide your compliance advice as the specified JSON structure.`;

    // Call Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: SYSTEM_PROMPT,
    });

    // Extract text response
    const textBlock = message.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No response from AI" },
        { status: 502 }
      );
    }

    // Parse JSON response
    let advisorResponse;
    try {
      // Try to extract JSON from the response (handle potential markdown wrapping)
      let jsonStr = textBlock.text.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }
      advisorResponse = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse advisor response:", textBlock.text);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    // Log to incidents table
    const { error: incidentError } = await supabase.from("incidents").insert({
      employee_id,
      incident_date: new Date().toISOString().slice(0, 10),
      description: incident_description,
      classification: `Category ${advisorResponse.classification?.category || "?"} — ${advisorResponse.classification?.misconduct_type || incident_type}`,
      advisor_output: advisorResponse,
      advised_by: advisedBy,
      advised_at: new Date().toISOString(),
      resolved: false,
    });

    if (incidentError) {
      console.error("Incident save failed:", incidentError.message);
      advisorResponse._warning = "Advice generated but could not be saved to history";
    }

    // Audit log
    await supabase.from("audit_log").insert({
      action: "hr_advisor_consultation",
      entity_type: "incident",
      entity_id: employee_id,
      after_state: {
        incident_type,
        incident_description,
        classification: advisorResponse.classification,
        recommended_level: advisorResponse.recommended_level,
      },
    });

    return NextResponse.json(advisorResponse);
  } catch (error: any) {
    console.error("HR Advisor error:", error);
    const message =
      error?.status === 401
        ? "AI service authentication failed — check API key"
        : error?.status === 400
        ? "AI service rejected the request — try rephrasing"
        : error?.status === 429
        ? "AI service is busy — try again in a moment"
        : "AI service unavailable — try again in a moment";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
