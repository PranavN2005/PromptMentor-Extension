import type {
  TelemetryEventName,
  TelemetryPayloadMap,
  TelemetryRecord,
  TelemetryEvent,
} from './events';
import { sanitizeTelemetryPayload } from './privacy';
import { ConsoleTelemetrySink, StorageTelemetrySink, type TelemetrySink } from './sinks';

type TelemetryDestination = 'console' | 'storage' | 'none';

interface TelemetryConfig {
  destination: TelemetryDestination;
  mirrorToConsole: boolean;
  debugEnabled: boolean;
}

const config: TelemetryConfig = {
  destination: 'console',
  mirrorToConsole: false,
  debugEnabled: false,
};

const sinks: Record<Exclude<TelemetryDestination, 'none'>, TelemetrySink> = {
  console: new ConsoleTelemetrySink(),
  storage: new StorageTelemetrySink(),
};

const sessionId =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function configureTelemetry(partial: Partial<TelemetryConfig>): void {
  Object.assign(config, partial);
}

export function trackTelemetryEvent<K extends TelemetryEventName>(
  name: K,
  payload: TelemetryPayloadMap[K]
): void {
  const event: TelemetryEvent<K> = { name, payload };
  const record: TelemetryRecord<K> = {
    ...event,
    payload: sanitizeTelemetryPayload(
      event.payload as Record<string, unknown>
    ) as TelemetryPayloadMap[K],
    sessionId,
    timestamp: new Date().toISOString(),
  };

  publish(record, config.destination);

  if (config.mirrorToConsole && config.destination !== 'console') {
    publish(record, 'console');
  }
}

export function debugLog(message: string, context?: Record<string, unknown>): void {
  if (!config.debugEnabled) {
    return;
  }

  if (context) {
    console.debug('[PromptMentor Debug]', message, context);
    return;
  }

  console.debug('[PromptMentor Debug]', message);
}

function publish(record: TelemetryRecord, destination: TelemetryDestination): void {
  if (destination === 'none') {
    return;
  }

  const sink = sinks[destination];

  try {
    const maybePromise = sink.publish(record);
    if (maybePromise && typeof (maybePromise as Promise<void>).catch === 'function') {
      void (maybePromise as Promise<void>).catch(error => {
        debugLog('Telemetry sink publish failed', {
          destination,
          error: String(error),
        });
      });
    }
  } catch (error) {
    debugLog('Telemetry sink threw synchronously', {
      destination,
      error: String(error),
    });
  }
}
