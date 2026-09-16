import { Tool, ToolMetadata, ToolResult, ToolContext } from '../types.ts';

export class RunTerminalCommandTool implements Tool {
  metadata: ToolMetadata = {
    id: 'run_terminal_command',
    name: 'Run Terminal Command',
    description: "Executes a terminal command on the user's machine (e.g. starting a dev server, installing dependencies) when they are using the desktop app and have a local folder connected.",
    category: 'System',
    icon: 'Terminal',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute, e.g. "npm run dev" or "npx live-server"'
        }
      },
      required: ['command']
    }
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    // This is a special client-side tool.
    // The Edge Function will not execute this; it will pass it back to the client.
    return { success: true, data: { text: "Executed on client." } };
  }
}
