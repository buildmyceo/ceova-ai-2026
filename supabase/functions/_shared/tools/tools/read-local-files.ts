import { Tool, ToolMetadata, ToolResult, ToolContext } from '../types.ts';

export class ReadLocalFilesTool implements Tool {
  metadata: ToolMetadata = {
    id: 'read_local_files',
    name: 'Read Local Files',
    description: 'Reads the contents of one or more files from the connected local folder.',
    category: 'System',
    icon: 'Folder',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
          },
          description: 'List of file paths relative to the connected folder.',
        },
      },
      required: ['files'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    // This is intercepted by the frontend. The backend just returns a placeholder.
    return { success: true, data: { text: "Files read request sent to client." } };
  }
}
