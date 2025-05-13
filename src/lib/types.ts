/**
 * @file src/lib/types.ts
 * @description Defines shared TypeScript types and interfaces for the application.
 */

/**
 * Represents the data structure for a single Widget.
 */
export interface WidgetData {
    id: string;
    title: string;
    content: string;
    x: number; // Position on the conceptual infinite canvas (world coordinates)
    y: number; // Position on the conceptual infinite canvas (world coordinates)
}

/**
 * Represents the state of the canvas transformation (pan and zoom).
 * Pan coordinates represent the offset of the world origin (0,0)
 * relative to the viewport's top-left corner.
 * Positive panX moves the world origin rightwards on screen.
 * Positive panY moves the world origin downwards on screen.
 */
export interface CanvasTransform {
    panX: number;
    panY: number;
    zoom: number;
}

/**
 * Defines the possible types of simulated API errors.
 */
export type ApiErrorType = "NetworkError" | "APIError" | "NotFoundError";

/**
 * Extends the base Error interface to include simulation-specific details
 * for logging and handling.
 */
export interface SimulatedError extends Error {
    status?: number; // HTTP-like status code (e.g., 404, 500)
    errorType?: ApiErrorType; // Category of the simulated error
    timestamp?: string; // ISO timestamp when the error occurred
    requestParams?: any; // Parameters sent with the request that failed
    simulatedStackTrace?: string; // A simplified, generated stack trace string
}

