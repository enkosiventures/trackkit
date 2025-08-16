import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';


export const captured = {
  plausible: [] as any[],
  umami: [] as any[],
  ga4: [] as Array<{ query: Record<string, string>, body: any }>,
};

export function clearCaptured() {
  captured.umami.length = 0;
  captured.plausible.length = 0;
  captured.ga4.length = 0;
}

function json(res: any) {
  return HttpResponse.json(res);
}

/**
 * Mock Umami API endpoints
 */
export const handlers = [
  // --- Plausible -----------------------------------------------------------
  // Matches cloud or self-hosted: https://plausible.io/api/event or */api/event
  http.post('*/api/event', async ({ request }) => {
    const body = await request.json().catch(() => ({}));
    // Minimal sanity checks so tests fail loudly if shape regresses
    // @ts-ignore
    if (!body?.domain || !body?.name || !body?.url) {
      return new HttpResponse(JSON.stringify({ error: 'Bad plausible body' }), { status: 400 });
    }
    captured.plausible.push(body);
    // Plausible returns 202 Accepted on success
    return new HttpResponse(null, { status: 202 });
  }),

  // --- Umami v2 ------------------------------------------------------------
  // Matches cloud or self-hosted: */api/send (body has { type, payload })
  http.post('*/api/send', async ({ request }) => {
    const body = await request.json().catch(() => ({/* no-op */}));
    // @ts-ignore
    const payload = body?.payload ?? {};
    const { website, url } = payload;

    // @ts-ignore
    if (body?.type !== 'event' || !website || !url) {
      return new HttpResponse(JSON.stringify({ error: 'Bad umami body' }), { status: 400 });
    }
    captured.umami.push(body);
    // Typical 200/204 OK
    return new HttpResponse(null, { status: 204 });
  }),

  // --- GA4 Measurement Protocol -------------------------------------------
  // Accept both /mp/collect and /debug/mp/collect on any Google host
  http.post('*/mp/collect', async ({ request }) => {
    const u = new URL(request.url);
    const q = Object.fromEntries(u.searchParams.entries());
    const body = await request.json().catch(() => ({/* no-op */}));

    // require measurement_id + api_secret
    if (!q.measurement_id || !q.api_secret) {
      return json({ validationMessages: [{ description: 'missing id or secret' }] });
    }

    captured.ga4.push({ query: q, body });

    // If debug endpoint, return a debug body; otherwise 204
    if (u.pathname.includes('/debug/')) {
      return json({ validationMessages: [] });
    }
    return new HttpResponse(null, { status: 204 });
  }),

  // Custom host
  http.post('https://analytics.example.com/api/send', () => {
    console.warn('Mock custom analytics host called');
    return HttpResponse.json({ ok: true });
  }),

  // Network error simulation
  http.post('https://error.example.com/api/send', () => {
    console.warn('Mock network error simulation');
    return HttpResponse.error();
  }),

  // Server error simulation
  http.post('https://500.example.com/api/send', () => {
    console.warn('Mock server error simulation');
    return new HttpResponse('Internal Server Error', {
      status: 500,
    });
  }),
];

export const server = setupServer(...handlers);