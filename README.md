# Konwenty NanoKarrin — strona konwentowa

Statyczna SPA z listą wszystkich konwentów (przyszłych i archiwalnych), w
których uczestniczyło **NanoKarrin**. Next.js (App Router) + Tailwind v4,
eksportowana jako static site i hostowana na **GitHub Pages**.

Strona nie przechowuje żadnego stanu — w czasie rzeczywistym pobiera dane z
publicznego API planera konwentów (`konwenty-migration-to-aws`):

- `GET /api/public/convents` — lista publicznych konwentów (nazwa + daty),
- `GET /api/public/{slug}` — pełny program (dni, ścieżki, godziny, atrakcje).

Paneliści są celowo niewyświetlani — strona pokazuje wyłącznie godziny i nazwy
atrakcji.

## Lokalnie

```bash
npm install
npm run dev
# http://localhost:3000
```

Bez `NEXT_PUBLIC_API_BASE` strona próbuje czytać z tego samego origin
(`/api/...`) — do pełnego lokalnego stacka uruchom dev-server planera
(`npm run dev:server` w repo `konwenty-migration-to-aws`), albo podaj jawny
adres:

```bash
NEXT_PUBLIC_API_BASE=http://localhost:3000 npm run dev
```

## Testy

```bash
npx vitest run
```

Logika siatki programu (`src/lib/program.ts`) — sloty godzinne, rowSpan,
kolizje, daty (strefa Europe/Warsaw) — jest pokryta testami jednostkowymi.

## Build statyczny

```bash
GITHUB_PAGES=true NEXT_PUBLIC_API_BASE=https://d2igwyf6wr5q7y.cloudfront.net npm run build
# output: ./out
```

`GITHUB_PAGES=true` ustawia `basePath`/`assetPrefix` na `/konwenty-nk`.

## Deploy

Push na `main` → workflow `.github/workflows/deploy.yml` buduje i publikuje na
GitHub Pages.

**Wymagania w repo na GitHubie:**

1. Settings → Pages → *Source*: **GitHub Actions**.
2. Settings → Secrets and variables → Actions → **Variables** → dodaj
   `NEXT_PUBLIC_API_BASE` = `https://d2igwyf6wr5q7y.cloudfront.net`.
3. Pierwszy push na `main` uruchomi pipeline; URL pojawi się w zakładce Actions.

## Struktura

- `src/app/page.tsx` — SPA: lista konwentów (Nadchodzące / Archiwum), rozwijane
  programy (lazy fetch + cache w pamięci)
- `src/components/ConventCard.tsx` — karta konwentu (rozwijanie, stany
  ładowania/błędu)
- `src/components/ProgramTable.tsx` — siatka programu: 1 ścieżka → 2 kolumny,
  wiele ścieżek → kolumna na ścieżkę; wiersze = godziny; rowSpan dla
  wielogodzinnych pozycji; pozycje poza siatką w przypisie „Pozostałe”
- `src/lib/api.ts` — klient publicznego API (fetch, timeout, typy błędów)
- `src/lib/program.ts` — czysta logika siatki + daty (testowalna)
- `src/lib/types.ts` — typy odpowiedzi API
- `src/app/globals.css` — tokeny brandingowe (jak w bitwy-dubbingowe-info)

## API i CORS

Publiczne endpointy planera wymagają nagłówka CORS dla originu strony
(`mdabrowski-eu.github.io`, `konwenty.nanokarrin.pl`) — konfiguracja w
`infra/apigateway.tf` repo planera. CSRF nie dotyczy tego integracji: API
używa Bearer auth (nie ciasteczek), a wywoływane endpointy są publiczne i
read-only.