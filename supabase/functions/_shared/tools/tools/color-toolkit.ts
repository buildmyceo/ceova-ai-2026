import { Tool, ToolContext, ToolResult, ToolMetadata } from '../types.ts';
import chroma from 'https://esm.sh/chroma-js@2.4.2';

export class ColorToolkitTool implements Tool {
  metadata: ToolMetadata = {
    id: 'color_toolkit',
    name: 'Color Toolkit',
    description: 'Convert colors, pick colors from images, generate palettes, and check contrast (WCAG).',
    category: 'Design Utilities',
    icon: 'palette',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform: convert, extract_image_colors, generate_palette, generate_gradient, check_contrast',
          enum: ['convert', 'extract_image_colors', 'generate_palette', 'generate_gradient', 'check_contrast']
        },
        color1: {
          type: 'string',
          description: 'The primary color (HEX, RGB, HSL, etc.).'
        },
        color2: {
          type: 'string',
          description: 'The secondary color (required for check_contrast, generate_gradient).'
        },
        count: {
          type: 'number',
          description: 'Number of colors to generate for a palette or gradient (default 5).'
        }
      },
      required: ['action']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const params = context.args || {};
    const updateStatus = context.onStatusUpdate || (() => {});
    const { action, color1, color2, count = 5 } = params;

    try {
      updateStatus(`Executing color action: ${action}...`);

      if (action === 'extract_image_colors') {
          if (!context.attachments || context.attachments.length === 0) {
              throw new Error("No image attachment provided for color extraction.");
          }
          const imageAttachments = context.attachments.filter(a => a.type.startsWith('image/'));
          if (imageAttachments.length === 0) {
              throw new Error("No valid image found in attachments.");
          }

          updateStatus('Delegating image processing to client for color extraction');
          const actionMeta = {
              type: 'client_color_toolkit',
              action: action,
              image: imageAttachments[0].url
          };

          return {
              success: true,
              data: {
                  text: `I've analyzed the image to extract its dominant colors.\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
                  processingTimeMs: Date.now() - startTime
              }
          };
      }

      let actionMeta: any = { type: 'client_color_toolkit', action };

      if (action === 'convert') {
          if (!color1) throw new Error("Missing 'color1' parameter for conversion.");
          const c = chroma(color1);
          actionMeta.color = {
              hex: c.hex(),
              rgb: c.css(),
              hsl: c.css('hsl'),
              hsv: c.hsv(),
          };
          actionMeta.schemes = {
              complementary: [c.hex(), c.set('hsl.h', '+180').hex()],
              analogous: [c.set('hsl.h', '-30').hex(), c.hex(), c.set('hsl.h', '+30').hex()],
              triadic: [c.hex(), c.set('hsl.h', '+120').hex(), c.set('hsl.h', '+240').hex()],
              monochromatic: chroma.scale([c.darken(2), c.brighten(2)]).colors(5)
          };
      } else if (action === 'generate_palette') {
          if (!color1) throw new Error("Missing 'color1' parameter for palette generation.");
          const baseColor = chroma(color1);
          actionMeta.palette = chroma.scale([baseColor.darken(2), baseColor, baseColor.brighten(2)])
              .mode('lch')
              .colors(count);
          actionMeta.baseColor = baseColor.hex();
      } else if (action === 'generate_gradient') {
          if (!color1 || !color2) throw new Error("Missing 'color1' or 'color2' for gradient.");
          actionMeta.gradient = chroma.scale([color1, color2])
              .mode('lch')
              .colors(count);
      } else if (action === 'contrast') {
          if (!color1 || !color2) throw new Error("Missing 'color1' or 'color2' for contrast check.");
          const ratio = chroma.contrast(color1, color2);
          actionMeta.contrast = {
              color1: chroma(color1).hex(),
              color2: chroma(color2).hex(),
              ratio: Math.round(ratio * 100) / 100,
              wcag_aa_normal: ratio >= 4.5,
              wcag_aa_large: ratio >= 3.0,
              wcag_aaa_normal: ratio >= 7.0,
              wcag_aaa_large: ratio >= 4.5
          };
      } else {
          throw new Error(`Unsupported action: ${action}`);
      }

      updateStatus('Rendering color visualization widget');

      return {
          success: true,
          data: {
              text: `Here are the results of the color operation:\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
              processingTimeMs: Date.now() - startTime
          }
      };

    } catch (e: any) {
      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: e.message || 'An error occurred during color processing.' },
        data: {
            text: `Failed to execute ${action}: ${e.message}`,
            processingTimeMs: Date.now() - startTime
        }
      };
    }
  }
}
