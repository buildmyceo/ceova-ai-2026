import { Tool, ToolContext, ToolResult } from "../types.ts";
import { googleAuthService } from "../../services/google-auth.ts";
import { Logger } from "../../services/logger.ts";

export const GmailConnectorTool: Tool = {
  metadata: {
    id: "gmail_connector",
    name: "Gmail Connector",
    description: "Reads, searches, and sends emails via Gmail on behalf of the user.",
    category: "Communication",
    icon: "Mail",
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The Gmail action to perform",
          enum: ["read_inbox", "search_emails", "read_email", "send_email", "draft_email", "reply_email", "list_labels"]
        },
        recipient: {
          type: "string",
          description: "The recipient's email address (for send_email, draft_email, reply_email)"
        },
        subject: {
          type: "string",
          description: "The email subject line (for send_email, draft_email, reply_email)"
        },
        body: {
          type: "string",
          description: "The email body content (for send_email, draft_email, reply_email)"
        },
        attachments: {
          type: "array",
          description: "Array of attachment objects. Provide either a 'url' (for web/supabase files) or a 'drive_id' (for Google Drive files), along with 'filename' and 'mime_type'.",
          items: {
            type: "object",
            properties: {
              url: { type: "string" },
              drive_id: { type: "string" },
              filename: { type: "string" },
              mime_type: { type: "string" }
            }
          }
        },
        query: {
          type: "string",
          description: "The search query (for search_emails)"
        },
        message_id: {
          type: "string",
          description: "The message ID to read (for read_email)"
        },
        thread_id: {
          type: "string",
          description: "The thread ID to reply to (for reply_email)"
        }
      },
      required: ["action"]
    }
  },
  execute: async (context: ToolContext): Promise<ToolResult> => {
    try {
      context.onStatusUpdate?.("Authenticating with Gmail...");
      const accessToken = await googleAuthService.getValidAccessToken(context.userId);

      if (!accessToken) {
        return {
          success: false,
          error: {
            code: "AUTH_REQUIRED",
            message: "You need to connect your Gmail account in Settings > Connectors."
          }
        };
      }

      const args = context.args || {};
      
      // Auto-detect action if not specified
      let action = args.action;
      if (!action) {
        if (args.recipient || args.to || args.subject || args.body) {
          action = "send_email";
        } else if (args.query) {
          action = "search_emails";
        } else if (args.message_id) {
          action = "read_email";
        } else if (args.thread_id) {
          action = "reply_email";
        } else {
          action = "read_inbox";
        }
      }

      // Handle common parameter aliases
      let recipient = args.recipient || args.to;
      let subject = args.subject;
      let body = args.body || args.message;
      let threadId = args.thread_id;

      // Auto-populate from attached email if present in conversation context
      const attachedEmail = (context.attachments || []).find((a: any) =>
        a.thread_id || a.from_sender || a.source === 'gmail' || a.type === 'message/rfc822'
      );
      if (attachedEmail) {
        if (!threadId && attachedEmail.thread_id) {
          threadId = attachedEmail.thread_id;
        }
        if (!recipient && attachedEmail.from_sender) {
          const emailMatch = attachedEmail.from_sender.match(/<([^>]+)>/);
          recipient = emailMatch ? emailMatch[1] : attachedEmail.from_sender.trim();
        }
        if (!subject && attachedEmail.name) {
          subject = attachedEmail.name.startsWith("Re:") ? attachedEmail.name : `Re: ${attachedEmail.name}`;
        }
      }

      // Fetch attachments if any
      let fetchedAttachments: any[] = [];
      if (args.attachments && Array.isArray(args.attachments)) {
        context.onStatusUpdate?.("Fetching attachments...");
        for (const att of args.attachments) {
          try {
            let buffer: ArrayBuffer | null = null;
            if (att.url) {
              const res = await fetch(att.url);
              if (res.ok) buffer = await res.arrayBuffer();
            } else if (att.drive_id) {
              const url = `https://www.googleapis.com/drive/v3/files/${att.drive_id}?alt=media`;
              const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
              if (res.ok) buffer = await res.arrayBuffer();
            }
            if (buffer) {
              const bytes = new Uint8Array(buffer);
              let binary = '';
              for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
              }
              fetchedAttachments.push({
                filename: att.filename || "attachment",
                mimeType: att.mime_type || "application/octet-stream",
                data: btoa(binary)
              });
            }
          } catch (err: any) {
             Logger.ERROR(`Failed to fetch attachment: ${err.message}`);
          }
        }
      }

      context.onStatusUpdate?.(`Executing ${action}...`);

      switch (action) {
        case "read_inbox":
          return await readInbox(accessToken);
        case "search_emails":
          return await searchEmails(accessToken, args.query || "");
        case "read_email":
          return await readSpecificEmail(accessToken, args.message_id);
        case "send_email":
          return await sendEmail(accessToken, recipient, subject, body, fetchedAttachments);
        case "draft_email":
          return await draftEmail(accessToken, recipient, subject, body, fetchedAttachments);
        case "reply_email":
          return await replyEmail(accessToken, threadId, recipient, subject, body, fetchedAttachments);
        case "list_labels":
          return await listLabels(accessToken);
        default:
          return {
            success: false,
            error: { code: "INVALID_ACTION", message: `Unknown Gmail action: ${action}` }
          };
      }
    } catch (e: any) {
      Logger.ERROR(`Gmail connector error: ${e.message}`);
      return { success: false, error: { code: "EXECUTION_ERROR", message: e.message } };
    }
  }
};

