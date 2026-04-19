// Purpose: parse request Cookie headers without extra dependencies.
const parseCookieHeader = (cookieHeader) => {
  if (!cookieHeader || typeof cookieHeader !== "string") return {};

  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const equalsIndex = part.indexOf("=");
      if (equalsIndex <= 0) return accumulator;

      const key = part.slice(0, equalsIndex).trim();
      const value = part.slice(equalsIndex + 1).trim();

      if (!key) return accumulator;

      try {
        accumulator[key] = decodeURIComponent(value);
      } catch (_error) {
        accumulator[key] = value;
      }
      return accumulator;
    }, {});
};

const getCookie = (req, cookieName) => {
  if (!req || !cookieName) return undefined;
  const cookies = parseCookieHeader(req.headers?.cookie);
  return cookies[cookieName];
};

export { parseCookieHeader, getCookie };
