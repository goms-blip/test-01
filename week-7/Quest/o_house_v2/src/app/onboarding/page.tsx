"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HOME_TYPES } from "@/lib/types";

const PROVINCE_SHORT: Record<string, string> = {
  "서울특별시": "서울", "부산광역시": "부산", "대구광역시": "대구", "인천광역시": "인천",
  "광주광역시": "광주", "대전광역시": "대전", "울산광역시": "울산", "세종특별자치시": "세종",
  "경기도": "경기", "강원도": "강원", "강원특별자치도": "강원",
  "충청북도": "충북", "충청남도": "충남",
  "전라북도": "전북", "전라남도": "전남", "전북특별자치도": "전북",
  "경상북도": "경북", "경상남도": "경남", "제주특별자치도": "제주",
};

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [homeType, setHomeType] = useState(HOME_TYPES[0]);
  const [areaPyeong, setAreaPyeong] = useState(20);
  const [region, setRegion] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoMsg, setGeoMsg] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      setUserId(user.id);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (p) {
        setHomeType(p.home_type ?? HOME_TYPES[0]);
        setAreaPyeong(p.area_pyeong ?? 20);
        setRegion(p.region ?? "");
      }
    })();
  }, [router]);

  const onUseLocation = () => {
    setGeoMsg("");
    if (!("geolocation" in navigator)) { setGeoMsg("이 브라우저에서는 위치 정보를 사용할 수 없어요."); return; }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=12&addressdetails=1&accept-language=ko`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("geocode failed");
        const a = (await res.json()).address ?? {};
        const provinceRaw = a.province || a.state || a.region || a.city || "";
        const province = PROVINCE_SHORT[provinceRaw] ?? provinceRaw.replace(/(특별시|광역시|특별자치도|특별자치시|도)$/, "");
        const district = a.borough || a.city_district || a.county || a.city || a.town || a.municipality || a.suburb || "";
        const label = [province, district].filter(Boolean).join(" ").trim();
        if (label) setRegion(label); else setGeoMsg("주소를 찾지 못했어요.");
      } catch { setGeoMsg("위치 변환에 실패했어요."); }
      finally { setGeoBusy(false); }
    }, (e) => { setGeoBusy(false); setGeoMsg(e.code === e.PERMISSION_DENIED ? "위치 권한이 거부되어 자동 입력을 못 했어요." : "위치를 가져오지 못했어요."); }, { enableHighAccuracy: false, timeout: 8000 });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setBusy(true);
    const supabase = createClient();
    await supabase.from("profiles").update({ home_type: homeType, area_pyeong: Number(areaPyeong), region }).eq("id", userId);
    router.refresh();
    router.push("/");
  };

  return (
    <div className="max-w-md mx-auto py-12">
      <h1 className="text-2xl font-black mb-1">거주 정보를 알려주세요</h1>
      <p className="text-sm text-zinc-500 mb-6">비슷한 공간 인테리어를 추천해드려요.</p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="label">주거 형태</label>
          <select className="input" value={homeType} onChange={(e) => setHomeType(e.target.value)}>
            {HOME_TYPES.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </div>
        <div>
          <label className="label">평수</label>
          <input className="input" type="number" min={1} max={199} value={areaPyeong} onChange={(e) => setAreaPyeong(Number(e.target.value))} />
        </div>
        <div>
          <label className="label">지역 (선택)</label>
          <div className="flex gap-2">
            <input className="input flex-1" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="예) 서울 마포구" />
            <button type="button" onClick={onUseLocation} disabled={geoBusy} className="btn btn-outline whitespace-nowrap">{geoBusy ? "확인 중…" : "📍 현재 위치"}</button>
          </div>
          {geoMsg && <p className="text-xs text-zinc-500 mt-1">{geoMsg}</p>}
        </div>
        <div className="flex justify-between pt-3">
          <button type="button" onClick={() => router.push("/")} className="btn btn-ghost">나중에 할게요</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "저장 중…" : "저장"}</button>
        </div>
      </form>
    </div>
  );
}
