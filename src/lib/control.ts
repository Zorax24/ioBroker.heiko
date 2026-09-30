export const DIRECT_COOLING_TARGET_MIN_C = 16;
export const DIRECT_COOLING_TARGET_MAX_C = 24;

export function normalizeControlNumber(value: unknown, fieldLabel: string): number {
    if (
        (typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))
    ) {
        throw new Error(`${fieldLabel} must be numeric / muss numerisch sein`);
    }
    const numeric = typeof value === 'number' ? value : Number(value.trim());
    if (!Number.isFinite(numeric)) {
        throw new Error(`${fieldLabel} must be numeric / muss numerisch sein`);
    }
    return numeric;
}

/**
 * Normalize the locally generated CMD05 cooling target.
 *
 * Values through 21 °C were captured from the official app. The extended
 * 22..24 °C range is intentionally limited to whole degrees and still only
 * succeeds when the heat pump reports the exact value in a fresh CMD02 frame.
 */
export function normalizeDirectCoolingTarget(value: unknown): number {
    const numeric = normalizeControlNumber(value, 'Cooling setpoint / Kühl-Solltemperatur');
    if (!Number.isInteger(numeric) || numeric < DIRECT_COOLING_TARGET_MIN_C || numeric > DIRECT_COOLING_TARGET_MAX_C) {
        throw new Error(
            `Direct cooling target must be a whole value from ${DIRECT_COOLING_TARGET_MIN_C} through ${DIRECT_COOLING_TARGET_MAX_C} °C / direkter Kühl-Sollwert muss eine ganze Zahl von ${DIRECT_COOLING_TARGET_MIN_C} bis ${DIRECT_COOLING_TARGET_MAX_C} °C sein`,
        );
    }
    return numeric;
}
