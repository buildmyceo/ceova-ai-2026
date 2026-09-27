import { Tool, ToolContext, ToolResult } from "../types.ts";
import { googleAuthService } from "../../services/google-auth.ts";
import { Logger } from "../../services/logger.ts";
import { embedInvisibleTextWatermark, generateCeovaSignature } from "../../utils/ceova-watermark.ts";

export const GoogleCalendarConnectorTool: Tool = {
  metadata: {
    id: "calendar_connector",
    name: "Google Calendar Connector",
    description: `Reads, searches, creates, updates, and deletes Google Calendar events.
CALENDAR_CONNECTOR RULES:
- Keep all conversational responses extremely short, simple, and direct. Do not be overly polite or wordy.
- If creating an event and the title is missing, ask the user for it BEFORE calling the tool.
- If date or time is missing, ask for the missing info.
- If no duration is provided, default to 1 hour and inform the user.
- If an event conflicts with another event, this tool will return a warning. In that case, ask the user if they still want to proceed.
- Do NOT make up event IDs.`,
    category: "Productivity",
    icon: "Calendar",
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The Calendar action to perform",
          enum: ["list_events", "search_events", "create_event", "update_event", "delete_event"]
        },
        title: {
          type: "string",
          description: "Event title (for create/update)"
        },
        start_time: {
          type: "string",
          description: "Start time in ISO 8601 format WITH timezone (e.g., 2023-10-01T15:00:00+05:30 or Z). CRITICAL: MUST INCLUDE TIMEZONE OFFSET."
        },
        end_time: {
          type: "string",
          description: "End time in ISO 8601 format WITH timezone (e.g., 2023-10-01T16:00:00+05:30 or Z). CRITICAL: MUST INCLUDE TIMEZONE OFFSET."
        },
        query: {
          type: "string",
          description: "Search query string (for search_events)"
        },
        event_id: {
          type: "string",
          description: "The ID of the event to update or delete"
        },
        time_min: {
          type: "string",
          description: "Start of time range for listing events (ISO 8601)"
        },
        time_max: {
          type: "string",
          description: "End of time range for listing events (ISO 8601)"
        },
        force_create: {
          type: "boolean",
          description: "If true, bypasses conflict detection for create_event"
        }
      },
      required: ["action"]
    }
  },
  execute: async (context: ToolContext): Promise<ToolResult> => {
    try {
      context.onStatusUpdate?.("Authenticating with Google Calendar...");
      const accessToken = await googleAuthService.getValidAccessToken(context.userId);

      if (!accessToken) {
        return {
          success: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "You need to connect your Google account in Settings > Connectors."
          }
        };
      }

      const args = context.args || {};
      const action = args.action || "create_event";

      let title = args.title;
      let startTime = args.start_time;
      let endTime = args.end_time;

      // If action is create_event and title or startTime are missing, attempt recovery from history
      if (action === "create_event" && (!title || !startTime)) {
        const fullConversation = [...(context.history || []), { content: context.message || "" }];
        const convText = fullConversation.map(m => typeof m?.content === 'string' ? m.content : '').join("\n");

        if (!title) {
          const titleMatch = convText.match(/(?:meeting\s+with|appointment\s+with|with)\s+([A-Za-z0-9_\-\s]{2,30}?)(?:\s+(?:tomorrow|today|from|at|on)|\n|$)/i);
          if (titleMatch) {
            title = `Meeting with ${titleMatch[1].trim()}`;
          } else {
            title = "Meeting";
          }
        }

        if (!startTime) {
          const timeMatch = convText.match(/(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:to|-)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i) ||
                            convText.match(/\b(?:at|from)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
          const isTomorrow = /\btomorrow\b/i.test(convText);
          const targetDate = new Date();
          if (isTomorrow) targetDate.setDate(targetDate.getDate() + 1);

          if (timeMatch) {
            const parseTimeStr = (tStr: string, baseDate: Date) => {
              const d = new Date(baseDate);
              const m = tStr.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
              if (!m) return null;
              let h = parseInt(m[1], 10);
              const min = m[2] ? parseInt(m[2], 10) : 0;
              const meridiem = m[3].toLowerCase();
              if (meridiem === 'pm' && h < 12) h += 12;
              if (meridiem === 'am' && h === 12) h = 0;
              d.setHours(h, min, 0, 0);
              return d.toISOString();
            };

            const sParsed = parseTimeStr(timeMatch[1], targetDate);
            if (sParsed) startTime = sParsed;
            if (timeMatch[2]) {
              const eParsed = parseTimeStr(timeMatch[2], targetDate);
              if (eParsed) endTime = eParsed;
            }
          }
        }
      }

      context.onStatusUpdate?.(`Executing ${action}...`);

      switch (action) {
        case "list_events":
          return await listEvents(accessToken, args.time_min, args.time_max);
        case "search_events":
          return await searchEvents(accessToken, args.query || "");
        case "create_event":
          return await createEvent(accessToken, title, startTime, endTime, args.force_create);
        case "update_event":
          return await updateEvent(accessToken, args.event_id, title, startTime, endTime);
        case "delete_event":
          return await deleteEvent(accessToken, args.event_id);
        default:
          return { success: false, error: { code: "INVALID_ACTION", message: `Unknown action: ${action}` } };
      }

    } catch (e: any) {
      Logger.ERROR(`Calendar connector error: ${e.message}`);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  }
};

