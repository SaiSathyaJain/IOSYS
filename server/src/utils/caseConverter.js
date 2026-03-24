/**
 * Convert snake_case keys to camelCase.
 * Works on a single object or an array of objects.
 */
function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function toCamelCase(input) {
    if (Array.isArray(input)) {
        return input.map(toCamelCase);
    }
    if (input && typeof input === 'object') {
        return Object.fromEntries(
            Object.entries(input).map(([key, value]) => [snakeToCamel(key), value])
        );
    }
    return input;
}
