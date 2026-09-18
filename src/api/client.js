const API_BASE_URL = "http://localhost:8080/api";

async function request(path, options = {}) {
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch {
    throw new Error(
      "Unable to reach the ResolveIQ server. Please check your connection and try again."
    );
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(errorMessage(data, response.status));
  }

  return data;
}

function errorMessage(data, status) {
  if (data?.fieldErrors) {
    const details = Object.values(data.fieldErrors).join(", ");
    if (details) {
      return details;
    }
  }

  if (data?.message) {
    return data.message;
  }

  return `Something went wrong (error ${status}). Please try again.`;
}

export function createTicket(ticket) {
  return request("/tickets", {
    method: "POST",
    body: JSON.stringify(ticket),
  });
}

export function resolveInvestigation(investigationId) {
  return request(`/resolutions/investigation/${investigationId}`, {
    method: "POST",
  });
}

export function resolveTicket(ticketId) {
  return request(`/resolutions/ticket/${ticketId}`, {
    method: "POST",
  });
}

export function getResolution(investigationId) {
  return request(`/resolutions/investigation/${investigationId}`, {
    method: "GET",
  });
}
export function investigateTicket(ticketId) {
  return request(`/investigations/ticket/${ticketId}`, {
    method: "POST",
  });
}
export function getInvestigationByTicket(ticketId) {
  return request(`/investigations/ticket/${ticketId}`, {
    method: "POST",
  });
}
export function getCustomer(customerId) {
  return request(`/customers/${customerId}`, {
    method: "GET",
  });
}