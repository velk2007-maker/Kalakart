# Final implementation map

1. Dashboard
- Personal KPIs are computed from the authenticated user's products/orders.
- New artisan: 0 products, 0 orders, 0 buyers, ₹0 revenue.
- General/default market guidance is shown separately and explicitly labeled.
- Real marketplace category trends appear after marketplace orders exist.

2. Database linkage
- users.id -> products.owner_id
- users.id -> orders.buyer_id
- users.id -> orders.artisan_id
- products.id -> orders.product_id

3. Add Product
- Manual title, description, category, tags, price and stock.
- Up to 6 image previews stored as data URLs for this project build.

4. Image AI
- `/api/ai/identify`
- Sends the uploaded image to the configured AI provider.
- UI keeps the result as an editable note; it does not auto-publish.

5. Multilingual voice
- Browser Speech Recognition.
- Language selector includes common Indian locales.
- Transcript remains editable.

6. AI listing generation
- `/api/ai/listing`
- Uses photo + transcript + image-analysis note.
- Returns title, description, category, tags and optional price.

7. Dashboard AI assistant
- `/api/ai/assistant`
- Receives database-grounded context for the signed-in user.
- Answers product/order/marketplace questions without inventing missing numbers.

8. Analytics/trends
- `/api/analytics`
- Deterministic database calculations.
- No fake percentages, fake orders, fake clients or fake revenue.

## Buyer ↔ Artisan Messaging
- Seller dashboard now includes a real Messages/Inbox section.
- Buyers can open a product and choose **Message artisan**.
- Messages are stored in the server database in the `messages` collection.
- Sellers can read and reply to buyer conversations.
- Buyer conversations are tied to the artisan/product context when started from a product.
- No hard-coded sample conversations are used.
