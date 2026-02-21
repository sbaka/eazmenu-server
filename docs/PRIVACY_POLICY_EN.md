# EazMenu — Privacy & Confidentiality Policy

**Last updated:** February 21, 2026

---

## 1. Introduction

EazMenu ("we", "us", "our") is a digital menu and ordering platform that enables restaurant owners and merchants ("Admin Users") to create, manage, and publish their menus online, and allows their customers ("End Users") to browse menus and place orders by scanning QR codes.

This Privacy & Confidentiality Policy describes what personal data we collect, why we collect it, how we process and protect it, and what rights you have regarding your data. It applies to:

- **End Users (Clients):** individuals who scan a QR code to view a restaurant menu and optionally place orders.
- **Admin Users (Merchants):** restaurant owners and managers who register on EazMenu to manage their establishments, menus, and orders.
- **Website Visitors:** individuals who visit the EazMenu landing page and may use the contact form.

---

## 2. Data Controller

The data controller for the personal data processed through EazMenu is:

**EazMenu**
Contact: [Insert contact email address]

For any questions regarding this policy or to exercise your rights, please contact us at the address above.

---

## 3. Data Collected from End Users (Clients)

End Users do **not** need to create an account or provide any personal information to use EazMenu. Browsing a menu and placing an order is fully anonymous.

### 3.1 Session Identifier

When an End User scans a QR code and accesses a restaurant's menu, a **random session identifier** (UUID) is stored as an HTTP-only cookie on their device. This session ID:

- Is a randomly generated string with no link to any personal identity.
- Expires automatically after **24 hours**.
- Is used solely to associate orders with a browsing session so that the End User can view their own order status.

### 3.2 Order Data

When an End User places an order, the following data is stored:

| Data | Purpose |
|---|---|
| Items ordered, quantities, and unit prices | To process and display the order to the restaurant |
| Order total | To calculate the bill |
| Table number | To identify where to deliver the order |
| Order status (Received, Preparing, Ready, Served, Cancelled) | To track order progress |
| Optional free-text notes (e.g. "no onions") | Special preparation instructions requested by the End User |
| Session ID (UUID) | To link the order to the End User's browser session |
| Timestamp | To record when the order was placed |

**Important:** We do **not** collect the End User's name, email address, phone number, physical address, or any other directly identifying information.

### 3.3 Menu Interaction Analytics

We collect anonymous event data when End Users interact with a menu:

| Event | Purpose |
|---|---|
| Menu item views, clicks, and add-to-cart actions | To provide restaurant owners with aggregated analytics on menu performance |

These events are associated only with the anonymous session ID and cannot be traced to an identifiable individual.

### 3.4 Payment Data

