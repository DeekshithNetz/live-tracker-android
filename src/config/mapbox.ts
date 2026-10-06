import Mapbox from '@rnmapbox/maps';

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (!token) {
  throw new Error(
    'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN is missing'
  );
}

Mapbox.setAccessToken(token);