async function listEvents(token: string, timeMin?: string, timeMax?: string): Promise<ToolResult> {
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.append("singleEvents", "true");
  url.searchParams.append("orderBy", "startTime");
  url.searchParams.append("maxResults", "20");
  try {
    let minDate = new Date();
    if (timeMin) {
      const parsed = new Date(timeMin);
      if (!isNaN(parsed.getTime())) {
         minDate = parsed;
      }
    }
    url.searchParams.append("timeMin", minDate.toISOString());

    if (timeMax) {
      let maxDate = new Date(timeMax);
      if (isNaN(maxDate.getTime())) {
         // Fallback: 24 hours from minDate
         maxDate = new Date(minDate.getTime() + 24 * 60 * 60 * 1000);
      }
      if (maxDate <= minDate) {
         maxDate = new Date(minDate.getTime() + 24 * 60 * 60 * 1000);
      }
      url.searchParams.append("timeMax", maxDate.toISOString());
    }
  } catch (e: any) {
    return { success: false, error: { code: "INVALID_TIME_FORMAT", message: e.message } };
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    return { success: false, error: { code: "API_ERROR", message: JSON.stringify(errorData) } };
  }

  const data = await res.json();
  const events = data.items?.map((item: any) => ({
    id: item.id,
    summary: item.summary,
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date,
    htmlLink: item.htmlLink
  })) || [];

  if (events.length === 0) {
    return { success: true, data: { text: "You have no events in this timeframe." } };
  }
  
  const text = `📅 **Found ${events.length} events:**\n\n` + events.map((e: any) => `- **${e.summary || 'Busy'}**\n  Time: ${new Date(e.start).toLocaleString()} to ${new Date(e.end).toLocaleString()}`).join('\n\n');

  return { success: true, data: { text } };
}

async function searchEvents(token: string, query: string): Promise<ToolResult> {
  if (!query) return { success: false, error: { code: "MISSING_QUERY", message: "Search query is required." } };

  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.append("q", query);
  url.searchParams.append("singleEvents", "true");
  url.searchParams.append("orderBy", "startTime");
  url.searchParams.append("maxResults", "20");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to search events." } };

  const data = await res.json();
  const events = data.items?.map((item: any) => ({
    id: item.id,
    summary: item.summary,
    start: item.start?.dateTime || item.start?.date,
    end: item.end?.dateTime || item.end?.date
  })) || [];

  if (events.length === 0) {
    return { success: true, data: { text: `No events found matching "${query}".` } };
  }
  
  const text = `🔍 **Search Results:**\n\n` + events.map((e: any) => `- **${e.summary || 'Busy'}**\n  Time: ${new Date(e.start).toLocaleString()} to ${new Date(e.end).toLocaleString()}`).join('\n\n');

  return { success: true, data: { text } };
}

