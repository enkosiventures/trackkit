import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

/**
 * Mock Umami API endpoints
 */
export const handlers = [
  // Successful Umami response
  http.post('https://cloud.umami.is/api/send', async ({ request }) => {
    console.warn('Mock Umami API called:', request.url);
    const body = await request.json();

    // Validate payload
    // @ts-ignore
    if (!body?.website) {
      return new HttpResponse(JSON.stringify({ error: 'Missing website ID' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return HttpResponse.json({ ok: true });
  }),

  http.post('https://plausible.io/api/event', async ({ request }) => {
    console.warn('Mock Plausible API called:', request.url);
    const body = await request.json();

    // Validate payload
    // @ts-ignore
    if (!body?.website) {
      return new HttpResponse(JSON.stringify({ error: 'Missing website ID' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return HttpResponse.json({ ok: true });
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