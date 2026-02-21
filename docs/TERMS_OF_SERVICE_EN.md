# EazMenu — Terms of Service

**Last updated:** February 21, 2026

---

## 1. Acceptance of Terms

By accessing or using the EazMenu platform ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not use the Service.

These Terms apply to:

- **End Users (Clients):** individuals who scan a QR code to browse a restaurant's digital menu and optionally place orders.
- **Admin Users (Merchants):** restaurant owners, managers, and authorized personnel who register on EazMenu to manage their establishments, menus, and orders.
- **Website Visitors:** individuals who visit the EazMenu website.

---

## 2. Description of the Service

EazMenu is a digital menu and ordering platform that provides:

- **For Merchants:** A web-based dashboard to create and manage restaurant profiles, digital menus (including categories, items, pricing, images, allergens, nutritional information, and ingredients), multi-language translations, QR code generation for tables, real-time order management, menu performance analytics, theme and branding customization, and optional online payment acceptance via Stripe.
- **For End Users:** A web-based interface accessible by scanning a QR code, allowing them to browse a restaurant's menu, view item details (including allergens and nutritional information), and place orders — all without creating an account or providing personal information.

---

## 3. Eligibility

### 3.1 Admin Users

To create a Merchant account, you must:

- Be at least 18 years of age or the age of majority in your jurisdiction.
- Have the legal authority to bind the business entity you represent.
- Provide accurate and complete registration information.

### 3.2 End Users

The menu browsing and ordering features are available to the general public. No account creation or minimum age is required to use the End User features. However, the placing of orders implies acceptance of these Terms.

---

## 4. Account Registration & Security (Admin Users)

### 4.1 Account Creation

Merchants may register using an email address and password, or via a supported OAuth provider (Google, Apple, Microsoft). Authentication is managed by our third-party provider Supabase.

### 4.2 Account Responsibilities

You are responsible for:

- Maintaining the confidentiality of your account credentials.
- All activity that occurs under your account.
- Notifying us immediately of any unauthorized use of your account.

We reserve the right to suspend or terminate accounts that we reasonably believe have been compromised or are being used in violation of these Terms.

### 4.3 Account Accuracy

You agree to provide and maintain accurate, current, and complete information for your account and restaurant profiles. Inaccurate or misleading business information (e.g., false restaurant names, incorrect allergen declarations) may result in account suspension.

---

## 5. Use of the Service

### 5.1 Permitted Use

You may use the Service only for its intended purpose:

- **Merchants:** To manage legitimate food-service or hospitality establishments and their digital menus.
- **End Users:** To browse menus and place orders at participating restaurants.

### 5.2 Prohibited Conduct

You agree **not** to:

- Use the Service for any unlawful purpose or in violation of any applicable law or regulation.
- Upload, publish, or transmit content that is illegal, defamatory, obscene, hateful, threatening, or that infringes on the intellectual property rights of any third party.
- Impersonate any person or entity, or misrepresent your affiliation with any person or entity.
- Attempt to gain unauthorized access to other accounts, the Service's servers, or any connected systems.
- Interfere with or disrupt the integrity, performance, or availability of the Service.
- Use automated scripts, bots, scrapers, or similar tools to access, collect, or interact with the Service beyond its intended use.
- Circumvent or attempt to circumvent rate limits, security measures, or access restrictions.
- Upload files that contain viruses, malware, or any harmful code.
- Use the Service to send unsolicited messages, spam, or promotional material.
- Exploit the QR code system for purposes other than directing customers to your restaurant's menu.
- Create multiple merchant accounts to circumvent restrictions or abuse the Service.

### 5.3 Rate Limits & Fair Use

The Service enforces rate limits to ensure fair usage and system stability. Repeated or systematic violation of rate limits may result in temporary or permanent restriction of access. Specific limits include, without limitation:

- API request limits per time window.
- Order creation frequency limits.
- File upload size limits (5 MB per image).
- Batch operation limits (e.g., analytics events, QR code generation).

We reserve the right to modify rate limits at any time without prior notice.

---

## 6. Merchant Content

### 6.1 Ownership

Merchants retain all ownership rights to the content they upload or create on the Service, including but not limited to restaurant information, menu items, descriptions, images, branding assets, and translations ("Merchant Content").

### 6.2 License Grant

By uploading Merchant Content, you grant EazMenu a non-exclusive, worldwide, royalty-free license to host, store, display, reproduce, and distribute your Merchant Content solely for the purpose of operating and providing the Service. This includes displaying your menu to End Users, generating QR codes, and enabling order processing. This license terminates when you remove your content or delete your account.

### 6.3 Content Responsibilities

Merchants are solely responsible for:

