export default function Home() {
  return (
    <main
      style={{
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#ffffff",
        color: "#111827",
        minHeight: "100vh",
      }}
    >
      {/* Navbar */}
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "20px 50px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h2 style={{ margin: 0 }}>VENTIQ</h2>

        <div style={{ display: "flex", gap: "20px" }}>
          <a href="#" style={{ color: "#111827", textDecoration: "none" }}>
            Solutions
          </a>
          <a href="#" style={{ color: "#111827", textDecoration: "none" }}>
            Modules
          </a>
          <a href="#" style={{ color: "#111827", textDecoration: "none" }}>
            About
          </a>
          <a href="#" style={{ color: "#111827", textDecoration: "none" }}>
            Contact
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          textAlign: "center",
          padding: "100px 20px",
        }}
      >
        <h1
          style={{
            fontSize: "54px",
            maxWidth: "900px",
            margin: "0 auto",
            lineHeight: 1.2,
          }}
        >
          Run Your Entire Investment Firm From One Intelligent Platform
        </h1>

        <p
          style={{
            fontSize: "20px",
            maxWidth: "800px",
            margin: "30px auto",
            color: "#4b5563",
          }}
        >
          VENTIQ unifies fund operations, investor management, compliance,
          accounting, and portfolio intelligence into one AI-powered operating
          system.
        </p>

        <button
          style={{
            backgroundColor: "#2563eb",
            color: "white",
            border: "none",
            padding: "14px 28px",
            borderRadius: "8px",
            fontSize: "16px",
            cursor: "pointer",
          }}
        >
          Request Demo
        </button>
      </section>

      {/* Who We Serve */}
      <section
        style={{
          backgroundColor: "#f8fafc",
          padding: "80px 50px",
          textAlign: "center",
          color: "#111827",
        }}
      >
        <h2 style={{ marginBottom: "40px" }}>Who We Serve</h2>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            flexWrap: "wrap",
          }}
        >
          {[
            "VC Funds",
            "PE Funds",
            "Debt Funds",
            "Family Offices",
            "AIF Managers",
          ].map((item) => (
            <div
              key={item}
              style={{
                background: "white",
                padding: "20px",
                borderRadius: "10px",
                minWidth: "180px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* Core Modules */}
      <section
        style={{
          padding: "80px 50px",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginBottom: "40px" }}>Core Modules</h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: "20px",
            maxWidth: "1000px",
            margin: "0 auto",
          }}
        >
          {[
            "Fund Management",
            "Investor Management",
            "Compliance Engine",
            "Accounting Engine",
            "AI Intelligence",
          ].map((item) => (
            <div
              key={item}
              style={{
                padding: "25px",
                border: "1px solid #e5e7eb",
                borderRadius: "10px",
                background: "white",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* Why VENTIQ */}
      <section
        style={{
          backgroundColor: "#f8fafc",
          padding: "80px 50px",
          textAlign: "center",
          color: "#111827",
        }}
      >
        <h2>Why VENTIQ?</h2>

        <p
          style={{
            maxWidth: "800px",
            margin: "20px auto",
            fontSize: "18px",
            color: "#4b5563",
          }}
        >
          One platform. One source of truth. Built specifically for private
          capital firms. Powered by AI.
        </p>
      </section>

      {/* Footer */}
      <footer
        style={{
          textAlign: "center",
          padding: "40px",
          borderTop: "1px solid #e5e7eb",
          color: "#6b7280",
        }}
      >
        © 2026 VENTIQ. AI-Powered Operating System for Private Capital.
      </footer>
    </main>
  );
}