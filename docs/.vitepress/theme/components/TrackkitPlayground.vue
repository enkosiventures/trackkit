<template>
  <div class="tk-playground">
    <div class="tk-header">
      <h2>Welcome to the Trackkit Playground!</h2>
      <p>
        This embedded playground runs a <code>createAnalytics()</code> instance using the
        <code>noop</code> provider. Nothing is sent over the network – it’s purely here to
        visualise consent and queue behaviour.
      </p>
    </div>

    <div v-if="!isClient" class="tk-panel">
      <p>This playground is only available in the browser.</p>
    </div>

    <div v-else class="tk-layout-row">
      <div class="tk-row">
        <div class="tk-panel">
          <h3>Send events</h3>
          <p class="tk-muted">
            These are thin wrappers around <code>pageview()</code> and
            <code>track()</code> on the same instance. Watch the queue metrics as you click.
          </p>

          <div class="tk-field">
            <label for="pvPreset">Pageview URL</label>
            <div class="tk-field-row">
              <select id="pvPreset" v-model="config.pageviewPreset" @change="onChangePreset" class="tk-select">
                <option value="playground">/docs/playground</option>
                <option value="home">/</option>
                <option value="docs-root">/docs/</option>
                <option value="faq">/overview/faq#section</option>
                <option value="custom">Custom…</option>
              </select>
              <input
                class="tk-input"
                :disabled="config.pageviewPreset !== 'custom'"
                v-if="config.pageviewPreset === 'custom'"
                v-model="config.pageviewUrl"
                placeholder="/docs/playground"
              />
            </div>
            <p class="tk-help">
              Pick a preset, or choose <em>Custom…</em> to type your own.
            </p>
          </div>

          <div class="tk-button-row">
            <button class="tk-button" @click="sendEvent('pageview')">
              pageview()
            </button>
            <button class="tk-button" @click="sendEvent('track')">
              track('playground_event')
            </button>
          </div>

          <p class="tk-help">
            Try filling the queue by lowering the queue size and spamming events while
            consent is <strong>pending</strong>, then switching to
            <strong>granted</strong>. Duplicate pageviews are filtered out automatically.
          </p>
        </div>
      </div>

      <div class="tk-row">
        <div class="tk-layout-column">
          <!-- Left column: config + actions -->
          <div class="tk-column">
            <div class="tk-panel">
              <h3>Instance configuration</h3>
              <p class="tk-muted">
                This recreates a single Trackkit instance with the given options.<br />
                Provider is fixed to <code>noop</code> to avoid hitting real endpoints.<br />
                Recreate the instance to apply changes.
              </p>

              <div class="tk-field">
                <label for="queueSize">Queue size</label>
                <div class="tk-field-row">
                  <input
                    id="queueSize"
                    type="range"
                    min="2"
                    max="18"
                    step="1"
                    v-model.number="config.queueSize"
                  />
                  <span class="tk-chip">{{ config.queueSize }}</span>
                </div>
                <p class="tk-help">
                  When the in-memory queue exceeds this size, oldest events are dropped first.
                </p>
              </div>

              <div class="tk-field tk-checkbox-row">
                <label>
                  <input type="checkbox" v-model="config.debug" />
                  Debug logs
                </label>
                <label>
                  <input type="checkbox" v-model="config.autoTrack" />
                  Auto pageview on navigation
                </label>
                <label>
                  <input type="checkbox" v-model="config.dnt" />
                  Respect DNT
                </label>
                <label>
                  <input type="checkbox" v-model="config.includeHash" />
                  includeHash
                </label>
              </div>

              <div class="tk-field">
                <label>Batching</label>
                <div class="tk-field-row">
                  <label class="tk-checkbox-row" style="margin:0">
                    <input type="checkbox" v-model="config.batchingEnabled" />
                    Enable batching
                  </label>
                </div>
                <div class="tk-field-row" :style="{ opacity: config.batchingEnabled ? 1 : 0.55 }">
                  <label style="min-width: 80px;">maxSize</label>
                  <input class="tk-input" type="number" min="1" v-model.number="config.batchMaxSize" :disabled="!config.batchingEnabled">
                </div>
                <div class="tk-field-row" :style="{ opacity: config.batchingEnabled ? 1 : 0.55 }">
                  <label style="min-width: 80px;">maxWait</label>
                  <input class="tk-input" type="number" min="0" v-model.number="config.batchMaxWait" :disabled="!config.batchingEnabled">
                  <span class="tk-chip">ms</span>
                </div>
              </div>

              <button class="tk-button" @click="recreateInstance">
                Recreate instance
              </button>

              <p v-if="lastError" class="tk-error">
                {{ lastError }}
              </p>
            </div>

            <div class="tk-panel">
              <h3>Consent controls</h3>
              <p class="tk-muted">
                These call the facade consent API on the current instance and show how the
                queue reacts.
              </p>

              <div class="tk-chip-row">
                <span class="tk-label">Current status:</span>
                <span class="tk-status" :data-status="consentStatus">
                  {{ consentStatus }}
                </span>
              </div>

              <div class="tk-button-row">
                <button
                  class="tk-button tk-button-ghost"
                  :class="{ 'tk-button-active': consentStatus === 'pending' }"
                  @click="setConsent('pending')"
                >
                  Pending
                </button>
                <button
                  class="tk-button tk-button-ghost"
                  :class="{ 'tk-button-active': consentStatus === 'granted' }"
                  @click="setConsent('grant')"
                >
                  Grant
                </button>
                <button
                  class="tk-button tk-button-ghost"
                  :class="{ 'tk-button-active': consentStatus === 'denied' }"
                  @click="setConsent('deny')"
                >
                  Deny
                </button>
              </div>

              <ul class="tk-hints">
                <li><strong>pending</strong>: non-essential events are queued in memory.</li>
                <li><strong>granted</strong>: queue flushes and new events send immediately.</li>
                <li>
                  <strong>denied</strong>:
                  non-essential events are dropped at the policy gate.
                </li>
              </ul>
            </div>
          </div>

          <div class="tk-column">
            <div class="tk-panel">
              <h3>Runtime state</h3>

              <div v-if="snapshot" class="tk-metric-groups">
                <!-- Dispatch -->
                <div class="tk-metric-group">
                  <h4>Dispatch</h4>
                  <dl class="tk-metric-list">
                    <div class="tk-metric-row">
                      <dt>Total dispatched</dt>
                      <dd>{{ snapshot.performance?.totalSends ?? 0 }}</dd>
                    </div>
                  </dl>
                </div>

                <!-- Policy gate -->
                <div class="tk-metric-group">
                  <h4>Policy gate</h4>
                  <dl class="tk-metric-list">
                    <div class="tk-metric-row">
                      <dt>Evaluated</dt>
                      <dd>{{ snapshot.policy?.eventsEvaluated ?? 0 }}</dd>
                    </div>
                    <div class="tk-metric-row">
                      <dt>Blocked</dt>
                      <dd>{{ snapshot.policy?.eventsBlocked ?? 0 }}</dd>
                    </div>
                    <div class="tk-metric-row">
                      <dt>Last decision</dt>
                      <dd>{{ snapshot.policy?.lastDecision ?? '—' }}</dd>
                    </div>
                    <div class="tk-metric-row">
                      <dt>Last reason</dt>
                      <dd>{{ snapshot.policy?.lastReason ?? '—' }}</dd>
                    </div>
                  </dl>
                </div>

                <!-- Queue -->
                <div class="tk-metric-group">
                  <h4>Queue</h4>
                  <dl class="tk-metric-list">
                    <div class="tk-metric-row">
                      <dt>Buffered total</dt>
                      <dd>{{ snapshot.queue?.totalBuffered ?? 0 }}</dd>
                    </div>
                    <div class="tk-metric-row">
                      <dt>Runtime capacity</dt>
                      <dd>{{ snapshot.queue?.capacity ?? config.queueSize }}</dd>
                    </div>
                  </dl>
                </div>

                <!-- Batching -->
                <div class="tk-metric-group">
                  <h4>Batching</h4>
                  <dl class="tk-metric-list">
                    <div class="tk-metric-row">
                      <dt>Status</dt>
                      <dd>{{ config.batchingEnabled ? 'on' : 'off' }}</dd>
                    </div>
                    <div v-if="config.batchingEnabled" class="tk-metric-row">
                      <dt>Size / wait</dt>
                      <dd>{{ config.batchMaxSize }} / {{ config.batchMaxWait }}ms</dd>
                    </div>
                    <div v-if="config.batchingEnabled" class="tk-metric-row">
                      <dt>Current batch size</dt>
                      <dd>{{ snapshot.dispatcher?.batching.currentBatchSize ?? 0 }} bytes</dd>
                    </div>
                    <div v-if="config.batchingEnabled" class="tk-metric-row">
                      <dt>Current batch quantity</dt>
                      <dd>{{ snapshot.dispatcher?.batching.currentBatchQuantity ?? 0 }}</dd>
                    </div>
                  </dl>
                </div>

                <!-- URLs -->
                <div class="tk-metric-group">
                  <h4>URLs</h4>
                  <dl class="tk-metric-list">
                    <div class="tk-metric-row">
                      <dt>Last planned</dt>
                      <dd>{{ snapshot.urls?.lastPlanned ?? '—' }}</dd>
                    </div>
                    <div class="tk-metric-row">
                      <dt>Last sent</dt>
                      <dd>{{ snapshot.urls?.lastSent ?? '—' }}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              <p v-else class="tk-muted">
                Waiting for diagnostics snapshot…
              </p>
            </div>

            <div class="tk-panel">
              <h3>Event log (playground only)</h3>
              <p class="tk-muted">
                This log is local to the playground UI – it doesn’t come from Trackkit. It just
                mirrors the calls you make so you can connect actions to queue state.
              </p>

              <div class="tk-log">
                <div
                  v-for="item in log"
                  :key="item.id"
                  class="tk-log-row"
                >
                  <span class="tk-log-label">{{ item.label }}</span>
                  <span v-if="item.detail" class="tk-log-detail">{{ item.detail }}</span>
                </div>
                <p v-if="!log.length" class="tk-muted">
                  No events yet. Try sending a pageview or track event.
                </p>
              </div>

              <button
                class="tk-button tk-button-ghost"
                :disabled="!log.length"
                @click="clearLog"
              >
                Clear log
              </button>
            </div>

            <div class="tk-panel tk-panel-muted" v-if="snapshot">
              <details>
                <summary>Raw diagnostics snapshot</summary>
                <pre>{{ formattedSnapshot }}</pre>
              </details>
            </div>
          </div>


        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from 'vue';
