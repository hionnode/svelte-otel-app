<script lang="ts">
    import { onMount } from 'svelte';
    import InfiniteCanvas from '$lib/components/InfiniteCanvas.svelte';
    import { MockApiService } from '$lib/MockApiService';
    import { widgets, isLoadingWidgets, apiError, canvasTransform, errorProbability } from '$lib/stores';
    import type { WidgetData, SimulatedError } from '$lib/types';
    import type { CanvasTransform } from '$lib/types';
    import '../lib/tracing'
  
    const apiService = MockApiService.getInstance();
    let currentErrorProbability: number;
    errorProbability.subscribe(v => currentErrorProbability = v);
  
    let ct: CanvasTransform;
    canvasTransform.subscribe(value => ct = value);
  
  
    async function fetchInitialWidgets() {
      isLoadingWidgets.set(true);
      apiError.set(null);
      try {
        // Fetch widgets near the initial view (0,0 at zoom 1)
        const newWidgets = await apiService.fetchAllWidgets(5, $canvasTransform.panX, $canvasTransform.panY, $canvasTransform.zoom);
        widgets.update(currentWidgets => [...currentWidgets, ...newWidgets]);
      } catch (err) {
        const e = err as SimulatedError;
        apiError.set(e.message || "An unknown error occurred.");
        // Error is already logged by MockApiService
      } finally {
        isLoadingWidgets.set(false);
      }
    }
  
    async function fetchMoreWidgets() {
      isLoadingWidgets.set(true);
      apiError.set(null);
      try {
        // Fetch widgets near the current center of the viewport
        const newWidgets = await apiService.fetchAllWidgets(3, -$canvasTransform.panX + (window.innerWidth / 2 / $canvasTransform.zoom) , -$canvasTransform.panY + (window.innerHeight / 2 / $canvasTransform.zoom), $canvasTransform.zoom);
        widgets.update(currentWidgets => [...currentWidgets, ...newWidgets]);
      } catch (err) {
        const e = err as SimulatedError;
        apiError.set(e.message || "An unknown error occurred.");
      } finally {
        isLoadingWidgets.set(false);
      }
    }
    
    function handleProbabilityChange(event: Event) {
      const target = event.target as HTMLInputElement;
      const newProb = parseFloat(target.value);
      if (!isNaN(newProb) && newProb >= 0 && newProb <=1) {
          apiService.setErrorProbability(newProb); // This updates the store and MockApiService instance
      }
    }
  
    onMount(async () => {
    // Wait for window dimensions to be available if needed, or use fixed estimates
    // For simplicity, assuming window.innerWidth/Height are somewhat stable on mount
    // or that the initial spawn point around (0,0) is acceptable.
    // For better centering, we might need to know viewportWidth/Height from InfiniteCanvas
    // or pass them down. For now, spawning around world origin (0,0) is fine.
    // If we want them centered in the initial view:
    // This requires viewport dimensions. Let's approximate or fetch them.
    // However, InfiniteCanvas's viewportWidth/Height are set in its onMount.
    // For a robust solution, App.svelte might need to wait or the canvas could emit an event.
    // Simpler: pass 0,0 as world center for first fetch. They will be near world origin.
    
    // Let's adjust the initial fetch to be near the viewport center, assuming panX/Y are 0 initially
    // This means world center is (viewportWidth/2 / zoom, viewportHeight/2 / zoom)
    // We need viewportWidth and viewportHeight here.
    // For now, let's use 0,0 for simplicity, meaning they spawn near world origin.
    // The `MockApiService` takes these as `currentPanX`, `currentPanY` which it interprets as center.
    
    // Simplification: Fetch initial widgets around world origin (0,0)
    // The store is already initialized with panX:0, panY:0, zoom:1
    // So, - $canvasTransform.panX = 0, etc.
    // The `WorkspaceAllWidgets` method in MockApiService uses its `currentPanX` and `currentPanY` arguments
    // as the center point for random placement.
    
    isLoadingWidgets.set(true);
    apiError.set(null);
    try {
      // Use calculated world center for initial load
      const initialWorldCenterX = (window.innerWidth / 2 / $canvasTransform.zoom) - $canvasTransform.panX;
      const initialWorldCenterY = (window.innerHeight / 2 / $canvasTransform.zoom) - $canvasTransform.panY;
      const newWidgets = await apiService.fetchAllWidgets(5, initialWorldCenterX, initialWorldCenterY, $canvasTransform.zoom);
      widgets.set(newWidgets); // Set, not update, for initial load.
    } catch (err) {
      const e = err as SimulatedError;
      apiError.set(e.message || "An unknown error occurred.");
    } finally {
      isLoadingWidgets.set(false);
    }
  });
  </script>
  
  <main>
    <div class="controls">
      <button on:click={fetchMoreWidgets} disabled={$isLoadingWidgets}>
        {#if $isLoadingWidgets}Fetching Widgets...{:else}Fetch More Widgets{/if}
      </button>
      <label for="errorProb">Error Probability ({ (currentErrorProbability * 100).toFixed(0) }%): </label>
      <input 
          type="range" 
          id="errorProb" 
          min="0" 
          max="1" 
          step="0.01" 
          value={currentErrorProbability} 
          on:input={handleProbabilityChange} 
          title="Adjust API Error Probability"
      />
    </div>
  
    {#if $apiError}
      <div class="error-message">
        <p><strong>Error:</strong> {$apiError}</p>
        <button on:click={() => apiError.set(null)}>Dismiss</button>
      </div>
    {/if}
  
    <div class="canvas-wrapper">
      <InfiniteCanvas />
    </div>
  </main>
  
  <style>
    main {
      display: flex;
      flex-direction: column;
      height: 100vh; /* Full viewport height */
      width: 100vw; /* Full viewport width */
      margin: 0;
      padding: 0;
      overflow: hidden; /* Prevent scrollbars on main due to canvas */
    }
  
    .controls {
      padding: 10px;
      background-color: #f0f0f0;
      border-bottom: 1px solid #ccc;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-shrink: 0; /* Prevent controls from shrinking */
    }
  
    .controls button {
      padding: 8px 15px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
  
    .controls button:disabled {
      background-color: #aaa;
      cursor: not-allowed;
    }
  
    .controls label {
      font-size: 0.9em;
    }
  
    .controls input[type="range"] {
      width: 150px;
    }
  
    .error-message {
      background-color: #ffdddd;
      color: #d8000c;
      padding: 10px;
      border-bottom: 1px solid #d8000c;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .error-message p {
      margin: 0;
    }
    .error-message button {
      padding: 5px 10px;
      background-color: #d8000c;
      color: white;
      border: none;
      border-radius: 3px;
      cursor: pointer;
    }
  
    .canvas-wrapper {
      flex-grow: 1; /* Canvas takes remaining space */
      position: relative; /* Needed if InfiniteCanvas uses absolute positioning internally */
      overflow: hidden; /* Ensure no overflow from wrapper */
    }
  </style>