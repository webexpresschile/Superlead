import { NextRequest, NextResponse } from 'next/server'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export async function GET(req: NextRequest) {
  const format = escapeHtml(req.nextUrl.searchParams.get('format') || 'banner')
  const widthParam = req.nextUrl.searchParams.get('width') || '300'
  const heightParam = req.nextUrl.searchParams.get('height') || '250'

  // Strict numeric validation for width/height
  const width = /^\d+$/.test(widthParam) ? parseInt(widthParam) : 300
  const height = /^\d+$/.test(heightParam) ? parseInt(heightParam) : 250

  const ADSTERRA_UID = process.env.ADSTERRA_API_KEY || ''
  const ADSTERRA_ZONE = process.env.ADSTERRA_ZONE || ''

  if (ADSTERRA_ZONE) {
    const safeZone = escapeHtml(ADSTERRA_ZONE)
    const safeUid = escapeHtml(ADSTERRA_UID)
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif}</style>
</head><body>
<script type="text/javascript">
  var adsterra_zone = '${safeZone.replace(/'/g, "\\'")}';
  var adsterra_banner = '${Math.random().toString(36).slice(2, 8)}';
  var adsterra_width = ${width};
  var adsterra_height = ${height};
  var adsterra_uid = '${safeUid.replace(/'/g, "\\'")}';
</script>
<script type="text/javascript" src="//app.adsterra.com/js/ad.js" defer></script>
</body></html>`
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "frame-ancestors *",
      },
    })
  }

  if (ADSTERRA_UID) {
    const safeUid = escapeHtml(ADSTERRA_UID)
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif;flex-direction:column;gap:8px;padding:8px}</style>
</head><body>
<script type="text/javascript">
  var uid = '${safeUid.replace(/'/g, "\\'")}';
  var width = ${width};
  var height = ${height};
</script>
<script type="text/javascript" src="https://cdn.adsterra.com/ad.js" defer></script>
<p style="font-size:10px;color:#999;margin-top:4px;text-align:center;">Publicidad</p>
</body></html>`
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'ALLOWALL',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "frame-ancestors *",
      },
    })
  }

  // Fallback
  const fallback = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f5f5f5;font-family:sans-serif;flex-direction:column;gap:8px}</style>
</head><body>
<div style="width:${width}px;height:${height}px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#e5e5e5;border:1px dashed #ccc;border-radius:8px;">
  <span style="font-size:32px;">📺</span>
  <p style="font-size:12px;color:#999;">Adsterra — Configura ADSTERRA_ZONE</p>
</div>
<p style="font-size:10px;color:#999;">Publicidad</p>
</body></html>`
  return new NextResponse(fallback, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Frame-Options': 'ALLOWALL',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "frame-ancestors *",
    },
  })
}