import { createAnalytics } from 'trackkit';

type ConsentView = 'pending' | 'granted' | 'denied';

const isClient = ref(false);
const initializing = ref(true);
const lastError = ref<string | null>(null);

const config = reactive({
  queueSize: 10,
  debug: true,
  autoTrack: false,
  dnt: false,
  includeHash: false,
  batchingEnabled: true,
  batchMaxSize: 3,
  batchMaxWait: 10000,
  // pageview URL controls
  pageviewPreset: 'playground',
  pageviewUrl: '/docs/playground',
});

const snapshot = ref<any | null>(null);
const log = ref<Array<{ id: number; label: string; detail?: string }>>([]);

let analytics: any | null = null;
let pollTimer: number | null = null;

const consentStatus = computed<ConsentView>(() => {
  return (snapshot.value?.consent?.status as ConsentView) ?? 'pending';
});

const formattedSnapshot = computed(() =>
  snapshot.value ? JSON.stringify(snapshot.value, null, 2) : '',
);

async function refreshSnapshot() {
  if (!analytics || typeof analytics.getDiagnostics !== 'function') return;
  const s = analytics.getDiagnostics();
  // Support both sync and async implementations
  if (s && typeof (s as any).then === 'function') {
    snapshot.value = await (s as Promise<any>);
  } else {
    snapshot.value = s as any;
  }
}

