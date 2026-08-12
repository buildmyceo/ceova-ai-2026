import { Tool, ToolMetadata } from './types.ts';
import { BackgroundRemoverTool } from './tools/background-remover.ts';
import { ImageAnalysisTool } from './tools/image-analysis.ts';
import { GmailConnectorTool } from './tools/gmail.ts';
import { GoogleCalendarConnectorTool } from './tools/calendar.ts';
import { GoogleDriveConnectorTool } from './tools/drive.ts';
import { FileSizeReductionTool } from './tools/file-size-reduction.ts';
import { FileConverterTool } from './tools/file-converter.ts';
import { QRBarcodeTool } from './tools/qr-barcode.ts';
import { PdfToolkitTool } from './tools/pdf-toolkit.ts';
import { PasswordHashTool } from './tools/password-hash.ts';
import { ColorToolkitTool } from './tools/color-toolkit.ts';
import { WriteLocalFilesTool } from './tools/write-local-files.ts';
import { ReadLocalFilesTool } from './tools/read-local-files.ts';
import { ListLocalFilesTool } from './tools/list-local-files.ts';

import { InvoiceGeneratorTool } from './tools/invoice-generator.ts';
import { MediaConverterTool } from './tools/media-converter.ts';
import { RunTerminalCommandTool } from './tools/run-terminal-command.ts';
import { DownloadVideoTool } from './tools/download-video.ts';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerTool(new BackgroundRemoverTool());
    this.registerTool(new ImageAnalysisTool());
    this.registerTool(GmailConnectorTool);
    this.registerTool(GoogleCalendarConnectorTool);
    this.registerTool(GoogleDriveConnectorTool);
    this.registerTool(new FileSizeReductionTool());
    this.registerTool(new FileConverterTool());
    this.registerTool(new QRBarcodeTool());
    this.registerTool(new PdfToolkitTool());
    this.registerTool(new PasswordHashTool());
    this.registerTool(new ColorToolkitTool());
    this.registerTool(new WriteLocalFilesTool());
    this.registerTool(new ReadLocalFilesTool());
    this.registerTool(new ListLocalFilesTool());

    this.registerTool(new InvoiceGeneratorTool());
    this.registerTool(new MediaConverterTool());
    this.registerTool(new RunTerminalCommandTool());
    this.registerTool(new DownloadVideoTool());
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.metadata.id, tool);
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  // Returns simplified metadata for the LLM prompt
  getToolSchemas(): ToolMetadata[] {
    return Array.from(this.tools.values())
      .filter(t => t.metadata.enabled)
      .map(t => t.metadata);
  }
}

export const toolRegistry = new ToolRegistry();
