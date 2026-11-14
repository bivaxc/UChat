# Tech Store Uganda

A mobile-first ecommerce storefront for Tech Store, targeting customers in Uganda.

## Product scope
- Physical electronics, smartphones, phone accessories, audio products and computer accessories.
- Legitimate digital software licences for Windows 10 and Windows 11.
- Physical orders use stock, dispatch and delivery workflows.
- Digital orders use controlled licence allocation and secure delivery.

## Current implementation status
The application is now a Tech Store storefront UI. The frontend is a prototype until the trusted Store API is deployed and connected. It does not yet accept real orders or payments.

## Backend architecture
The existing Supabase project is being repurposed. Store data lives in a separate, non-exposed PostgreSQL schema named store. The schema has RLS enabled and explicit deny policies for direct anon and authenticated access. Only trusted server-side services should access it using server-held credentials. Never put a Supabase service-role or secret key in browser code.

The initial database includes:
- Categories, products and product images
- Inventory balances and movement ledger
- Customers and delivery addresses
- Carts, orders and order-item snapshots
- Payment records and delivery tracking
- Encrypted software licence inventory and digital delivery records
- WhatsApp / website sales conversation references
- Staff roles and audit events

## Store API contract
Set VITE_STORE_API_URL to the base URL of the trusted Store API.

Expected endpoints:
- GET /catalog returns categories and active products.
- POST /orders accepts customer details, product IDs, quantities and delivery details, and returns an order number and confirmation message.

The API must validate product prices and stock from the database, calculate totals server-side, reserve stock transactionally, and never trust prices sent by the browser. Payment confirmation must come from a verified provider callback or trusted reconciliation, not customer screenshots or chat claims.

## Local development
Requirements: Node.js 20+.

~~~bash
npm install
npm run dev
~~~

Create a local .env file:

~~~env
VITE_STORE_API_URL=https://YOUR-STORE-API.example
~~~

Without the API URL, the storefront displays an explicit backend-not-connected state. It does not show fabricated products.

## Deployment
The app is built with Vite and can be hosted on a static frontend host. Configure VITE_STORE_API_URL, then add the production website URL to the Store API's allowed origins.

## Domain
Preferred domain: techstoreug.com. Availability and registration have not yet been verified.