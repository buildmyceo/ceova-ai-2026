import { Tool, ToolContext, ToolResult, ToolMetadata } from '../types.ts';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";
import { encode as hexEncode } from "https://deno.land/std@0.168.0/encoding/hex.ts";

export class PasswordHashTool implements Tool {
  metadata: ToolMetadata = {
    id: 'password_hash',
    name: 'Password & Hash Tool',
    description: 'Generate secure passwords and passphrases, calculate and verify hashes (SHA-256, MD5, etc.).',
    category: 'Security Utilities',
    icon: 'key',
    requiresImage: false,
    requiresAuth: false,
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          description: 'The action to perform: generate_password, generate_passphrase, hash_text, verify_hash.',
          enum: ['generate_password', 'generate_passphrase', 'hash_text', 'verify_hash']
        },
        text: {
          type: 'string',
          description: 'Text to hash or verify.'
        },
        hash_to_verify: {
          type: 'string',
          description: 'The hash to verify the text against.'
        },
        algorithm: {
          type: 'string',
          description: 'Hash algorithm: SHA-256, SHA-512, SHA-1, MD5. Default is SHA-256.'
        },
        length: {
          type: 'number',
          description: 'Password length (default 16).'
        },
        include_uppercase: {
          type: 'boolean',
          description: 'Include uppercase letters (default true).'
        },
        include_lowercase: {
          type: 'boolean',
          description: 'Include lowercase letters (default true).'
        },
        include_numbers: {
          type: 'boolean',
          description: 'Include numbers (default true).'
        },
        include_symbols: {
          type: 'boolean',
          description: 'Include symbols (default true).'
        },
        word_count: {
          type: 'number',
          description: 'Number of words for passphrase (default 4).'
        },
        separator: {
          type: 'string',
          description: 'Separator for passphrase (default "-").'
        }
      },
      required: ['action']
    }
  };

  async execute(context: ToolContext): Promise<ToolResult> {
    const startTime = Date.now();
    const params = context.args || {};
    const updateStatus = context.onStatusUpdate || (() => {});
    const action = params.action;

    try {
      updateStatus(`Executing ${action}...`);

      if (action === 'generate_password' || action === 'generate_passphrase') {
        const pdfAttachments = (context.attachments || []).filter(a => a.type === 'application/pdf' || a.name.endsWith('.pdf'));
        if (pdfAttachments.length > 0) {
            updateStatus('Redirecting to client for PDF password protection');
            const actionMeta = {
                type: 'client_file_conversion',
                operation: 'protect',
                files: pdfAttachments.map(f => ({ name: f.name || 'document.pdf', url: f.url }))
            };
            return {
                success: true,
                data: {
                    text: `Redirected to client for password operation.\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
                    urls: [],
                    processingTimeMs: Date.now() - startTime
                },
                ui: { type: 'message', props: { text: `Please enter the password securely below:` } }
            };
        }

        updateStatus('Delegating generation to client for security');
        const actionMeta = {
            type: 'client_secure_generator',
            action: action,
            options: {
                length: params.length || 16,
                include_uppercase: params.include_uppercase !== false,
                include_lowercase: params.include_lowercase !== false,
                include_numbers: params.include_numbers !== false,
                include_symbols: params.include_symbols !== false,
                words: params.words || 4,
                separator: params.separator || '-'
            }
        };

        return {
            success: true,
            data: {
                text: `I have delegated the secure generation to your browser to ensure the password is never stored or logged in our databases.\n\n<!-- ACTION_META: ${JSON.stringify(actionMeta)} -->`,
                processingTimeMs: Date.now() - startTime
            }
        };
      }

      let dataToHash: Uint8Array | null = null;

      if (action === 'file_checksum') {
        if (!context.attachments || context.attachments.length === 0) {
            throw new Error("No file attachment provided for checksum.");
        }
        updateStatus(`Downloading file for checksum...`);
        const fileUrl = context.attachments[0].url;
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("Failed to download file attachment.");
        const buffer = await res.arrayBuffer();
        dataToHash = new Uint8Array(buffer);
      } else if (action === 'hash_text' || action === 'verify_hash') {
        if (!params.text && action === 'hash_text') {
            throw new Error("Missing 'text' parameter for hashing.");
        }
        // If verify_hash without text but with file, use file
        if (!params.text && context.attachments && context.attachments.length > 0) {
             updateStatus(`Downloading file for checksum verification...`);
             const fileUrl = context.attachments[0].url;
             const res = await fetch(fileUrl);
             if (!res.ok) throw new Error("Failed to download file attachment.");
             const buffer = await res.arrayBuffer();
             dataToHash = new Uint8Array(buffer);
        } else {
             if (!params.text) throw new Error("Missing 'text' or file attachment for verification.");
             dataToHash = new TextEncoder().encode(params.text);
        }
      } else {
          throw new Error(`Unsupported action: ${action}`);
      }

      const algorithm = params.algorithm || 'SHA-256';
      
      let cryptoAlgo = algorithm;
      updateStatus(`Calculating ${algorithm} hash...`);
      
      const hashBuffer = await crypto.subtle.digest(cryptoAlgo as any, dataToHash);
      const hashArray = new Uint8Array(hashBuffer);
      const hashHex = new TextDecoder().decode(hexEncode(hashArray));

      if (action === 'verify_hash') {
          if (!params.hash_to_verify) {
              throw new Error("Missing 'hash_to_verify' parameter.");
          }
          const expected = params.hash_to_verify.toLowerCase().trim();
          const actual = hashHex.toLowerCase();
          const match = expected === actual;
          
          return {
              success: true,
              data: {
                  text: match ? `✅ Hash Verification Successful\n\nThe computed ${algorithm} hash matches the provided hash.\n\nHash: \`${actual}\`` 
                              : `❌ Hash Verification Failed\n\nThe computed ${algorithm} hash does NOT match the provided hash.\n\nExpected: \`${expected}\`\nActual: \`${actual}\``,
                  processingTimeMs: Date.now() - startTime
              }
          };
      }

      return {
          success: true,
          data: {
              text: `Here is your ${algorithm} hash:\n\n\`${hashHex}\``,
              processingTimeMs: Date.now() - startTime
          }
      };

    } catch (e: any) {
      return {
        success: false,
        error: { code: 'EXECUTION_ERROR', message: e.message || 'An error occurred.' },
        data: {
          text: `Failed to perform action: ${e.message}`,
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }
}
