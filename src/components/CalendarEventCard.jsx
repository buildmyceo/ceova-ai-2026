import React, { useState } from 'react';
import { Calendar as CalendarIcon, Clock, ExternalLink, Check, Copy, Sparkles, MapPin, Users } from 'lucide-react';

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

  // Check if today or tomorrow
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
        margin: '14px 0',
        maxWidth: '480px',
        width: '100%',
        background: 'linear-gradient(145deg, rgba(26, 32, 44, 0.85) 0%, rgba(15, 20, 28, 0.95) 100%)',
        border: '1px solid rgba(66, 133, 244, 0.28)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        boxSizing: 'border-box'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'rgba(66, 133, 244, 0.48)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 12px 36px rgba(66, 133, 244, 0.15), 0 4px 20px rgba(0, 0, 0, 0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(66, 133, 244, 0.28)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.05)';
      }}
    >
      {/* Top Banner with status badge and Google Calendar icon */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'rgba(66, 133, 244, 0.08)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/google_calendar.png"
            alt="Google Calendar"
            style={{ width: '18px', height: '18px', objectFit: 'contain' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)', letterSpacing: '0.2px' }}>
            Google Calendar
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            padding: '3px 9px',
            borderRadius: '12px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            fontSize: '11px',
            fontWeight: 600,
            color: '#34d399'
          }}
        >
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
          <span>Event Created</span>
        </div>
      </div>

      {/* Main Content Body */}
      <div style={{ padding: '16px 18px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        {/* Calendar Tile (Month / Day) */}
        <div
          style={{
            width: '54px',
            borderRadius: '12px',
            overflow: 'hidden',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            textAlign: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25)'
          }}
        >
          <div
            style={{
              background: '#4285F4',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              padding: '3px 0',
              letterSpacing: '0.6px'
            }}
          >
            {month}
          </div>
          <div
            style={{
              color: '#ffffff',
              fontSize: '20px',
              fontWeight: 700,
              padding: '6px 0',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            {day}
          </div>
        </div>

        {/* Event Details */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 6px 0',
              fontSize: '16px',
              fontWeight: 600,
              color: '#ffffff',
              lineHeight: 1.3,
              wordBreak: 'break-word'
            }}
          >
            {title}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <CalendarIcon size={14} color="#60a5fa" style={{ flexShrink: 0 }} />
              <span style={{ fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>{fullDate}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <Clock size={14} color="#93c5fd" style={{ flexShrink: 0 }} />
              <span>{timeRange}</span>
            </div>

            {location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <MapPin size={14} color="#f87171" style={{ flexShrink: 0 }} />
                <span>{location}</span>
              </div>
            )}

            {attendees.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Users size={14} color="#a78bfa" style={{ flexShrink: 0 }} />
                <span>{attendees.join(', ')}</span>
              </div>
            )}
          </div>

          {note && (
            <div
              style={{
                marginTop: '10px',
                fontSize: '11px',
                color: 'rgba(255, 255, 255, 0.5)',
                fontStyle: 'italic'
              }}
            >
              {note}
            </div>
          )}
        </div>
      </div>

      {/* Action Footer Buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          background: 'rgba(0, 0, 0, 0.25)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)'
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
            gap: '7px',
            padding: '8px 14px',
            borderRadius: '9px',
            background: 'linear-gradient(135deg, #4285F4 0%, #2b6cb0 100%)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 2px 10px rgba(66, 133, 244, 0.35)',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'none';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <span>View on Google Calendar</span>
          <ExternalLink size={13} />
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
            borderRadius: '9px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: copied ? '#34d399' : 'rgba(255, 255, 255, 0.8)',
            fontSize: '12px',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.18s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.14)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
}
