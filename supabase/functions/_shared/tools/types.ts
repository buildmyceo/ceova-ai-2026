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
    type: string;
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: any;
      [key: string]: any;
    }>;
    required?: string[];
  };
}

export interface ToolContext {
  userId: string;
  message?: string;
  history?: any[];
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
  ui?: any;
}

export interface Tool {
  metadata: ToolMetadata;
  execute: (context: ToolContext) => Promise<ToolResult>;
}
