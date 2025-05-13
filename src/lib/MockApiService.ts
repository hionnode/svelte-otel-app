import type { WidgetData, SimulatedError, ApiErrorType } from './types';
import { get } from 'svelte/store';
import { errorProbability } from './stores';

const MOCK_WIDGET_TITLES = ["Alpha Widget", "Bravo Item", "Charlie Component", "Delta Module", "Echo Element"];
const MOCK_WIDGET_CONTENTS = [
    "This is some detailed content for the widget.",
    "Another piece of insightful information.",
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."
];

function generateRandomId(): string {
    return Math.random().toString(36).substring(2, 15);
}

function logError(error: SimulatedError) {
    console.error(`[MockApiService ERROR]
    Timestamp: ${error.timestamp}
    Error Type: ${error.errorType}
    Message: ${error.message}
    Status Code: ${error.status || 'N/A'}
    Request Params: ${JSON.stringify(error.requestParams) || 'N/A'}
    Stack Trace: ${error.simulatedStackTrace}`);
}

function logSuccess(methodName: string, duration: number, params?: any, result?: any) {
    console.log(`[MockApiService SUCCESS]
    Timestamp: ${new Date().toISOString()}
    Method: ${methodName}
    Duration: ${duration}ms
    Request Params: ${JSON.stringify(params) || 'N/A'}
    ${result ? `Result: ${JSON.stringify(result).substring(0, 100)}...` : ''}`);
}

export class MockApiService {
    private static instance: MockApiService;
    private errorRate: number = get(errorProbability); // Initialize with store value

    private constructor() {
        // Subscribe to errorProbability store for dynamic updates
        errorProbability.subscribe(value => {
            this.errorRate = value;
            console.log(`[MockApiService] Error probability updated to: ${value * 100}%`);
        });
    }

    public static getInstance(): MockApiService {
        if (!MockApiService.instance) {
            MockApiService.instance = new MockApiService();
        }
        return MockApiService.instance;
    }

    private shouldSimulateError(): boolean {
        return Math.random() < this.errorRate;
    }

    private simulateError(requestParams?: any): SimulatedError {
        const errorTypes: { type: ApiErrorType; message: string; status?: number }[] = [
            { type: "NetworkError", message: "Network timeout. Please check your connection." },
            { type: "APIError", message: "Internal Server Error", status: 500 },
            { type: "NotFoundError", message: "Resource Not Found", status: 404 },
            { type: "APIError", message: "Invalid request parameters", status: 400 }
        ];
        const randomErrorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];

        const error: SimulatedError = new Error(randomErrorType.message);
        error.name = randomErrorType.type; // For better distinction
        error.errorType = randomErrorType.type;
        error.status = randomErrorType.status;
        error.timestamp = new Date().toISOString();
        error.requestParams = requestParams;
        error.simulatedStackTrace = `Error: ${randomErrorType.message}\n    at MockApiService.simulateError (MockApiService.ts:${Math.floor(Math.random() * 20) + 50})\n    at <calling_method> (MockApiService.ts:${Math.floor(Math.random() * 20) + 80})`; // Simplified stack

        logError(error);
        return error;
    }

    public async fetchWidgetData(widgetId: string): Promise<WidgetData> {
        const startTime = Date.now();
        const requestParams = { widgetId };

        return new Promise((resolve, reject) => {
            const latency = Math.random() * 800 + 200; // 200ms to 1000ms
            setTimeout(() => {
                if (this.shouldSimulateError()) {
                    reject(this.simulateError(requestParams));
                    return;
                }

                const widget: WidgetData = {
                    id: widgetId,
                    title: MOCK_WIDGET_TITLES[Math.floor(Math.random() * MOCK_WIDGET_TITLES.length)],
                    content: MOCK_WIDGET_CONTENTS[Math.floor(Math.random() * MOCK_WIDGET_CONTENTS.length)],
                    x: Math.floor(Math.random() * 1000 - 500), // Random position for individual fetch
                    y: Math.floor(Math.random() * 1000 - 500),
                };
                logSuccess('fetchWidgetData', Date.now() - startTime, requestParams, widget);
                resolve(widget);
            }, latency);
        });
    }

    public async fetchAllWidgets(count: number = 5, currentPanX: number = 0, currentPanY: number = 0, currentZoom: number = 1): Promise<WidgetData[]> {
        const startTime = Date.now();
        const requestParams = { count, currentPanX, currentPanY, currentZoom };

        return new Promise((resolve, reject) => {
            const latency = Math.random() * 1500 + 500; // 500ms to 2000ms
            setTimeout(() => {
                if (this.shouldSimulateError()) {
                    reject(this.simulateError(requestParams));
                    return;
                }

                const newWidgets: WidgetData[] = [];
                for (let i = 0; i < count; i++) {
                    // Spawn new widgets somewhat near the current viewport center
                    // Adjust spawn radius based on zoom to make them appear "in the vicinity"
                    const spawnRadius = 300 / currentZoom;
                    newWidgets.push({
                        id: generateRandomId(),
                        title: `${MOCK_WIDGET_TITLES[Math.floor(Math.random() * MOCK_WIDGET_TITLES.length)]} #${i + 1}`,
                        content: MOCK_WIDGET_CONTENTS[Math.floor(Math.random() * MOCK_WIDGET_CONTENTS.length)],
                        x: currentPanX + (Math.random() * spawnRadius * 2 - spawnRadius),
                        y: currentPanY + (Math.random() * spawnRadius * 2 - spawnRadius),
                    });
                }
                logSuccess('fetchAllWidgets', Date.now() - startTime, requestParams, newWidgets);
                resolve(newWidgets);
            }, latency);
        });
    }

    // Method to update error probability (e.g., from a UI control)
    public setErrorProbability(probability: number): void {
        if (probability >= 0 && probability <= 1) {
            errorProbability.set(probability); // This will trigger the subscription and update this.errorRate
        } else {
            console.warn("[MockApiService] Invalid error probability. Must be between 0 and 1.");
        }
    }
}