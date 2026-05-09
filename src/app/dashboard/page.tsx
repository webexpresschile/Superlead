'use client'

import { useState, useEffect } from 'react'
import { useUser, useAuth, SignInButton, UserButton } from '@clerk/nextjs'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Search, Download, Target, Loader2, ShoppingCart, ExternalLink } from 'lucide-react'

interface Lead {
  id: string
  name: string
  phone: string | null
  email: string | null
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
      .select('credits_used, credits_limit, credits_used_today, daily_limit')
      .eq('auth_id', user?.id)
      .single()
    if (data) {
      setCredits({
        used: data.credits_used ?? 0,
        limit: data.credits_limit ?? 50,
        used_today: data.credits_used_today ?? 0,
        daily_limit: data.daily_limit ?? 7,
      })
    }
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
        body: JSON.stringify({
          keyword,
          location,
          limit,
          reference_point: referencePoint || null,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Error al buscar')
      setLeads(prev => [...data.leads, ...prev])
      setCredits({
        used: data.credits.used,
        limit: data.credits.limit,
        used_today: data.credits.used_today,
        daily_limit: data.credits.daily_limit,
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            <span className="font-bold">Superlead</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" className="text-xs gap-2">
              <ShoppingCart className="w-3 h-3" />
              Comprar créditos
            </Button>
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
                  <Input
                    placeholder="Ej: Restaurantes, Dentistas, Gimnasios"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Ubicación</label>
                  <Input
                    placeholder="Ej: Providencia, Santiago"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">
                    Punto de Referencia <span className="text-gray-300">(opcional)</span>
                  </label>
                  <Input
                    placeholder="Ej: Av. Providencia 2000"
                    value={referencePoint}
                    onChange={e => setReferencePoint(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    La búsqueda comienza desde este punto y se expande
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Cantidad de Leads</label>
                  <div className="flex gap-2 items-center">
                    {[10, 20, 30, 40, 50, 60].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setLimit(n)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                          limit === n
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">
                  {error}
                </div>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Leads encontrados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{leads.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Búsquedas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{new Set(leads.map(l => l.search_id)).size}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Créditos del mes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                <span className={credits.limit - credits.used <= 5 ? 'text-red-500' : ''}>
                  {credits.limit - credits.used}
                </span>
                <span className="text-lg text-gray-400">/{credits.limit}</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-500">Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="text-3xl font-bold">{credits.daily_limit - credits.used_today}</p>
                <p className="text-sm text-gray-400">/{credits.daily_limit}</p>
                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${(credits.used_today / credits.daily_limit) * 100}%` }}
                  />
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
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
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
                          {lead.phone ? (
                            <a href={`tel:${lead.phone}`} className="text-blue-600 hover:underline">
                              {lead.phone}
                            </a>
                          ) : '-'}
                        </td>
                        <td className="py-3">
                          {lead.email ? (
                            <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline">
                              {lead.email}
                            </a>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          {lead.rating ? (
                            <Badge variant="secondary" className="text-xs">
                              {'★'.repeat(Math.round(lead.rating))} {lead.rating}
                            </Badge>
                          ) : '-'}
                        </td>
                        <td className="py-3 text-gray-500">{lead.enriched_category || '-'}</td>
                        <td className="py-3">
                          <Badge variant={
                            lead.competition_level === 'Bajo' ? 'secondary' :
                            lead.competition_level === 'Alto' ? 'destructive' : 'default'
                          } className="text-xs">
                            {lead.competition_level}
                          </Badge>
                        </td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            {lead.has_facebook && lead.facebook_url ? (
                              <a
                                href={lead.facebook_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                                title="Facebook"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                            {lead.has_instagram && lead.instagram_url ? (
                              <a
                                href={lead.instagram_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-pink-600 hover:text-pink-800"
                                title="Instagram"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                        <td className="py-3">
                          {lead.distance_km ? (
                            <span className="text-sm text-gray-500">{lead.distance_km} km</span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
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
