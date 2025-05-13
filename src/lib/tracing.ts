import { Resource, defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { WebTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';
import { trace, metrics, context } from '@opentelemetry/api';

// --- Import Metrics-related packages ---
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';

// --- Import Web Vitals ---
import { onCLS, onFCP, onLCP, onTTFB, type Metric } from 'web-vitals';

// --- Shared Configuration ---
const collectorHttpUrl = 'http://localhost:14318'; // OTel Collector HTTP endpoint base URL
const serviceName = 'svelte-infinite-canvas-app'; // Your service name
const serviceVersion = '0.1.0'; // Your service version

// Define resource attributes shared by traces and metrics
// const resource = new Resource({
//     [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
//     [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
// });

const resource = defaultResource().merge(
    resourceFromAttributes({
        'service.name': 'svelte-infinite-canvas-app',
        'service.version': '0.1.0',
    })
);

// --- Trace Setup ---
console.log(`Initializing OpenTelemetry Tracing for ${serviceName}...`);

// Configure the OTLP Exporter to send traces to your Collector
const traceExporter = new OTLPTraceExporter({
    url: `${collectorHttpUrl}/v1/traces`, // Collector's OTLP/HTTP trace endpoint
    // headers: {}, // Optional headers
});

// Configure the BatchSpanProcessor
const traceProcessor = new BatchSpanProcessor(traceExporter);

const traceProvider = new WebTracerProvider({
    resource: resource,
    spanProcessors: [traceProcessor]
});

traceProvider.register({
    contextManager: new ZoneContextManager(),
});

console.log("Trace Provider registered.");

// Initialize automatic instrumentations (includes DocumentLoadInstrumentation)
registerInstrumentations({
    // tracerProvider: traceProvider, // Not needed if registered globally
    instrumentations: [
        getWebAutoInstrumentations({
            '@opentelemetry/instrumentation-xml-http-request': {
                propagateTraceHeaderCorsUrls: [/.+/g],
                clearTimingResources: true,
            },
            '@opentelemetry/instrumentation-fetch': {
                propagateTraceHeaderCorsUrls: [/.+/g],
                clearTimingResources: true,
            },
            '@opentelemetry/instrumentation-document-load': {}, // Explicitly enable if needed, but default
            '@opentelemetry/instrumentation-user-interaction': {}, // Explicitly enable if needed, but default
        }),
    ],
});

console.log("Automatic Web Instrumentations registered.");

// --- Metrics Setup (for Web Vitals) ---
console.log(`Initializing OpenTelemetry Metrics for ${serviceName}...`);

// Configure the OTLP Exporter to send metrics to your Collector
const metricExporter = new OTLPMetricExporter({
    url: `${collectorHttpUrl}/v1/metrics`, // Collector's OTLP/HTTP metrics endpoint
    // headers: {}, // Optional headers
});

// Configure the Metric Reader (exports metrics periodically)
const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 15000, // Export metrics every 15 seconds
});

// Create and register the MeterProvider
const meterProvider = new MeterProvider({
    resource: resource,
    readers: [metricReader],
});

// Set the custom MeterProvider globally
// This makes it available via metrics.getMeterProvider()
metrics.setGlobalMeterProvider(meterProvider);

console.log("Meter Provider registered.");

// --- Web Vitals Instrumentation ---

// Get a meter instance
const meter = metrics.getMeter('web-vitals-meter'); // Use a descriptive meter name

// Create metric instruments (Histograms for timing, Gauge for CLS)
// Using standard names where possible is good practice
const lcpMetric = meter.createHistogram('webvitals.lcp', { description: 'Largest Contentful Paint', unit: 'ms' });
const clsMetric = meter.createObservableGauge('webvitals.cls', { description: 'Cumulative Layout Shift', unit: '1' }); // CLS is unitless score
const fidMetric = meter.createHistogram('webvitals.fid', { description: 'First Input Delay', unit: 'ms' });
const ttfbMetric = meter.createHistogram('webvitals.ttfb', { description: 'Time to First Byte', unit: 'ms' });
const fcpMetric = meter.createHistogram('webvitals.fcp', { description: 'First Contentful Paint', unit: 'ms' });

// Variable to hold the latest CLS value for the observable gauge
let latestClsValue = 0;

// Add the callback for the CLS observable gauge
clsMetric.addCallback((result) => {
    // Observe the latest value when the SDK scrapes the metric
    result.observe(latestClsValue);
    console.log(`Observed CLS: ${latestClsValue}`);
});

// Callback function to record Web Vitals metrics
function recordWebVitalsMetric(metric: Metric) {
    console.log(`Web Vital Captured: ${metric.name}`, metric.value);
    // Common attributes you might want to add
    const attributes = {
        // Example: Add page path if available
        // 'page.path': window.location.pathname,
        'metric.source': 'web-vitals-library',
        'metric.rating': metric.rating, // 'good', 'needs-improvement', 'poor'
        'metric.id': metric.id, // Unique ID for the metric instance
    };

    switch (metric.name) {
        case 'LCP':
            lcpMetric.record(metric.value, attributes);
            break;
        case 'CLS':
            // Update the latest value for the observable gauge
            // The addCallback function will handle observing it
            latestClsValue = metric.value;
            break;
        case 'TTFB':
            ttfbMetric.record(metric.value, attributes);
            break;
        case 'FCP':
            fcpMetric.record(metric.value, attributes);
            break;
        default:
            console.warn(`Unhandled Web Vital metric: ${metric.name}`);
            break;
    }
}

// Register the web-vitals listeners
try {
    onCLS(recordWebVitalsMetric);
    onLCP(recordWebVitalsMetric);
    onTTFB(recordWebVitalsMetric);
    onFCP(recordWebVitalsMetric);
    console.log("Web Vitals listeners registered.");
} catch (error) {
    console.error("Error registering Web Vitals listeners:", error);
}

// --- Export Tracer (Optional) ---
// Export if you need to do manual tracing elsewhere in your app
export const tracer = trace.getTracer('svelte-app-tracer');
