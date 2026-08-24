import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not authenticated' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');
  const admin = createClient(supabaseUrl, serviceKey);
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: 'Not authenticated' }, 401);

  try {
    const { action = 'invite', calendarId, email, token } = await request.json();
    if (action === 'accept') {
      if (!token) return json({ error: 'Invitation token is missing.' }, 400);
      const { data: invite } = await admin.from('shared_calendar_invites').select('id, calendar_id, invitee_email, status').eq('token', token).eq('status', 'pending').single();
      if (!invite || invite.invitee_email.toLowerCase() !== user.email?.toLowerCase()) return json({ error: 'This invitation is invalid or belongs to another email address.' }, 403);
      const { error: memberError } = await admin.from('shared_calendar_members').upsert({ calendar_id: invite.calendar_id, user_id: user.id, role: 'member' });
      if (memberError) throw memberError;
      await admin.from('shared_calendar_invites').update({ status: 'accepted', accepted_at: new Date().toISOString() }).eq('id', invite.id);
      return json({ ok: true, calendarId: invite.calendar_id });
    }
    const inviteeEmail = String(email || '').trim().toLowerCase();
    if (!calendarId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) return json({ error: 'Enter a valid email address.' }, 400);
    if (inviteeEmail === user.email?.toLowerCase()) return json({ error: 'You are already in this calendar.' }, 400);

    const { data: calendar } = await admin.from('shared_calendars').select('id, name').eq('id', calendarId).eq('owner_id', user.id).single();
    if (!calendar) return json({ error: 'Only the calendar owner can invite people.' }, 403);

    const { data: invite, error: inviteError } = await admin.from('shared_calendar_invites').insert({ calendar_id: calendarId, inviter_id: user.id, invitee_email: inviteeEmail }).select('token').single();
    if (inviteError) throw inviteError;

    const appUrl = Deno.env.get('APP_URL');
    if (!appUrl) return json({ error: 'Email delivery is not configured. Add APP_URL, RESEND_API_KEY and RESEND_FROM_EMAIL.' }, 500);
    const inviteUrl = `${appUrl}?calendar_invite=${invite.token}`;
    if (!resendKey || !fromEmail) return json({ error: 'Email delivery is not configured. Add RESEND_API_KEY, RESEND_FROM_EMAIL and APP_URL.' }, 500);
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromEmail, to: [inviteeEmail], subject: `${user.user_metadata?.username || user.email} invited you to a FocusUp calendar`, html: `<p>You have been invited to join <strong>${escapeHtml(calendar.name)}</strong> in FocusUp.</p><p><a href="${inviteUrl}">Accept the invitation</a></p>` }),
    });
    if (!emailResponse.ok) throw new Error('Email provider rejected the invitation.');
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not send invitation.' }, 500);
  }
});