- The accuracy and legality of all Merchant Content, including menu item descriptions, prices, allergen declarations, nutritional information, and ingredient lists.
- Ensuring that all uploaded images are owned by them or used with proper authorization.
- Compliance with all applicable food safety, labeling, and consumer protection laws in their jurisdiction.
- Keeping their menus up to date to reflect actual availability, pricing, and ingredient changes.

**EazMenu does not verify, endorse, or guarantee the accuracy of Merchant Content.** Allergen information, nutritional data, and other health-related declarations are provided by the Merchant and are their sole responsibility.

### 6.4 Content Restrictions

Merchant Content must not:

- Contain false or misleading information about food items, ingredients, or allergens.
- Infringe on the intellectual property rights of any third party (including trademarks, copyrights, or trade secrets).
- Include content that is illegal, harmful, threatening, abusive, defamatory, or otherwise objectionable.
- Contain personal data of third parties without their consent.

We reserve the right to remove any content that violates these Terms and to suspend or terminate the associated account.

---

## 7. Orders & Transactions

### 7.1 Order Placement (End Users)

When you place an order through EazMenu:

- Your order is transmitted to the restaurant in real time.
- Prices displayed are set by the Merchant and validated server-side at the time of order.
- An order, once submitted, is sent to the restaurant and may not be cancellable depending on the restaurant's workflow.
- EazMenu facilitates the order but is **not a party** to the transaction between you and the restaurant.

### 7.2 Pricing

All prices displayed on menus are set exclusively by the Merchant. EazMenu does not control, verify, or guarantee pricing accuracy. In the event of a pricing error, the Merchant is responsible for resolution with the End User.

### 7.3 Payment Processing

Where a restaurant has enabled online payment:

- Payments are processed entirely by **Stripe**, a PCI DSS-compliant third-party payment provider.
- EazMenu **never** receives, processes, or stores credit card numbers or payment card details.
- By making a payment, you agree to Stripe's [Terms of Service](https://stripe.com/legal) and [Privacy Policy](https://stripe.com/privacy).
- EazMenu is not responsible for payment processing errors, declined transactions, or refunds. Payment disputes should be directed to the restaurant and/or Stripe.

### 7.4 Relationship Between Parties

EazMenu acts as a technology platform connecting Merchants and End Users. **EazMenu is not a restaurant, food provider, or payment processor.** The contract for the sale of food and beverages is between the Merchant and the End User. EazMenu bears no responsibility for:

- The quality, safety, or legality of food or beverages served.
- The fulfillment, accuracy, or timeliness of orders.
- Any disputes between Merchants and End Users.

---

## 8. QR Codes

### 8.1 QR Code Generation

EazMenu generates unique QR codes for each table configured by the Merchant. QR codes are linked to a specific restaurant and table.

### 8.2 QR Code Usage

- QR codes are intended solely for directing customers to the associated restaurant's digital menu.
- Merchants are responsible for the physical placement, printing, and maintenance of QR codes at their establishment.
- EazMenu is not responsible for QR codes that are damaged, tampered with, or misused by third parties.
- Merchants must not use QR codes to redirect users to third-party content or services unrelated to their restaurant's menu.

---

## 9. Translations

### 9.1 Multi-Language Support

The Service offers manual and automated translation capabilities for menu content.

### 9.2 Automated Translations

Automated translations are provided using third-party translation services (currently DeepL). While we strive for accuracy:

- **Automated translations are provided "as is"** and may contain errors, inaccuracies, or awkward phrasing.
- Merchants are responsible for reviewing and correcting automated translations before publishing them.
- EazMenu is not liable for errors in automated translations, including mistranslation of allergen or nutritional information.

---

## 10. Analytics

### 10.1 Menu Analytics

EazMenu provides aggregated analytics to Merchants regarding menu item performance (views, clicks, add-to-cart events). These analytics are based on anonymous session data and cannot be used to identify individual End Users.

### 10.2 Data Ownership

Analytics data derived from End User interactions with a Merchant's menu is made available to that Merchant for the purpose of improving their menu and service. This data is aggregated and anonymized.

---

## 11. Intellectual Property

### 11.1 EazMenu IP

The Service, including its software, design, branding, logos, documentation, and all underlying technology, is the proprietary property of EazMenu and is protected by applicable intellectual property laws. These Terms do not grant you any right, title, or interest in the Service beyond the limited right to use it as described herein.

### 11.2 Feedback

If you provide suggestions, ideas, or feedback about the Service, you grant EazMenu an unrestricted, irrevocable, royalty-free license to use, modify, and implement such feedback without obligation to you.

---

## 12. Privacy

Your use of the Service is also governed by our Privacy & Confidentiality Policy, available at:

- [Privacy Policy (English)](PRIVACY_POLICY_EN.md)
- [Politique de Confidentialité (French)](PRIVACY_POLICY_FR.md)

By using the Service, you acknowledge that you have read and understood our Privacy Policy.

---

## 13. Third-Party Services