function logEvent(label: string, detail?: string) {
  log.value.unshift({
    id: Date.now() + Math.random(),
    label,
    detail,
  });
  if (log.value.length > 40) {
    log.value = log.value.slice(0, 40);
  }
}

function onChangePreset() {
  switch (config.pageviewPreset) {
    case 'playground': config.pageviewUrl = '/docs/playground'; break;
    case 'home':       config.pageviewUrl = '/'; break;
    case 'docs-root':  config.pageviewUrl = '/docs/'; break;
    case 'faq':        config.pageviewUrl = '/overview/faq#section'; break;
    case 'custom':     /* leave user's value */ break;
    default:           config.pageviewUrl = '/docs/playground';
  }
}

function createInstance() {
  if (!isClient.value) return;

  lastError.value = null;
  snapshot.value = null;

  try {
    analytics = createAnalytics({
      debug: config.debug,
      autoTrack: config.autoTrack,
      doNotTrack: config.dnt,
      includeHash: config.includeHash,
      queueSize: config.queueSize,
      provider: { name: 'noop' },
      dispatcher: {
        transportMode: 'noop',
        batching: {
          enabled: config.batchingEnabled,
          maxSize: config.batchingEnabled ? config.batchMaxSize : 1,
          maxWait: config.batchingEnabled ? config.batchMaxWait : 0,
        },
        performance: {
          enabled: true,
        },
      },
      consent: {
        initialStatus: 'pending',
        requireExplicit: true,
        allowExplicitForEssential: false,
        allowEssentialOnDenied: false,
      },
    });

    logEvent(
      'Instance created',
      `provider=noop, queueSize=${config.queueSize}, debug=${config.debug}`,
    );

    refreshSnapshot();

    if (pollTimer != null) {
      window.clearInterval(pollTimer);
    }
    pollTimer = window.setInterval(refreshSnapshot, 1000);
  } catch (e: any) {
    lastError.value = e?.message ?? String(e);
  } finally {
    initializing.value = false;
  }
}

