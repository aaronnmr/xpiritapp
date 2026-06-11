export type RoutePoint = {
  latitude: number;
  longitude: number;
};

export function decodePolyline(polyline?: string | null): RoutePoint[] {
  if (!polyline) {
    return [];
  }

  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates: RoutePoint[] = [];

  while (index < polyline.length) {
    const latResult = decodeValue(polyline, index);
    index = latResult.nextIndex;
    latitude += latResult.value;

    const lngResult = decodeValue(polyline, index);
    index = lngResult.nextIndex;
    longitude += lngResult.value;

    coordinates.push({
      latitude: latitude / 1e5,
      longitude: longitude / 1e5
    });
  }

  return coordinates;
}

function decodeValue(polyline: string, startIndex: number) {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte = 0;

  do {
    byte = polyline.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    nextIndex: index,
    value: result & 1 ? ~(result >> 1) : result >> 1
  };
}

export function pointsToSvgPath(points: RoutePoint[], width: number, height: number) {
  if (points.length === 0) {
    return "";
  }

  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const latitudeRange = maxLatitude - minLatitude || 1;
  const longitudeRange = maxLongitude - minLongitude || 1;
  const inset = 18;

  return points
    .map((point, index) => {
      const x = inset + ((point.longitude - minLongitude) / longitudeRange) * (width - inset * 2);
      const y = inset + (1 - (point.latitude - minLatitude) / latitudeRange) * (height - inset * 2);

      return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}