async function createEvent(token: string, title: string, startTime: string, endTime: string, forceCreate: boolean): Promise<ToolResult> {
  if (!title || !startTime) {
    return { success: false, error: { code: "MISSING_PARAMS", message: "Title and start_time are required." } };
  }

  // Calculate default 1-hour duration if end_time is missing
  let finalEndTime = endTime;
  let assumedDuration = false;
  if (!finalEndTime) {
    const start = new Date(startTime);
    if (!isNaN(start.getTime())) {
      start.setHours(start.getHours() + 1);
      finalEndTime = start.toISOString();
      assumedDuration = true;
    } else {
      return { success: false, error: { code: "INVALID_TIME", message: "start_time must be a valid ISO format string." } };
    }
  }

  // Ensure timezones
  const formatTime = (t: string) => (t.includes('Z') || t.match(/[+-]\d\d:\d\d$/)) ? t : `${t}Z`;
  const formattedStartTime = formatTime(startTime);
  const formattedEndTime = formatTime(finalEndTime);

  // Conflict detection
  if (!forceCreate) {
    const conflictRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(startTime)}&timeMax=${encodeURIComponent(finalEndTime)}&singleEvents=true`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (conflictRes.ok) {
      const conflictData = await conflictRes.json();
      // Filter out 'transparent' events (like Out of Office or free time)
      const conflicts = (conflictData.items || []).filter((e: any) => e.transparency !== "transparent");
      
      if (conflicts.length > 0) {
        return { 
          success: false, 
          error: { 
            code: "CONFLICT_DETECTED", 
            message: `Event conflicts with: ${conflicts.map((c: any) => c.summary).join(', ')}. Pass force_create=true to override and schedule anyway.` 
          } 
        };
      }
    }
  }

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      summary: title,
      description: embedInvisibleTextWatermark("", {
        target: "calendar",
        metadata: { title, start: formattedStartTime }
      }),
      extendedProperties: {
        private: {
          ceovaOrigin: "true",
          ceovaSignature: generateCeovaSignature({ title, start: formattedStartTime, origin: "Ceova-AI-Suite" }),
          ceovaCreatedAt: new Date().toISOString()
        }
      },
      start: { dateTime: formattedStartTime },
      end: { dateTime: formattedEndTime }
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    if (res.status === 401) {
      return { success: false, error: { code: "AUTH_EXPIRED", message: "Your Google session has expired. Please re-authenticate Google Calendar in Settings > Connectors." } };
    }
    if (res.status === 403) {
      return { success: false, error: { code: "SCOPE_INSUFFICIENT", message: "Missing Google Calendar permissions. Please click 'Connect / Sync Google Calendar' in your Library or Settings to grant calendar permissions." } };
    }
    return { success: false, error: { code: "API_ERROR", message: JSON.stringify(errorData) } };
  }

  const data = await res.json();
  let msg = "Event created successfully.";
  if (assumedDuration) msg += " (Note: End time was missing, defaulted to 1 hour duration).";

  return { success: true, data: { text: `✅ ${msg}\n**Event:** ${data.summary || 'Busy'}\n[View on Google Calendar](${data.htmlLink})` } };
}

async function updateEvent(token: string, eventId: string, title?: string, startTime?: string, endTime?: string): Promise<ToolResult> {
  if (!eventId) return { success: false, error: { code: "MISSING_ID", message: "event_id is required." } };

  const getRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!getRes.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to fetch event for update." } };
  
  const existingEvent = await getRes.json();
  
  const formatTime = (t: string) => (t.includes('Z') || t.match(/[+-]\d\d:\d\d$/)) ? t : `${t}Z`;

  const updatedEvent = {
    ...existingEvent,
    summary: title || existingEvent.summary,
    start: startTime ? { dateTime: formatTime(startTime) } : existingEvent.start,
    end: endTime ? { dateTime: formatTime(endTime) } : existingEvent.end
  };

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "PUT",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updatedEvent)
  });

  if (!res.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to update event." } };
  return { success: true, data: { text: "✅ Event updated successfully." } };
}

async function deleteEvent(token: string, eventId: string): Promise<ToolResult> {
  if (!eventId) return { success: false, error: { code: "MISSING_ID", message: "event_id is required." } };

  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204) return { success: false, error: { code: "API_ERROR", message: "Failed to delete event." } };
  return { success: true, data: { text: "🗑️ Event deleted successfully." } };
}
