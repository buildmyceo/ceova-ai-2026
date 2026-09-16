import { ToolContext, ToolResult } from './types.ts';
import { toolRegistry } from './registry.ts';

export class ToolExecutor {
  static async execute(toolId: string, context: ToolContext): Promise<ToolResult> {
    const tool = toolRegistry.getTool(toolId);
    
    if (!tool) {
      return {
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool with id ${toolId} not found` }
      };
    }

    if (!tool.metadata.enabled) {
      return {
        success: false,
        error: { code: 'TOOL_DISABLED', message: `Tool ${toolId} is currently disabled` }
      };
    }

    if (tool.metadata.requiresImage && (!context.attachments || context.attachments.length === 0)) {
      return {
        success: false,
        error: { code: 'IMAGE_REQUIRED', message: `Please upload an image to use the ${tool.metadata.name}.` }
      };
    }

    try {
      return await tool.execute(context);
    } catch (e: any) {
      console.error(`Error executing tool ${toolId}:`, e);
      return {
        success: false,
        error: { code: 'EXECUTION_FAILED', message: e.message || 'An unexpected error occurred during execution' }
      };
    }
  }
}
