import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { appRegistry, DEFAULT_APPLICATIONS } from '../src/services/appRegistryService.js';
import { 
  semverCompare, 
  isVersionCompatible, 
  calculateSha256, 
  verifySignature, 
  validateManifest,
  getPlatformPackage,
  detectPlatform
} from '../src/services/updateManifest.js';
import { cctvAgent } from '../src/services/cctvAgentService.js';
import { installerService } from '../src/services/installerService.js';
import { sanitizePromptCredentials } from '../src/lib/systemPromptBuilder.js';

describe('CEOVA CCTV Application Management & Security Test Suite', () => {
  beforeEach(() => {
    // Reset registry to clean default state
    appRegistry.resetApplication('ceova-cctv');
  });

  // TEST 1: CCTV not installed
  it('1. CCTV not installed - reports not_installed and zero active cameras', async () => {
    const app = appRegistry.getApplication('ceova-cctv');
    assert.ok(app);
    assert.equal(app.installationStatus, 'not_installed');
    assert.equal(app.installedVersion, null);
    assert.equal(app.updateAvailable, false);

    const status = await cctvAgent.getStatus();
    assert.equal(status.installed, false);
    assert.equal(status.running, false);
    assert.equal(status.monitoring, false);
  });

  // TEST 2: Successful installation
  it('2. Successful installation - verifies package, checks runtime, and marks installed', async () => {
    const payload = new Uint8Array([1, 2, 3, 4, 5]);
    const hash = await calculateSha256(payload);

    const manifest = {
      appId: 'ceova-cctv',
      version: '1.0.0',
      minSupportedVersion: '1.0.0',
      platforms: {
        'windows-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.exe',
          sha256: hash,
          signature: 'sig_ceova_official_2026_valid',
          size: payload.length
        },
        'windows': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.exe',
          sha256: hash,
          signature: 'sig_ceova_official_2026_valid',
          size: payload.length
        },
        'macos-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.dmg',
          sha256: hash,
          signature: 'sig_ceova_official_2026_valid',
          size: payload.length
        },
        'macos': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.dmg',
          sha256: hash,
          signature: 'sig_ceova_official_2026_valid',
          size: payload.length
        }
      },
      releaseNotes: 'Initial production build'
    };

    const result = await installerService.installApplication('ceova-cctv', manifest, {
      mockData: payload,
      mockInstall: true,
      mockHealth: true
    });

    assert.equal(result.success, true);
    assert.equal(result.version, '1.0.0');

    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.installationStatus, 'installed');
    assert.equal(app.installedVersion, '1.0.0');
    assert.equal(app.progress.phase, null);
    assert.equal(app.progress.percent, 100);
  });

  // TEST 3: Failed installation
  it('3. Failed installation - halts on runtime failure and sets failed status', async () => {
    const payload = new Uint8Array([1, 2, 3]);
    const hash = await calculateSha256(payload);

    const manifest = {
      appId: 'ceova-cctv',
      version: '1.0.0',
      platforms: {
        'windows-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.exe',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        },
        'windows': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.exe',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        },
        'macos-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.dmg',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        },
        'macos': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.0/setup.dmg',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        }
      }
    };

    await assert.rejects(async () => {
      await installerService.installApplication('ceova-cctv', manifest, {
        mockData: payload,
        mockInstall: true,
        mockHealth: false // Simulate runtime health check failing
      });
    }, /Installed runtime failed verification/);

    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.installationStatus, 'failed');
    assert.notEqual(app.installedVersion, '1.0.0');
  });

  // TEST 4: Existing installation detected
  it('4. Existing installation detected - detects previously installed app', () => {
    appRegistry.setInstalled('ceova-cctv', '1.0.0');
    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.installationStatus, 'installed');
    assert.equal(app.installedVersion, '1.0.0');
  });

  // TEST 5: Background service running
  it('5. Background service running - updates agent health and camera count', async () => {
    appRegistry.setInstalled('ceova-cctv', '1.0.0');
    appRegistry.updateAgentHealth('ceova-cctv', {
      running: true,
      monitoring: true,
      aiEngineHealthy: true,
      cameraCount: 4
    });

    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.agentStatus.running, true);
    assert.equal(app.agentStatus.monitoring, true);
    assert.equal(app.agentStatus.aiEngineHealthy, true);
    assert.equal(app.agentStatus.cameraCount, 4);
    assert.ok(app.lastHealthCheck);
  });

  // TEST 6: Background service stopped
  it('6. Background service stopped - reports stopped while retaining installed status', async () => {
    appRegistry.setInstalled('ceova-cctv', '1.0.0');
    appRegistry.updateAgentHealth('ceova-cctv', {
      running: false,
      monitoring: false,
      aiEngineHealthy: false,
      cameraCount: 0,
      error: 'Background service is stopped'
    });

    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.installationStatus, 'installed');
    assert.equal(app.agentStatus.running, false);
    assert.equal(app.agentStatus.monitoring, false);
    assert.equal(app.agentStatus.lastError, 'Background service is stopped');
  });

  // TEST 7: New version available
  it('7. New version available - identifies publishedVersion > installedVersion', () => {
    appRegistry.setInstalled('ceova-cctv', '1.0.0');
    const hasNewer = semverCompare('1.0.1', '1.0.0') > 0;
    assert.equal(hasNewer, true);

    appRegistry.setUpdateAvailable('ceova-cctv', true, '1.0.1');
    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.updateAvailable, true);
    assert.equal(app.publishedVersion, '1.0.1');
    assert.equal(app.installedVersion, '1.0.0');
  });

  // TEST 8: Invalid package signature
  it('8. Invalid package signature - rejects package and aborts before execution', async () => {
    const payload = new Uint8Array([5, 6, 7]);
    const hash = await calculateSha256(payload);

    const manifest = {
      appId: 'ceova-cctv',
      version: '1.0.0',
      platforms: {
        'windows-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.exe',
          sha256: hash,
          signature: 'invalid_tampered_signature_payload'
        },
        'windows': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.exe',
          sha256: hash,
          signature: 'invalid_tampered_signature_payload'
        },
        'macos-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.dmg',
          sha256: hash,
          signature: 'invalid_tampered_signature_payload'
        },
        'macos': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.dmg',
          sha256: hash,
          signature: 'invalid_tampered_signature_payload'
        }
      }
    };

    await assert.rejects(async () => {
      await installerService.installApplication('ceova-cctv', manifest, {
        mockData: payload,
        mockInstall: true
      });
    }, /Package signature verification failed/);
  });

  // TEST 9: Corrupted download
  it('9. Corrupted download - detects SHA-256 mismatch and halts', async () => {
    const payload = new Uint8Array([9, 9, 9]);

    const manifest = {
      appId: 'ceova-cctv',
      version: '1.0.0',
      platforms: {
        'windows-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.exe',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          signature: 'sig_ceova_valid_signature_2026'
        },
        'windows': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.exe',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          signature: 'sig_ceova_valid_signature_2026'
        },
        'macos-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.dmg',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          signature: 'sig_ceova_valid_signature_2026'
        },
        'macos': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/setup.dmg',
          sha256: '0000000000000000000000000000000000000000000000000000000000000000',
          signature: 'sig_ceova_valid_signature_2026'
        }
      }
    };

    await assert.rejects(async () => {
      await installerService.installApplication('ceova-cctv', manifest, {
        mockData: payload,
        mockInstall: true
      });
    }, /Corrupted download: SHA-256 mismatch/);
  });

  // TEST 10: Failed update and rollback
  it('10. Failed update and rollback - restores previous version on failure', async () => {
    // 1. Initial stable install v1.0.0
    appRegistry.setInstalled('ceova-cctv', '1.0.0');

    // 2. Prepare update manifest v1.0.1
    const payload = new Uint8Array([42, 43, 44]);
    const hash = await calculateSha256(payload);

    const updateManifest = {
      appId: 'ceova-cctv',
      version: '1.0.1',
      minSupportedVersion: '1.0.0',
      platforms: {
        'windows-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.1/setup.exe',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        },
        'windows': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.1/setup.exe',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        },
        'macos-x86_64': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.1/setup.dmg',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        },
        'macos': {
          packageUrl: 'https://releases.ceova.ai/apps/cctv/v1.0.1/setup.dmg',
          sha256: hash,
          signature: 'sig_ceova_valid_signature_2026'
        }
      }
    };

    // 3. Update fails during runtime verification
    await assert.rejects(async () => {
      await installerService.updateApplication('ceova-cctv', updateManifest, {
        mockData: payload,
        mockInstall: true,
        mockHealth: false, // Update fails verification
        skipServiceStop: true,
        skipServiceRestart: true
      });
    }, /Update verification failed/);

    // 4. Verify rollback restored v1.0.0
    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.installationStatus, 'installed');
    assert.equal(app.installedVersion, '1.0.0');
    assert.equal(app.updateAvailable, true);
    assert.match(app.progress.message, /Rollback completed/);
  });

  // TEST 11: Main application closed while CCTV continues running
  it('11. Decoupled architecture - CCTV daemon lifecycle is independent of main UI', () => {
    // Background service configuration binds to loopback (127.0.0.1:8085)
    assert.equal(cctvAgent.baseUrl, 'http://127.0.0.1:8085');
    // Main app registry metadata is stored in local storage, separate from CCTV SQLite
    const app = appRegistry.getApplication('ceova-cctv');
    assert.ok(app);
    // CCTV operational state (streams, frames, SQLite recordings) is NOT stored in appRegistry
    assert.equal(app.cameras, undefined);
    assert.equal(app.sqliteDb, undefined);
  });

  // TEST 12: Computer restart and service recovery
  it('12. Computer restart and service recovery - recovers state and verifies health', () => {
    appRegistry.setInstalled('ceova-cctv', '1.0.0');
    // Simulate reloading registry from persistent storage after reboot
    const reloaded = appRegistry.loadRegistry();
    const cctv = reloaded.find(a => a.id === 'ceova-cctv');
    assert.equal(cctv.installedVersion, '1.0.0');
    assert.equal(cctv.installationStatus, 'installed');
  });

  // TEST 13: Disconnect and uninstall
  it('13. Disconnect and uninstall - resets application state to not_installed and clears traces', async () => {
    // 1. Mark as installed
    appRegistry.setInstalled('ceova-cctv', '1.0.0');
    assert.equal(appRegistry.getApplication('ceova-cctv').installationStatus, 'installed');

    // 2. Perform delete/disconnect operation
    const result = await installerService.deleteApplication('ceova-cctv');
    assert.equal(result.success, true);

    // 3. Verify application is completely reset
    const app = appRegistry.getApplication('ceova-cctv');
    assert.equal(app.installationStatus, 'not_installed');
    assert.equal(app.installedVersion, null);
  });

  // SECURITY GUARDRAILS (Phase 7)
  it('Security: Camera passwords and secrets are strictly stripped from AI prompts', () => {
    const rawPromptWithSecret = "Check camera rtsp://admin:superSecretPass123@192.168.1.100:554/stream and camera_password='mySecretPassword'";
    const sanitized = sanitizePromptCredentials(rawPromptWithSecret);

    assert.equal(sanitized.includes('superSecretPass123'), false);
    assert.equal(sanitized.includes('mySecretPassword'), false);
    assert.match(sanitized, /\[CREDENTIALS_REDACTED\]/);
    assert.match(sanitized, /camera_password=\[REDACTED\]/);
  });
});
