<script lang="ts">
    /**
     * @file src/lib/components/InfiniteCanvas.svelte
     * @description Implements the interactive infinite canvas with panning and zooming.
     * Renders widgets based on current transformation and performs basic culling.
     * Includes debounced fetching of new widgets on pan/zoom interactions.
     * Adds manual OpenTelemetry tracing for zoom events.
     */
    import { onMount, onDestroy, tick } from 'svelte';
    import { get } from 'svelte/store';
    import { canvasTransform, widgets as widgetStore, isLoadingWidgets, apiError } from '$lib/stores';
    import type { CanvasTransform, WidgetData, SimulatedError } from '$lib/types';
    import Widget from './Widget.svelte';
    import { MockApiService } from '$lib/MockApiService';
    // --- Import the OTel tracer ---
    import { tracer } from '$lib/tracing'; // Assuming tracing.ts exports the tracer
    import { SpanStatusCode } from '@opentelemetry/api'; // Import status codes
  
    // --- Component State ---
    let canvasContainerElement: HTMLDivElement;
    let canvasContentElement: HTMLDivElement;
    let isPanning = false;
    let lastPanX = 0;
    let lastPanY = 0;
  
    // --- API Service Instance ---
    const apiService = MockApiService.getInstance();
  
    // --- Debounce State ---
    let debounceTimer: number | null = null;
    const DEBOUNCE_DELAY = 400;
  
    // --- Svelte Store Subscriptions ---
    let transform: CanvasTransform;
    const unsubscribeTransform = canvasTransform.subscribe(value => {
      transform = value;
    });
  
    let currentWidgets: WidgetData[] = [];
    const unsubscribeWidgets = widgetStore.subscribe(value => {
      currentWidgets = value;
    });
  
    let isInteractionLoading = false;
    let currentApiError: string | null = null;
    const unsubscribeLoading = isLoadingWidgets.subscribe(value => isInteractionLoading = value);
    const unsubscribeError = apiError.subscribe(value => currentApiError = value);
  
  
    // --- Viewport Culling State ---
    let viewportWidth = 0;
    let viewportHeight = 0;
  
    // --- Lifecycle Hooks ---
    onMount(() => {
      if (canvasContainerElement) {
        updateViewportDimensions();
        addEventListeners();
        canvasContainerElement.style.cursor = 'grab';
      }
      return () => {
        removeEventListeners();
        unsubscribeTransform();
        unsubscribeWidgets();
        unsubscribeLoading();
        unsubscribeError();
        if (debounceTimer) clearTimeout(debounceTimer);
      };
    });
  
    // --- Event Handlers & Logic ---
  
    function updateViewportDimensions() {
      if (canvasContainerElement) {
          viewportWidth = canvasContainerElement.clientWidth;
          viewportHeight = canvasContainerElement.clientHeight;
      }
    }
  
    function addEventListeners() {
      if (!canvasContainerElement) return;
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('resize', handleResize);
      canvasContainerElement.addEventListener('mousedown', handleMouseDown);
      canvasContainerElement.addEventListener('mousemove', handleMouseMove);
      canvasContainerElement.addEventListener('wheel', handleWheel, { passive: false });
    }
  
    function removeEventListeners() {
       if (!canvasContainerElement) return;
       window.removeEventListener('mouseup', handleMouseUp);
       window.removeEventListener('resize', handleResize);
       canvasContainerElement.removeEventListener('mousedown', handleMouseDown);
       canvasContainerElement.removeEventListener('mousemove', handleMouseMove);
       canvasContainerElement.removeEventListener('wheel', handleWheel);
    }
  
    const handleMouseDown = (event: MouseEvent) => {
      // Potential place to start a 'canvas.pan.start' span
      if (event.button !== 0) return;
      isPanning = true;
      lastPanX = event.clientX;
      lastPanY = event.clientY;
      if (canvasContainerElement) canvasContainerElement.style.cursor = 'grabbing';
      event.preventDefault();
    };
  
    const handleMouseMove = (event: MouseEvent) => {
      // Potential place to add events to the 'canvas.pan' span started in handleMouseDown
      if (!isPanning) return;
      const dx = event.clientX - lastPanX;
      const dy = event.clientY - lastPanY;
      canvasTransform.update(current => ({
        ...current,
        panX: current.panX + dx / current.zoom,
        panY: current.panY + dy / current.zoom,
      }));
      lastPanX = event.clientX;
      lastPanY = event.clientY;
      triggerDebouncedFetch();
    };
  
    const handleMouseUp = () => {
      // Potential place to end the 'canvas.pan' span
      if (isPanning) {
        isPanning = false;
        if (canvasContainerElement) canvasContainerElement.style.cursor = 'grab';
      }
    };
  
    /** Handles the wheel event to perform zooming, centered on the mouse pointer. */
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
  
      // --- Start OTel Span for Zoom ---
      const zoomSpan = tracer.startSpan('canvas.zoom', {
          attributes: {
              'component': 'InfiniteCanvas',
              'event.type': 'wheel',
              'mouse.x': event.clientX,
              'mouse.y': event.clientY,
              'mouse.wheel.deltaY': event.deltaY,
          }
      });
  
      try {
          const zoomFactor = 1.15;
          const oldZoom = transform.zoom;
          const zoomDirection = event.deltaY < 0 ? 'in' : 'out'; // Determine direction
          const newZoom = event.deltaY < 0 ? oldZoom * zoomFactor : oldZoom / zoomFactor;
          const clampedZoom = Math.max(0.1, Math.min(newZoom, 10));
  
          // Add attributes before potential early exit
          zoomSpan.setAttributes({
              'zoom.direction': zoomDirection,
              'zoom.level.old': oldZoom,
              'zoom.level.new.attempted': newZoom,
              'zoom.level.new.clamped': clampedZoom,
          });
  
  
          if (clampedZoom === oldZoom) {
              zoomSpan.addEvent('Zoom level unchanged due to clamping');
              zoomSpan.setStatus({ code: SpanStatusCode.OK, message: 'Zoom unchanged' });
              zoomSpan.end(); // End the span early
              return;
          }
  
          const rect = canvasContainerElement.getBoundingClientRect();
          const mouseXInViewport = event.clientX - rect.left;
          const mouseYInViewport = event.clientY - rect.top;
          const mouseXWorld = (mouseXInViewport / oldZoom) - transform.panX;
          const mouseYWorld = (mouseYInViewport / oldZoom) - transform.panY;
          const newPanX = (mouseXInViewport / clampedZoom) - mouseXWorld;
          const newPanY = (mouseYInViewport / clampedZoom) - mouseYWorld;
  
          // Add more attributes related to the calculation
           zoomSpan.setAttributes({
              'mouse.viewport.x': mouseXInViewport,
              'mouse.viewport.y': mouseYInViewport,
              'mouse.world.x': mouseXWorld,
              'mouse.world.y': mouseYWorld,
              'pan.new.x': newPanX,
              'pan.new.y': newPanY,
           });
  
          // Update the canvas transform store
          canvasTransform.set({
            panX: newPanX,
            panY: newPanY,
            zoom: clampedZoom,
          });
  
          // Trigger debounced fetch on zoom
          triggerDebouncedFetch();
  
          // Set span status to OK on success
          zoomSpan.setStatus({ code: SpanStatusCode.OK });
  
      } catch (error) {
          // Record error on the span
          console.error("Error during zoom handling:", error);
          zoomSpan.recordException(error as Error);
          zoomSpan.setStatus({ code: SpanStatusCode.ERROR, message: (error as Error).message });
          // Re-throw or handle as needed
      } finally {
          // --- End OTel Span ---
          // Ensure the span is always ended, regardless of success or error
          zoomSpan.end();
      }
    };
  
  
    const handleResize = () => {
      updateViewportDimensions();
      triggerDebouncedFetch();
    };
  
    // --- Debounced API Fetch Logic ---
  
    function triggerDebouncedFetch() {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = window.setTimeout(() => {
        fetchWidgetsForCurrentView();
      }, DEBOUNCE_DELAY);
    }
  
    async function fetchWidgetsForCurrentView() {
      if (get(isLoadingWidgets)) {
          console.log("[Canvas Interaction Fetch] Skipped fetch, already loading.");
          return;
      }
      console.log(`[Canvas Interaction Fetch] Triggered fetch after debounce.`);
      isLoadingWidgets.set(true);
      apiError.set(null);
  
      // --- Start OTel Span for Interaction Fetch ---
      // Note: This span might not be directly linked to the zoom/pan span easily
      // without explicit context propagation, but it captures the fetch itself.
      const fetchSpan = tracer.startSpan('canvas.interaction.fetchWidgets', {
          attributes: {
              'component': 'InfiniteCanvas',
              'trigger': 'debounce', // Could be 'pan', 'zoom', 'resize' if tracked
          }
      });
  
      try {
        const worldViewCenterX = (viewportWidth / 2 / transform.zoom) - transform.panX;
        const worldViewCenterY = (viewportHeight / 2 / transform.zoom) - transform.panY;
  
        // Add calculation details to span
        fetchSpan.setAttributes({
            'viewport.center.world.x': worldViewCenterX,
            'viewport.center.world.y': worldViewCenterY,
            'current.zoom': transform.zoom,
            'widget.request.count': 1, // Fetching 1 widget
        });
  
        const newWidgets = await apiService.fetchAllWidgets(
            1,
            worldViewCenterX,
            worldViewCenterY,
            transform.zoom
        );
  
        let addedCount = 0;
        widgetStore.update(current => {
            const existingIds = new Set(current.map(w => w.id));
            const trulyNewWidgets = newWidgets.filter(nw => !existingIds.has(nw.id));
            addedCount = trulyNewWidgets.length;
            if(addedCount > 0) {
                console.log(`[Canvas Interaction Fetch] Adding ${addedCount} new widgets.`);
                return [...current, ...trulyNewWidgets];
            } else {
                console.log(`[Canvas Interaction Fetch] No new unique widgets fetched.`);
                return current;
            }
        });
  
        fetchSpan.setAttributes({
            'widget.added.count': addedCount,
            'widget.fetched.count': newWidgets.length,
        });
        fetchSpan.setStatus({ code: SpanStatusCode.OK });
  
      } catch (err) {
        const e = err as SimulatedError;
        console.error("[Canvas Interaction Fetch] Error fetching widgets:", e.message);
        apiError.set(`Interaction fetch failed: ${e.message || "Unknown error"}`);
        // Record error on the fetch span
        fetchSpan.recordException(e);
        fetchSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message });
      } finally {
        isLoadingWidgets.set(false);
        debounceTimer = null;
        // End the fetch span
        fetchSpan.end();
      }
    }
  
  
    // --- Viewport Culling Logic --- (Same as before)
    function isWidgetInView(widget: WidgetData, currentTransform: CanvasTransform): boolean {
      const widgetWidthWorld = 220;
      const widgetHeightWorld = 150;
      const buffer = 100 / currentTransform.zoom;
      const w_left = widget.x;
      const w_right = widget.x + widgetWidthWorld;
      const w_top = widget.y;
      const w_bottom = widget.y + widgetHeightWorld;
      const v_left = -currentTransform.panX - buffer;
      const v_top = -currentTransform.panY - buffer;
      const v_right = -currentTransform.panX + (viewportWidth / currentTransform.zoom) + buffer;
      const v_bottom = -currentTransform.panY + (viewportHeight / currentTransform.zoom) + buffer;
      return w_left < v_right && w_right > v_left && w_top < v_bottom && w_bottom > v_top;
    }
  
  </script>
  
  <div class="canvas-container" bind:this={canvasContainerElement}>
    <div
      class="canvas-content"
      bind:this={canvasContentElement}
      style="transform: translate({transform.panX}px, {transform.panY}px) scale({transform.zoom}); transform-origin: 0 0;"
    >
      {#each currentWidgets as widget (widget.id)}
        <Widget {widget} isVisible={isWidgetInView(widget, transform)} />
      {/each}
    </div>
  </div>
  
  <div class="debug-info">
    Pan X: {transform.panX.toFixed(1)}, Pan Y: {transform.panY.toFixed(1)}, Zoom: {transform.zoom.toFixed(2)}<br />
    Widgets: {currentWidgets.length} | Viewport: {viewportWidth}x{viewportHeight} {#if isInteractionLoading}(Fetching...){/if}
    {#if currentApiError}<span style="color: red;"> Error!</span>{/if}
  </div>
  
  <style>
    /* Styles are largely the same as before */
    .canvas-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
      background-color: #e8e8e8;
      border: 1px solid #c0c0c0;
      cursor: grab;
    }
  
    .canvas-content {
      position: absolute;
      left: 0;
      top: 0;
      width: 1px;
      height: 1px;
      transform-origin: 0 0;
      will-change: transform;
    }
  
    .debug-info {
      position: fixed;
      bottom: 10px;
      left: 10px;
      background-color: rgba(0, 0, 0, 0.75);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.8em;
      z-index: 1000;
      pointer-events: none;
    }
  </style>
  