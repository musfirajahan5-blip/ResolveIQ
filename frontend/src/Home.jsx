import { useNavigate } from "react-router-dom";
import "./App.css";

function Home() {
  const navigate = useNavigate();

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

          <a className="nav-item active">
            <span>⌂</span>
            Home
          </a>

          <a className="nav-item">
            <span>▣</span>
            My Cases
          </a>

          <a
  className="nav-item"
  onClick={() => navigate("/complaint")}
>
  <span>＋</span>
  Submit Complaint
</a>

          <div className="nav-section support-section">SUPPORT</div>

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

      {/* Main Content */}
      <main className="main-content">
        {/* Top Header */}
        <header className="topbar">
          <div>
            <span className="breadcrumb">Customer Portal / Home</span>
          </div>

          <div className="topbar-actions">
            <button className="notification-button">🔔</button>

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

        {/* Dashboard */}
        <section className="dashboard">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">CUSTOMER PORTAL</span>
              <h2>Welcome back, Alex 👋</h2>
              <p>
                Track your support cases and get evidence-backed resolutions.
              </p>
            </div>

            <button
  className="primary-button"
  onClick={() => navigate("/complaint")}
>
  <span>＋</span>
  Submit a Complaint
</button>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue">◉</div>
              <div>
                <span>Active Cases</span>
                <strong>2</strong>
              </div>
              <small className="stat-note">Currently investigating</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon green">✓</div>
              <div>
                <span>Resolved</span>
                <strong>5</strong>
              </div>
              <small className="stat-note">Successfully resolved</small>
            </div>

            <div className="stat-card">
              <div className="stat-icon orange">!</div>
              <div>
                <span>Escalated</span>
                <strong>1</strong>
              </div>
              <small className="stat-note">Needs human support</small>
            </div>
          </div>

          {/* Main Grid */}
          <div className="content-grid">
            {/* Cases */}
            <section className="panel cases-panel">
              <div className="panel-header">
                <div>
                  <h3>Recent Cases</h3>
                  <p>Your latest support investigations</p>
                </div>

                <button className="text-button">View all →</button>
              </div>

              <div className="case-list">
                <div className="case-row">
                  <div className="case-icon payment">₿</div>

                  <div className="case-info">
                    <strong>Duplicate payment for order</strong>
                    <span>CASE-1024 • Payment Issue</span>
                  </div>

                  <span className="status investigating">
                    Investigating
                  </span>
                </div>

                <div className="case-row">
                  <div className="case-icon refund">↻</div>

                  <div className="case-info">
                    <strong>Refund not received</strong>
                    <span>CASE-1018 • Refund</span>
                  </div>

                  <span className="status resolved">Resolved</span>
                </div>

                <div className="case-row">
                  <div className="case-icon order">□</div>

                  <div className="case-info">
                    <strong>Order delivery issue</strong>
                    <span>CASE-1012 • Order</span>
                  </div>

                  <span className="status escalated">Escalated</span>
                </div>
              </div>
            </section>

            {/* Investigation Card */}
            <section className="panel investigation-card">
              <div className="investigation-top">
                <span className="eyebrow">ACTIVE INVESTIGATION</span>
                <span className="live-dot">● Live</span>
              </div>

              <h3>Duplicate Payment</h3>

              <p className="investigation-description">
                We're investigating your complaint using related orders,
                payments, refunds and previous support history.
              </p>

              <div className="progress-line">
                <div className="progress-fill"></div>
              </div>

              <div className="investigation-stage">
                <div className="stage-check">✓</div>
                <div>
                  <strong>Evidence collection</strong>
                  <span>Checking related payment records</span>
                </div>
              </div>

              <button className="secondary-button">
                View Investigation →
              </button>
            </section>
          </div>

          {/* How ResolveIQ Works */}
          <section className="workflow-panel">
            <div className="panel-header">
              <div>
                <h3>How ResolveIQ works</h3>
                <p>Your complaint goes through an evidence-backed process.</p>
              </div>
            </div>

            <div className="workflow">
              <div className="workflow-step">
                <div className="workflow-number">01</div>
                <strong>Understand</strong>
                <span>Intent & sentiment</span>
              </div>

              <div className="workflow-arrow">→</div>

              <div className="workflow-step">
                <div className="workflow-number">02</div>
                <strong>Investigate</strong>
                <span>Gather evidence</span>
              </div>

              <div className="workflow-arrow">→</div>

              <div className="workflow-step">
                <div className="workflow-number">03</div>
                <strong>Reason</strong>
                <span>Find root cause</span>
              </div>

              <div className="workflow-arrow">→</div>

              <div className="workflow-step">
                <div className="workflow-number">04</div>
                <strong>Resolve</strong>
                <span>Act or escalate</span>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default Home;