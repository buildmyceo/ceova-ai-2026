export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  requiresImage: boolean;
  requiresAuth: boolean;
  enabled: boolean;
  parameters?: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface ToolContext {
  userId: string;
  message?: string;
  args?: any;
  attachments?: { url?: string; type: string; name: string; content?: string }[];
  onStatusUpdate?: (stage: string) => void; 
  sendEvent?: (event: any) => void; 
  existingProjectId?: string;
}

export interface ToolResult {
  success: boolean;
  data?: any; 
  error?: { code: string; message: string };
}

export interface Tool {
  metadata: ToolMetadata;
  execute: (context: ToolContext) => Promise<ToolResult>;
}
