# Cloud Commitment Savings Calculator

A lightweight, interactive web tool that helps AWS customers and sales teams evaluate cloud commitment strategies using [Archera's](https://archera.ai) insured commitment products.

## What This Does

Customers input their annual AWS spend, usage stability, and current commitment coverage. The tool models three strategies side-by-side:

- **Archera Insured 30-Day** — Guaranteed Savings Plans (GSPs) and Guaranteed Reserved Instances (GRIs) with 30-day terms instead of 1–3 year lock-ins, backed by Archera's Moneyback Guarantee
- **AWS Native + Archera Insured** — Native AWS 1-year Savings Plans for steady workloads combined with Archera GSPs for variable spend
- **Archera PPA Insurance** — AWS Private Pricing Agreement (PPA/EDP) volume discounts with Archera insurance protecting against spend shortfall

Each strategy card shows annual savings, net savings rate, a "What if usage drops 20%?" risk comparison, and an expandable cost breakdown showing the full spend-to-savings waterfall.

## Key Features

- **Annual spend slider** ($30K–$50M) with real-time calculation updates
- **Stability profiles** (Steady / Growing / Variable) that shift how spend is allocated across commitment types
- **Dynamic recommendation** badge that moves based on which strategy fits best given the inputs
- **Stress test** slider (-50% to +50%) showing how each strategy performs when actual usage differs from plan
- **Adjustable assumptions** panel for customizing discount rates, Archera premiums, and PPA tier thresholds
- **Sticky input bar** that stays visible when scrolling through results

## How It Works

All calculations run client-side with no backend. Default assumptions are based on published AWS discount ranges (up to 72% for native SPs/RIs) and publicly available Archera product information. The assumptions panel lets reps plug in actual deal-specific numbers.

This is an illustrative modeling tool, not a precise calculator. Actual savings depend on workload composition, region, instance families, payment options, and negotiated terms.

## Tech

Three files, no build step:
- `index.html` — page structure
- `styles.css` — Archera-inspired dark mode theme
- `calculator.js` — calculation engine, Chart.js charts, interactivity

Uses [Chart.js](https://www.chartjs.org/) via CDN for bar charts.

## Sources

- [AWS Savings Plans Pricing](https://aws.amazon.com/savingsplans/compute-pricing/)
- [Archera Insured Commitments](https://archera.ai/insured-commitments/)
- [Archera PPA Insurance](https://archera.ai/aws-ppa-insurance/)
- [Archera Net Savings Rate](https://www.archera.ai/blog/net-savings-rate)
