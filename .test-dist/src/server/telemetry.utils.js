const MAX_TELEMETRY_CONTEXT_KEYS = 12;
const MAX_TELEMETRY_KEY_LENGTH = 60;
const MAX_TELEMETRY_STRING_LENGTH = 200;
const BLOCKED_KEY_PATTERN = /(token|secret|password|cookie|authorization|auth|email)/i;
function normalizeTelemetryString(value) {
    return value.trim().slice(0, MAX_TELEMETRY_STRING_LENGTH);
}
function normalizeTelemetryValue(value) {
    if (value === null) {
        return null;
    }
    if (typeof value === 'string') {
        const normalized = normalizeTelemetryString(value);
        return normalized ? normalized : undefined;
    }
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    return undefined;
}
export function sanitizeTelemetryContext(context) {
    if (!context) {
        return undefined;
    }
    const entries = Object.entries(context)
        .filter(([key]) => key.trim() && key.length <= MAX_TELEMETRY_KEY_LENGTH)
        .filter(([key]) => !BLOCKED_KEY_PATTERN.test(key))
        .slice(0, MAX_TELEMETRY_CONTEXT_KEYS)
        .flatMap(([key, value]) => {
        const normalized = normalizeTelemetryValue(value);
        return normalized === undefined ? [] : [[key, normalized]];
    });
    if (entries.length === 0) {
        return undefined;
    }
    return Object.fromEntries(entries);
}
