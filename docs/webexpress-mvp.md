# WebExpress MVP — Especificación Ejecutable

> **Versión:** Final — MVP Scope  
> **Timeline:** 2-3 semanas  
> **Raw URL:** https://raw.githubusercontent.com/webexpresschile/Superlead/main/docs/webexpress-mvp.md

---

## 🎯 Producto

**Plan único: NEGOCIO STARTUP**
| Item | Detalle |
|------|---------|
| Sitio web | 1 sitio, 5 secciones |
| Panel Craft CMS | Editar textos e imágenes |
| Chatbot WhatsApp | Básico (100 msgs/mes) |
| Dashboard Analytics | 3 números clave |
| Setup fee | $69 (onboarding + entrenamiento chatbot) |
| Mensual | $19.99 (~$20 USD) |

---

## 🏗️ Templates Iniciales (3 rubros)

### `restaurant.astro`
- Hero con horarios
- Menú (items de Craft)
- Ubicación + mapa
- Reseñas (Google embebido)

### `clinic.astro`
- Servicios/especialidades
- Doctor cards
- Horario de atención
- Formulario: agendar cita

### `services.astro`
- Servicios descritos
- Portfolio/galería
- Testimonios
- Call-to-action (WhatsApp)

---

## 📦 Modelo de Datos

```yaml
Client:
  name: string
  description: text
  logo: asset
  hero_image: asset
  phone: string
  email: string
  address: string
  hours: JSON  # {mon-fri: "9-17", sat: "10-14"}
  primary_color: color picker
  secondary_color: color picker
  services: relation → Service
  gallery: assets

Service:
  name: string
  description: text
  price: decimal (opcional)
  image: asset
  order: number
```

---

## 🔄 Flujo de Onboarding

```
CLIENTE LLENA FORM (5 min)
├─ Rubro (Restaurante / Clínica / Servicios)
├─ Nombre negocio
├─ Descripción
├─ Ubicación
├─ Teléfono
└─ Email

 ↓

IA GENERA SITIO (10-15 min)
├─ Estructura Astro
├─ Contenido generado (descripción, servicios, FAQ)
├─ Imágenes de stock
├─ SEO básico (meta tags, schema)
└─ Deploy Vercel

 ↓

EMAIL AL CLIENTE
├─ Link: webexpress.cl/tu-negocio
├─ Link panel: panel.webexpress.cl
├─ Credenciales autogeneradas
└─ "Edita en 2 minutos"

 ↓

CLIENTE EDITA (Craft CMS)
├─ Textos clave
├─ Logo + foto hero
├─ Revisa y publica

 ↓

SITIO REGENERADO (< 30 seg)
├─ Webhook → N8N → GitHub Actions
└─ Cambios en vivo

 ↓

ACTIVAR CHATBOT (Opcional)
├─ Cliente autoriza WhatsApp
├─ Bot entrenado con contenido del sitio
└─ Responde consultas 24/7

 ↓

DASHBOARD ACTIVADO (7 días)
├─ Visitantes / Mensajes chatbot / Leads
└─ Email semanal automático
```

---

## 🔧 Webhook → Redeploy Flow

```
POST /webhooks/craft-update
{
  "event": "entry.saved",
  "clientId": "abc123",
  "content": {
    "name": "Mi Restaurante",
    "phone": "+569...",
    "colors": {...}
  }
}

N8N:
1. Recibe webhook
2. Genera JSON → /content/data.json
3. Commit a rama 'main'
4. Trigger GitHub Actions
5. Rebuild Astro → Deploy Vercel
```

---

## 🗓️ Timeline

### Semana 1
- Template inicial (restaurant.astro + estructura)
- Sistema de generación IA (prompt → contenido)
- Deploy Vercel automático
- Formulario de registro (Next.js)
- Autenticación (Clerk)

### Semana 2
- Instancia Craft CMS (Railway)
- Campos editables configurados
- Webhook Craft → N8N → GitHub
- Regeneración de sitios funcional
- Panel básico (Next.js + preview)

### Semana 3
- Evolution API + DeepSeek integrados
- Chatbot funcional (2-3 clientes test)
- Dashboard Analytics (GA4 embed)
- Emails automáticos (resumen semanal)
- QA + documentación cliente

### Post-MVP
- 5-10 clientes beta (free/discount)
- Feedback → iteraciones rápidas
- Lanzamiento público

---

## 🤖 Prompt Chatbot WhatsApp

```
Eres un asistente de servicio al cliente para [NOMBRE NEGOCIO].

Información del negocio:
- Servicios: [SERVICIOS]
- Horario: [HORARIOS]
- Ubicación: [DIRECCIÓN]
- Teléfono: [TELÉFONO]
- Precios: [PRECIOS si aplica]

Instrucciones:
1. Responde SOLO preguntas sobre el negocio
2. Si no sabes, di: "No tengo esa información, por favor llama a [TELÉFONO]"
3. Siempre ofrece el teléfono o link WhatsApp para más detalles
4. Sé amable y conciso
5. Responde en español

Contexto del negocio:
[CONTENIDO DEL SITIO]
```

---

## 🔐 Seguridad Mínima

- Autenticación: Email + password (Craft + Next.js)
- HTTPS en todo (Vercel + Railway)
- .env para keys de IA/WhatsApp
- Rate limiting en webhooks (N8N)
- Backups PostgreSQL automáticos

---

## 📊 Métricas de Éxito

| Métrica | Target |
|---------|--------|
| Generación sitio | < 15 min |
| Edición en panel | < 5 min |
| Lighthouse score | > 90 |
| Uptime | > 99% |
| Respuesta chatbot | < 5 seg |
| NPS cliente | > 50 |

---

## 💡 Decisiones Clave

- **No drag-and-drop** → Craft CMS puro (sin UI builder que mantener)
- **Un solo plan** → $20/mes Negocio (sin confundir con opciones)
- **Chatbot básico** → Solo contexto del sitio, sin memoria avanzada
- **Analytics simple** → 3 números, no dashboard complejo
- **Deploy automático** → Cliente nunca toca GitHub

---

## Stack Técnico

| Componente | Tecnología |
|-----------|-----------|
| Frontend sitios | Astro + Tailwind |
| CMS | Craft CMS (Railway) |
| BD | PostgreSQL (Craft) + Supabase (chats) |
| Autenticación | Clerk |
| IA | DeepSeek + OpenRouter |
| WhatsApp | Evolution API |
| Deploy | Vercel + GitHub Actions |
| Orquestación | N8N |
| Analytics | GA4 + Supabase queries |
| Emails | Resend / SendGrid |
| Pagos | Lemon Squeezy |
