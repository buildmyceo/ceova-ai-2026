import { supabase } from './supabase';
import { getGoogleAccessToken } from './gdriveSyncEngine';

/**
 * CEOVA Google Calendar Sync Engine
 * -------------------------------------------------------------
 * Principle: Zero Data Duplication
 * Google Calendar API is the live source of truth.
 * Fetches calendar events (Summary, Description, Location, Start/End Time, Attendees) dynamically.
 */

export async function fetchGoogleCalendarEvents(userId) {
  if (!userId) return { success: false, error: 'User session required' };

  const accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    return {
      success: false,
      needsAuth: true,
      error: 'Google Calendar is not connected. Click "Connect Google Services" to grant access.'
    };
  }

  try {
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    const now = new Date();
    // Look back 30 days and look forward 90 days
    const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    url.searchParams.set('timeMin', pastDate.toISOString());
    url.searchParams.set('maxResults', '50');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        return { needsAuth: true, error: 'Google Calendar permission required.' };
      }
      throw new Error(`Google Calendar API error HTTP ${resp.status}`);
    }

    const data = await resp.json();
    const rawEvents = data.items || [];

    const events = rawEvents.map(evt => {
      const startTime = evt.start?.dateTime || evt.start?.date || '';
      const endTime = evt.end?.dateTime || evt.end?.date || '';
      const summary = evt.summary || '(No Title Event)';
      const description = evt.description || '';
      const location = evt.location || '';
      const htmlLink = evt.htmlLink || `https://calendar.google.com/calendar/u/0/r/eventedit/${evt.id}`;
      const attendees = (evt.attendees || []).map(a => a.email);

      let startTimeIso = null;
      let evtStart = new Date();
      if (startTime) {
        try {
          const d = new Date(startTime);
          if (!isNaN(d.getTime())) {
            evtStart = d;
            startTimeIso = d.toISOString();
          }
        } catch (e) {}
      }

      let endTimeIso = null;
      if (endTime) {
        try {
          const d = new Date(endTime);
          if (!isNaN(d.getTime())) {
            endTimeIso = d.toISOString();
          }
        } catch (e) {}
      }

      const isUpcoming = evtStart >= now;
      const isToday = evtStart.toDateString() === now.toDateString();
      const isMeeting = attendees.length > 0 || !!evt.hangoutLink || !!evt.conferenceData;

      return {
        id: `gcal-${evt.id}`,
        gcal_id: evt.id,
        kind: 'file',
        category: 'calendar',
        name: summary,
        description: description,
        location: location,
        start_time: startTimeIso,
        end_time: endTimeIso,
        created_at: evtStart.toISOString(),
        source: 'gcalendar',
        web_view_link: htmlLink,
        meet_link: evt.hangoutLink || null,
        attendees: attendees,
        is_upcoming: isUpcoming,
        is_today: isToday,
        is_meeting: isMeeting,
        mime_type: 'text/calendar'
      };
    });

    if (events.length > 0) {
      // Persist to database
      const dbEvents = events.map(e => ({
        user_id: userId,
        gcal_id: e.gcal_id,
        name: e.name,
        description: e.description,
        location: e.location,
        start_time: e.start_time || null,
        end_time: e.end_time || null,
        attendees: e.attendees,
        html_link: e.web_view_link,
        status: e.status || 'confirmed',
        created_at: e.created_at
      }));

      const { error: dbErr } = await supabase
        .from('calendar_events')
        .upsert(dbEvents, { onConflict: 'gcal_id' });

      if (dbErr) {
        console.error('[GCalendarSyncEngine] Error saving to DB:', dbErr);
      }
    }

    return { success: true, events };
  } catch (err) {
    console.error('[GCalendarSyncEngine] Error fetching events:', err);
    return { success: false, error: err.message };
  }
}