async function readInbox(token: string): Promise<ToolResult> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=in:inbox&maxResults=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  
  const data = await res.json();
  if (!data.messages) return { success: true, data: { text: "Your inbox is empty." } };

  const emails = await Promise.all(data.messages.map((m: any) => fetchEmailDetails(token, m.id)));
  return { success: true, data: { text: formatEmailList(emails, "Inbox") } };
}

async function searchEmails(token: string, query: string): Promise<ToolResult> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  
  const data = await res.json();
  if (!data.messages) return { success: true, data: { text: `No emails found for query: "${query}"` } };

  const emails = await Promise.all(data.messages.map((m: any) => fetchEmailDetails(token, m.id)));
  return { success: true, data: { text: formatEmailList(emails, "Search Results") } };
}

async function readSpecificEmail(token: string, messageId: string): Promise<ToolResult> {
  if (!messageId) throw new Error("message_id is required to read an email.");
  const details = await fetchEmailDetails(token, messageId, true);
  
  const text = `**Subject:** ${details.subject}\n**From:** ${details.from}\n**Date:** ${details.date}\n\n**Body:**\n${details.body || "No text content."}`;
  return { success: true, data: { text } };
}

async function sendEmail(token: string, to: string, subject: string, body: string, attachments: any[] = []): Promise<ToolResult> {
  if (!to || !subject || !body) {
    const missing = [];
    if (!to) missing.push("recipient");
    if (!subject) missing.push("subject");
    if (!body) missing.push("body");
    return {
      success: false,
      error: { code: "MISSING_REQUIRED_FIELDS", message: `Cannot send email: missing ${missing.join(', ')}. Please specify the recipient's email address.` }
    };
  }
  if (!to.includes("@")) {
    return {
      success: false,
      error: { code: "INVALID_RECIPIENT", message: `Recipient must be a valid email address containing '@'. You passed: "${to}". Please provide their valid email address.` }
    };
  }
  
  const raw = createRawEmail(to, subject, body, undefined, attachments);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw })
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 403 && errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      throw new Error("Missing permission to send emails. Please go to your CEOVA Library and click 'Connect / Sync Google Mail' to grant CEOVA permission to send emails on your behalf.");
    }
    throw new Error(errorText);
  }
  return { success: true, data: { text: `✅ Email successfully sent to ${to}.` } };
}

