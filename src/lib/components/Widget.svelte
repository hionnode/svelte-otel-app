<script lang="ts">
  import type { WidgetData } from '$lib/types';

  export let widget: WidgetData;
  export let isVisible: boolean = true; // Optimization: only render if in viewport

  // Basic styling for the widget
  const style = `
    position: absolute;
    left: ${widget.x}px;
    top: ${widget.y}px;
    border: 1px solid #ccc;
    background-color: #f9f9f9;
    padding: 10px;
    width: 200px; /* Fixed width for simplicity */
    box-shadow: 2px 2px 5px rgba(0,0,0,0.1);
    cursor: default;
    user-select: none; /* Prevent text selection when dragging canvas */
    opacity: ${isVisible ? 1 : 0.3}; /* Example for visibility */
    transition: opacity 0.2s ease-in-out;
  `;
</script>

{#if isVisible}
<div {style} title={`ID: ${widget.id}\nX: ${widget.x.toFixed(0)}, Y: ${widget.y.toFixed(0)}`}>
  <h4>{widget.title}</h4>
  <p>{widget.content}</p>
</div>
{/if}

<style>
  h4 {
    margin-top: 0;
    font-size: 1.1em;
    color: #333;
  }
  p {
    font-size: 0.9em;
    color: #666;
    word-wrap: break-word;
  }
</style>