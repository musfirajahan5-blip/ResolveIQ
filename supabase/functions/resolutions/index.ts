// Resolution of an investigation: auto-resolve with real refund settlement, or escalate.
// Ports ResolutionController + ResolutionService + CaseContextService.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STATUS_TEXT: Record<number, string> = {
  200: "OK",
  201: "Created",
  400: "Bad Request",
  404: "Not Found",
  409: "Conflict",
  500: "Internal Server Error",
};

const REFUND_PENDING = "PENDING";
const REFUND_PROCESSED = "PROCESSED";
const STATUS_COMPLETED = "COMPLETED";
const STATUS_RESOLVED = "RESOLVED";
const STATUS_ESCALATED = "ESCALATED";
const STATUS_OPEN = "OPEN";

const DEFAULT_SYSTEM_ACTOR = "SYSTEM_AUTO_RESOLVER";
const MANAGER_QUEUE = "MANAGER_QUEUE";
const SUPPORT_REVIEW_QUEUE = "SUPPORT_REVIEW_QUEUE";

const ACTOR_AUTOMATED = "AUTOMATED";
const ACTOR_SYSTEM = "SYSTEM";

const OUTCOME_AUTO_RESOLVED = "AUTO_RESOLVED";
const OUTCOME_ESCALATED = "ESCALATED";

const PAYMENT_SUCCESS = "SUCCESS";
const DUPLICATE_WINDOW_MINUTES = 60;

const INVESTIGATION_SELECT = "*, ticket:support_tickets(*)";
const ORDER_SELECT = "*, product:products(id, product_code, name, category, price, status)";
const REFUND_SELECT =
  "*, payment:payments(id, payment_code, order_id, amount, payment_method, status, transaction_reference, payment_date)";

