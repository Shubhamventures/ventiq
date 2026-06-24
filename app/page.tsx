export default function Home() {
  return (
    <main>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "20px 50px",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h2>VENTIQ</h2>

        <div style={{ display: "flex", gap: "20px" }}>
          <a href="#">Solutions</a>
          <a href="#">Modules</a>
          <a href="#">About</a>
          <a href="#">Contact</a>
        </div>
      </nav>

      <section
        style={{
          textAlign: "center",
          padding: "120px 20px",
        }}
      >
        <h1
          style={{
            fontSize: "56px",
            maxWidth: "900px",
            margin: "0 auto",
          }}
        >
          Run Your Entire Investment Firm From One Intelligent Platform
        </h1>

        <p
          style={{
            fontSize: "20px",
            maxWidth: "800px",
            margin: "30px auto",
            color: "#555",
          }}
        >
          VENTIQ unifies fund operations, investor management, compliance,
          accounting, and portfolio intelligence into a single AI-powered
          operating system.
        </p>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "20px",
            marginTop: "40px",
          }}
        >
          <button
            style={{
              padding: "12px 24px",
              fontSize: "16px",
            }}
          >
            Book Demo
          </button>

          <button
            style={{
              padding: "12px 24px",
              fontSize: "16px",
            }}
          >
            Learn More
          </button>
        </div>
      </section>
    </main>
  );
}