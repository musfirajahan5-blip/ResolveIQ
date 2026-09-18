import { useState } from "react";
import { useParams } from "react-router-dom";

import {
  investigateTicket,
  resolveTicket,
  getResolution,
} from "../api/client";

export default function Investigation() {
  const { ticketId: routeTicketId } = useParams();

  const [ticketId, setTicketId] = useState(routeTicketId || "");
  const [investigation, setInvestigation] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleInvestigate() {
    if (!ticketId.trim()) {
      setError("Please enter a Ticket ID.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    setResolution(null);

    try {
      const result = await investigateTicket(ticketId.trim());

      setInvestigation(result);
      setMessage("Investigation completed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResolve() {
    if (!ticketId.trim()) {
      setError("Please enter a Ticket ID.");
      return;
    }

    setResolving(true);
    setError("");
    setMessage("");

    try {
      const result = await resolveTicket(ticketId.trim());

      setResolution(result);
      setMessage("Resolution completed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setResolving(false);
    }
  }

  async function handleViewResolution() {
    if (!investigation?.id) {
      setError("Please investigate the ticket first.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const result = await getResolution(investigation.id);

      setResolution(result);
      setMessage("Resolution details loaded.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* HEADER */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <div style={styles.brand}>ResolveIQ</div>

            <h1 style={styles.title}>
              Investigation Workspace
            </h1>

            <p style={styles.subtitle}>
              Investigate customer context, evaluate evidence,
              assess risk, and determine the appropriate resolution.
            </p>
          </div>

          {investigation && (
            <div style={styles.statusBadge}>
              {investigation.status || "COMPLETED"}
            </div>
          )}
        </div>

        {/* TICKET SEARCH */}
        <div style={styles.searchCard}>
          <label style={styles.label}>
            Ticket ID
          </label>

          <div style={styles.searchRow}>
            <input
              type="number"
              value={ticketId}
              onChange={(e) => setTicketId(e.target.value)}
              placeholder="Enter ticket ID, e.g. 2"
              style={styles.input}
            />

            <button
              onClick={handleInvestigate}
              disabled={loading}
              style={styles.primaryButton}
            >
              {loading ? "Investigating..." : "Investigate"}
            </button>
          </div>
        </div>

        {/* SUCCESS MESSAGE */}
        {message && (
          <div style={styles.success}>
            ✓ {message}
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && (
          <div style={styles.error}>
            ⚠ {error}
          </div>
        )}

        {investigation && (
          <>
            {/* INVESTIGATION HEADER */}
            <div style={styles.investigationCard}>
              <div style={styles.investigationInfo}>
                <span style={styles.smallLabel}>
                  Investigation
                </span>

                <h2 style={styles.investigationCode}>
                  {investigation.investigationCode}
                </h2>
              </div>

              <div style={styles.decisionBox}>
                <span style={styles.smallLabel}>
                  Decision
                </span>

                <strong style={styles.decisionText}>
                  {investigation.decision || "—"}
                </strong>
              </div>
            </div>

            {/* INVESTIGATION PIPELINE */}
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>
                Investigation Pipeline
              </h2>

              <div style={styles.pipelineWrapper}>
                <div style={styles.pipeline}>
                  {[
                    "Understand",
                    "Recall",
                    "Investigate",
                    "Evidence",
                    "Reason",
                    "Assess",
                    "Act",
                    "Audit",
                  ].map((stage, index) => (
                    <div
                      key={stage}
                      style={styles.stage}
                    >
                      <div style={styles.stageNumber}>
                        {index + 1}
                      </div>

                      <span style={styles.stageName}>
                        {stage}
                      </span>

                      {index < 7 && (
                        <div style={styles.arrow}>
                          →
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CASE CONTEXT */}
            <div style={styles.card}>
              <h2 style={styles.sectionTitle}>
                Case Context
              </h2>

              <div style={styles.contextGrid}>
                <Info
                  label="Case ID"
                  value={investigation.ticket?.caseId}
                />

                <Info
                  label="Category"
                  value={investigation.ticket?.category}
                />

                <Info
                  label="Customer"
                  value={investigation.customer?.name}
                />

                <Info
                  label="Customer Code"
                  value={investigation.customer?.customerCode}
                />

                <Info
                  label="Order"
                  value={investigation.order?.orderCode}
                />

                <Info
                  label="Order Amount"
                  value={
                    investigation.order?.totalAmount != null
                      ? `₹${investigation.order.totalAmount}`
                      : "—"
                  }
                />

                <Info
                  label="Order Status"
                  value={investigation.order?.status}
                />

                <Info
                  label="Ticket Status"
                  value={investigation.ticket?.status}
                />
              </div>
            </div>

            {/* UNDERSTAND + ASSESS */}
            <div style={styles.twoColumn}>

              {/* UNDERSTAND */}
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>
                  Understand
                </h2>

                <Info
                  label="Intent"
                  value={investigation.intent}
                />

                <Info
                  label="Sentiment"
                  value={
                    investigation.sentiment ||
                    "Pending AI analysis"
                  }
                />

                <div style={styles.rootCause}>
                  <span style={styles.smallLabel}>
                    Root Cause
                  </span>

                  <p style={styles.rootCauseText}>
                    {investigation.rootCause || "—"}
                  </p>
                </div>
              </div>

              {/* ASSESS */}
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>
                  Assess
                </h2>

                <Metric
                  label="Confidence"
                  value={
                    investigation.confidence != null
                      ? `${Math.round(
                          investigation.confidence * 100
                        )}%`
                      : "—"
                  }
                />

                <Metric
                  label="Risk Level"
                  value={investigation.riskLevel}
                />

                <Metric
                  label="Policy Check"
                  value={investigation.policyCheck}
                />

                <Metric
                  label="Authorization"
                  value={investigation.authorizationCheck}
                />
              </div>
            </div>

            {/* RECOMMENDED ACTION */}
            <div style={styles.actionCard}>
              <div style={styles.actionContent}>
                <span style={styles.actionLabel}>
                  Recommended Action
                </span>

                <h2 style={styles.actionTitle}>
                  {investigation.recommendedAction || "—"}
                </h2>
              </div>

              <div style={styles.actionContent}>
                <span style={styles.actionLabel}>
                  Decision
                </span>

                <h2 style={styles.actionTitle}>
                  {investigation.decision || "—"}
                </h2>
              </div>

              <button
                onClick={handleResolve}
                disabled={resolving}
                style={styles.resolveButton}
              >
                {resolving
                  ? "Resolving..."
                  : "Execute Resolution"}
              </button>
            </div>

            {/* EVIDENCE */}
            <div style={styles.card}>
              <div style={styles.sectionHeader}>
                <div style={styles.sectionHeaderText}>
                  <h2 style={styles.sectionTitle}>
                    Evidence
                  </h2>

                  <p style={styles.sectionDescription}>
                    Evidence collected from connected customer,
                    ticket, order, payment, refund, conversation,
                    and policy records.
                  </p>
                </div>

                <span style={styles.countBadge}>
                  {investigation.evidence?.length || 0} items
                </span>
              </div>

              {investigation.evidence?.length > 0 ? (
                <div style={styles.evidenceList}>
                  {investigation.evidence.map((item) => (
                    <div
                      key={item.id}
                      style={styles.evidenceCard}
                    >
                      <div style={styles.evidenceTop}>
                        <div style={styles.evidenceInfo}>
                          <span style={styles.evidenceType}>
                            {item.evidenceType}
                          </span>

                          <h3 style={styles.evidenceReference}>
                            {item.sourceReference}
                          </h3>
                        </div>

                        <span
                          style={{
                            ...styles.relevance,
                            ...(item.relevance === "CRITICAL"
                              ? styles.critical
                              : item.relevance === "HIGH"
                              ? styles.high
                              : {}),
                          }}
                        >
                          {item.relevance}
                        </span>
                      </div>

                      <p style={styles.evidenceDescription}>
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={styles.empty}>
                  No evidence was returned for this investigation.
                </div>
              )}
            </div>

            {/* FINDINGS */}
            {investigation.findings && (
              <div style={styles.card}>
                <h2 style={styles.sectionTitle}>
                  Investigation Findings
                </h2>

                <div style={styles.findingsGrid}>
                  <Finding
                    label="Duplicate Payment Detected"
                    value={
                      investigation.findings
                        .duplicatePaymentDetected
                    }
                  />

                  <Finding
                    label="Pending Refund Detected"
                    value={
                      investigation.findings
                        .pendingRefundDetected
                    }
                  />

                  <Finding
                    label="Disputed Amount"
                    value={
                      investigation.findings.disputedAmount != null
                        ? `₹${investigation.findings.disputedAmount}`
                        : "—"
                    }
                  />
                </div>
              </div>
            )}

            {/* RESOLUTION RESULT */}
            {resolution && (
              <div style={styles.resolutionCard}>
                <div style={styles.sectionHeader}>
                  <div>
                    <span style={styles.smallLabel}>
                      Resolution
                    </span>

                    <h2 style={styles.resolutionTitle}>
                      {resolution.outcome || "—"}
                    </h2>
                  </div>

                  <span style={styles.resolvedBadge}>
                    {resolution.ticketStatus || "—"}
                  </span>
                </div>

                {/* ACTION */}
                {resolution.action && (
                  <div style={styles.resolutionSection}>
                    <h3>
                      Action Executed
                    </h3>

                    <div style={styles.contextGrid}>
                      <Info
                        label="Action Code"
                        value={
                          resolution.action.actionCode
                        }
                      />

                      <Info
                        label="Action Type"
                        value={
                          resolution.action.actionType
                        }
                      />

                      <Info
                        label="Status"
                        value={
                          resolution.action.status
                        }
                      />

                      <Info
                        label="Result"
                        value={
                          resolution.action.result
                        }
                      />

                      <Info
                        label="Performed By"
                        value={
                          resolution.action.performedBy
                        }
                      />
                    </div>

                    <p style={styles.actionDescription}>
                      {resolution.action.description}
                    </p>
                  </div>
                )}

                {/* REFUNDS */}
                {resolution.refundSettlements?.length > 0 && (
                  <div style={styles.resolutionSection}>
                    <h3>
                      Refund Settlement
                    </h3>

                    {resolution.refundSettlements.map(
                      (refund) => (
                        <div
                          key={refund.id}
                          style={styles.refundBox}
                        >
                          <div style={styles.contextGrid}>
                            <Info
                              label="Refund"
                              value={refund.refundCode}
                            />

                            <Info
                              label="Payment"
                              value={refund.paymentCode}
                            />

                            <Info
                              label="Amount"
                              value={`₹${refund.amount}`}
                            />

                            <Info
                              label="Status"
                              value={refund.status}
                            />

                            <Info
                              label="Reference"
                              value={refund.refundReference}
                            />

                            <Info
                              label="Processed At"
                              value={
                                refund.processedAt || "—"
                              }
                            />
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* ESCALATION */}
                {resolution.escalation && (
                  <div style={styles.resolutionSection}>
                    <h3>
                      Human Escalation
                    </h3>

                    <div style={styles.contextGrid}>
                      <Info
                        label="Escalation Code"
                        value={
                          resolution.escalation
                            .escalationCode
                        }
                      />

                      <Info
                        label="Status"
                        value={
                          resolution.escalation.status
                        }
                      />
                    </div>
                  </div>
                )}

                {/* CUSTOMER RESPONSE */}
                {resolution.customerResponse && (
                  <div style={styles.customerResponse}>
                    <h3>
                      Customer Response
                    </h3>

                    <p>
                      {resolution.customerResponse}
                    </p>
                  </div>
                )}

                {/* AUDIT TRAIL */}
                {resolution.auditTrail?.length > 0 && (
                  <div style={styles.resolutionSection}>
                    <h3>
                      Audit Trail
                    </h3>

                    {resolution.auditTrail.map(
                      (audit) => (
                        <div
                          key={audit.id}
                          style={styles.auditItem}
                        >
                          <strong>
                            {audit.eventType}
                          </strong>

                          <p>
                            {audit.eventDescription}
                          </p>

                          <small>
                            {audit.createdAt}
                          </small>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


/* -----------------------------
   REUSABLE UI COMPONENTS
----------------------------- */

function Info({ label, value }) {
  return (
    <div style={styles.info}>
      <span style={styles.infoLabel}>
        {label}
      </span>

      <strong style={styles.infoValue}>
        {value || "—"}
      </strong>
    </div>
  );
}


function Metric({ label, value }) {
  return (
    <div style={styles.metric}>
      <span>
        {label}
      </span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}


function Finding({ label, value }) {
  return (
    <div style={styles.finding}>
      <span>
        {label}
      </span>

      <strong>
        {typeof value === "boolean"
          ? value
            ? "YES"
            : "NO"
          : value || "—"}
      </strong>
    </div>
  );
}


/* -----------------------------
   STYLES
----------------------------- */

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "30px 20px 60px",
    fontFamily:
      "Inter, Arial, Helvetica, sans-serif",
    color: "#172033",
    boxSizing: "border-box",
    overflowX: "hidden",
  },

  container: {
    maxWidth: "1180px",
    width: "100%",
    margin: "0 auto",
    boxSizing: "border-box",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "25px",
    flexWrap: "wrap",
  },

  headerContent: {
    minWidth: 0,
    flex: "1 1 600px",
  },

  brand: {
    fontSize: "15px",
    fontWeight: "800",
    color: "#2563eb",
    letterSpacing: "0.5px",
    marginBottom: "8px",
  },

  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.2,
    overflowWrap: "anywhere",
  },

  subtitle: {
    color: "#667085",
    maxWidth: "750px",
    lineHeight: 1.6,
    marginBottom: 0,
  },

  statusBadge: {
    background: "#ecfdf3",
    color: "#027a48",
    padding: "8px 14px",
    borderRadius: "999px",
    fontWeight: "700",
    fontSize: "13px",
    whiteSpace: "nowrap",
  },

  searchCard: {
    background: "#ffffff",
    padding: "22px",
    borderRadius: "14px",
    border: "1px solid #e4e7ec",
    marginBottom: "20px",
    boxSizing: "border-box",
  },

  label: {
    display: "block",
    fontWeight: "700",
    marginBottom: "8px",
  },

  searchRow: {
    display: "flex",
    gap: "12px",
    width: "100%",
    boxSizing: "border-box",
    flexWrap: "wrap",
  },

  input: {
    flex: "1 1 300px",
    minWidth: 0,
    padding: "13px 15px",
    border: "1px solid #d0d5dd",
    borderRadius: "9px",
    fontSize: "15px",
    boxSizing: "border-box",
  },

  primaryButton: {
    padding: "13px 22px",
    border: "none",
    borderRadius: "9px",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
  },

  resolveButton: {
    padding: "13px 22px",
    border: "none",
    borderRadius: "9px",
    background: "#16a34a",
    color: "#ffffff",
    fontWeight: "700",
    cursor: "pointer",
    width: "fit-content",
    maxWidth: "100%",
    whiteSpace: "normal",
  },

  success: {
    padding: "14px",
    borderRadius: "9px",
    background: "#ecfdf3",
    color: "#027a48",
    marginBottom: "20px",
  },

  error: {
    padding: "14px",
    borderRadius: "9px",
    background: "#fef3f2",
    color: "#b42318",
    marginBottom: "20px",
  },

  investigationCard: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "24px",
    border: "1px solid #e4e7ec",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "20px",
    marginBottom: "20px",
    flexWrap: "wrap",
    boxSizing: "border-box",
  },

  investigationInfo: {
    minWidth: 0,
  },

  investigationCode: {
    margin: "5px 0 0",
    overflowWrap: "anywhere",
  },

  decisionBox: {
    padding: "14px 20px",
    background: "#eef4ff",
    borderRadius: "10px",
    maxWidth: "100%",
    overflowWrap: "anywhere",
  },

  decisionText: {
    overflowWrap: "anywhere",
  },

  smallLabel: {
    display: "block",
    color: "#667085",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  card: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "25px",
    border: "1px solid #e4e7ec",
    marginBottom: "20px",
    boxSizing: "border-box",
    minWidth: 0,
  },

  sectionTitle: {
    marginTop: 0,
    marginBottom: "8px",
  },

  sectionDescription: {
    color: "#667085",
    marginTop: 0,
    lineHeight: 1.5,
  },

  pipelineWrapper: {
    width: "100%",
    overflowX: "auto",
    paddingBottom: "8px",
  },

  pipeline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minWidth: "850px",
    paddingTop: "15px",
  },

  stage: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    whiteSpace: "nowrap",
    fontSize: "13px",
    fontWeight: "600",
  },

  stageNumber: {
    width: "28px",
    height: "28px",
    minWidth: "28px",
    borderRadius: "50%",
    background: "#2563eb",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "700",
  },

  stageName: {
    whiteSpace: "nowrap",
  },

  arrow: {
    color: "#98a2b3",
    marginLeft: "3px",
  },

  contextGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px 18px",
    minWidth: 0,
  },

  twoColumn: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(320px, 1fr))",
    gap: "20px",
    minWidth: 0,
  },

  info: {
    padding: "10px 0",
    minWidth: 0,
  },

  infoLabel: {
    display: "block",
    color: "#667085",
    fontSize: "12px",
    marginBottom: "5px",
  },

  infoValue: {
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  },

  rootCause: {
    marginTop: "18px",
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "9px",
    lineHeight: 1.6,
  },

  rootCauseText: {
    marginBottom: 0,
    overflowWrap: "anywhere",
  },

  metric: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    padding: "14px 0",
    borderBottom: "1px solid #eef2f6",
    overflowWrap: "anywhere",
  },

  actionCard: {
    background: "#172033",
    color: "#ffffff",
    borderRadius: "14px",
    padding: "25px",
    marginBottom: "20px",
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1fr) minmax(0, 1fr)",
    gap: "20px",
    alignItems: "center",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  actionContent: {
    minWidth: 0,
    overflow: "hidden",
  },

  actionLabel: {
    display: "block",
    color: "#98a2b3",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: "8px",
  },

  actionTitle: {
    margin: 0,
    overflowWrap: "anywhere",
    wordBreak: "break-word",
    lineHeight: 1.3,
  },

  evidenceList: {
    display: "grid",
    gap: "12px",
  },

  evidenceCard: {
    padding: "18px",
    border: "1px solid #e4e7ec",
    borderRadius: "10px",
    minWidth: 0,
    boxSizing: "border-box",
  },

  evidenceTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    flexWrap: "wrap",
  },

  evidenceInfo: {
    minWidth: 0,
  },

  evidenceType: {
    fontSize: "11px",
    fontWeight: "800",
    color: "#2563eb",
  },

  evidenceReference: {
    margin: "6px 0 0",
    overflowWrap: "anywhere",
  },

  evidenceDescription: {
    color: "#475467",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },

  relevance: {
    height: "fit-content",
    padding: "5px 9px",
    borderRadius: "999px",
    background: "#f2f4f7",
    fontSize: "11px",
    fontWeight: "800",
    whiteSpace: "nowrap",
  },

  critical: {
    background: "#fee4e2",
    color: "#b42318",
  },

  high: {
    background: "#fff3cd",
    color: "#946200",
  },

  countBadge: {
    background: "#eef4ff",
    color: "#2563eb",
    padding: "7px 11px",
    borderRadius: "999px",
    fontWeight: "700",
    fontSize: "12px",
    whiteSpace: "nowrap",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    flexWrap: "wrap",
  },

  sectionHeaderText: {
    minWidth: 0,
    flex: "1 1 500px",
  },

  findingsGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "15px",
  },

  finding: {
    padding: "16px",
    background: "#f8fafc",
    borderRadius: "9px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "15px",
    overflowWrap: "anywhere",
  },

  empty: {
    padding: "25px",
    textAlign: "center",
    color: "#667085",
  },

  resolutionCard: {
    background: "#ffffff",
    borderRadius: "14px",
    padding: "25px",
    border: "2px solid #16a34a",
    marginBottom: "20px",
    boxSizing: "border-box",
    minWidth: 0,
  },

  resolutionTitle: {
    marginBottom: 0,
    overflowWrap: "anywhere",
  },

  resolvedBadge: {
    background: "#ecfdf3",
    color: "#027a48",
    padding: "8px 13px",
    borderRadius: "999px",
    fontWeight: "700",
    whiteSpace: "nowrap",
  },

  resolutionSection: {
    marginTop: "25px",
    paddingTop: "20px",
    borderTop: "1px solid #e4e7ec",
    minWidth: 0,
  },

  actionDescription: {
    lineHeight: 1.6,
    color: "#475467",
    overflowWrap: "anywhere",
  },

  refundBox: {
    padding: "15px",
    background: "#f8fafc",
    borderRadius: "9px",
    marginTop: "10px",
  },

  customerResponse: {
    marginTop: "20px",
    padding: "18px",
    background: "#eef4ff",
    borderRadius: "10px",
    lineHeight: 1.6,
    overflowWrap: "anywhere",
  },

  auditItem: {
    marginTop: "12px",
    padding: "14px",
    borderLeft: "3px solid #2563eb",
    background: "#f8fafc",
    borderRadius: "5px",
    overflowWrap: "anywhere",
  },
};