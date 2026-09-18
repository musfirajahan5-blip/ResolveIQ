// Support ticket / complaint intake and lookup.
// Ports SupportTicketController + SupportTicketService from the Spring Boot backend.
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

const TICKET_SELECT =
  "*, customer:customers(id, customer_code, name, email, phone, status, created_at, updated_at)";

type Row = Record<string, unknown>;

function json(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Mirrors GlobalExceptionHandler's response body.
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
  if (fieldErrors) {
    body.fieldErrors = fieldErrors;
  }
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

function randomCode(prefix: string): string {
  return prefix + crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Mirrors SupportTicketService.generateCaseId().
async function generateCaseId(client: SupabaseClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const caseId = randomCode("CASE-");
    const { data, error } = await client
      .from("support_tickets")
      .select("id")
      .eq("case_id", caseId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return caseId;
  }
  throw new Error("Could not generate a unique case id");
}

function mapCustomer(row: Row): Row {
  return {
    id: row.id,
    customerCode: row.customer_code,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTicket(row: Row): Row {
  return {
    id: row.id,
    caseId: row.case_id,
    customer: row.customer ? mapCustomer(row.customer as Row) : null,
    category: row.category,
    orderReference: row.order_reference,
    subject: row.subject,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

// Mirrors the bean-validation constraints on CreateTicketRequest.
function validateCreate(body: Row): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  if (body.customerId === null || body.customerId === undefined || body.customerId === "") {
    fieldErrors.customerId = "customerId is required";
  } else if (!Number.isFinite(Number(body.customerId))) {
    fieldErrors.customerId = "customerId is required";
  }
  if (isBlank(body.category)) fieldErrors.category = "category is required";
  if (isBlank(body.subject)) {
    fieldErrors.subject = "subject is required";
  } else if (String(body.subject).length > 200) {
    fieldErrors.subject = "subject must be at most 200 characters";
  }
  if (isBlank(body.description)) fieldErrors.description = "description is required";

  return Object.fromEntries(Object.entries(fieldErrors).sort(([a], [b]) => a.localeCompare(b)));
}

async function findTicket(
  client: SupabaseClient,
  column: "id" | "case_id",
  value: unknown,
): Promise<Row | null> {
  const { data, error } = await client
    .from("support_tickets")
    .select(TICKET_SELECT)
    .eq(column, value as never)
    .maybeSingle();
  if (error) throw error;
  return (data as Row | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: Row = {};
  try {
    if (req.method !== "GET") {
      const raw = await req.text();
      body = raw ? (JSON.parse(raw) as Row) : {};
    }
  } catch {
    return errorResponse(400, "Validation failed", { body: "Request body must be valid JSON" });
  }

  const url = new URL(req.url);
  const queryAction = url.searchParams.get("action");
  const action = String(body.action ?? queryAction ?? "list");

  console.log(`[tickets] action=${action}`);

  try {
    const client = adminClient();

    if (action === "create") {
      const fieldErrors = validateCreate(body);
      if (Object.keys(fieldErrors).length > 0) {
        return errorResponse(400, "Validation failed", fieldErrors);
      }

      const customerId = Number(body.customerId);
      const { data: customer, error: customerError } = await client
        .from("customers")
        .select("*")
        .eq("id", customerId)
        .maybeSingle();
      if (customerError) throw customerError;
      if (!customer) {
        return errorResponse(404, `Customer not found with id: ${customerId}`);
      }

      const caseId = await generateCaseId(client);
      const { data: ticket, error: insertError } = await client
        .from("support_tickets")
        .insert({
          case_id: caseId,
          customer_id: customerId,
          category: body.category,
          order_reference: body.orderReference ?? null,
          subject: body.subject,
          description: body.description,
          status: "OPEN",
        })
        .select(TICKET_SELECT)
        .single();
      if (insertError) throw insertError;

      console.log(`[tickets] created case_id=${caseId} ticket_id=${ticket.id}`);
      return json(201, mapTicket(ticket as Row));
    }

    if (action === "get") {
      if (body.ticketId !== undefined && body.ticketId !== null && body.ticketId !== "") {
        const ticket = await findTicket(client, "id", Number(body.ticketId));
        if (!ticket) {
          return errorResponse(
            404,
            `Support ticket not found with id: ${body.ticketId}`,
          );
        }
        return json(200, mapTicket(ticket));
      }

      if (!isBlank(body.caseId)) {
        const caseId = String(body.caseId).trim();
        const ticket = await findTicket(client, "case_id", caseId);
        if (!ticket) {
          return errorResponse(404, `Support ticket not found: ${caseId}`);
        }
        return json(200, mapTicket(ticket));
      }

      return errorResponse(400, "Validation failed", { ticketId: "ticketId or caseId is required" });
    }

    if (action === "list") {
      const { data, error } = await client.from("support_tickets").select(TICKET_SELECT);
      if (error) throw error;
      return json(200, (data ?? []).map((row) => mapTicket(row as Row)));
    }

    return errorResponse(400, `Unsupported action: ${action}`);
  } catch (err) {
    console.error(`[tickets] action=${action} failed:`, err);
    return errorResponse(500, err instanceof Error ? err.message : "Unexpected error");
  }
});
