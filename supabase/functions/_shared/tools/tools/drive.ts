import { Tool, ToolContext, ToolResult } from "../types.ts";
import { googleAuthService } from "../../services/google-auth.ts";
import { Logger } from "../../services/logger.ts";
import { generateCeovaSignature } from "../../utils/ceova-watermark.ts";

export const GoogleDriveConnectorTool: Tool = {
  metadata: {
    id: "drive_connector",
    name: "Google Drive Connector",
    description: `Manages Google Drive files and folders (list, search, upload, download, create_folder, move, rename, delete, share, read_metadata).
DRIVE_CONNECTOR RULES:
- Automatically use this tool when the user asks to manage or store files in the cloud (no need for the user to explicitly say "Google Drive").
- If multiple files match a name, ask the user to clarify which one they mean before operating on it.
- Never fake uploads or downloads. Always use this tool to perform the action and only confirm success if it succeeds.
- For uploading, pass the url of the file to upload from the chat context into the \`file_url\` parameter.`,
    category: "Productivity",
    icon: "HardDrive",
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "The Drive action to perform",
          enum: ["list_files", "search_files", "upload_file", "download_file", "create_folder", "move_file", "rename_file", "delete_file", "share_file", "read_metadata"]
        },
        file_id: {
          type: "string",
          description: "The ID of the file/folder to operate on (download, move, rename, delete, share, read_metadata)"
        },
        name: {
          type: "string",
          description: "The name of the file or folder (used for search, create_folder, rename_file)"
        },
        file_url: {
          type: "string",
          description: "The URL of the file to upload (for upload_file)"
        },
        folder_id: {
          type: "string",
          description: "The ID of the destination folder (for move_file)"
        },
        email: {
          type: "string",
          description: "The email address to share the file with (for share_file)"
        },
        role: {
          type: "string",
          description: "The role for sharing (reader, commenter, writer). Defaults to reader.",
          enum: ["reader", "commenter", "writer"]
        }
      },
      required: ["action"]
    }
  },
  execute: async (context: ToolContext): Promise<ToolResult> => {
    try {
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
      const action = args.action;

      context.onStatusUpdate?.(`Executing ${action}...`);

      switch (action) {
        case "list_files":
          return await listFiles(accessToken);
        case "search_files":
          return await searchFiles(accessToken, args.name);
        case "upload_file":
          let uploadUrl = args.file_url;
          if (!uploadUrl && context.attachments && context.attachments.length > 0) {
            uploadUrl = context.attachments[0].url;
          }
          if (!uploadUrl) return { success: false, error: { code: "MISSING_FILE", message: "No file URL provided to upload." } };
          
          let fileName = args.name;
          if (!fileName && context.attachments && context.attachments.length > 0) {
            fileName = context.attachments[0].name || "uploaded_file";
          }
          return await uploadFile(accessToken, uploadUrl, fileName || "uploaded_file");
        case "download_file":
          if (!args.file_id) return { success: false, error: { code: "MISSING_ID", message: "file_id is required." } };
          return await downloadFile(accessToken, args.file_id);
        case "create_folder":
          if (!args.name) return { success: false, error: { code: "MISSING_NAME", message: "name is required for creating a folder." } };
          return await createFolder(accessToken, args.name);
        case "move_file":
          if (!args.file_id || !args.folder_id) return { success: false, error: { code: "MISSING_PARAMS", message: "file_id and folder_id are required." } };
          return await moveFile(accessToken, args.file_id, args.folder_id);
        case "rename_file":
          if (!args.file_id || !args.name) return { success: false, error: { code: "MISSING_PARAMS", message: "file_id and new name are required." } };
          return await renameFile(accessToken, args.file_id, args.name);
        case "delete_file":
          if (!args.file_id) return { success: false, error: { code: "MISSING_ID", message: "file_id is required." } };
          return await deleteFile(accessToken, args.file_id);
        case "share_file":
          if (!args.file_id || !args.email) return { success: false, error: { code: "MISSING_PARAMS", message: "file_id and email are required." } };
          return await shareFile(accessToken, args.file_id, args.email, args.role || "reader");
        case "read_metadata":
          if (!args.file_id) return { success: false, error: { code: "MISSING_ID", message: "file_id is required." } };
          return await readMetadata(accessToken, args.file_id);
        default:
          return { success: false, error: { code: "INVALID_ACTION", message: `Unknown action: ${action}` } };
      }
    } catch (e: any) {
      Logger.ERROR(`Drive connector error: ${e.message}`);
      return { success: false, error: { code: "INTERNAL_ERROR", message: e.message } };
    }
  }
};

