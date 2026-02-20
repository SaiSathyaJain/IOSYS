export function toCamelCase(data) {
  if (Array.isArray(data)) {
    return data.map(item => toCamelCase(item));
  }
  if (data !== null && typeof data === 'object') {
    return Object.keys(data).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      acc[camelKey] = toCamelCase(data[key]);
      return acc;
    }, {});
  }
  return data;
}

export function toSnakeCase(data) {
  if (data !== null && typeof data === 'object') {
    return Object.keys(data).reduce((acc, key) => {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      acc[snakeKey] = data[key];
      return acc;
    }, {});
  }
  return data;
}
