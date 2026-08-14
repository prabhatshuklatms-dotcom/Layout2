import { useEffect, useRef } from 'react';

export default function usePlotRevealAnimation(svgRef, shapes, layoutRevealKey) {
  // Store a reference to running animations so we can cancel them if needed
  const activeAnimationsRef = useRef([]);
  // Track the initialized layout directly in a React ref to survive DOM reconciliations
  const lastRevealKeyRef = useRef(null);

  useEffect(() => {
    if (!svgRef.current || !shapes || shapes.length === 0 || !layoutRevealKey) return;

    // Use double requestAnimationFrame to ensure the DOM is fully painted
    // before we query the plot nodes and calculate geometry.
    let raf1, raf2;
    
    const initializeReveal = () => {
      if (!svgRef.current) return;
      const svgEl = svgRef.current.tagName.toLowerCase() === 'svg' ? svgRef.current : svgRef.current.querySelector('svg');
      if (!svgEl) return;

      console.log(`[PlotReveal] layout key: ${layoutRevealKey}`);
      console.log(`[PlotReveal] initialization requested`);

      // Check if we already initialized this specific layout
      if (lastRevealKeyRef.current === layoutRevealKey) {
        console.log(`[PlotReveal] already initialized: ${layoutRevealKey}`);
        return;
      }

      console.log(`[PlotReveal] SVG mounted`);

      const plotNodes = Array.from(svgEl.querySelectorAll('[data-plot-id]'));
      console.log(`[PlotReveal] plot count: ${plotNodes.length}`);
      
      if (plotNodes.length === 0) return;

      // Mark this layout as initialized so we NEVER restart it due to React renders
      lastRevealKeyRef.current = layoutRevealKey;

      // Cancel any leftover animations from the previous layout
      activeAnimationsRef.current.forEach(anim => {
        try { anim.cancel(); } catch (e) {}
      });
      activeAnimationsRef.current = [];

      // Calculate actual X positions for sorting
      const plotsWithGeometry = plotNodes.map(node => {
        let centerX = 0;
        try {
          const bbox = node.getBBox();
          centerX = bbox.x + bbox.width / 2;
        } catch (e) {
          try {
            const rect = node.getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
          } catch (e2) {}
        }
        return {
          node,
          id: node.getAttribute('data-plot-id'),
          genericId: node.id,
          centerX
        };
      });

      // Filter out invalid nodes (though all should have data-plot-id from the selector)
      const validPlots = plotsWithGeometry.filter(p => p.id);
      
      console.log(`[PlotReveal] plot IDs: ${validPlots.map(p => p.id).join(', ')}`);
      console.log(`[PlotReveal] calculated X positions: ${validPlots.map(p => Math.round(p.centerX)).join(', ')}`);

      // Sort by actual X ascending (LEFT -> RIGHT)
      validPlots.sort((a, b) => a.centerX - b.centerX);
      
      console.log(`[PlotReveal] sorted IDs: ${validPlots.map(p => p.id).join(', ')}`);

      const labelsFound = [];
      let animationsStarted = 0;

      // Native WAAPI Keyframes - Opacity ONLY (No scale to prevent SVG blur)
      const keyframes = [
        { opacity: 0 },
        { opacity: 1 }
      ];

      validPlots.forEach((plot, index) => {
        const delay = index * 30; // 30ms stagger
        
        const options = {
          duration: 220,
          delay: delay,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards"
        };

        // 1. Animate Plot (Opacity only, no transform origin manipulation needed)
        const plotAnim = plot.node.animate(keyframes, options);
        plotAnim.onfinish = () => { try { plotAnim.cancel(); } catch (e) {} };
        activeAnimationsRef.current.push(plotAnim);
        animationsStarted++;

        // 2. Animate Label
        // Find corresponding label in the PlotLabelsOverlay
        if (plot.genericId) {
          const labelNode = svgEl.querySelector(`g[data-label-for="${plot.genericId}"]`);
          if (labelNode) {
            labelsFound.push(plot.id);
            const labelAnim = labelNode.animate(keyframes, options);
            labelAnim.onfinish = () => { try { labelAnim.cancel(); } catch (e) {} };
            activeAnimationsRef.current.push(labelAnim);
          }
        }
      });

      console.log(`[PlotReveal] labels found: ${labelsFound.length}`);
      console.log(`[PlotReveal] animations started: ${animationsStarted}`);

      // Wait for the longest animation to finish before logging complete
      if (validPlots.length > 0) {
        const maxDuration = ((validPlots.length - 1) * 30) + 220;
        setTimeout(() => {
          console.log(`[PlotReveal] animation complete`);
        }, maxDuration + 50);
      }
    };

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        initializeReveal();
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [svgRef, shapes, layoutRevealKey]);

}
