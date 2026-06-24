export default function Home() {
  return (
    <main>
      <div className="container">
        <nav className="navbar">
          <h2>VENTIQ</h2>

          <div className="nav-links">
            <a href="#">Solutions</a>
            <a href="#">Modules</a>
            <a href="#">About</a>
            <a href="#">Contact</a>
          </div>
        </nav>

        <section className="hero">
          <h1>
            The AI Operating System
            <br />
            For Private Capital
          </h1>

          <p>
            Manage funds, investors, compliance, accounting, and portfolio
            intelligence from one intelligent platform built for modern fund
            managers.
          </p>

          <button className="btn">Request Demo</button>
        </section>

        <section className="metrics">
          <div className="card">
            <h2>₹12,500 Cr</h2>
            <p>Assets Under Management</p>
          </div>

          <div className="card">
            <h2>24.3%</h2>
            <p>Portfolio IRR</p>
          </div>

          <div className="card">
            <h2>98%</h2>
            <p>Compliance Health</p>
          </div>
        </section>

        <section className="section">
  <h2 className="section-title">AI COO Preview</h2>

  <div className="dashboard-card">
    <div className="dashboard-title">
      Good Morning Shubham 👋
    </div>

    <div className="dashboard-grid">
      <div className="dashboard-metric">
        <h3>82%</h3>
        <p>Fund III Deployment</p>
      </div>

      <div className="dashboard-metric">
        <h3>₹118 Cr</h3>
        <p>Uncalled Capital</p>
      </div>

      <div className="dashboard-metric">
        <h3>₹41 Cr</h3>
        <p>Expected Distribution</p>
      </div>
    </div>

    <div className="alert-box">
      <p>⚠ QCR due in 4 days</p>
      <p>📩 12 LP queries pending</p>
      <p>📉 ABC Logistics revenue down 12%</p>
      <p>💰 Distribution expected from XYZ Finance</p>
    </div>
  </div>
</section>

        <section className="section">
          <h2 className="section-title">Core Modules</h2>

          <div className="grid">
            <div className="card">Fund Operations</div>
            <div className="card">Investor Portal</div>
            <div className="card">Compliance Engine</div>
            <div className="card">Accounting Engine</div>
            <div className="card">Portfolio Intelligence</div>
            <div className="card">AI COO</div>
          </div>
        </section>

        <section className="section">
          <h2 className="section-title">AI COO Preview</h2>

          <div className="ai-preview">
            <p><strong>Good Morning Shubham</strong></p>
            <p>Fund III Deployment: 82%</p>
            <p>Uncalled Capital: ₹118 Cr</p>
            <p>Expected Distributions (90 Days): ₹41 Cr</p>
            <p>QCR Due: 4 Days</p>
            <p>Portfolio Alert: ABC Logistics revenue down 12%</p>
            <p>12 LP Queries Pending</p>
          </div>
        </section>
<section className="section">
  <h2 className="section-title">
    One Platform. Three Experiences.
  </h2>

  <div className="three-users">
    <div className="user-card">
      <h3>Managing Partner</h3>

      <ul>
        <li>IRR & DPI Tracking</li>
        <li>Fund Deployment</li>
        <li>Portfolio Health</li>
        <li>Expected Exits</li>
        <li>Capital Availability</li>
      </ul>
    </div>

    <div className="user-card">
      <h3>Finance & Compliance</h3>

      <ul>
        <li>Bank Reconciliation</li>
        <li>Capital Calls</li>
        <li>Distribution Notices</li>
        <li>QCR / TCR Tracking</li>
        <li>SOA Generation</li>
      </ul>
    </div>

    <div className="user-card">
      <h3>Investors (LPs)</h3>

      <ul>
        <li>Capital Call Notices</li>
        <li>Distribution Updates</li>
        <li>Fund Performance</li>
        <li>Document Vault</li>
        <li>Mobile Access</li>
      </ul>
    </div>
  </div>
</section>
        <footer className="footer">
          © 2026 VENTIQ — AI Powered Operating System for Private Capital
        </footer>
      </div>
    </main>
  );
}