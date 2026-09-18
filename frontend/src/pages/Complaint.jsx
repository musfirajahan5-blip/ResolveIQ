import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTicket } from "../api/client";
import "../App.css";

const CUSTOMER_ID = 1;

function Complaint() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    customer: "Alex Johnson",
    category: "",
    orderId: "",
    subject: "",
    description: "",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setFormData({
      ...formData,
      [event.target.name]: event.target.value,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (
      !formData.category ||
      !formData.subject ||
      !formData.description
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const ticket = await createTicket({
        customerId: CUSTOMER_ID,
        category: formData.category,
        orderReference: formData.orderId.trim() || null,
        subject: formData.subject.trim(),
        description: formData.description.trim(),
      });

      navigate(`/case-created/${ticket.caseId}?ticketId=${ticket.id}`);
    } catch (submitError) {
      setError(submitError.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">R</div>

          <div>
            <h1>ResolveIQ</h1>
            <span>Customer Support</span>
          </div>
        </div>

        <nav className="navigation">
          <div className="nav-section">MENU</div>

          <a
            className="nav-item"
            onClick={() => navigate("/")}
          >
            <span>⌂</span>
            Home
          </a>

          <a className="nav-item">
            <span>▣</span>
            My Cases
          </a>

          <a className="nav-item active">
            <span>＋</span>
            Submit Complaint
          </a>

          <div className="nav-section support-section">
            SUPPORT
          </div>

          <a className="nav-item">
            <span>?</span>
            Help Center
          </a>

          <a className="nav-item">
            <span>⚙</span>
            Settings
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">AJ</div>

            <div>
              <strong>Alex Johnson</strong>
              <small>Customer</small>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">

        <header className="topbar">
          <span className="breadcrumb">
            Customer Portal / Submit Complaint
          </span>

          <div className="topbar-actions">
            <button className="notification-button">
              🔔
            </button>

            <div className="profile">
              <div className="avatar">AJ</div>

              <div>
                <strong>Alex Johnson</strong>
                <small>Customer</small>
              </div>

              <span className="dropdown">⌄</span>
            </div>
          </div>
        </header>

        <section className="dashboard complaint-page">

          <div className="complaint-heading">
            <span className="eyebrow">
              SUPPORT REQUEST
            </span>

            <h2>Submit a Complaint</h2>

            <p>
              Tell us what happened. ResolveIQ will investigate
              the issue using your related account information.
            </p>
          </div>

          <div className="complaint-layout">

            {/* Form */}
            <section className="panel complaint-form-panel">

              <div className="panel-header">
                <div>
                  <h3>Complaint Details</h3>

                  <p>
                    Provide as much information as possible.
                  </p>
                </div>
              </div>

              <form
                className="complaint-form"
                onSubmit={handleSubmit}
              >

                <div className="form-group">
                  <label>Customer</label>

                  <input
                    type="text"
                    value={formData.customer}
                    disabled
                  />
                </div>

                <div className="form-group">
                  <label>
                    Issue Category <span>*</span>
                  </label>

                  <select
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option value="">
                      Select an issue category
                    </option>

                    <option value="PAYMENT">
                      Payment Issue
                    </option>

                    <option value="REFUND">
                      Refund
                    </option>

                    <option value="ORDER">
                      Order Issue
                    </option>

                    <option value="ACCOUNT">
                      Account Issue
                    </option>

                    <option value="OTHER">
                      Other
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Order / Reference ID</label>

                  <input
                    type="text"
                    name="orderId"
                    placeholder="Example: ORD-1001"
                    value={formData.orderId}
                    onChange={handleChange}
                  />

                  <small>
                    Add an order ID if your complaint is related
                    to an order.
                  </small>
                </div>

                <div className="form-group">
                  <label>
                    Subject <span>*</span>
                  </label>

                  <input
                    type="text"
                    name="subject"
                    placeholder="Briefly describe your issue"
                    value={formData.subject}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>
                    Complaint Description <span>*</span>
                  </label>

                  <textarea
                    name="description"
                    rows="7"
                    placeholder="Tell us what happened..."
                    value={formData.description}
                    onChange={handleChange}
                  />
                </div>

                {error && (
                  <div className="form-error">
                    ⚠ {error}
                  </div>
                )}

                <div className="form-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => navigate("/")}
                    disabled={submitting}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={submitting}
                  >
                    {submitting
                      ? "Submitting..."
                      : "Submit Complaint →"}
                  </button>
                </div>

              </form>
            </section>

            {/* Information panel */}
            <aside className="panel complaint-info">

              <div className="info-icon">
                🔎
              </div>

              <h3>
                What happens next?
              </h3>

              <p>
                ResolveIQ investigates your complaint using
                related information rather than simply giving
                a chatbot response.
              </p>

              <div className="info-step">
                <div>01</div>

                <span>
                  <strong>Understand</strong>
                  Identify your intent and sentiment.
                </span>
              </div>

              <div className="info-step">
                <div>02</div>

                <span>
                  <strong>Investigate</strong>
                  Check related records and history.
                </span>
              </div>

              <div className="info-step">
                <div>03</div>

                <span>
                  <strong>Resolve</strong>
                  Recommend a resolution or human support.
                </span>
              </div>

            </aside>

          </div>

        </section>
      </main>
    </div>
  );
}

export default Complaint;