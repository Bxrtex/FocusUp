# Premium message email setup

The recipient email is intentionally stored only as an Edge Function secret, never in the browser bundle.

1. Create a [Resend](https://resend.com) API key and verify the sender domain.
2. Install and log in to the Supabase CLI, then run these commands from the project root:

   ```sh
   supabase secrets set PREMIUM_CONTACT_EMAIL="you@example.com"
   supabase secrets set RESEND_API_KEY="re_..."
   supabase secrets set RESEND_FROM_EMAIL="FocusUp <hello@your-domain.com>"
   supabase functions deploy send-premium-message
   ```

The function requires an authenticated user and checks `profiles.is_premium = true` on the server before sending. Once deployed, the Premium form sends messages directly through Resend; visitors cannot see the destination email in the page source or network request.

## Shared calendar invitations

Run `supabase/shared_calendars.sql` in the Supabase SQL Editor, then configure and deploy the invitation function:

```sh
supabase secrets set RESEND_API_KEY="re_..." RESEND_FROM_EMAIL="FocusUp <hello@your-domain.com>" APP_URL="https://your-domain.example/index.html"
supabase functions deploy invite-calendar
```

The invited person must already have a FocusUp account with the invited email address. After accepting the email link, both members can add, edit, complete, and delete events in the same calendar.