async function listFiles(token: string): Promise<ToolResult> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.append("pageSize", "20");
  url.searchParams.append("fields", "files(id, name, mimeType, modifiedTime, webViewLink)");
  url.searchParams.append("orderBy", "modifiedTime desc");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    return { success: false, error: { code: "API_ERROR", message: JSON.stringify(errorData) } };
  }

  const data = await res.json();
  const files = data.files || [];

  if (files.length === 0) {
    return { success: true, data: { text: "Your Google Drive is empty or no files were found." } };
  }
  
  const text = `📁 **Recent Files:**\n\n` + files.map((f: any) => `- **${f.name}**\n  Type: ${f.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : 'File'}\n  ID: \`${f.id}\`\n  [View](${f.webViewLink})`).join('\n\n');
  return { success: true, data: { text } };
}

async function searchFiles(token: string, name?: string): Promise<ToolResult> {
  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.append("pageSize", "20");
  url.searchParams.append("fields", "files(id, name, mimeType, webViewLink, webContentLink)");
  if (name) {
    const escapedName = name.replace(/'/g, "\\\\'");
    url.searchParams.append("q", `name contains '${escapedName}'`);
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    return { success: false, error: { code: "API_ERROR", message: "Failed to search files." } };
  }

  const data = await res.json();
  const files = data.files || [];

  if (files.length === 0) {
    return { success: true, data: { text: `No files found matching "${name}".` } };
  }
  
  const text = `🔍 **Search Results:**\n\n` + files.map((f: any) => `- **${f.name}**\n  Type: ${f.mimeType === 'application/vnd.google-apps.folder' ? 'Folder' : 'File'}\n  ID: \`${f.id}\`\n  [View](${f.webViewLink})`).join('\n\n');
  return { success: true, data: { text } };
}

async function uploadFile(token: string, fileUrl: string, name: string): Promise<ToolResult> {
  const fileRes = await fetch(fileUrl);
  if (!fileRes.ok) {
    return { success: false, error: { code: "DOWNLOAD_ERROR", message: "Failed to fetch the file to upload." } };
  }
  
  const contentType = fileRes.headers.get("content-type") || "application/octet-stream";
  const blob = await fileRes.blob();
  
  const uploadUrl = new URL("https://www.googleapis.com/upload/drive/v3/files?uploadType=media");
  
  const uploadRes = await fetch(uploadUrl.toString(), {
    method: "POST",
    headers: { 
      Authorization: `Bearer ${token}`,
      "Content-Type": contentType
    },
    body: blob
  });

  if (!uploadRes.ok) {
    const err = await uploadRes.text();
    return { success: false, error: { code: "API_ERROR", message: `Failed to upload file: ${err}` } };
  }

  const uploadData = await uploadRes.json();
  const fileId = uploadData.id;

  const patchRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink,properties,appProperties`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: name,
      properties: {
        ceova_verified: "true",
        ceova_origin: "Ceova-AI-Suite"
      },
      appProperties: {
        ceova_origin: "Ceova-AI",
        ceova_signature: generateCeovaSignature({ fileId, name, origin: "Ceova-AI-Suite" }),
        ceova_created_at: new Date().toISOString()
      }
    })
  });

  const finalData = await patchRes.json();

  return { success: true, data: { text: `✅ File **${finalData.name || name}** uploaded successfully!\n\n[View on Google Drive](${finalData.webViewLink})` } };
}

async function downloadFile(token: string, fileId: string): Promise<ToolResult> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,webViewLink,webContentLink,mimeType`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    return { success: false, error: { code: "API_ERROR", message: "Failed to retrieve file for download." } };
  }

  const data = await res.json();
  if (data.mimeType === 'application/vnd.google-apps.folder') {
    return { success: true, data: { text: `📁 **${data.name}** is a folder. You can view it here:\n[Open Folder](${data.webViewLink})` } };
  }

  let text = `📄 **${data.name}**\n\n`;
  if (data.webContentLink) {
    text += `⬇️ [Download File](${data.webContentLink})\n`;
  }
  text += `👁️ [View on Google Drive](${data.webViewLink})`;

  return { success: true, data: { text } };
}