function recreateInstance() {
  createInstance();
}

function setConsent(action: 'pending' | 'grant' | 'deny') {
  if (!analytics) return;

  switch (action) {
    case 'pending':
      analytics.resetConsent?.();
      logEvent('Consent reset', 'status=pending');
      break;
    case 'grant':
      analytics.grantConsent?.();
      logEvent('Consent granted', 'status=granted');
      break;
    case 'deny':
      analytics.denyConsent?.();
      logEvent('Consent denied', 'status=denied');
      break;
  }

  return refreshSnapshot();
}

async function sendEvent(kind: 'pageview' | 'track') {
  if (!analytics) return;

  if (kind === 'pageview') {
    analytics.pageview?.(config.pageviewUrl);
    logEvent('pageview()', config.pageviewUrl);
  } else {
    analytics.track?.('playground_event', {
      surface: 'playground',
      ts: Date.now(),
    });
    logEvent('track()', 'playground_event');
  }

  await refreshSnapshot();
}

function clearLog() {
  log.value = [];
}

onMounted(() => {
  isClient.value = typeof window !== 'undefined';
  if (isClient.value) {
    createInstance();
  }
});

onBeforeUnmount(() => {
  if (pollTimer != null) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
});
</script>

<style scoped>
.tk-playground {
  border-radius: 12px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  padding: 1.5rem;
  margin: 2rem 0;
}

.tk-header {
  margin-bottom: 1.5rem;
}