When a restaurant has enabled online payments, payment processing is handled entirely by **Stripe**, a PCI DSS-compliant third-party payment provider. EazMenu **never** receives, processes, or stores credit card numbers, CVVs, or any other payment card details. Only the payment status and amount are recorded in our system to update the order. Please refer to [Stripe's Privacy Policy](https://stripe.com/privacy) for details on how Stripe handles your payment data.

### 3.5 Data Retention — End Users

| Data | Retention Period |
|---|---|
| Session cookie | 24 hours (auto-expires) |
| Order data | Retained for the duration needed by the restaurant for operational purposes, then subject to periodic cleanup |
| Menu interaction events | Retained in aggregated form for analytics; individual session IDs are not used for re-identification |

---

## 4. Data Collected from Admin Users (Merchants)

### 4.1 Account Information

When a merchant registers on EazMenu, the following information is collected:

| Data | Purpose |
|---|---|
| Username | To uniquely identify the merchant account |
| Email address | For authentication, account recovery, and service communications |
| Display name | Displayed in the admin interface |
| Profile picture URL | Displayed in the admin interface (from OAuth provider if applicable) |
| Authentication provider (email, Google, Apple, Microsoft) | To manage sign-in method |

Authentication is delegated to **Supabase**, a third-party authentication service. If you sign in via Google, Apple, or Microsoft, your OAuth profile data (name, email, profile picture) is retrieved from the respective provider. **We do not store passwords** — password management is handled entirely by Supabase.

### 4.2 Restaurant / Business Information

Merchants provide business information to set up their restaurant profiles:

| Data | Purpose |
|---|---|
| Restaurant name | Displayed on the public menu |
| Address | Displayed on the public menu (optional) |
| Phone number | Displayed on the public menu (optional) |
| Business email | Displayed on the public menu (optional) |
| Description | Displayed on the public menu |
| Social media links (Instagram, Facebook, TikTok) | Displayed on the public menu (optional) |
| Website URL | Displayed on the public menu (optional) |
| Google Maps URL | Displayed on the public menu (optional) |
| Logo and banner images | Displayed on the public menu |
| Currency and timezone | For order and display configuration |
| Theme configuration (colors, font) | For menu visual customization |

**Note:** Restaurant contact information (address, phone, email) is business contact data voluntarily published by the merchant for their customers. Merchants control what information they choose to display.

### 4.3 Menu Content

Merchants create and manage:

- Categories and menu items (names, descriptions, prices, images)
- Nutritional information (calories, proteins, fats, carbs, weight)
- Allergen declarations
- Ingredients
- Translations in multiple languages

This is business content, not personal data.

### 4.4 Uploaded Files

Merchants may upload images (JPEG, PNG, GIF, WebP) for menu items, restaurant logos, and banners. These files are stored in **Supabase Storage** and served via secure URLs.

### 4.5 Data Retention — Admin Users

| Data | Retention Period |
|---|---|
| Merchant account data | Retained for the lifetime of the account; deleted upon account deletion request |
| Restaurant and menu data | Retained for the lifetime of the account; soft-deleted items are retained for potential recovery, then permanently purged |
| Uploaded images | Retained for the lifetime of the associated restaurant; deleted when the restaurant or account is removed |

---

## 5. Data Collected from Website Visitors

### 5.1 Contact Form

When a visitor submits the contact form on our landing page, the following data is collected:

| Data | Required | Purpose |
|---|---|---|
| Name | Yes | To address the inquiry |
| Email address | Yes | To respond to the inquiry |
| Message | Yes | Content of the inquiry |
| Phone number | No | For follow-up if provided |
| Company name | No | For context about the inquiry |

This data is:

- **Sent via email** to our team for processing.
- **Optionally synced to Klaviyo** (email marketing platform) if the visitor consents, for the purpose of communications about EazMenu services.
- **Not stored in any database** by EazMenu directly.

### 5.2 Google reCAPTCHA v3

The contact form uses Google reCAPTCHA v3 to protect against spam and abuse. Google may collect browser and device information, cookies, and IP addresses as part of this service. Please refer to [Google's Privacy Policy](https://policies.google.com/privacy) for details.

### 5.3 Error Tracking (PostHog)

Our landing page uses **PostHog** (EU-hosted, `eu.posthog.com`) for exception and error tracking. PostHog is configured to:

- **Not** automatically capture page views.
- Capture technical exceptions only (for debugging and site reliability purposes).

PostHog may collect anonymous device/browser metadata and error details. No manual user identification is performed.

---

## 6. Technical & Operational Data

### 6.1 Rate Limiting

To protect our services from abuse, we use in-memory rate limiting that temporarily tracks session IDs or IP addresses. This data:

- Is stored only in server memory (RAM).
- Is never written to disk or database.
- Is automatically purged every 10 minutes.

### 6.2 Server Logs

Our servers generate operational logs that may contain:

- Request metadata (timestamps, HTTP methods, URLs)
- User IDs or session IDs for debugging purposes
- Error messages and stack traces

In production, logs are sanitized to minimize personal data exposure. Logs are retained for a limited period for debugging and security monitoring, then automatically purged.

---

## 7. Third-Party Services

We use the following third-party services that may process data on our behalf:

| Service | Purpose | Data Processed | Privacy Policy |
|---|---|---|---|
| **Supabase** | Authentication & file storage | Merchant accounts, OAuth data, uploaded images | [supabase.com/privacy](https://supabase.com/privacy) |
| **Stripe** | Payment processing (optional) | Payment card data, transaction amounts | [stripe.com/privacy](https://stripe.com/privacy) |
| **Google reCAPTCHA** | Bot protection on contact form | Browser fingerprint, IP address | [policies.google.com/privacy](https://policies.google.com/privacy) |
| **PostHog** | Error tracking (landing page) | Anonymous device/browser metadata, errors | [posthog.com/privacy](https://posthog.com/privacy) |
| **Klaviyo** | Email marketing (optional) | Contact form submissions | [klaviyo.com/legal/privacy](https://www.klaviyo.com/legal/privacy-notice) |
| **Gmail SMTP** | Contact form email forwarding | Contact form submissions | [policies.google.com/privacy](https://policies.google.com/privacy) |

---

## 8. Data Security

We implement the following measures to protect your data:

- **Encryption in transit:** All communications between your device and our servers use HTTPS/TLS encryption.
- **Authentication security:** Merchant authentication is delegated to Supabase with support for multi-factor authentication and OAuth 2.0 protocols.
- **Access control:** Restaurant data is isolated per merchant; merchants can only access their own restaurants and data.
- **No password storage:** We never store passwords; this is fully managed by our authentication provider.
- **No payment card storage:** Credit card data never touches our servers.
- **HTTP-only cookies:** Session cookies are configured as HTTP-only to prevent client-side script access.
- **Rate limiting:** API endpoints are rate-limited to prevent abuse.
- **Input validation & sanitization:** All user inputs are validated and sanitized server-side.

---

## 9. Cookies

| Cookie | Type | Duration | Purpose |
|---|---|---|---|
| `tableSessionId` | Essential / Functional | 24 hours | Links the End User's browser to their orders for order status tracking |

We do **not** use advertising cookies, tracking cookies, or third-party cookies for profiling purposes on the ordering platform. The only cookie set on the customer-facing application is the functional session cookie described above.

---

## 10. Your Rights

Depending on your jurisdiction, you may have the following rights regarding your personal data:

- **Right of access:** Request information about what personal data we hold about you.
- **Right of rectification:** Request correction of inaccurate personal data.
- **Right of erasure:** Request deletion of your personal data.
- **Right to data portability:** Request a copy of your data in a structured, machine-readable format.
- **Right to restrict processing:** Request that we limit the processing of your data.
- **Right to object:** Object to the processing of your personal data.
- **Right to withdraw consent:** Where processing is based on consent, withdraw it at any time.

**For End Users:** Since we do not collect any personally identifying data, there is generally no personal data to access, correct, or delete. If you wish to clear your session, simply delete the cookie from your browser or wait for it to expire (24 hours).

**For Admin Users:** To exercise your rights, contact us at contact@eazmenu.com. Merchants can also delete their restaurant data directly from the admin dashboard. Account deletion requests will be processed within 30 days.

---

## 11. International Data Transfers

Our services may involve data processing across different jurisdictions. Where applicable:

- Supabase and Stripe operate with appropriate data protection safeguards.
- PostHog is configured to use EU-based servers (`eu.posthog.com`).
- We ensure that any international transfers comply with applicable data protection regulations, including the use of Standard Contractual Clauses (SCCs) where required.

---

## 12. Children's Privacy

EazMenu is not directed at individuals under the age of 16. We do not knowingly collect personal data from children. Since End Users are not required to provide any personal information, the risk of inadvertent collection of children's data is minimal.

---

## 13. Changes to This Policy

We may update this Privacy & Confidentiality Policy from time to time. When we make significant changes, we will notify Admin Users via email or through the admin dashboard. The "Last updated" date at the top of this document indicates the most recent revision.

---

## 14. Contact Us

If you have any questions about this Privacy & Confidentiality Policy, or if you wish to exercise your data protection rights, please contact us at:

**Email:** contact@eazmenu.com
**Address:** [Insert business address]

---

*This policy is also available in [French](PRIVACY_POLICY_FR.md).*
