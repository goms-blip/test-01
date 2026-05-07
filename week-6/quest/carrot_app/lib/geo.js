// 위치 → 한국 지역명 변환
// week-3/goblin/weather-app 에서 검증된 OpenWeatherMap reverse geocoding 패턴 재사용

const OWM_KEY = process.env.NEXT_PUBLIC_OPENWEATHER_API_KEY || '';
const REV_GEO = 'https://api.openweathermap.org/geo/1.0/reverse';

export async function reverseGeocodeKo(lat, lon) {
  if (!OWM_KEY) throw new Error('NEXT_PUBLIC_OPENWEATHER_API_KEY 미설정');
  const res = await fetch(`${REV_GEO}?lat=${lat}&lon=${lon}&limit=1&appid=${OWM_KEY}`);
  if (!res.ok) throw new Error(`reverse geocode HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || !data[0]) throw new Error('지역 정보 없음');
  return data[0].local_names?.ko || data[0].name || null;
}

export function detectKoreanRegion() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('이 브라우저는 위치 감지를 지원하지 않습니다'));
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const name = await reverseGeocodeKo(pos.coords.latitude, pos.coords.longitude);
          resolve(name || `${pos.coords.latitude.toFixed(3)},${pos.coords.longitude.toFixed(3)}`);
        } catch (e) {
          reject(e);
        }
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) reject(new Error('위치 권한이 거부되었습니다'));
        else if (err.code === err.TIMEOUT) reject(new Error('위치 감지 시간 초과'));
        else reject(new Error('위치를 가져올 수 없습니다'));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60_000 },
    );
  });
}
