import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTicket } from "../api/client";

function CaseView() {
  const { ticketId } = useParams();

  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadTicket() {
      try {
        setLoading(true);
        setError("");

        const data = await getTicket(ticketId);

        setTicket(data);
      } catch (err) {
        setError(
          err.message ||
            "Unable to load this case. Please try again."
        );
      } finally {
        setLoading(false);
      }
    }

    loadTicket();
  }, [ticketId]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <div style={styles.spinner}>⟳</div>
          <h2>Loading Case...</h2>
          <p style={styles.muted}>
            Retrieving customer and case information.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.centerCard}>
          <div style={styles.errorIcon}>!</div>
          <h2>Case Not Found</h2>
          <p style={styles.errorText}>{error}</p>

          <Link to="/" style={styles.backButton}>
            ← Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return null;
  }

  const customer = ticket.customer;

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Header */}
        <div style={styles.header}>
          <div>
            <Link to="/" style={styles.backLink}>
              ← Back to Home
            </Link>

            <div style={styles.titleRow}>
              <div>
                <p style={styles.eyebrow}>CUSTOMER CASE</p>
                <h1 style={styles.title}>{ticket.caseId}</h1>
                <p style={styles.subtitle}>
                  Review complaint details and customer context
                </p>
              </div>

              <StatusBadge status={ticket.status} />
            </div>
          </div>
        </div>

        {/* Case Summary */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Case Summary</h2>
              <p style={styles.cardSubtitle}>
                Complaint information submitted by the customer
              </p>
            </div>
          </div>

          <div style={styles.summaryGrid}>
            <InfoItem
              label="Case ID"
              value={ticket.caseId}
            />

            <InfoItem
              label="Category"
              value={ticket.category}
            />

            <InfoItem
              label="Order Reference"
              value={ticket.orderReference || "Not provided"}
            />

            <InfoItem
              label="Case Status"
              value={ticket.status}
            />

            <InfoItem
              label="Created"
              value={formatDate(ticket.createdAt)}
            />

            <InfoItem
              label="Last Updated"
              value={formatDate(ticket.updatedAt)}
            />
          </div>
        </section>

        {/* Customer Context */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Customer Context</h2>
              <p style={styles.cardSubtitle}>
                Customer information connected to this case
              </p>
            </div>

            <div style={styles.customerStatus}>
              <span style={styles.statusDot}></span>
              {customer?.status || "UNKNOWN"}
            </div>
          </div>

          <div style={styles.customerGrid}>
            <div style={styles.customerAvatar}>
              {getInitials(customer?.name)}
            </div>

            <div>
              <h3 style={styles.customerName}>
                {customer?.name || "Unknown Customer"}
              </h3>

              <p style={styles.customerCode}>
                {customer?.customerCode || "No customer code"}
              </p>
            </div>

            <div style={styles.contactBlock}>
              <span style={styles.contactLabel}>EMAIL</span>
              <span style={styles.contactValue}>
                {customer?.email || "Not available"}
              </span>
            </div>

            <div style={styles.contactBlock}>
              <span style={styles.contactLabel}>PHONE</span>
              <span style={styles.contactValue}>
                {customer?.phone || "Not available"}
              </span>
            </div>
          </div>
        </section>

        {/* Complaint */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Customer Complaint</h2>
              <p style={styles.cardSubtitle}>
                Original complaint submitted for investigation
              </p>
            </div>
          </div>

          <div style={styles.complaintBox}>
            <div style={styles.complaintSubject}>
              {ticket.subject}
            </div>

            <div style={styles.complaintDescription}>
              {ticket.description}
            </div>
          </div>
        </section>

        {/* Investigation CTA */}
        <section style={styles.actionCard}>
          <div>
            <div style={styles.actionIcon}>🔎</div>

            <div>
              <h2 style={styles.actionTitle}>
                Ready for Investigation
              </h2>

              <p style={styles.actionText}>
                ResolveIQ can investigate this case using customer
                history, orders, payments, refunds, policies and
                related evidence.
              </p>
            </div>
          </div>

          <Link
            to={`/investigation/${ticket.id}`}
            style={styles.investigateButton}
          >
            Start Investigation →
          </Link>
        </section>

        {/* Workflow */}
        <section style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h2 style={styles.cardTitle}>Case Workflow</h2>
              <p style={styles.cardSubtitle}>
                Investigation and resolution lifecycle
              </p>
            </div>
          </div>

          <div style={styles.workflow}>
            <WorkflowStep
              number="1"
              title="Complaint"
              description="Customer issue received"
              active
            />

            <WorkflowLine />

            <WorkflowStep
              number="2"
              title="Understand"
              description="Identify intent and context"
            />

            <WorkflowLine />

            <WorkflowStep
              number="3"
              title="Investigate"
              description="Gather related evidence"
            />

            <WorkflowLine />

            <WorkflowStep
              number="4"
              title="Assess"
              description="Risk and policy evaluation"
            />

            <WorkflowLine />

            <WorkflowStep
              number="5"
              title="Resolve"
              description="Act or escalate"
            />
          </div>
        </section>

      </div>
    </div>
  );
}


/* ---------- Components ---------- */

function StatusBadge({ status }) {
  const normalized = status?.toUpperCase();

  let background = "#eef2f7";
  let color = "#475569";

  if (normalized === "RESOLVED") {
    background = "#dcfce7";
    color = "#166534";
  }

  if (normalized === "OPEN") {
    background = "#dbeafe";
    color = "#1d4ed8";
  }

  if (normalized === "ESCALATED") {
    background = "#fee2e2";
    color = "#b91c1c";
  }

  return (
    <span
      style={{
        ...styles.statusBadge,
        background,
        color,
      }}
    >
      ● {status}
    </span>
  );
}


function InfoItem({ label, value }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}


function WorkflowStep({
  number,
  title,
  description,
  active,
}) {
  return (
    <div style={styles.workflowStep}>
      <div
        style={{
          ...styles.workflowNumber,
          ...(active ? styles.workflowNumberActive : {}),
        }}
      >
        {number}
      </div>

      <div>
        <div style={styles.workflowTitle}>{title}</div>
        <div style={styles.workflowDescription}>
          {description}
        </div>
      </div>
    </div>
  );
}


function WorkflowLine() {
  return <div style={styles.workflowLine}></div>;
}


/* ---------- Helpers ---------- */

function getInitials(name) {
  if (!name) return "?";

  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}


function formatDate(value) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}


