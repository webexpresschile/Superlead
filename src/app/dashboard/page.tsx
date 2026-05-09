'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Target, Loader2, ExternalLink, Zap, X, Play } from 'lucide-react'

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
  })
  const [adsWatched, setAdsWatched] = useState(0)
  const [showAdModal, setShowAdModal] = useState(false)
  const [adWatching, setAdWatching] = useState(false)
  const [adCountdown, setAdCountdown] = useState(5) // seconds (simulated ad)
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
      .select('credits_used, credits_limit, credits_used_today, daily_limit, ads_watched_today')
      .eq('auth_id', user?.id)
      .single()
    if (data) {
      setCredits({
        used: data.credits_used ?? 0,
        limit: data.credits_limit ?? 50,
        used_today: data.credits_used_today ?? 0,
        daily_limit: data.daily_limit ?? 7,
      })
      setAdsWatched(data.ads_watched_today ?? 0)
    }
  }

  const maxAdsReached = adsWatched >= 2

  async function handleAdWatch() {
    setAdWatching(true)
    setAdCountdown(5)
    setAdMessage('')

    // Simulate ad countdown
    const timer = setInterval(() => {
      setAdCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // After ad completes
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
            limit: data.credits_limit,
          }))
          setAdsWatched(data.ads_watched_today)
          setAdMessage(`🎉 ¡${data.extra_credits} créditos extras desbloqueados!`)
        } else {
          setAdMessage(data.error || 'Error al desbloquear')
        }
      } catch (e: any) {
        setAdMessage(e.message || 'Error al desbloquear')
      }
      setAdWatching(false)
      setAdCountdown(5)
    }, 5000)
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
      setLeads(prev => [...data.leads, ...prev])
      setCredits({
        used: data.credits.used,
        limit: data.credits.limit,
        used_today: data.credits.used_today,
        daily_limit: data.daily_limit,
      })
    } catch (e: any) {
      setError(e.message)
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

  // Render ad modal
  const AdModal = () => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => !adWatching && setShowAdModal(false)}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {!adWatching && adMessage === '' && (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">Desbloquea 7 créditos adicionales</h3>
                <p className="text-gray-500 text-sm mt-1">Viendo esta publicidad</p>
              </div>
              <button onClick={() => setShowAdModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6 my-4 text-center">
              <div className="text-4xl mb-2">📺</div>
              <p className="text-amber-800 font-medium">Anuncio patrocinado</p>
              <p className="text-xs text-amber-600 mt-1">Tu privacidad es importante — sin datos compartidos</p>
            </div>
            <p className="text-xs text-gray-400 mb-4 text-center">
              {2 - adsWatched} anuncios disponibles hoy · 14 créditos máximo/día
            </p>
            <Button onClick={handleAdWatch} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold text-lg py-6">
              <Play className="w-5 h-5 mr-2" />
              Ver anuncio (5 seg)
            </Button>
          </>
        )}

        {adWatching && (
          <div className="text-center">
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-6 my-4">
              <div className="text-5xl mb-3">🎬</div>
              <p className="font-bold text-amber-800 mb-2">Reproduciendo anuncio...</p>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div
                  className="h-3 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-all duration-1000"
                  style={{ width: `${((5 - adCountdown) / 5) * 100}%` }}
                />
              </div>
              <p className="text-sm text-amber-600">{adCountdown} segundos restantes</p>
            </div>
          </div>
        )}

        {adMessage !== '' && !adWatching && (
          <div className="text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 my-4">
              <div className="text-5xl mb-2">✅</div>
              <p className="text-green-800 font-bold text-lg">{adMessage}</p>
              <p className="text-xs text-green-600 mt-2">Sigue buscando leads sin límite</p>
            </div>
            <Button onClick={() => { setShowAdModal(false); setAdMessage('') }} className="w-full">
              Continuar
            </Button>
          </div>
        )}
      </div>
    </div>
  )

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
            {/* Gold ad button */}
            <button
              onClick={() => setShowAdModal(true)}
              disabled={maxAdsReached}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg ${
                maxAdsReached
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-300 text-amber-900 hover:from-amber-500 hover:via-yellow-500 hover:to-amber-400 hover:shadow-amber-300/50 animate-pulse'
              }`}
            >
              <Zap className="w-4 h-4" />
              {maxAdsReached ? 'Usaste tus 2 anuncios' : '+7 créditos extra'}
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
                  <p className="text-xs text-gray-400 mt-1">La búsqueda comienza desde este punto y se expande</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Cantidad de Leads</label>
                  <div className="flex gap-2 items-center">
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
                  {credits.used_today}/{credits.daily_limit} usados hoy · {credits.limit - credits.used}/{credits.limit} del mes
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
                <p className="text-3xl font-bold">{credits.daily_limit - credits.used_today}</p>
                <p className="text-sm text-gray-400">/{credits.daily_limit}</p>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${(credits.used_today / credits.daily_limit) * 100}%` }} />
                </div>
              </div>
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
                        <td className="py-3">
                          {lead.phone ? <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a> : '-'}
                        </td>
                        <td className="py-3">
                          {lead.email ? <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a> : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3">
                          {lead.website ? (
                            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> Web
                            </a>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3">
                          {lead.rating ? <Badge variant="secondary" className="text-xs">{'★'.repeat(Math.round(lead.rating))} {lead.rating}</Badge> : '-'}
                        </td>
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
                        <td className="py-3">
                          {lead.distance_km ? <span className="text-sm text-gray-500">{lead.distance_km} km</span> : <span className="text-gray-300">—</span>}
                        </td>
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
