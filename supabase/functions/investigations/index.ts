// Investigation run for a support ticket.
// Ports InvestigationController + InvestigationService + CaseContextService.
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
const POLICY_ACTIVE = "ACTIVE";
const PAYMENT_SUCCESS = "SUCCESS";
const DUPLICATE_WINDOW_MINUTES = 60;

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

function errorResponse(status: number, message: string): Response {
  return json(status, {
    timestamp: new Date().toISOString(),
    status,
    error: STATUS_TEXT[status] ?? "Error",
    message,
  });
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

// Mirrors InvestigationService.amount().
function amount(value: unknown): string {
  const parsed = num(value);
  return parsed === null ? "n/a" : parsed.toFixed(2);
}

// Mirrors InvestigationService.timestamp() (yyyy-MM-dd HH:mm, server local time).
function timestamp(value: unknown): string {
  if (value === null || value === undefined) return "unknown";
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return "unknown";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ` +
    `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
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

async function loadRefundsForOrder(
  client: SupabaseClient,
  order: Row,
): Promise<Row[]> {
  const { data: payments, error: paymentsError } = await client
    .from("payments")
    .select("id")
    .eq("order_id", order.id as number);
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

// ---------------------------------------------------------------- assessment

type Assessment = {
  intent: string;
  rootCause: string;
  confidence: number;
  riskLevel: string;
  policy: Row | null;
  policyCheck: string;
  authorizationCheck: string;
  recommendedAction: string;
  decision: string;
  disputedAmount: number;
};

function normalizedCategory(ticket: Row): string {
  return ticket.category === null || ticket.category === undefined
    ? ""
    : String(ticket.category).trim().toUpperCase();
}

function resolveIntent(ticket: Row, hasDuplicates: boolean): string {
  const text = `${ticket.subject ?? ""} ${ticket.description ?? ""}`.toLowerCase();

  if (
    text.includes("duplicate") || text.includes("charged twice") ||
    text.includes("double charge") || text.includes("twice")
  ) {
    return "DUPLICATE_PAYMENT_DISPUTE";
  }
  if (text.includes("refund") || text.includes("money back") || text.includes("reimburse")) {
    return "REFUND_REQUEST";
  }
  if (
    text.includes("not delivered") || text.includes("delivery") ||
    text.includes("shipping") || text.includes("lost package")
  ) {
    return "DELIVERY_ISSUE";
  }
  if (text.includes("cancel")) {
    return "CANCELLATION_REQUEST";
  }
  if (text.includes("damaged") || text.includes("broken") || text.includes("defective")) {
    return "PRODUCT_DAMAGE_CLAIM";
  }

  return hasDuplicates ? "DUPLICATE_PAYMENT_DISPUTE" : "GENERAL_SUPPORT";
}

function buildRootCause(
  ticket: Row,
  context: OrderContext,
  duplicates: DuplicatePair[],
  pendingRefunds: Row[],
): string {
  if (context.order === null) {
    const reference = ticket.order_reference;
    return "No order record could be matched for ticket " + ticket.case_id +
      ". Ticket order reference: " +
      (reference === null || reference === undefined || String(reference).trim() === ""
        ? "none provided"
        : reference) +
      ". Payment history could not be verified without an order.";
  }

  const order = context.order;
  let rootCause = "";

  if (duplicates.length > 0) {
    const pair = duplicates[0];
    rootCause += "Customer was charged " + (duplicates.length + 1) +
      " times for order " + order.order_code +
      ". Payment " + pair.duplicate.payment_code +
      " of " + amount(pair.duplicate.amount) +
      " was captured " + pair.minutesApart +
      " minute(s) after payment " + pair.original.payment_code +
      " for the same amount, which indicates a duplicate charge.";
  }

  if (pendingRefunds.length > 0) {
    const refund = pendingRefunds[0];
    const paymentCode = (refund.payment as Row | null)?.payment_code ?? null;

    if (rootCause.length > 0) rootCause += " ";

    rootCause += "Refund " + refund.refund_code +
      " of " + amount(refund.amount) +
      " against payment " + paymentCode +
      " has been PENDING since " + timestamp(refund.requested_at) +
      ", so the customer has not been reimbursed yet.";
  }

  if (rootCause.length === 0) {
    rootCause += "Order " + order.order_code +
      " has " + context.payments.length +
      " payment record(s) with no duplicate charges and no pending refunds detected.";
  }

  return rootCause;
}

function resolveConfidence(
  context: OrderContext,
  hasDuplicates: boolean,
  hasPendingRefunds: boolean,
): number {
  if (context.order === null) return 0.2;
  if (hasDuplicates && hasPendingRefunds) return 0.95;
  if (hasDuplicates) return 0.9;
  if (hasPendingRefunds) return 0.75;
  return 0.45;
}

function resolveRiskLevel(
  disputedAmount: number,
  hasDuplicates: boolean,
  hasPendingRefunds: boolean,
): string {
  if (!hasDuplicates && !hasPendingRefunds) return "LOW";
  return disputedAmount >= 500.0 ? "HIGH" : "MEDIUM";
}

function resolveRecommendedAction(
  context: OrderContext,
  hasDuplicates: boolean,
  hasPendingRefunds: boolean,
): string {
  if (hasDuplicates && hasPendingRefunds) return "EXPEDITE_PENDING_REFUND";
  if (hasDuplicates) return "INITIATE_DUPLICATE_PAYMENT_REFUND";
  if (hasPendingRefunds) return "FOLLOW_UP_PENDING_REFUND";
  return context.order === null ? "REQUEST_ORDER_DETAILS" : "MANUAL_REVIEW";
}

function allowsAutoResolution(policy: Row | null, disputedAmount: number): boolean {
  if (policy === null) return false;
  const maxAutoRefund = num(policy.maximum_auto_refund_amount);
  return policy.auto_resolution_allowed === true &&
    policy.manager_approval_required !== true &&
    maxAutoRefund !== null &&
    disputedAmount > 0 &&
    disputedAmount <= maxAutoRefund;
}

// Prefers an active policy that authorises auto-resolution for this amount and falls
// back to the first active policy for the category, which then requires review.
function resolvePolicy(policies: Row[], disputedAmount: number): Row | null {
  const autoPolicy = policies.find((policy) => allowsAutoResolution(policy, disputedAmount));
  if (autoPolicy) return autoPolicy;
  return policies.length > 0 ? policies[0] : null;
}

function assess(
  ticket: Row,
  context: OrderContext,
  duplicates: DuplicatePair[],
  pendingRefunds: Row[],
  policies: Row[],
): Assessment {
  const hasDuplicates = duplicates.length > 0;
  const hasPendingRefunds = pendingRefunds.length > 0;

  const disputedAmount = hasDuplicates
    ? duplicates.reduce((total, pair) => total + (num(pair.duplicate.amount) ?? 0), 0)
    : pendingRefunds.reduce((total, refund) => total + (num(refund.amount) ?? 0), 0);

  const category = hasDuplicates ? "PAYMENT" : normalizedCategory(ticket);
  const policy = resolvePolicy(policies, disputedAmount);
  const autoResolutionAllowed = allowsAutoResolution(policy, disputedAmount);

  let policyCheck: string;
  let authorizationCheck: string;
  let decision: string;

  if (!hasDuplicates && !hasPendingRefunds) {
    policyCheck = "NOT_EVALUATED";
    authorizationCheck = "NOT_APPLICABLE";
    decision = context.order === null ? "NEEDS_MORE_INFORMATION" : "MANUAL_REVIEW";
  } else if (policy === null) {
    policyCheck = `NO_MATCHING_POLICY (${category})`;
    authorizationCheck = "MANAGER_APPROVAL_REQUIRED";
    decision = "MANAGER_APPROVAL_REQUIRED";
  } else if (autoResolutionAllowed) {
    policyCheck = `PASS (${policy.policy_code})`;
    authorizationCheck = "AUTO_APPROVED";
    decision = "AUTO_RESOLVE";
  } else {
    policyCheck = `REVIEW_REQUIRED (${policy.policy_code})`;
    authorizationCheck = "MANAGER_APPROVAL_REQUIRED";
    decision = "MANAGER_APPROVAL_REQUIRED";
  }

  return {
    intent: resolveIntent(ticket, hasDuplicates),
    rootCause: buildRootCause(ticket, context, duplicates, pendingRefunds),
    confidence: resolveConfidence(context, hasDuplicates, hasPendingRefunds),
    riskLevel: resolveRiskLevel(disputedAmount, hasDuplicates, hasPendingRefunds),
    policy,
    policyCheck,
    authorizationCheck,
    recommendedAction: resolveRecommendedAction(context, hasDuplicates, hasPendingRefunds),
    decision,
    disputedAmount,
  };
}

// ---------------------------------------------------------------- evidence

function evidenceRow(
  investigationId: number,
  evidenceType: string,
  sourceType: string,
  sourceReference: unknown,
  description: string,
  relevance: string,
): Row {
  return {
    evidence_code: randomCode("EV-"),
    investigation_id: investigationId,
    evidence_type: evidenceType,
    source_type: sourceType,
    source_reference: sourceReference ?? null,
    description,
    relevance,
  };
}

function buildEvidence(
  investigationId: number,
  ticket: Row,
  customer: Row,
  context: OrderContext,
  duplicates: DuplicatePair[],
  refunds: Row[],
  conversations: Row[],
  assessment: Assessment,
): Row[] {
  const evidence: Row[] = [];

  evidence.push(evidenceRow(
    investigationId,
    "TICKET",
    "SUPPORT_TICKET",
    ticket.case_id,
    `Ticket ${ticket.case_id} (${ticket.category}) raised with subject "${ticket.subject}": ${ticket.description}`,
    "HIGH",
  ));

  evidence.push(evidenceRow(
    investigationId,
    "CUSTOMER",
    "CUSTOMER_RECORD",
    customer.customer_code,
    `Customer ${customer.name} (${customer.customer_code}), account status ${customer.status}, contact ${customer.email}.`,
    "MEDIUM",
  ));

  if (context.order === null) {
    const reference = ticket.order_reference;
    evidence.push(evidenceRow(
      investigationId,
      "ORDER",
      "ORDER_RECORD",
      reference,
      "No order record matched ticket reference " +
        (reference === null || reference === undefined || String(reference).trim() === ""
          ? "(none provided)"
          : reference) +
        " and the customer has no orders on file.",
      "HIGH",
    ));
  } else {
    const order = context.order;
    evidence.push(evidenceRow(
      investigationId,
      "ORDER",
      "ORDER_RECORD",
      order.order_code,
      `Order ${order.order_code} for ${order.quantity} x ${(order.product as Row | null)?.name}, total ${amount(order.total_amount)}, status ${order.status}, placed ${timestamp(order.order_date)}. ` +
        (context.linkedByReference
          ? "Matched directly from the ticket order reference."
          : "Inferred as the customer's most recent order."),
      "HIGH",
    ));
  }

  const duplicatePaymentCodes = duplicates.flatMap((pair) => [
    pair.original.payment_code,
    pair.duplicate.payment_code,
  ]);

  for (const payment of context.payments) {
    evidence.push(evidenceRow(
      investigationId,
      "PAYMENT",
      "PAYMENT_RECORD",
      payment.payment_code,
      `Payment ${payment.payment_code} of ${amount(payment.amount)} via ${payment.payment_method}, status ${payment.status}, transaction ${payment.transaction_reference}, captured ${timestamp(payment.payment_date)}.`,
      duplicatePaymentCodes.includes(payment.payment_code) ? "CRITICAL" : "MEDIUM",
    ));
  }

  for (const pair of duplicates) {
    evidence.push(evidenceRow(
      investigationId,
      "DUPLICATE_PAYMENT",
      "PAYMENT_RECORD",
      pair.duplicate.payment_code,
      `Duplicate charge detected: payment ${pair.duplicate.payment_code} (${amount(pair.duplicate.amount)}, transaction ${pair.duplicate.transaction_reference}) was captured ${pair.minutesApart} minute(s) after payment ${pair.original.payment_code} (${amount(pair.original.amount)}, transaction ${pair.original.transaction_reference}) for the same order and amount.`,
      "CRITICAL",
    ));
  }

  for (const refund of refunds) {
    const pending = String(refund.status ?? "").toUpperCase() === REFUND_PENDING;
    const paymentCode = (refund.payment as Row | null)?.payment_code ?? null;

    evidence.push(evidenceRow(
      investigationId,
      pending ? "PENDING_REFUND" : "REFUND",
      "REFUND_RECORD",
      refund.refund_code,
      `Refund ${refund.refund_code} of ${amount(refund.amount)} against payment ${paymentCode} is ${refund.status}, requested ${timestamp(refund.requested_at)}` +
        (refund.processed_at === null || refund.processed_at === undefined
          ? " and not yet processed"
          : ` and processed ${timestamp(refund.processed_at)}`) +
        `. Reason: ${refund.reason}`,
      pending ? "CRITICAL" : "LOW",
    ));
  }

  for (const conversation of conversations) {
    evidence.push(evidenceRow(
      investigationId,
      "CONVERSATION",
      "CONVERSATION_MESSAGE",
      `MSG-${conversation.id}`,
      `${conversation.sender_type} at ${timestamp(conversation.created_at)}: ${conversation.message}`,
      "MEDIUM",
    ));
  }

  if (assessment.policy !== null) {
    const policy = assessment.policy;
    evidence.push(evidenceRow(
      investigationId,
      "POLICY",
      "SUPPORT_POLICY",
      policy.policy_code,
      `Policy ${policy.policy_code} - ${policy.policy_name}: ${policy.description} Auto-resolution allowed: ${policy.auto_resolution_allowed}, manager approval required: ${policy.manager_approval_required}, maximum auto refund: ${amount(policy.maximum_auto_refund_amount)}.`,
      "HIGH",
    ));
  }

  return evidence;
}

// ---------------------------------------------------------------- response mapping

function toPaymentSummary(payment: Row): Row {
  return {
    id: payment.id,
    paymentCode: payment.payment_code,
    amount: num(payment.amount),
    paymentMethod: payment.payment_method,
    status: payment.status,
    transactionReference: payment.transaction_reference,
    paymentDate: payment.payment_date,
  };
}

function toRefundSummary(refund: Row): Row {
  return {
    id: refund.id,
    refundCode: refund.refund_code,
    paymentCode: (refund.payment as Row | null)?.payment_code ?? null,
    amount: num(refund.amount),
    status: refund.status,
    reason: refund.reason,
    requestedAt: refund.requested_at,
    processedAt: refund.processed_at,
  };
}

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
  const ticketIdParam = body.ticketId ?? url.searchParams.get("ticketId");

  if (ticketIdParam === undefined || ticketIdParam === null || ticketIdParam === "") {
    return errorResponse(400, "ticketId is required");
  }

  const ticketId = Number(ticketIdParam);
  console.log(`[investigations] investigate ticketId=${ticketId}`);

  try {
    const client = adminClient();

    const { data: ticketData, error: ticketError } = await client
      .from("support_tickets")
      .select("*, customer:customers(id, customer_code, name, email, phone, status)")
      .eq("id", ticketId)
      .maybeSingle();
    if (ticketError) throw ticketError;
    if (!ticketData) {
      return errorResponse(404, `Support ticket not found with id: ${ticketId}`);
    }

    const ticket = ticketData as Row;
    const customer = ticket.customer as Row;

    const context = await resolveOrderContext(client, ticket);
    const duplicates = detectDuplicatePayments(context.payments);
    const refunds = context.order === null ? [] : await loadRefundsForOrder(client, context.order);
    const pendingRefunds = refunds.filter(
      (refund) => String(refund.status ?? "").toUpperCase() === REFUND_PENDING,
    );

    const { data: conversationData, error: conversationError } = await client
      .from("conversations")
      .select("*")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (conversationError) throw conversationError;
    const conversations = (conversationData ?? []) as Row[];

    const hasDuplicates = duplicates.length > 0;
    const category = hasDuplicates ? "PAYMENT" : normalizedCategory(ticket);

    const { data: policyData, error: policyError } = await client
      .from("support_policies")
      .select("*")
      .eq("category", category)
      .eq("status", POLICY_ACTIVE)
      .order("id", { ascending: true });
    if (policyError) throw policyError;

    const assessment = assess(ticket, context, duplicates, pendingRefunds, (policyData ?? []) as Row[]);

    const { data: existing, error: existingError } = await client
      .from("investigations")
      .select("*")
      .eq("ticket_id", ticketId)
      .maybeSingle();
    if (existingError) throw existingError;

    const investigationPayload = {
      intent: assessment.intent,
      root_cause: assessment.rootCause,
      confidence: assessment.confidence,
      risk_level: assessment.riskLevel,
      policy_check: assessment.policyCheck,
      authorization_check: assessment.authorizationCheck,
      recommended_action: assessment.recommendedAction,
      decision: assessment.decision,
      status: "COMPLETED",
      completed_at: new Date().toISOString(),
    };

    let investigation: Row;

    if (existing) {
      const { data, error } = await client
        .from("investigations")
        .update(investigationPayload)
        .eq("id", existing.id as number)
        .select("*")
        .single();
      if (error) throw error;
      investigation = data as Row;
    } else {
      const { data, error } = await client
        .from("investigations")
        .insert({
          investigation_code: randomCode("INV-"),
          ticket_id: ticketId,
          ...investigationPayload,
        })
        .select("*")
        .single();
      if (error) throw error;
      investigation = data as Row;
    }

    const investigationId = investigation.id as number;

    const { error: deleteError } = await client
      .from("evidence")
      .delete()
      .eq("investigation_id", investigationId);
    if (deleteError) throw deleteError;

    const evidence = buildEvidence(
      investigationId,
      ticket,
      customer,
      context,
      duplicates,
      refunds,
      conversations,
      assessment,
    );

    const { data: evidenceData, error: evidenceError } = await client
      .from("evidence")
      .insert(evidence)
      .select("*");
    if (evidenceError) throw evidenceError;

    const evidenceIdByCode = new Map(
      ((evidenceData ?? []) as Row[]).map((row) => [row.evidence_code, row.id]),
    );

    console.log(
      `[investigations] ticketId=${ticketId} investigation=${investigation.investigation_code} decision=${assessment.decision} duplicates=${duplicates.length} pendingRefunds=${pendingRefunds.length}`,
    );

    return json(201, {
      id: investigationId,
      investigationCode: investigation.investigation_code,
      status: investigation.status,
      intent: investigation.intent,
      sentiment: investigation.sentiment,
      rootCause: investigation.root_cause,
      confidence: num(investigation.confidence),
      riskLevel: investigation.risk_level,
      policyCheck: investigation.policy_check,
      authorizationCheck: investigation.authorization_check,
      recommendedAction: investigation.recommended_action,
      decision: investigation.decision,
      startedAt: investigation.started_at,
      completedAt: investigation.completed_at,
      ticket: {
        id: ticket.id,
        caseId: ticket.case_id,
        category: ticket.category,
        orderReference: ticket.order_reference,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
      },
      customer: {
        id: customer.id,
        customerCode: customer.customer_code,
        name: customer.name,
        email: customer.email,
        status: customer.status,
      },
      order: context.order === null
        ? null
        : {
          id: context.order.id,
          orderCode: context.order.order_code,
          productName: (context.order.product as Row | null)?.name ?? null,
          quantity: context.order.quantity,
          totalAmount: num(context.order.total_amount),
          status: context.order.status,
          orderDate: context.order.order_date,
          linkedByTicketReference: context.linkedByReference,
        },
      findings: {
        duplicatePaymentDetected: hasDuplicates,
        duplicatePayments: duplicates.map((pair) => ({
          amount: num(pair.duplicate.amount),
          originalPayment: toPaymentSummary(pair.original),
          duplicatePayment: toPaymentSummary(pair.duplicate),
          minutesApart: pair.minutesApart,
        })),
        pendingRefundDetected: pendingRefunds.length > 0,
        pendingRefunds: pendingRefunds.map(toRefundSummary),
        disputedAmount: assessment.disputedAmount,
      },
      evidence: evidence.map((row) => ({
        id: evidenceIdByCode.get(row.evidence_code as string) ?? null,
        evidenceCode: row.evidence_code,
        evidenceType: row.evidence_type,
        sourceType: row.source_type,
        sourceReference: row.source_reference,
        description: row.description,
        relevance: row.relevance,
      })),
    });
  } catch (err) {
    console.error(`[investigations] ticketId=${ticketId} failed:`, err);
    return errorResponse(500, err instanceof Error ? err.message : "Unexpected error");
  }
});
