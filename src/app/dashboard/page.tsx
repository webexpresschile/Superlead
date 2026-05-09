'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Target, Loader2, ExternalLink, Zap, X, Play } from 'lucide-react'

const ADSTERRA_SCRIPT = `
<!-- Adsterra ad placeholder -->
<div style="width:300px;height:250px;margin:0 auto;">
  <iframe
    src="about:blank"
    style="width:300px;height:250px;border:none;"
    title="Ad"
    sandbox="allow-scripts allow-same-origin"
  ></iframe>
  <p style="font-size:10px;color:#999;text-align:center;margin-top:2px;">Publicidad</p>
</div>
`

interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
  website: string | null
  address: string | null
  rating: number | null
  enriched_category: string | null
  competition_level: string
  facebook_url: string | null
  instagram_url: string | null
  has_facebook: boolean
  has_instagram: boolean
  distance_km: number | null
  search_id: string
}

export default function Dashboard() {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [referencePoint, setReferencePoint] = useState('')
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [credits, setCredits] = useState({
    used: 0,
    limit: 50,
    used_today: 0,
    daily_limit: 7,
    base_daily: 7,
  })
  const [adsWatched, setAdsWatched] = useState(0)
  const [showAdModal, setShowAdModal] = useState(false)
  const [adWatching, setAdWatching] = useState(false)
  const [adCountdown, setAdCountdown] = useState(15)
  const [adMessage, setAdMessage] = useState('')

  useEffect(() => {
    if (isSignedIn) {
      loadLeads()
      loadCredits()
    }
  }, [isSignedIn])

  async function loadLeads() {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ format: 'json' }),
    })
    const data = await res.json()
    if (data.leads) setLeads(data.leads)
  }

  async function loadCredits() {
    const token = await getToken()
    if (!token) return
    const { data } = await supabase
      .from('users')
      .select('credits_used, credits_limit, credits_used_today, daily_limit, ads_watched_today, ads_extra_daily')
      .eq('auth_id', user?.id)
      .single()
    if (data) {
      const baseDaily = data.daily_limit ?? 7
      const adExtra = data.ads_extra_daily ?? 0
      setCredits({
        used: data.credits_used ?? 0,
        limit: data.credits_limit ?? 50,
        used_today: data.credits_used_today ?? 0,
        daily_limit: baseDaily + adExtra,
        base_daily: baseDaily,
      })
      setAdsWatched(data.ads_watched_today ?? 0)
    }
  }

  const maxAdsReached = adsWatched >= 2
  const effectiveDailyLimit = credits.daily_limit
  const remainingToday = effectiveDailyLimit - credits.used_today

  async function handleAdWatch() {
    setAdWatching(true)
    setAdCountdown(15)
    setAdMessage('')

    // Countdown timer
    const timer = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // After 15 seconds (simulated ad duration)
    setTimeout(async () => {
      clearInterval(timer)
      try {
        const token = await getToken()
        const res = await fetch('/api/credits/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (data.success) {
          setCredits(prev => ({
            ...prev,
            daily_limit: data.effective_daily_limit,
          }))
          setAdsWatched(data.ads_watched_today)
          setAdMessage(`🎉 ¡+${data.extra_credits} créditos diarios extra!`)
        } else {
          setAdMessage(data.error || 'Error al desbloquear')
        }
      } catch (e: any) {
        setAdMessage(e.message || 'Error al desbloquear')
      }
      setAdWatching(false)
    }, 15000)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!keyword.trim()) { setError('Ingresa un rubro'); return }
    if (!location.trim()) { setError('Ingresa una ubicación'); return }
    if (limit < 1 || limit > 60) { setError('La cantidad debe ser entre 1 y 60'); return }

    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword, location, limit, reference_point: referencePoint || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error al buscar')

      // Update credits from response
      if (data.credits) {
        setCredits(prev => ({
          ...prev,
          used: data.credits.used,
          limit: data.credits.limit,
          used_today: data.credits.used_today,
          daily_limit: data.credits.daily_limit,
          base_daily: data.credits.base_daily || prev.base_daily,
        }))
      }
      setLeads(prev => [...data.leads, ...prev])
    } catch (e: any) {
      if (e.message.includes('diario')) {
        setError('📅 Límite diario alcanzado. ¡Ve el botón dorado y desbloquea +7 créditos viendo un anuncio!')
      } else {
        setError(e.message)
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ format: 'csv' }),
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'superlead-leads.csv'
    a.click()
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader className="text-center">
            <Target className="w-10 h-10 text-blue-600 mx-auto mb-2" />
            <CardTitle>Inicia sesión</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SignInButton mode="modal">
              <Button className="w-full">Continuar con Google</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Ad Modal with Adsterra
  const AdModal = () => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => !adWatching && setShowAdModal(false)}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {!adWatching && adMessage === '' && (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">Desbloquea +7 créditos diarios</h3>
                <p className="text-gray-500 text-sm mt-1">Mira este anuncio y obtén más búsquedas hoy</p>
              </div>
              <button onClick={() => setShowAdModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ad preview */}
            <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 my-4 flex flex-col items-center justify-center min-h-[200px]">
              <div className="text-4xl mb-2">📺</div>
              <p className="text-gray-500 text-sm font-medium">Publicidad</p>
              <p className="text-xs text-gray-400 mt-1">300x250 · Adsterra</p>
              <div className="mt-3 w-full h-[1px] bg-gray-200" />
              <p className="text-[10px] text-gray-300 mt-3">Al ver este anuncio apoyas Superlead gratis</p>
            </div>

            {credits.base_daily && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-center">
                <p className="text-sm text-amber-800">
                  Hoy: <strong>{credits.base_daily}/{credits.base_daily}</strong> → <strong>{credits.base_daily + 7}/{credits.base_daily + 7}</strong> (1er anuncio)
                </p>
                <p className="text-xs text-amber-600 mt-1">Máximo 2 anuncios/día = +14 créditos</p>
              </div>
            )}

            <Button onClick={handleAdWatch} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold text-lg py-6 shadow-lg">
              <Play className="w-5 h-5 mr-2" />
              Ver anuncio (15 seg)
            </Button>
          </>
        )}

        {adWatching && (
          <div className="text-center">
            <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 my-4 flex flex-col items-center justify-center min-h-[200px]">
              <div className="text-5xl mb-3">▶️</div>
              <p className="font-bold text-gray-800 mb-2">Reproduciendo anuncio...</p>
              <p className="text-xs text-gray-400 mb-4">Gracias por tu atención</p>
              <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                <div
                  className="h-4 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-all duration-1000"
                  style={{ width: `${((15 - adCountdown) / 15) * 100}%` }}
                />
              </div>
              <p className="text-sm text-amber-600 font-medium">{adCountdown} segundos</p>
            </div>
          </div>
        )}

        {adMessage !== '' && !adWatching && (
          <div className="text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 my-4">
              <div className="text-5xl mb-2">✅</div>
              <p className="text-green-800 font-bold text-lg">{adMessage}</p>
              <p className="text-xs text-green-600 mt-2">
                Límite diario: {effectiveDailyLimit} créditos
              </p>
            </div>
            <Button onClick={() => { setShowAdModal(false); setAdMessage('') }} className="w-full">
              ¡A buscar leads!
            </Button>
          </div>
        )}
      </div>
    </div>
  )

  const dailyProgressPercent = effectiveDailyLimit > 0
    ? (credits.used_today / effectiveDailyLimit) * 100
    : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {showAdModal && <AdModal />}

      {/* Navbar */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="font-bold">Superlead</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Gold ad unlock button */}
            <button
              onClick={() => setShowAdModal(true)}
              disabled={maxAdsReached || effectiveDailyLimit >= 100}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg ${
                maxAdsReached
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 text-amber-900 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-400 hover:shadow-amber-300/50 animate-pulse'
              }`}
            >
              <Zap className="w-4 h-4" />
              {maxAdsReached
                ? 'Usaste tus 2 anuncios'
                : `+7 créditos (${remainingToday}/${effectiveDailyLimit})`
              }
            </button>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Rubro</label>
                  <Input placeholder="Ej: Restaurantes, Dentistas, Gimnasios" value={keyword} onChange={e => setKeyword(e.target.value)} disabled={loading} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Ubicación</label>
                  <Input placeholder="Ej: Providencia, Santiago" value={location} onChange={e => setLocation(e.target.value)} disabled={loading} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Punto de Referencia <span className="text-gray-300">(opcional)</span>
                  </label>
                  <Input placeholder="Ej: Av. Providencia 2000" value={referencePoint} onChange={e => setReferencePoint(e.target.value)} disabled={loading} />
                  <p className="text-xs text-gray-400 mt-1">Búsqueda desde este punto, se expande si es necesario</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Cantidad</label>
                  <div className="flex gap-2 items-center flex-wrap">
                    {[10, 20, 30, 40, 50, 60].map(n => (
                      <button key={n} type="button" onClick={() => setLimit(n)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                          limit === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Hoy: {credits.used_today}/{effectiveDailyLimit} · Mes: {credits.limit - credits.used}/{credits.limit}
                </span>
                <Button type="submit" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  Buscar Leads
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Leads encontrados</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{leads.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Búsquedas</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{new Set(leads.map(l => l.search_id)).size}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Créditos del mes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                <span className={credits.limit - credits.used <= 5 ? 'text-red-500' : ''}>{credits.limit - credits.used}</span>
                <span className="text-lg text-gray-400">/{credits.limit}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Hoy</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-3xl font-bold">{remainingToday}</p>
                  <p className="text-xs text-gray-400">/{effectiveDailyLimit}</p>
                </div>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${
                    dailyProgressPercent > 80 ? 'bg-red-500' : 'bg-blue-600'
                  }`} style={{ width: `${Math.min(dailyProgressPercent, 100)}%` }} />
                </div>
              </div>
              {effectiveDailyLimit > credits.base_daily && (
                <div className="flex items-center gap-1 mt-1">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <p className="text-xs text-amber-600">+{effectiveDailyLimit - credits.base_daily} por anuncios</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Leads Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Leads</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Busca tu primer lead para empezar</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-3 font-medium text-gray-500">Nombre</th>
                      <th className="text-left py-3 font-medium text-gray-500">Teléfono</th>
                      <th className="text-left py-3 font-medium text-gray-500">Email</th>
                      <th className="text-left py-3 font-medium text-gray-500">Web</th>
                      <th className="text-left py-3 font-medium text-gray-500">Rating</th>
                      <th className="text-left py-3 font-medium text-gray-500">Categoría</th>
                      <th className="text-left py-3 font-medium text-gray-500">Competencia</th>
                      <th className="text-left py-3 font-medium text-gray-500">RRSS</th>
                      <th className="text-left py-3 font-medium text-gray-500">Distancia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 font-medium">{lead.name}</td>
                        <td className="py-3">{lead.phone ? <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a> : '-'}</td>
                        <td className="py-3">{lead.email ? <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a> : <span className="text-gray-300">—</span>}</td>
                        <td className="py-3">
                          {lead.website ? (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Web
                            </a>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3">{lead.rating ? <Badge variant="secondary" className="text-xs">{'★'.repeat(Math.round(lead.rating))} {lead.rating}</Badge> : '-'}</td>
                        <td className="py-3 text-gray-500">{lead.enriched_category || '-'}</td>
                        <td className="py-3">
                          <Badge variant={lead.competition_level === 'Bajo' ? 'secondary' : lead.competition_level === 'Alto' ? 'destructive' : 'default'} className="text-xs">
                            {lead.competition_level}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {lead.has_facebook && lead.facebook_url
                              ? <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800"><ExternalLink className="w-4 h-4" /></a>
                              : <span className="text-gray-300">—</span>}
                            {lead.has_instagram && lead.instagram_url
                              ? <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800"><ExternalLink className="w-4 h-4" /></a>
                              : null}
                          </div>
                        </td>
                        <td className="py-3">{lead.distance_km ? <span className="text-sm text-gray-500">{lead.distance_km} km</span> : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
