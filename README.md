# 🎯 Superlead — Extractora de Leads con IA

## ¿Qué es Superlead?

**Superlead** es una herramienta SaaS que extrae negocios de Google Maps, los enriquece con inteligencia artificial (DeepSeek) y te los entrega listos para vender, llamar o hacer email marketing.

En lugar de pasar horas buscando clientes uno por uno en Google Maps, escribes un rubro y ubicación, y Superlead te devuelve una tabla con nombre, teléfono, dirección, rating, categoría y nivel de competencia de cada negocio.

---

## 🔍 ¿Cómo funciona?

### 1. Buscas
Escribes el rubro y la ubicación:

```
Rubro:      Restaurantes
Ubicación:  Providencia, Santiago
```

Superlead consulta la **API Places (New)** de Google y obtiene hasta **60 resultados** automáticamente (con paginación).

### 2. Eliges cantidad
Antes de buscar, seleccionas cuántos leads quieres obtener:

`[10] [20] [30] [40] [50] [60]`

Esto controla cuántos créditos consumes por búsqueda.

### 3. Se enriquecen con IA
Cada negocio pasa por **DeepSeek** (modelo `deepseek-chat`) que analiza:

- **Categoría precisa** — Ej: "Restaurante Italiano", "Clínica Dental", "Tienda de Ropa"
- **Descripción corta** — Qué hace el negocio en máximo 15 palabras
- **Nivel de competencia** — `Bajo · Medio · Alto`

### 4. Se guardan y visualizan
Los datos se almacenan en **Supabase** y se muestran en una tabla con:

| Columna | Descripción |
|---|---|
| Nombre | Nombre del negocio |
| Teléfono | Número de contacto |
| Dirección | Dirección formateada |
| Rating | Estrellas en Google Maps |
| Categoría | Clasificación con IA |
| Competencia | Bajo / Medio / Alto |

### 5. Exportas
Un click y descargas todo como **CSV** listo para importar a:

- Google Sheets / Excel
- CRM (HubSpot, Salesforce, etc.)
- Campañas de email marketing
- Outreach por teléfono

---

## 💳 Sistema de Créditos

Cada búsqueda consume créditos según la cantidad de leads solicitados. Hay dos límites:

### Límite mensual
| Plan | Créditos/mes |
|---|---|
| Free (7 días) | 50 |
| Starter ($9.99) | 200 |
| Pro ($19.99) | 1.000 |
| Agency ($39.99) | 5.000 |

### Límite diario
Para evitar que quemes todo en un día:

| Plan | Límite/día |
|---|---|
| Free | 7 |
| Starter | 7 |
| Pro | 30 |
| Agency | 150 |

Los límites diarios se reinician automáticamente cada día.

---

## 🧠 Enriquecimiento con IA

Cada lead pasa por DeepSeek y obtiene:

**Categoría** — Ej: si buscas "gimnasios", los clasifica en:
- Gimnasio tradicional
- Box (CrossFit)
- Pilates / Yoga
- Centro deportivo

**Nivel de competencia** basado en:
- Densidad de negocios similares en la zona
- Ratings y cantidad de reseñas
- Presencia online

**Descripción** — Resumen breve del negocio para entender rápido de qué se trata.

---

## 🏗️ Stack Técnico

| Componente | Tecnología |
|---|---|
| Frontend | Next.js 16 + Tailwind CSS + shadcn/ui |
| Autenticación | Clerk (Google OAuth + magic links) |
| Base de datos | Supabase (PostgreSQL) |
| Búsqueda | Google Places API (New) |
| Enriquecimiento | DeepSeek API |
| Despliegue | Vercel (serverless) |
| Pagos | Lemon Squeezy (próximamente) |

---

## 🚀 Flujo de Usuario

```
1. Usuario llega al landing → ve hero + planes
2. Se registra con Google (Clerk modal)
3. Cae al Dashboard
4. Escribe rubro + ubicación
5. Selecciona cantidad de leads (10-60)
6. Click "Buscar"
7. Superlead consulta Google Maps + DeepSeek
8. Leads aparecen en tabla
9. Usuario exporta a CSV o sigue buscando
10. Créditos se descuentan (mensual + diario)
```

---

## 📊 Dashboard en Vivo

El dashboard muestra en tiempo real:

- **Leads encontrados** — total acumulado
- **Búsquedas realizadas** — número de consultas
- **Créditos del mes** — usado / total con alerta si quedan ≤ 5
- **Hoy** — uso diario con barra de progreso

---

## 🎯 Casos de Uso

**Dueño de agencia de marketing**
> "Quiero encontrar 500 restaurantes en Santiago para ofrecerles diseño web."
> → Busca "Restaurantes" en "Santiago" → exporta CSV → campaña de email

**Vendedor de software POS**
> "Necesito clínicas dentales en Providencia para venderles mi sistema."
> → Busca "Clínicas Dentales" en "Providencia" → obtiene teléfonos → llama

**Freelancer de SEO**
> "Quiero negocios con rating bajo para ofrecerles optimización."
> → Filtra por competencia "Alto" → contacta a los que más lo necesitan

**Emprendedor local**
> "Quiero saber cuántas pizzarías hay en mi comuna."
> → Busca "Pizzerías" en su comuna → ve el nivel de competencia

---

## 🔒 Privacidad y Seguridad

- Los leads son privados por usuario (RLS en Supabase)
- Autenticación via Clerk (sin manejo de contraseñas)
- API keys almacenadas como variables de entorno en Vercel
- DeepSeek solo recibe nombre, rubro y rating (no datos sensibles)

---

## 🧪 Modo Free Trial

Al registrarse, el usuario obtiene:
- **50 créditos gratis**
- **Límite diario de 7 leads/día**
- **7 días de prueba** (próximamente con fecha de expiración)
- Sin necesidad de tarjeta de crédito

---

## 🗺️ Roadmap

### MVP Actual (v1)
- [x] Búsqueda por rubro + ubicación
- [x] Leads enriquecidos con IA
- [x] Exportación CSV
- [x] Autenticación con Google
- [x] Límites diarios y mensuales
- [x] Selector de cantidad de leads

### Próximas versiones
- [ ] Pagos con Lemon Squeezy
- [ ] Filtros avanzados (rating mínimo, competencia)
- [ ] Exportación a Google Sheets directa
- [ ] Historial de búsquedas
- [ ] Modo oscuro
- [ ] Webhook a GHL / CRMs
- [ ] Leads duplicados automáticos
- [ ] API pública

---

*Creado con Next.js + Supabase + Clerk + DeepSeek + Google Places*