async function draftEmail(token: string, to: string, subject: string, body: string, attachments: any[] = []): Promise<ToolResult> {
  if (!to || !subject || !body) {
    const missing = [];
    if (!to) missing.push("recipient");
    if (!subject) missing.push("subject");
    if (!body) missing.push("body");
    return {
      success: false,
      error: { code: "MISSING_REQUIRED_FIELDS", message: `Cannot draft email: missing ${missing.join(', ')}. Please specify the recipient's email address.` }
    };
  }
  if (!to.includes("@")) {
    return {
      success: false,
      error: { code: "INVALID_RECIPIENT", message: `Recipient must be a valid email address containing '@'. You passed: "${to}". Please provide their valid email address.` }
    };
  }
  
  const raw = createRawEmail(to, subject, body, undefined, attachments);
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/drafts`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw } })
  });

  if (!res.ok) {
    const errorText = await res.text();
    if (res.status === 403 && errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
      throw new Error("Missing permission to draft emails. Please go to your CEOVA Library and click 'Connect / Sync Google Mail' to grant CEOVA permission to manage your emails.");
    }
    throw new Error(errorText);
  }
  return { success: true, data: { text: `📝 Email draft to ${to} created successfully.` } };
}

async function replyEmail(token: string, threadId: string | undefined, to: string, subject: string, body: string, attachments: any[] = []): Promise<ToolResult> {
  // If threadId is missing, attempt to find matching thread by subject or recipient in Gmail
  let resolvedThreadId = threadId;
  if (!resolvedThreadId && (subject || to)) {
    try {
      const cleanSubject = (subject || "").replace(/^Re:\s*/i, "").trim();
      const query = cleanSubject ? `subject:"${cleanSubject}"` : (to ? `to:${to}` : "");
      if (query) {
        const searchUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=1`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${token}` } });
        if (searchRes.ok) {
          const searchData = await searchRes.json();
          if (searchData.messages && searchData.messages[0]?.threadId) {
            resolvedThreadId = searchData.messages[0].threadId;
          }
        }
      }
    } catch (e: any) {
      Logger.WARN(`Failed to search matching thread: ${e.message}`);
    }
  }

  // If we have recipient, subject, and body:
  if (to && subject && body) {
    if (!to.includes("@")) {
      return {
        success: false,
        error: { code: "INVALID_RECIPIENT", message: `Recipient must be a valid email address containing '@'. You passed: "${to}". Please provide their email address.` }
      };
    }

    // If no existing thread was found, send as fresh email with Re: subject
    if (!resolvedThreadId) {
      Logger.INFO(`No Gmail thread found for reply, sending as new email to ${to}`);
      return await sendEmail(token, to, subject, body, attachments);
    }

    // Send reply on thread
    const raw = createRawEmail(to, subject, body, resolvedThreadId, attachments);
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/send`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw, threadId: resolvedThreadId })
    });

    if (!res.ok) {
      const errorText = await res.text();
      if (res.status === 403 && errorText.includes("ACCESS_TOKEN_SCOPE_INSUFFICIENT")) {
        throw new Error("Missing permission to reply to emails. Please go to your CEOVA Library and click 'Connect / Sync Google Mail' to grant CEOVA permission to send emails.");
      }
      throw new Error(errorText);
    }
    return { success: true, data: { text: `✅ Reply successfully sent on thread ${resolvedThreadId} to ${to}.` } };
  }

  const missing = [];
  if (!to) missing.push("recipient email address");
  if (!subject) missing.push("subject");
  if (!body) missing.push("message body");
  return {
    success: false,
    error: {
      code: "MISSING_REQUIRED_FIELDS",
      message: `Could not send email: missing ${missing.join(', ')}. Please provide the recipient's email address so I can send it.`
    }
  };
}

async function listLabels(token: string): Promise<ToolResult> {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/labels`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await res.text());
  
  const data = await res.json();
  const labels = data.labels.map((l: any) => l.name).join(", ");
  return { success: true, data: { text: `Available Gmail labels: ${labels}` } };
}

// Helpers

async function fetchEmailDetails(token: string, id: string, fullBody = false) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Failed to fetch email ${id}`);
  
  const data = await res.json();
  
  const headers = data.payload.headers || [];
  const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  
  let body = "";
  if (fullBody) {
    body = decodeBody(data.payload);
  } else {
    body = data.snippet;
  }
  
  return {
    id: data.id,
    threadId: data.threadId,
    subject: getHeader("subject"),
    from: getHeader("from"),
    date: getHeader("date"),
    body
  };
}

function decodeBody(payload: any): string {
  let body = "";
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain") {
        body += base64UrlDecode(part.body.data);
      } else if (part.parts) {
        body += decodeBody(part);
      }
    }
  } else if (payload.body && payload.body.data) {
    body = base64UrlDecode(payload.body.data);
  }
  return body;
}

function base64UrlDecode(str: string) {
  if (!str) return "";
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  return decodeURIComponent(escape(atob(base64)));
}

function createRawEmail(to: string, subject: string, body: string, threadId?: string, attachments?: any[]) {
  const utf8Subject = `=?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`;
  let message = [
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    "MIME-Version: 1.0",
  ];
  
  if (threadId) {
    message.push(`In-Reply-To: ${threadId}`);
    message.push(`References: ${threadId}`);
  }
  
  if (attachments && attachments.length > 0) {
    const boundary = "foo_bar_baz_boundary_" + Date.now();
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    message.push("");
    message.push(`--${boundary}`);
    message.push("Content-Type: text/html; charset=utf-8");
    message.push("");
    message.push(body.replace(/\\n/g, "<br>"));
    
    for (const att of attachments) {
      message.push("");
      message.push(`--${boundary}`);
      message.push(`Content-Type: ${att.mimeType}; name="${att.filename}"`);
      message.push("Content-Transfer-Encoding: base64");
      message.push(`Content-Disposition: attachment; filename="${att.filename}"`);
      message.push("");
      message.push(att.data);
    }
    message.push("");
    message.push(`--${boundary}--`);
  } else {
    message.push("Content-Type: text/html; charset=utf-8");
    message.push("");
    message.push(body.replace(/\\n/g, "<br>"));
  }
  
  const raw = message.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function formatEmailList(emails: any[], title: string): string {
  let text = `**${title}**\n\n`;
  for (const email of emails) {
    text += `- **Subject**: ${email.subject}\n  **From**: ${email.from}\n  **ID**: \`${email.id}\`\n  **Snippet**: ${email.body}\n\n`;
  }
  return text;
}
