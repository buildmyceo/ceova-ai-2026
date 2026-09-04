/**
 * CEOVA Controlled Cloud Development Tools
 * 
 * Secure, sandboxed tool layer exposed to GPT-5.6 Luna for building,
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
    description: 'Creates and deploys a cloud website project workspace on ceova.online. For new websites or major/structural changes on existing sites (new pages, redesigns, major features, navigation changes), present or revise the implementation plan first and wait for user approval. For small/isolated changes on existing sites ("Change the restaurant name", "Make button text Order Now", "Change hero heading", "Change image", "Make button smaller", "Change contact number"), modify directly with project_id, identifying the exact part, preserving everything else, and avoiding full-site regeneration.',
    category: 'CloudDev',
    icon: 'FolderPlus',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the website/project (e.g. "Bella Italia Restaurant")' },
        framework: { type: 'string', description: 'Framework (default: "react-vite")' },
        description: { type: 'string', description: 'Short summary of the project purpose or update instructions' },
        project_id: { type: 'string', description: 'Optional: Existing Project UUID if updating an existing website' },
      },
      required: ['name'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const prompt = context.args?.description || context.args?.name || context.message || 'Create a web project';
      const projectId = context.args?.project_id || context.existingProjectId;
      
      const onProgress = context.sendEvent || ((event: any) => {
        if (context.onStatusUpdate && event.stage) {
          context.onStatusUpdate(event.stage);
        }
      });

      const result = await CloudDevOrchestrator.buildAndDeployProject(
        prompt,
        context.userId,
        onProgress,
        projectId
      );

      // Record audit log
      await supabaseAdmin.from('project_audit_logs').insert({
        project_id: result.projectId,
        user_id: context.userId,
        event_type: 'project.created',
        details: { slug: result.slug, url: result.deploymentUrl },
      });

      return {
        success: true,
        data: {
          project_id: result.projectId,
          slug: result.slug,
          deployment_url: result.deploymentUrl,
          message: `Successfully created and deployed website. URL: ${result.deploymentUrl}`,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'EXEC_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: Write Project File
 */
