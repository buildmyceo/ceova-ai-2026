import { Tool, ToolMetadata, ToolResult, ToolContext } from '../types.ts';

export class ListLocalFilesTool implements Tool {
  metadata: ToolMetadata = {
    id: 'list_local_files',
    name: 'List Local Files',
    description: 'Lists the files and directories in the connected local folder.',
    category: 'System',
    icon: 'Folder',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Optional relative path to list a specific subdirectory. Leave empty for the root connected folder.',
        },
      },
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    // This is intercepted by the frontend.
    return { success: true, data: { text: "Directory list request sent to client." } };
  }
}
