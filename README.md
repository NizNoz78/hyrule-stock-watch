# Hyrule Stock Watch

A small Canadian stock-monitoring dashboard for **Nintendo Switch 2 — The Legend of Zelda — 40th Anniversary Edition**.

## Filters

- Canadian retailer pages only.
- Maximum item price: **$709.99 CAD** (before tax/shipping).
- Marketplace sellers are excluded when the page identifies a seller other than the retailer.
- Email is sent only when a retailer changes from a non-qualifying state to a verified `IN_STOCK` state. No repeat email for unchanged stock.

## Important limitations

This is a best-effort page monitor, not an official retailer API. Retailers may change page markup, add bot protection, or display regional inventory differently. `REVIEW` means the script could not safely verify the exact product, seller, price, or stock state; it does not mean out of stock. Always confirm on the retailer's own page before purchasing.

GitHub Actions scheduled jobs are best-effort. The five-minute schedule may be delayed by GitHub. The app does not reserve stock.

## Set it up (about 10–15 minutes)

1. Create a **private or public GitHub repository** and upload the contents of this folder.
2. In the repository, open **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `RESEND_API_KEY`: API key from https://resend.com/
   - `ALERT_EMAIL`: the email address that should receive restock alerts
   - `FROM_EMAIL`: a sender address verified in your Resend account, e.g. `Stock Watch <alerts@your-verified-domain.com>`
3. Open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**.
4. Open **Actions → Check Zelda anniversary stock → Run workflow** once to start the first check.
5. After the workflow completes, open **Settings → Pages** to find the dashboard URL.

The workflow then checks on a five-minute GitHub Actions schedule and republishes `status.json` to the dashboard.

## Local test

Requires Node.js 22+.

```bash
npm install
npx playwright install chromium
npm run check
```

For local email testing, set `RESEND_API_KEY`, `ALERT_EMAIL`, and `FROM_EMAIL` in your shell before running.

## Retailer targets

- Nintendo Canada: https://www.nintendo.com/en-ca/store/hardware/
- Best Buy Canada: https://www.bestbuy.ca/en-ca/product/nintendo-switch-2-console-the-legend-of-zelda-40th-anniversary-edition/20149861
- Canada Computers: https://www.canadacomputers.com/en/nintendo/295672/nintendo-switch-2-the-legend-of-zelda-40th-anniversary-edition.html
- Amazon Canada: search results for the exact edition; Amazon must identify Amazon.ca as seller.
- Walmart Canada: search results for the exact edition; Walmart must identify Walmart as seller.