async function createFolder(token: string, name: string): Promise<ToolResult> {
  const res = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: name,
      mimeType: "application/vnd.google-apps.folder"
    })
  });

  if (!res.ok) {
    return { success: false, error: { code: "API_ERROR", message: "Failed to create folder." } };
  }

  const data = await res.json();
  return { success: true, data: { text: `✅ Folder **${data.name}** created successfully!\n\n[Open Folder](${data.webViewLink})` } };
}

async function moveFile(token: string, fileId: string, folderId: string): Promise<ToolResult> {
  const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!fileRes.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to fetch file details." } };
  const fileData = await fileRes.json();
  const previousParents = (fileData.parents || []).join(',');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=${previousParents}&fields=id,name,webViewLink`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to move file." } };
  const data = await res.json();
  
  return { success: true, data: { text: `✅ Moved **${data.name}** successfully.\n[View File](${data.webViewLink})` } };
}

async function renameFile(token: string, fileId: string, name: string): Promise<ToolResult> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,webViewLink`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ name: name })
  });

  if (!res.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to rename file." } };
  const data = await res.json();
  
  return { success: true, data: { text: `✅ Renamed to **${data.name}** successfully.\n[View File](${data.webViewLink})` } };
}

async function deleteFile(token: string, fileId: string): Promise<ToolResult> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok && res.status !== 204) return { success: false, error: { code: "API_ERROR", message: "Failed to delete file." } };
  return { success: true, data: { text: "🗑️ File deleted successfully." } };
}

async function shareFile(token: string, fileId: string, email: string, role: string): Promise<ToolResult> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "user",
      role: role,
      emailAddress: email
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { success: false, error: { code: "API_ERROR", message: `Failed to share file: ${err.error?.message || 'Unknown error'}` } };
  }
  
  return { success: true, data: { text: `🤝 File successfully shared with **${email}** as a ${role}.` } };
}

async function readMetadata(token: string, fileId: string): Promise<ToolResult> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,createdTime,modifiedTime,size,owners,shared,webViewLink`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) return { success: false, error: { code: "API_ERROR", message: "Failed to read file metadata." } };
  
  const data = await res.json();
  
  const owner = data.owners && data.owners.length > 0 ? data.owners[0].displayName : "Unknown";
  const sizeMB = data.size ? (parseInt(data.size) / (1024 * 1024)).toFixed(2) + " MB" : "N/A";
  
  const text = `📊 **Metadata for "${data.name}"**\n
- **Type**: ${data.mimeType}
- **Size**: ${sizeMB}
- **Created**: ${new Date(data.createdTime).toLocaleString()}
- **Last Modified**: ${new Date(data.modifiedTime).toLocaleString()}
- **Owner**: ${owner}
- **Shared**: ${data.shared ? "Yes" : "No"}

[Open File](${data.webViewLink})`;

  return { success: true, data: { text } };
}
