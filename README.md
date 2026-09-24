# Kalakart — AI Full-Stack Final

This version keeps the attached Kalakart frontend style and connects the seller dashboard to a real Node.js/JSON database.

## Included
- Real account registration/login/logout.
- Users, products and orders are linked with IDs.
- New artisan starts with personal Products/Orders/Buyers/Revenue = 0.
- Dashboard keeps useful **GENERAL MARKET INSIGHTS** when there is not enough accumulated marketplace data; these are clearly labeled as default guidance, not personal statistics.
- Once marketplace orders exist, the dashboard switches to **YOUR MARKET INSIGHTS / REAL DATA** and calculates category trends from stored orders.
- Add Product: manual fields + up to 6 local photo previews.
- Multilingual browser speech recognition (language selector for common Indian languages).
- Image AI identification.
- AI listing generation from photo + voice/text notes.
- Dashboard AI assistant grounded in database analytics/products/orders.
- Buyer checkout creates a real order linked to buyer, artisan and product.
- No fake personal dashboard counts or fake recent orders.

## Windows setup
1. Extract this ZIP.
2. Open the extracted `kalakart-final` folder.
3. Open PowerShell in that folder.
4. Run:
   `node server.js`
5. Open:
   `http://127.0.0.1:3000`

## Enable live AI
1. Copy `.env.example` to `.env`. The server automatically reads `.env` on startup; no `dotenv` package is required.
2. Put your API key in `OPENAI_API_KEY=...`.
3. Restart `node server.js`.
4. Image identification, listing generation and the dashboard AI assistant will then call the OpenAI API.
5. The key is never sent to the browser.

If no API key is configured, the normal database/auth/product/order features still work, while AI endpoints clearly report that AI is not configured rather than showing fake AI output.

## Browser voice
Use a recent Chrome/Edge build. Select the spoken language in Add Product and press the microphone. The browser's Speech Recognition API converts speech to editable text. Availability varies by browser/OS.

## Data
The JSON database is created at `data/db.json` on first registration. It contains users, products, orders and sessions. Passwords are salted/scrypt-hashed; raw passwords are not stored.

## Important
This is a project/demo implementation. For production deployment, move the JSON database to PostgreSQL/MySQL, add proper CSRF/rate limiting/validation, object storage for images, and production authentication/session management.

### Messaging
The project includes database-backed buyer ↔ artisan messaging. A buyer can open a marketplace product, choose **Message artisan**, and send a message after signing in as a buyer. An artisan sees the conversation in **Seller Dashboard → Messages** and can reply. Messages are stored in `data/db.json` under `messages` when the app is running.
