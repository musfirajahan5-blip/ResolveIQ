import { supabase } from "../integrations/supabase/client";

const NETWORK_ERROR =
  "Unable to reach the ResolveIQ server. Please check your connection and try again.";

function errorMessage(payload, status, fallback) {
  if (payload?.fieldErrors) {
    const details = Object.values(payload.fieldErrors).join(", ");
    if (details) {
      return details;
    }
  }

  if (payload?.message) {
    return payload.message;
  }

  if (fallback) {
    return fallback(status);
  }

  return `Something went wrong (error ${status}). Please try again.`;
}

/**
 * Calls an Enter Cloud backend function and reproduces the error handling the
 * REST client used to provide: the function's JSON error body is turned into an
 * Error whose message matches what the pages already display.
 */
async function call(functionName, body, fallback) {
  const { data, error } = await supabase.functions.invoke(functionName, {
    body,
    headers: { "Content-Type": "application/json" },
  });

  if (!error) {
    return data;
  }

  // FunctionsHttpError carries the HTTP response; transport failures do not.
  const response = error.context;

  if (!response || typeof response.json !== "function") {
    throw new Error(NETWORK_ERROR);
  }

  const payload = await response.json().catch(() => null);

  throw new Error(errorMessage(payload, response.status, fallback));
}

export function createTicket(ticket) {
  return call("tickets", { action: "create", ...ticket });
}

export function getTicket(ticketId) {
  return call(
    "tickets",
    { action: "get", ticketId },
    (status) => `Unable to load case (error ${status}).`
  );
}

export function investigateTicket(ticketId) {
  return call("investigations", { action: "investigate", ticketId });
}

export function getInvestigationByTicket(ticketId) {
  return call("investigations", { action: "investigate", ticketId });
}

export function resolveInvestigation(investigationId) {
  return call("resolutions", { action: "resolve", investigationId });
}

export function resolveTicket(ticketId) {
  return call("resolutions", { action: "resolve", ticketId });
}

export function getResolution(investigationId) {
  return call("resolutions", { action: "get", investigationId });
}