/* ---------- Styles ---------- */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px 20px 60px",
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: "#172033",
  },

  container: {
    maxWidth: "1180px",
    margin: "0 auto",
  },

  header: {
    marginBottom: "28px",
  },

  backLink: {
    color: "#64748b",
    textDecoration: "none",
    fontSize: "14px",
    fontWeight: "600",
  },

  titleRow: {
    marginTop: "18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
  },

  eyebrow: {
    margin: 0,
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "0.12em",
    color: "#64748b",
  },

  title: {
    margin: "6px 0 4px",
    fontSize: "32px",
    lineHeight: 1.15,
    fontWeight: "800",
  },

  subtitle: {
    margin: 0,
    color: "#64748b",
    fontSize: "15px",
  },

  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "9px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  card: {
    background: "#ffffff",
    border: "1px solid #e5eaf1",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "18px",
    boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "16px",
    marginBottom: "22px",
    flexWrap: "wrap",
  },

  cardTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "800",
  },

  cardSubtitle: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: "14px",
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(170px, 1fr))",
    gap: "18px",
  },

  infoItem: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
    minWidth: 0,
  },

  infoLabel: {
    color: "#94a3b8",
    fontSize: "11px",
    fontWeight: "800",
    letterSpacing: "0.08em",
  },

  infoValue: {
    color: "#1e293b",
    fontSize: "15px",
    fontWeight: "700",
    overflowWrap: "anywhere",
  },

  customerGrid: {
    display: "grid",
    gridTemplateColumns:
      "auto minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr)",
    alignItems: "center",
    gap: "18px",
  },

  customerAvatar: {
    width: "58px",
    height: "58px",
    borderRadius: "16px",
    background: "#e9eef8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    fontSize: "18px",
    color: "#334155",
  },

  customerName: {
    margin: 0,
    fontSize: "18px",
    fontWeight: "800",
  },

  customerCode: {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: "13px",
  },

  contactBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    minWidth: 0,
  },

  contactLabel: {
    color: "#94a3b8",
    fontSize: "10px",
    fontWeight: "800",
    letterSpacing: "0.08em",
  },

  contactValue: {
    color: "#334155",
    fontSize: "14px",
    overflowWrap: "anywhere",
  },

  customerStatus: {
    display: "inline-flex",
    alignItems: "center",
    gap: "7px",
    fontSize: "12px",
    fontWeight: "800",
    color: "#166534",
  },

  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
  },

  complaintBox: {
    background: "#f8fafc",
    border: "1px solid #e5eaf1",
    borderRadius: "14px",
    padding: "20px",
  },

  complaintSubject: {
    fontSize: "18px",
    fontWeight: "800",
    marginBottom: "12px",
    overflowWrap: "anywhere",
  },

  complaintDescription: {
    color: "#475569",
    fontSize: "15px",
    lineHeight: 1.7,
    overflowWrap: "anywhere",
  },

  actionCard: {
    background: "#172033",
    color: "#ffffff",
    borderRadius: "18px",
    padding: "24px",
    marginBottom: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "20px",
    flexWrap: "wrap",
  },

  actionCardInner: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },

  actionIcon: {
    fontSize: "28px",
    marginBottom: "8px",
  },

  actionTitle: {
    margin: 0,
    fontSize: "20px",
    fontWeight: "800",
  },

  actionText: {
    margin: "7px 0 0",
    color: "#cbd5e1",
    fontSize: "14px",
    lineHeight: 1.6,
    maxWidth: "700px",
  },

  investigateButton: {
    background: "#ffffff",
    color: "#172033",
    textDecoration: "none",
    padding: "12px 18px",
    borderRadius: "10px",
    fontWeight: "800",
    fontSize: "14px",
    whiteSpace: "nowrap",
  },

  workflow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    overflowX: "auto",
    paddingBottom: "6px",
  },

  workflowStep: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    minWidth: "150px",
  },

  workflowNumber: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "#e2e8f0",
    color: "#64748b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "800",
    flexShrink: 0,
  },

  workflowNumberActive: {
    background: "#172033",
    color: "#ffffff",
  },

  workflowTitle: {
    fontSize: "13px",
    fontWeight: "800",
  },

  workflowDescription: {
    color: "#94a3b8",
    fontSize: "11px",
    marginTop: "2px",
    whiteSpace: "nowrap",
  },

  workflowLine: {
    width: "32px",
    height: "1px",
    background: "#dbe2ea",
    flexShrink: 0,
  },

  centerCard: {
    maxWidth: "500px",
    margin: "100px auto",
    background: "#ffffff",
    border: "1px solid #e5eaf1",
    borderRadius: "18px",
    padding: "40px",
    textAlign: "center",
  },

  spinner: {
    fontSize: "36px",
    marginBottom: "10px",
  },

  errorIcon: {
    width: "48px",
    height: "48px",
    margin: "0 auto 16px",
    borderRadius: "50%",
    background: "#fee2e2",
    color: "#b91c1c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "24px",
    fontWeight: "800",
  },

  muted: {
    color: "#64748b",
  },

  errorText: {
    color: "#b91c1c",
    lineHeight: 1.6,
    marginBottom: "24px",
  },

  backButton: {
    display: "inline-block",
    background: "#172033",
    color: "#ffffff",
    textDecoration: "none",
    padding: "11px 18px",
    borderRadius: "9px",
    fontWeight: "700",
  },
};

export default CaseView;