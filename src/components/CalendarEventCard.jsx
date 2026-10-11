import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, ExternalLink, Check, Copy, MapPin, Users } from 'lucide-react';

function formatEventDate(startStr, endStr) {
  if (!startStr) {
    return {
      month: 'CAL',
      day: '--',
      fullDate: 'Scheduled Event',
      timeRange: 'Confirmed Time'
    };
  }

  const s = new Date(startStr);
  const isValidStart = !isNaN(s.getTime());

  if (!isValidStart) {
    return {
      month: 'CAL',
      day: '--',
      fullDate: startStr,
      timeRange: endStr ? `${startStr} – ${endStr}` : startStr
    };
  }

  const month = s.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = s.getDate();
  const weekday = s.toLocaleString('en-US', { weekday: 'short' });
  const year = s.getFullYear();

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const diffDays = Math.round((eventDay - today) / (1000 * 60 * 60 * 24));

  let relative = '';
  if (diffDays === 0) relative = 'Today, ';
  else if (diffDays === 1) relative = 'Tomorrow, ';
  else if (diffDays === -1) relative = 'Yesterday, ';

  const fullDate = `${relative}${weekday}, ${s.toLocaleString('en-US', { month: 'short' })} ${day}, ${year}`;
  const startTime = s.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  let timeRange = startTime;
  if (endStr) {
    const e = new Date(endStr);
    if (!isNaN(e.getTime())) {
      const endTime = e.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      timeRange = `${startTime} – ${endTime}`;
    }
  }

  return { month, day, fullDate, timeRange };
}

export default function CalendarEventCard({ event = {}, note = '' }) {
  const [copied, setCopied] = useState(false);

  const title = event.summary || event.title || 'Meeting';
  const start = event.start || event.start_time;
  const end = event.end || event.end_time;
  const htmlLink = event.htmlLink || event.html_link || 'https://calendar.google.com';
  const location = event.location || '';
  const attendees = event.attendees || [];

  const { month, day, fullDate, timeRange } = formatEventDate(start, end);

  const handleCopy = () => {
    const copyText = `${title}\n📅 ${fullDate}\n⏰ ${timeRange}${location ? `\n📍 ${location}` : ''}\n🔗 ${htmlLink}`;
    navigator.clipboard.writeText(copyText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: '12px 0',
        maxWidth: '460px',
        width: '100%',
        backgroundColor: '#0c0c0e',
        border: '1px solid #27272a',
        borderRadius: '14px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.2s ease, transform 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#3f3f46';
        e.currentTarget.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#27272a';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '11px 16px',
          backgroundColor: '#141417',
          borderBottom: '1px solid #27272a'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/google_calendar.png"
            alt="Google Calendar"
            style={{ width: '16px', height: '16px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f4f4f5', letterSpacing: '0.2px' }}>
            Google Calendar
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 9px',
            borderRadius: '9999px',
            backgroundColor: '#1f1f23',
            border: '1px solid #3f3f46',
            fontSize: '11px',
            fontWeight: 500,
            color: '#f4f4f5'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#ffffff' }} />
          <span>Event Created</span>
        </div>
      </div>

      {/* Main details body */}
      <div style={{ padding: '16px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Minimal Solid Date Tile */}
        <div
          style={{
            width: '52px',
            borderRadius: '10px',
            overflow: 'hidden',
            backgroundColor: '#18181b',
            border: '1px solid #27272a',
            textAlign: 'center',
            flexShrink: 0
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              color: '#000000',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 0',
              letterSpacing: '0.8px'
            }}
          >
            {month}
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: '19px',
              fontWeight: 700,
              padding: '6px 0',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {day}
          </div>
        </div>

        {/* Text info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 7px 0',
              fontSize: '15px',
              fontWeight: 600,
              color: '#ffffff',
              lineHeight: 1.3,
              wordBreak: 'break-word'
            }}
          >
            {title}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CalendarIcon size={14} color="#a1a1aa" style={{ flexShrink: 0 }} />
              <span style={{ color: '#ffffff', fontWeight: 500 }}>{fullDate}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={14} color="#a1a1aa" style={{ flexShrink: 0 }} />
              <span style={{ color: '#a1a1aa' }}>{timeRange}</span>
            </div>

            {location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={14} color="#a1a1aa" style={{ flexShrink: 0 }} />
                <span style={{ color: '#a1a1aa' }}>{location}</span>
              </div>
            )}

            {attendees.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={14} color="#a1a1aa" style={{ flexShrink: 0 }} />
                <span style={{ color: '#a1a1aa' }}>{attendees.join(', ')}</span>
              </div>
            )}
          </div>

          {note && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '11px',
                color: '#71717a'
              }}
            >
              {note}
            </div>
          )}
        </div>
      </div>

      {/* Solid Black & White Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          backgroundColor: '#141417',
          borderTop: '1px solid #27272a'
        }}
      >
        <a
          href={htmlLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            backgroundColor: '#ffffff',
            color: '#000000',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            border: '1px solid #ffffff',
            transition: 'background-color 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#e4e4e7';
            e.currentTarget.style.borderColor = '#e4e4e7';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.borderColor = '#ffffff';
          }}
        >
          <span>View on Google Calendar</span>
          <ExternalLink size={13} color="#000000" />
        </a>

        <button
          type="button"
          onClick={handleCopy}
          title="Copy Event Details"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '5px',
            padding: '8px 12px',
            borderRadius: '8px',
            backgroundColor: '#1f1f23',
            border: '1px solid #27272a',
            color: copied ? '#ffffff' : '#a1a1aa',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#27272a';
            e.currentTarget.style.color = '#ffffff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1f1f23';
            e.currentTarget.style.color = copied ? '#ffffff' : '#a1a1aa';
          }}
        >
          {copied ? <Check size={13} color="#ffffff" /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}
