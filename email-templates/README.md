# Eazmenu Email Templates

These email templates are designed to be used with Supabase Auth email templates. Copy the HTML content directly into your Supabase dashboard.

## Available Templates

### Authentication Templates

| Template | File | Supabase Template Type | Description |
|----------|------|------------------------|-------------|
| Confirm Sign Up | `confirm-signup.html` | Confirm signup | Verify email after registration |
| Invite User | `invite-user.html` | Invite user | Invite new users to the platform |
| Magic Link | `magic-link.html` | Magic link | Passwordless sign-in |
| Change Email | `change-email.html` | Change email address | Verify new email after change |
| Reset Password | `reset-password.html` | Reset password | Password recovery |
| Reauthentication | `reauthentication.html` | Reauthentication | Verify identity for sensitive actions |

### Security Notification Templates

| Template | File | Description |
|----------|------|-------------|
| Password Changed | `password-changed.html` | Notify when password changes |
| Email Changed | `email-changed.html` | Notify when email changes |
| Phone Changed | `phone-changed.html` | Notify when phone changes |
| Identity Linked | `identity-linked.html` | OAuth provider connected |
| Identity Unlinked | `identity-unlinked.html` | OAuth provider disconnected |
| MFA Added | `mfa-added.html` | 2FA method enabled |
| MFA Removed | `mfa-removed.html` | 2FA method disabled |

## Supabase Template Variables

These templates use Supabase's built-in template variables:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | The confirmation/action URL |
| `{{ .Token }}` | The OTP/verification code |
| `{{ .TokenHash }}` | Hashed version of the token |
| `{{ .Email }}` | User's email address |
| `{{ .SentAt }}` | Timestamp when email was sent |
| `{{ .RedirectTo }}` | The redirect URL after action |

## How to Use

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select the template type you want to customize
4. Copy the HTML content from the corresponding file
5. Paste it into the template editor
6. Save your changes

## Customization

To customize the templates:

1. **Logo**: Replace the Eazmenu text in the header or add an `<img>` tag
2. **Colors**: Modify the gradient colors in `.email-header` (currently using indigo/purple)
3. **Support Email**: Update `contact@eazmenu.com` to your support email
4. **App Name**: Replace "Eazmenu" with your application name
5. **Year**: Update the copyright year in the footer

## Design Features

- ✅ Responsive design (mobile-friendly)
- ✅ Consistent branding with gradient header
- ✅ Clear call-to-action buttons
- ✅ Security warnings for sensitive actions
- ✅ Fallback text links for accessibility
- ✅ Professional footer with support contact

## Email Clients Tested

These templates are designed to work with major email clients:

- Gmail (Web & Mobile)
- Outlook (Web & Desktop)
- Apple Mail
- Yahoo Mail
- Mobile email apps
