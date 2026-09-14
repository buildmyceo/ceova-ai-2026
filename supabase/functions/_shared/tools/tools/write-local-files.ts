import { Tool, ToolMetadata, ToolResult, ToolContext } from '../types.ts';

export class WriteLocalFilesTool implements Tool {
  metadata: ToolMetadata = {
    id: 'write_local_files',
    name: 'Write Local Files',
    description: "Writes code files to the user's local folder when they ask to build a website or project.",
    category: 'System',
    icon: 'Edit',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              filename: {
                type: 'string',
                description: 'The name of the file to create, e.g. index.html'
              },
              content: {
                type: 'string',
                description: 'The full string content to write to the file'
              }
            },
            required: ['filename', 'content']
          },
          description: 'An array of files to write to the local directory.'
        }
      },
      required: ['files']
    }
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    // This is a special client-side tool.
    // The Edge Function will not execute this; it will pass it back to the client.
    return { success: true, data: { text: "Executed on client." } };
  }
}
