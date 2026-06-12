'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Target, Loader2, ExternalLink, Zap, X, Play } from 'lucide-react'

const PLAN_CONFIG: Record<string, { name: string; searches: number; leads_per_search: number; daily_searches: number }> = {
  free:    { name: 'Gratis',  searches: 2,   leads_per_search: 10,  daily_searches: 1 },
  starter: { name: 'Starter', searches: 10,  leads_per_search: 20,  daily_searches: 3 },
  pro:     { name: 'Pro',     searches: 20,  leads_per_search: 50,  daily_searches: 5 },
  agency:  { name: 'Agency',  searches: 30,  leads_per_search: 100, daily_searches: 10 },
  unlimited: { name: '∞ Ilimitado', searches: 999999, leads_per_search: 200, daily_searches: 999999 },
}

interface Lead {
  id: string; name: string; phone: string | null; email: string | null
  website: string | null; address: string | null; rating: number | null
  enriched_category: string | null; competition_level: string
  facebook_url: string | null; instagram_url: string | null
  has_facebook: boolean; has_instagram: boolean; distance_km: number | null
  search_id: string
}

interface PlanInfo {
  searches_used: number; searches_limit: number; searches_today: number
  daily_limit: number; base_daily: number; ads_extra: number
  ads_monthly: number; searches_remaining: number; leads_per_search: number
}

function getLeadOptions(leadsPerSearch: number): number[] {
  const steps = leadsPerSearch <= 10 ? [5, 10]
    : leadsPerSearch <= 20 ? [10, 15, 20]
    : leadsPerSearch <= 50 ? [10, 20, 30, 40, 50]
    : [10, 25, 50, 75, 100]
  return steps.filter(n => n <= leadsPerSearch)
}

