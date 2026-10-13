/**
 * CEOVA Controlled Cloud Development Tools
 * 
 * Secure, sandboxed tool layer exposed to GPT-6 Luna for building,
 * testing, and deploying cloud projects to https://<project>.ceova.online.
 */

import { Tool, ToolMetadata, ToolResult, ToolContext } from './types.ts';
import { CloudWorkerService, ALLOWED_DEPENDENCIES } from '../worker/worker-service.ts';
import { CloudDevOrchestrator } from '../ai/cloud-dev-orchestrator.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/** Helper to generate a clean, safe slug from a project name */
export function generateProjectSlug(name: string): string {
  let slug = (name || 'project')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30);

  if (!slug || slug.length < 3) {
    slug = `app-${Math.random().toString(36).substring(2, 7)}`;
  }
  return slug;
}

/** Helper to verify project ownership */
async function verifyProjectOwnership(projectId: string, userId: string): Promise<any> {
  if (!projectId || !userId) {
    throw new Error("Project ID and User ID are required.");
  }
  const { data: project, error } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();

  if (error || !project) {
    throw new Error("Unauthorized or project not found.");
  }
  return project;
}

/**
 * Tool: Create Cloud Project
 */
export class CreateProjectTool implements Tool {
  metadata: ToolMetadata = {
    id: 'create_project',
    name: 'Create Cloud Project',
    description: 'PAUSED: Cloud website creation and hosting is currently paused and unavailable.',
    category: 'CloudDev',
    icon: 'FolderPlus',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the website/project (e.g. "Bella Italia Restaurant")' },
        framework: { type: 'string', description: 'Framework (default: "react-vite")' },
        description: { type: 'string', description: 'Short summary of the project purpose or update instructions' },
        project_id: { type: 'string', description: 'Optional: Existing Project UUID if updating an existing website' },
        approved_plan: { type: 'string', description: 'Optional: Approved implementation plan markdown if previously reviewed and approved by user' },
      },
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return {
      success: false,
      error: {
        code: 'TOOL_PAUSED',
        message: 'The website development tool is currently paused and temporarily unavailable.',
      },
    };
  }
}

/**
 * Tool: Write Project File
 */
export class WriteProjectFileTool implements Tool {
  metadata: ToolMetadata = {
    id: 'write_project_file',
    name: 'Write Project File',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'FileCode',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        path: { type: 'string', description: 'Relative path of the file' },
        content: { type: 'string', description: 'Complete file content' },
      },
      required: ['project_id'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: Read Project File
 */
export class ReadProjectFileTool implements Tool {
  metadata: ToolMetadata = {
    id: 'read_project_file',
    name: 'Read Project File',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'FileText',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        path: { type: 'string', description: 'Relative path of the file to read' },
      },
      required: ['project_id', 'path'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: Edit Project File (Surgical Replacement)
 */
export class EditProjectFileTool implements Tool {
  metadata: ToolMetadata = {
    id: 'edit_project_file',
    name: 'Edit Project File',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'Edit3',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        path: { type: 'string', description: 'Relative path of the file to edit' },
        target_content: { type: 'string', description: 'Exact string to replace' },
        replacement_content: { type: 'string', description: 'Replacement string' },
      },
      required: ['project_id', 'path', 'target_content', 'replacement_content'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: List Project Files
 */
export class ListProjectFilesTool implements Tool {
  metadata: ToolMetadata = {
    id: 'list_project_files',
    name: 'List Project Files',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'List',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: Install Project Dependency
 */
export class InstallProjectDependencyTool implements Tool {
  metadata: ToolMetadata = {
    id: 'install_project_dependency',
    name: 'Install Project Dependency',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'Package',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        package_name: { type: 'string', description: 'Name of approved package' },
      },
      required: ['project_id', 'package_name'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: Run Project Build & Test
 */
export class RunProjectBuildTool implements Tool {
  metadata: ToolMetadata = {
    id: 'run_project_build',
    name: 'Run Project Build',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'Play',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: Get Build Logs
 */
export class GetProjectBuildLogsTool implements Tool {
  metadata: ToolMetadata = {
    id: 'get_build_logs',
    name: 'Get Build Logs',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'FileText',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/**
 * Tool: Deploy Project
 */
export class DeployProjectTool implements Tool {
  metadata: ToolMetadata = {
    id: 'deploy_project',
    name: 'Deploy Project',
    description: 'PAUSED: Cloud website development tools are paused.',
    category: 'CloudDev',
    icon: 'UploadCloud',
    requiresImage: false,
    requiresAuth: true,
    enabled: false,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

export class GetProjectVersionHistoryTool implements Tool {
  metadata: ToolMetadata = {
    id: 'get_project_version_history',
    name: 'get_project_version_history',
    description: 'PAUSED: Cloud website development tools are paused.',
    enabled: false,
    parameters: [
      { name: 'project_id', type: 'string', description: 'The project ID to get version history for', required: true },
    ],
  };

  async execute(_context: ToolContext): Promise<ToolResult> {
    return { success: false, error: { code: 'TOOL_PAUSED', message: 'The website development tool is currently paused and temporarily unavailable.' } };
  }
}

/** Export all Cloud Development Tools */
export const cloudDevelopmentTools: Tool[] = [
  new CreateProjectTool(),
  new WriteProjectFileTool(),
  new EditProjectFileTool(),
  new ReadProjectFileTool(),
  new ListProjectFilesTool(),
  new InstallProjectDependencyTool(),
  new RunProjectBuildTool(),
  new GetProjectBuildLogsTool(),
  new DeployProjectTool(),
  new GetProjectVersionHistoryTool(),
];
