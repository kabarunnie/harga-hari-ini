#!/usr/bin/env python3
"""Fetch official Bank Indonesia rates. Never invent numbers.
If a fetch fails, keep the last file and stamp the failure — do not overwrite good values with guesses.
Fuel prices: only write items when a reliable official feed exists (currently not).
"""
from __future__ import annotations

import json, re, ssl, urllib.request
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "app/data/prices.json"
WIB = timezone(timedelta(hours=7))
CTX = ssl.create_default_context()
UA = {"User-Agent": "HargaHariIni/1.0 (https://kabarunnie.github.io/harga-hari-ini/)"}


def get(url: str) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
        return r.read().decode("utf-8", "replace")


def tables(xml: str):
    return re.findall(r"<Table[^>]*>(.*?)</Table>", xml, re.S)


def gv(block: str, tag: str) -> str:
    m = re.search(rf"<{tag}>(.*?)</{tag}>", block)
    return m.group(1).strip() if m else ""


def load_prev():
    if OUT.exists():
        try:
            return json.loads(OUT.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}


def latest_jisdor():
    end = datetime.now(WIB).date()
    start = end - timedelta(days=21)
    xml = get(
        "https://www.bi.go.id/biwebservice/wskursbi.asmx/getSubKursJisdor3"
        f"?mts=USD&startDate={start.isoformat()}&endDate={end.isoformat()}"
    )
    rows = []
    for b in tables(xml):
        rows.append({
            "date": gv(b, "tgl_subkursasing"),
            "unit": float(gv(b, "nil_subkursasing") or 1),
            "value": float(gv(b, "beli_subkursasing")),
        })
    rows.sort(key=lambda r: r["date"])
    if not rows:
        raise RuntimeError("JISDOR empty")
    return rows


def transaksi_on(day: date):
    xml = get(
        f"https://www.bi.go.id/biwebservice/wskursbi.asmx/getSubKursLokal2?tgl={day.isoformat()}"
    )
    rows = []
    for b in tables(xml):
        rows.append({
            "code": gv(b, "mts_subkurslokal").strip(),
            "unit": float(gv(b, "nil_subkurslokal") or 1),
            "beli": float(gv(b, "beli_subkurslokal")),
            "jual": float(gv(b, "jual_subkurslokal")),
            "date": gv(b, "tgl_subkurslokal"),
            "source": "Bank Indonesia — Kurs Transaksi",
            "sourceUrl": "https://www.bi.go.id/id/statistik/informasi-kurs/transaksi-bi/Default.aspx",
        })
    return rows


def main():
    prev = load_prev()
    now = datetime.now(WIB).isoformat(timespec="seconds")
    payload = json.loads(json.dumps(prev)) if prev else {}
    payload.setdefault("notes", [])
    payload["timezone"] = "Asia/Jakarta"
    payload["updatedAt"] = now
    errors = []

    try:
        hist = latest_jisdor()
        last = hist[-1]
        payload["jisdorUsd"] = {
            "code": "USD",
            "unit": last["unit"],
            "value": last["value"],
            "date": last["date"],
            "source": "Bank Indonesia — JISDOR (Jakarta Interbank Spot Dollar Rate)",
            "sourceUrl": "https://www.bi.go.id/id/statistik/informasi-kurs/jisdor/Default.aspx",
            "history": hist[-7:],
        }
    except Exception as e:
        errors.append(f"JISDOR: {type(e).__name__}: {e}")
        # keep previous jisdorUsd as-is

    found = []
    today = datetime.now(WIB).date()
    try:
        for i in range(0, 12):
            day = today - timedelta(days=i)
            rows = transaksi_on(day)
            if len(rows) >= 5:
                found = rows
                break
        if found:
            payload["transaksi"] = found
        else:
            errors.append("Kurs transaksi: tidak ada data pada 12 hari terakhir")
    except Exception as e:
        errors.append(f"Kurs transaksi: {type(e).__name__}: {e}")

    # BBM: do not invent. Keep previous lastVerified/items if any; otherwise unavailable.
    bbm = payload.get("bbm") or {}
    if not bbm.get("items"):
        payload["bbm"] = {
            "status": "unavailable",
            "reason": "Sumber resmi Pertamina (https://www.pertamina.com/id/harga-bbm-terkini) merender harga secara dinamis dan tidak menyediakan API publik tanpa kunci. Angka tidak diisi dari berita.",
            "sourceUrl": "https://www.pertamina.com/id/harga-bbm-terkini",
            "items": [],
            "lastVerified": bbm.get("lastVerified"),
        }
    payload["fetchErrors"] = errors
    payload["status"] = "ok" if not errors else "partial"
    notes = [
        "Kurs USD JISDOR dan Kurs Transaksi diambil dari web service resmi Bank Indonesia.",
        "Nilai tidak diubah. Jika pengambilan gagal, nilai terakhir yang berhasil diambil tetap ditampilkan beserta tanggalnya.",
        "Harga BBM otomatis belum tersedia dari umpan resmi yang andal. Tidak ada angka BBM yang disusun atau dikira-kira.",
    ]
    payload["notes"] = notes
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", OUT, "status", payload["status"], "errors", errors)


if __name__ == "__main__":
    main()
