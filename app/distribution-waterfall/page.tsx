"use client";

import { useState } from "react";

export default function DistributionWaterfallPage() {
  const [distributionAmount, setDistributionAmount] = useState(18.5);

  return (
    <main className="app-page">
      <section className="app-shell">
        <div className="app-header">
          <div>
            <p className="eyebrow">VENTIQ Finance</p>
            <h1>AI Distribution Waterfall</h1>
            <p>
              AI-assisted distribution planning, waterfall calculation, carry
              analysis, LP allocation and fund accounting preparation.
            </p>
          </div>

          <a className="back-link" href="/">
            Back to Home
          </a>
        </div>

        <div className="preview-card">
          <h2>AI Distribution Recommendation</h2>

          <div className="explain-box">
            VENTIQ recommends distributing ₹{distributionAmount.toFixed(2)} Cr.
            Confidence: 99%. The recommendation is based on realised exit
            proceeds, interest collections, pending liabilities, management fees
            and the fund&apos;s liquidity policy.
          </div>
        </div>

        <div className="impact-grid">
          <div className="impact-card">
            <h3>₹{distributionAmount.toFixed(2)} Cr</h3>
            <p>Recommended distribution</p>
          </div>

          <div className="impact-card">
            <h3>99%</h3>
            <p>AI confidence</p>
          </div>

          <div className="impact-card">
            <h3>4</h3>
            <p>Eligible LPs</p>
          </div>

          <div className="impact-card">
            <h3>₹0</h3>
            <p>Pending capital calls</p>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Financial Reasoning</h2>

          <div className="journal-preview">
            <div className="journal-row">
              <span>Cash Available</span>
              <strong>₹28.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Add: Exit Proceeds</span>
              <strong>₹4.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Add: Interest Income</span>
              <strong>₹2.00 Cr</strong>
            </div>

            <div className="journal-row">
              <span>Less: Management Fee</span>
              <strong>(₹1.00 Cr)</strong>
            </div>

            <div className="journal-row">
              <span>Less: Fund Expenses</span>
              <strong>(₹0.50 Cr)</strong>
            </div>

            <div className="journal-row">
              <span>Distributable Cash</span>
              <strong>₹32.50 Cr</strong>
            </div>

            <div className="journal-row">
              <span>AI Recommendation</span>
              <strong>Distribute ₹{distributionAmount.toFixed(2)} Cr</strong>
            </div>

            <div className="journal-row">
              <span>Confidence</span>
              <strong>99%</strong>
            </div>
          </div>

          <div className="explain-box">
            <strong>Why?</strong> VENTIQ analysed realised proceeds, interest
            collections, pending liabilities, management fees, expenses and
            liquidity policy. The AI recommends distributing ₹
            {distributionAmount.toFixed(2)} Cr while retaining adequate
            liquidity for future obligations.
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Generated Distribution</h2>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>Growth Fund II</h3>
              <p>Fund selected by AI</p>
            </div>

            <div className="impact-card">
              <h3>₹{distributionAmount.toFixed(2)} Cr</h3>
              <p>Recommended amount</p>
            </div>

            <div className="impact-card">
              <h3>4</h3>
              <p>Eligible LPs</p>
            </div>

            <div className="impact-card">
              <h3>99%</h3>
              <p>AI confidence</p>
            </div>
          </div>

          <div className="form-card">
            <p className="eyebrow">
              Prepared automatically by VENTIQ AI — editable before approval
            </p>

            <label>Fund Type</label>
            <select>
              <option>Close-ended Fund</option>
              <option>Open-ended Fund</option>
            </select>

            <label>Fund</label>
            <select>
              <option>Growth Fund II</option>
              <option>Venture Debt Fund III</option>
              <option>GIFT City Fund I</option>
            </select>

            <label>Distribution Amount (₹ Cr)</label>
            <input
              type="number"
              value={distributionAmount}
              onChange={(event) =>
                setDistributionAmount(Number(event.target.value))
              }
            />

            <label>Distribution Type</label>
            <select>
              <option>Exit Proceeds</option>
              <option>Income Distribution</option>
              <option>Capital Distribution</option>
              <option>Interest Income</option>
            </select>

            <label>Waterfall Method</label>
            <select>
              <option>European Waterfall</option>
              <option>American Waterfall</option>
              <option>Deal-by-deal Waterfall</option>
            </select>

            <label>Exclude Investor</label>
            <select>
              <option>None</option>
              <option>Family Office Investor</option>
              <option>Strategic LP</option>
            </select>

            <div className="logic-note">
              VENTIQ pre-filled this distribution using realised exits, interest
              collections, liquidity policy, investor preferences and the
              fund&apos;s waterfall rules.
            </div>

            <div className="action-row">
              <button>Approve Recommendation</button>
              <button>Save Draft</button>
            </div>
          </div>
        </div>

        <div className="preview-card">
          <h2>AI Waterfall Summary</h2>

          <div className="queue-grid">
            <div className="queue-item">
              <strong>Tier 1</strong>
              <br />
              Return of Capital
              <br />
              ₹12.00 Cr
              <br />
              🟢 Completed
            </div>

            <div className="queue-item">
              <strong>Tier 2</strong>
              <br />
              Preferred Return
              <br />
              ₹4.00 Cr
              <br />
              🟢 Completed
            </div>

            <div className="queue-item">
              <strong>Tier 3</strong>
              <br />
              GP Catch-up
              <br />
              ₹1.00 Cr
              <br />
              🟢 Completed
            </div>

            <div className="queue-item">
              <strong>Tier 4</strong>
              <br />
              Carried Interest
              <br />
              ₹1.50 Cr
              <br />
              🟢 Completed
            </div>
          </div>

          <div className="impact-grid">
            <div className="impact-card">
              <h3>₹{distributionAmount.toFixed(2)} Cr</h3>
              <p>Total distribution</p>
            </div>

            <div className="impact-card">
              <h3>₹1.50 Cr</h3>
              <p>Carry calculated</p>
            </div>

            <div className="impact-card">
              <h3>₹4.00 Cr</h3>
              <p>Preferred return</p>
            </div>

            <div className="impact-card">
              <h3>European</h3>
              <p>Waterfall method</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}