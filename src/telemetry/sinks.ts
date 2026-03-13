import type { TelemetryRecord } from './events';

const TELEMETRY_STORAGE_KEY = 'promptMentorTelemetryEvents';
const TELEMETRY_STORAGE_LIMIT = 250;

export interface TelemetrySink {
  publish(record: TelemetryRecord): void | Promise<void>;
}

export class ConsoleTelemetrySink implements TelemetrySink {
  publish(record: TelemetryRecord): void {
    console.info('[PromptMentor Telemetry]', record);
  }
}

export class StorageTelemetrySink implements TelemetrySink {
  async publish(record: TelemetryRecord): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }

    const existing = await chrome.storage.local.get([TELEMETRY_STORAGE_KEY]);
    const current = Array.isArray(existing[TELEMETRY_STORAGE_KEY])
      ? existing[TELEMETRY_STORAGE_KEY]
      : [];

    const next = [...current, record].slice(-TELEMETRY_STORAGE_LIMIT);
    await chrome.storage.local.set({ [TELEMETRY_STORAGE_KEY]: next });
  }
}