export class WriteProjectFileTool implements Tool {
  metadata: ToolMetadata = {
    id: 'write_project_file',
    name: 'Write Project File',
    description: 'Writes or updates source code files inside the isolated project sandbox.',
    category: 'CloudDev',
    icon: 'FileCode',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        path: { type: 'string', description: 'Relative path of the file (e.g. "index.html", "src/App.jsx")' },
        content: { type: 'string', description: 'Complete file content' },
        files: {
          type: 'array',
          description: 'Optional batch array of files [{path, content}]',
          items: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
            },
            required: ['path', 'content'],
          },
        },
      },
      required: ['project_id'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      await verifyProjectOwnership(projectId, context.userId);

      let filesToWrite: Array<{ path: string; content: string }> = [];

      if (Array.isArray(context.args?.files) && context.args.files.length > 0) {
        filesToWrite = context.args.files;
      } else if (context.args?.path) {
        filesToWrite = [{ path: context.args.path, content: context.args.content || '' }];
      } else {
        return { success: false, error: { code: 'INVALID_ARGS', message: 'Missing file path or files array.' } };
      }

      const result = await CloudWorkerService.writeProjectFiles(projectId, filesToWrite);

      return {
        success: true,
        data: {
          project_id: projectId,
          written_files: result.paths,
          count: result.written,
          message: `Successfully written ${result.written} file(s) to project workspace.`,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'WRITE_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: Read Project File
 */
export class ReadProjectFileTool implements Tool {
  metadata: ToolMetadata = {
    id: 'read_project_file',
    name: 'Read Project File',
    description: 'Reads the content of a file from the project workspace.',
    category: 'CloudDev',
    icon: 'FileText',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        path: { type: 'string', description: 'Relative path of the file to read' },
      },
      required: ['project_id', 'path'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      const path = CloudWorkerService.sanitizePath(context.args?.path);
      await verifyProjectOwnership(projectId, context.userId);

      const { data: file, error } = await supabaseAdmin
        .from('project_files')
        .select('content, size_bytes, updated_at')
        .eq('project_id', projectId)
        .eq('path', path)
        .single();

      if (error || !file) {
        return { success: false, error: { code: 'FILE_NOT_FOUND', message: `File "${path}" not found.` } };
      }

      return {
        success: true,
        data: {
          path,
          content: file.content,
          size_bytes: file.size_bytes,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'READ_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: List Project Files
 */
export class ListProjectFilesTool implements Tool {
  metadata: ToolMetadata = {
    id: 'list_project_files',
    name: 'List Project Files',
    description: 'Lists all files in the project workspace.',
    category: 'CloudDev',
    icon: 'List',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      await verifyProjectOwnership(projectId, context.userId);

      const { data: files, error } = await supabaseAdmin
        .from('project_files')
        .select('path, size_bytes, updated_at')
        .eq('project_id', projectId)
        .order('path', { ascending: true });

      if (error) {
        return { success: false, error: { code: 'DB_ERROR', message: error.message } };
      }

      return {
        success: true,
        data: {
          project_id: projectId,
          files: files || [],
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'LIST_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: Install Project Dependency
 */
export class InstallProjectDependencyTool implements Tool {
  metadata: ToolMetadata = {
    id: 'install_project_dependency',
    name: 'Install Project Dependency',
    description: 'Requests and verifies approved packages in package.json.',
    category: 'CloudDev',
    icon: 'Package',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        package_name: { type: 'string', description: 'Name of approved package (e.g. "lucide-react")' },
        version: { type: 'string', description: 'Package version (default: "latest")' },
      },
      required: ['project_id', 'package_name'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      const pkgName = (context.args?.package_name || '').trim().toLowerCase();
      const version = context.args?.version || '^latest';
      await verifyProjectOwnership(projectId, context.userId);

      if (!ALLOWED_DEPENDENCIES.has(pkgName)) {
        return {
          success: false,
          error: {
            code: 'PACKAGE_NOT_ALLOWED',
            message: `Package "${pkgName}" is not in the approved UI dependency list. Approved packages: [${Array.from(ALLOWED_DEPENDENCIES).join(', ')}].`,
          },
        };
      }

      // Fetch or create package.json
      let pkgJson: any = {
        name: 'ceova-cloud-project',
        private: true,
        version: '1.0.0',
        dependencies: {},
      };

      const { data: existingPkg } = await supabaseAdmin
        .from('project_files')
        .select('content')
        .eq('project_id', projectId)
        .eq('path', 'package.json')
        .maybeSingle();

      if (existingPkg) {
        try { pkgJson = JSON.parse(existingPkg.content); } catch {}
      }

      pkgJson.dependencies = pkgJson.dependencies || {};
      pkgJson.dependencies[pkgName] = version;

      await CloudWorkerService.writeProjectFiles(projectId, [{
        path: 'package.json',
        content: JSON.stringify(pkgJson, null, 2),
      }]);

      return {
        success: true,
        data: {
          package_name: pkgName,
          version: version,
          message: `Installed "${pkgName}@${version}" into project dependencies.`,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'INSTALL_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: Run Project Build & Test
 */
export class RunProjectBuildTool implements Tool {
  metadata: ToolMetadata = {
    id: 'run_project_build',
    name: 'Run Project Build',
    description: 'Triggers the isolated build worker to compile, bundle, and test the project.',
    category: 'CloudDev',
    icon: 'Play',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      await verifyProjectOwnership(projectId, context.userId);

      context.onStatusUpdate?.("Starting isolated cloud worker build...");
      const buildResult = await CloudWorkerService.runBuild(projectId, context.userId);

      if (!buildResult.success) {
        return {
          success: false,
          error: {
            code: 'BUILD_FAILED',
            message: `Build failed: ${buildResult.errors?.[0]?.message || 'Compilation error'}`,
          },
          data: {
            build_id: buildResult.buildId,
            logs: buildResult.logs,
            errors: buildResult.errors,
          },
        };
      }

      return {
        success: true,
        data: {
          build_id: buildResult.buildId,
          duration_ms: buildResult.durationMs,
          deployment_url: buildResult.deploymentUrl,
          logs: buildResult.logs,
          message: `Build and tests passed! Deployed live at ${buildResult.deploymentUrl}`,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'BUILD_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: Get Build Logs
 */
export class GetProjectBuildLogsTool implements Tool {
  metadata: ToolMetadata = {
    id: 'get_build_logs',
    name: 'Get Build Logs',
    description: 'Fetches recent build and compiler logs for debugging.',
    category: 'CloudDev',
    icon: 'FileText',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
        build_id: { type: 'string', description: 'Optional specific build UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      await verifyProjectOwnership(projectId, context.userId);

      let query = supabaseAdmin
        .from('project_builds')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (context.args?.build_id) {
        query = query.eq('id', context.args.build_id);
      }

      const { data: builds, error } = await query.limit(3);

      if (error || !builds || builds.length === 0) {
        return { success: false, error: { code: 'NO_LOGS', message: 'No build records found.' } };
      }

      return {
        success: true,
        data: {
          latest_build: builds[0],
          all_builds: builds,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'LOGS_ERROR', message: e.message } };
    }
  }
}

/**
 * Tool: Deploy Project
 */
export class DeployProjectTool implements Tool {
  metadata: ToolMetadata = {
    id: 'deploy_project',
    name: 'Deploy Project',
    description: 'Ensures the latest successful build is active on https://<slug>.ceova.online.',
    category: 'CloudDev',
    icon: 'UploadCloud',
    requiresImage: false,
    requiresAuth: true,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'The project UUID' },
      },
      required: ['project_id'],
    },
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    try {
      const projectId = context.args?.project_id;
      const project = await verifyProjectOwnership(projectId, context.userId);

      // Trigger build and deployment through worker
      const buildResult = await CloudWorkerService.runBuild(projectId, context.userId);

      if (!buildResult.success) {
        return {
          success: false,
          error: { code: 'DEPLOY_FAILED', message: `Deployment failed during build: ${buildResult.errors?.[0]?.message}` },
        };
      }

      return {
        success: true,
        data: {
          project_id: projectId,
          slug: project.slug,
          deployment_url: buildResult.deploymentUrl,
          message: `Project is now live at ${buildResult.deploymentUrl}`,
        },
      };
    } catch (e: any) {
      return { success: false, error: { code: 'DEPLOY_ERROR', message: e.message } };
    }
  }
}

/** Export all Cloud Development Tools */
export const cloudDevelopmentTools: Tool[] = [
  new CreateProjectTool(),
  new WriteProjectFileTool(),
  new ReadProjectFileTool(),
  new ListProjectFilesTool(),
  new InstallProjectDependencyTool(),
  new RunProjectBuildTool(),
  new GetProjectBuildLogsTool(),
  new DeployProjectTool(),
];