.tk-header h2 {
  margin: 0 0 0.25rem;
  font-size: 1.3rem;
}

.tk-header p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

.tk-layout-row {
  display: grid;
  gap: 1rem;
}

.tk-layout-column {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.1fr);
  gap: 1rem;
}

@media (max-width: 960px) {
  .tk-layout-column {
    grid-template-columns: minmax(0, 1fr);
  }
}

.tk-column {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tk-panel {
  background: var(--vp-c-bg);
  border-radius: 10px;
  border: 1px solid var(--vp-c-divider);
  padding: 1rem 1.1rem;
}

.tk-panel-muted {
  font-size: 0.8rem;
}

.tk-muted {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.tk-field {
  margin-bottom: 0.75rem;
}

.tk-field label {
  font-size: 0.85rem;
  font-weight: 500;
  display: block;
  margin-bottom: 0.25rem;
}

.tk-field-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.tk-select, .tk-input {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  border-radius: 6px;
  padding: 0.35rem 0.5rem;
  font-size: 0.9rem;
  width: 100%;
}

.tk-chip {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid var(--vp-c-divider);
  font-size: 0.8rem;
}

.tk-help {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.tk-checkbox-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.tk-checkbox-row label {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  font-weight: 400;
}

.tk-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  border: none;
  background: var(--vp-c-brand);
  color: white;
  font-size: 0.85rem;
  cursor: pointer;
  transition: background 0.15s ease, transform 0.05s ease;
}

.tk-button:hover {
  background: var(--vp-c-brand-dark);
}

.tk-button:active {
  transform: translateY(1px);
}

.tk-button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.tk-button-ghost {
  background: transparent;
  color: var(--vp-c-brand);
  border: 1px solid var(--vp-c-brand);
}

.tk-button-ghost:hover {
  background: var(--vp-c-brand-soft, rgba(64, 158, 255, 0.08));
}

.tk-button-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin: 0.5rem 0;
}

.tk-button-active {
  background: var(--vp-c-brand);
  color: white;
}

.tk-chip-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.tk-label {
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.tk-status {
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  font-size: 0.8rem;
  border: 1px solid var(--vp-c-divider);
  text-transform: lowercase;
}

.tk-status[data-status='granted'] {
  border-color: var(--vp-c-green-2, #3fb950);
  color: var(--vp-c-green-2, #3fb950);
}

.tk-status[data-status='denied'] {
  border-color: var(--vp-c-red-2, #f85149);
  color: var(--vp-c-red-2, #f85149);
}

.tk-status[data-status='pending'] {
  border-color: var(--vp-c-text-2);
  color: var(--vp-c-text-2);
}

.tk-hints {
  margin: 0.75rem 0 0;
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
}

.tk-hints li + li {
  margin-top: 0.15rem;
}

/* Runtime state metric layout */

.tk-metric-groups {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.tk-metric-group h4 {
  margin: 0 0 0.25rem;
  font-size: 0.9rem;
}

/* Reset dl defaults and style rows as label/value pairs */
.tk-metric-list {
  margin: 0;
  padding: 0;
}

.tk-metric-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  font-size: 0.8rem;
}

.tk-metric-row + .tk-metric-row {
  margin-top: 0.15rem;
}

.tk-metric-row dt {
  margin: 0;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.tk-metric-row dd {
  margin: 0;
  text-align: right;
  word-break: break-word;
}


.tk-log {
  max-height: 180px;
  overflow-y: auto;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  padding: 0.5rem 0.6rem;
  background: var(--vp-c-bg-soft);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono',
    'Courier New', monospace;
  font-size: 0.8rem;
}

.tk-log-row {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.15rem 0;
}

.tk-log-label {
  font-weight: 500;
}

.tk-log-detail {
  color: var(--vp-c-text-2);
}

.tk-error {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--vp-c-red-2, #f85149);
}
</style>
