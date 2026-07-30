const EARTH_RADIUS_MI = 3958.8;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMilesBetween(
  from: { latitude: number; longitude: number } | null,
  to: { latitude: number; longitude: number } | null
) {
  if (!from || !to) {
    return null;
  }

  const lat1 = toRadians(from.latitude);
  const lon1 = toRadians(from.longitude);
  const lat2 = toRadians(to.latitude);
  const lon2 = toRadians(to.longitude);

  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MI * c;
}

export function formatDistanceMiles(value: number | null) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }

  if (value < 10) {
    return `${value.toFixed(1)} mi`;
  }

  return `${Math.round(value)} mi`;
}
