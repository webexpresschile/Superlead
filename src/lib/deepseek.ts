const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions'

interface LeadInput {
  name: string
  types: string[]
  rating: number | null
  reviews_count: number | null
  address: string | null
  website: string | null
}

interface EnrichedLead {
  description: string
  category: string
  competition_level: 'Bajo' | 'Medio' | 'Alto'
}

export async function enrichLeads(leads: LeadInput[]): Promise<EnrichedLead[]> {
  if (!DEEPSEEK_API_KEY) return leads.map(() => ({
    description: '',
    category: '',
    competition_level: 'Medio',
  }))

  const prompt = `Analiza estos negocios y para cada uno proporciona:
1. Una descripción corta de qué hace el negocio (máx 15 palabras)
2. Una categoría precisa (ej: "Restaurante", "Clínica Dental", "Tienda de Ropa")
3. Nivel de competencia: Bajo, Medio o Alto

Formato: para cada negocio, responde como JSON en array:
[{"name": "...", "description": "...", "category": "...", "competition_level": "..."}]

Negocios:
${JSON.stringify(leads.map(l => ({ name: l.name, types: l.types?.slice(0, 3), rating: l.rating })))}`

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    const data = await res.json()
    const text = data.choices?.[0]?.message?.content || '[]'
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return leads.map(() => ({ description: '', category: '', competition_level: 'Medio' }))
    
    return JSON.parse(jsonMatch[0])
  } catch (e) {
    console.error('DeepSeek enrichment error:', e)
    return leads.map(() => ({ description: '', category: '', competition_level: 'Medio' }))
  }
}