type Row = Record<string, unknown>;

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(
  status: number,
  message: string,
  fieldErrors?: Record<string, string>,
): Response {
  const body: Row = {
    timestamp: new Date().toISOString(),
    status,
    error: STATUS_TEXT[status] ?? "Error",
    message,
  };
  if (fieldErrors) body.fieldErrors = fieldErrors;
  return json(status, body);
}

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function num(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function randomCode(prefix: string): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Mirrors ResolutionService.amount(double).
function formatAmount(value: number): string {
  return value.toFixed(2);
}

// ---------------------------------------------------------------- case context

type DuplicatePair = { original: Row; duplicate: Row; minutesApart: number };
type OrderContext = { order: Row | null; linkedByReference: boolean; payments: Row[] };

async function resolveOrderContext(client: SupabaseClient, ticket: Row): Promise<OrderContext> {
  const reference = String(ticket.order_reference ?? "").trim();
  let order: Row | null = null;
  let linkedByReference = false;

  if (reference.length > 0) {
    const { data, error } = await client
      .from("orders")
      .select(ORDER_SELECT)
      .eq("order_code", reference)
      .maybeSingle();
    if (error) throw error;
    order = (data as Row | null) ?? null;
    linkedByReference = order !== null;
  }

  if (!order) {
    const { data, error } = await client
      .from("orders")
      .select(ORDER_SELECT)
      .eq("customer_id", ticket.customer_id as number)
      .order("order_date", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    order = (data as Row | null) ?? null;
  }

  let payments: Row[] = [];
  if (order) {
    const { data, error } = await client
      .from("payments")
      .select("*")
      .eq("order_id", order.id as number)
      .order("payment_date", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    payments = (data ?? []) as Row[];
  }

  return { order, linkedByReference, payments };
}

// A duplicate charge is two successful payments on the same order, for the same
// amount, captured within DUPLICATE_WINDOW_MINUTES of each other.
function detectDuplicatePayments(payments: Row[]): DuplicatePair[] {
  const groups = new Map<number, Row[]>();

  for (const payment of payments) {
    if (String(payment.status ?? "").toUpperCase() !== PAYMENT_SUCCESS) continue;
    const key = Math.round((num(payment.amount) ?? 0) * 100);
    const group = groups.get(key);
    if (group) group.push(payment);
    else groups.set(key, [payment]);
  }

  const duplicates: DuplicatePair[] = [];

  for (const group of groups.values()) {
    for (let i = 1; i < group.length; i++) {
      const original = group[i - 1];
      const duplicate = group[i];
      const minutesApart = Math.trunc(
        (Date.parse(String(duplicate.payment_date)) - Date.parse(String(original.payment_date))) /
          60000,
      );
      if (minutesApart <= DUPLICATE_WINDOW_MINUTES) {
        duplicates.push({ original, duplicate, minutesApart });
      }
    }
  }

  return duplicates;
}

async function loadRefundsForOrder(client: SupabaseClient, orderId: number): Promise<Row[]> {
  const { data: payments, error: paymentsError } = await client
    .from("payments")
    .select("id")
    .eq("order_id", orderId);
  if (paymentsError) throw paymentsError;

  const paymentIds = (payments ?? []).map((payment) => payment.id as number);
  if (paymentIds.length === 0) return [];

  const { data, error } = await client
    .from("refunds")
    .select(REFUND_SELECT)
    .in("payment_id", paymentIds)
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Row[];
}

// ---------------------------------------------------------------- audit

async function audit(
  client: SupabaseClient,
  investigationId: number,
  actionId: number | null,
  escalationId: number | null,
  eventType: string,
  actorType: string,
  actorReference: string,
  description: string,
): Promise<Row> {
  const { data, error } = await client
    .from("audit_logs")
    .insert({
      audit_code: randomCode("AUD-"),
      investigation_id: investigationId,
      action_id: actionId,
      escalation_id: escalationId,
      event_type: eventType,
      actor_type: actorType,
      actor_reference: actorReference,
      event_description: description,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Row;
}

async function loadAuditTrail(client: SupabaseClient, investigationId: number): Promise<Row[]> {
  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .eq("investigation_id", investigationId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Row[];
}

// ---------------------------------------------------------------- mapping

function toActionSummary(action: Row): Row {
  return {
    id: action.id,
    actionCode: action.action_code,
    actionType: action.action_type,
    status: action.status,
    description: action.description,
    performedBy: action.performed_by,
    result: action.result,
    executedAt: action.executed_at,
  };
}

function toEscalationSummary(escalation: Row): Row {
  return {
    id: escalation.id,
    escalationCode: escalation.escalation_code,
    reason: escalation.reason,
    priority: escalation.priority,
    status: escalation.status,
    assignedTo: escalation.assigned_to,
    handoffSummary: escalation.handoff_summary,
    escalatedAt: escalation.escalated_at,
  };
}

function toSettlement(refund: Row, newlyCreated: boolean): Row {
  return {
    id: refund.id,
    refundCode: refund.refund_code,
    paymentCode: (refund.payment as Row | null)?.payment_code ?? null,
    amount: num(refund.amount),
    status: refund.status,
    refundReference: refund.refund_reference,
    processedAt: refund.processed_at,
    newlyCreated,
  };
}

function toAuditEntry(log: Row): Row {
  return {
    id: log.id,
    auditCode: log.audit_code,
    eventType: log.event_type,
    actorType: log.actor_type,
    actorReference: log.actor_reference,
    eventDescription: log.event_description,
    createdAt: log.created_at,
  };
}

function mapPriority(riskLevel: unknown): string {
  if (riskLevel === null || riskLevel === undefined) return "MEDIUM";
  switch (String(riskLevel).toUpperCase()) {
    case "HIGH":
      return "HIGH";
    case "LOW":
      return "LOW";
    default:
      return "MEDIUM";
  }
}

function buildHandoffSummary(investigation: Row, context: OrderContext): string {
  let summary = "Investigation " + investigation.investigation_code +
    " requires manual handling. Root cause: " + investigation.root_cause +
    ". Intent: " + investigation.intent +
    ". Confidence: " + (num(investigation.confidence) ?? investigation.confidence) +
    ". Risk level: " + investigation.risk_level + ".";

  const order = context.order;
  if (order !== null) {
    summary += " Order: " + order.order_code + ".";
    const paymentCodes = context.payments.map((payment) => payment.payment_code);
    if (paymentCodes.length > 0) {
      summary += " Payments: " + paymentCodes.join(", ") + ".";
    }
  }

  return summary;
}

function buildCustomerResponse(
  investigation: Row,
  order: Row | null,
  settledCodes: string[],
  totalSettled: number,
  noAdjustment: boolean,
): string {
  const orderCode = order === null ? "on file" : order.order_code;

  if (noAdjustment) {
    return "Investigation " + investigation.investigation_code +
      " has been reviewed. No financial adjustment was required for order " +
      orderCode + ".";
  }

  return "Your case " + investigation.investigation_code +
    " has been resolved. Refund(s) " + settledCodes.join(", ") +
    " totalling " + formatAmount(totalSettled) +
    " have been processed for order " + orderCode + ".";
}

// ---------------------------------------------------------------- request options

type ResolveOptions = { performedBy: string; assignedTo: string | null; notes: string | null };

type OptionsResult = { fieldErrors: Record<string, string> } | { options: ResolveOptions };

function buildOptions(body: Row): OptionsResult {
  const fieldErrors: Record<string, string> = {};

  const performedBy = body.performedBy;
  const assignedTo = body.assignedTo;
  const notes = body.notes;

  if (performedBy !== null && performedBy !== undefined && String(performedBy).length > 100) {
    fieldErrors.performedBy = "performedBy must be at most 100 characters";
  }
  if (assignedTo !== null && assignedTo !== undefined && String(assignedTo).length > 100) {
    fieldErrors.assignedTo = "assignedTo must be at most 100 characters";
  }
  if (notes !== null && notes !== undefined && String(notes).length > 1000) {
    fieldErrors.notes = "notes must be at most 1000 characters";
  }

  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const performedByValue = performedBy !== null && performedBy !== undefined &&
      String(performedBy).trim() !== ""
    ? String(performedBy).trim()
    : DEFAULT_SYSTEM_ACTOR;

  const assignedToValue = assignedTo !== null && assignedTo !== undefined &&
      String(assignedTo).trim() !== ""
    ? String(assignedTo).trim()
    : null;

  const notesValue = notes !== null && notes !== undefined && String(notes).trim() !== ""
    ? String(notes).trim()
    : null;

  return {
    options: {
      performedBy: performedByValue,
      assignedTo: assignedToValue,
      notes: notesValue,
    },
  };
}

// ---------------------------------------------------------------- replay

async function buildReplayResponse(
  client: SupabaseClient,
  investigation: Row,
  actions: Row[],
  escalations: Row[],
): Promise<Row> {
  const action = actions.length > 0 ? actions[0] : null;
  const escalation = escalations.length > 0 ? escalations[0] : null;
  const ticket = investigation.ticket as Row;

  let outcome: string;
  let settlements: Row[];

  if (action !== null) {
    outcome = OUTCOME_AUTO_RESOLVED;
    const context = await resolveOrderContext(client, ticket);
    settlements = context.order === null
      ? []
      : (await loadRefundsForOrder(client, context.order.id as number)).map((refund) =>
        toSettlement(refund, false)
      );
  } else {
    outcome = OUTCOME_ESCALATED;
    settlements = [];
  }

  const auditTrail = await loadAuditTrail(client, investigation.id as number);

  return {
    investigationId: investigation.id,
    investigationCode: investigation.investigation_code,
    decision: investigation.decision,
    outcome,
    ticketStatus: ticket.status,
    customerResponse: investigation.customer_response ?? null,
    alreadyResolved: true,
    action: action === null ? null : toActionSummary(action),
    escalation: escalation === null ? null : toEscalationSummary(escalation),
    refundSettlements: settlements,
    auditTrail: auditTrail.map(toAuditEntry),
  };
}

// ---------------------------------------------------------------- auto-resolve

async function executeAutoResolve(
  client: SupabaseClient,
  investigation: Row,
  options: ResolveOptions,
  ticket: Row,
  previousTicketStatus: unknown,
): Promise<Row> {
  const performedBy = options.performedBy;
  const context = await resolveOrderContext(client, ticket);
  const duplicates = detectDuplicatePayments(context.payments);
  const order = context.order;

  const currentRefunds = order === null
    ? []
    : await loadRefundsForOrder(client, order.id as number);
  const pendingRefunds = currentRefunds.filter(
    (refund) => String(refund.status ?? "").toUpperCase() === REFUND_PENDING,
  );

  const nowIso = new Date().toISOString();
  const settlements: Row[] = [];
  const settledCodes: string[] = [];
  let totalSettled = 0;

  if (pendingRefunds.length > 0) {
    for (const refund of pendingRefunds) {
      const existingReference = refund.refund_reference;
      const refundReference =
        existingReference === null || existingReference === undefined ||
          String(existingReference).trim() === ""
          ? randomCode("RFND-AUTO-")
          : existingReference;

      const { data: updated, error } = await client
        .from("refunds")
        .update({
          status: REFUND_PROCESSED,
          processed_at: nowIso,
          refund_reference: refundReference,
        })
        .eq("id", refund.id as number)
        .select(REFUND_SELECT)
        .single();
      if (error) throw error;

      settlements.push(toSettlement(updated as Row, false));
      settledCodes.push(String(updated.refund_code));
      totalSettled += num(updated.amount) ?? 0;

      await audit(
        client,
        investigation.id as number,
        null,
        null,
        "REFUND_SETTLED",
        ACTOR_AUTOMATED,
        performedBy,
        "Refund " + updated.refund_code +
          " settled to " + REFUND_PROCESSED +
          " with reference " + updated.refund_reference + ".",
      );
    }
  } else if (duplicates.length > 0 && order !== null) {
    for (const pair of duplicates) {
      const duplicatePayment = pair.duplicate;

      const { data: created, error } = await client
        .from("refunds")
        .insert({
          refund_code: randomCode("RFD-"),
          payment_id: duplicatePayment.id as number,
          amount: num(duplicatePayment.amount),
          status: REFUND_PROCESSED,
          reason: "Auto-refund for duplicate charge on payment " +
            duplicatePayment.payment_code + " (investigation " +
            investigation.investigation_code + ", original payment " +
            pair.original.payment_code + ")",
          refund_reference: randomCode("RFND-AUTO-"),
          requested_at: nowIso,
          processed_at: nowIso,
        })
        .select(REFUND_SELECT)
        .single();
      if (error) throw error;

      settlements.push(toSettlement(created as Row, true));
      settledCodes.push(String(created.refund_code));
      totalSettled += num(created.amount) ?? 0;

      await audit(
        client,
        investigation.id as number,
        null,
        null,
        "REFUND_CREATED",
        ACTOR_AUTOMATED,
        performedBy,
        "Refund " + created.refund_code +
          " created and processed against payment " + duplicatePayment.payment_code +
          " for duplicate of payment " + pair.original.payment_code + ".",
      );
    }
  }
  // else: no pending refunds and no duplicates -> no financial adjustment required.

  const actionResult = settlements.length === 0
    ? "NO_FINANCIAL_ADJUSTMENT_REQUIRED"
    : "SUCCESS";

  const orderCode = order === null ? "(none)" : order.order_code;
  let description: string;

  if (settlements.length === 0) {
    description = "Auto-resolution reviewed order " + orderCode +
      ": no pending refunds or duplicate charges required settlement.";
  } else {
    description = "Auto-resolved investigation " + investigation.investigation_code +
      " by settling refund(s) " + settledCodes.join(", ") +
      " totalling " + formatAmount(totalSettled) + " against order " + orderCode + ".";
  }

  if (options.notes !== null) {
    description = description + " Notes: " + options.notes;
  }

  const { data: action, error: actionError } = await client
    .from("actions")
    .insert({
      action_code: randomCode("ACT-"),
      investigation_id: investigation.id as number,
      action_type: investigation.recommended_action,
      status: STATUS_COMPLETED,
      description,
      performed_by: performedBy,
      result: actionResult,
      executed_at: nowIso,
    })
    .select("*")
    .single();
  if (actionError) throw actionError;

  await audit(
    client,
    investigation.id as number,
    action.id as number,
    null,
    "ACTION_EXECUTED",
    ACTOR_AUTOMATED,
    performedBy,
    "Action " + action.action_code + " (" + action.action_type +
      ") executed with result " + actionResult + ".",
  );

  const { error: ticketError } = await client
    .from("support_tickets")
    .update({ status: STATUS_RESOLVED })
    .eq("id", ticket.id as number);
  if (ticketError) throw ticketError;

  await audit(
    client,
    investigation.id as number,
    null,
    null,
    "TICKET_STATUS_CHANGED",
    ACTOR_AUTOMATED,
    performedBy,
    "Ticket " + ticket.case_id + " status changed from " +
      previousTicketStatus + " to " + STATUS_RESOLVED + ".",
  );

  const customerResponse = buildCustomerResponse(
    investigation,
    order,
    settledCodes,
    totalSettled,
    settlements.length === 0,
  );

  const { error: investigationError } = await client
    .from("investigations")
    .update({ customer_response: customerResponse })
    .eq("id", investigation.id as number);
  if (investigationError) throw investigationError;

  const auditTrail = await loadAuditTrail(client, investigation.id as number);

  return {
    investigationId: investigation.id,
    investigationCode: investigation.investigation_code,
    decision: investigation.decision,
    outcome: OUTCOME_AUTO_RESOLVED,
    ticketStatus: STATUS_RESOLVED,
    customerResponse,
    alreadyResolved: false,
    action: toActionSummary(action as Row),
    escalation: null,
    refundSettlements: settlements,
    auditTrail: auditTrail.map(toAuditEntry),
  };
}

// ---------------------------------------------------------------- escalation

async function executeEscalation(
  client: SupabaseClient,
  investigation: Row,
  options: ResolveOptions,
  ticket: Row,
  previousTicketStatus: unknown,
  defaultQueue: string,
): Promise<Row> {
  const performedBy = options.performedBy;
  const context = await resolveOrderContext(client, ticket);

  const assignedTo = options.assignedTo ?? defaultQueue;
  const priority = mapPriority(investigation.risk_level);

  let reason = "Investigation " + investigation.investigation_code +
    " routed to escalation. Decision: " + investigation.decision +
    ", policy check: " + investigation.policy_check +
    ", authorization check: " + investigation.authorization_check + ".";

  if (options.notes !== null) {
    reason = reason + " Notes: " + options.notes;
  }

  const handoffSummary = buildHandoffSummary(investigation, context);

  const { data: escalation, error: escalationError } = await client
    .from("escalations")
    .insert({
      escalation_code: randomCode("ESC-"),
      investigation_id: investigation.id as number,
      reason,
      priority,
      status: STATUS_OPEN,
      assigned_to: assignedTo,
      handoff_summary: handoffSummary,
    })
    .select("*")
    .single();
  if (escalationError) throw escalationError;

  await audit(
    client,
    investigation.id as number,
    null,
    escalation.id as number,
    "ESCALATION_CREATED",
    ACTOR_SYSTEM,
    performedBy,
    "Escalation " + escalation.escalation_code +
      " created and assigned to " + assignedTo +
      " with priority " + priority + ".",
  );

  const { error: ticketError } = await client
    .from("support_tickets")
    .update({ status: STATUS_ESCALATED })
    .eq("id", ticket.id as number);
  if (ticketError) throw ticketError;

  await audit(
    client,
    investigation.id as number,
    null,
    null,
    "TICKET_STATUS_CHANGED",
    ACTOR_SYSTEM,
    performedBy,
    "Ticket " + ticket.case_id + " status changed from " +
      previousTicketStatus + " to " + STATUS_ESCALATED + ".",
  );

  const { error: investigationError } = await client
    .from("investigations")
    .update({ escalation_reason: reason })
    .eq("id", investigation.id as number);
  if (investigationError) throw investigationError;

  const auditTrail = await loadAuditTrail(client, investigation.id as number);

  return {
    investigationId: investigation.id,
    investigationCode: investigation.investigation_code,
    decision: investigation.decision,
    outcome: OUTCOME_ESCALATED,
    ticketStatus: STATUS_ESCALATED,
    customerResponse: investigation.customer_response ?? null,
    alreadyResolved: false,
    action: null,
    escalation: toEscalationSummary(escalation as Row),
    refundSettlements: [],
    auditTrail: auditTrail.map(toAuditEntry),
  };
}

// ---------------------------------------------------------------- entry point

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Row = {};
  try {
    const raw = await req.text();
    body = raw ? (JSON.parse(raw) as Row) : {};
  } catch {
    return errorResponse(400, "Request body must be valid JSON");
  }

  const url = new URL(req.url);
  const action = String(body.action ?? url.searchParams.get("action") ?? "resolve");
  const investigationIdParam = body.investigationId ?? url.searchParams.get("investigationId");
  const ticketIdParam = body.ticketId ?? url.searchParams.get("ticketId");

  console.log(
    `[resolutions] action=${action} investigationId=${investigationIdParam ?? "-"} ticketId=${ticketIdParam ?? "-"}`,
  );

  const hasInvestigationId = investigationIdParam !== undefined && investigationIdParam !== null &&
    investigationIdParam !== "";
  const hasTicketId = ticketIdParam !== undefined && ticketIdParam !== null && ticketIdParam !== "";

  if (!hasInvestigationId && !hasTicketId) {
    return errorResponse(400, "Validation failed", {
      investigationId: "investigationId or ticketId is required",
    });
  }

  try {
    const client = adminClient();

    let query = client.from("investigations").select(INVESTIGATION_SELECT);
    query = hasInvestigationId
      ? query.eq("id", Number(investigationIdParam))
      : query.eq("ticket_id", Number(ticketIdParam));

    const { data: investigationData, error: investigationError } = await query.maybeSingle();
    if (investigationError) throw investigationError;

    if (!investigationData) {
      return errorResponse(
        404,
        hasInvestigationId
          ? `Investigation not found with id: ${investigationIdParam}`
          : `No investigation found for ticket id: ${ticketIdParam}`,
      );
    }

    const investigation = investigationData as Row;
    const investigationId = investigation.id as number;

    const { data: actionRows, error: actionsError } = await client
      .from("actions")
      .select("*")
      .eq("investigation_id", investigationId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (actionsError) throw actionsError;

    const { data: escalationRows, error: escalationsError } = await client
      .from("escalations")
      .select("*")
      .eq("investigation_id", investigationId)
      .order("id", { ascending: true });
    if (escalationsError) throw escalationsError;

    const actions = (actionRows ?? []) as Row[];
    const escalations = (escalationRows ?? []) as Row[];

    if (action === "get") {
      if (actions.length === 0 && escalations.length === 0) {
        return errorResponse(
          404,
          `No resolution outcome found for investigation id: ${investigationIdParam}`,
        );
      }
      return json(
        200,
        await buildReplayResponse(client, investigation, actions, escalations),
      );
    }

    if (action !== "resolve") {
      return errorResponse(400, `Unsupported action: ${action}`);
    }

    if (String(investigation.status ?? "").toUpperCase() !== STATUS_COMPLETED) {
      return errorResponse(
        409,
        "Investigation " + investigation.investigation_code +
          " cannot be resolved (current status: " +
          investigation.status + ", required: " + STATUS_COMPLETED + ")",
      );
    }

    const optionsResult = buildOptions(body);
    if ("fieldErrors" in optionsResult) {
      return errorResponse(400, "Validation failed", optionsResult.fieldErrors);
    }
    const resolvedOptions = optionsResult.options;

    // Idempotency: a prior outcome is replayed untouched.
    if (actions.length > 0 || escalations.length > 0) {
      console.log(`[resolutions] replaying existing outcome for investigation=${investigationId}`);
      return json(
        201,
        await buildReplayResponse(client, investigation, actions, escalations),
      );
    }

    const ticket = investigation.ticket as Row;
    const previousTicketStatus = ticket.status;

    const decision = String(investigation.decision ?? "");
    const autoResolve = decision.toUpperCase() === "AUTO_RESOLVE";
    const actorType = autoResolve ? ACTOR_AUTOMATED : ACTOR_SYSTEM;

    await audit(
      client,
      investigationId,
      null,
      null,
      "RESOLUTION_STARTED",
      actorType,
      resolvedOptions.performedBy,
      "Resolution started for investigation " + investigation.investigation_code +
        " with decision " + decision + ".",
    );

    if (autoResolve) {
      const response = await executeAutoResolve(
        client,
        investigation,
        resolvedOptions,
        ticket,
        previousTicketStatus,
      );
      console.log(`[resolutions] investigation=${investigationId} outcome=AUTO_RESOLVED`);
      return json(201, response);
    }

    const defaultQueue = decision.toUpperCase() === "MANAGER_APPROVAL_REQUIRED" ||
        decision.toUpperCase() === "ESCALATE"
      ? MANAGER_QUEUE
      : SUPPORT_REVIEW_QUEUE;

    const response = await executeEscalation(
      client,
      investigation,
      resolvedOptions,
      ticket,
      previousTicketStatus,
      defaultQueue,
    );
    console.log(`[resolutions] investigation=${investigationId} outcome=ESCALATED queue=${defaultQueue}`);
    return json(201, response);
  } catch (err) {
    console.error(`[resolutions] action=${action} failed:`, err);
    return errorResponse(500, err instanceof Error ? err.message : "Unexpected error");
  }
});