The Service integrates with third-party providers to deliver its functionality. Your use of these third-party services is subject to their respective terms and policies:

| Service | Purpose | Terms |
|---|---|---|
| **Supabase** | Authentication, database, file storage | [supabase.com/terms](https://supabase.com/terms) |
| **Stripe** | Payment processing | [stripe.com/legal](https://stripe.com/legal) |
| **DeepL** | Automated translations | [deepl.com/pro-license](https://www.deepl.com/pro-license) |
| **Google reCAPTCHA** | Bot protection | [google.com/intl/en/policies/terms](https://policies.google.com/terms) |

EazMenu is not responsible for the availability, accuracy, or conduct of third-party services.

---

## 14. Disclaimers

### 14.1 "As Is" Provision

THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR AVAILABILITY.

### 14.2 No Guarantee of Availability

We do not guarantee that the Service will be uninterrupted, error-free, secure, or available at all times. We may perform maintenance, updates, or modifications that temporarily affect availability.

### 14.3 Food Safety Disclaimer

EazMenu is a technology platform and does **not** prepare, handle, inspect, or deliver food. We make no representations or warranties regarding:

- The safety, quality, or legality of food or beverages offered by Merchants.
- The accuracy of allergen declarations, nutritional information, or ingredient lists provided by Merchants.
- Compliance by Merchants with food safety and hygiene regulations.

**End Users with food allergies or dietary restrictions should always confirm allergen and ingredient information directly with the restaurant staff before consuming any food or beverage.**

---

## 15. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW:

- EazMenu, its directors, employees, partners, and affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, business opportunities, or goodwill, arising out of or in connection with your use of the Service.
- EazMenu's total aggregate liability for any claims arising from or relating to these Terms or the Service shall not exceed the amount you have paid to EazMenu (if any) in the twelve (12) months preceding the claim.
- EazMenu is not liable for any loss, injury, or damage resulting from food or beverages ordered through the Service, payment processing issues, or actions or omissions of Merchants or third-party service providers.

---

## 16. Indemnification

You agree to indemnify, defend, and hold harmless EazMenu and its officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorney's fees) arising out of or related to:

- Your use of the Service.
- Your violation of these Terms.
- Your violation of any applicable law or regulation.
- Merchant Content you upload, publish, or make available through the Service.
- Any dispute between a Merchant and an End User.
- Any claim by a third party related to your content or use of the Service.

---

## 17. Suspension & Termination

### 17.1 By EazMenu

We may suspend or terminate your access to the Service at any time, with or without notice, if:

- You violate these Terms or any applicable law.
- Your use of the Service poses a security risk or may harm other users.
- We are required to do so by law or regulatory authority.
- Your account has been inactive for an extended period.

### 17.2 By the User

- **Merchants** may request account deletion by contacting us at contact@eazmenu.com or through the admin dashboard. Upon deletion, your restaurant data, menu content, and uploaded files will be permanently removed, subject to any legal retention requirements.
- **End Users** may stop using the Service at any time. Since no account is created, no deletion process is required.

### 17.3 Effect of Termination

Upon termination:

- Your right to access and use the Service ceases immediately.
- Sections of these Terms that by their nature should survive (including Sections 6.2, 11, 14, 15, 16, and 20) will continue to apply.
- We may retain certain data as required by law or for legitimate business purposes as described in our Privacy Policy.

---

## 18. Modifications to the Service

We reserve the right to:

- Modify, update, or discontinue any feature of the Service at any time.
- Introduce new features, change existing functionality, or remove capabilities.
- Impose new limits or restrictions on the use of the Service.

We will make reasonable efforts to notify Merchants of significant changes that materially affect their use of the Service.

---

## 19. Changes to These Terms

We may update these Terms from time to time. When we make material changes:

- We will update the "Last updated" date at the top of this document.
- We will notify Admin Users via email or through the admin dashboard.
- Continued use of the Service after the effective date of changes constitutes acceptance of the revised Terms.

If you do not agree with the updated Terms, you must stop using the Service and, for Merchants, request account deletion.

---

## 20. Governing Law & Dispute Resolution

### 20.1 Governing Law

These Terms are governed by and construed in accordance with the laws of [Insert jurisdiction], without regard to its conflict of law provisions.

### 20.2 Dispute Resolution

Any dispute arising out of or relating to these Terms or the Service shall first be attempted to be resolved through good-faith negotiation. If a resolution cannot be reached within thirty (30) days, the dispute shall be submitted to the competent courts of [Insert jurisdiction].

---

## 21. Severability

If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.

---

## 22. Entire Agreement

These Terms, together with the Privacy Policy, constitute the entire agreement between you and EazMenu regarding your use of the Service and supersede all prior agreements, understandings, or representations.

---

## 23. Contact Us

If you have any questions about these Terms of Service, please contact us at:

**Email:** contact@eazmenu.com
