const MAX_AVATAR_LENGTH = 180_000;

// The client converts photos to a small JPEG before transmission. Keep this
// limit on the server too, since callers can bypass the browser interface.
export function validProfileAvatar(value) {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH) return false;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[1].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[1], 'base64');
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}
