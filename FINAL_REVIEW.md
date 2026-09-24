# Kalakart Final Review

This build keeps the attached Kalakart visual language while making the application data-driven and removing demo-only personal statistics from the seller dashboard.

## Core application
- Artisan and buyer account registration/login/logout.
- Email validation accepts normal addresses such as Gmail, Outlook, etc.
- Seller dashboard personal KPIs come only from the signed-in user's database records.
- New artisan starts at 0 products, 0 orders, 0 buyers and ₹0 revenue.
- Marketplace guidance is explicitly labeled as general/default guidance until real marketplace order data exists.
- Real marketplace order analytics are calculated from stored orders.

## Seller AI workflow
- Add Product supports up to 6 local photos.
- Manual title, description, category, materials, price, stock and tags.
- Image AI can identify the likely craft/product and suggest details.
- Multilingual browser speech recognition supports common Indian languages.
- AI listing generation uses the photo + voice/text + image analysis to suggest title, description, category, materials, tags and price only when supplied.
- Every AI suggestion remains editable before publishing.
- Dashboard AI assistant answers using database-grounded products, orders and analytics.

## Buyer marketplace workflow
- Browse products stored in the real marketplace database.
- Search, category filtering, sorting and browser voice search.
- Product detail page uses actual stored product data.
- Save uses local browser storage; Share uses the browser share API or clipboard fallback.
- Buyer checkout creates a real order linked to buyer, artisan and product.
- Stock decreases when a real order is created.

## Data integrity
- users.id -> products.owner_id
- users.id -> orders.buyer_id
- users.id -> orders.artisan_id
- products.id -> orders.product_id
- No hard-coded seller revenue, buyer counts, ratings, reviews or fake order activity are used in the final dashboard.

## AI configuration
- Copy `.env.example` to `.env`.
- Put the server-side OpenAI API key in `OPENAI_API_KEY`.
- The server loads `.env` automatically.
- AI is disabled gracefully when no key is configured; the app does not fabricate AI output.