export default function Dashboard() {
  const { isSignedIn, user } = useUser()
  const { getToken } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [keyword, setKeyword] = useState('')
  const [location, setLocation] = useState('')
  const [referencePoint, setReferencePoint] = useState('')
  const [leadsCount, setLeadsCount] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [plan, setPlan] = useState<PlanInfo>({
    searches_used: 0, searches_limit: 2, searches_today: 0,
    daily_limit: 1, base_daily: 1, ads_extra: 0, ads_monthly: 0,
    searches_remaining: 2, leads_per_search: 10,
  })
  const [userPlan, setUserPlan] = useState('free')
  const [adsWatched, setAdsWatched] = useState(0)
  const [showAdModal, setShowAdModal] = useState(false)
  const [adWatching, setAdWatching] = useState(false)
  const [adCountdown, setAdCountdown] = useState(15)
  const [adMessage, setAdMessage] = useState('')

  // Filters
  const [filterCategory, setFilterCategory] = useState('')
  const [filterCompetition, setFilterCompetition] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  // Extract unique categories from leads
  const categories = [...new Set(leads.map(l => l.enriched_category).filter(Boolean))].sort() as string[]
  const competitionLevels = ['Alto', 'Medio', 'Bajo']

  // Apply filters
  const filteredLeads = leads.filter(l => {
    if (filterCategory && l.enriched_category !== filterCategory) return false
    if (filterCompetition && l.competition_level !== filterCompetition) return false
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      const matchName = l.name?.toLowerCase().includes(q)
      const matchPhone = l.phone?.toLowerCase().includes(q)
      const matchEmail = l.email?.toLowerCase().includes(q)
      if (!matchName && !matchPhone && !matchEmail) return false
    }
    return true
  })

  useEffect(() => {
    if (isSignedIn) { loadData() }
  }, [isSignedIn])

  async function loadData() {
    const token = await getToken()
    if (!token) return

    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ format: 'json' }),
    })
    const data = await res.json()
    if (data.leads) setLeads(data.leads)

    const profRes = await fetch('/api/user/profile', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!profRes.ok) return
    const prof = await profRes.json()
    if (prof) {
      const planInfo = PLAN_CONFIG[prof.plan] || PLAN_CONFIG.free
      const adExtraMonthly = prof.ads_extra_monthly ?? 0
      const adExtraDaily = prof.ads_extra_daily ?? 0
      const effectiveLimit = planInfo.searches + adExtraMonthly
      setPlan({
        searches_used: prof.credits_used ?? 0,
        searches_limit: effectiveLimit,
        searches_today: prof.credits_used_today ?? 0,
        daily_limit: planInfo.daily_searches + adExtraDaily,
        base_daily: planInfo.daily_searches,
        ads_extra: adExtraDaily,
        ads_monthly: adExtraMonthly,
        searches_remaining: effectiveLimit - (prof.credits_used ?? 0),
        leads_per_search: planInfo.leads_per_search,
      })
      setUserPlan(prof.plan)
      setLeadsCount(planInfo.leads_per_search)
      setAdsWatched(prof.ads_watched_today ?? 0)
    }
  }

  const maxAdsReached = plan.ads_monthly >= 2
  const remainingToday = plan.daily_limit - plan.searches_today
  const dailyProgress = plan.daily_limit > 0 ? (plan.searches_today / plan.daily_limit) * 100 : 0
  const leadOptions = getLeadOptions(plan.leads_per_search)

  async function handleAdWatch() {
    setAdWatching(true)
    setAdCountdown(15)
    setAdMessage('')

    const timer = setInterval(() => {
      setAdCountdown(prev => prev <= 1 ? (clearInterval(timer), 0) : prev - 1)
    }, 1000)

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
          setPlan(prev => ({
            ...prev,
            searches_limit: data.effective_monthly_limit,
            ads_monthly: data.ads_extra_monthly,
          }))
          setAdsWatched(prev => prev + 1)
          setAdMessage(`✅ ¡+${data.extra_searches} búsqueda al mes!`)
        } else {
          setAdMessage(data.error || 'Error')
        }
      } catch (e: any) { setAdMessage(e.message || 'Error') }
      setAdWatching(false)
    }, 15000)
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!keyword.trim()) { setError('Ingresa un rubro'); return }
    if (!location.trim()) { setError('Ingresa una ubicación'); return }
    if (plan.searches_remaining <= 0) {
      setError('Búsquedas del mes agotadas. Ve el botón dorado o espera al próximo mes.')
      return
    }
    if (remainingToday <= 0) {
      setError('📅 Límite diario alcanzado. Desbloquea +1 búsqueda con el anuncio.')
      return
    }

    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ keyword, location, limit: leadsCount, reference_point: referencePoint || null }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error al buscar')
      if (data.plan) setPlan(data.plan)
      if (data.leads) setLeads(prev => [...data.leads, ...prev])
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  async function handleExport() {
    const token = await getToken()
    if (!token) return
    const body: any = { format: 'csv' }
    if (filterCategory) body.category = filterCategory
    if (filterCompetition) body.competition = filterCompetition
    if (filterSearch) body.q = filterSearch
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
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
            <SignInButton mode="modal"><Button className="w-full">Continuar con Google</Button></SignInButton>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Ad Modal
  const AdModal = () => (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center" onClick={() => !adWatching && setShowAdModal(false)}>
      <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        {!adWatching && adMessage === '' && (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold">+1 búsqueda al mes</h3>
                <p className="text-gray-500 text-sm mt-1">Mira el anuncio y súmalo a tu plan mensual</p>
              </div>
              <button onClick={() => setShowAdModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="bg-gray-100 border border-gray-200 rounded-xl my-4 overflow-hidden flex items-center justify-center" style={{ minHeight: '250px' }}>
              <iframe src="/api/ads/serve?width=300&height=250" style={{ width: 300, height: 250, border: 'none' }} title="Adsterra" sandbox="allow-scripts allow-same-origin allow-popups" />
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-center">
              <p className="text-sm text-amber-800">
                Mes: <strong>{plan.searches_limit}/{plan.searches_limit}</strong> → <strong>{plan.searches_limit + 1}/{plan.searches_limit + 1}</strong>
              </p>
              <p className="text-xs text-amber-600 mt-1">Máx 2 anuncios/mes = +2 búsquedas</p>
            </div>
            <Button onClick={handleAdWatch} className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-bold text-lg py-6 shadow-lg">
              <Play className="w-5 h-5 mr-2" /> Ver anuncio (15 seg)
            </Button>
          </>
        )}

        {adWatching && (
          <div className="text-center">
            <div className="bg-gray-100 border border-gray-200 rounded-xl my-4 overflow-hidden">
              <iframe src="/api/ads/serve?width=300&height=250" style={{ width: 300, height: 250, border: 'none' }} title="Ad" sandbox="allow-scripts allow-same-origin allow-popups" />
              <div className="p-4 pt-2">
                <p className="font-bold text-gray-800 mb-2">Reproduciendo anuncio...</p>
                <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
                  <div className="h-4 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full transition-all duration-1000" style={{ width: `${((15 - adCountdown) / 15) * 100}%` }} />
                </div>
                <p className="text-sm text-amber-600 font-medium">{adCountdown} segundos</p>
              </div>
            </div>
          </div>
        )}

        {adMessage !== '' && !adWatching && (
          <div className="text-center">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 my-4">
              <div className="text-5xl mb-2">✅</div>
              <p className="text-green-800 font-bold text-lg">{adMessage}</p>
            </div>
            <Button onClick={() => { setShowAdModal(false); setAdMessage('') }} className="w-full">¡A buscar!</Button>
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
            <Badge variant="outline" className="text-xs ml-1">{PLAN_CONFIG[userPlan]?.name || 'Gratis'}</Badge>
          </div>
          <div className="flex items-center gap-3">
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
              {maxAdsReached ? 'Usaste 2 anuncios' : '+1 búsqueda al mes'}
            </button>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Este mes</CardTitle></CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{plan.searches_used}/{plan.searches_limit}</p>
              <p className="text-xs text-gray-400 mt-1">{plan.searches_remaining} búsquedas disponibles</p>
              {plan.ads_monthly > 0 && (
                <p className="text-xs text-amber-600 mt-0.5">+{plan.ads_monthly} por anuncios</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Leads totales</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{leads.length}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Por búsqueda</CardTitle></CardHeader>
            <CardContent><p className="text-3xl font-bold">{plan.leads_per_search}</p></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm text-gray-500">Hoy</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-3xl font-bold">{remainingToday}</p>
                  <p className="text-xs text-gray-400">/{plan.daily_limit}</p>
                </div>
                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${dailyProgress > 80 ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${Math.min(dailyProgress, 100)}%` }} />
                </div>
              </div>
              {plan.ads_extra > 0 && (
                <div className="flex items-center gap-1 mt-1"><Zap className="w-3 h-3 text-amber-500" /><p className="text-xs text-amber-600">+{plan.ads_extra} por anuncios</p></div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Search Form */}
        <Card className="mb-8">
          <CardContent className="pt-6 space-y-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Rubro</label>
                  <Input placeholder="Ej: Restaurantes, Dentistas" value={keyword} onChange={e => setKeyword(e.target.value)} disabled={loading} />
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
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Leads por búsqueda <span className="text-gray-300">(máx {plan.leads_per_search})</span>
                  </label>
                  <div className="flex gap-2 items-center flex-wrap">
                    {leadOptions.map(n => (
                      <button key={n} type="button" onClick={() => setLeadsCount(n)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${leadsCount === n ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{error}</div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Consume 1 búsqueda de {plan.searches_remaining} este mes
                </span>
                <Button type="submit" disabled={loading || plan.searches_remaining <= 0 || remainingToday <= 0}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  {plan.searches_remaining <= 0 ? 'Mes completo' : remainingToday <= 0 ? 'Límite diario' : 'Buscar'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Leads ({filteredLeads.length})</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            {leads.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="relative flex-1 min-w-[180px] max-w-xs">
                  <input
                    type="text"
                    placeholder="Buscar por nombre, teléfono o email..."
                    value={filterSearch}
                    onChange={e => setFilterSearch(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Todas las categorías</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                  value={filterCompetition}
                  onChange={e => setFilterCompetition(e.target.value)}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">Toda competencia</option>
                  {competitionLevels.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {(filterCategory || filterCompetition || filterSearch) && (
                  <button
                    onClick={() => { setFilterCategory(''); setFilterCompetition(''); setFilterSearch('') }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            )}
            {leads.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Busca tu primer lead para empezar</p>
            ) : filteredLeads.length === 0 ? (
              <p className="text-center text-gray-400 py-12">Ningún lead coincide con los filtros</p>
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
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-3 font-medium">{lead.name}</td>
                        <td className="py-3">{lead.phone ? <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">{lead.phone}</a> : '-'}</td>
                        <td className="py-3">{lead.email ? <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">{lead.email}</a> : <span className="text-gray-300">—</span>}</td>
                        <td className="py-3">{lead.website ? <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Web</a> : <span className="text-gray-300">—</span>}</td>
                        <td className="py-3">{lead.rating ? <Badge variant="secondary" className="text-xs">{'★'.repeat(Math.round(lead.rating))} {lead.rating}</Badge> : '-'}</td>
                        <td className="py-3 text-gray-500">{lead.enriched_category || '-'}</td>
                        <td className="py-3"><Badge variant={lead.competition_level === 'Bajo' ? 'secondary' : lead.competition_level === 'Alto' ? 'destructive' : 'default'} className="text-xs">{lead.competition_level}</Badge></td>
                        <td className="py-3"><div className="flex gap-2">{lead.has_facebook && lead.facebook_url ? <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800"><ExternalLink className="w-4 h-4" /></a> : <span className="text-gray-300">—</span>}{lead.has_instagram && lead.instagram_url ? <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:text-pink-800"><ExternalLink className="w-4 h-4" /></a> : null}</div></td>
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
