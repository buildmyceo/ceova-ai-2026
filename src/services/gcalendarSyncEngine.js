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

  let accessToken = await getGoogleAccessToken(userId);
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
    // Look back 30 days and look forward 60 days
    const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const futureDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    url.searchParams.set('timeMin', pastDate.toISOString());
    url.searchParams.set('timeMax', futureDate.toISOString());
    url.searchParams.set('maxResults', '100');
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    let resp = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    // Auto-refresh token on 401 and retry once
    if (resp.status === 401) {
      try {
        const { data: refData } = await supabase.functions.invoke('refresh-google-token');
        if (refData?.access_token) {
          accessToken = refData.access_token;
          localStorage.setItem('google_provider_token', accessToken);
          resp = await fetch(url.toString(), {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        }
      } catch (e) {
        console.warn('[GCalendarSyncEngine] Token refresh failed:', e);
      }
    }

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
        status: 'confirmed',
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

/**
 * Create a new event directly in Google Calendar
 */
export async function createGoogleCalendarEvent(userId, eventData) {
  if (!userId) return { success: false, error: 'User session required' };

  let accessToken = await getGoogleAccessToken(userId);
  if (!accessToken) {
    return { success: false, error: 'Google Calendar is not connected. Please connect Google Services.' };
  }

  try {
    const {
      title,
      description = '',
      location = '',
      startDate,
      startTime,
      endDate,
      endTime,
      isAllDay = false,
      attendees = []
    } = eventData;

    if (!title || !title.trim()) {
      return { success: false, error: 'Event title is required.' };
    }
    if (!startDate) {
      return { success: false, error: 'Event start date is required.' };
    }

    let startObj, endObj;
    if (isAllDay) {
      startObj = { date: startDate };
      endObj = { date: endDate || startDate };
    } else {
      const sTime = startTime || '09:00';
      const eTime = endTime || '10:00';
      const startIso = new Date(`${startDate}T${sTime}:00`).toISOString();
      const endIso = new Date(`${endDate || startDate}T${eTime}:00`).toISOString();
      startObj = { dateTime: startIso };
      endObj = { dateTime: endIso };
    }

    const payload = {
      summary: title.trim(),
      description: description.trim(),
      location: location.trim(),
      start: startObj,
      end: endObj
    };

    if (Array.isArray(attendees) && attendees.length > 0) {
      payload.attendees = attendees
        .map(email => ({ email: email.trim() }))
        .filter(a => a.email && a.email.includes('@'));
    }

    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.status === 401) {
      try {
        const { data: refData } = await supabase.functions.invoke('refresh-google-token');
        if (refData?.access_token) {
          accessToken = refData.access_token;
          localStorage.setItem('google_provider_token', accessToken);
          res = await fetch(url, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }
      } catch (e) {}
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Google Calendar error: ${errText}`);
    }

    const createdEvt = await res.json();
    const startTimeIso = createdEvt.start?.dateTime || createdEvt.start?.date;
    const endTimeIso = createdEvt.end?.dateTime || createdEvt.end?.date;
    const now = new Date();
    const evtStart = new Date(startTimeIso || startDate);

    const formattedItem = {
      id: `gcal-${createdEvt.id}`,
      gcal_id: createdEvt.id,
      kind: 'file',
      category: 'calendar',
      name: createdEvt.summary || title,
      description: createdEvt.description || description,
      location: createdEvt.location || location,
      start_time: startTimeIso,
      end_time: endTimeIso,
      created_at: evtStart.toISOString(),
      source: 'gcalendar',
      web_view_link: createdEvt.htmlLink,
      meet_link: createdEvt.hangoutLink || null,
      attendees: (createdEvt.attendees || []).map(a => a.email),
      is_upcoming: evtStart >= now,
      is_today: evtStart.toDateString() === now.toDateString(),
      is_meeting: (createdEvt.attendees || []).length > 0 || !!createdEvt.hangoutLink,
      mime_type: 'text/calendar'
    };

    // Save to database
    try {
      await supabase.from('calendar_events').upsert([{
        user_id: userId,
        gcal_id: createdEvt.id,
        name: formattedItem.name,
        description: formattedItem.description,
        location: formattedItem.location,
        start_time: formattedItem.start_time,
        end_time: formattedItem.end_time,
        attendees: formattedItem.attendees,
        html_link: formattedItem.web_view_link,
        status: 'confirmed',
        created_at: formattedItem.created_at
      }], { onConflict: 'gcal_id' });
    } catch (dbErr) {
      console.warn('[GCalendarSyncEngine] DB save error:', dbErr);
    }

    return { success: true, event: formattedItem };
  } catch (err) {
    console.error('[GCalendarSyncEngine] Create event error:', err);
    return { success: false, error: err.message };
  }
}
