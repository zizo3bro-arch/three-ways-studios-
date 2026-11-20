import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

test('emails: customer confirmation and admin new-order content, branding and mobile layout', async (t) => {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
  });
  t.after(() => vite.close());

  const { customerConfirmationEmail, adminNewOrderEmail } = await vite.ssrLoadModule(
    '/src/lib/emails.ts'
  );

  const siteUrl = 'https://three-ways-studios.vercel.app';
  const order = {
    order_id: '00000000-0000-4000-8000-000000000001',
    order_reference: 'TWS-2026-ABCDEF123456',
    customer_name: 'Amina Ragab',
    customer_email: 'amina@example.test',
    customer_phone: '01234567890',
    governorate: 'Cairo',
    city: 'Maadi',
    delivery_address: '15 Al-Ahram Street, Building 8',
    order_notes: 'Please call before delivery.',
    payment_method: 'COD',
    subtotal: 2800,
    shipping_cost: 75,
    email_discount_amount: 280,
    promo_discount_amount: 0,
    discount_total: 280,
    applied_promo_code: null,
    total_amount: 2595,
    created_at: '2026-11-20T10:15:00Z',
    status: 'pending',
    items: [
      {
        product_name: 'Signature tee',
        product_slug: 'signature-tee',
        product_image: '/media/campaign/signature-tee.webp',
        color_name: 'Black',
        color_hex: '#17130f',
        size_name: 'M',
        unit_price: 1400,
        quantity: 1,
        line_total: 1400,
      },
      {
        product_name: 'Denim bootcut',
        product_slug: 'denim-bootcut',
        product_image: null,
        color_name: 'Navy',
        color_hex: '#1e3a5f',
        size_name: 'L',
        unit_price: 1400,
        quantity: 1,
        line_total: 1400,
      },
    ],
  };

  const customer = customerConfirmationEmail(order, {
    siteUrl,
    logoUrl: `${siteUrl}/assets/three-ways-studios-logo.png`,
  });

  // Subject & sender branding
  assert.match(customer.subject, /Order Confirmed — TWS-2026-ABCDEF123456/);

  // Core required content
  assert.match(customer.html, /ORDER CONFIRMED/);
  assert.match(customer.html, /Amina Ragab/);
  assert.match(customer.html, /TWS-2026-ABCDEF123456/);
  assert.match(customer.html, /20 Nov 2026/);
  assert.match(customer.html, /Cash on Delivery/);

  // Products: names, variants, sizes, quantities, prices
  assert.match(customer.html, /Signature tee/);
  assert.match(customer.html, /Denim bootcut/);
  assert.match(customer.html, /Black/);
  assert.match(customer.html, /Navy/);
  assert.match(customer.html, /Size M/);
  assert.match(customer.html, /Size L/);
  assert.match(customer.html, /Qty 1/);
  assert.match(customer.html, /EGP 1,400/);
  assert.match(customer.html, /EGP 2,800/);

  // Logo: the actual uploaded brand asset, absolutely addressed
  assert.match(
    customer.html,
    /https:\/\/three-ways-studios\.vercel\.app\/assets\/three-ways-studios-logo\.png/
  );
  // Relative product image is made absolute for email clients
  assert.match(
    customer.html,
    /https:\/\/three-ways-studios\.vercel\.app\/media\/campaign\/signature-tee\.webp/
  );

  // Money blocks
  assert.match(customer.html, /EGP 2,800/); // subtotal
  assert.match(customer.html, /−EGP 280/); // email discount
  assert.match(customer.html, /EGP 75/); // shipping
  assert.match(customer.html, /EGP 2,595/); // final total

  // Delivery & contact
  assert.match(customer.html, /15 Al-Ahram Street, Building 8/);
  assert.match(customer.html, /Maadi, Cairo/);
  assert.match(customer.html, /01234567890/);
  assert.match(customer.html, /amina@example.test/);
  assert.match(customer.html, /Please call before delivery\./);

  // Existing order-tracking functionality: open the receipt by reference + email
  assert.match(
    customer.html,
    /href="https:\/\/three-ways-studios\.vercel\.app\/order-confirmation\/TWS-2026-ABCDEF123456\?email=amina%40example\.test"/
  );

  // Mobile + desktop responsive
  assert.match(customer.html, /name="viewport" content="width=device-width, initial-scale=1.0"/);
  assert.match(customer.html, /@media \(max-width: 480px\)/);

  // Plain-text fallback carries the same facts
  assert.match(customer.text, /TWS-2026-ABCDEF123456/);
  assert.match(customer.text, /EGP 2,595/);

  // Admin notification
  const admin = adminNewOrderEmail(order, {
    siteUrl,
    logoUrl: `${siteUrl}/assets/three-ways-studios-logo.png`,
  });
  assert.match(admin.subject, /NEW ORDER RECEIVED — TWS-2026-ABCDEF123456/);
  assert.match(admin.html, /NEW ORDER/);
  assert.match(admin.html, /Cash on Delivery/);
  assert.match(admin.html, /New order received/);
  assert.match(admin.html, /Amina Ragab/);
  assert.match(admin.html, /amina@example\.test/);
  assert.match(admin.html, /01234567890/);
  assert.match(admin.html, /15 Al-Ahram Street, Building 8/);
  assert.match(admin.html, /Maadi, Cairo/);
  assert.match(admin.html, /Please call before delivery\./);
  assert.match(admin.html, /Signature tee/);
  assert.match(admin.html, /Denim bootcut/);
  assert.match(admin.html, /EGP 2,595/);
  // Existing Admin Panel link
  assert.match(
    admin.html,
    /href="https:\/\/three-ways-studios\.vercel\.app\/admin"/
  );
  assert.match(admin.text, /NEW ORDER RECEIVED/);
});
