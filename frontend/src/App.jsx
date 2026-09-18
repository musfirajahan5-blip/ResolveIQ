import {
  BrowserRouter,
  Routes,
  Route,
  useParams,
  useSearchParams,
  Link,
} from "react-router-dom";

import Home from "./Home";
import Complaint from "./pages/Complaint";
import CaseView from "./pages/CaseView";
import Investigation from "./pages/Investigation";


function CaseCreated() {
  const { caseId } = useParams();
  const [searchParams] = useSearchParams();

  const ticketId = searchParams.get("ticketId");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: "60px 20px",
        fontFamily:
          "Inter, Arial, sans-serif",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: "#ffffff",
          border: "1px solid #e5eaf1",
          borderRadius: "20px",
          padding: "42px",
          textAlign: "center",
          boxShadow:
            "0 10px 30px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div
          style={{
            width: "64px",
            height: "64px",
            margin: "0 auto 20px",
            borderRadius: "50%",
            background: "#dcfce7",
            color: "#166534",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "30px",
            fontWeight: "800",
          }}
        >
          ✓
        </div>

        <p
          style={{
            margin: 0,
            color: "#64748b",
            fontSize: "12px",
            fontWeight: "800",
            letterSpacing: "0.1em",
          }}
        >
          RESOLVEIQ
        </p>

        <h1
          style={{
            margin: "10px 0 8px",
            color: "#172033",
            fontSize: "28px",
            fontWeight: "800",
          }}
        >
          Complaint Submitted Successfully
        </h1>

        <p
          style={{
            margin: "0 0 24px",
            color: "#64748b",
            fontSize: "15px",
          }}
        >
          Your support case has been created and is ready
          for investigation.
        </p>

        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e5eaf1",
            borderRadius: "14px",
            padding: "18px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: "800",
              letterSpacing: "0.08em",
              marginBottom: "7px",
            }}
          >
            CASE ID
          </div>

          <div
            style={{
              color: "#172033",
              fontSize: "21px",
              fontWeight: "800",
              overflowWrap: "anywhere",
            }}
          >
            {caseId}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          {ticketId ? (
            <Link
              to={`/case/${ticketId}`}
              style={{
                padding: "12px 20px",
                background: "#172033",
                color: "#ffffff",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: "800",
                fontSize: "14px",
              }}
            >
              View Case →
            </Link>
          ) : (
            <Link
              to="/"
              style={{
                padding: "12px 20px",
                background: "#172033",
                color: "#ffffff",
                borderRadius: "10px",
                textDecoration: "none",
                fontWeight: "800",
                fontSize: "14px",
              }}
            >
              ← Back to Home
            </Link>
          )}

          <Link
            to="/"
            style={{
              padding: "12px 20px",
              border: "1px solid #cbd5e1",
              color: "#334155",
              background: "#ffffff",
              borderRadius: "10px",
              textDecoration: "none",
              fontWeight: "700",
              fontSize: "14px",
            }}
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}


function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Home */}
        <Route
          path="/"
          element={<Home />}
        />

        {/* Complaint Submission */}
        <Route
          path="/complaint"
          element={<Complaint />}
        />

        {/* Case Created */}
        <Route
          path="/case-created/:caseId"
          element={<CaseCreated />}
        />

        {/* Customer Case View */}
        <Route
          path="/case/:ticketId"
          element={<CaseView />}
        />

        {/* Investigation Workspace */}
        <Route
          path="/investigation/:ticketId"
          element={<Investigation />}
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;